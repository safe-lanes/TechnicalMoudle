-- Migration 078: Replace UNIQUE constraints with partial UNIQUE indexes
-- Soft-delete (is_active = false) rows must not block re-linking the same record.
-- Partial indexes only enforce uniqueness among active rows.

-- Fleet Component Mapping
ALTER TABLE fleet_component_mapping DROP CONSTRAINT IF EXISTS unique_fleet_component_mapping;
CREATE UNIQUE INDEX IF NOT EXISTS unique_fleet_component_mapping_active 
  ON fleet_component_mapping(fleet_equipment_code, vessel_code, component_code) 
  WHERE is_active = true;

-- Fleet Job Mapping
ALTER TABLE fleet_job_vessel_mapping DROP CONSTRAINT IF EXISTS unique_fleet_job_vessel_mapping;
CREATE UNIQUE INDEX IF NOT EXISTS unique_fleet_job_vessel_mapping_active 
  ON fleet_job_vessel_mapping(fleet_equipment_code, job_code, vessel_code, job_id) 
  WHERE is_active = true;

-- Fleet Spare Mapping
ALTER TABLE fleet_spare_vessel_mapping DROP CONSTRAINT IF EXISTS unique_fleet_spare_vessel_mapping;
CREATE UNIQUE INDEX IF NOT EXISTS unique_fleet_spare_vessel_mapping_active 
  ON fleet_spare_vessel_mapping(fleet_equipment_code, part_code, vessel_code, spare_id) 
  WHERE is_active = true;
