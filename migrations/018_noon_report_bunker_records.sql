-- Migration 018: Noon Report Bunker Records (BDN Management)
-- Adds nr_bunker_records table for bunkering event tracking (Delivery Notes / BDN)

CREATE TABLE IF NOT EXISTS nr_bunker_records (
  id            SERIAL PRIMARY KEY,
  vessel_id     TEXT NOT NULL,
  voyage_no     TEXT,
  port          TEXT NOT NULL,
  bunkered_date DATE NOT NULL,
  fuel_type     TEXT NOT NULL,  -- HFO | LSMGO | MGO | VLSFO | LPG
  quantity_mt   NUMERIC(12, 4) NOT NULL,
  density       NUMERIC(8, 4),
  sulphur_pct   NUMERIC(5, 3),
  price_pmt     NUMERIC(12, 2),
  supplier      TEXT,
  bdn_number    TEXT,
  seal_number   TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nr_bunker_vessel_date
  ON nr_bunker_records (vessel_id, bunkered_date DESC);

CREATE INDEX IF NOT EXISTS idx_nr_bunker_vessel_fuel
  ON nr_bunker_records (vessel_id, fuel_type);
