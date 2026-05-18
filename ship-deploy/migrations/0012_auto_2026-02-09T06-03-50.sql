ALTER TABLE "stores_items" ADD COLUMN IF NOT EXISTS "manufacture_date" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN IF NOT EXISTS "expiry_date" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN IF NOT EXISTS "batch_number" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN IF NOT EXISTS "lot_number" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN IF NOT EXISTS "shelf_life_months" integer;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN IF NOT EXISTS "sds_reference" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN IF NOT EXISTS "sds_document_url" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN IF NOT EXISTS "sds_last_updated" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN IF NOT EXISTS "hazard_classification" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN IF NOT EXISTS "un_number" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN IF NOT EXISTS "flash_point" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN IF NOT EXISTS "storage_temp_min" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN IF NOT EXISTS "storage_temp_max" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN IF NOT EXISTS "disposal_instructions" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN IF NOT EXISTS "ppe_requirements" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN IF NOT EXISTS "emergency_contact" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stores_expiry_date" ON "stores_items" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stores_hazard_class" ON "stores_items" USING btree ("hazard_classification");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stores_batch_number" ON "stores_items" USING btree ("batch_number");