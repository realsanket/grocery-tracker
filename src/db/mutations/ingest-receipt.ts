import { db } from "@/db/client";
import { extractionRuns, priceObservations } from "@/db/schema";
import type { ReceiptExtractionResult } from "@/lib/ai/types";
import { matchOrCreateProduct, recordAlias } from "@/lib/normalization/matching";
import { normalizeItem } from "@/lib/normalization/normalize-product";
import { findOrCreateStore } from "@/lib/normalization/normalize-store";

export interface IngestedItemSummary {
  rawNameOriginal: string;
  canonicalNameEn: string;
  normalizedKey: string;
  productId: string;
  matchedBy: "normalized_key" | "alias" | "created";
  lineTotal: number;
  isWeighted: boolean;
  confidence: number | null;
}

export interface IngestReceiptResult {
  store: string;
  storeId: string;
  observedDate: string | null;
  currency: string;
  itemsInserted: number;
  productsCreated: number;
  productsMatched: number;
  items: IngestedItemSummary[];
  extractionRunId: string;
}

/**
 * Persist an extraction result as normalized price observations.
 * Stores store/product/alias/observation rows only — never the receipt
 * image or raw OCR text (extraction_runs keeps counts + status for debugging).
 */
export async function ingestReceipt(
  extraction: ReceiptExtractionResult,
  sourceFilename?: string,
): Promise<IngestReceiptResult> {
  const { store } = await findOrCreateStore(db, {
    name: extraction.store.name,
    city: extraction.store.city,
    country: extraction.store.country,
  });

  const observedDate = extraction.purchase_date ?? null;
  const currency = extraction.currency || "EUR";

  const items: IngestedItemSummary[] = [];
  let productsCreated = 0;
  let productsMatched = 0;

  for (const rawItem of extraction.items) {
    const item = normalizeItem(rawItem);
    const match = await matchOrCreateProduct(db, item);
    if (match.created) productsCreated++;
    else productsMatched++;

    // Keep the raw receipt text as an alias whenever it differs from the canonical name.
    if (
      item.rawNameOriginal.trim().toLowerCase() !==
      match.product.canonicalNameEn.trim().toLowerCase()
    ) {
      await recordAlias(db, { productId: match.product.id, item, storeId: store.id });
    }

    await db.insert(priceObservations).values({
      storeId: store.id,
      productId: match.product.id,
      observedDate,
      currency,
      quantity: String(item.quantity),
      lineTotal: item.lineTotal.toFixed(2),
      sizeValue: item.sizeValue != null ? String(item.sizeValue) : null,
      sizeUnit: item.sizeUnit,
      isWeighted: item.isWeighted,
      weightValue: item.weightValue != null ? String(item.weightValue) : null,
      weightUnit: item.weightUnit,
      unitPrice: item.unitPrice != null ? String(item.unitPrice) : null,
      pricePerKg: item.pricePerKg != null ? String(item.pricePerKg) : null,
      pricePerL: item.pricePerL != null ? String(item.pricePerL) : null,
      pricePerUnit: item.pricePerUnit != null ? String(item.pricePerUnit) : null,
      rawNameOriginal: item.rawNameOriginal,
      rawNameEnglish: item.rawNameEnglish,
      extractionConfidence: item.confidence != null ? String(item.confidence) : null,
    });

    items.push({
      rawNameOriginal: item.rawNameOriginal,
      canonicalNameEn: match.product.canonicalNameEn,
      normalizedKey: item.normalizedKey,
      productId: match.product.id,
      matchedBy: match.matchedBy,
      lineTotal: item.lineTotal,
      isWeighted: item.isWeighted,
      confidence: item.confidence,
    });
  }

  const [run] = await db
    .insert(extractionRuns)
    .values({
      sourceFilename: sourceFilename ?? null,
      storeNameDetected: extraction.store.name,
      observedDate,
      status: "success",
      itemCount: items.length,
      productsCreated,
      productsMatched,
    })
    .returning();

  return {
    store: store.name,
    storeId: store.id,
    observedDate,
    currency,
    itemsInserted: items.length,
    productsCreated,
    productsMatched,
    items,
    extractionRunId: run.id,
  };
}

/** Record a failed extraction attempt (no product data is stored). */
export async function recordFailedRun(
  sourceFilename: string | undefined,
  errorMessage: string,
): Promise<void> {
  await db.insert(extractionRuns).values({
    sourceFilename: sourceFilename ?? null,
    status: "failed",
    errorMessage: errorMessage.slice(0, 500),
  });
}
