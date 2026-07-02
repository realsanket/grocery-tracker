import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const stores = pgTable(
  "stores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    chain: text("chain"),
    city: text("city"),
    country: text("country").notNull().default("Finland"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("stores_name_city_unique").on(
      sql`lower(${t.name})`,
      sql`coalesce(lower(${t.city}), '')`,
    ),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canonicalNameEn: text("canonical_name_en").notNull(),
    brand: text("brand"),
    categoryEn: text("category_en"),
    subcategoryEn: text("subcategory_en"),
    sizeValue: numeric("size_value", { precision: 12, scale: 4 }),
    sizeUnit: text("size_unit"), // g, kg, ml, l, pc
    normalizedKey: text("normalized_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("products_normalized_key_unique").on(t.normalizedKey)],
);

export const productAliases = pgTable(
  "product_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    aliasTextOriginal: text("alias_text_original").notNull(),
    aliasTextEnglish: text("alias_text_english"),
    sourceStoreId: uuid("source_store_id").references(() => stores.id, {
      onDelete: "set null",
    }),
    languageCode: text("language_code"),
    confidence: numeric("confidence", { precision: 4, scale: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("product_aliases_product_alias_unique").on(
      t.productId,
      sql`lower(${t.aliasTextOriginal})`,
    ),
    index("product_aliases_alias_lookup_idx").on(sql`lower(${t.aliasTextOriginal})`),
  ],
);

export const priceObservations = pgTable(
  "price_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    observedDate: date("observed_date"),
    currency: text("currency").notNull().default("EUR"),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("1"),
    lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
    sizeValue: numeric("size_value", { precision: 12, scale: 4 }),
    sizeUnit: text("size_unit"),
    isWeighted: boolean("is_weighted").notNull().default(false),
    weightValue: numeric("weight_value", { precision: 12, scale: 4 }),
    weightUnit: text("weight_unit"),
    unitPrice: numeric("unit_price", { precision: 12, scale: 4 }),
    pricePerKg: numeric("price_per_kg", { precision: 12, scale: 4 }),
    pricePerL: numeric("price_per_l", { precision: 12, scale: 4 }),
    pricePerUnit: numeric("price_per_unit", { precision: 12, scale: 4 }),
    rawNameOriginal: text("raw_name_original"),
    rawNameEnglish: text("raw_name_english"),
    extractionConfidence: numeric("extraction_confidence", { precision: 4, scale: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("price_observations_product_date_idx").on(
      t.productId,
      sql`${t.observedDate} desc nulls last`,
    ),
    index("price_observations_store_date_idx").on(
      t.storeId,
      sql`${t.observedDate} desc nulls last`,
    ),
  ],
);

export const extractionRuns = pgTable("extraction_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceFilename: text("source_filename"),
  storeNameDetected: text("store_name_detected"),
  observedDate: date("observed_date"),
  status: text("status").notNull().default("pending"), // pending | success | failed
  itemCount: integer("item_count"),
  productsCreated: integer("products_created"),
  productsMatched: integer("products_matched"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Store = typeof stores.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductAlias = typeof productAliases.$inferSelect;
export type PriceObservation = typeof priceObservations.$inferSelect;
export type ExtractionRun = typeof extractionRuns.$inferSelect;
