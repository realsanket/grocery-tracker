import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductDetail } from "@/db/queries/products";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import {
  formatDate,
  formatEffectivePrice,
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

  return (
    <div>
      <div className="mb-1 text-sm">
        <Link href="/products" className="text-stone-400 hover:text-stone-600">
          ← Products
        </Link>
      </div>
      <PageHeader
        title={`${product.canonicalNameEn}${size ? ` ${size}` : ""}`}
        subtitle={[product.brand, product.categoryEn].filter(Boolean).join(" · ") || undefined}
        action={
          isWeightedProduct ? <Badge tone="amber">sold by weight — compared per kg</Badge> : undefined
        }
      />

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Latest price by store</h2>
        {prices.length === 0 ? (
          <EmptyState title="No price observations yet" />
        ) : (
          <Card>
            <Table>
              <thead>
                <tr>
                  <Th>Store</Th>
                  <Th>{isWeightedProduct ? "Price / kg" : "Price"}</Th>
                  <Th>Line total</Th>
                  <Th>Observed</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {prices.map((p, i) => (
                  <tr key={p.storeId} className={i === 0 ? "bg-emerald-50/40" : undefined}>
                    <Td>
                      <Link
                        href={`/stores/${p.storeId}`}
                        className="font-medium text-stone-900 hover:underline"
                      >
                        {p.storeName}
                      </Link>
                      {p.storeCity && (
                        <span className="ml-1.5 text-xs text-stone-400">{p.storeCity}</span>
                      )}
                    </Td>
                    <Td
                      className={
                        i === 0 ? "font-semibold text-emerald-700" : "font-medium"
                      }
                    >
                      {formatEffectivePrice(p.effectivePrice, p.isWeighted, p.currency)}
                    </Td>
                    <Td className="text-stone-500">{formatPrice(p.lineTotal, p.currency)}</Td>
                    <Td className="text-stone-500">{formatDate(p.observedDate)}</Td>
                    <Td>{i === 0 && prices.length > 1 && <Badge tone="green">cheapest</Badge>}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}
        {cheapest && prices.length > 1 && (
          <p className="mt-2 text-sm text-stone-500">
            Cheapest right now at{" "}
            <span className="font-medium text-stone-700">{cheapest.storeName}</span> —{" "}
            {formatEffectivePrice(cheapest.effectivePrice, cheapest.isWeighted, cheapest.currency)}
          </p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Price history</h2>
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
                    <Td className="text-stone-500">
                      {formatDate(h.observedDate ?? h.createdAt)}
                    </Td>
                    <Td>{h.storeName}</Td>
                    <Td className="text-stone-500">
                      {h.isWeighted
                        ? formatWeight(h.weightValue, h.weightUnit) ?? "—"
                        : `${parseFloat(h.quantity)} pc`}
                    </Td>
                    <Td className="text-stone-500">{formatPrice(h.unitPrice, h.currency)}</Td>
                    <Td className="text-stone-500">
                      {h.pricePerKg ? `${formatPrice(h.pricePerKg, h.currency)}/kg` : "—"}
                    </Td>
                    <Td className="text-right font-medium">
                      {formatPrice(h.lineTotal, h.currency)}
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
          <h2 className="mb-3 text-lg font-semibold tracking-tight">
            Seen on receipts as
          </h2>
          <Card className="p-4">
            <ul className="flex flex-wrap gap-2">
              {aliases.map((a) => (
                <li key={a.id}>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 text-sm">
                    <span className="font-mono text-stone-700">{a.aliasTextOriginal}</span>
                    {a.storeName && (
                      <span className="text-xs text-stone-400">({a.storeName})</span>
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
