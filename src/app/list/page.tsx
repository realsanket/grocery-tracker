import Link from "next/link";
import {
  listPickerProducts,
  planShoppingList,
  type ListItemInput,
} from "@/db/queries/shopping-list";
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
import { ListBuilder, type Selection } from "@/components/list/list-builder";
import { CheckIcon, StoreIcon } from "@/components/ui/icons";
import { formatPrice } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseItemsParam(raw: string | undefined): ListItemInput[] {
  if (!raw) return [];
  const out: ListItemInput[] = [];
  for (const part of raw.split(",").slice(0, 50)) {
    const [id, qtyRaw] = part.split(":");
    if (!UUID_RE.test(id)) continue;
    const qty = qtyRaw ? parseFloat(qtyRaw) : 1;
    out.push({ productId: id, qty: Number.isFinite(qty) && qty > 0 ? qty : 1 });
  }
  return out;
}

export default async function ShoppingListPage({
  searchParams,
}: {
  searchParams: Promise<{ items?: string }>;
}) {
  const { items: itemsParam } = await searchParams;
  const inputs = parseItemsParam(itemsParam);
  const [products, plan] = await Promise.all([
    listPickerProducts(),
    planShoppingList(inputs),
  ]);

  const initial: Selection[] = inputs.map((i) => ({ id: i.productId, qty: i.qty }));
  const single = plan.bestSingle;
  const singleCoversAll = single != null && single.missing.length === 0;
  const savings =
    single && plan.splitTotal > 0 && singleCoversAll
      ? Math.round((single.total - plan.splitTotal) * 100) / 100
      : null;

  // Group the optimal split by store.
  const splitByStore = new Map<string, typeof plan.items>();
  for (const item of plan.items) {
    if (!item.cheapest) continue;
    const key = item.cheapest.storeName;
    splitByStore.set(key, [...(splitByStore.get(key) ?? []), item]);
  }

  return (
    <div>
      <PageHeader
        title="Shopping list"
        subtitle="Build your list, and the price data decides where to buy — no AI involved."
      />

      {products.length === 0 ? (
        <EmptyState
          title="No products tracked yet"
          hint="Upload a receipt first — then you can plan shopping lists against real prices."
        />
      ) : (
        <div className="space-y-6">
          <ListBuilder products={products} initial={initial} />

          {plan.items.length === 0 ? (
            <EmptyState
              title="Your list is empty"
              hint="Add products above to see which store wins for your basket."
            />
          ) : (
            <>
              {/* summary */}
              <div className="grid gap-4 sm:grid-cols-2">
                {single && (
                  <Card className="p-5">
                    <p className="flex items-center gap-2 text-sm text-ink-soft">
                      <StoreIcon size={16} /> One-stop shop
                    </p>
                    <p className="mt-1.5">
                      <span className="font-medium">{single.storeName}</span>{" "}
                      <Money className="text-2xl font-semibold">
                        {formatPrice(single.total)}
                      </Money>
                    </p>
                    <p className="mt-1 text-xs text-ink-faint">
                      {singleCoversAll
                        ? `covers all ${plan.items.length} items`
                        : `covers ${single.coveredCount}/${plan.items.length} items — no price data there for: ${single.missing.join(", ")}`}
                    </p>
                  </Card>
                )}
                <Card className="border-primary/25 bg-emerald-50/40 p-5">
                  <p className="flex items-center gap-2 text-sm text-ink-soft">
                    <CheckIcon size={16} /> Cheapest plan
                  </p>
                  <p className="mt-1.5">
                    <Money className="text-2xl font-semibold text-primary-strong">
                      {formatPrice(plan.splitTotal)}
                    </Money>{" "}
                    <span className="text-sm text-ink-soft">
                      across {plan.splitStoreNames.length} store
                      {plan.splitStoreNames.length === 1 ? "" : "s"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {savings != null && savings > 0
                      ? `saves ${formatPrice(savings)} vs buying everything at ${single!.storeName}`
                      : `buy each item at its cheapest store`}
                  </p>
                </Card>
              </div>

              {/* the plan, grouped by store */}
              <section>
                <h2 className="mb-3 font-mono text-lg font-semibold tracking-tight">
                  Your shopping plan
                </h2>
                <div className="space-y-4">
                  {[...splitByStore.entries()].map(([storeName, items]) => (
                    <Card key={storeName}>
                      <div className="border-b border-line bg-muted/50 px-4 py-2.5">
                        <span className="font-medium">{storeName}</span>
                        <span className="ml-2 text-sm text-ink-soft">
                          {items.length} item{items.length === 1 ? "" : "s"} ·{" "}
                          {formatPrice(
                            items.reduce((s, i) => s + (i.cheapest?.price ?? 0), 0),
                          )}
                        </span>
                      </div>
                      <Table>
                        <tbody>
                          {items.map((item) => {
                            const runnerUp = item.prices[1];
                            return (
                              <tr key={item.productId}>
                                <Td>
                                  <Link
                                    href={`/products/${item.productId}`}
                                    className="cursor-pointer font-medium hover:underline"
                                  >
                                    {item.canonicalNameEn}
                                  </Link>
                                  {item.qty !== 1 && (
                                    <span className="ml-1.5 text-xs text-ink-faint">
                                      × {item.qty}
                                      {item.isWeighted ? " kg" : ""}
                                    </span>
                                  )}
                                  {item.isWeighted && (
                                    <span className="ml-2">
                                      <Badge tone="amber">per kg</Badge>
                                    </span>
                                  )}
                                </Td>
                                <Td className="text-right">
                                  <Money className="font-semibold text-primary-strong">
                                    {formatPrice(item.cheapest?.price)}
                                  </Money>
                                  {runnerUp && (
                                    <span className="ml-2 text-xs text-ink-faint">
                                      vs {formatPrice(runnerUp.price)} at{" "}
                                      {runnerUp.storeName}
                                    </span>
                                  )}
                                  {item.prices.length === 1 && (
                                    <span className="ml-2 text-xs text-ink-faint">
                                      only store tracked
                                    </span>
                                  )}
                                </Td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </Card>
                  ))}
                </div>
                <p className="mt-3 text-xs text-ink-faint">
                  Based on each store's latest observed price. Weighted produce is priced
                  per kg — set the quantity to the kilograms you plan to buy.
                </p>
              </section>

              {/* every store compared */}
              {plan.stores.length > 1 && (
                <section>
                  <h2 className="mb-3 font-mono text-lg font-semibold tracking-tight">
                    Whole list by store
                  </h2>
                  <Card>
                    <Table>
                      <thead>
                        <tr>
                          <Th>Store</Th>
                          <Th>Items covered</Th>
                          <Th className="text-right">Total for covered items</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.stores.map((s, i) => (
                          <tr key={s.storeId} className={i === 0 ? "bg-emerald-50/40" : undefined}>
                            <Td>
                              <Link
                                href={`/stores/${s.storeId}`}
                                className="cursor-pointer font-medium hover:underline"
                              >
                                {s.storeName}
                              </Link>
                            </Td>
                            <Td className="text-ink-soft">
                              {s.coveredCount}/{plan.items.length}
                              {s.missing.length > 0 && (
                                <span className="ml-1.5 text-xs text-ink-faint">
                                  (missing {s.missing.join(", ")})
                                </span>
                              )}
                            </Td>
                            <Td className="text-right">
                              <Money className="font-medium">{formatPrice(s.total)}</Money>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
