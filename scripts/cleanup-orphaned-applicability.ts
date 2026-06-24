/**
 * One-time cleanup for orphaned soft-deleted applicability rows.
 *
 * Background (task #101, follow-up to #99):
 *   `vessel_survey_applicability` accumulated soft-deleted rows from earlier
 *   write paths that left rows behind when masters were soft-deleted or when
 *   `applicable_to_company` was toggled off. The read paths already exclude
 *   them, but they bloat the table and distort admin row counts.
 *
 * Orphan criteria (only these soft-deleted rows are deleted):
 *   - the master row no longer exists, OR
 *   - the master row is itself soft-deleted (`is_deleted = true`), OR
 *   - the master is not flagged `applicable_to_company` AND its master_id
 *     does not start with `VES-`.
 *
 * Notes:
 *   - We deliberately do NOT treat `is_active = false` as an orphan signal.
 *     Inactive masters can be reactivated, and their historical applicability
 *     should be preserved in case that happens.
 *   - We deliberately do NOT touch any soft-deleted row whose master is
 *     still live and applicable_to_company / VES-* — same reasoning.
 *
 * Run with:
 *   npx tsx scripts/cleanup-orphaned-applicability.ts          # dry-run report
 *   npx tsx scripts/cleanup-orphaned-applicability.ts --apply  # actually delete
 */

import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const APPLY = process.argv.includes("--apply");

interface CountRow {
  live: number;
  soft_deleted: number;
  total: number;
}

interface BucketRow {
  bucket: string;
  rows: number;
  distinct_masters?: number;
  distinct_vessels?: number;
}

interface PerMasterRow {
  master_id: string;
  survey_name: string | null;
  m_deleted: boolean | null;
  m_active: boolean | null;
  m_appl_co: boolean | null;
  rows_soft_deleted: number;
  distinct_vessels: number;
}

interface PerVesselRow {
  vessel_id: string;
  vessel_name: string;
  rows_soft_deleted: number;
  distinct_masters: number;
}

interface DeletedRow {
  deleted_rows: number;
}

async function reportSurveyCounts(): Promise<CountRow> {
  const db = await getDb();
  const r = await db.execute<CountRow>(sql`
    SELECT
      COUNT(*) FILTER (WHERE is_deleted = false)::int AS live,
      COUNT(*) FILTER (WHERE is_deleted = true)::int  AS soft_deleted,
      COUNT(*)::int                                   AS total
    FROM vessel_survey_applicability;
  `);
  return r.rows[0];
}

async function reportCertCounts(): Promise<CountRow> {
  const db = await getDb();
  const r = await db.execute<CountRow>(sql`
    SELECT
      COUNT(*) FILTER (WHERE is_deleted = false)::int AS live,
      COUNT(*) FILTER (WHERE is_deleted = true)::int  AS soft_deleted,
      COUNT(*)::int                                   AS total
    FROM vessel_certificate_applicability;
  `);
  return r.rows[0];
}

async function bucketSurveys(): Promise<BucketRow[]> {
  const db = await getDb();
  const r = await db.execute<BucketRow>(sql`
    SELECT
      CASE
        WHEN m.master_id IS NULL THEN 'master_missing'
        WHEN m.is_deleted = true THEN 'master_soft_deleted'
        WHEN m.applicable_to_company = false AND m.master_id NOT LIKE 'VES-%'
          THEN 'master_not_applicable_to_company'
        WHEN m.is_active = false THEN 'master_inactive_kept'
        ELSE 'master_still_live_and_applicable_kept'
      END AS bucket,
      COUNT(*)::int AS rows,
      COUNT(DISTINCT a.master_id)::int AS distinct_masters,
      COUNT(DISTINCT a.vessel_id)::int AS distinct_vessels
    FROM vessel_survey_applicability a
    LEFT JOIN ship_surveys_master m ON m.master_id = a.master_id
    WHERE a.is_deleted = true
    GROUP BY bucket
    ORDER BY rows DESC;
  `);
  return r.rows;
}

async function bucketCerts(): Promise<BucketRow[]> {
  const db = await getDb();
  const r = await db.execute<BucketRow>(sql`
    SELECT
      CASE
        WHEN m.master_id IS NULL THEN 'master_missing'
        WHEN m.is_deleted = true THEN 'master_soft_deleted'
        WHEN m.applicable_to_company = false AND m.master_id NOT LIKE 'VES-%'
          THEN 'master_not_applicable_to_company'
        WHEN m.is_active = false THEN 'master_inactive_kept'
        ELSE 'master_still_live_and_applicable_kept'
      END AS bucket,
      COUNT(*)::int AS rows
    FROM vessel_certificate_applicability a
    LEFT JOIN ship_certificates_master m ON m.master_id = a.master_id
    WHERE a.is_deleted = true
    GROUP BY bucket
    ORDER BY rows DESC;
  `);
  return r.rows;
}

async function perMasterBreakdown(): Promise<PerMasterRow[]> {
  const db = await getDb();
  const r = await db.execute<PerMasterRow>(sql`
    SELECT
      a.master_id,
      m.survey_name,
      m.is_deleted             AS m_deleted,
      m.is_active              AS m_active,
      m.applicable_to_company  AS m_appl_co,
      COUNT(*)::int            AS rows_soft_deleted,
      COUNT(DISTINCT a.vessel_id)::int AS distinct_vessels
    FROM vessel_survey_applicability a
    LEFT JOIN ship_surveys_master m ON m.master_id = a.master_id
    WHERE a.is_deleted = true
    GROUP BY a.master_id, m.survey_name, m.is_deleted, m.is_active, m.applicable_to_company
    ORDER BY rows_soft_deleted DESC, a.master_id;
  `);
  return r.rows;
}

async function perVesselBreakdown(): Promise<PerVesselRow[]> {
  const db = await getDb();
  const r = await db.execute<PerVesselRow>(sql`
    SELECT
      a.vessel_id,
      a.vessel_name,
      COUNT(*)::int                     AS rows_soft_deleted,
      COUNT(DISTINCT a.master_id)::int  AS distinct_masters
    FROM vessel_survey_applicability a
    WHERE a.is_deleted = true
    GROUP BY a.vessel_id, a.vessel_name
    ORDER BY rows_soft_deleted DESC, a.vessel_name;
  `);
  return r.rows;
}

async function applyDelete(): Promise<DeletedRow> {
  const db = await getDb();
  const r = await db.execute<DeletedRow>(sql`
    WITH deleted AS (
      DELETE FROM vessel_survey_applicability a
      USING (
        SELECT a2.id
        FROM vessel_survey_applicability a2
        LEFT JOIN ship_surveys_master m ON m.master_id = a2.master_id
        WHERE a2.is_deleted = true
          AND (
            m.master_id IS NULL
            OR m.is_deleted = true
            OR (m.applicable_to_company = false AND m.master_id NOT LIKE 'VES-%')
          )
      ) victims
      WHERE a.id = victims.id
      RETURNING a.id
    )
    SELECT COUNT(*)::int AS deleted_rows FROM deleted;
  `);
  return r.rows[0];
}

async function main() {
  console.log("=== Applicability cleanup report ===\n");

  console.log("vessel_survey_applicability counts:", await reportSurveyCounts());
  console.log("vessel_certificate_applicability counts:", await reportCertCounts());

  console.log("\nvessel_survey_applicability soft-deleted buckets:");
  console.table(await bucketSurveys());

  console.log("\nvessel_certificate_applicability soft-deleted buckets:");
  console.table(await bucketCerts());

  console.log("\nvessel_survey_applicability soft-deleted by master_id:");
  console.table(await perMasterBreakdown());

  console.log("\nvessel_survey_applicability soft-deleted by vessel:");
  console.table(await perVesselBreakdown());

  if (!APPLY) {
    console.log("\nDry-run only. Re-run with --apply to hard-delete orphans.");
    return;
  }

  console.log("\nApplying delete...");
  console.log("Hard-deleted rows:", await applyDelete());

  console.log("\nPost-cleanup counts:");
  console.log("vessel_survey_applicability:", await reportSurveyCounts());
  console.log("vessel_certificate_applicability:", await reportCertCounts());
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
