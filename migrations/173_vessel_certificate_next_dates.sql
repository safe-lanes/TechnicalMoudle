-- Add vessel-specific next annual and next interim certificate dates.
-- Existing rows intentionally remain NULL until a user enters a value.
ALTER TABLE vessel_certificate_data
  ADD COLUMN IF NOT EXISTS next_annual TEXT,
  ADD COLUMN IF NOT EXISTS next_interm TEXT;