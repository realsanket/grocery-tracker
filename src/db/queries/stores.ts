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

export interface StoreBuyAdviceRow {
  productId: string;
  canonicalNameEn: string;
  brand: string | null;
  sizeValue: string | null;
  sizeUnit: string | null;
  isWeighted: boolean;
  herePrice: string;
  observedDate: string | null;
  currency: string;
  bestOtherPrice: string | null;
  bestOtherStore: string | null;
  otherStoreCount: number;
  /** cheapest_here | cheaper_elsewhere | only_here */
  verdict: "cheapest_here" | "cheaper_elsewhere" | "only_here";
  /** cheapest_here: % you save vs best alternative; cheaper_elsewhere: % extra you pay here */
  deltaPct: number | null;
}

/**
 * "What should I buy at this store?" — for every product observed here,
 * compare this store's latest price against the best latest price anywhere else.
 */
export async function getStoreBuyAdvice(id: string): Promise<StoreBuyAdviceRow[]> {
  const result = await db.execute<{
    product_id: string;
    canonical_name_en: string;
    brand: string | null;
    size_value: string | null;
    size_unit: string | null;
    is_weighted: boolean;
    here_price: string;
    observed_date: string | null;
    currency: string;
    best_other_price: string | null;
    best_other_store: string | null;
    other_store_count: number;
  }>(sql`
    with latest as (
      select distinct on (po.product_id, po.store_id)
        po.product_id, po.store_id, po.is_weighted, po.currency,
        case
          when po.is_weighted and po.price_per_kg is not null then po.price_per_kg
          else coalesce(po.unit_price, po.line_total)
        end as effective_price,
        po.observed_date, po.created_at
      from price_observations po
      order by po.product_id, po.store_id,
        po.observed_date desc nulls last, po.created_at desc
    ),
    elsewhere as (
      select l.product_id,
        min(l.effective_price) as best_other_price,
        (array_agg(s.name order by l.effective_price asc))[1] as best_other_store,
        count(distinct l.store_id)::int as other_store_count
      from latest l
      join stores s on s.id = l.store_id
      where l.store_id != ${id}
      group by l.product_id
    )
    select
      p.id as product_id, p.canonical_name_en, p.brand,
      p.size_value::text as size_value, p.size_unit,
      h.is_weighted,
      h.effective_price::text as here_price,
      h.observed_date::text as observed_date,
      h.currency,
      e.best_other_price::text as best_other_price,
      e.best_other_store,
      coalesce(e.other_store_count, 0) as other_store_count
    from latest h
    join products p on p.id = h.product_id
    left join elsewhere e on e.product_id = h.product_id
    where h.store_id = ${id}
    order by p.canonical_name_en asc
  `);

  return result.rows.map((r) => {
    const here = parseFloat(r.here_price);
    const other = r.best_other_price != null ? parseFloat(r.best_other_price) : null;
    let verdict: StoreBuyAdviceRow["verdict"];
    let deltaPct: number | null = null;
    if (other == null) {
      verdict = "only_here";
    } else if (here <= other) {
      verdict = "cheapest_here";
      deltaPct = other > 0 ? Math.round(((other - here) / other) * 100) : 0;
    } else {
      verdict = "cheaper_elsewhere";
      deltaPct = other > 0 ? Math.round(((here - other) / other) * 100) : 0;
    }
    return {
      productId: r.product_id,
      canonicalNameEn: r.canonical_name_en,
      brand: r.brand,
      sizeValue: r.size_value,
      sizeUnit: r.size_unit,
      isWeighted: r.is_weighted,
      herePrice: r.here_price,
      observedDate: r.observed_date,
      currency: r.currency,
      bestOtherPrice: r.best_other_price,
      bestOtherStore: r.best_other_store,
      otherStoreCount: r.other_store_count,
      verdict,
      deltaPct,
    };
  });
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
