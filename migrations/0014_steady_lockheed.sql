-- Migration: Add fleet_components_uuid column to fleet_jobs table
-- Links fleet jobs to fleet components via UUID for referential integrity

ALTER TABLE "fleet_jobs" ADD COLUMN IF NOT EXISTS "fleet_components_uuid" text;

CREATE INDEX IF NOT EXISTS "idx_fleet_jobs_component_uuid" ON "fleet_jobs" USING btree ("fleet_components_uuid");
