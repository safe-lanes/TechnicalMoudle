-- Migration 150: WO Re-Postponement
--
-- Adds request_type column to work_order_postponements and wo_postponement_approvals
-- to distinguish base Postponement records ('Postponement') from Re-Postponement
-- records ('Re-Postponement'). Backfills all existing rows with 'Postponement'.
-- Seeds the pms-wo-re-postponement approval workflow config rows.
--
-- DO NOT edit migrations/126_approval_workflow_config.sql for this purpose.
-- Migration 126 has already run on all existing databases and will never re-run.
-- New pms-wo-re-postponement rows must live here in migration 150.
--
-- All statements are idempotent (IF NOT EXISTS / WHERE IS NULL / ON CONFLICT DO NOTHING).

-- 1. Add request_type to postponements table
ALTER TABLE work_order_postponements
  ADD COLUMN IF NOT EXISTS request_type TEXT;

-- 2. Add request_type to approvals table
ALTER TABLE wo_postponement_approvals
  ADD COLUMN IF NOT EXISTS request_type TEXT;

-- 3. Backfill existing postponement rows (raw SQL — bypasses field logger intentionally)
UPDATE work_order_postponements
  SET request_type = 'Postponement'
  WHERE request_type IS NULL;

-- 4. Backfill existing approval rows (raw SQL — bypasses field logger intentionally)
UPDATE wo_postponement_approvals
  SET request_type = 'Postponement'
  WHERE request_type IS NULL;

-- 5. Seed pms-wo-re-postponement workflow config
--    Mirrors pms-wo-postponement rows in migration 126 (lines 35-37).
--    ON CONFLICT guard makes this safe to re-run.
INSERT INTO approval_workflow_config
  (module_id, sub_module_id, function_id, variable_name, level1_enabled, level2_enabled)
VALUES
  ('pms', 'pms-work-order', 'pms-wo-re-postponement', 'Normal WO',            false, false),
  ('pms', 'pms-work-order', 'pms-wo-re-postponement', 'Critical WO',           false, false),
  ('pms', 'pms-work-order', 'pms-wo-re-postponement', 'Critical Equipment WO', false, false)
ON CONFLICT (function_id, variable_name) DO NOTHING;
