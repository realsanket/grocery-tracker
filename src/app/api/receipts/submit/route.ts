import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { submitPendingReceipt } from "@/db/mutations/pending-receipts";
import { validateAndReencodeReceiptImage } from "@/lib/validation/receipt-image";

// Public endpoint: anyone can queue a receipt photo for admin review.
// No AI runs here; the image is validated, re-encoded and stored until
// the admin processes or rejects it.
export const maxDuration = 30;

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function ipHashFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return createHash("sha256")
    .update(`${ip}:${process.env.AUTH_SECRET ?? ""}`)
    .digest("hex");
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: "Upload a receipt image as form field 'file'." },
      { status: 400 },
    );
  }
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { success: false, error: "Image must be between 1 byte and 8 MB." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validated = await validateAndReencodeReceiptImage(buffer);
  if (!validated.ok) {
    return NextResponse.json({ success: false, error: validated.reason }, { status: 400 });
  }

  const result = await submitPendingReceipt({
    imageBase64: validated.jpeg.toString("base64"),
    sizeBytes: validated.jpeg.length,
    sourceFilename: file.name?.slice(0, 200) || null,
    ipHash: ipHashFromRequest(request),
  });

  if (!result.ok) {
    const message =
      result.code === "rate_limited"
        ? "Too many submissions from your connection — try again in an hour."
        : "The review queue is full right now — try again later.";
    return NextResponse.json({ success: false, error: message }, { status: 429 });
  }

  return NextResponse.json({ success: true, queued: true });
}
