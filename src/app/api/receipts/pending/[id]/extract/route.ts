import { NextResponse } from "next/server";
import { z } from "zod";
import { getExtractor, ExtractionError } from "@/lib/ai/extractor";
import { getPendingReceipt } from "@/db/mutations/pending-receipts";
import { recordFailedRun } from "@/db/mutations/ingest-receipt";

// Admin-only (guarded by proxy): run AI extraction on a queued submission.
// Returns a draft for the review/edit screen; the image stays in the queue
// until the admin commits (which deletes it) or rejects.
export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
  }
  const row = await getPendingReceipt(id);
  if (!row) {
    return NextResponse.json(
      { success: false, error: "Submission no longer exists." },
      { status: 404 },
    );
  }

  try {
    const draft = await getExtractor().extractReceiptProducts({
      buffer: Buffer.from(row.imageBase64, "base64"),
      mimeType: "image/jpeg",
      filename: row.sourceFilename ?? undefined,
    });
    return NextResponse.json({
      success: true,
      draft,
      sourceFilename: row.sourceFilename,
      pendingReceiptId: id,
    });
  } catch (err) {
    const message =
      err instanceof ExtractionError
        ? err.message
        : "Unexpected error while processing the receipt.";
    console.error("Pending receipt extraction failed:", err);
    await recordFailedRun(row.sourceFilename ?? undefined, message).catch(() => {});
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
