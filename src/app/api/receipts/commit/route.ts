import { NextResponse } from "next/server";
import { z } from "zod";
import { receiptExtractionResultSchema } from "@/lib/ai/types";
import { ingestReceipt } from "@/db/mutations/ingest-receipt";

const bodySchema = z.object({
  extraction: receiptExtractionResultSchema,
  sourceFilename: z.string().max(300).nullish(),
});

/**
 * Step 2 of ingestion: persist the admin-reviewed extraction draft
 * as normalized products + price observations.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid extraction payload.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await ingestReceipt(
      parsed.data.extraction,
      parsed.data.sourceFilename ?? undefined,
    );
    return NextResponse.json({
      success: true,
      store: result.store,
      storeId: result.storeId,
      observedDate: result.observedDate,
      currency: result.currency,
      itemsInserted: result.itemsInserted,
      productsCreated: result.productsCreated,
      productsMatched: result.productsMatched,
      items: result.items,
    });
  } catch (err) {
    console.error("Receipt commit failed:", err);
    return NextResponse.json(
      { success: false, error: "Failed to save the receipt items." },
      { status: 500 },
    );
  }
}
