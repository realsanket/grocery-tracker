CREATE TABLE "pending_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_base64" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"source_filename" text,
	"submitter_ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "pending_receipts_ip_created_idx" ON "pending_receipts" USING btree ("submitter_ip_hash","created_at");