import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductDetail } from "@/db/queries/products";
import {
  Badge,
  Card,
  EmptyState,
  Money,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import { PriceCompareBars } from "@/components/products/price-compare-bars";
import { PriceHistoryChart } from "@/components/products/price-history-chart";
import {
  formatDate,
  formatPrice,
  formatSize,
  formatWeight,
} from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getProductDetail(id);
  if (!detail) notFound();

  const { product, prices, history, aliases } = detail;
  const size = formatSize(product.sizeValue, product.sizeUnit);
  const cheapest = prices[0];
  const isWeightedProduct = prices.some((p) => p.isWeighted);

  const chartPoints = history
    .map((h) => {
      const v = h.isWeighted
        ? h.pricePerKg
        : (h.unitPrice ?? h.lineTotal);
      return {
        storeName: h.storeName,
        date: (h.observedDate ?? h.createdAt?.toISOString().slice(0, 10)) as string,
        value: v != null ? parseFloat(String(v)) : NaN,
      };
    })
    .filter((p) => Number.isFinite(p.value));

  return (
    <div>
      <div className="mb-1 text-sm">
        <Link href="/products" className="cursor-pointer text-ink-faint hover:text-ink-soft">
          ← Products
        </Link>
      </div>
      <PageHeader
        title={`${product.canonicalNameEn}${size ? ` ${size}` : ""}`}
        subtitle={[product.brand, product.categoryEn].filter(Boolean).join(" · ") || undefined}
        action={
          isWeightedProduct ? (
            <Badge tone="amber">sold by weight — compared per kg</Badge>
          ) : undefined
        }
      />

      {cheapest && prices.length > 1 && (
        <Card className="mb-6 border-primary/25 bg-emerald-50/40 p-5">
          <p className="text-sm text-ink-soft">Best price right now</p>
          <p className="mt-1 text-lg">
            <Money className="text-2xl font-semibold text-primary-strong">
              {formatPrice(cheapest.effectivePrice, cheapest.currency)}
              {cheapest.isWeighted ? "/kg" : ""}
            </Money>{" "}
            <span className="text-ink-soft">
              at <span className="font-medium text-foreground">{cheapest.storeName}</span>
            </span>
          </p>
        </Card>
      )}

      <section className="mb-8">
        <h2 className="mb-3 font-mono text-lg font-semibold tracking-tight">
          Price by store
        </h2>
        {prices.length === 0 ? (
          <EmptyState title="No price observations yet" />
        ) : (
          <Card className="p-5">
            <PriceCompareBars prices={prices} />
          </Card>
        )}
      </section>

      {chartPoints.length >= 2 && (
        <section className="mb-8">
          <h2 className="mb-3 font-mono text-lg font-semibold tracking-tight">
            Price over time
          </h2>
          <Card className="p-5">
            <PriceHistoryChart
              points={chartPoints}
              unitSuffix={isWeightedProduct ? "/kg" : ""}
            />
            <p className="mt-2 text-xs text-ink-faint">
              Prices fluctuate — every receipt adds a point, so trends build up over the
              months. Exact values are in the history table below.
            </p>
          </Card>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 font-mono text-lg font-semibold tracking-tight">
          Price history
        </h2>
        {history.length === 0 ? (
          <EmptyState title="No history yet" />
        ) : (
          <Card>
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Store</Th>
                  <Th>Qty / weight</Th>
                  <Th>Unit price</Th>
                  <Th>Price / kg</Th>
                  <Th className="text-right">Line total</Th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <Td className="text-ink-soft">
                      {formatDate(h.observedDate ?? h.createdAt)}
                    </Td>
                    <Td>{h.storeName}</Td>
                    <Td className="text-ink-soft">
                      {h.isWeighted
                        ? formatWeight(h.weightValue, h.weightUnit) ?? "—"
                        : `${parseFloat(h.quantity)} pc`}
                    </Td>
                    <Td>
                      <Money className="text-ink-soft">
                        {formatPrice(h.unitPrice, h.currency)}
                      </Money>
                    </Td>
                    <Td>
                      <Money className="text-ink-soft">
                        {h.pricePerKg ? `${formatPrice(h.pricePerKg, h.currency)}/kg` : "—"}
                      </Money>
                    </Td>
                    <Td className="text-right">
                      <Money className="font-medium">
                        {formatPrice(h.lineTotal, h.currency)}
                      </Money>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}
      </section>

      {aliases.length > 0 && (
        <section>
          <h2 className="mb-3 font-mono text-lg font-semibold tracking-tight">
            Seen on receipts as
          </h2>
          <Card className="p-4">
            <ul className="flex flex-wrap gap-2">
              {aliases.map((a) => (
                <li key={a.id}>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-muted px-2.5 py-1 text-sm">
                    <span className="font-mono text-foreground/80">
                      {a.aliasTextOriginal}
                    </span>
                    {a.storeName && (
                      <span className="text-xs text-ink-faint">({a.storeName})</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}
