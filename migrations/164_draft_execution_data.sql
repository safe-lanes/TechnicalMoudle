-- Migration 164: Draft execution data for Save as Draft (Task #402)
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
