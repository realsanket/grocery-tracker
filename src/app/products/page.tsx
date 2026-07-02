import Link from "next/link";
import { listProducts } from "@/db/queries/products";
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
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search products, brands, categories…"
          className="w-full max-w-md rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm outline-none placeholder:text-stone-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
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
                <Th>Brand</Th>
                <Th>Category</Th>
                <Th>Cheapest price</Th>
                <Th className="text-right">Stores</Th>
                <Th>Last seen</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const size = formatSize(p.sizeValue, p.sizeUnit);
                return (
                  <tr key={p.id} className="hover:bg-stone-50">
                    <Td>
                      <Link
                        href={`/products/${p.id}`}
                        className="font-medium text-stone-900 hover:underline"
                      >
                        {p.canonicalNameEn}
                      </Link>
                      {size && <span className="ml-1.5 text-stone-400">{size}</span>}
                      {p.isWeighted && (
                        <span className="ml-2">
                          <Badge tone="amber">by weight</Badge>
                        </span>
                      )}
                    </Td>
                    <Td className="text-stone-500">{p.brand ?? "—"}</Td>
                    <Td className="text-stone-500">{p.categoryEn ?? "—"}</Td>
                    <Td>
                      {p.cheapestPrice ? (
                        <>
                          <span className="font-medium text-emerald-700">
                            {formatEffectivePrice(p.cheapestPrice, p.isWeighted)}
                          </span>
                          {p.cheapestStore && (
                            <span className="ml-1.5 text-xs text-stone-400">
                              at {p.cheapestStore}
                            </span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="text-right tabular-nums">{p.storeCount}</Td>
                    <Td className="text-stone-500">{formatDate(p.lastSeen)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-stone-500">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                className="rounded-md border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-50"
                href={`/products?q=${encodeURIComponent(search)}&page=${page - 1}`}
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                className="rounded-md border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-50"
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
