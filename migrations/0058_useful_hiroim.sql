ALTER TABLE "fleet_jobs" ADD COLUMN IF NOT EXISTS "interval_running_hour" integer;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS "location_uuid" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "luuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "spare_location_stock" ADD COLUMN IF NOT EXISTS "location_uuid" text;--> statement-breakpoint
ALTER TABLE "superintendent_notifications" ADD COLUMN IF NOT EXISTS "snuuid" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "superintendent_notifications" ADD COLUMN IF NOT EXISTS "vessel_id" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "superintendent_rejection_remarks" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "dual_trigger_leg" text;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "locations" ADD CONSTRAINT "locations_luuid_unique" UNIQUE("luuid");
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "superintendent_notifications" ADD CONSTRAINT "superintendent_notifications_snuuid_unique" UNIQUE("snuuid");
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
