import Link from "next/link";
import { listStores } from "@/db/queries/stores";
import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const stores = await listStores();

  return (
    <div>
      <PageHeader
        title="Stores"
        subtitle="Supermarkets where prices have been observed."
      />
      {stores.length === 0 ? (
        <EmptyState
          title="No stores yet"
          hint="Stores are created automatically when receipts are processed."
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Store</Th>
                <Th>City</Th>
                <Th>Country</Th>
                <Th className="text-right">Products observed</Th>
                <Th>Latest observation</Th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s.id} className="hover:bg-stone-50">
                  <Td>
                    <Link
                      href={`/stores/${s.id}`}
                      className="font-medium text-stone-900 hover:underline"
                    >
                      {s.name}
                    </Link>
                    {s.chain && (
                      <span className="ml-1.5 text-xs text-stone-400">{s.chain}</span>
                    )}
                  </Td>
                  <Td className="text-stone-500">{s.city ?? "—"}</Td>
                  <Td className="text-stone-500">{s.country}</Td>
                  <Td className="text-right tabular-nums">{s.productCount}</Td>
                  <Td className="text-stone-500">{formatDate(s.lastObservation)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
