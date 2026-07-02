import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { stores } from "@/db/schema";

export interface StoreListRow {
  id: string;
  name: string;
  chain: string | null;
  city: string | null;
  country: string;
  productCount: number;
  lastObservation: string | null;
}

export async function listStores(): Promise<StoreListRow[]> {
  const result = await db.execute<{
    id: string;
    name: string;
    chain: string | null;
    city: string | null;
    country: string;
    product_count: number;
    last_observation: string | null;
  }>(sql`
    select
      s.id, s.name, s.chain, s.city, s.country,
      count(distinct po.product_id)::int as product_count,
      max(coalesce(po.observed_date, po.created_at::date))::text as last_observation
    from stores s
    left join price_observations po on po.store_id = s.id
    group by s.id
    order by last_observation desc nulls last, s.name asc
  `);

  return result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    chain: r.chain,
    city: r.city,
    country: r.country,
    productCount: r.product_count,
    lastObservation: r.last_observation,
  }));
}

export interface StoreProductRow {
  productId: string;
  canonicalNameEn: string;
  brand: string | null;
  sizeValue: string | null;
  sizeUnit: string | null;
  isWeighted: boolean;
  lineTotal: string;
  pricePerKg: string | null;
  unitPrice: string | null;
  observedDate: string | null;
  currency: string;
}

export async function getStoreDetail(id: string) {
  const store = await db.query.stores.findFirst({ where: eq(stores.id, id) });
  if (!store) return null;

  const result = await db.execute<{
    product_id: string;
    canonical_name_en: string;
    brand: string | null;
    size_value: string | null;
    size_unit: string | null;
    is_weighted: boolean;
    line_total: string;
    price_per_kg: string | null;
    unit_price: string | null;
    observed_date: string | null;
    currency: string;
  }>(sql`
    select distinct on (po.product_id)
      po.product_id,
      p.canonical_name_en, p.brand, p.size_value::text as size_value, p.size_unit,
      po.is_weighted,
      po.line_total::text as line_total,
      po.price_per_kg::text as price_per_kg,
      po.unit_price::text as unit_price,
      po.observed_date::text as observed_date,
      po.currency
    from price_observations po
    join products p on p.id = po.product_id
    where po.store_id = ${id}
    order by po.product_id, po.observed_date desc nulls last, po.created_at desc
  `);

  const latestProducts: StoreProductRow[] = result.rows
    .map((r) => ({
      productId: r.product_id,
      canonicalNameEn: r.canonical_name_en,
      brand: r.brand,
      sizeValue: r.size_value,
      sizeUnit: r.size_unit,
      isWeighted: r.is_weighted,
      lineTotal: r.line_total,
      pricePerKg: r.price_per_kg,
      unitPrice: r.unit_price,
      observedDate: r.observed_date,
      currency: r.currency,
    }))
    .sort((a, b) => a.canonicalNameEn.localeCompare(b.canonicalNameEn));

  return { store, latestProducts };
}
