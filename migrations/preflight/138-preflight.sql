-- MIGRATION 138 PRE-FLIGHT — run on EACH shore tenant DB and EACH ship, BEFORE deploy.
-- Read-only. Tells you per-instance whether 138 will change anything and in which direction.
--
-- 138's design: spares.location/location_2 + rob_location_a/b are the AUTHORITY;
-- spare_location_stock (SLS) is the projection rebuilt from them (statements 4-7).
-- Statement 1 is the ONE exception: it reverses the direction (SLS -> spares) when a
-- ROB transaction/history record corroborates the SLS total.
-- So the question per row is: do a/b and SLS disagree, and is there evidence to arbitrate?
WITH ev AS (
  SELECT spare_id, rob_after FROM (
    SELECT spare_id, rob_after, ts, ROW_NUMBER() OVER (PARTITION BY spare_id ORDER BY ts DESC, src_id DESC) rn
    FROM (
      SELECT it.spare_id, it.rob_total_after AS rob_after, it.txn_datetime AS ts, it.id AS src_id
        FROM inventory_transactions it
      UNION ALL
      SELECT sh.spare_id, sh.rob_after, sh.timestamp_utc AS ts, sh.id AS src_id
        FROM spares_history sh
    ) u
  ) r WHERE rn = 1
),
sls AS (
  SELECT sls.spare_id,
         SUM(sls.qty) AS total,
         COALESCE(SUM(sls.qty) FILTER (
           WHERE LOWER(BTRIM(l.location_name)) = LOWER(BTRIM(COALESCE(s.location,'')))), 0) AS sls_a,
         COALESCE(SUM(sls.qty) FILTER (
           WHERE LOWER(BTRIM(l.location_name)) = LOWER(BTRIM(COALESCE(s.location_2,'')))
             AND LOWER(BTRIM(l.location_name)) IS DISTINCT FROM LOWER(BTRIM(COALESCE(s.location,'')))), 0) AS sls_b
    FROM spare_location_stock sls
    JOIN locations l ON l.id = sls.location_id
    JOIN spares s    ON s.id = sls.spare_id
   GROUP BY sls.spare_id
)
SELECT
  s.vessel_id,
  count(*) FILTER (WHERE d.disagrees)                                    AS rows_disagreeing,
  count(*) FILTER (WHERE d.disagrees AND d.has_evidence AND d.ev_matches_sls) AS "will_fix_spares_FROM_sls",
  count(*) FILTER (WHERE d.disagrees AND NOT (d.has_evidence AND d.ev_matches_sls)) AS "will_overwrite_sls_FROM_spares",
  count(*) FILTER (WHERE d.disagrees AND NOT d.has_evidence)             AS "  of_those_NO_evidence_at_all",
  count(*) FILTER (WHERE d.disagrees AND NOT (d.has_evidence AND d.ev_matches_sls)
                     AND (COALESCE(s.rob_location_a,0)+COALESCE(s.rob_location_b,0)) < a.total)
                                                                        AS "  ⚠_of_those_REDUCING_stock",
  count(*)                                                              AS total_spares_with_sls
FROM spares s
JOIN sls a ON a.spare_id = s.id
LEFT JOIN ev e ON e.spare_id = s.id
CROSS JOIN LATERAL (
  SELECT (COALESCE(s.rob_location_a,0) IS DISTINCT FROM a.sls_a
       OR COALESCE(s.rob_location_b,0) IS DISTINCT FROM a.sls_b) AS disagrees,
         (e.spare_id IS NOT NULL)                                AS has_evidence,
         (e.rob_after = a.total)                                 AS ev_matches_sls
) d
GROUP BY s.vessel_id
ORDER BY rows_disagreeing DESC;
