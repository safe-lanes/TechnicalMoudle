-- Migration: Backfill fleet_components_uuid in fleet_jobs table
-- Populates the new column by matching fleet_equipment_code against fleet_components

UPDATE fleet_jobs
SET fleet_components_uuid = fc.fleet_components_uuid
FROM fleet_components fc
WHERE fleet_jobs.fleet_equipment_code = fc.fleet_equipment_code
  AND fleet_jobs.fleet_components_uuid IS NULL;
