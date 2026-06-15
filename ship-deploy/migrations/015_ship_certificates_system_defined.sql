-- Add is_system_defined column to ship_certificates_master table
ALTER TABLE ship_certificates_master ADD COLUMN IF NOT EXISTS is_system_defined BOOLEAN NOT NULL DEFAULT false;

-- Mark the first 71 certificates as system-defined (one-time data migration)
UPDATE ship_certificates_master SET is_system_defined = true WHERE id <= 71;
