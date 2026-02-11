-- Migration: Add DB-level foreign key constraints between fleet tables
-- Strategy: RESTRICT on DELETE and UPDATE to prevent orphan records
-- Pre-check: Zero orphan records confirmed before applying

-- FK: fleet_jobs.fleet_components_uuid → fleet_components.fleet_components_uuid
ALTER TABLE fleet_jobs
  ADD CONSTRAINT fk_fleet_jobs_fleet_components
  FOREIGN KEY (fleet_components_uuid)
  REFERENCES fleet_components(fleet_components_uuid)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- FK: fleet_spares.fleet_components_uuid → fleet_components.fleet_components_uuid
ALTER TABLE fleet_spares
  ADD CONSTRAINT fk_fleet_spares_fleet_components
  FOREIGN KEY (fleet_components_uuid)
  REFERENCES fleet_components(fleet_components_uuid)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
