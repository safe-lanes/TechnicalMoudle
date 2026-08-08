-- READ-ONLY report (Task #394, legacy-baseline qualification):
-- Components whose RH stamp (rh_master_updated_at / last_updated) disagrees with the
-- audit-history-derived latest reading day — i.e. rows possibly poisoned with entry/sync
-- time from the old bug era. The runtime now baselines from audit history, so these rows
-- are informational only; no data change is made or required.
-- Run on shore and each ship: psql "$DATABASE_URL" -f scripts/rh_legacy_baseline_report.sql
WITH winner AS (
  SELECT DISTINCT ON (component_id)
         component_id,
         (CASE WHEN date_updated_local ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
               THEN substring(date_updated_local from 1 for 10)::date
               ELSE entered_at_utc::date END) AS reading_day,
         cumulative_rh, origin_side, rhauuid
    FROM running_hours_audit
   WHERE (is_deleted = false OR is_deleted IS NULL)
   ORDER BY component_id,
            (CASE WHEN date_updated_local ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
                  THEN substring(date_updated_local from 1 for 10)::date
                  ELSE entered_at_utc::date END) DESC,
            (CASE WHEN lower(origin_side) = 'ship' THEN 0 WHEN origin_side IS NULL OR origin_side = '' THEN 1 ELSE 2 END) ASC,
            entered_at_utc DESC, rhauuid DESC
)
SELECT c.vessel_id, c.component_code, c.name,
       c.rh_master_updated_at::date AS component_stamp_day,
       w.reading_day               AS audit_winner_day,
       c.current_cumulative_rh     AS component_rh,
       w.cumulative_rh             AS audit_winner_rh,
       (c.rh_master_updated_at::date - w.reading_day) AS stamp_vs_audit_days
  FROM components c
  JOIN winner w ON w.component_id = c.cuuid
 WHERE c.rh_counter_type = 'MASTER'
   AND (c.is_deleted = false OR c.is_deleted IS NULL)
   AND c.rh_master_updated_at IS NOT NULL
   AND c.rh_master_updated_at::date <> w.reading_day
 ORDER BY abs(c.rh_master_updated_at::date - w.reading_day) DESC, c.vessel_id, c.component_code;
