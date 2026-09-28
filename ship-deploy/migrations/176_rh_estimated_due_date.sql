ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS rh_estimated_due_date TEXT,
  ADD COLUMN IF NOT EXISTS rh_average_per_day NUMERIC(12, 6),
  ADD COLUMN IF NOT EXISTS rh_estimate_basis TEXT;