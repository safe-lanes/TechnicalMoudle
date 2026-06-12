-- Task #240: WO Completion RH Reading Sync
-- Adds the double-sync guard column on work_orders. Stamped when a completion
-- running-hours reading has been applied (MASTER cascade or INHERITED cycle write)
-- so the same reading is not double-applied on re-save/replay.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS makes a re-run a clean no-op (matches the
-- 118_postpone_approval_columns precedent). Single statement; no breakpoint markers.
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS rh_synced_at TIMESTAMP;
