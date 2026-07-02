import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { stores, type Store } from "@/db/schema";

/** Find a store by case-insensitive (name, city) or create it. */
export async function findOrCreateStore(
  db: Db,
  input: { name: string; city?: string | null; country?: string | null; chain?: string | null },
): Promise<{ store: Store; created: boolean }> {
  const name = input.name.trim();
  const city = input.city?.trim() || null;

  const existing = await db
    .select()
    .from(stores)
    .where(
      sql`lower(${stores.name}) = lower(${name})
          and coalesce(lower(${stores.city}), '') = coalesce(lower(${city}), '')`,
    )
    .limit(1);

  if (existing[0]) return { store: existing[0], created: false };

  const inserted = await db
    .insert(stores)
    .values({
      name,
      city,
      chain: input.chain?.trim() || null,
      country: input.country?.trim() || "Finland",
    })
    .returning();
  return { store: inserted[0], created: true };
}
