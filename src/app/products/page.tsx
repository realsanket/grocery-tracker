import Link from "next/link";
import { listProducts } from "@/db/queries/products";
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
import { ArrowDownIcon, SearchIcon } from "@/components/ui/icons";
import {
  formatDate,
  formatEffectivePrice,
  formatSize,
} from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = params.q ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const { rows, total } = await listProducts({ search, page, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={`${total} canonical product${total === 1 ? "" : "s"} tracked across stores.`}
      />

      <form method="GET" className="mb-4">
        <div className="relative max-w-md">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
            <SearchIcon size={16} />
          </span>
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search products, brands, categories…"
            className="w-full rounded-lg border border-line bg-surface py-2 pl-10 pr-3.5 text-sm outline-none placeholder:text-ink-faint focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title={search ? `No products match “${search}”` : "No products yet"}
          hint={
            search
              ? "Try a different search term."
              : "Products appear here after the first receipt is processed."
          }
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>Category</Th>
                <Th>Cheapest at</Th>
                <Th className="text-right">Savings vs priciest</Th>
                <Th className="text-right">Stores</Th>
                <Th>Last seen</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const size = formatSize(p.sizeValue, p.sizeUnit);
                return (
                  <tr key={p.id} className="group hover:bg-muted/50">
                    <Td>
                      <Link
                        href={`/products/${p.id}`}
                        className="cursor-pointer font-medium text-foreground group-hover:underline"
                      >
                        {p.canonicalNameEn}
                      </Link>
                      {size && <span className="ml-1.5 text-ink-faint">{size}</span>}
                      {p.brand && (
                        <span className="ml-1.5 text-xs text-ink-faint">· {p.brand}</span>
                      )}
                      {p.isWeighted && (
                        <span className="ml-2">
                          <Badge tone="amber">per kg</Badge>
                        </span>
                      )}
                    </Td>
                    <Td className="text-ink-soft">{p.categoryEn ?? "—"}</Td>
                    <Td>
                      {p.cheapestPrice ? (
                        <>
                          <Money className="font-semibold text-primary-strong">
                            {formatEffectivePrice(p.cheapestPrice, p.isWeighted)}
                          </Money>
                          {p.cheapestStore && (
                            <span className="ml-1.5 text-xs text-ink-faint">
                              {p.cheapestStore}
                            </span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="text-right">
                      {p.savingsPct != null && p.savingsPct > 0 ? (
                        <Badge tone="green">
                          <ArrowDownIcon size={12} /> {p.savingsPct}%
                        </Badge>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </Td>
                    <Td className="text-right tabular-nums">{p.storeCount}</Td>
                    <Td className="text-ink-soft">{formatDate(p.lastSeen)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                className="cursor-pointer rounded-md border border-line bg-surface px-3 py-1.5 hover:bg-muted"
                href={`/products?q=${encodeURIComponent(search)}&page=${page - 1}`}
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                className="cursor-pointer rounded-md border border-line bg-surface px-3 py-1.5 hover:bg-muted"
                href={`/products?q=${encodeURIComponent(search)}&page=${page + 1}`}
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
