import type { ExtractedItem } from "@/lib/ai/types";
import {
  buildNormalizedKey,
  canonicalizeUnit,
  normalizeSizeValue,
} from "./normalize-key";

/** A fully derived, DB-ready view of one extracted receipt line. */
export interface NormalizedItem {
  canonicalNameEn: string;
  brand: string | null;
  categoryEn: string | null;
  normalizedKey: string;
  sizeValue: number | null;
  sizeUnit: string | null;
  quantity: number;
  lineTotal: number;
  isWeighted: boolean;
  weightValue: number | null;
  weightUnit: string | null;
  unitPrice: number | null;
  pricePerKg: number | null;
  pricePerL: number | null;
  pricePerUnit: number | null;
  rawNameOriginal: string;
  rawNameEnglish: string | null;
  confidence: number | null;
}

const round = (n: number, dp = 4) => Math.round(n * 10 ** dp) / 10 ** dp;

function toKg(value: number, unit: string): number | null {
  if (unit === "kg") return value;
  if (unit === "g") return value / 1000;
  return null;
}

function toL(value: number, unit: string): number | null {
  if (unit === "l") return value;
  if (unit === "ml") return value / 1000;
  if (unit === "cl") return value / 100;
  if (unit === "dl") return value / 10;
  return null;
}

/**
 * Turn a raw extracted item into a normalized, comparison-ready record.
 * Derives per-kg / per-litre / per-unit prices when the model left them null
 * but they are computable from line total + weight/size/quantity.
 */
export function normalizeItem(item: ExtractedItem): NormalizedItem {
  const sizeUnit = canonicalizeUnit(item.size_unit);
  const sizeValue = item.size_value != null ? normalizeSizeValue(item.size_value) : null;
  const weightUnit = canonicalizeUnit(item.weight_unit);
  const weightValue =
    item.weight_value != null ? normalizeSizeValue(item.weight_value) : null;
  const quantity = item.quantity ?? 1;
  const lineTotal = item.line_total;

  let pricePerKg = item.price_per_kg ?? null;
  let pricePerL = item.price_per_l ?? null;
  let pricePerUnit = null as number | null;

  if (pricePerKg == null && weightValue != null && weightUnit && lineTotal > 0) {
    const kg = toKg(weightValue, weightUnit);
    if (kg && kg > 0) pricePerKg = round(lineTotal / kg);
  }
  if (pricePerKg == null && !item.is_weighted && sizeValue != null && sizeUnit && lineTotal > 0) {
    const kg = toKg(sizeValue * quantity, sizeUnit);
    if (kg && kg > 0) pricePerKg = round(lineTotal / kg);
  }
  if (pricePerL == null && sizeValue != null && sizeUnit && lineTotal > 0) {
    const l = toL(sizeValue * quantity, sizeUnit);
    if (l && l > 0) pricePerL = round(lineTotal / l);
  }
  if (quantity > 0 && lineTotal > 0) {
    pricePerUnit = round(lineTotal / quantity);
  }

  const unitPrice = item.unit_price ?? (quantity > 0 ? round(lineTotal / quantity) : null);

  return {
    canonicalNameEn: item.canonical_name_en.trim(),
    brand: item.brand?.trim() || null,
    categoryEn: item.category_en?.trim() || null,
    normalizedKey: buildNormalizedKey(
      item.canonical_name_en,
      item.brand,
      sizeValue,
      sizeUnit,
    ),
    sizeValue,
    sizeUnit,
    quantity,
    lineTotal,
    isWeighted: item.is_weighted ?? false,
    weightValue,
    weightUnit,
    unitPrice,
    pricePerKg,
    pricePerL,
    pricePerUnit,
    rawNameOriginal: item.raw_name_original.trim(),
    rawNameEnglish: item.raw_name_english?.trim() || null,
    confidence: item.confidence ?? null,
  };
}
