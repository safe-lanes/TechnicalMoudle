-- Migration 075: Widen UNIQUE constraints on fleet job and spare vessel mappings
-- to include fleet_equipment_code, allowing same job/spare to be linked to
-- the same vessel under different fleet equipment codes.

-- Job mapping: drop narrow constraint, add wider one
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_fleet_job_vessel_mapping'
  ) THEN
    ALTER TABLE fleet_job_vessel_mapping DROP CONSTRAINT unique_fleet_job_vessel_mapping;
  END IF;
END $$;

ALTER TABLE fleet_job_vessel_mapping
  ADD CONSTRAINT unique_fleet_job_vessel_mapping
  UNIQUE (fleet_equipment_code, job_code, vessel_code);

-- Spare mapping: drop narrow constraint, add wider one
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_fleet_spare_vessel_mapping'
  ) THEN
    ALTER TABLE fleet_spare_vessel_mapping DROP CONSTRAINT unique_fleet_spare_vessel_mapping;
  END IF;
END $$;

ALTER TABLE fleet_spare_vessel_mapping
  ADD CONSTRAINT unique_fleet_spare_vessel_mapping
  UNIQUE (fleet_equipment_code, part_code, vessel_code);
