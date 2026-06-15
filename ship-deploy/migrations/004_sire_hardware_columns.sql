-- Migration: 004_sire_hardware_columns
-- Description: Adds the SIRE hardware class columns to the defects table for SIRE 2.0 Annex 1 categorization

ALTER TABLE defects ADD COLUMN IF NOT EXISTS sire_hardware_id TEXT;
ALTER TABLE defects ADD COLUMN IF NOT EXISTS sire_hardware_level1 TEXT;
ALTER TABLE defects ADD COLUMN IF NOT EXISTS sire_hardware_level2 TEXT;
ALTER TABLE defects ADD COLUMN IF NOT EXISTS sire_hardware_level3 TEXT;
