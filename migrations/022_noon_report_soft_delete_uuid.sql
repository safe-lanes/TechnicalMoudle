-- Migration 022: Add is_deleted, is_sync, and uuid columns to all nr_ tables
-- Follows the established pattern from components, jobs, work_orders, etc.
-- Uses ADD COLUMN IF NOT EXISTS for idempotency.

-- ── nr_noon_reports ──────────────────────────────────────────────────────────
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS is_sync    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nr_noon_reports ADD COLUMN IF NOT EXISTS uuid       TEXT NOT NULL DEFAULT gen_random_uuid();

-- ── nr_fuel_rob ──────────────────────────────────────────────────────────────
ALTER TABLE nr_fuel_rob ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nr_fuel_rob ADD COLUMN IF NOT EXISTS is_sync    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nr_fuel_rob ADD COLUMN IF NOT EXISTS uuid       TEXT NOT NULL DEFAULT gen_random_uuid();

-- ── nr_voyage_legs ───────────────────────────────────────────────────────────
ALTER TABLE nr_voyage_legs ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nr_voyage_legs ADD COLUMN IF NOT EXISTS is_sync    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nr_voyage_legs ADD COLUMN IF NOT EXISTS uuid       TEXT NOT NULL DEFAULT gen_random_uuid();

-- ── nr_alerts ─────────────────────────────────────────────────────────────────
ALTER TABLE nr_alerts ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nr_alerts ADD COLUMN IF NOT EXISTS is_sync    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nr_alerts ADD COLUMN IF NOT EXISTS uuid       TEXT NOT NULL DEFAULT gen_random_uuid();

-- ── nr_cii_tracking ──────────────────────────────────────────────────────────
ALTER TABLE nr_cii_tracking ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nr_cii_tracking ADD COLUMN IF NOT EXISTS is_sync    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nr_cii_tracking ADD COLUMN IF NOT EXISTS uuid       TEXT NOT NULL DEFAULT gen_random_uuid();

-- ── nr_bunker_records ─────────────────────────────────────────────────────────
ALTER TABLE nr_bunker_records ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nr_bunker_records ADD COLUMN IF NOT EXISTS is_sync    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nr_bunker_records ADD COLUMN IF NOT EXISTS uuid       TEXT NOT NULL DEFAULT gen_random_uuid();
