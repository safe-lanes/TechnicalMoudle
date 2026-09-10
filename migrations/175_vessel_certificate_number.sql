-- Add the vessel-specific free-text certificate number.
-- Existing rows intentionally remain NULL until a user enters a value.
ALTER TABLE vessel_certificate_data
  ADD COLUMN IF NOT EXISTS certificate_number TEXT;