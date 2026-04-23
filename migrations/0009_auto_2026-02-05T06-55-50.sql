ALTER TABLE "maker_list" ADD COLUMN IF NOT EXISTS "maker_list_uuid" text DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "maker_list" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "maker_list" ADD COLUMN IF NOT EXISTS "created_by_uuid" text;--> statement-breakpoint
ALTER TABLE "maker_list" ADD COLUMN IF NOT EXISTS "updated_by_uuid" text;--> statement-breakpoint
ALTER TABLE "maker_list" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "maker_list" ADD COLUMN IF NOT EXISTS "is_sync" boolean DEFAULT false;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_maker_list_uuid" ON "maker_list" USING btree ("maker_list_uuid");