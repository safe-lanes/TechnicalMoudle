-- Migration 162: Office RH entry from WO completion (Task #394)
-- ADDITIVE ONLY — safe on mixed-version fleets (old instances ignore unknown
-- nullable columns; new instances tolerate NULLs from legacy rows).

-- 1) RH audit event metadata for the canonical "latest reading wins" comparator.
--    origin_side: 'ship' | 'shore' — which instance observed/entered the reading.
--    stamp_holder: the component's current_stamp at observation time (rotational epoch).
ALTER TABLE running_hours_audit ADD COLUMN IF NOT EXISTS origin_side TEXT;
ALTER TABLE running_hours_audit ADD COLUMN IF NOT EXISTS stamp_holder TEXT;

-- 2) Per-vessel office RH entry kill switch — DEFAULT OFF (fail closed), same
--    pattern as office_wo_generation_enabled (migration 161).
ALTER TABLE pms_vessel_settings ADD COLUMN IF NOT EXISTS office_rh_entry_enabled BOOLEAN NOT NULL DEFAULT false;
