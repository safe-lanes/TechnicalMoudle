-- Running Hours bulk correction — vessel b89759ad-378b-4cec-af80-9cafd44853c9
  -- Source: components_export_2026-07-15 (33 MASTER components; 248 INHERITED updated via cascade)
  -- Replicates the app's updateMasterRunningHours() transaction exactly.
  -- Run in ONE transaction. Verify the sanity check (must return 33) before COMMIT.

  BEGIN;

  -- 1. Staging: the 33 masters from the sheet
  CREATE TEMP TABLE rh_upd(component_code text, new_rh numeric, reading_date timestamptz) ON COMMIT DROP;
  INSERT INTO rh_upd(component_code, new_rh, reading_date) VALUES
    ('355001003', 42033.00, '2026-05-31'),
  ('355001004', 49268.00, '2026-05-31'),
  ('445001001', 0.00, '2020-01-01'),
  ('582011001', 0.00, '2020-01-01'),
  ('601001001', 125646.90, '2026-05-31'),
  ('652001001', 90497.40, '2026-05-31'),
  ('665003001', 0.00, '2020-01-01'),
  ('702005002', 0.00, '2020-01-01'),
  ('702030001', 0.00, '2020-01-01'),
  ('731001002', 11214.00, '2026-05-31'),
  ('801061000', 0.00, '2020-01-01'),
  ('803025001', 0.00, '2020-01-01'),
  ('411001004', 0.00, '2020-01-01'),
  ('571020002', 0.00, '2020-01-01'),
  ('651047001', 0.00, '2020-01-01'),
  ('652047001', 0.00, '2020-01-01'),
  ('653047001', 0.00, '2020-01-01'),
  ('702005001', 0.00, '2020-01-01'),
  ('761001001', 0.00, '2020-01-01'),
  ('731001051', 0.00, '2020-01-01'),
  ('582017001', 0.00, '2020-01-01'),
  ('712011001', 0.00, '2020-01-01'),
  ('712011002', 0.00, '2020-01-01'),
  ('355001002', 51617.00, '2026-05-31'),
  ('411001001', 0.00, '2020-01-01'),
  ('813031001', 0.00, '2020-01-01'),
  ('355001001', 43477.00, '2026-05-31'),
  ('651001001', 93232.00, '2026-05-31'),
  ('653001001', 91606.00, '2026-05-31'),
  ('731001001', 47403.00, '2026-05-31'),
  ('571020001', 0.00, '2020-01-01'),
  ('571025001', 0.00, '2020-01-01'),
  ('582011002', 0.00, '2020-01-01');

  -- 2. Snapshot old values + deltas BEFORE mutating
  CREATE TEMP TABLE rh_delta ON COMMIT DROP AS
  SELECT c.cuuid AS master_cuuid, c.component_code, c.name,
         COALESCE(c.rh_current_master, c.current_cumulative_rh, '0')::numeric AS old_rh,
         u.new_rh, u.reading_date,
         u.new_rh - COALESCE(c.rh_current_master, c.current_cumulative_rh, '0')::numeric AS delta
  FROM components c
  JOIN rh_upd u ON u.component_code = c.component_code
  WHERE c.vessel_id = 'b89759ad-378b-4cec-af80-9cafd44853c9'
    AND c.rh_counter_type = 'MASTER'
    AND c.is_deleted = false;

  -- SANITY CHECK: must return 33. If not, ROLLBACK and investigate.
  SELECT count(*) AS matched_masters FROM rh_delta;

  -- Optional review before committing:
  -- SELECT component_code, name, old_rh, new_rh, delta FROM rh_delta ORDER BY component_code;

  -- 3. Update MASTER components
  UPDATE components c SET
    rh_current_master        = d.new_rh::text,
    current_cumulative_rh    = d.new_rh::text,
    rh_master_updated_at     = d.reading_date,
    rh_master_updated_by     = 'DB_CORRECTION',
    rh_master_update_source  = 'IMPORT',
    last_updated             = to_char(d.reading_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  FROM rh_delta d
  WHERE c.cuuid = d.master_cuuid;

  -- 4. Cascade to INHERITED children (delta-based, floored at 0 — exactly like the app)
  UPDATE components ch SET
    rh_current_inherited_cached = d.new_rh::text,
    current_cumulative_rh = GREATEST(0, COALESCE(ch.current_cumulative_rh, ch.rh_current_inherited_cached, '0')::numeric + d.delta)::text,
    rh_inherited_updated_at = d.reading_date,
    last_updated = to_char(d.reading_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  FROM rh_delta d
  WHERE ch.rh_master_component_id = d.master_cuuid
    AND ch.vessel_id = 'b89759ad-378b-4cec-af80-9cafd44853c9'
    AND ch.rh_counter_type = 'INHERITED'
    AND ch.is_deleted = false;

  -- 5. Audit history: one row per MASTER
  INSERT INTO running_hours_audit
    (vessel_id, component_id, previous_rh, new_rh, cumulative_rh,
     date_updated_local, date_updated_tz, entered_at_utc, user_id, actor_label,
     source, notes, meter_replaced, version, component_code, component_name)
  SELECT 'b89759ad-378b-4cec-af80-9cafd44853c9', d.master_cuuid,
         d.old_rh, d.new_rh, d.new_rh,
         to_char(d.reading_date, 'YYYY-MM-DD'), 'UTC', NOW(), 'DB_CORRECTION', 'DB Correction',
         'import', 'Bulk correction from components_export_2026-07-15 sheet',
         false, 1, d.component_code, d.name
  FROM rh_delta d;

  -- 6. Audit history: one row per INHERITED child (runs AFTER step 4, so the
  --    previous value is reconstructed by subtracting the delta)
  INSERT INTO running_hours_audit
    (vessel_id, component_id, previous_rh, new_rh, cumulative_rh,
     date_updated_local, date_updated_tz, entered_at_utc, user_id, actor_label,
     source, notes, meter_replaced, version, component_code, component_name)
  SELECT ch.vessel_id, ch.cuuid,
         GREATEST(0, ch.current_cumulative_rh::numeric - d.delta),
         ch.current_cumulative_rh::numeric, ch.current_cumulative_rh::numeric,
         to_char(d.reading_date, 'YYYY-MM-DD'), 'UTC', NOW(), 'DB_CORRECTION', 'DB Correction',
         'import', 'Cascade from master ' || d.component_code || ' (DB correction)',
         false, 1, ch.component_code, ch.name
  FROM components ch
  JOIN rh_delta d ON ch.rh_master_component_id = d.master_cuuid
  WHERE ch.vessel_id = 'b89759ad-378b-4cec-af80-9cafd44853c9'
    AND ch.rh_counter_type = 'INHERITED'
    AND ch.is_deleted = false;

  -- Final verification before COMMIT (expect 33 masters, ~248 children):
  -- SELECT rh_counter_type, count(*) FROM components
  --   WHERE vessel_id = 'b89759ad-378b-4cec-af80-9cafd44853c9' AND last_updated LIKE '2026-05-31%' GROUP BY 1;

  COMMIT;
  