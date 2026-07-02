CREATE TABLE "extraction_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_filename" text,
	"store_name_detected" text,
	"observed_date" date,
	"status" text DEFAULT 'pending' NOT NULL,
	"item_count" integer,
	"products_created" integer,
	"products_matched" integer,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"observed_date" date,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"quantity" numeric(12, 3) DEFAULT '1' NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"size_value" numeric(12, 4),
	"size_unit" text,
	"is_weighted" boolean DEFAULT false NOT NULL,
	"weight_value" numeric(12, 4),
	"weight_unit" text,
	"unit_price" numeric(12, 4),
	"price_per_kg" numeric(12, 4),
	"price_per_l" numeric(12, 4),
	"price_per_unit" numeric(12, 4),
	"raw_name_original" text,
	"raw_name_english" text,
	"extraction_confidence" numeric(4, 3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"alias_text_original" text NOT NULL,
	"alias_text_english" text,
	"source_store_id" uuid,
	"language_code" text,
	"confidence" numeric(4, 3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_name_en" text NOT NULL,
	"brand" text,
	"category_en" text,
	"subcategory_en" text,
	"size_value" numeric(12, 4),
	"size_unit" text,
	"normalized_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"chain" text,
	"city" text,
	"country" text DEFAULT 'Finland' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_source_store_id_stores_id_fk" FOREIGN KEY ("source_store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "price_observations_product_date_idx" ON "price_observations" USING btree ("product_id","observed_date" desc nulls last);--> statement-breakpoint
CREATE INDEX "price_observations_store_date_idx" ON "price_observations" USING btree ("store_id","observed_date" desc nulls last);--> statement-breakpoint
CREATE UNIQUE INDEX "product_aliases_product_alias_unique" ON "product_aliases" USING btree ("product_id",lower("alias_text_original"));--> statement-breakpoint
CREATE INDEX "product_aliases_alias_lookup_idx" ON "product_aliases" USING btree (lower("alias_text_original"));--> statement-breakpoint
CREATE UNIQUE INDEX "products_normalized_key_unique" ON "products" USING btree ("normalized_key");--> statement-breakpoint
CREATE UNIQUE INDEX "stores_name_city_unique" ON "stores" USING btree (lower("name"),coalesce(lower("city"), ''));