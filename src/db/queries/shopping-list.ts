import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export interface ListItemInput {
  productId: string;
  /** Units for packaged items, kilograms for weighted items. */
  qty: number;
}

export interface ItemStorePrice {
  storeId: string;
  storeName: string;
  price: number; // effective price × qty
  unitPrice: number; // effective price (per unit or per kg)
}

export interface ListItemPlan {
  productId: string;
  canonicalNameEn: string;
  sizeValue: string | null;
  sizeUnit: string | null;
  isWeighted: boolean;
  qty: number;
  prices: ItemStorePrice[]; // sorted cheapest first
  cheapest: ItemStorePrice | null;
}

export interface StorePlan {
  storeId: string;
  storeName: string;
  coveredCount: number;
  missing: string[]; // product names not available at this store
  total: number; // total for covered items
}

export interface ShoppingListPlan {
  items: ListItemPlan[];
  stores: StorePlan[]; // sorted: most coverage, then cheapest
  splitTotal: number; // buy every item at its cheapest store
  splitStoreNames: string[];
  bestSingle: StorePlan | null;
}

/**
 * Pure data comparison (no AI): for the chosen products, use each store's
 * latest observed price to work out the cheapest store per item, the best
 * single store for the whole list, and the optimal multi-store split.
 */
export async function planShoppingList(
  inputs: ListItemInput[],
): Promise<ShoppingListPlan> {
  const ids = inputs.map((i) => i.productId);
  if (ids.length === 0) {
    return { items: [], stores: [], splitTotal: 0, splitStoreNames: [], bestSingle: null };
  }
  const qtyById = new Map(inputs.map((i) => [i.productId, i.qty]));

  const result = await db.execute<{
    product_id: string;
    canonical_name_en: string;
    size_value: string | null;
    size_unit: string | null;
    is_weighted: boolean;
    store_id: string;
    store_name: string;
    effective_price: string;
  }>(sql`
    select distinct on (po.product_id, po.store_id)
      po.product_id,
      p.canonical_name_en,
      p.size_value::text as size_value,
      p.size_unit,
      po.is_weighted,
      po.store_id,
      s.name as store_name,
      (case
        when po.is_weighted and po.price_per_kg is not null then po.price_per_kg
        else coalesce(po.unit_price, po.line_total)
      end)::text as effective_price
    from price_observations po
    join products p on p.id = po.product_id
    join stores s on s.id = po.store_id
    where po.product_id in (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
    order by po.product_id, po.store_id,
      po.observed_date desc nulls last, po.created_at desc
  `);

  const byProduct = new Map<string, ListItemPlan>();
  for (const r of result.rows) {
    const qty = qtyById.get(r.product_id) ?? 1;
    let item = byProduct.get(r.product_id);
    if (!item) {
      item = {
        productId: r.product_id,
        canonicalNameEn: r.canonical_name_en,
        sizeValue: r.size_value,
        sizeUnit: r.size_unit,
        isWeighted: r.is_weighted,
        qty,
        prices: [],
        cheapest: null,
      };
      byProduct.set(r.product_id, item);
    }
    const unitPrice = parseFloat(r.effective_price);
    item.prices.push({
      storeId: r.store_id,
      storeName: r.store_name,
      unitPrice,
      price: unitPrice * qty,
    });
  }

  const items = [...byProduct.values()].map((item) => {
    item.prices.sort((a, b) => a.price - b.price);
    item.cheapest = item.prices[0] ?? null;
    return item;
  });
  items.sort((a, b) => a.canonicalNameEn.localeCompare(b.canonicalNameEn));

  // Per-store view of the whole list.
  const storeMap = new Map<string, StorePlan>();
  for (const item of items) {
    for (const price of item.prices) {
      let plan = storeMap.get(price.storeId);
      if (!plan) {
        plan = {
          storeId: price.storeId,
          storeName: price.storeName,
          coveredCount: 0,
          missing: [],
          total: 0,
        };
        storeMap.set(price.storeId, plan);
      }
      plan.coveredCount++;
      plan.total += price.price;
    }
  }
  for (const plan of storeMap.values()) {
    plan.missing = items
      .filter((i) => !i.prices.some((p) => p.storeId === plan.storeId))
      .map((i) => i.canonicalNameEn);
    plan.total = Math.round(plan.total * 100) / 100;
  }
  const stores = [...storeMap.values()].sort(
    (a, b) => b.coveredCount - a.coveredCount || a.total - b.total,
  );

  const splitTotal =
    Math.round(items.reduce((sum, i) => sum + (i.cheapest?.price ?? 0), 0) * 100) / 100;
  const splitStoreNames = [
    ...new Set(items.map((i) => i.cheapest?.storeName).filter(Boolean) as string[]),
  ];

  return {
    items,
    stores,
    splitTotal,
    splitStoreNames,
    bestSingle: stores[0] ?? null,
  };
}

export interface PickerProduct {
  id: string;
  canonicalNameEn: string;
  brand: string | null;
  sizeValue: string | null;
  sizeUnit: string | null;
  isWeighted: boolean;
}

/** All products that have at least one price observation, for the list picker. */
export async function listPickerProducts(): Promise<PickerProduct[]> {
  const result = await db.execute<{
    id: string;
    canonical_name_en: string;
    brand: string | null;
    size_value: string | null;
    size_unit: string | null;
    is_weighted: boolean;
  }>(sql`
    select p.id, p.canonical_name_en, p.brand,
      p.size_value::text as size_value, p.size_unit,
      bool_or(po.is_weighted) as is_weighted
    from products p
    join price_observations po on po.product_id = p.id
    group by p.id
    order by p.canonical_name_en asc
    limit 500
  `);
  return result.rows.map((r) => ({
    id: r.id,
    canonicalNameEn: r.canonical_name_en,
    brand: r.brand,
    sizeValue: r.size_value,
    sizeUnit: r.size_unit,
    isWeighted: r.is_weighted,
  }));
}
