-- Migration 148: per-table one-way watermarks.
--
-- NUMBERING: 144 REMAINS RESERVED for Phase 1 tri-state — do not take it. 145 deprecate,
-- 146 boolean normalise, 147 retry ladder. This is 148.
--
-- WHY (WK dev fleet, both vessels): the shore→ship one-way watermark is a SINGLE
-- timestamp per instance (sync_metadata.last_sync_checkpoint) covering all ~52 one-way
-- tables. Two consequences, both observed in the field:
--
--   1. FREEZE-EVERYTHING. When the ship reports a failed one-way table the shore holds
--      that single watermark back (service.ts oneWayHoldback). 180 unappliable rows in
--      ONE RBAC join table therefore pinned EVERY one-way table for that vessel — and,
--      because the held value was NULL on a fresh ship, forced a full snapshot of all
--      52 tables on every cycle, which is what drove the 60s nginx 504.
--   2. STRANDED PARENTS. admn_role_master's newest change (17-Jul) sat BEHIND both ships'
--      checkpoints (20-Jul) while adm_role_menu_access (22-Jul) sat ahead — so children
--      shipped, parents never did, and the FK failed forever with no self-heal.
--
-- Per-table watermarks confine the damage to the table that is actually broken.
--
-- NO SEED, DELIBERATELY. The reader COALESCEs a missing per-table row to
-- sync_metadata.last_sync_checkpoint, so day one is byte-identical to today for every
-- table WITHOUT enumerating them here. A seeded CROSS JOIN would need a hardcoded table
-- list that drifts the moment syncConfig gains a table — the fallback cannot drift.
-- Every vessel therefore starts exactly where it already was; nothing re-offers.
--
-- LOCAL BOOKKEEPING ONLY — declared NO_SYNC in shared/syncConfig.ts alongside
-- sync_metadata. This table must NEVER travel; each instance owns its own watermarks.
--
-- Idempotent: IF NOT EXISTS throughout; a second run is a clean no-op.

CREATE TABLE IF NOT EXISTS sync_table_checkpoints (
  id               integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  instance_id      text NOT NULL,
  table_name       text NOT NULL,
  last_checkpoint  timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT sync_table_checkpoints_instance_table_unique UNIQUE (instance_id, table_name)
);
--> statement-breakpoint

-- The read path is always "all watermarks for this instance", so the unique constraint
-- above already serves it; this index covers the instance-only lookup without the
-- table_name prefix scan.
CREATE INDEX IF NOT EXISTS idx_sync_table_checkpoints_instance
  ON sync_table_checkpoints (instance_id);
