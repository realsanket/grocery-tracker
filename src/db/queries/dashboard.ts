import { desc, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { extractionRuns } from "@/db/schema";

export interface DashboardStats {
  productCount: number;
  storeCount: number;
  observationCount: number;
  successfulRuns: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const result = await db.execute<{
    product_count: number;
    store_count: number;
    observation_count: number;
    successful_runs: number;
  }>(sql`
    select
      (select count(*)::int from products) as product_count,
      (select count(*)::int from stores) as store_count,
      (select count(*)::int from price_observations) as observation_count,
      (select count(*)::int from extraction_runs where status = 'success') as successful_runs
  `);
  const r = result.rows[0];
  return {
    productCount: r?.product_count ?? 0,
    storeCount: r?.store_count ?? 0,
    observationCount: r?.observation_count ?? 0,
    successfulRuns: r?.successful_runs ?? 0,
  };
}

export interface PriceDifferenceRow {
  productId: string;
  canonicalNameEn: string;
  isWeighted: boolean;
  cheapestPrice: string;
  cheapestStore: string;
  priciestPrice: string;
  priciestStore: string;
  savingsPct: number;
}

/** Products observed in 2+ stores with the biggest relative price spread. */
export async function getBestPriceDifferences(limit = 5): Promise<PriceDifferenceRow[]> {
  const result = await db.execute<{
    product_id: string;
    canonical_name_en: string;
    is_weighted: boolean;
    cheapest_price: string;
    cheapest_store: string;
    priciest_price: string;
    priciest_store: string;
    savings_pct: number;
  }>(sql`
    with latest_per_store as (
      select distinct on (po.product_id, po.store_id)
        po.product_id,
        po.store_id,
        po.is_weighted,
        case
          when po.is_weighted and po.price_per_kg is not null then po.price_per_kg
          else coalesce(po.unit_price, po.line_total)
        end as effective_price
      from price_observations po
      order by po.product_id, po.store_id,
        po.observed_date desc nulls last, po.created_at desc
    ),
    spread as (
      select
        lps.product_id,
        bool_or(lps.is_weighted) as is_weighted,
        min(lps.effective_price) as cheapest_price,
        max(lps.effective_price) as priciest_price,
        (array_agg(s.name order by lps.effective_price asc))[1] as cheapest_store,
        (array_agg(s.name order by lps.effective_price desc))[1] as priciest_store,
        count(distinct lps.store_id) as store_count
      from latest_per_store lps
      join stores s on s.id = lps.store_id
      group by lps.product_id
    )
    select
      sp.product_id,
      p.canonical_name_en,
      sp.is_weighted,
      sp.cheapest_price::text as cheapest_price,
      sp.cheapest_store,
      sp.priciest_price::text as priciest_price,
      sp.priciest_store,
      round((sp.priciest_price - sp.cheapest_price) / nullif(sp.priciest_price, 0) * 100)::int as savings_pct
    from spread sp
    join products p on p.id = sp.product_id
    where sp.store_count >= 2 and sp.priciest_price > sp.cheapest_price
    order by savings_pct desc
    limit ${limit}
  `);

  return result.rows.map((r) => ({
    productId: r.product_id,
    canonicalNameEn: r.canonical_name_en,
    isWeighted: r.is_weighted,
    cheapestPrice: r.cheapest_price,
    cheapestStore: r.cheapest_store,
    priciestPrice: r.priciest_price,
    priciestStore: r.priciest_store,
    savingsPct: r.savings_pct,
  }));
}

export async function getRecentExtractionRuns(limit = 10) {
  return db
    .select()
    .from(extractionRuns)
    .orderBy(desc(extractionRuns.createdAt))
    .limit(limit);
}
