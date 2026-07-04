import { NextResponse } from "next/server";
import { z } from "zod";
import { getPendingReceipt } from "@/db/mutations/pending-receipts";

/** Admin-only (guarded by proxy): serve the stored (re-encoded) JPEG for preview. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const row = await getPendingReceipt(id);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new NextResponse(Buffer.from(row.imageBase64, "base64"), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
