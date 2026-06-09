/**
 * Scheduler-redesign runtime verification helper (Stages A+B+C).
 *
 * Prints the CANONICAL computed-band counts (the source of truth after
 * compute-on-read) and checks for forbidden 'system' status writes. Use its
 * numbers as the reference that the alert engine and the report functions must
 * match (see docs/SCHEDULER-REDESIGN-VERIFICATION.md, tests T4/T5).
 *
 * Run (dev):
 *   DATABASE_URL="postgres://postgres:admin123@localhost:5432/pms" \
 *   EXTERNAL_MASTER_DATA_URL_DEV=http://localhost:9999 \
 *   npx tsx scripts/verify-scheduler-redesign.ts [vesselId] [sinceISO]
 *
 *   - vesselId  optional: scope the band counts to one vessel (else all vessels)
 *   - sinceISO  optional: cutoff for the 'system' field-log check
 *               (default: 1 hour ago). Pass your DEPLOY timestamp here.
 *
 * READ-ONLY: this script never writes to the database.
 */
import 'dotenv/config';
import { getWorkOrdersWithComputedStatus } from '../server/modules/work-orders/services/workOrderService';
import { getPool } from '../server/db';

async function main() {
  const vesselId = process.argv[2] && process.argv[2] !== '-' ? process.argv[2] : undefined;
  const since = process.argv[3] || new Date(Date.now() - 3600_000).toISOString();

  // ── 1. Canonical computed-band counts (the reference everything is checked against) ──
  const wos: any[] = await getWorkOrdersWithComputedStatus(vesselId);
  const bands: Record<string, number> = {};
  for (const wo of wos) bands[wo.status] = (bands[wo.status] || 0) + 1;

  console.log('\n=== CANONICAL computed-band counts %s ===', vesselId ? `(vessel ${vesselId})` : '(all vessels)');
  console.table(bands);
  console.log(`Total work orders: ${wos.length}`);

  // What pmsAlertEngine UC1 should produce: Overdue + (critical/high job OR critical component), vessel-scoped.
  const uc1 = wos.filter(w =>
    w.status === 'Overdue' &&
    w.dataScope === 'vessel' &&
    (['critical', 'high'].includes(String(w.jobPriority || '').toLowerCase()) ||
      w.criticality === 'Yes' || w.criticality === 'Critical')
  );
  console.log(`UC1 (alert engine) expected overdue candidates: ${uc1.length}`);
  console.log('  → after a 5-min alert cycle, alert_events(state=overdue) for NEW WOs should match this set (minus already-deduped).');

  // Quick parity reference for the reports (T4):
  console.log(`Report parity references → Overdue=${bands['Overdue'] || 0}, ` +
    `Due+GraceP=${(bands['Due'] || 0) + (bands['Due (Grace P)'] || 0)}, ` +
    `Active=${bands['Active'] || 0}, Completed=${bands['Completed'] || 0}, ` +
    `Postponed=${bands['Postponed'] || 0}`);

  // ── 2. Forbidden 'system' status writes (T5) ──
  const pool = await getPool();
  if (pool) {
    const r = await pool.query(
      `SELECT count(*)::int AS c
         FROM sync_field_log
        WHERE table_name = 'work_orders'
          AND field_name = 'status'
          AND changed_by_user_id = 'system'
          AND changed_at > $1`,
      [since]
    );
    const c = r.rows[0]?.c ?? 0;
    console.log(`\n=== 'system' work_orders.status field-log rows since ${since} ===`);
    console.log(`Count: ${c}  →  ${c === 0 ? 'PASS (no scheduler status writes)' : 'FAIL — investigate: who is writing status as system?'}`);
  } else {
    console.log('\n[warn] No DB pool — skipped the field-log check.');
  }

  process.exit(0);
}

main().catch((e) => { console.error('verify-scheduler-redesign failed:', e); process.exit(1); });
