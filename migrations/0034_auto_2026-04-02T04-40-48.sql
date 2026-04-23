ALTER TABLE "fleet_component_mapping" DROP CONSTRAINT IF EXISTS "unique_fleet_component_mapping";--> statement-breakpoint
ALTER TABLE "fleet_job_vessel_mapping" DROP CONSTRAINT IF EXISTS "unique_fleet_job_vessel_mapping";--> statement-breakpoint
ALTER TABLE "fleet_spare_vessel_mapping" DROP CONSTRAINT IF EXISTS "unique_fleet_spare_vessel_mapping";--> statement-breakpoint
ALTER TABLE "planner_dates" ADD COLUMN IF NOT EXISTS "pduuid" text NOT NULL;--> statement-breakpoint
ALTER TABLE "planner_dates" ADD COLUMN IF NOT EXISTS "created_by_uuid" text;--> statement-breakpoint
ALTER TABLE "planner_dates" ADD COLUMN IF NOT EXISTS "updated_by_uuid" text;--> statement-breakpoint
ALTER TABLE "planner_dates" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "planner_dates" ADD COLUMN IF NOT EXISTS "is_sync" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'planner_dates_vessel_id_vessels_vuuid_fk') THEN ALTER TABLE "planner_dates" ADD CONSTRAINT "planner_dates_vessel_id_vessels_vuuid_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("vuuid") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'planner_dates_job_id_jobs_juuid_fk') THEN ALTER TABLE "planner_dates" ADD CONSTRAINT "planner_dates_job_id_jobs_juuid_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("juuid") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'planner_dates_component_id_components_cuuid_fk') THEN ALTER TABLE "planner_dates" ADD CONSTRAINT "planner_dates_component_id_components_cuuid_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("cuuid") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'planner_dates_pduuid_unique') THEN ALTER TABLE "planner_dates" ADD CONSTRAINT "planner_dates_pduuid_unique" UNIQUE("pduuid"); END IF; END $$;