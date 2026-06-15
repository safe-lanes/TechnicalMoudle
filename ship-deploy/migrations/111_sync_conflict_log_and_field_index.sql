-- Migration 111: Per-field stale-skip index + sync_conflict_log table
--
-- Index: enables per-field lookup in the stale-skip guard (Option 2c).
-- Instead of comparing incoming log.changedAt against row.updated_at
-- (which mixes edits to ALL fields), we now check sync_field_log for
-- a newer receiver-side edit on the SAME field only.
--
-- Table: sync_conflict_log captures every true UPDATE-log conflict
-- (rejected because receiver has a newer same-field edit).
-- Lives on BOTH shore and ship.

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_sfl_field_changed
  ON sync_field_log(table_name, row_uuid, field_name, changed_at DESC);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sync_conflict_log (
  id SERIAL PRIMARY KEY,
  detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  batch_uuid TEXT,
  table_name TEXT NOT NULL,
  row_uuid TEXT NOT NULL,
  field_name TEXT NOT NULL,
  incoming_sender_instance TEXT,
  incoming_changed_at TIMESTAMP,
  incoming_old_value TEXT,
  incoming_new_value TEXT,
  receiver_winner_instance TEXT,
  receiver_winner_changed_at TIMESTAMP,
  receiver_current_value TEXT,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMP,
  resolved_by TEXT,
  resolved_action TEXT
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_scl_recent
  ON sync_conflict_log(detected_at DESC);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_scl_unresolved
  ON sync_conflict_log(is_resolved, detected_at DESC)
  WHERE is_resolved = false;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_scl_table_row
  ON sync_conflict_log(table_name, row_uuid, detected_at DESC);
