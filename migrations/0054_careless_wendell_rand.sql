ALTER TABLE "additional_groups" ADD COLUMN IF NOT EXISTS "is_sync" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "additional_groups" ADD COLUMN IF NOT EXISTS "created_by_uuid" text;--> statement-breakpoint
ALTER TABLE "additional_groups" ADD COLUMN IF NOT EXISTS "updated_by_uuid" text;--> statement-breakpoint
ALTER TABLE "additional_groups" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "additional_groups" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "alert_acknowledgements" ADD COLUMN IF NOT EXISTS "is_sync" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "alert_acknowledgements" ADD COLUMN IF NOT EXISTS "created_by_uuid" text;--> statement-breakpoint
ALTER TABLE "alert_acknowledgements" ADD COLUMN IF NOT EXISTS "updated_by_uuid" text;--> statement-breakpoint
ALTER TABLE "alert_acknowledgements" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "alert_acknowledgements" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "company_standard_grace_settings" ADD COLUMN IF NOT EXISTS "is_sync" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "company_standard_grace_settings" ADD COLUMN IF NOT EXISTS "created_by_uuid" text;--> statement-breakpoint
ALTER TABLE "company_standard_grace_settings" ADD COLUMN IF NOT EXISTS "updated_by_uuid" text;--> statement-breakpoint
ALTER TABLE "company_standard_grace_settings" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "company_standard_grace_settings" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "fleet_groups" ADD COLUMN IF NOT EXISTS "is_sync" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "fleet_groups" ADD COLUMN IF NOT EXISTS "created_by_uuid" text;--> statement-breakpoint
ALTER TABLE "fleet_groups" ADD COLUMN IF NOT EXISTS "updated_by_uuid" text;--> statement-breakpoint
ALTER TABLE "fleet_groups" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "fleet_groups" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "master_users" ADD COLUMN IF NOT EXISTS "is_sync" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "master_users" ADD COLUMN IF NOT EXISTS "created_by_uuid" text;--> statement-breakpoint
ALTER TABLE "master_users" ADD COLUMN IF NOT EXISTS "updated_by_uuid" text;--> statement-breakpoint
ALTER TABLE "master_users" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "master_users" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "monthly_snapshots" ADD COLUMN IF NOT EXISTS "is_sync" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "monthly_snapshots" ADD COLUMN IF NOT EXISTS "created_by_uuid" text;--> statement-breakpoint
ALTER TABLE "monthly_snapshots" ADD COLUMN IF NOT EXISTS "updated_by_uuid" text;--> statement-breakpoint
ALTER TABLE "monthly_snapshots" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "monthly_snapshots" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "ports" ADD COLUMN IF NOT EXISTS "is_sync" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "ports" ADD COLUMN IF NOT EXISTS "created_by_uuid" text;--> statement-breakpoint
ALTER TABLE "ports" ADD COLUMN IF NOT EXISTS "updated_by_uuid" text;--> statement-breakpoint
ALTER TABLE "ports" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "ports" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "superintendent_notifications" ADD COLUMN IF NOT EXISTS "is_sync" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "superintendent_notifications" ADD COLUMN IF NOT EXISTS "created_by_uuid" text;--> statement-breakpoint
ALTER TABLE "superintendent_notifications" ADD COLUMN IF NOT EXISTS "updated_by_uuid" text;--> statement-breakpoint
ALTER TABLE "superintendent_notifications" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "superintendent_notifications" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "vessel_types" ADD COLUMN IF NOT EXISTS "is_sync" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "vessel_types" ADD COLUMN IF NOT EXISTS "created_by_uuid" text;--> statement-breakpoint
ALTER TABLE "vessel_types" ADD COLUMN IF NOT EXISTS "updated_by_uuid" text;--> statement-breakpoint
ALTER TABLE "vessel_types" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "vessel_types" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "work_order_anomalies" ADD COLUMN IF NOT EXISTS "is_sync" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "work_order_anomalies" ADD COLUMN IF NOT EXISTS "created_by_uuid" text;--> statement-breakpoint
ALTER TABLE "work_order_anomalies" ADD COLUMN IF NOT EXISTS "updated_by_uuid" text;--> statement-breakpoint
ALTER TABLE "work_order_anomalies" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "work_order_anomalies" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "work_order_documents" ADD COLUMN IF NOT EXISTS "is_sync" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "work_order_documents" ADD COLUMN IF NOT EXISTS "created_by_uuid" text;--> statement-breakpoint
ALTER TABLE "work_order_documents" ADD COLUMN IF NOT EXISTS "updated_by_uuid" text;--> statement-breakpoint
ALTER TABLE "work_order_documents" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "work_order_documents" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;