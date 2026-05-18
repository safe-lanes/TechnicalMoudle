-- ====== NOON REPORT MODULE TABLES ======
-- Migration: 016_noon_report_tables.sql

-- nr_noon_reports: main daily noon position & fuel report
CREATE TABLE IF NOT EXISTS nr_noon_reports (
  id SERIAL PRIMARY KEY,
  vessel_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMP,
  submitted_by TEXT,
  draft_saved_at TIMESTAMP,
  report_date TEXT NOT NULL,
  report_time TEXT,
  voyage_no TEXT,
  port_from TEXT,
  port_to TEXT,
  -- Navigation
  lat_degrees NUMERIC,
  lat_minutes NUMERIC,
  lat_direction TEXT,
  lon_degrees NUMERIC,
  lon_minutes NUMERIC,
  lon_direction TEXT,
  course NUMERIC,
  speed NUMERIC,
  distance_sailed NUMERIC,
  -- Weather
  wind_direction TEXT,
  wind_force INTEGER,
  sea_state INTEGER,
  swell_height NUMERIC,
  swell_direction TEXT,
  visibility TEXT,
  current_direction TEXT,
  current_speed NUMERIC,
  -- Machinery
  me_load NUMERIC,
  me_rpm NUMERIC,
  me_hours NUMERIC,
  ae_running_hours NUMERIC,
  boiler_hours NUMERIC,
  -- Fuel Consumption (MT)
  hfo_consumption NUMERIC,
  lsmgo_consumption NUMERIC,
  mgo_consumption NUMERIC,
  vlsfo_consumption NUMERIC,
  lpg_consumption NUMERIC,
  -- ROB (MT)
  hfo_rob NUMERIC,
  lsmgo_rob NUMERIC,
  mgo_rob NUMERIC,
  vlsfo_rob NUMERIC,
  lpg_rob NUMERIC,
  -- Emissions (calculated)
  co2_emissions NUMERIC,
  sox_emissions NUMERIC,
  nox_emissions NUMERIC,
  eeoi NUMERIC,
  cii_rating TEXT,
  aer NUMERIC,
  -- Cargo / Remarks
  draft_forward NUMERIC,
  draft_aft NUMERIC,
  trim NUMERIC,
  condition TEXT,
  cargo_quantity NUMERIC,
  cargo_description TEXT,
  remarks TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nr_reports_vessel_date ON nr_noon_reports(vessel_id, report_date);
CREATE INDEX IF NOT EXISTS idx_nr_reports_status ON nr_noon_reports(status);

-- nr_fuel_rob: current ROB per vessel per fuel type
CREATE TABLE IF NOT EXISTS nr_fuel_rob (
  id SERIAL PRIMARY KEY,
  vessel_id TEXT NOT NULL,
  fuel_type TEXT NOT NULL,
  current_rob NUMERIC NOT NULL DEFAULT 0,
  last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
  last_report_id INTEGER
);

CREATE INDEX IF NOT EXISTS idx_nr_rob_vessel_fuel ON nr_fuel_rob(vessel_id, fuel_type);

-- nr_voyage_legs: voyage tracking
CREATE TABLE IF NOT EXISTS nr_voyage_legs (
  id SERIAL PRIMARY KEY,
  vessel_id TEXT NOT NULL,
  voyage_no TEXT NOT NULL,
  port_from TEXT,
  port_to TEXT,
  departure_date TEXT,
  arrival_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nr_voyage_vessel ON nr_voyage_legs(vessel_id);
