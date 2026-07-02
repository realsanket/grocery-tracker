import Link from "next/link";
import {
  getBestPriceDifferences,
  getDashboardStats,
  getRecentExtractionRuns,
} from "@/db/queries/dashboard";
import {
  Badge,
  Card,
  EmptyState,
  Money,
  StatCard,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import {
  ArrowDownIcon,
  PackageIcon,
  ReceiptIcon,
  ScaleIcon,
  SearchIcon,
  StoreIcon,
} from "@/components/ui/icons";
import { formatDate, formatEffectivePrice } from "@/lib/utils/format";
import { isAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, differences, admin] = await Promise.all([
    getDashboardStats(),
    getBestPriceDifferences(6),
    isAdmin(),
  ]);
  const runs = admin ? await getRecentExtractionRuns(6) : [];

  return (
    <div>
      {/* Hero: the product's job in one input */}
      <section className="mb-8 rounded-2xl border border-line bg-surface px-6 py-10 text-center sm:py-12">
        <h1 className="font-mono text-3xl font-semibold tracking-tight sm:text-4xl">
          Where is it <span className="text-primary">cheapest</span>?
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-ink-soft">
          Prices extracted from real receipts and compared across supermarkets.
        </p>
        <form method="GET" action="/products" className="mx-auto mt-6 flex max-w-md">
          <div className="relative w-full">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
              <SearchIcon size={17} />
            </span>
            <input
              type="search"
              name="q"
              placeholder="Search a product… rice, milk, onion"
              className="w-full rounded-l-lg border border-line bg-white py-2.5 pl-10 pr-3 text-sm outline-none placeholder:text-ink-faint focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <button
            type="submit"
            className="cursor-pointer rounded-r-lg bg-primary px-5 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-strong"
          >
            Compare
          </button>
        </form>
      </section>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Products tracked" value={stats.productCount} icon={<PackageIcon />} />
        <StatCard label="Stores" value={stats.storeCount} icon={<StoreIcon />} />
        <StatCard label="Price observations" value={stats.observationCount} icon={<ScaleIcon />} />
        <StatCard label="Receipts processed" value={stats.successfulRuns} icon={<ReceiptIcon />} />
      </div>

      <section className="mt-10">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-primary">
            <ArrowDownIcon size={18} />
          </span>
          <h2 className="font-mono text-lg font-semibold tracking-tight">
            Biggest savings right now
          </h2>
        </div>
        {differences.length === 0 ? (
          <EmptyState
            title="No cross-store comparisons yet"
            hint="Once the same product is observed in two or more stores, the biggest savings show up here."
          />
        ) : (
          <Card>
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>Cheapest</Th>
                  <Th>Most expensive</Th>
                  <Th className="text-right">You save</Th>
                </tr>
              </thead>
              <tbody>
                {differences.map((d) => {
                  const cheap = parseFloat(d.cheapestPrice);
                  const dear = parseFloat(d.priciestPrice);
                  const ratio = dear > 0 ? cheap / dear : 1;
                  return (
                    <tr key={d.productId} className="group hover:bg-muted/50">
                      <Td>
                        <Link
                          href={`/products/${d.productId}`}
                          className="cursor-pointer font-medium text-foreground group-hover:underline"
                        >
                          {d.canonicalNameEn}
                        </Link>
                        {d.isWeighted && (
                          <span className="ml-2">
                            <Badge tone="amber">per kg</Badge>
                          </span>
                        )}
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <Money className="font-semibold text-primary-strong">
                            {formatEffectivePrice(d.cheapestPrice, d.isWeighted)}
                          </Money>
                          <span className="text-xs text-ink-faint">{d.cheapestStore}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-28 rounded-[3px] bg-muted">
                          <div
                            className="h-1.5 rounded-[3px] bg-primary"
                            style={{ width: `${Math.max(8, ratio * 100)}%` }}
                          />
                        </div>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <Money>{formatEffectivePrice(d.priciestPrice, d.isWeighted)}</Money>
                          <span className="text-xs text-ink-faint">{d.priciestStore}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-28 rounded-[3px] bg-muted">
                          <div className="h-1.5 w-full rounded-[3px] bg-accent/50" />
                        </div>
                      </Td>
                      <Td className="text-right">
                        <Badge tone="green">
                          <ArrowDownIcon size={12} /> {d.savingsPct}%
                        </Badge>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        )}
      </section>

      {admin && (
        <section className="mt-10">
          <h2 className="mb-3 font-mono text-lg font-semibold tracking-tight">
            Recent extractions{" "}
            <span className="align-middle">
              <Badge tone="neutral">admin</Badge>
            </span>
          </h2>
          {runs.length === 0 ? (
            <EmptyState
              title="No receipts processed yet"
              hint="Upload your first receipt to start tracking prices."
            />
          ) : (
            <Card>
              <Table>
                <thead>
                  <tr>
                    <Th>Store detected</Th>
                    <Th>Date</Th>
                    <Th>Items</Th>
                    <Th>Matched / new</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id}>
                      <Td className="font-medium">
                        {run.storeNameDetected ?? "—"}
                        {run.sourceFilename && (
                          <span className="ml-2 text-xs text-ink-faint">
                            {run.sourceFilename}
                          </span>
                        )}
                      </Td>
                      <Td>{formatDate(run.observedDate ?? run.createdAt)}</Td>
                      <Td>{run.itemCount ?? "—"}</Td>
                      <Td>
                        {run.productsMatched ?? 0} / {run.productsCreated ?? 0}
                      </Td>
                      <Td>
                        <Badge tone={run.status === "success" ? "green" : "red"}>
                          {run.status}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </section>
      )}
    </div>
  );
}
