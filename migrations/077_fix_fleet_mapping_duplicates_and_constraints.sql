-- Migration 077: Clean up duplicate fleet mappings and enforce UNIQUE constraints

-- 1. Remove duplicate fleet_component_mapping rows (keep oldest per group)
DELETE FROM fleet_component_mapping a
USING fleet_component_mapping b
WHERE a.id > b.id
  AND a.fleet_equipment_code = b.fleet_equipment_code
  AND a.component_code = b.component_code
  AND a.vessel_code = b.vessel_code;

-- 2. Ensure UNIQUE constraint on fleet_component_mapping
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_fleet_component_mapping') THEN
    ALTER TABLE fleet_component_mapping
    ADD CONSTRAINT unique_fleet_component_mapping
    UNIQUE (fleet_equipment_code, vessel_code, component_code);
  END IF;
END $$;

-- 3. Ensure UNIQUE constraint on fleet_job_vessel_mapping
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_fleet_job_vessel_mapping') THEN
    ALTER TABLE fleet_job_vessel_mapping
    ADD CONSTRAINT unique_fleet_job_vessel_mapping
    UNIQUE (fleet_equipment_code, job_code, vessel_code, job_id);
  END IF;
END $$;

-- 4. Ensure UNIQUE constraint on fleet_spare_vessel_mapping
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_fleet_spare_vessel_mapping') THEN
    ALTER TABLE fleet_spare_vessel_mapping
    ADD CONSTRAINT unique_fleet_spare_vessel_mapping
    UNIQUE (fleet_equipment_code, part_code, vessel_code, spare_id);
  END IF;
END $$;
