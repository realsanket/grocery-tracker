import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { productAliases, products, type Product } from "@/db/schema";
import type { NormalizedItem } from "./normalize-product";

export interface ProductMatch {
  product: Product;
  created: boolean;
  matchedBy: "normalized_key" | "alias" | "created";
}

/**
 * Resolve a normalized item to a product:
 * 1. exact normalized_key match
 * 2. alias match on the raw observed name
 * 3. otherwise create a new product
 */
export async function matchOrCreateProduct(
  db: Db,
  item: NormalizedItem,
): Promise<ProductMatch> {
  const byKey = await db
    .select()
    .from(products)
    .where(eq(products.normalizedKey, item.normalizedKey))
    .limit(1);
  if (byKey[0]) return { product: byKey[0], created: false, matchedBy: "normalized_key" };

  const byAlias = await db
    .select({ product: products })
    .from(productAliases)
    .innerJoin(products, eq(productAliases.productId, products.id))
    .where(
      sql`lower(${productAliases.aliasTextOriginal}) = lower(${item.rawNameOriginal})`,
    )
    .limit(1);
  if (byAlias[0]) return { product: byAlias[0].product, created: false, matchedBy: "alias" };

  const inserted = await db
    .insert(products)
    .values({
      canonicalNameEn: item.canonicalNameEn,
      brand: item.brand,
      categoryEn: item.categoryEn,
      sizeValue: item.sizeValue != null ? String(item.sizeValue) : null,
      sizeUnit: item.sizeUnit,
      normalizedKey: item.normalizedKey,
    })
    .onConflictDoNothing({ target: products.normalizedKey })
    .returning();

  if (inserted[0]) return { product: inserted[0], created: true, matchedBy: "created" };

  // Lost a race with a concurrent insert of the same key — read it back.
  const winner = await db
    .select()
    .from(products)
    .where(eq(products.normalizedKey, item.normalizedKey))
    .limit(1);
  return { product: winner[0], created: false, matchedBy: "normalized_key" };
}

/** Record the raw receipt text as an alias of the product (idempotent). */
export async function recordAlias(
  db: Db,
  args: {
    productId: string;
    item: NormalizedItem;
    storeId?: string | null;
    languageCode?: string | null;
  },
): Promise<void> {
  await db
    .insert(productAliases)
    .values({
      productId: args.productId,
      aliasTextOriginal: args.item.rawNameOriginal,
      aliasTextEnglish: args.item.rawNameEnglish,
      sourceStoreId: args.storeId ?? null,
      languageCode: args.languageCode ?? null,
      confidence: args.item.confidence != null ? String(args.item.confidence) : null,
    })
    .onConflictDoNothing();
}
