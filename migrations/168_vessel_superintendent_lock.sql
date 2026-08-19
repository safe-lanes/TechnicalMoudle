-- 168: Vessel-specific Superintendent Approval Lock
--
-- Replaces the legacy company-wide setting as the active approval-policy source.
-- FALSE is the requested default: high-severity WOs remain notify-only unless a
-- shore Sail Admin / Super Admin explicitly enables the lock for that vessel.
-- pms_vessel_settings is already synchronized ONE_WAY_SHORE_TO_SHIP.

ALTER TABLE pms_vessel_settings
  ADD COLUMN IF NOT EXISTS superintendent_lock_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Explicitly retain the requested OFF default for pre-existing rows in databases
-- that may have introduced this column outside the normal migration path.
UPDATE pms_vessel_settings
   SET superintendent_lock_enabled = FALSE
 WHERE superintendent_lock_enabled IS NULL;