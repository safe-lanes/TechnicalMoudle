-- Migration 023: Create missing nr_cii_tracking and nr_alerts tables
-- These tables were defined in shared/schema-noon-report.ts but never had
-- a CREATE TABLE migration. Migration 016 only created 3 of the 5 original
-- nr_ tables. All operations are idempotent.

-- ── nr_cii_tracking ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nr_cii_tracking (
  id                  SERIAL PRIMARY KEY,
  vessel_id           TEXT NOT NULL,
  year                INTEGER NOT NULL,
  ytd_co2_mt          NUMERIC,
  ytd_distance_nm     NUMERIC,
  aer                 NUMERIC,
  cii_rating          TEXT,
  previous_cii_rating TEXT,
  created_by_uuid     TEXT,
  updated_by_uuid     TEXT,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  is_deleted          BOOLEAN NOT NULL DEFAULT false,
  is_sync             BOOLEAN NOT NULL DEFAULT false,
  nctuuid             TEXT NOT NULL DEFAULT gen_random_uuid()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nr_cii_vessel_year
  ON nr_cii_tracking (vessel_id, year);

-- ── nr_alerts ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nr_alerts (
  id                SERIAL PRIMARY KEY,
  vessel_id         TEXT NOT NULL,
  report_id         INTEGER,
  alert_type        TEXT NOT NULL,
  severity          TEXT NOT NULL,
  message           TEXT NOT NULL,
  metric_value      NUMERIC,
  threshold_value   NUMERIC,
  acknowledged_at   TIMESTAMP,
  acknowledged_by   TEXT,
  created_by_uuid   TEXT,
  updated_by_uuid   TEXT,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  is_deleted        BOOLEAN NOT NULL DEFAULT false,
  is_sync           BOOLEAN NOT NULL DEFAULT false,
  nauuid            TEXT NOT NULL DEFAULT gen_random_uuid()
);

CREATE INDEX IF NOT EXISTS idx_nr_alerts_vessel
  ON nr_alerts (vessel_id);

CREATE INDEX IF NOT EXISTS idx_nr_alerts_type_vessel
  ON nr_alerts (vessel_id, alert_type);
