-- Persist the result of applying a Work Order completion reading to live RH.
-- Lower readings may be retained on the approved WO without reducing live RH.
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS rh_update_outcome TEXT,
  ADD COLUMN IF NOT EXISTS rh_skip_reason TEXT,
  ADD COLUMN IF NOT EXISTS rh_skip_submitted_rh DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS rh_skip_latest_rh DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS rh_skip_latest_rh_date TEXT;