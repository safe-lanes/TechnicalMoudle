-- Migration 024: Add missing columns to the 4 existing nr_ tables
-- Replaces deleted migrations 019-022 which failed silently due to
-- referencing non-existent nr_alerts/nr_cii_tracking tables.
-- The 2 newer tables (nr_cii_tracking, nr_alerts) already have all
-- columns from migration 023. No FK constraints.
-- All operations are idempotent.

-- ── nr_noon_reports ────────────────────────────────────────────────────────
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS created_by_uuid TEXT;
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT;
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS is_sync    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS nruuid     TEXT NOT NULL DEFAULT gen_random_uuid();

-- ── nr_fuel_rob ────────────────────────────────────────────────────────────
ALTER TABLE nr_fuel_rob ADD COLUMN IF NOT EXISTS created_by_uuid TEXT;
ALTER TABLE nr_fuel_rob ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT;
ALTER TABLE nr_fuel_rob ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nr_fuel_rob ADD COLUMN IF NOT EXISTS is_sync    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nr_fuel_rob ADD COLUMN IF NOT EXISTS nfruuid    TEXT NOT NULL DEFAULT gen_random_uuid();

-- Rename last_updated → updated_at if it still exists (from original 016 schema)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nr_fuel_rob' AND column_name = 'last_updated'
  ) THEN
    ALTER TABLE nr_fuel_rob RENAME COLUMN last_updated TO updated_at;
  END IF;
END $$;

-- ── nr_voyage_legs ─────────────────────────────────────────────────────────
ALTER TABLE nr_voyage_legs ADD COLUMN IF NOT EXISTS created_by_uuid TEXT;
ALTER TABLE nr_voyage_legs ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT;
ALTER TABLE nr_voyage_legs ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nr_voyage_legs ADD COLUMN IF NOT EXISTS is_sync    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nr_voyage_legs ADD COLUMN IF NOT EXISTS nvluuid    TEXT NOT NULL DEFAULT gen_random_uuid();

-- ── nr_bunker_records ──────────────────────────────────────────────────────
ALTER TABLE nr_bunker_records ADD COLUMN IF NOT EXISTS created_by_uuid TEXT;
ALTER TABLE nr_bunker_records ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT;
ALTER TABLE nr_bunker_records ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nr_bunker_records ADD COLUMN IF NOT EXISTS is_sync    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nr_bunker_records ADD COLUMN IF NOT EXISTS nbruuid    TEXT NOT NULL DEFAULT gen_random_uuid();
