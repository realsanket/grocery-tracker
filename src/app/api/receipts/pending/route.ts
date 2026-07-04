import { NextResponse } from "next/server";
import {
  listPendingReceipts,
  purgeOldPending,
} from "@/db/mutations/pending-receipts";

/** Admin-only (guarded by proxy): list queued public submissions. */
export async function GET() {
  await purgeOldPending().catch(() => {});
  const pending = await listPendingReceipts();
  return NextResponse.json({ pending });
}
