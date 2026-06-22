-- Migration 121: Approval Workflow Config
-- Creates the approval_workflow_config table and seeds all 20 rows.
-- Single hand-written migration — no Drizzle-generated companion needed.
-- All statements are idempotent.

CREATE TABLE IF NOT EXISTS approval_workflow_config (
  id              SERIAL PRIMARY KEY,
  awcuuid         TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  module_id       TEXT NOT NULL,
  sub_module_id   TEXT NOT NULL,
  function_id     TEXT NOT NULL,
  variable_name   TEXT NOT NULL,
  level1_enabled  BOOLEAN NOT NULL DEFAULT false,
  level2_enabled  BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted      BOOLEAN NOT NULL DEFAULT false,
  is_sync         BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT uq_approval_workflow_config UNIQUE (function_id, variable_name)
);

INSERT INTO approval_workflow_config
  (module_id, sub_module_id, function_id, variable_name, level1_enabled, level2_enabled)
VALUES
  ('pms', 'pms-components', 'pms-components-cr',   'Critical Equipment',       false, false),
  ('pms', 'pms-components', 'pms-components-cr',   'Normal Equipment',          false, false),
  ('pms', 'pms-jobs',       'pms-jobs-cr',          'Critical Jobs',            false, false),
  ('pms', 'pms-jobs',       'pms-jobs-cr',          'Critical Equipment Jobs',  false, false),
  ('pms', 'pms-jobs',       'pms-jobs-cr',          'Normal Jobs',              false, false),
  ('pms', 'pms-spares',     'pms-spares-cr',        'Critical Spares',          false, false),
  ('pms', 'pms-spares',     'pms-spares-cr',        'Normal Spares',            false, false),
  ('pms', 'pms-stores',     'pms-stores-cr',        'Store Items',              false, false),
  ('pms', 'pms-work-order', 'pms-wo-postponement',  'Critical WO',              false, false),
  ('pms', 'pms-work-order', 'pms-wo-postponement',  'Normal WO',                false, false),
  ('pms', 'pms-work-order', 'pms-wo-postponement',  'Critical Equipment WO',    false, false),
  ('defects', 'defects-extension',    'defects-extension',    'Critical Equipment Related', false, false),
  ('defects', 'defects-extension',    'defects-extension',    'COC Related',                false, false),
  ('defects', 'defects-extension',    'defects-extension',    'Normal Defects',             false, false),
  ('defects', 'defects-closure',      'defects-closure',      'Critical Equipment Related', false, false),
  ('defects', 'defects-closure',      'defects-closure',      'COC Related',                false, false),
  ('defects', 'defects-closure',      'defects-closure',      'Normal Defects',             false, false),
  ('defects', 'defects-verification', 'defects-verification', 'Critical Equipment Related', false, false),
  ('defects', 'defects-verification', 'defects-verification', 'COC Related',                false, false),
  ('defects', 'defects-verification', 'defects-verification', 'Normal Defects',             false, false)
ON CONFLICT (function_id, variable_name) DO NOTHING;
