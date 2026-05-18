-- Migration 076: Include job_id and spare_id in UNIQUE constraints
-- Allows multiple vessel job/spare instances (different juuid/suuid) to be
-- mapped under the same fleet_equipment_code + code + vessel.

-- Job mapping: widen to include job_id
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
  UNIQUE (fleet_equipment_code, job_code, vessel_code, job_id);

-- Spare mapping: widen to include spare_id
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
  UNIQUE (fleet_equipment_code, part_code, vessel_code, spare_id);
