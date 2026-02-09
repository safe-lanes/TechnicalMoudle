ALTER TABLE "stores_items" ADD COLUMN "manufacture_date" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN "expiry_date" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN "batch_number" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN "lot_number" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN "shelf_life_months" integer;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN "sds_reference" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN "sds_document_url" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN "sds_last_updated" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN "hazard_classification" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN "un_number" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN "flash_point" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN "storage_temp_min" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN "storage_temp_max" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN "disposal_instructions" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN "ppe_requirements" text;--> statement-breakpoint
ALTER TABLE "stores_items" ADD COLUMN "emergency_contact" text;--> statement-breakpoint
CREATE INDEX "idx_stores_expiry_date" ON "stores_items" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "idx_stores_hazard_class" ON "stores_items" USING btree ("hazard_classification");--> statement-breakpoint
CREATE INDEX "idx_stores_batch_number" ON "stores_items" USING btree ("batch_number");