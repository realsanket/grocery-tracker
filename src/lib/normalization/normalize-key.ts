/**
 * Deterministic normalization helpers for canonical product matching.
 *
 * The normalized key is the deduplication identity of a product:
 * "GOHAR RIISI 5KG" and "Gohar Rice 5kg" must both resolve to "gohar_rice_5_kg".
 */

const UNIT_ALIASES: Record<string, string> = {
  l: "l",
  lt: "l",
  ltr: "l",
  litre: "l",
  liter: "l",
  ml: "ml",
  cl: "cl",
  dl: "dl",
  g: "g",
  gr: "g",
  gram: "g",
  kg: "kg",
  kilo: "kg",
  pc: "pc",
  pcs: "pc",
  kpl: "pc", // Finnish "kappale" (piece)
  st: "pc",
};

/** Canonicalize a size/weight unit ("KG" -> "kg", "kpl" -> "pc"). Unknown units pass through lowercased. */
export function canonicalizeUnit(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const u = unit.trim().toLowerCase();
  if (!u) return null;
  return UNIT_ALIASES[u] ?? u;
}

/** Transliterate accents (ä→a, ö→o, å→a, é→e...) via NFD decomposition. */
function transliterate(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normalize free text into a snake_case token string:
 * lowercase, transliterate, decimal commas → dots, punctuation → spaces,
 * split digit/letter boundaries ("5kg" -> "5 kg"), collapse.
 */
export function normalizeText(input: string): string {
  return transliterate(input.toLowerCase().trim())
    .replace(/(\d),(\d)/g, "$1.$2") // decimal comma -> dot (1,75 -> 1.75)
    .replace(/[^a-z0-9.]+/g, " ") // punctuation -> spaces (keep dots inside numbers)
    .replace(/(?<![0-9])\.|\.(?![0-9])/g, " ") // dots not between digits -> spaces
    .replace(/([0-9])([a-z])/g, "$1 $2") // 5kg -> 5 kg, 1.75l -> 1.75 l
    .replace(/([a-z])([0-9])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s.]+/g, "_"); // spaces and remaining decimal dots -> underscores
}

/**
 * Build the deterministic product identity key from canonical name + size.
 *
 * The canonical name is expected to already include the brand when relevant
 * ("Valio Eila Light Milk"); the brand argument is only used as a fallback
 * prefix when the name does not already contain it.
 *
 * Examples:
 *   ("Valio Eila Light Milk", "Valio", 1.75, "L") -> "valio_eila_light_milk_1_75_l"
 *   ("Gohar Rice", "Gohar", 5, "kg")              -> "gohar_rice_5_kg"
 *   ("Onion", null, null, null)                    -> "onion"
 */
export function buildNormalizedKey(
  canonicalNameEn: string,
  brand?: string | null,
  sizeValue?: number | string | null,
  sizeUnit?: string | null,
): string {
  let base = canonicalNameEn.trim();
  if (brand) {
    const nameNorm = normalizeText(base);
    const brandNorm = normalizeText(brand);
    if (brandNorm && !nameNorm.includes(brandNorm)) {
      base = `${brand} ${base}`;
    }
  }

  // Strip a trailing size mention from the name itself so size is appended
  // exactly once, in canonical form ("Gohar Rice 5kg" + size 5 kg -> gohar_rice_5_kg).
  const unit = canonicalizeUnit(sizeUnit);
  const value = sizeValue == null ? null : normalizeSizeValue(sizeValue);
  let key = normalizeText(base);
  if (value != null && unit) {
    const sizeToken = `${String(value).replace(".", "_")}_${unit}`;
    const trailingSize = new RegExp(
      `_${sizeToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
    );
    if (!trailingSize.test(key)) {
      // Remove any other trailing "<number>_<unit-ish>" token before appending.
      key = key.replace(/_[0-9]+(?:_[0-9]+)?_?(kg|g|l|ml|cl|dl|pc|kpl|pcs|lt|ltr|gr)$/i, "");
      key = `${key}_${sizeToken}`;
    }
  } else {
    // No explicit size: still canonicalize a trailing unit alias in the name
    // itself so "GRB Ghee 1 LTR" and "GRB Ghee 1l" produce the same key.
    key = key.replace(
      /(_[0-9]+(?:_[0-9]+)?)_(lt|ltr|litre|liter|gr|gram|kilo|kpl|pcs|st)$/,
      (_m, num: string, u: string) => `${num}_${UNIT_ALIASES[u] ?? u}`,
    );
  }
  return key;
}

/** Parse a size value that may use a decimal comma; round to a stable representation. */
export function normalizeSizeValue(value: number | string): number {
  const n = typeof value === "number" ? value : parseFloat(value.replace(",", "."));
  return Math.round(n * 10000) / 10000;
}
