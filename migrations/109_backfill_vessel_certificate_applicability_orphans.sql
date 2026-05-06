-- Backfill missing vessel_certificate_applicability rows that were lost when
-- migration 095's partial unique index was absent on the deployed ship.
--
-- Failure mode (root cause #133): every insertApplicability / insertApplicabilityBulk
-- call uses ON CONFLICT (vessel_id, master_id) WHERE is_deleted = false. Without
-- uniq_vessel_certificate_applicability_live the INSERT raises 42P10 and the
-- whole save fails. saveMasterCertificates' fan-out loop therefore left
-- ship_certificates_master rows with applicableToCompany = true (or CMP-* / VES-*)
-- without their per-vessel applicability records. This file repopulates them.
--
-- Idempotent via ON CONFLICT DO NOTHING (now that the unique index exists,
-- guaranteed by migration 095 + ensureCertApplicabilityIndex startup invariant).

-- Step 1: company-applicable masters (applicableToCompany = true OR masterId LIKE 'CMP-%')
-- get a row for every active vessel.
INSERT INTO vessel_certificate_applicability
  (vessel_id, vessel_name, master_id, is_applicable, is_deleted, created_at, updated_at)
SELECT
  v.vuuid,
  v.name,
  m.master_id,
  true,
  false,
  NOW(),
  NOW()
FROM ship_certificates_master m
CROSS JOIN vessels v
WHERE m.is_deleted = false
  AND m.is_active = true
  AND v.is_active = true
  AND (m.applicable_to_company = true OR m.master_id LIKE 'CMP-%')
  AND NOT EXISTS (
    SELECT 1
    FROM vessel_certificate_applicability vca
    WHERE vca.vessel_id = v.vuuid
      AND vca.master_id = m.master_id
      AND (vca.is_deleted = false OR vca.is_deleted IS NULL)
  )
ON CONFLICT (vessel_id, master_id) WHERE is_deleted = false DO NOTHING;

-- Step 2: log VES-* (vessel-specific) masters that have no applicability rows at all.
-- These were created with targetVessels at the time, so we cannot CROSS JOIN safely
-- (would over-assign to vessels they were never meant for). They must be reconciled
-- by an operator via the Vessel tab.
DO $$
DECLARE
  orphan_count INTEGER;
  orphan_list TEXT;
BEGIN
  SELECT COUNT(*), STRING_AGG(master_id, ', ' ORDER BY master_id)
  INTO orphan_count, orphan_list
  FROM ship_certificates_master m
  WHERE m.is_deleted = false
    AND m.is_active = true
    AND m.master_id LIKE 'VES-%'
    AND NOT EXISTS (
      SELECT 1
      FROM vessel_certificate_applicability vca
      WHERE vca.master_id = m.master_id
        AND (vca.is_deleted = false OR vca.is_deleted IS NULL)
    );

  IF orphan_count > 0 THEN
    RAISE NOTICE '[migration 109] % vessel-specific (VES-*) masters have no applicability rows and need manual reassignment via Admin → Ship Certificates → Vessel tab: %',
      orphan_count, orphan_list;
  ELSE
    RAISE NOTICE '[migration 109] No VES-* orphans detected.';
  END IF;
END $$;
