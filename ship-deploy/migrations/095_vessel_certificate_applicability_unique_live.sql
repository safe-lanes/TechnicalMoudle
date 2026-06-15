-- Mirrors migration 093 for the certificate side. Dedupe duplicate live rows in
-- vessel_certificate_applicability and add a partial unique index so only one
-- live row per (vessel_id, master_id) can exist going forward. Soft-deleted
-- rows are intentionally untouched.

-- Step 1: keep only the most-recently-updated live row per (vessel_id, master_id).
DELETE FROM vessel_certificate_applicability AS vca
USING (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY vessel_id, master_id
        ORDER BY updated_at DESC NULLS LAST, id DESC
      ) AS rn
    FROM vessel_certificate_applicability
    WHERE is_deleted = false OR is_deleted IS NULL
  ) ranked
  WHERE ranked.rn > 1
) dup
WHERE vca.id = dup.id;

-- Step 2: enforce uniqueness on live rows only.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_vessel_certificate_applicability_live
  ON vessel_certificate_applicability (vessel_id, master_id)
  WHERE is_deleted = false;
