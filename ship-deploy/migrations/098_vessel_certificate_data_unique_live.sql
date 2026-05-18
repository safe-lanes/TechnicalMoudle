-- Apply the same write-path hardening to vessel_certificate_data. The read
-- and update paths already filter is_deleted = false OR NULL, so live-row
-- semantics are the source of truth. Normalize NULL is_deleted to false so
-- the partial unique index covers every live row, then dedupe pre-existing
-- live duplicates and enforce uniqueness on (vessel_id, master_id) for live
-- rows only. This prevents the read-then-insert pattern in
-- certificateService.updateCertificate from silently creating duplicate live
-- rows under a race.

UPDATE vessel_certificate_data SET is_deleted = false WHERE is_deleted IS NULL;
ALTER TABLE vessel_certificate_data ALTER COLUMN is_deleted SET DEFAULT false;
ALTER TABLE vessel_certificate_data ALTER COLUMN is_deleted SET NOT NULL;

DELETE FROM vessel_certificate_data AS vcd
USING (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY vessel_id, master_id
        ORDER BY updated_at DESC NULLS LAST, id DESC
      ) AS rn
    FROM vessel_certificate_data
    WHERE is_deleted = false
  ) ranked
  WHERE ranked.rn > 1
) dup
WHERE vcd.id = dup.id;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_vessel_certificate_data_live
  ON vessel_certificate_data (vessel_id, master_id)
  WHERE is_deleted = false;
