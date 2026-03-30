-- Migration 073: Fleet Classes table and vessel class_id column
-- Adds fleet_classes table for organizing vessels into groups within a fleet
-- Adds fuuid column to fleets table for UUID-based FK references
-- Adds class_id column to vessels table referencing fleet_classes.fcuuid

-- Step 1: Add fuuid column to fleets table
ALTER TABLE fleets ADD COLUMN IF NOT EXISTS fuuid TEXT;

-- Backfill fuuid for existing fleet records using gen_random_uuid()
UPDATE fleets SET fuuid = gen_random_uuid()::text WHERE fuuid IS NULL;

-- Make fuuid NOT NULL and UNIQUE after backfill
ALTER TABLE fleets ALTER COLUMN fuuid SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_fleets_fuuid ON fleets(fuuid);

-- Step 2: Create fleet_classes table
CREATE TABLE IF NOT EXISTS fleet_classes (
  id SERIAL PRIMARY KEY,
  fcuuid TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  fleet_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  is_sync BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Unique constraint on fcuuid
CREATE UNIQUE INDEX IF NOT EXISTS idx_fleet_classes_fcuuid ON fleet_classes(fcuuid);

-- Index on fleet_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_fleet_classes_fleet_id ON fleet_classes(fleet_id);

-- Unique constraint on (fleet_id, name) for non-deleted classes only
CREATE UNIQUE INDEX IF NOT EXISTS idx_fleet_classes_fleet_name_unique
  ON fleet_classes(fleet_id, name) WHERE is_deleted = false;

-- Step 3: Add class_id column to vessels table
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS class_id TEXT;
