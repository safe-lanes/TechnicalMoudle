-- 136: Repair spare_location_stock drift against legacy spares ROB columns.
--
-- Background: several write paths updated the legacy spares.rob_location_a/b
-- columns and the normalized spare_location_stock table non-atomically, and
-- performInventoryTransaction could auto-seed a duplicate stock row from the
-- legacy ROB while stock rows already existed elsewhere (double-count).
-- The legacy columns are the historically authoritative ledger (every write
-- path updated them); this migration re-derives spare_location_stock from them.
--
-- Idempotent: a second run changes zero rows.

-- 1) Remove stale stock rows pointing at locations that no longer match the
--    spare's configured location labels (these are the double-counted seeds).
--    Only applies when the spare has at least one configured location label.
DELETE FROM spare_location_stock sls
USING spares s, locations l
WHERE sls.spare_id = s.id
  AND sls.location_id = l.id
  AND (COALESCE(BTRIM(s.location), '') <> '' OR COALESCE(BTRIM(s.location_2), '') <> '')
  AND LOWER(BTRIM(l.location_name)) IS DISTINCT FROM LOWER(BTRIM(s.location))
  AND LOWER(BTRIM(l.location_name)) IS DISTINCT FROM LOWER(BTRIM(s.location_2));
--> statement-breakpoint

-- 2) Align qty for Location A rows with the legacy rob_location_a value.
UPDATE spare_location_stock sls
SET qty = GREATEST(0, COALESCE(s.rob_location_a, 0))
FROM spares s, locations l
WHERE sls.spare_id = s.id
  AND sls.location_id = l.id
  AND COALESCE(BTRIM(s.location), '') <> ''
  AND LOWER(BTRIM(l.location_name)) = LOWER(BTRIM(s.location))
  AND sls.qty IS DISTINCT FROM GREATEST(0, COALESCE(s.rob_location_a, 0));
--> statement-breakpoint

-- 3) Align qty for Location B rows with the legacy rob_location_b value.
--    (Skip rows already matched as Location A when both labels are identical.)
UPDATE spare_location_stock sls
SET qty = GREATEST(0, COALESCE(s.rob_location_b, 0))
FROM spares s, locations l
WHERE sls.spare_id = s.id
  AND sls.location_id = l.id
  AND COALESCE(BTRIM(s.location_2), '') <> ''
  AND LOWER(BTRIM(l.location_name)) = LOWER(BTRIM(s.location_2))
  AND LOWER(BTRIM(l.location_name)) IS DISTINCT FROM LOWER(BTRIM(s.location))
  AND sls.qty IS DISTINCT FROM GREATEST(0, COALESCE(s.rob_location_b, 0));
--> statement-breakpoint

-- 4) Keep the legacy rollup column consistent: rob = rob_location_a + rob_location_b
--    for spares that have location-level values but a stale total.
UPDATE spares s
SET rob = COALESCE(s.rob_location_a, 0) + COALESCE(s.rob_location_b, 0),
    updated_at = NOW()
WHERE (s.rob_location_a IS NOT NULL OR s.rob_location_b IS NOT NULL)
  AND COALESCE(s.rob, 0) IS DISTINCT FROM (COALESCE(s.rob_location_a, 0) + COALESCE(s.rob_location_b, 0));
