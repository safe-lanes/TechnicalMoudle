-- Migration 017: Noon Report Phase 1 Field Corrections & Fixes
-- Adds new columns to nr_noon_reports for Fixes 1-5

-- Fix 1: Navigation extras (Tab 1)
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS next_port TEXT;
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS eta_next_port TIMESTAMPTZ;
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS distance_to_go NUMERIC;

-- Fix 2: Temperature fields (Tab 2)
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS air_temperature NUMERIC;
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS sea_temperature NUMERIC;

-- Fix 3: Consumables (Tab 3)
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS lube_oil_consumption NUMERIC;
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS fresh_water_consumption NUMERIC;
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS fresh_water_produced NUMERIC;

-- Fix 4: Per-fuel CO2 + override notes (Tab 4)
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS co2_hfo NUMERIC;
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS co2_lsmgo NUMERIC;
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS co2_mgo NUMERIC;
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS co2_vlsfo NUMERIC;
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS co2_lpg NUMERIC;
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS co2_total NUMERIC;
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS emission_override_notes TEXT;

-- Fix 5: Split remarks into general_remarks + machinery_remarks (Tab 5)
-- Keep old 'remarks' column for backward compatibility
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS general_remarks TEXT;
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS machinery_remarks TEXT;

-- Track migration
INSERT INTO schema_migrations (id, name, description, applied_at)
VALUES ('017', '017_noon_report_phase1_fixes', 'Noon Report Phase 1 field corrections and fixes', NOW())
ON CONFLICT (id) DO NOTHING;
