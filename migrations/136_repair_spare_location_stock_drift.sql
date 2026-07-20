-- 136: Repair drift between legacy spares ROB columns and spare_location_stock.
--
-- Background: several write paths updated the legacy spares.rob_location_a/b
-- columns and the normalized spare_location_stock table non-atomically, and
-- performInventoryTransaction could auto-seed a duplicate stock row from the
-- legacy ROB while stock rows already existed (double-count, e.g. 2/8 vs 4/16).
--
-- Repair direction is decided PER SPARE using this database's own evidence:
--   * If the sum of spare_location_stock rows equals the most recent recorded
--     ROB-after value (latest of inventory_transactions.rob_total_after and
--     spares_history.rob_after), location stock is authoritative and the legacy
--     columns are re-derived from it (legacy <- location stock).
--   * Otherwise the legacy columns are authoritative (they are updated by every
--     ledgered write path) and location stock is re-derived from them
--     (update mismatched rows, insert missing rows, delete auto-seeded stale
--     rows that have no transaction evidence at that location).
--
-- Every corrected spares row is stamped updated_at = NOW() so the correction
-- propagates through ship<->shore sync. Idempotent: second run changes 0 rows.

-- 1) Evidence-matched spares: legacy <- location stock.
--    Location stock sum equals the latest recorded ROB-after, but the legacy
--    columns disagree -> re-derive legacy from location stock.
WITH latest_evidence AS (
  SELECT spare_id, rob_after FROM (
    SELECT spare_id, rob_after, ts,
           ROW_NUMBER() OVER (PARTITION BY spare_id ORDER BY ts DESC, src_id DESC) AS rn
    FROM (
      SELECT it.spare_id, it.rob_total_after AS rob_after, it.txn_datetime AS ts, it.id AS src_id
      FROM inventory_transactions it
      UNION ALL
      SELECT sh.spare_id, sh.rob_after, sh.timestamp_utc AS ts, sh.id AS src_id
      FROM spares_history sh
    ) u
  ) ranked WHERE rn = 1
),
sls_agg AS (
  SELECT sls.spare_id,
         SUM(sls.qty) AS total,
         COALESCE(SUM(sls.qty) FILTER (
           WHERE LOWER(BTRIM(l.location_name)) = LOWER(BTRIM(COALESCE(s.location, '')))
         ), 0) AS qty_a,
         COALESCE(SUM(sls.qty) FILTER (
           WHERE LOWER(BTRIM(l.location_name)) = LOWER(BTRIM(COALESCE(s.location_2, '')))
             AND LOWER(BTRIM(l.location_name)) IS DISTINCT FROM LOWER(BTRIM(COALESCE(s.location, '')))
         ), 0) AS qty_b
  FROM spare_location_stock sls
  JOIN locations l ON l.id = sls.location_id
  JOIN spares s ON s.id = sls.spare_id
  GROUP BY sls.spare_id
)
UPDATE spares s
SET rob = a.total,
    rob_location_a = a.qty_a,
    rob_location_b = a.qty_b,
    updated_at = NOW()
FROM sls_agg a
JOIN latest_evidence e ON e.spare_id = a.spare_id AND e.rob_after = a.total
WHERE s.id = a.spare_id
  AND (COALESCE(s.rob, 0) IS DISTINCT FROM a.total
    OR COALESCE(s.rob_location_a, 0) IS DISTINCT FROM a.qty_a
    OR COALESCE(s.rob_location_b, 0) IS DISTINCT FROM a.qty_b);
--> statement-breakpoint

-- 2) Stamp updated_at on every spare whose location-stock rows will be corrected
--    below (stale-delete, qty realign, or missing-row insert), so sls-only
--    corrections also propagate through sync. Runs BEFORE the fixes so the
--    mismatch predicates still hold; second run matches zero rows.
UPDATE spares s
SET updated_at = NOW()
WHERE (
  -- stale row at a location matching neither configured label, with no txn evidence there
  EXISTS (
    SELECT 1 FROM spare_location_stock sls
    JOIN locations l ON l.id = sls.location_id
    WHERE sls.spare_id = s.id
      AND (COALESCE(BTRIM(s.location), '') <> '' OR COALESCE(BTRIM(s.location_2), '') <> '')
      AND LOWER(BTRIM(l.location_name)) IS DISTINCT FROM LOWER(BTRIM(s.location))
      AND LOWER(BTRIM(l.location_name)) IS DISTINCT FROM LOWER(BTRIM(s.location_2))
      AND NOT EXISTS (
        SELECT 1 FROM inventory_transactions it
        WHERE it.spare_id = s.id AND it.location_id = sls.location_id
      )
  )
  -- qty mismatch at configured Location A
  OR EXISTS (
    SELECT 1 FROM spare_location_stock sls
    JOIN locations l ON l.id = sls.location_id
    WHERE sls.spare_id = s.id
      AND COALESCE(BTRIM(s.location), '') <> ''
      AND LOWER(BTRIM(l.location_name)) = LOWER(BTRIM(s.location))
      AND sls.qty IS DISTINCT FROM GREATEST(0, COALESCE(s.rob_location_a, 0))
  )
  -- qty mismatch at configured Location B
  OR EXISTS (
    SELECT 1 FROM spare_location_stock sls
    JOIN locations l ON l.id = sls.location_id
    WHERE sls.spare_id = s.id
      AND COALESCE(BTRIM(s.location_2), '') <> ''
      AND LOWER(BTRIM(l.location_name)) = LOWER(BTRIM(s.location_2))
      AND LOWER(BTRIM(l.location_name)) IS DISTINCT FROM LOWER(BTRIM(s.location))
      AND sls.qty IS DISTINCT FROM GREATEST(0, COALESCE(s.rob_location_b, 0))
  )
  -- missing row for configured Location A
  OR EXISTS (
    SELECT 1 FROM locations l
    WHERE COALESCE(BTRIM(s.location), '') <> ''
      AND l.vessel_id = s.vessel_id
      AND LOWER(BTRIM(l.location_name)) = LOWER(BTRIM(s.location))
      AND NOT EXISTS (
        SELECT 1 FROM spare_location_stock sls
        WHERE sls.spare_id = s.id AND sls.location_id = l.id
      )
  )
  -- missing row for configured Location B
  OR EXISTS (
    SELECT 1 FROM locations l
    WHERE COALESCE(BTRIM(s.location_2), '') <> ''
      AND l.vessel_id = s.vessel_id
      AND LOWER(BTRIM(l.location_name)) = LOWER(BTRIM(s.location_2))
      AND LOWER(BTRIM(l.location_name)) IS DISTINCT FROM LOWER(BTRIM(COALESCE(s.location, '')))
      AND NOT EXISTS (
        SELECT 1 FROM spare_location_stock sls
        WHERE sls.spare_id = s.id AND sls.location_id = l.id
      )
  )
);
--> statement-breakpoint

-- 3) Delete stale (auto-seeded) stock rows: location matches neither configured
--    label AND there is no inventory-transaction evidence at that location.
DELETE FROM spare_location_stock sls
USING spares s, locations l
WHERE sls.spare_id = s.id
  AND sls.location_id = l.id
  AND (COALESCE(BTRIM(s.location), '') <> '' OR COALESCE(BTRIM(s.location_2), '') <> '')
  AND LOWER(BTRIM(l.location_name)) IS DISTINCT FROM LOWER(BTRIM(s.location))
  AND LOWER(BTRIM(l.location_name)) IS DISTINCT FROM LOWER(BTRIM(s.location_2))
  AND NOT EXISTS (
    SELECT 1 FROM inventory_transactions it
    WHERE it.spare_id = s.id AND it.location_id = sls.location_id
  );
--> statement-breakpoint

-- 4) Align qty for Location A rows with the legacy rob_location_a value.
UPDATE spare_location_stock sls
SET qty = GREATEST(0, COALESCE(s.rob_location_a, 0)),
    updated_at = NOW()
FROM spares s, locations l
WHERE sls.spare_id = s.id
  AND sls.location_id = l.id
  AND COALESCE(BTRIM(s.location), '') <> ''
  AND LOWER(BTRIM(l.location_name)) = LOWER(BTRIM(s.location))
  AND sls.qty IS DISTINCT FROM GREATEST(0, COALESCE(s.rob_location_a, 0));
--> statement-breakpoint

-- 5) Align qty for Location B rows with the legacy rob_location_b value.
--    (Skip rows already matched as Location A when both labels are identical.)
UPDATE spare_location_stock sls
SET qty = GREATEST(0, COALESCE(s.rob_location_b, 0)),
    updated_at = NOW()
FROM spares s, locations l
WHERE sls.spare_id = s.id
  AND sls.location_id = l.id
  AND COALESCE(BTRIM(s.location_2), '') <> ''
  AND LOWER(BTRIM(l.location_name)) = LOWER(BTRIM(s.location_2))
  AND LOWER(BTRIM(l.location_name)) IS DISTINCT FROM LOWER(BTRIM(s.location))
  AND sls.qty IS DISTINCT FROM GREATEST(0, COALESCE(s.rob_location_b, 0));
--> statement-breakpoint

-- 6) Insert missing stock rows for configured Location A.
INSERT INTO spare_location_stock (vessel_id, spare_id, spare_uuid, location_id, qty)
SELECT s.vessel_id, s.id, s.suuid, l.id, GREATEST(0, COALESCE(s.rob_location_a, 0))
FROM spares s
JOIN locations l ON l.vessel_id = s.vessel_id
  AND LOWER(BTRIM(l.location_name)) = LOWER(BTRIM(s.location))
WHERE COALESCE(BTRIM(s.location), '') <> ''
ON CONFLICT (spare_id, location_id) DO NOTHING;
--> statement-breakpoint

-- 7) Insert missing stock rows for configured Location B.
INSERT INTO spare_location_stock (vessel_id, spare_id, spare_uuid, location_id, qty)
SELECT s.vessel_id, s.id, s.suuid, l.id, GREATEST(0, COALESCE(s.rob_location_b, 0))
FROM spares s
JOIN locations l ON l.vessel_id = s.vessel_id
  AND LOWER(BTRIM(l.location_name)) = LOWER(BTRIM(s.location_2))
WHERE COALESCE(BTRIM(s.location_2), '') <> ''
  AND LOWER(BTRIM(l.location_name)) IS DISTINCT FROM LOWER(BTRIM(COALESCE(s.location, '')))
ON CONFLICT (spare_id, location_id) DO NOTHING;
--> statement-breakpoint

-- 8) Keep the legacy rollup consistent: rob = rob_location_a + rob_location_b,
--    but only for spares whose entire stock lives at the configured locations
--    (spares with extra evidence-backed rows keep their stock-derived total).
UPDATE spares s
SET rob = COALESCE(s.rob_location_a, 0) + COALESCE(s.rob_location_b, 0),
    updated_at = NOW()
WHERE (s.rob_location_a IS NOT NULL OR s.rob_location_b IS NOT NULL)
  AND COALESCE(s.rob, 0) IS DISTINCT FROM (COALESCE(s.rob_location_a, 0) + COALESCE(s.rob_location_b, 0))
  AND NOT EXISTS (
    SELECT 1 FROM spare_location_stock sls
    JOIN locations l ON l.id = sls.location_id
    WHERE sls.spare_id = s.id
      AND LOWER(BTRIM(l.location_name)) IS DISTINCT FROM LOWER(BTRIM(COALESCE(s.location, '')))
      AND LOWER(BTRIM(l.location_name)) IS DISTINCT FROM LOWER(BTRIM(COALESCE(s.location_2, '')))
  );
