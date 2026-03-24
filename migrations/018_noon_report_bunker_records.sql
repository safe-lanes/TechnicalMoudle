-- Migration 018: Noon Report Bunker Records (BDN Management)
-- Adds nr_bunker_records table for bunkering event tracking (Delivery Notes / BDN)
-- Column names match shared/schema-noon-report.ts exactly:
--   sample_seal_number (not seal_number), remarks (not notes), total_cost added

CREATE TABLE IF NOT EXISTS nr_bunker_records (
  id                SERIAL PRIMARY KEY,
  vessel_id         TEXT NOT NULL,
  voyage_no         TEXT,
  port              TEXT NOT NULL,
  bunkered_date     TEXT NOT NULL,           -- YYYY-MM-DD stored as text (matches schema)
  fuel_type         TEXT NOT NULL,           -- HFO | LSMGO | MGO | VLSFO | LPG
  quantity_mt       NUMERIC(12, 4) NOT NULL,
  density           NUMERIC(8, 4),
  sulphur_pct       NUMERIC(5, 3),
  price_pmt         NUMERIC(12, 2),
  total_cost        NUMERIC(14, 2),          -- USD (quantity × price, auto-computed on save)
  supplier          TEXT,
  bdn_number        TEXT,
  sample_seal_number TEXT,                   -- MARPOL traceability
  remarks           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If the table already existed with old column names (seal_number, notes),
-- rename them to match the current schema. These are safe no-ops if columns
-- don't exist (ALTER TABLE ... RENAME COLUMN fails silently via DO block).
DO $$
BEGIN
  -- Rename seal_number -> sample_seal_number if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nr_bunker_records' AND column_name = 'seal_number'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nr_bunker_records' AND column_name = 'sample_seal_number'
  ) THEN
    ALTER TABLE nr_bunker_records RENAME COLUMN seal_number TO sample_seal_number;
  END IF;

  -- Rename notes -> remarks if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nr_bunker_records' AND column_name = 'notes'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nr_bunker_records' AND column_name = 'remarks'
  ) THEN
    ALTER TABLE nr_bunker_records RENAME COLUMN notes TO remarks;
  END IF;

  -- Add total_cost if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nr_bunker_records' AND column_name = 'total_cost'
  ) THEN
    ALTER TABLE nr_bunker_records ADD COLUMN total_cost NUMERIC(14, 2);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_nr_bunker_vessel
  ON nr_bunker_records (vessel_id);

CREATE INDEX IF NOT EXISTS idx_nr_bunker_vessel_date
  ON nr_bunker_records (vessel_id, bunkered_date DESC);
