-- Migration: 006_defect_additional_columns
-- Description: Adds risk_level, date_registered_in_system, and other missing columns to defects table

ALTER TABLE defects ADD COLUMN IF NOT EXISTS risk_level TEXT;
ALTER TABLE defects ADD COLUMN IF NOT EXISTS date_registered_in_system TEXT;
