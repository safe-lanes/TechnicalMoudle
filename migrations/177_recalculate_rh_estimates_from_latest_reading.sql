-- Recalculate existing RH planning estimates with the latest-reading model.
-- Startup backfill repopulates these fields after migrations complete.
UPDATE jobs
SET rh_estimated_due_date = NULL,
    rh_average_per_day = NULL,
    rh_estimate_basis = NULL,
    updated_at = NOW()
WHERE maintenance_basis IN ('Running Hours', 'Dual Frequency')
  AND (
    rh_estimated_due_date IS NOT NULL
    OR rh_average_per_day IS NOT NULL
    OR rh_estimate_basis IS NOT NULL
  );