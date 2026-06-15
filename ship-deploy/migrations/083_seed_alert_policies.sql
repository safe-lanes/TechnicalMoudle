-- Migration 083: Seed PMS Alert Policies (Wave 1)
-- Three use cases: overdue jobs, low critical spares, skipped cycles
-- Idempotent: uses ON CONFLICT DO NOTHING on apuuid

INSERT INTO alert_policies (
  apuuid, alert_type, enabled, priority,
  email_enabled, in_app_enabled,
  thresholds, scope_filters, recipients,
  created_by, updated_by
) VALUES
-- UC1: Critical Job Overdue
(
  'policy-critical-job-overdue',
  'critical_job_overdue',
  true,
  'high',
  false, true,
  '{"overdueDays": 0}',
  '{"jobPriority": ["Critical", "High"], "componentCritical": true}',
  '{"roles": ["Ship", "Office", "PMS Admin", "Sail Admin", "Super Admin", "Vessel Admin"]}',
  'system', 'system'
),
-- UC2: Low Critical Spares
(
  'policy-low-critical-spares',
  'low_critical_spares',
  true,
  'medium',
  false, true,
  '{"robBelowMin": true}',
  '{"spareCritical": ["Critical", "Yes"]}',
  '{"roles": ["Ship", "Office", "PMS Admin", "Sail Admin", "Super Admin", "Vessel Admin"]}',
  'system', 'system'
),
-- UC3: Critical Job Cycle Skipped
(
  'policy-critical-job-cycle-skipped',
  'critical_job_cycle_skipped',
  true,
  'high',
  false, true,
  '{"missedCyclesMin": 1}',
  '{"jobPriority": ["Critical", "High"], "componentCritical": true}',
  '{"roles": ["Ship", "Office", "PMS Admin", "Sail Admin", "Super Admin", "Vessel Admin"]}',
  'system', 'system'
)
ON CONFLICT (apuuid) DO NOTHING;
