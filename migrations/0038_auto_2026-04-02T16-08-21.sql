ALTER TABLE "ship_certificates_master" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "ship_certificates_master" ADD COLUMN IF NOT EXISTS "created_by_uuid" text;--> statement-breakpoint
ALTER TABLE "ship_certificates_master" ADD COLUMN IF NOT EXISTS "updated_by_uuid" text;--> statement-breakpoint
ALTER TABLE "ship_certificates_master" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "ship_certificates_master" ADD COLUMN IF NOT EXISTS "is_sync" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "ship_surveys_master" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "ship_surveys_master" ADD COLUMN IF NOT EXISTS "created_by_uuid" text;--> statement-breakpoint
ALTER TABLE "ship_surveys_master" ADD COLUMN IF NOT EXISTS "updated_by_uuid" text;--> statement-breakpoint
ALTER TABLE "ship_surveys_master" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "ship_surveys_master" ADD COLUMN IF NOT EXISTS "is_sync" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "vessel_certificate_applicability" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "vessel_certificate_applicability" ADD COLUMN IF NOT EXISTS "created_by_uuid" text;--> statement-breakpoint
ALTER TABLE "vessel_certificate_applicability" ADD COLUMN IF NOT EXISTS "updated_by_uuid" text;--> statement-breakpoint
ALTER TABLE "vessel_certificate_applicability" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "vessel_certificate_applicability" ADD COLUMN IF NOT EXISTS "is_sync" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "vessel_certificate_data" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "vessel_certificate_data" ADD COLUMN IF NOT EXISTS "created_by_uuid" text;--> statement-breakpoint
ALTER TABLE "vessel_certificate_data" ADD COLUMN IF NOT EXISTS "updated_by_uuid" text;--> statement-breakpoint
ALTER TABLE "vessel_certificate_data" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "vessel_certificate_data" ADD COLUMN IF NOT EXISTS "is_sync" boolean DEFAULT false;