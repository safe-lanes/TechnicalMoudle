ALTER TABLE "fleet_component_mapping" DROP CONSTRAINT IF EXISTS "unique_fleet_component_mapping";--> statement-breakpoint
ALTER TABLE "fleet_job_vessel_mapping" DROP CONSTRAINT IF EXISTS "unique_fleet_job_vessel_mapping";--> statement-breakpoint
ALTER TABLE "fleet_spare_vessel_mapping" DROP CONSTRAINT IF EXISTS "unique_fleet_spare_vessel_mapping";