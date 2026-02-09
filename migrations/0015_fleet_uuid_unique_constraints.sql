-- Migration: Add unique constraints to fleet_components_uuid and fleet_jobs_uuid
-- These UUID columns serve as primary relational keys per Fleet Table Schema Contract

DROP INDEX IF EXISTS "idx_fleet_components_uuid";
CREATE UNIQUE INDEX "idx_fleet_components_uuid" ON "fleet_components" ("fleet_components_uuid");

DROP INDEX IF EXISTS "idx_fleet_jobs_uuid";
CREATE UNIQUE INDEX "idx_fleet_jobs_uuid" ON "fleet_jobs" ("fleet_jobs_uuid");
