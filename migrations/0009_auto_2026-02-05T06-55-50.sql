ALTER TABLE "maker_list" ADD COLUMN "maker_list_uuid" text DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "maker_list" ADD COLUMN "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "maker_list" ADD COLUMN "created_by_uuid" text;--> statement-breakpoint
ALTER TABLE "maker_list" ADD COLUMN "updated_by_uuid" text;--> statement-breakpoint
ALTER TABLE "maker_list" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "maker_list" ADD COLUMN "is_sync" boolean DEFAULT false;--> statement-breakpoint
CREATE INDEX "idx_maker_list_uuid" ON "maker_list" USING btree ("maker_list_uuid");