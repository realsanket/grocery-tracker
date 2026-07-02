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
  PageHeader,
  StatCard,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import { formatDate, formatEffectivePrice } from "@/lib/utils/format";
import { isAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, differences, runs, admin] = await Promise.all([
    getDashboardStats(),
    getBestPriceDifferences(5),
    getRecentExtractionRuns(5),
    isAdmin(),
  ]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Grocery prices extracted from receipts, compared across stores."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Products tracked" value={stats.productCount} />
        <StatCard label="Stores" value={stats.storeCount} />
        <StatCard label="Price observations" value={stats.observationCount} />
        <StatCard label="Receipts processed" value={stats.successfulRuns} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Biggest price differences
        </h2>
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
                {differences.map((d) => (
                  <tr key={d.productId} className="hover:bg-stone-50">
                    <Td>
                      <Link
                        href={`/products/${d.productId}`}
                        className="font-medium text-stone-900 hover:underline"
                      >
                        {d.canonicalNameEn}
                      </Link>
                      {d.isWeighted && (
                        <span className="ml-2">
                          <Badge tone="amber">by weight</Badge>
                        </span>
                      )}
                    </Td>
                    <Td>
                      <span className="font-medium text-emerald-700">
                        {formatEffectivePrice(d.cheapestPrice, d.isWeighted)}
                      </span>{" "}
                      <span className="text-stone-400">at {d.cheapestStore}</span>
                    </Td>
                    <Td>
                      {formatEffectivePrice(d.priciestPrice, d.isWeighted)}{" "}
                      <span className="text-stone-400">at {d.priciestStore}</span>
                    </Td>
                    <Td className="text-right">
                      <Badge tone="green">{d.savingsPct}%</Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Recent extractions
        </h2>
        {runs.length === 0 ? (
          <EmptyState
            title="No receipts processed yet"
            hint={
              admin
                ? "Upload your first receipt to start tracking prices."
                : "The admin has not uploaded any receipts yet."
            }
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
                        <span className="ml-2 text-xs text-stone-400">
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
    </div>
  );
}
