import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoreBuyAdvice, getStoreDetail, listStores } from "@/db/queries/stores";
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
import { StoreSwitcher } from "@/components/stores/store-switcher";
import { ArrowDownIcon, CheckIcon } from "@/components/ui/icons";
import { formatDate, formatPrice, formatSize } from "@/lib/utils/format";
import type { StoreBuyAdviceRow } from "@/db/queries/stores";

export const dynamic = "force-dynamic";

function priceLabel(value: string, isWeighted: boolean, currency: string) {
  return `${formatPrice(value, currency)}${isWeighted ? "/kg" : ""}`;
}

function AdviceList({ rows }: { rows: StoreBuyAdviceRow[] }) {
  return (
    <Card>
      <Table>
        <thead>
          <tr>
            <Th>Product</Th>
            <Th>Price here</Th>
            <Th>Best elsewhere</Th>
            <Th className="text-right">Verdict</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const size = formatSize(r.sizeValue, r.sizeUnit);
            return (
              <tr key={r.productId} className="group hover:bg-muted/50">
                <Td>
                  <Link
                    href={`/products/${r.productId}`}
                    className="cursor-pointer font-medium text-foreground group-hover:underline"
                  >
                    {r.canonicalNameEn}
                  </Link>
                  {size && <span className="ml-1.5 text-ink-faint">{size}</span>}
                  {r.isWeighted && (
                    <span className="ml-2">
                      <Badge tone="amber">per kg</Badge>
                    </span>
                  )}
                </Td>
                <Td>
                  <Money
                    className={
                      r.verdict === "cheapest_here"
                        ? "font-semibold text-primary-strong"
                        : "font-medium"
                    }
                  >
                    {priceLabel(r.herePrice, r.isWeighted, r.currency)}
                  </Money>
                </Td>
                <Td className="text-ink-soft">
                  {r.bestOtherPrice ? (
                    <>
                      <Money>{priceLabel(r.bestOtherPrice, r.isWeighted, r.currency)}</Money>
                      <span className="ml-1.5 text-xs text-ink-faint">
                        {r.bestOtherStore}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td className="text-right">
                  {r.verdict === "cheapest_here" &&
                    (r.deltaPct != null && r.deltaPct > 0 ? (
                      <Badge tone="green">
                        <CheckIcon size={12} /> buy here · save {r.deltaPct}%
                      </Badge>
                    ) : (
                      <Badge tone="green">
                        <CheckIcon size={12} /> best price
                      </Badge>
                    ))}
                  {r.verdict === "cheaper_elsewhere" && (
                    <Badge tone="amber">
                      <ArrowDownIcon size={12} /> {r.deltaPct}% cheaper at{" "}
                      {r.bestOtherStore}
                    </Badge>
                  )}
                  {r.verdict === "only_here" && (
                    <Badge tone="neutral">only store tracked</Badge>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}

export default async function StoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [detail, advice, allStores] = await Promise.all([
    getStoreDetail(id),
    getStoreBuyAdvice(id),
    listStores(),
  ]);
  if (!detail) notFound();

  const { store, latestProducts } = detail;
  const buyHere = advice.filter((r) => r.verdict === "cheapest_here");
  const skipHere = advice.filter((r) => r.verdict === "cheaper_elsewhere");
  const onlyHere = advice.filter((r) => r.verdict === "only_here");

  return (
    <div>
      <div className="mb-1 text-sm">
        <Link href="/stores" className="cursor-pointer text-ink-faint hover:text-ink-soft">
          ← Stores
        </Link>
      </div>
      <PageHeader
        title={store.name}
        subtitle={[store.city, store.country].filter(Boolean).join(", ")}
        action={
          allStores.length > 1 ? (
            <StoreSwitcher
              stores={allStores.map((s) => ({ id: s.id, name: s.name, city: s.city }))}
              currentId={id}
            />
          ) : undefined
        }
      />

      {advice.length === 0 ? (
        <EmptyState
          title="No observations for this store yet"
          hint="Upload a receipt from this store to see what is worth buying here."
        />
      ) : (
        <>
          <section className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-primary">
                <CheckIcon size={18} />
              </span>
              <h2 className="font-mono text-lg font-semibold tracking-tight">
                Worth buying at {store.name}
              </h2>
            </div>
            {buyHere.length > 0 ? (
              <AdviceList rows={buyHere} />
            ) : skipHere.length > 0 ? (
              <EmptyState
                title="Nothing is cheapest here right now"
                hint="Every comparable product at this store is currently cheaper somewhere else."
              />
            ) : (
              <EmptyState
                title="No cross-store comparisons yet"
                hint="Once the same product is observed at another store too, you will see here whether this store wins."
              />
            )}
          </section>

          {skipHere.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 font-mono text-lg font-semibold tracking-tight">
                Cheaper somewhere else
              </h2>
              <AdviceList rows={skipHere} />
            </section>
          )}

          {onlyHere.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 font-mono text-lg font-semibold tracking-tight">
                Only tracked at this store
              </h2>
              <p className="mb-3 text-sm text-ink-soft">
                No other store has price data for these yet, so there is nothing to
                compare against.
              </p>
              <AdviceList rows={onlyHere} />
            </section>
          )}
        </>
      )}

      {latestProducts.length > 0 && (
        <section>
          <h2 className="mb-3 font-mono text-lg font-semibold tracking-tight">
            All latest observed prices
          </h2>
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
                          className="cursor-pointer font-medium text-foreground hover:underline"
                        >
                          {p.canonicalNameEn}
                        </Link>
                        {size && <span className="ml-1.5 text-ink-faint">{size}</span>}
                        {p.isWeighted && (
                          <span className="ml-2">
                            <Badge tone="amber">per kg</Badge>
                          </span>
                        )}
                      </Td>
                      <Td>
                        <Money className="font-medium">
                          {formatPrice(p.unitPrice ?? p.lineTotal, p.currency)}
                        </Money>
                      </Td>
                      <Td className="text-ink-soft">
                        {p.pricePerKg ? (
                          <Money>{`${formatPrice(p.pricePerKg, p.currency)}/kg`}</Money>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className="text-ink-soft">{formatDate(p.observedDate)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        </section>
      )}
    </div>
  );
}
