-- Apply the same write-path hardening to vessel_survey_data: only one row per
-- (vessel_id, master_id) should ever exist. Dedupe pre-existing duplicates by
-- keeping the most recently updated row, then enforce a unique index so the
-- read-then-insert pattern in surveyService.updateSurvey cannot race itself
-- and silently drop user edits.

DELETE FROM vessel_survey_data AS vsd
USING (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY vessel_id, master_id
        ORDER BY updated_at DESC NULLS LAST, id DESC
      ) AS rn
    FROM vessel_survey_data
  ) ranked
  WHERE ranked.rn > 1
) dup
WHERE vsd.id = dup.id;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_vessel_survey_data_vessel_master
  ON vessel_survey_data (vessel_id, master_id);
