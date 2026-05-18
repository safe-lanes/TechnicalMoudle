-- Migration: Add renewal/replacement tracking columns to running_hours_audit table
-- Date: 16-01-2026 (retroactive fix for columns added to schema but not properly migrated)

-- Renewal/Replacement fields (populated when RH is reset to 0)
ALTER TABLE running_hours_audit ADD COLUMN IF NOT EXISTS is_renewal_reset BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE running_hours_audit ADD COLUMN IF NOT EXISTS renewal_action_type TEXT;
ALTER TABLE running_hours_audit ADD COLUMN IF NOT EXISTS renewal_reason TEXT;
ALTER TABLE running_hours_audit ADD COLUMN IF NOT EXISTS renewal_reference TEXT;
ALTER TABLE running_hours_audit ADD COLUMN IF NOT EXISTS renewal_evidence_urls JSON;

-- Component identification fields for reporting
ALTER TABLE running_hours_audit ADD COLUMN IF NOT EXISTS component_code TEXT;
ALTER TABLE running_hours_audit ADD COLUMN IF NOT EXISTS component_name TEXT;

-- Create index for efficient querying of renewal resets by vessel
CREATE INDEX IF NOT EXISTS idx_renewal_reset ON running_hours_audit (is_renewal_reset, vessel_id);
