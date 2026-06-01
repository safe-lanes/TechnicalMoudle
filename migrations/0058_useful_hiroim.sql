ALTER TABLE "fleet_jobs" ADD COLUMN "interval_running_hour" integer;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD COLUMN "location_uuid" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "luuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "spare_location_stock" ADD COLUMN "location_uuid" text;--> statement-breakpoint
ALTER TABLE "superintendent_notifications" ADD COLUMN "snuuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "superintendent_notifications" ADD COLUMN "vessel_id" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "superintendent_rejection_remarks" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "dual_trigger_leg" text;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_luuid_unique" UNIQUE("luuid");--> statement-breakpoint
ALTER TABLE "superintendent_notifications" ADD CONSTRAINT "superintendent_notifications_snuuid_unique" UNIQUE("snuuid");