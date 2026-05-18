ALTER TABLE "adm_role_menu_access" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "adm_role_menu_access" ADD COLUMN IF NOT EXISTS "is_sync" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "adm_role_menu_access" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "fleet_classes" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "master_list_types" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "planner_dates" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "report_favorites" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "vessel_department_config" ADD COLUMN IF NOT EXISTS "created_by_uuid" text;--> statement-breakpoint
ALTER TABLE "vessel_department_config" ADD COLUMN IF NOT EXISTS "updated_by_uuid" text;--> statement-breakpoint
ALTER TABLE "vessel_department_config" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "vessel_department_config" ADD COLUMN IF NOT EXISTS "is_sync" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "vessel_org_chart_nodes" ADD COLUMN IF NOT EXISTS "is_sync" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "nr_alerts" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "nr_bunker_records" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "nr_cii_tracking" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "nr_fuel_rob" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "nr_noon_reports" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "nr_voyage_legs" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;