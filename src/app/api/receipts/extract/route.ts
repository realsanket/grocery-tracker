import { NextResponse } from "next/server";
import { getExtractor, ExtractionError } from "@/lib/ai/extractor";
import { recordFailedRun } from "@/db/mutations/ingest-receipt";

// Vision extraction can take tens of seconds.
export const maxDuration = 60;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Step 1 of ingestion: extract a draft from the receipt image.
 * Nothing is persisted here — the admin reviews/edits the draft in the UI
 * and saves it via POST /api/receipts/commit.
 */
export async function POST(request: Request) {
  let filename: string | undefined;
  try {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Upload a receipt image as form field 'file'." },
        { status: 400 },
      );
    }
    filename = file.name;

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { success: false, error: "Unsupported file type. Use JPG, PNG or WEBP." },
        { status: 400 },
      );
    }
    if (file.size === 0 || file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: "Image must be between 1 byte and 8 MB." },
        { status: 400 },
      );
    }

    // The image lives only in memory for the duration of this request.
    const buffer = Buffer.from(await file.arrayBuffer());
    const draft = await getExtractor().extractReceiptProducts({
      buffer,
      mimeType: file.type,
      filename: file.name,
    });

    return NextResponse.json({ success: true, draft, sourceFilename: file.name });
  } catch (err) {
    const message =
      err instanceof ExtractionError
        ? err.message
        : "Unexpected error while processing the receipt.";
    console.error("Receipt extraction failed:", err);
    await recordFailedRun(filename, message).catch(() => {});
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
