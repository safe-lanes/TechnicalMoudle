-- FIX 55+56 — Backfill missing master records AND applicability rows from data.
--
-- Three-layer chain required for shore UI visibility:
--   1. Master record (ship_surveys_master / ship_certificates_master) — definition
--   2. Applicability (vessel_survey_applicability / vessel_certificate_applicability) — entry point
--   3. Data (vessel_survey_data / vessel_certificate_data) — actual values
--
-- When ship creates NEW surveys/certs, the data (layer 3) syncs via BOTH_EDITABLE.
-- But master records (layer 1) and applicability (layer 2) are ONE_WAY_SHORE_TO_SHIP,
-- so ship-created records never travel back. This migration backfills layers 1+2.
-- Idempotent via ON CONFLICT DO NOTHING.

-- ════════════════════════════════════════════════════════════════
-- STEP 1: Backfill missing MASTER records from data rows
-- ════════════════════════════════════════════════════════════════

-- Step 1a: ship_certificates_master placeholders
DO $$
DECLARE
  inserted_count INTEGER;
BEGIN
  INSERT INTO ship_certificates_master
    (sequence, master_id, certificate_name, category, "group",
     applicable_to_company, is_active, is_deleted, created_at, updated_at)
  SELECT DISTINCT
    COALESCE(NULLIF(SPLIT_PART(vcd.master_id, '-', 2), '')::int, 0),
    vcd.master_id,
    vcd.master_id,  -- placeholder name = master_id
    CASE
      WHEN vcd.master_id ~ '^[A-Z][0-9]+-' THEN LEFT(vcd.master_id, 1)
      ELSE SPLIT_PART(vcd.master_id, '-', 1)
    END,
    CASE
      WHEN vcd.master_id ~ '^[A-Z][0-9]+-' THEN SUBSTRING(vcd.master_id, 2, 1)
      ELSE ''
    END,
    false, true, false, NOW(), NOW()
  FROM vessel_certificate_data vcd
  WHERE vcd.is_deleted = false
    AND vcd.master_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM ship_certificates_master m WHERE m.master_id = vcd.master_id
    )
  ON CONFLICT (master_id) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE '[migration 114] Backfilled % certificate master placeholder(s).', inserted_count;
END $$;

-- Step 1b: ship_surveys_master placeholders
DO $$
DECLARE
  inserted_count INTEGER;
BEGIN
  INSERT INTO ship_surveys_master
    (sequence, master_id, survey_name, category, "group",
     applicable_to_company, is_active, is_deleted, created_at, updated_at)
  SELECT DISTINCT
    COALESCE(NULLIF(SPLIT_PART(vsd.master_id, '-', 2), '')::int, 0),
    vsd.master_id,
    vsd.master_id,  -- placeholder name = master_id
    CASE
      WHEN vsd.master_id ~ '^[A-Z][0-9]+-' THEN LEFT(vsd.master_id, 1)
      ELSE SPLIT_PART(vsd.master_id, '-', 1)
    END,
    CASE
      WHEN vsd.master_id ~ '^[A-Z][0-9]+-' THEN SUBSTRING(vsd.master_id, 2, 1)
      ELSE ''
    END,
    false, true, false, NOW(), NOW()
  FROM vessel_survey_data vsd
  WHERE vsd.is_deleted = false
    AND vsd.master_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM ship_surveys_master m WHERE m.master_id = vsd.master_id
    )
  ON CONFLICT (master_id) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE '[migration 114] Backfilled % survey master placeholder(s).', inserted_count;
END $$;

-- ════════════════════════════════════════════════════════════════
-- STEP 2: Backfill missing APPLICABILITY rows from data rows
-- ════════════════════════════════════════════════════════════════

-- Step 2a: vessel_certificate_applicability
DO $$
DECLARE
  inserted_count INTEGER;
BEGIN
  INSERT INTO vessel_certificate_applicability
    (vessel_id, vessel_name, master_id, is_applicable, is_deleted, created_at, updated_at)
  SELECT DISTINCT
    vcd.vessel_id,
    COALESCE(vcd.vessel_name, 'Unknown'),
    vcd.master_id,
    true, false, NOW(), NOW()
  FROM vessel_certificate_data vcd
  WHERE vcd.is_deleted = false
    AND vcd.vessel_id IS NOT NULL
    AND vcd.master_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM vessel_certificate_applicability vca
      WHERE vca.vessel_id = vcd.vessel_id AND vca.master_id = vcd.master_id AND vca.is_deleted = false
    )
  ON CONFLICT (vessel_id, master_id) WHERE is_deleted = false DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE '[migration 114] Backfilled % certificate applicability row(s).', inserted_count;
END $$;

-- Step 2b: vessel_survey_applicability
DO $$
DECLARE
  inserted_count INTEGER;
BEGIN
  INSERT INTO vessel_survey_applicability
    (vessel_id, vessel_name, master_id, is_applicable, is_deleted, created_at, updated_at)
  SELECT DISTINCT
    vsd.vessel_id,
    COALESCE(vsd.vessel_name, 'Unknown'),
    vsd.master_id,
    true, false, NOW(), NOW()
  FROM vessel_survey_data vsd
  WHERE vsd.is_deleted = false
    AND vsd.vessel_id IS NOT NULL
    AND vsd.master_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM vessel_survey_applicability vsa
      WHERE vsa.vessel_id = vsd.vessel_id AND vsa.master_id = vsd.master_id AND vsa.is_deleted = false
    )
  ON CONFLICT (vessel_id, master_id) WHERE is_deleted = false DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE '[migration 114] Backfilled % survey applicability row(s).', inserted_count;
END $$;
