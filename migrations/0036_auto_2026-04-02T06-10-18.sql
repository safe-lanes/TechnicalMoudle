ALTER TABLE "vessel_certificate_data" ADD COLUMN "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "vessel_certificate_data" ADD COLUMN "created_by_uuid" text;--> statement-breakpoint
ALTER TABLE "vessel_certificate_data" ADD COLUMN "updated_by_uuid" text;--> statement-breakpoint
ALTER TABLE "vessel_certificate_data" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "vessel_certificate_data" ADD COLUMN "is_sync" boolean DEFAULT false;