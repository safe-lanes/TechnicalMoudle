/**
 * Phase-2 verification: RH MASTER work-order completion through approval.
 * ─────────────────────────────────────────────────────────────────────────
 * Exercises the MERGED updateWorkOrder() completion path (integration branch
 * integ/sched-x-replit = feature/replit-work + feature/scheduler-redesign) and
 * asserts that RW's RH-reading sync (Task #240) and SR's next-cycle generation
 * hook (Issue 03) BOTH fire correctly together without corrupting each other's
 * view of the WO/component/job state.
 *
 * It drives the REAL service function (not a reimplementation), so it truly
 * tests the interleave, then SNAPSHOTS + RESTORES every row it touches so a run
 * is non-destructive on dev.
 *
 * Assertions (CASE A — happy path, ship instance):
 *   A1  component master counter == R              (RW advanced it)
 *   A2  work_orders.rh_synced_at set on completed WO
 *   A3  exactly ONE next WO row created            (no double-generate)
 *   A4  new WO due-RH (next_due_reading) == R + F  (off R, NOT off C0)  ← core
 *   A5  a second explicit scan creates NO further WO (scanner guard holds)
 * CASE B — L2-intercepted job:
 *   B1  WO status -> 'Pending Office Review'
 *   B2  counter unchanged (== C0), rh_synced_at NOT set, ZERO next WOs
 * CASE C — RH reading beyond the per-day cap (no adminOverride):
 *   C1  RH_OVERRIDE_REQUIRED thrown BEFORE the write
 *   C2  WO stays 'Pending Approval' (not Completed)
 *   C3  master counter UNCHANGED (== C0)
 *   C4  rh_synced_at stays null
 *   C5  no next WO generated
 *   Tune the over-cap reading with  OVERCAP_DELTA=<hours>  (default 100000) so
 *   it sits ABOVE the real per-day cap on dev — no file edit needed.
 *   ⚠️ If C1 still FAILs (no throw) at a genuinely over-cap delta, do NOT just
 *   raise OVERCAP_DELTA: that points at updateMasterRH SKIPPING the cap when the
 *   component has no prior RH baseline (first entry / null last-update). Flag it
 *   for investigation — it is a cap-coverage hole, not a tuning problem.
 * Instance behaviour (proves the ship-only RH gate Jeevan confirmed):
 *   - Run on a SHIP instance  -> counter advances to R, rh_synced_at set, 1 next WO.
 *   - Run on a SHORE instance -> the ship-only gate BLOCKS the advance: counter
 *     unchanged, no rh_synced_at, no next WO — and CASE A PASSes that (proof the
 *     gate works). The instance mode is printed at the top of CASE A.
 *
 * Separate read-only mode — rh_synced_at propagation (ship -> shore):
 *   npx tsx scripts/verify-rh-wo-completion.ts --propagation <wouuid>
 *   (reads ship rh_synced_at on DATABASE_URL and shore rh_synced_at on
 *    SHORE_DATABASE_URL; expects BOTH set after a real completion + sync.
 *    Pure reads — drive the completion + Sync Now yourself first.)
 *
 * SAFETY
 *   - DESTRUCTIVE MODE (default) requires:  RUN_PMS_WRITE_TEST=1
 *   - Refuses to run unless DATABASE_URL host is localhost/127.0.0.1 (override
 *     with ALLOW_NONLOCAL=1 only if you know what you're doing).
 *   - PAUSE auto-sync on the ship before running (Admin -> Sync Dashboard) so a
 *     mid-test cycle can't push test field logs; the script also deletes its own
 *     sync_field_log rows on restore as a backstop.
 *
 * Run (dev, ship instance):
 *   RUN_PMS_WRITE_TEST=1 \
 *   DATABASE_URL="postgres://postgres:admin123@localhost:5432/pms_ship" \
 *   EXTERNAL_MASTER_DATA_URL_DEV=http://localhost:9999 \
 *   SYNC_INSTANCE_ID="SHIP-Vessel 5" \
 *   npx tsx scripts/verify-rh-wo-completion.ts [wouuidOrId]
 */

import { initStorage } from '../server/storage';
import { getPool } from '../server/db';
import { updateWorkOrder } from '../server/modules/work-orders/services/workOrderService';
import { isShipInstance } from '../server/modules/sync/syncRole';
import { jobDueScanner } from '../server/services/jobDueScanner';
import { Pool } from 'pg';

// ── tiny PASS/FAIL harness ────────────────────────────────────────────────
let passed = 0, failed = 0, flagged = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  ✅ PASS  ${name}${detail ? ' — ' + detail : ''}`); }
  else { failed++; console.log(`  ❌ FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}
function flag(name: string, detail = '') {
  flagged++; console.log(`  ⚠️  FLAG  ${name}${detail ? ' — ' + detail : ''}`);
}
const num = (v: any) => (v === null || v === undefined || v === '' ? NaN : parseFloat(String(v)));
const close = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

async function q(pool: any, sql: string, params: any[] = []) {
  const r = await pool.query(sql, params);
  return r.rows;
}
async function one(pool: any, sql: string, params: any[] = []) {
  return (await q(pool, sql, params))[0];
}

// ── snapshot/restore of an arbitrary row by a key column ──────────────────
async function snapshotRow(pool: any, table: string, keyCol: string, keyVal: string) {
  return one(pool, `SELECT * FROM ${table} WHERE ${keyCol} = $1`, [keyVal]);
}
async function restoreRow(pool: any, table: string, keyCol: string, row: any) {
  if (!row) return;
  const cols = Object.keys(row).filter(c => c !== keyCol);
  const sets = cols.map((c, i) => `"${c}" = $${i + 2}`).join(', ');
  const vals = cols.map(c => row[c]);
  await pool.query(`UPDATE ${table} SET ${sets} WHERE ${keyCol} = $1`, [row[keyCol], ...vals]);
}

// ─────────────────────────────────────────────────────────────────────────
async function propagationMode(wouuid: string) {
  console.log(`\n=== rh_synced_at PROPAGATION CHECK (read-only) — wouuid=${wouuid} ===`);
  const shoreUrl = process.env.SHORE_DATABASE_URL;
  if (!shoreUrl) { console.error('SHORE_DATABASE_URL not set — needed to read the shore row.'); process.exit(2); }
  const ship = await getPool();
  const shore = new Pool({ connectionString: shoreUrl });
  try {
    const s = await one(ship, `SELECT wouuid, status, rh_synced_at FROM work_orders WHERE wouuid = $1`, [wouuid]);
    const o = await one(shore, `SELECT wouuid, status, rh_synced_at FROM work_orders WHERE wouuid = $1`, [wouuid]);
    if (!s) { check('ship row exists', false, 'wouuid not found on ship'); }
    else check('ship rh_synced_at set', s.rh_synced_at != null, `value=${s.rh_synced_at}`);
    if (!o) check('shore row exists (synced across)', false, 'wouuid not found on shore — has the WO synced yet?');
    else check('shore rh_synced_at set (propagated)', o.rh_synced_at != null, `value=${o.rh_synced_at}`);
  } finally {
    await shore.end();
  }
}

// ─────────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--propagation') {
    await initStorage();
    await propagationMode(args[1]);
    summary();
    return;
  }

  // safety gates (destructive mode)
  if (process.env.RUN_PMS_WRITE_TEST !== '1') {
    console.error('Refusing to run: this test WRITES to the DB (then restores).');
    console.error('Set RUN_PMS_WRITE_TEST=1 to proceed, after pausing auto-sync.');
    process.exit(2);
  }
  const dbUrl = process.env.DATABASE_URL || '';
  const isLocal = /@(localhost|127\.0\.0\.1)[:\/]/.test(dbUrl);
  if (!isLocal && process.env.ALLOW_NONLOCAL !== '1') {
    console.error(`Refusing to run against a non-local DB (${dbUrl.replace(/:[^:@]*@/, ':***@')}).`);
    console.error('Set ALLOW_NONLOCAL=1 to override.');
    process.exit(2);
  }

  await initStorage();
  const pool = await getPool();
  if (!pool) { console.error('No DB pool.'); process.exit(2); }

  const ship = await isShipInstance();
  console.log(`\n=== Phase-2 RH MASTER WO completion verification ===`);
  console.log(`Instance: ${process.env.SYNC_INSTANCE_ID || '(DB-resolved)'} — isShipInstance=${ship}`);
  console.log(ship
    ? '  → SHIP: generation hook EXPECTED to fire (A3 == 1).'
    : '  → SHORE: generation hook EXPECTED suppressed (A3 == 0); counter advance MEASURED + flagged.');

  // ── pick candidate ──────────────────────────────────────────────────────
  const override = args[0];
  const cand = override
    ? await one(pool,
        `SELECT w.* FROM work_orders w WHERE (w.wouuid = $1 OR w.id = $1)`, [override])
    : await one(pool,
        `SELECT w.* FROM work_orders w
           JOIN components c ON c.cuuid = w.component
          WHERE c.rh_counter_type = 'MASTER'
            AND w.maintenance_basis = 'Running Hours'
            AND w.job_id IS NOT NULL
            AND w.status <> 'Completed'
            AND w.data_scope = 'vessel'
          ORDER BY (w.status = 'Pending Approval') DESC, w.work_order_no
          LIMIT 1`);
  if (!cand) { console.error('No suitable RH MASTER WO found (need maintenance_basis=Running Hours, MASTER component, job_id set, not Completed).'); process.exit(3); }

  const comp = await one(pool, `SELECT * FROM components WHERE cuuid = $1`, [cand.component]);
  if (!comp || (comp.rh_counter_type || '').toUpperCase() !== 'MASTER') {
    console.error(`WO ${cand.work_order_no} component is not MASTER (${comp?.rh_counter_type}). Pick another.`); process.exit(3);
  }
  const job = await one(pool, `SELECT * FROM jobs WHERE juuid = $1`, [cand.job_id]);
  const C0 = num(comp.current_cumulative_rh);
  const F  = num(cand.interval_running_hour) || num(job?.interval_running_hour) || 0;
  if (!(F > 0)) { console.error(`WO/job has no positive interval_running_hour (F=${F}); cannot assert next due-RH.`); process.exit(3); }
  const R  = C0 + 10;                       // small, cap-safe bump; adminOverride also passed
  const expectedDue = R + F;
  const staleDue = C0 + F;
  console.log(`\nCandidate WO: ${cand.work_order_no}  (id=${cand.id}, wouuid=${cand.wouuid})`);
  console.log(`  component=${comp.component_code} (${comp.cuuid})  job=${cand.job_id}`);
  console.log(`  C0 (master counter)=${C0}   F (interval RH)=${F}   R (completion reading)=${R}`);
  console.log(`  expected new-WO due-RH = R+F = ${expectedDue}   (stale would be C0+F = ${staleDue})`);

  // ── snapshots (for restore) ─────────────────────────────────────────────
  const vesselId = cand.vessel_id;
  const snap = {
    wo:   await snapshotRow(pool, 'work_orders', 'id', cand.id),
    job:  job ? await snapshotRow(pool, 'jobs', 'juuid', job.juuid) : null,
    comps: await q(pool, `SELECT cuuid, current_cumulative_rh FROM components WHERE vessel_id = $1`, [vesselId]),
    links: await q(pool, `SELECT * FROM job_component_links WHERE job_id = $1`, [cand.job_id]),
    woUuids: new Set<string>((await q(pool, `SELECT wouuid FROM work_orders WHERE job_id = $1`, [cand.job_id])).map(r => r.wouuid)),
    maxAudit: Number((await one(pool, `SELECT COALESCE(MAX(id),0) m FROM running_hours_audit`)).m),
    maxLog:   Number((await one(pool, `SELECT COALESCE(MAX(id),0) m FROM sync_field_log`)).m),
  };

  // gathers every uuid the test may field-log, for targeted log cleanup
  const touched = new Set<string>([cand.wouuid, comp.cuuid, cand.job_id]);

  async function restoreAll(label: string) {
    console.log(`\n[restore:${label}] reverting all touched rows…`);
    try {
      // 1. delete any newly-created WOs for this job
      const nowUuids = (await q(pool, `SELECT wouuid FROM work_orders WHERE job_id = $1`, [cand.job_id])).map(r => r.wouuid);
      const fresh = nowUuids.filter(u => !snap.woUuids.has(u));
      if (fresh.length) {
        await pool.query(`DELETE FROM work_orders WHERE job_id = $1 AND wouuid = ANY($2)`, [cand.job_id, fresh]);
        console.log(`  - deleted ${fresh.length} generated WO row(s)`);
      }
      // 2. restore the WO under test
      await restoreRow(pool, 'work_orders', 'id', snap.wo);
      // 3. restore job + links
      if (snap.job) await restoreRow(pool, 'jobs', 'juuid', snap.job);
      for (const lk of snap.links) {
        const id = lk.id ?? lk.jcl_id ?? lk.uuid;
        if (id !== undefined) await restoreRow(pool, 'job_component_links',
          (lk.id !== undefined ? 'id' : (lk.jcl_id !== undefined ? 'jcl_id' : 'uuid')), lk);
      }
      // 4. restore component counters that changed
      let restoredComps = 0;
      for (const c of snap.comps) {
        await pool.query(`UPDATE components SET current_cumulative_rh = $2 WHERE cuuid = $1 AND current_cumulative_rh <> $2`,
          [c.cuuid, c.current_cumulative_rh]).then((r: any) => { restoredComps += r.rowCount || 0; });
      }
      if (restoredComps) console.log(`  - restored ${restoredComps} component counter(s)`);
      // 5. delete new RH audit rows
      const da = await pool.query(`DELETE FROM running_hours_audit WHERE id > $1 AND component_id = ANY($2)`,
        [snap.maxAudit, Array.from(touched)]);
      if (da.rowCount) console.log(`  - deleted ${da.rowCount} running_hours_audit row(s)`);
      // 6. delete the test's own field logs (so nothing syncs)
      const dl = await pool.query(`DELETE FROM sync_field_log WHERE id > $1 AND row_uuid = ANY($2)`,
        [snap.maxLog, Array.from(touched)]);
      if (dl.rowCount) console.log(`  - deleted ${dl.rowCount} sync_field_log row(s)`);
      console.log(`[restore:${label}] done.`);
    } catch (e: any) {
      console.error(`[restore:${label}] ERROR — manual cleanup may be needed:`, e?.message || e);
    }
  }

  // setup a clean Pending-Approval starting state (snapshotted, restored later)
  async function setPendingApproval() {
    await pool.query(
      `UPDATE work_orders
          SET status='Pending Approval', approval_action=NULL, approval_date=NULL,
              date_completed=NULL, completion_date_time=NULL, rh_synced_at=NULL,
              approval_tier='standard', missed_cycles=0
        WHERE id = $1`, [cand.id]);
  }

  const today = new Date('2026-06-12T08:00:00.000Z'); // fixed (Date.now banned in some envs; harmless here)
  const completionBody = {
    status: 'Completed',
    approvalAction: 'approved',
    runningHours: String(R),
    completionDateTime: today.toISOString(),
    dateOfCompletion: today.toISOString().split('T')[0],
    userId: 'verify-script',
    userRole: ship ? 'Ship' : 'Office',
    adminOverride: true,                       // bypass per-day cap for the happy path
    ceApprovalRemarks: 'verification approval remarks (automated phase-2 check)',
    skippedCyclesJustification: 'automated verification justification for any skipped cycles (>30 chars).',
  };

  // ═══════════════════ CASE A — happy path ════════════════════════════════
  try {
    console.log(`\n──────── CASE A: RH MASTER completion through approval ────────`);
    console.log(`  instance mode: ${ship ? 'SHIP — expect counter advances + rh_synced_at + 1 next WO'
      : 'SHORE — expect advance BLOCKED by ship-only gate: counter unchanged, no rh_synced_at, no next WO'}`);
    await setPendingApproval();
    await updateWorkOrder(cand.id, completionBody);

    // poll for the hook's fire-and-forget generation
    let newWos: string[] = [];
    for (let i = 0; i < 16; i++) {
      const u = (await q(pool, `SELECT wouuid FROM work_orders WHERE job_id = $1`, [cand.job_id])).map(r => r.wouuid);
      newWos = u.filter(x => !snap.woUuids.has(x));
      if (newWos.length) break;
      await new Promise(r => setTimeout(r, 500));
    }
    newWos.forEach(u => touched.add(u));

    const compAfter = await one(pool, `SELECT current_cumulative_rh FROM components WHERE cuuid = $1`, [comp.cuuid]);
    const woAfter   = await one(pool, `SELECT status, rh_synced_at FROM work_orders WHERE id = $1`, [cand.id]);
    const counter   = num(compAfter.current_cumulative_rh);

    if (ship) {
      // SHIP: the ship/HOD approval advances the counter, stamps rh_synced_at, generates next cycle.
      // A1 — counter advanced to R
      check('A1 [ship] master counter == R (advanced)', close(counter, R), `counter=${counter}, R=${R}`);
      // A2 — rh_synced_at stamped on the completed WO
      check('A2 [ship] work_orders.rh_synced_at set on completed WO',
        woAfter.status === 'Completed' && woAfter.rh_synced_at != null,
        `status=${woAfter.status}, rh_synced_at=${woAfter.rh_synced_at}`);
      // A3 — exactly one next WO
      check('A3 [ship] exactly ONE next WO generated', newWos.length === 1, `generated=${newWos.length}`);
      // A4 — CORE: new WO due-RH computed off R, not C0
      if (newWos.length >= 1) {
        const nw = await one(pool, `SELECT work_order_no, next_due_reading, current_reading FROM work_orders WHERE wouuid = $1`, [newWos[0]]);
        const due = num(nw.next_due_reading);
        check('A4 [ship] new WO due-RH == R + F (off R, the core assertion)',
          close(due, expectedDue), `next_due_reading=${due}, expected R+F=${expectedDue}`);
        check('A4b [ship] new WO due-RH is NOT the stale C0 + F',
          !close(due, staleDue) || close(expectedDue, staleDue), `stale C0+F=${staleDue}`);
      } else {
        check('A4 [ship] new WO due-RH off R', false, 'no WO generated — cannot evaluate');
      }
      // A5 — no double-generate: an explicit re-scan must not add another WO
      if (newWos.length >= 1) {
        await jobDueScanner.runScan(vesselId);
        const u2 = (await q(pool, `SELECT wouuid FROM work_orders WHERE job_id = $1`, [cand.job_id])).map(r => r.wouuid);
        const fresh2 = u2.filter(x => !snap.woUuids.has(x));
        fresh2.forEach(u => touched.add(u));
        check('A5 [ship] second scan creates NO further WO (scanner guard holds)',
          fresh2.length === newWos.length, `after re-scan=${fresh2.length}, was=${newWos.length}`);
      }
    } else {
      // SHORE: the ship-only RH gate must BLOCK the advance entirely. Proving the gate means
      // counter unchanged, rh_synced_at never set, no next cycle. All PASS = gate works.
      check('A1 [shore] master counter UNCHANGED (== C0, gate blocked advance)',
        close(counter, C0), `counter=${counter}, C0=${C0}`);
      check('A2 [shore] rh_synced_at NOT set (gate blocked advance)',
        woAfter.rh_synced_at == null, `rh_synced_at=${woAfter.rh_synced_at}`);
      check('A3 [shore] NO next WO generated (hook ship-gated)',
        newWos.length === 0, `generated=${newWos.length}`);
    }
  } catch (e: any) {
    check('CASE A ran without throwing', false, e?.message || String(e));
  } finally {
    await restoreAll('CASE-A');
  }

  // ═══════════════════ CASE B — L2-intercepted job ════════════════════════
  try {
    console.log(`\n──────── CASE B: L2-intercepted job (both must suppress) ────────`);
    if (!job) { flag('CASE B skipped', 'WO has no linked job to mark L2'); }
    else {
      snap.maxAudit = Number((await one(pool, `SELECT COALESCE(MAX(id),0) m FROM running_hours_audit`)).m);
      snap.maxLog   = Number((await one(pool, `SELECT COALESCE(MAX(id),0) m FROM sync_field_log`)).m);
      await pool.query(`UPDATE jobs SET level2_reviewer_rank_id = 'VERIFY-L2' WHERE juuid = $1`, [job.juuid]);
      await setPendingApproval();

      await updateWorkOrder(cand.id, completionBody);

      const woAfter = await one(pool, `SELECT status, rh_synced_at FROM work_orders WHERE id = $1`, [cand.id]);
      const compAfter = await one(pool, `SELECT current_cumulative_rh FROM components WHERE cuuid = $1`, [comp.cuuid]);
      const u = (await q(pool, `SELECT wouuid FROM work_orders WHERE job_id = $1`, [cand.job_id])).map(r => r.wouuid);
      const fresh = u.filter(x => !snap.woUuids.has(x));
      fresh.forEach(x => touched.add(x));

      check('B1 WO status -> Pending Office Review', woAfter.status === 'Pending Office Review', `status=${woAfter.status}`);
      check('B2a counter unchanged (== C0)', close(num(compAfter.current_cumulative_rh), C0), `counter=${num(compAfter.current_cumulative_rh)}, C0=${C0}`);
      check('B2b rh_synced_at NOT set', woAfter.rh_synced_at == null, `rh_synced_at=${woAfter.rh_synced_at}`);
      check('B2c ZERO next WOs generated', fresh.length === 0, `generated=${fresh.length}`);
    }
  } catch (e: any) {
    check('CASE B ran without throwing', false, e?.message || String(e));
  } finally {
    // restore L2 flag explicitly first (restoreAll also restores the job row)
    if (job) await pool.query(`UPDATE jobs SET level2_reviewer_rank_id = $2 WHERE juuid = $1`,
      [job.juuid, snap.job?.level2_reviewer_rank_id ?? null]);
    await restoreAll('CASE-B');
  }

  // ═══════════════════ CASE C — RH over-cap (override required) ════════════
  // Reading far beyond the per-day rate cap, WITHOUT adminOverride, must make
  // updateMasterRH throw -> re-thrown as RH_OVERRIDE_REQUIRED BEFORE repo.update
  // (Window B, lines 1387-1402 / 1453). Nothing must persist: WO stays Pending,
  // master counter unchanged, rh_synced_at null, no next WO generated.
  try {
    console.log(`\n──────── CASE C: RH over-cap → RH_OVERRIDE_REQUIRED before write ────────`);
    snap.maxAudit = Number((await one(pool, `SELECT COALESCE(MAX(id),0) m FROM running_hours_audit`)).m);
    snap.maxLog   = Number((await one(pool, `SELECT COALESCE(MAX(id),0) m FROM sync_field_log`)).m);
    await setPendingApproval();

    // Over-cap delta is configurable so Nilesh can set it above whatever the
    // real per-day cap is on dev WITHOUT editing this file:  OVERCAP_DELTA=<n>
    // Default 100000 = a huge same-day jump that should exceed any per-day cap.
    const overcapDelta = Number(process.env.OVERCAP_DELTA) > 0 ? Number(process.env.OVERCAP_DELTA) : 100000;
    const Rover = C0 + overcapDelta; // same-day jump intended to exceed the per-day rate cap
    console.log(`  over-cap reading R_over = C0 + ${overcapDelta} = ${Rover}  (set OVERCAP_DELTA to tune above the dev cap)`);
    const overCapBody = {
      ...completionBody,
      runningHours: String(Rover),
      adminOverride: false,        // do NOT bypass the cap — we want it to reject
    };

    let threw = false, code: any = undefined, msg = '';
    try {
      await updateWorkOrder(cand.id, overCapBody);
    } catch (err: any) {
      threw = true;
      code = err?.details?.code ?? err?.code;
      msg = err?.message || String(err);
    }

    const woAfter   = await one(pool, `SELECT status, rh_synced_at FROM work_orders WHERE id = $1`, [cand.id]);
    const compAfter = await one(pool, `SELECT current_cumulative_rh FROM components WHERE cuuid = $1`, [comp.cuuid]);
    const u = (await q(pool, `SELECT wouuid FROM work_orders WHERE job_id = $1`, [cand.job_id])).map(r => r.wouuid);
    const fresh = u.filter(x => !snap.woUuids.has(x));
    fresh.forEach(x => touched.add(x));

    const c1ok = threw && code === 'RH_OVERRIDE_REQUIRED';
    check('C1 threw RH_OVERRIDE_REQUIRED (before write)',
      c1ok, `threw=${threw}, code=${code}${threw && code !== 'RH_OVERRIDE_REQUIRED' ? ', msg=' + msg : ''}`);
    if (!c1ok && !threw) {
      // IMPORTANT: do NOT just raise OVERCAP_DELTA to force a pass. A no-throw at a
      // genuinely over-cap delta means updateMasterRH let the reading through — most
      // likely the per-day cap is SKIPPED when the component has no prior RH baseline
      // (first entry / null last-update). That is a cap-coverage hole to INVESTIGATE,
      // not a test-tuning problem.
      flag('C1 cap did NOT fire at over-cap delta',
        `R_over=${num((await one(pool, `SELECT current_cumulative_rh FROM components WHERE cuuid = $1`, [comp.cuuid])).current_cumulative_rh))} — investigate updateMasterRH skipping the cap with no prior RH baseline; do NOT just raise OVERCAP_DELTA`);
    }
    check('C2 WO stays Pending Approval (not Completed)',
      woAfter.status === 'Pending Approval', `status=${woAfter.status}`);
    check('C3 master counter UNCHANGED (== C0)',
      close(num(compAfter.current_cumulative_rh), C0), `counter=${num(compAfter.current_cumulative_rh)}, C0=${C0}`);
    check('C4 rh_synced_at stays null', woAfter.rh_synced_at == null, `rh_synced_at=${woAfter.rh_synced_at}`);
    check('C5 no next WO generated', fresh.length === 0, `generated=${fresh.length}`);
  } catch (e: any) {
    check('CASE C ran without an unexpected throw', false, e?.message || String(e));
  } finally {
    await restoreAll('CASE-C');
  }

  summary();
}

function summary() {
  console.log(`\n══════════════════════════════════════════════════════════════`);
  console.log(`  RESULT: ${passed} passed, ${failed} failed, ${flagged} flagged`);
  console.log(`══════════════════════════════════════════════════════════════`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
