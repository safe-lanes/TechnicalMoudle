-- Migration 019: Add audit columns and FK constraints to all nr_ tables
-- Safe to re-run (all operations are idempotent)

-- ── 1. Add created_by_uuid / updated_by_uuid to all 6 nr_ tables ─────────────

ALTER TABLE nr_noon_reports
  ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT;

ALTER TABLE nr_fuel_rob
  ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT;

ALTER TABLE nr_voyage_legs
  ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT;

ALTER TABLE nr_alerts
  ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT;

ALTER TABLE nr_cii_tracking
  ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT;

ALTER TABLE nr_bunker_records
  ADD COLUMN IF NOT EXISTS created_by_uuid TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT;

-- ── 2. Rename nr_fuel_rob.last_updated → updated_at ──────────────────────────

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nr_fuel_rob' AND column_name = 'last_updated'
  ) THEN
    ALTER TABLE nr_fuel_rob RENAME COLUMN last_updated TO updated_at;
  END IF;
END $$;

-- ── 3. Add created_at to nr_cii_tracking ─────────────────────────────────────

ALTER TABLE nr_cii_tracking
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();

-- ── 4. FK constraints (idempotent — skipped if already exists) ────────────────

-- vessel_id → vessels(id) for all 6 tables
DO $$ BEGIN
  ALTER TABLE nr_noon_reports
    ADD CONSTRAINT fk_nr_noon_reports_vessel FOREIGN KEY (vessel_id) REFERENCES vessels(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE nr_fuel_rob
    ADD CONSTRAINT fk_nr_fuel_rob_vessel FOREIGN KEY (vessel_id) REFERENCES vessels(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE nr_voyage_legs
    ADD CONSTRAINT fk_nr_voyage_legs_vessel FOREIGN KEY (vessel_id) REFERENCES vessels(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE nr_alerts
    ADD CONSTRAINT fk_nr_alerts_vessel FOREIGN KEY (vessel_id) REFERENCES vessels(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE nr_cii_tracking
    ADD CONSTRAINT fk_nr_cii_tracking_vessel FOREIGN KEY (vessel_id) REFERENCES vessels(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE nr_bunker_records
    ADD CONSTRAINT fk_nr_bunker_records_vessel FOREIGN KEY (vessel_id) REFERENCES vessels(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- nr_alerts.report_id → nr_noon_reports(id)
DO $$ BEGIN
  ALTER TABLE nr_alerts
    ADD CONSTRAINT fk_nr_alerts_report FOREIGN KEY (report_id) REFERENCES nr_noon_reports(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- nr_fuel_rob.last_report_id → nr_noon_reports(id)
DO $$ BEGIN
  ALTER TABLE nr_fuel_rob
    ADD CONSTRAINT fk_nr_fuel_rob_last_report FOREIGN KEY (last_report_id) REFERENCES nr_noon_reports(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
