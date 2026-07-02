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
        subtitle="Pick a store to see what is worth buying there — and what is cheaper elsewhere."
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
                <tr key={s.id} className="hover:bg-muted/50">
                  <Td>
                    <Link
                      href={`/stores/${s.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {s.name}
                    </Link>
                    {s.chain && (
                      <span className="ml-1.5 text-xs text-ink-faint">{s.chain}</span>
                    )}
                  </Td>
                  <Td className="text-ink-soft">{s.city ?? "—"}</Td>
                  <Td className="text-ink-soft">{s.country}</Td>
                  <Td className="text-right tabular-nums">{s.productCount}</Td>
                  <Td className="text-ink-soft">{formatDate(s.lastObservation)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
