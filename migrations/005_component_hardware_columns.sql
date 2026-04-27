-- Migration: 005_component_hardware_columns
-- Description: Adds component SIRE hardware class columns for Part A of the defect form

ALTER TABLE defects ADD COLUMN IF NOT EXISTS component_hardware_id TEXT;
ALTER TABLE defects ADD COLUMN IF NOT EXISTS component_hardware_level1 TEXT;
ALTER TABLE defects ADD COLUMN IF NOT EXISTS component_hardware_level2 TEXT;
ALTER TABLE defects ADD COLUMN IF NOT EXISTS component_hardware_level3 TEXT;
