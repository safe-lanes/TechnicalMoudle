-- Migration 163: persist the vessel-specific Running Hours validation policy.
-- Validation is ON by default so existing vessels retain current behavior.
ALTER TABLE pms_vessel_settings
  ADD COLUMN IF NOT EXISTS rh_validation_enabled BOOLEAN NOT NULL DEFAULT true;