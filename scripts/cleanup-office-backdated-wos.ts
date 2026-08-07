/**
 * CLEANUP: office-generated back-dated "phantom" work orders (2026-08 incident).
 *
 * The shore daily sweep generated hundreds of months-overdue WOs from stale office job
 * records (ship completions never updated shore jobs). This script archives (soft-deletes)
 * those phantom rows — SAFELY.
 *
 * Usage:
 *   npx tsx scripts/cleanup-office-backdated-wos.ts --vessel <vesselId>            # DRY RUN (default)
 *   npx tsx scripts/cleanup-office-backdated-wos.ts --vessel <vesselId> --apply    # archive
 *   Optional: --max-sync-age-hours 48   (freshness requirement for --apply, default 48)
 *
 * A WO is a CANDIDATE only when ALL hold:
 *  1. ORIGIN POSITIVELY OFFICE — generated_by_instance is a shore id, or (for pre-marker
 *     rows) the earliest INSERT-origin sync_field_log row's instance_id is a NON-ship id.
 *     Origin-unknown rows are NEVER touched.
 *  2. SYSTEM-GENERATED & UNTOUCHED — status still 'Active', linked to a job, no
 *     completion evidence (date_completed / wo_completion_rh / completion_rh all NULL),
 *     not already archived.
 *  3. STALE CYCLE — the WO's due (calendar due_date, or RH next_due_reading) is OLDER
 *     than the linked job's CURRENT next due (the job has since advanced past it).
 *  4. NO CHILD RECORDS — any child rows (documents, executions, postponements, approvals,
 *     notifications, anomalies, IHM logs, maintenance history) → the WO goes to the
 *     MANUAL REVIEW list instead of being archived.
 *
 * Apply mode additionally requires the vessel to have synced recently
 * (sync_metadata.last_sync_at within --max-sync-age-hours), re-validates every candidate
 * INSIDE the archive transaction (crew may have touched it since the scan), and is
 * idempotent — a second run archives nothing.
 */
import { getPool } from '../server/db';
import { parseWorkOrderDate } from '../shared/workOrders/dateParse';

const CHILD_TABLES: Array<{ table: string; fkColumn: string }> = [
  { table: 'work_order_documents', fkColumn: 'work_order_id' },
  { table: 'work_order_executions', fkColumn: 'template_id' },
  { table: 'work_order_execution_details', fkColumn: 'work_order_id' },
  { table: 'work_order_postponements', fkColumn: 'work_order_id' },
  { table: 'superintendent_notifications', fkColumn: 'work_order_id' },
  { table: 'wo_postponement_approvals', fkColumn: 'work_order_id' },
  { table: 'work_order_anomalies', fkColumn: 'work_order_id' },
  { table: 'ihm_maintenance_log', fkColumn: 'work_order_id' },
  { table: 'component_maintenance_history', fkColumn: 'work_order_id' },
];

const UNTOUCHED_SQL = `
      wo.is_deleted = false
  AND wo.status = 'Active'
  AND wo.job_id IS NOT NULL
  AND wo.date_completed IS NULL
  AND wo.wo_completion_rh IS NULL
  AND wo.completion_rh IS NULL
`;

interface Args { vesselId: string; apply: boolean; maxSyncAgeHours: number }

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
  const vesselId = get('--vessel');
  if (!vesselId) { console.error('Required: --vessel <vesselId>'); process.exit(1); }
  return { vesselId, apply: argv.includes('--apply'), maxSyncAgeHours: parseInt(get('--max-sync-age-hours') || '48') };
}

async function main() {
  const { vesselId, apply, maxSyncAgeHours } = parseArgs();
  const pool = await getPool();

  // Ship instance ids for this vessel — anything in sync_metadata is a ship.
  const shipRes = await pool.query(`SELECT instance_id FROM sync_metadata WHERE vessel_id = $1`, [vesselId]);
  const shipIds = new Set<string>(shipRes.rows.map((r: any) => String(r.instance_id)));
  console.log(`Vessel ${vesselId}: ${shipIds.size} known ship instance id(s)`);

  // Candidate scan: untouched, active, job-linked WOs whose due is behind the job's current next due.
  const woRes = await pool.query(
    `SELECT wo.wouuid, wo.work_order_no, wo.due_date, wo.next_due_reading, wo.maintenance_basis,
            wo.generated_by_instance, wo.created_at,
            j.next_due_date AS job_next_due_date, j.next_due_rh AS job_next_due_rh, j.job_no
       FROM work_orders wo
       JOIN jobs j ON j.juuid = wo.job_id
      WHERE wo.vessel_id = $1 AND ${UNTOUCHED_SQL}`,
    [vesselId],
  );
  console.log(`Untouched active job-linked WOs: ${woRes.rows.length}`);

  const candidates: any[] = [];
  const manualReview: any[] = [];
  let originUnknown = 0, originShip = 0, notStale = 0;

  for (const wo of woRes.rows) {
    // 3. Stale-cycle check (per basis)
    let stale = false;
    const woDue = wo.due_date ? parseWorkOrderDate(String(wo.due_date)) : null;
    const jobNextDue = wo.job_next_due_date ? parseWorkOrderDate(String(wo.job_next_due_date)) : null;
    if (woDue && jobNextDue && woDue.getTime() < jobNextDue.getTime()) stale = true;
    if (!stale && wo.next_due_reading && wo.job_next_due_rh) {
      const woRh = parseInt(String(wo.next_due_reading));
      const jobRh = parseInt(String(wo.job_next_due_rh));
      if (!isNaN(woRh) && !isNaN(jobRh) && woRh < jobRh) stale = true;
    }
    if (!stale) { notStale++; continue; }

    // 1. Origin positively office
    let origin: string | null = wo.generated_by_instance ? String(wo.generated_by_instance) : null;
    if (!origin) {
      const logRes = await pool.query(
        `SELECT instance_id FROM sync_field_log
          WHERE table_name = 'work_orders' AND row_uuid = $1 AND old_value IS NULL AND is_deleted = false
          ORDER BY changed_at ASC LIMIT 1`,
        [wo.wouuid],
      );
      origin = logRes.rows[0]?.instance_id ?? null;
    }
    if (!origin) { originUnknown++; continue; }        // never touch origin-unknown
    if (shipIds.has(origin)) { originShip++; continue; } // ship-generated — not ours

    // 4. Child records → manual review
    let hasChildren = false;
    for (const c of CHILD_TABLES) {
      const r = await pool.query(
        `SELECT 1 FROM "${c.table}" WHERE "${c.fkColumn}" = $1 AND (is_deleted = false OR is_deleted IS NULL) LIMIT 1`,
        [wo.wouuid],
      ).catch(() => ({ rows: [] as any[] }));
      if (r.rows.length > 0) { hasChildren = true; manualReview.push({ ...wo, childTable: c.table }); break; }
    }
    if (!hasChildren) candidates.push(wo);
  }

  console.log(`\nSkipped: notStale=${notStale}, originUnknown=${originUnknown}, originShip=${originShip}`);
  console.log(`MANUAL REVIEW (has child records): ${manualReview.length}`);
  manualReview.forEach(m => console.log(`  - ${m.work_order_no} (${m.wouuid}) child in ${m.childTable}`));
  console.log(`ARCHIVE CANDIDATES: ${candidates.length}`);
  candidates.slice(0, 50).forEach(c => console.log(`  - ${c.work_order_no} due=${c.due_date || c.next_due_reading} job=${c.job_no} origin=${c.generated_by_instance || 'log'}`));
  if (candidates.length > 50) console.log(`  ... and ${candidates.length - 50} more`);

  if (!apply) {
    console.log('\nDRY RUN — nothing archived. Re-run with --apply to archive.');
    await pool.end?.();
    return;
  }

  // Apply-mode freshness gate: the vessel must have synced recently, so the ship's view
  // of these rows is current before we archive synced data.
  const syncRes = await pool.query(
    `SELECT MAX(last_sync_at) AS last FROM sync_metadata WHERE vessel_id = $1`, [vesselId]);
  const last = syncRes.rows[0]?.last ? new Date(syncRes.rows[0].last) : null;
  const ageHours = last ? (Date.now() - last.getTime()) / 3600000 : Infinity;
  if (!last || ageHours > maxSyncAgeHours) {
    console.error(`\nABORT: vessel's last sync ${last ? ageHours.toFixed(1) + 'h ago' : 'is unknown'} (limit ${maxSyncAgeHours}h). Sync the vessel first or raise --max-sync-age-hours.`);
    process.exit(2);
  }
  console.log(`\nFreshness OK: last sync ${ageHours.toFixed(1)}h ago. Archiving ${candidates.length} WOs...`);

  const client = await pool.connect();
  let archived = 0, revalidationSkipped = 0;
  try {
    await client.query('BEGIN');
    for (const wo of candidates) {
      // Re-validate ALL destructive eligibility predicates INSIDE the transaction with the
      // row locked — the crew (via sync) may have touched the WO or the job since the scan.
      const re = await client.query(
        `SELECT wo.due_date, wo.next_due_reading, wo.status, wo.date_completed,
                wo.wo_completion_rh, wo.completion_rh, wo.is_deleted, wo.job_id,
                j.next_due_date AS job_next_due_date, j.next_due_rh AS job_next_due_rh
           FROM work_orders wo JOIN jobs j ON j.juuid = wo.job_id
          WHERE wo.wouuid = $1 FOR UPDATE OF wo`,
        [wo.wouuid],
      );
      const cur = re.rows[0];
      const stillUntouched = cur && cur.is_deleted === false && cur.status === 'Active'
        && cur.date_completed === null && cur.wo_completion_rh === null && cur.completion_rh === null;
      let stillStale = false;
      if (cur) {
        const d = cur.due_date ? parseWorkOrderDate(String(cur.due_date)) : null;
        const jd = cur.job_next_due_date ? parseWorkOrderDate(String(cur.job_next_due_date)) : null;
        if (d && jd && d.getTime() < jd.getTime()) stillStale = true;
        if (!stillStale && cur.next_due_reading && cur.job_next_due_rh) {
          const a = parseInt(String(cur.next_due_reading)); const b = parseInt(String(cur.job_next_due_rh));
          if (!isNaN(a) && !isNaN(b) && a < b) stillStale = true;
        }
      }
      // Re-check children inside the transaction too (a document/execution may have synced in).
      let childNow = false;
      if (stillUntouched && stillStale) {
        for (const c of CHILD_TABLES) {
          const r = await client.query(
            `SELECT 1 FROM "${c.table}" WHERE "${c.fkColumn}" = $1 AND (is_deleted = false OR is_deleted IS NULL) LIMIT 1`,
            [wo.wouuid],
          ).catch(() => ({ rows: [] as any[] }));
          if (r.rows.length > 0) { childNow = true; break; }
        }
      }
      if (!stillUntouched || !stillStale || childNow) {
        revalidationSkipped++;
        console.log(`  SKIP (changed since scan${childNow ? ': child records appeared' : ''}): ${wo.work_order_no}`);
        continue;
      }
      const upd = await client.query(
        `UPDATE work_orders wo SET is_deleted = true, updated_at = NOW()
          WHERE wo.wouuid = $1 AND ${UNTOUCHED_SQL}`,
        [wo.wouuid],
      );
      if ((upd.rowCount ?? 0) > 0) archived++; else revalidationSkipped++;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  console.log(`\nDONE: archived=${archived}, revalidationSkipped=${revalidationSkipped}, manualReview=${manualReview.length}`);
  await pool.end?.();
}

main().catch(err => { console.error('FAILED:', err); process.exit(1); });
