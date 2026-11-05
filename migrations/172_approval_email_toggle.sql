-- 172: Approval email admin toggle (Ghazi, 04-Sep-2026). Per-tenant on/off switch for
-- approval EMAIL delivery (in-app notifications are unaffected), settable from the
-- Approval Engine admin screen without a restart or env change.
--
-- ⚠️ NOTE — company_approval_settings is IN ACTIVE USE. The table's original column
-- (superintendent_lock_enabled) was retired when the superintendent lock moved
-- per-vessel (pms_vessel_settings, migrations 163/168), but the table itself is NOT
-- dead: it is the per-tenant approval-settings singleton and now carries
-- approval_email_enabled. Do not clean it up.
--
-- DEFAULT TRUE = behaviour unchanged for anyone who never touches the toggle. A missing
-- row is read as ON by the application, so no seed row is required. Idempotent.

ALTER TABLE company_approval_settings
  ADD COLUMN IF NOT EXISTS approval_email_enabled BOOLEAN NOT NULL DEFAULT TRUE;
