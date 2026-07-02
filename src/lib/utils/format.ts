const CURRENCY_SYMBOLS: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };

/** "2.88" + "EUR" -> "€2.88"; weighted prices get a /kg suffix via formatEffectivePrice. */
export function formatPrice(
  value: string | number | null | undefined,
  currency = "EUR",
): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : parseFloat(value);
  if (Number.isNaN(n)) return "—";
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${n.toFixed(2)}`;
}

export function formatEffectivePrice(
  value: string | number | null | undefined,
  isWeighted: boolean,
  currency = "EUR",
): string {
  const base = formatPrice(value, currency);
  return base === "—" || !isWeighted ? base : `${base}/kg`;
}

export function formatSize(
  sizeValue: string | number | null | undefined,
  sizeUnit: string | null | undefined,
): string | null {
  if (sizeValue == null || !sizeUnit) return null;
  const n = typeof sizeValue === "number" ? sizeValue : parseFloat(sizeValue);
  if (Number.isNaN(n)) return null;
  const value = Number.isInteger(n) ? n.toString() : n.toString();
  return `${value}${sizeUnit}`;
}

export function formatWeight(
  weightValue: string | number | null | undefined,
  weightUnit: string | null | undefined,
): string | null {
  if (weightValue == null || !weightUnit) return null;
  const n = typeof weightValue === "number" ? weightValue : parseFloat(weightValue);
  if (Number.isNaN(n)) return null;
  return `${n}${weightUnit}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
