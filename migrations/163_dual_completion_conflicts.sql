-- Migration 163: Dual-completion conflict kind marker (Task #399)
--
-- When the SAME work order is completed independently on both the vessel and
-- the office before a sync, the collision is now detected semantically and
-- recorded in sync_conflict_log with conflict_kind = 'dual_completion' so the
-- Sync Conflict Review screen can present it distinctly and resolution can
-- propagate to the other instance without re-conflicting.

ALTER TABLE sync_conflict_log ADD COLUMN IF NOT EXISTS conflict_kind TEXT;

CREATE INDEX IF NOT EXISTS idx_scl_kind_unresolved
  ON sync_conflict_log(conflict_kind, table_name, row_uuid, field_name)
  WHERE is_resolved = false;
