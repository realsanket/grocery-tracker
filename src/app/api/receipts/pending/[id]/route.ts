import { NextResponse } from "next/server";
import { z } from "zod";
import { deletePendingReceipt } from "@/db/mutations/pending-receipts";

/** Admin-only (guarded by proxy): reject a submission — deletes row + image. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const deleted = await deletePendingReceipt(id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
