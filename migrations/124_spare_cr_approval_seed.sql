-- Seed default approval_workflow_config rows for pms-spares-cr
-- These two rows define the Critical Spares and Normal Spares approval tiers.
-- Both levels are off by default; admins enable them via the Approval Workflow UI.
-- Safe to re-run: ON CONFLICT on the (function_id, variable_name) unique constraint.

INSERT INTO approval_workflow_config
  (module_id, sub_module_id, function_id, variable_name, level1_enabled, level2_enabled, is_deleted, is_sync)
VALUES
  ('pms', 'pms-spares', 'pms-spares-cr', 'Critical Spares', false, false, false, false),
  ('pms', 'pms-spares', 'pms-spares-cr', 'Normal Spares',   false, false, false, false)
ON CONFLICT (function_id, variable_name) DO NOTHING;
