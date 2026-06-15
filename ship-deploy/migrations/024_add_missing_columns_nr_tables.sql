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

-- ── Edge-case safety for nr_cii_tracking ───────────────────────────────────
-- Migration 023 creates this table with created_at, but in case 023 ran
-- on an environment where the table already existed without created_at
-- (from a partial earlier attempt), ensure the column is present.
ALTER TABLE nr_cii_tracking ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();

-- ── Clean up false schema_migrations records from deleted 019–022 ──────────
DELETE FROM schema_migrations WHERE id IN (
  '019_noon_report_audit_columns',
  '020_noon_report_fk_target_vuuid',
  '021_noon_report_fk_no_action',
  '022_noon_report_soft_delete_uuid'
);
