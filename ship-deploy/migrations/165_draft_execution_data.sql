-- Migration 165: Draft execution data for Save as Draft (Task #402)
--
-- NUMBERING: renumbered from the fork's 164 at merge time — 164 was already taken
-- by the Shipskart reconciler batch (164_reconciler_assignment_retry.sql) pushed to
-- replit_dev earlier the same day. 144 remains RESERVED; next free is 166.
--
-- "Save as Draft" previously PATCHed all Part-B fields into the live columns,
-- which (a) triggered the auto-promotion safeguard to 'Pending Approval' and
-- (b) shifted the computed tab (a non-null completion date computes Completed).
-- Drafts are now stashed in this single nullable JSONB column; the live
-- status/completion/RH/due columns are untouched until Submit, which promotes
-- the values through the existing workflow and clears this column.
--
-- Deploy to BOTH ship and office before relying on draft sync (older builds
-- skip unknown columns defensively).

ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS draft_execution_data JSONB;
