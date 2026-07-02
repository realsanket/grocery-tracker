import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoreDetail } from "@/db/queries/stores";
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
  formatPrice,
  formatSize,
} from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function StoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getStoreDetail(id);
  if (!detail) notFound();

  const { store, latestProducts } = detail;

  return (
    <div>
      <div className="mb-1 text-sm">
        <Link href="/stores" className="text-ink-faint hover:text-ink-soft">
          ← Stores
        </Link>
      </div>
      <PageHeader
        title={store.name}
        subtitle={[store.city, store.country].filter(Boolean).join(", ")}
      />

      <h2 className="mb-3 text-lg font-semibold tracking-tight">
        Latest observed prices
      </h2>
      {latestProducts.length === 0 ? (
        <EmptyState title="No observations for this store yet" />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>Price</Th>
                <Th>Price / kg</Th>
                <Th>Observed</Th>
              </tr>
            </thead>
            <tbody>
              {latestProducts.map((p) => {
                const size = formatSize(p.sizeValue, p.sizeUnit);
                return (
                  <tr key={p.productId} className="hover:bg-muted/50">
                    <Td>
                      <Link
                        href={`/products/${p.productId}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {p.canonicalNameEn}
                      </Link>
                      {size && <span className="ml-1.5 text-ink-faint">{size}</span>}
                      {p.isWeighted && (
                        <span className="ml-2">
                          <Badge tone="amber">by weight</Badge>
                        </span>
                      )}
                    </Td>
                    <Td className="font-medium">
                      {formatPrice(p.unitPrice ?? p.lineTotal, p.currency)}
                    </Td>
                    <Td className="text-ink-soft">
                      {p.pricePerKg ? `${formatPrice(p.pricePerKg, p.currency)}/kg` : "—"}
                    </Td>
                    <Td className="text-ink-soft">{formatDate(p.observedDate)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
