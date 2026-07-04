import { desc, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pendingReceipts } from "@/db/schema";

const MAX_PER_IP_PER_HOUR = 10;
const MAX_QUEUE_SIZE = 30;
const PURGE_AFTER_DAYS = 14;

export type SubmitResult =
  | { ok: true; id: string }
  | { ok: false; code: "rate_limited" | "queue_full" };

export async function submitPendingReceipt(input: {
  imageBase64: string;
  sizeBytes: number;
  sourceFilename?: string | null;
  ipHash: string;
}): Promise<SubmitResult> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [{ ipCount, queueCount }] = await db
    .select({
      ipCount: sql<number>`count(*) filter (where ${pendingReceipts.submitterIpHash} = ${input.ipHash} and ${pendingReceipts.createdAt} >= ${hourAgo})::int`,
      queueCount: sql<number>`count(*)::int`,
    })
    .from(pendingReceipts);

  if (ipCount >= MAX_PER_IP_PER_HOUR) return { ok: false, code: "rate_limited" };
  if (queueCount >= MAX_QUEUE_SIZE) return { ok: false, code: "queue_full" };

  const [row] = await db
    .insert(pendingReceipts)
    .values({
      imageBase64: input.imageBase64,
      sizeBytes: input.sizeBytes,
      sourceFilename: input.sourceFilename ?? null,
      submitterIpHash: input.ipHash,
    })
    .returning({ id: pendingReceipts.id });
  return { ok: true, id: row.id };
}

export interface PendingReceiptSummary {
  id: string;
  sourceFilename: string | null;
  sizeBytes: number;
  createdAt: Date;
}

export async function listPendingReceipts(): Promise<PendingReceiptSummary[]> {
  return db
    .select({
      id: pendingReceipts.id,
      sourceFilename: pendingReceipts.sourceFilename,
      sizeBytes: pendingReceipts.sizeBytes,
      createdAt: pendingReceipts.createdAt,
    })
    .from(pendingReceipts)
    .orderBy(desc(pendingReceipts.createdAt))
    .limit(MAX_QUEUE_SIZE);
}

export async function getPendingReceipt(id: string) {
  const rows = await db
    .select()
    .from(pendingReceipts)
    .where(eq(pendingReceipts.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function deletePendingReceipt(id: string): Promise<boolean> {
  const deleted = await db
    .delete(pendingReceipts)
    .where(eq(pendingReceipts.id, id))
    .returning({ id: pendingReceipts.id });
  return deleted.length > 0;
}

/** Drop submissions the admin never touched. Called opportunistically on queue reads. */
export async function purgeOldPending(): Promise<void> {
  const cutoff = new Date(Date.now() - PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000);
  await db.delete(pendingReceipts).where(lt(pendingReceipts.createdAt, cutoff));
}

export async function countPendingReceipts(): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pendingReceipts);
  return count;
}
