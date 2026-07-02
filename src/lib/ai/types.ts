import { z } from "zod";

/** One purchased product line extracted from a receipt. */
export const extractedItemSchema = z.object({
  raw_name_original: z.string().min(1),
  raw_name_english: z.string().nullish(),
  canonical_name_en: z.string().min(1),
  brand: z.string().nullish(),
  category_en: z.string().nullish(),
  quantity: z.number().positive().nullish(),
  size_value: z.number().positive().nullish(),
  size_unit: z.string().nullish(),
  weight_value: z.number().positive().nullish(),
  weight_unit: z.string().nullish(),
  unit_price: z.number().nullish(),
  price_per_kg: z.number().nullish(),
  price_per_l: z.number().nullish(),
  line_total: z.number(),
  is_weighted: z.boolean().nullish().default(false),
  confidence: z.number().min(0).max(1).nullish(),
});

export const receiptExtractionResultSchema = z.object({
  store: z.object({
    name: z.string().min(1),
    city: z.string().nullish(),
    country: z.string().nullish(),
  }),
  purchase_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  currency: z.string().nullish().default("EUR"),
  items: z.array(extractedItemSchema).min(1),
});

export type ExtractedItem = z.infer<typeof extractedItemSchema>;
export type ReceiptExtractionResult = z.infer<typeof receiptExtractionResultSchema>;

export interface ReceiptImage {
  /** Raw image bytes. Never persisted — receipts are an ingestion source only. */
  buffer: Buffer;
  mimeType: string;
  filename?: string;
}

export interface ReceiptExtractor {
  extractReceiptProducts(image: ReceiptImage): Promise<ReceiptExtractionResult>;
}
