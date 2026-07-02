import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { priceObservations, productAliases, products, stores } from "@/db/schema";

/**
 * "Effective price" used for cross-store comparison:
 * weighted produce compares by €/kg, packaged items by unit price.
 * Raw fragment — expects the price_observations table to be aliased "po".
 */
const effectivePrice = sql<string>`
  case
    when po.is_weighted and po.price_per_kg is not null then po.price_per_kg
    else coalesce(po.unit_price, po.line_total)
  end`;

export interface ProductListRow {
  id: string;
  canonicalNameEn: string;
  brand: string | null;
  categoryEn: string | null;
  sizeValue: string | null;
  sizeUnit: string | null;
  isWeighted: boolean;
  cheapestPrice: string | null;
  cheapestStore: string | null;
  storeCount: number;
  lastSeen: string | null;
}

export async function listProducts(opts: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: ProductListRow[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));
  const search = opts.search?.trim();

  const searchPattern = search ? `%${search}%` : null;
  const where = searchPattern
    ? sql`where (p.canonical_name_en ilike ${searchPattern}
          or p.brand ilike ${searchPattern}
          or p.category_en ilike ${searchPattern})`
    : sql``;

  const result = await db.execute<{
    id: string;
    canonical_name_en: string;
    brand: string | null;
    category_en: string | null;
    size_value: string | null;
    size_unit: string | null;
    is_weighted: boolean;
    cheapest_price: string | null;
    cheapest_store: string | null;
    store_count: number;
    last_seen: string | null;
    total: number;
  }>(sql`
    with latest_per_store as (
      select distinct on (po.product_id, po.store_id)
        po.product_id,
        po.store_id,
        po.is_weighted,
        ${effectivePrice} as effective_price,
        po.observed_date,
        po.created_at
      from price_observations po
      order by po.product_id, po.store_id,
        po.observed_date desc nulls last, po.created_at desc
    ),
    agg as (
      select
        lps.product_id,
        count(distinct lps.store_id)::int as store_count,
        max(coalesce(lps.observed_date, lps.created_at::date))::text as last_seen,
        min(lps.effective_price) as cheapest_price,
        bool_or(lps.is_weighted) as is_weighted,
        (array_agg(s.name order by lps.effective_price asc))[1] as cheapest_store
      from latest_per_store lps
      join stores s on s.id = lps.store_id
      group by lps.product_id
    )
    select
      p.id, p.canonical_name_en, p.brand, p.category_en,
      p.size_value, p.size_unit,
      coalesce(a.is_weighted, false) as is_weighted,
      a.cheapest_price::text as cheapest_price,
      a.cheapest_store,
      coalesce(a.store_count, 0) as store_count,
      a.last_seen,
      count(*) over ()::int as total
    from products p
    left join agg a on a.product_id = p.id
    ${where}
    order by a.last_seen desc nulls last, p.canonical_name_en asc
    limit ${pageSize} offset ${(page - 1) * pageSize}
  `);

  const rows = result.rows.map((r) => ({
    id: r.id,
    canonicalNameEn: r.canonical_name_en,
    brand: r.brand,
    categoryEn: r.category_en,
    sizeValue: r.size_value,
    sizeUnit: r.size_unit,
    isWeighted: r.is_weighted,
    cheapestPrice: r.cheapest_price,
    cheapestStore: r.cheapest_store,
    storeCount: r.store_count,
    lastSeen: r.last_seen,
  }));
  return { rows, total: result.rows[0]?.total ?? 0 };
}

export interface StorePriceRow {
  storeId: string;
  storeName: string;
  storeCity: string | null;
  effectivePrice: string;
  isWeighted: boolean;
  lineTotal: string;
  pricePerKg: string | null;
  unitPrice: string | null;
  observedDate: string | null;
  currency: string;
}

export async function getProductDetail(id: string) {
  const product = await db.query.products.findFirst({ where: eq(products.id, id) });
  if (!product) return null;

  const latestByStore = await db.execute<{
    store_id: string;
    store_name: string;
    store_city: string | null;
    effective_price: string;
    is_weighted: boolean;
    line_total: string;
    price_per_kg: string | null;
    unit_price: string | null;
    observed_date: string | null;
    currency: string;
  }>(sql`
    select distinct on (po.store_id)
      po.store_id, s.name as store_name, s.city as store_city,
      (${effectivePrice})::text as effective_price,
      po.is_weighted,
      po.line_total::text as line_total,
      po.price_per_kg::text as price_per_kg,
      po.unit_price::text as unit_price,
      po.observed_date::text as observed_date,
      po.currency
    from price_observations po
    join stores s on s.id = po.store_id
    where po.product_id = ${id}
    order by po.store_id, po.observed_date desc nulls last, po.created_at desc
  `);

  const prices: StorePriceRow[] = latestByStore.rows
    .map((r) => ({
      storeId: r.store_id,
      storeName: r.store_name,
      storeCity: r.store_city,
      effectivePrice: r.effective_price,
      isWeighted: r.is_weighted,
      lineTotal: r.line_total,
      pricePerKg: r.price_per_kg,
      unitPrice: r.unit_price,
      observedDate: r.observed_date,
      currency: r.currency,
    }))
    .sort((a, b) => parseFloat(a.effectivePrice) - parseFloat(b.effectivePrice));

  const history = await db
    .select({
      id: priceObservations.id,
      storeName: stores.name,
      observedDate: priceObservations.observedDate,
      lineTotal: priceObservations.lineTotal,
      quantity: priceObservations.quantity,
      isWeighted: priceObservations.isWeighted,
      weightValue: priceObservations.weightValue,
      weightUnit: priceObservations.weightUnit,
      pricePerKg: priceObservations.pricePerKg,
      unitPrice: priceObservations.unitPrice,
      currency: priceObservations.currency,
      rawNameOriginal: priceObservations.rawNameOriginal,
      createdAt: priceObservations.createdAt,
    })
    .from(priceObservations)
    .innerJoin(stores, eq(priceObservations.storeId, stores.id))
    .where(eq(priceObservations.productId, id))
    .orderBy(
      sql`${priceObservations.observedDate} desc nulls last`,
      desc(priceObservations.createdAt),
    )
    .limit(50);

  const aliases = await db
    .select({
      id: productAliases.id,
      aliasTextOriginal: productAliases.aliasTextOriginal,
      aliasTextEnglish: productAliases.aliasTextEnglish,
      storeName: stores.name,
    })
    .from(productAliases)
    .leftJoin(stores, eq(productAliases.sourceStoreId, stores.id))
    .where(eq(productAliases.productId, id));

  return { product, prices, history, aliases };
}
