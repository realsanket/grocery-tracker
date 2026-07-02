/**
 * Dev/demo seed: runs a few synthetic receipts through the real ingestion
 * pipeline so stores, products, aliases and price observations are created
 * exactly the way real uploads create them.
 *
 * Run with: pnpm db:seed
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import type { ReceiptExtractionResult } from "@/lib/ai/types";

const item = (
  overrides: Partial<ReceiptExtractionResult["items"][number]> &
    Pick<ReceiptExtractionResult["items"][number], "raw_name_original" | "canonical_name_en" | "line_total">,
): ReceiptExtractionResult["items"][number] => ({
  raw_name_english: null,
  brand: null,
  category_en: null,
  quantity: 1,
  size_value: null,
  size_unit: null,
  weight_value: null,
  weight_unit: null,
  unit_price: null,
  price_per_kg: null,
  price_per_l: null,
  is_weighted: false,
  confidence: 0.95,
  ...overrides,
});

const receipts: ReceiptExtractionResult[] = [
  {
    store: { name: "K-Supermarket Perkkaa", city: "Espoo", country: "Finland" },
    purchase_date: "2026-06-18",
    currency: "EUR",
    items: [
      item({
        raw_name_original: "Valio Eila kevytmaitoj 1,75l",
        raw_name_english: "Valio Eila light milk 1.75L",
        canonical_name_en: "Valio Eila Light Milk",
        brand: "Valio",
        category_en: "Dairy",
        size_value: 1.75,
        size_unit: "l",
        unit_price: 2.95,
        line_total: 2.95,
      }),
      item({
        raw_name_original: "K-Menu vehnäpaahto 500g",
        raw_name_english: "K-Menu wheat toast 500g",
        canonical_name_en: "K-Menu White Bread",
        brand: "K-Menu",
        category_en: "Bakery",
        size_value: 500,
        size_unit: "g",
        unit_price: 0.89,
        line_total: 0.89,
      }),
      item({
        raw_name_original: "Sipuli Suomi",
        raw_name_english: "Onion Finland",
        canonical_name_en: "Onion",
        category_en: "Produce",
        is_weighted: true,
        weight_value: 1.011,
        weight_unit: "kg",
        price_per_kg: 0.89,
        line_total: 0.9,
      }),
      item({
        raw_name_original: "Kukkakaali",
        raw_name_english: "Cauliflower",
        canonical_name_en: "Cauliflower",
        category_en: "Produce",
        is_weighted: true,
        weight_value: 0.652,
        weight_unit: "kg",
        price_per_kg: 3.49,
        line_total: 2.28,
      }),
      item({
        raw_name_original: "Banaani",
        raw_name_english: "Banana",
        canonical_name_en: "Banana",
        category_en: "Produce",
        is_weighted: true,
        weight_value: 0.87,
        weight_unit: "kg",
        price_per_kg: 1.29,
        line_total: 1.12,
      }),
    ],
  },
  {
    store: { name: "K-Supermarket Perkkaa", city: "Espoo", country: "Finland" },
    purchase_date: "2026-06-29",
    currency: "EUR",
    items: [
      // Same milk, slightly cheaper — creates price history.
      item({
        raw_name_original: "Valio Eila kevytmaitoj 1,75l",
        raw_name_english: "Valio Eila light milk 1.75L",
        canonical_name_en: "Valio Eila Light Milk",
        brand: "Valio",
        category_en: "Dairy",
        size_value: 1.75,
        size_unit: "l",
        unit_price: 2.88,
        line_total: 2.88,
      }),
      item({
        raw_name_original: "Sipuli Suomi",
        canonical_name_en: "Onion",
        category_en: "Produce",
        is_weighted: true,
        weight_value: 0.734,
        weight_unit: "kg",
        price_per_kg: 0.95,
        line_total: 0.7,
      }),
    ],
  },
  {
    store: { name: "Sun Market", city: "Espoo", country: "Finland" },
    purchase_date: "2026-06-25",
    currency: "EUR",
    items: [
      item({
        raw_name_original: "GOHAR RIISI 5KG",
        raw_name_english: "Gohar rice 5kg",
        canonical_name_en: "Gohar Rice",
        brand: "Gohar",
        category_en: "Pantry",
        size_value: 5,
        size_unit: "kg",
        unit_price: 12.9,
        line_total: 12.9,
      }),
      item({
        raw_name_original: "KANA FILE 1KG LATVIA",
        raw_name_english: "Chicken fillet 1kg Latvia",
        canonical_name_en: "Chicken Fillet",
        category_en: "Meat",
        size_value: 1,
        size_unit: "kg",
        unit_price: 7.99,
        line_total: 7.99,
      }),
      item({
        raw_name_original: "GRB Ghee 1L",
        canonical_name_en: "GRB Ghee",
        brand: "GRB",
        category_en: "Pantry",
        size_value: 1,
        size_unit: "l",
        unit_price: 9.9,
        line_total: 9.9,
      }),
      item({
        raw_name_original: "FE Chilli Whole 100g",
        canonical_name_en: "Whole Chili",
        brand: "FE",
        category_en: "Produce",
        size_value: 100,
        size_unit: "g",
        unit_price: 1.49,
        line_total: 1.49,
      }),
      item({
        raw_name_original: "Onion Loose",
        canonical_name_en: "Onion",
        category_en: "Produce",
        is_weighted: true,
        weight_value: 1.42,
        weight_unit: "kg",
        price_per_kg: 1.19,
        line_total: 1.69,
      }),
      item({
        raw_name_original: "Valio Eila Light Milk 1.75L",
        canonical_name_en: "Valio Eila Light Milk",
        brand: "Valio",
        category_en: "Dairy",
        size_value: 1.75,
        size_unit: "l",
        unit_price: 3.15,
        line_total: 3.15,
      }),
    ],
  },
  {
    store: { name: "G Mart", city: "Helsinki", country: "Finland" },
    purchase_date: "2026-07-01",
    currency: "EUR",
    items: [
      item({
        raw_name_original: "Gohar Rice 5kg",
        canonical_name_en: "Gohar Rice",
        brand: "Gohar",
        category_en: "Pantry",
        size_value: 5,
        size_unit: "kg",
        unit_price: 11.5,
        line_total: 11.5,
      }),
      item({
        raw_name_original: "Chicken Fillet 1kg",
        canonical_name_en: "Chicken Fillet",
        category_en: "Meat",
        size_value: 1,
        size_unit: "kg",
        unit_price: 8.49,
        line_total: 8.49,
      }),
      item({
        raw_name_original: "GRB GHEE 1 LTR",
        canonical_name_en: "GRB Ghee",
        brand: "GRB",
        category_en: "Pantry",
        size_value: 1,
        size_unit: "l",
        unit_price: 9.5,
        line_total: 9.5,
      }),
      item({
        raw_name_original: "Pumpkin",
        canonical_name_en: "Pumpkin",
        category_en: "Produce",
        is_weighted: true,
        weight_value: 1.85,
        weight_unit: "kg",
        price_per_kg: 1.99,
        line_total: 3.68,
      }),
      item({
        raw_name_original: "Cauliflower",
        canonical_name_en: "Cauliflower",
        category_en: "Produce",
        is_weighted: true,
        weight_value: 0.9,
        weight_unit: "kg",
        price_per_kg: 2.99,
        line_total: 2.69,
      }),
      item({
        raw_name_original: "Chilli Whole 100g",
        canonical_name_en: "Whole Chili",
        brand: "FE",
        category_en: "Produce",
        size_value: 100,
        size_unit: "g",
        unit_price: 1.29,
        line_total: 1.29,
      }),
    ],
  },
];

async function main() {
  // Import after dotenv so DATABASE_URL is available when the client loads.
  const { ingestReceipt } = await import("./mutations/ingest-receipt");
  for (const receipt of receipts) {
    const result = await ingestReceipt(
      receipt,
      `seed-${receipt.store.name.toLowerCase().replace(/\s+/g, "-")}-${receipt.purchase_date}.jpg`,
    );
    console.log(
      `${result.store} (${result.observedDate}): ${result.itemsInserted} items, ` +
        `${result.productsCreated} new products, ${result.productsMatched} matched`,
    );
  }
  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
