-- Migration 113: Enable bidirectional sync for locations + superintendent_notifications
-- Adds UUID sync keys, location_uuid FK companion columns, vessel_id to superintendent_notifications
-- All statements are idempotent (IF NOT EXISTS / WHERE ... IS NULL guards)

-- ══════════════════════════════════════════════════════════════════════════════
-- B1.1  locations — add luuid (UUID sync identity column)
-- Pattern: same as scluuid on spare_component_links, slsuuid on spare_location_stock
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS luuid TEXT;

UPDATE locations
  SET luuid = gen_random_uuid()::text
  WHERE luuid IS NULL;

-- Two-step NOT NULL: Postgres requires column to exist before altering constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'locations' AND column_name = 'luuid' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE locations ALTER COLUMN luuid SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'locations_luuid_key'
  ) THEN
    ALTER TABLE locations ADD CONSTRAINT locations_luuid_key UNIQUE (luuid);
  END IF;
END $$;

ALTER TABLE locations ALTER COLUMN luuid SET DEFAULT gen_random_uuid()::text;

-- Also ensure updated_at column exists (DB has it from earlier migration, but Drizzle
-- schema needs it for sync stale-skip guard — migration ensures DB matches)
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();


-- ══════════════════════════════════════════════════════════════════════════════
-- B1.2  spare_location_stock — add location_uuid (companion FK for cross-instance sync)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE spare_location_stock
  ADD COLUMN IF NOT EXISTS location_uuid TEXT;

UPDATE spare_location_stock sls
  SET location_uuid = l.luuid
  FROM locations l
  WHERE sls.location_id = l.id
    AND sls.location_uuid IS NULL;

CREATE INDEX IF NOT EXISTS idx_sls_location_uuid
  ON spare_location_stock(location_uuid);


-- ══════════════════════════════════════════════════════════════════════════════
-- B1.3  inventory_transactions — add location_uuid (companion FK for cross-instance sync)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE inventory_transactions
  ADD COLUMN IF NOT EXISTS location_uuid TEXT;

UPDATE inventory_transactions it
  SET location_uuid = l.luuid
  FROM locations l
  WHERE it.location_id = l.id
    AND it.location_uuid IS NULL;

CREATE INDEX IF NOT EXISTS idx_invtxn_location_uuid
  ON inventory_transactions(location_uuid);


-- ══════════════════════════════════════════════════════════════════════════════
-- B1.4  superintendent_notifications — add snuuid (UUID sync identity) + vessel_id
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE superintendent_notifications
  ADD COLUMN IF NOT EXISTS snuuid TEXT;

UPDATE superintendent_notifications
  SET snuuid = gen_random_uuid()::text
  WHERE snuuid IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'superintendent_notifications' AND column_name = 'snuuid' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE superintendent_notifications ALTER COLUMN snuuid SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supn_snuuid_key'
  ) THEN
    ALTER TABLE superintendent_notifications ADD CONSTRAINT supn_snuuid_key UNIQUE (snuuid);
  END IF;
END $$;

ALTER TABLE superintendent_notifications ALTER COLUMN snuuid SET DEFAULT gen_random_uuid()::text;

ALTER TABLE superintendent_notifications
  ADD COLUMN IF NOT EXISTS vessel_id TEXT;

-- Backfill vessel_id from denormalized vessel_name via vessels table
UPDATE superintendent_notifications sn
  SET vessel_id = v.vuuid
  FROM vessels v
  WHERE LOWER(TRIM(v.name)) = LOWER(TRIM(sn.vessel_name))
    AND sn.vessel_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_supn_vessel
  ON superintendent_notifications(vessel_id);
