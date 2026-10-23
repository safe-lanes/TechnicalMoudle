-- Office Reviewer configuration is independent of the retired scalar rank field.
-- Intentionally no legacy backfill, conversion, dual-write, or status updates.
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS office_reviewer_role_ruids JSONB DEFAULT '[]'::jsonb;
