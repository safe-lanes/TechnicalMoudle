-- Migration 125: Seed Defect + Certificate/Survey Alert Policies (Wave 2 MVP)
-- Renumbered 121 → 125: migration numbers 121-124 are reserved by the audit-identity branch.
-- Safe to re-run under the new number — this file is INSERT-only with WHERE NOT EXISTS per
-- alert_type (no DDL), so on a DB where the old 121 already applied it produces zero rows.
-- Seven new READ-ONLY alert types, all seeded DISABLED (enabled=false) so they
-- are opt-in. Recipients default to all six roles. Does NOT touch UC1-3 or
-- sync_conflict.
--
-- Idempotent: each row inserts only WHERE NOT EXISTS a policy with the same
-- alert_type. Re-running produces zero new rows, zero errors.

-- certificate_expiration — "Certificate Expiring Soon" (tiered 90/30 days)
INSERT INTO alert_policies (
  apuuid, alert_type, enabled, priority, email_enabled, in_app_enabled,
  thresholds, scope_filters, recipients, created_by, updated_by
)
SELECT
  'policy-certificate-expiration', 'certificate_expiration', false, 'medium', false, true,
  '{"leadDaysTiers": [90, 30], "highAtDays": 30}', '{}',
  '{"roles": ["Ship", "Office", "PMS Admin", "Sail Admin", "Super Admin", "Vessel Admin"]}',
  'system', 'system'
WHERE NOT EXISTS (SELECT 1 FROM alert_policies WHERE alert_type = 'certificate_expiration');

-- certificate_expired — "Certificate Expired"
INSERT INTO alert_policies (
  apuuid, alert_type, enabled, priority, email_enabled, in_app_enabled,
  thresholds, scope_filters, recipients, created_by, updated_by
)
SELECT
  'policy-certificate-expired', 'certificate_expired', false, 'high', false, true,
  '{}', '{}',
  '{"roles": ["Ship", "Office", "PMS Admin", "Sail Admin", "Super Admin", "Vessel Admin"]}',
  'system', 'system'
WHERE NOT EXISTS (SELECT 1 FROM alert_policies WHERE alert_type = 'certificate_expired');

-- survey_due_soon — "Survey Due Soon"
INSERT INTO alert_policies (
  apuuid, alert_type, enabled, priority, email_enabled, in_app_enabled,
  thresholds, scope_filters, recipients, created_by, updated_by
)
SELECT
  'policy-survey-due-soon', 'survey_due_soon', false, 'medium', false, true,
  '{"leadDays": 30}', '{}',
  '{"roles": ["Ship", "Office", "PMS Admin", "Sail Admin", "Super Admin", "Vessel Admin"]}',
  'system', 'system'
WHERE NOT EXISTS (SELECT 1 FROM alert_policies WHERE alert_type = 'survey_due_soon');

-- survey_window_closing — "Survey Window Closing"
INSERT INTO alert_policies (
  apuuid, alert_type, enabled, priority, email_enabled, in_app_enabled,
  thresholds, scope_filters, recipients, created_by, updated_by
)
SELECT
  'policy-survey-window-closing', 'survey_window_closing', false, 'high', false, true,
  '{"leadDays": 30}', '{}',
  '{"roles": ["Ship", "Office", "PMS Admin", "Sail Admin", "Super Admin", "Vessel Admin"]}',
  'system', 'system'
WHERE NOT EXISTS (SELECT 1 FROM alert_policies WHERE alert_type = 'survey_window_closing');

-- survey_overdue — "Survey Overdue"
INSERT INTO alert_policies (
  apuuid, alert_type, enabled, priority, email_enabled, in_app_enabled,
  thresholds, scope_filters, recipients, created_by, updated_by
)
SELECT
  'policy-survey-overdue', 'survey_overdue', false, 'high', false, true,
  '{}', '{}',
  '{"roles": ["Ship", "Office", "PMS Admin", "Sail Admin", "Super Admin", "Vessel Admin"]}',
  'system', 'system'
WHERE NOT EXISTS (SELECT 1 FROM alert_policies WHERE alert_type = 'survey_overdue');

-- defect_overdue — "Defect Overdue"
INSERT INTO alert_policies (
  apuuid, alert_type, enabled, priority, email_enabled, in_app_enabled,
  thresholds, scope_filters, recipients, created_by, updated_by
)
SELECT
  'policy-defect-overdue', 'defect_overdue', false, 'high', false, true,
  '{}', '{}',
  '{"roles": ["Ship", "Office", "PMS Admin", "Sail Admin", "Super Admin", "Vessel Admin"]}',
  'system', 'system'
WHERE NOT EXISTS (SELECT 1 FROM alert_policies WHERE alert_type = 'defect_overdue');

-- defect_coc — "COC / Class Defect"
INSERT INTO alert_policies (
  apuuid, alert_type, enabled, priority, email_enabled, in_app_enabled,
  thresholds, scope_filters, recipients, created_by, updated_by
)
SELECT
  'policy-defect-coc', 'defect_coc', false, 'high', false, true,
  '{}', '{}',
  '{"roles": ["Ship", "Office", "PMS Admin", "Sail Admin", "Super Admin", "Vessel Admin"]}',
  'system', 'system'
WHERE NOT EXISTS (SELECT 1 FROM alert_policies WHERE alert_type = 'defect_coc');
