/**
 * Regression harness — approval history ("Approval process") for Technical approvals (29-Sep-2026, Jeevan).
 * Needs the shore+ship pair built from this tree:
 *   shore AE_TEST_BASE (default :5077, DB pms_ae_test) · ship AE_TEST_SHIP_BASE (default :5177, container pms-ship-ae)
 *
 *   H1  WO completion on the vessel: submitted → rejected (remarks) → resubmitted → approved. Two attempts,
 *       each event with name + rank and a time; the office sees the same after sync.
 *   H2  Change request from the vessel, approved in the office: Submitted (vessel name + rank) and
 *       "Approved — <step>" (office name + position); the vessel sees both after sync.
 *   H3  Postponement from the vessel: requested → rejected → requested again → approved (two attempts).
 *   H4  Withdrawal from the vessel: "Withdrawal requested" on board, "Withdrawn" after the office settles it.
 *   H5  Tech. Sup. acknowledgement (office) recorded with name + position, after the WO approval.
 *   H6  An older completed WO (no recorded events) shows its events with who "Not Recorded".
 * Refuses a shore DB not ending in _test. Cleans up the shore rows it creates.
 *   npx tsx scripts/test-approval-history.ts
 */
import { Pool } from 'pg';
import { execSync } from 'child_process';

const SHORE = process.env.AE_TEST_BASE || 'http://localhost:5077/technical/api';
const SHIP = process.env.AE_TEST_SHIP_BASE || 'http://localhost:5177/technical/api';
const DB = process.env.AE_TEST_DB || 'pms_ae_test';
const CONTAINER = process.env.AE_TEST_SHIP || 'pms-ship-ae';
if (!DB.endsWith('_test')) { console.error(`refusing: database '${DB}' is not a *_test database`); process.exit(2); }
const pool = new Pool({ connectionString: `postgres://postgres:admin123@localhost:5432/${DB}` });
const shoreSql = async (q: string, p: any[] = []) => (await pool.query(q, p)).rows;
const shipSql = (q: string): string =>
  execSync(`docker exec -i ${CONTAINER} su postgres -c "psql -d pms_arch_ship -tA"`, { encoding: 'utf8', input: q + '\n' }).trim();

const V = '743ef9d1-841a-11ed-aa7c-7003bca91a86';
const ADMIN_RUID = '28893a97-e475-4e19-afc5-d17f1b9adbb6';
const TAG = 'HIST';
const APPROVER = { id: 'hist-approver', name: 'HIST Approver', role: 'Admin (OLDBUILD-MATCHED)', type: 'Office', rank: 'Technical Superintendent' };
const ADMIN = { id: 'hist-admin', name: 'HIST Admin', role: 'Sail Admin', type: 'Office', rank: 'Technical Superintendent' };
const CE = { id: 'hist-ce', name: 'HIST Chief Engineer', role: 'Vessel Admin', type: 'Ship', rank: 'Chief Engineer' };
const THIRD = { id: 'hist-3e', name: 'HIST Third Engineer', role: 'Vessel User', type: 'Ship', rank: 'Third Engineer' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(base: string, method: string, path: string, body: any, who: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json',
    'x-user-id': who.id, 'x-user-name': encodeURIComponent(who.name), 'x-user-role': encodeURIComponent(who.role), 'x-user-type': who.type, 'x-rank': who.rank };
  const r = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* not json */ }
  console.log(`   → ${base === SHIP ? 'SHIP ' : 'SHORE'} ${method} ${path} as ${who.name} ← ${r.status} ${text.slice(0, 120).replace(/\s+/g, ' ')}`);
  return { status: r.status, json, text };
}
let fails = 0; let passes = 0;
const check = (label: string, ok: boolean, detail = '') => { console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail ? '  — ' + detail : ''}`); ok ? passes++ : fails++; };
const hr = (t: string) => console.log(`\n── ${t}`);
const oneStep = (screenId: string, classification: string) => ({
  scope: { moduleId: 'technical', screenId, actionId: '' }, classification, mode: 'simple', label: `${TAG} chain`,
  nodes: [
    { key: 'step-1', type: 'approval-step', label: 'Office sign-off', ordinal: 0, quorum: { rule: 'any' }, slots: [{ roleId: ADMIN_RUID, roleLabel: 'Admin (OLDBUILD-MATCHED)' }] },
    { key: 'end', type: 'end', label: 'End', ordinal: 1 },
  ],
  edges: [{ from: 'step-1', to: 'end' }],
});
async function sync(label: string) {
  let r = await call(SHIP, 'POST', '/sync/trigger', { vesselId: V }, ADMIN);
  for (let attempt = 0; attempt < 6 && r.json && r.json.success === false && !r.json.batchUuid; attempt++) {
    await sleep(10000);
    r = await call(SHIP, 'POST', '/sync/trigger', { vesselId: V }, ADMIN);
  }
  console.log(`   sync(${label}): ok=${r.json?.success} pushed=${r.json?.recordsPushed} pulled=${r.json?.recordsPulled}`);
  await sleep(5000);
  return r.json || {};
}
/** "label — name (position) @time" per event, per attempt. */
const summarize = (p: any) => (p?.attempts ?? []).map((a: any) => a.events.map((e: any) => `${e.label}|${e.byName ?? '∅'}|${e.byPosition ?? '∅'}|${e.at ? 'T' : '∅'}`));
const labels = (p: any) => (p?.attempts ?? []).map((a: any) => a.events.map((e: any) => e.label));

const refs: string[] = [];
async function cleanupShore() {
  if (refs.length) {
    await shoreSql(`DELETE FROM approval_history WHERE subject_ref = ANY($1)`, [refs]);
    await shoreSql(`DELETE FROM approval_notifications WHERE subject_ref = ANY($1)`, [refs]);
    await shoreSql(`DELETE FROM apprv_request_slots WHERE requuid IN (SELECT requuid FROM apprv_requests WHERE subject_ref = ANY($1))`, [refs]);
    await shoreSql(`DELETE FROM apprv_requests WHERE subject_ref = ANY($1)`, [refs]);
    await shoreSql(`DELETE FROM approval_withdrawals WHERE subject_ref = ANY($1)`, [refs]);
    await shoreSql(`DELETE FROM change_request WHERE cruuid = ANY($1)`, [refs]);
  }
  await shoreSql(`DELETE FROM apprv_workflows WHERE label=$1`, [`${TAG} chain`]);
  await shoreSql(`DELETE FROM master_user_vessels WHERE user_uuid LIKE 'hist-%'`);
  await shoreSql(`DELETE FROM master_users WHERE id LIKE 'hist-%'`);
}

async function shipWo(job: any, label: string, dueInDays: number) {
  const due = new Date(Date.now() + dueInDays * 86400000).toISOString().slice(0, 10);
  const r = await call(SHIP, 'POST', '/work-orders', { vesselId: V, jobId: job.id, jobTitle: job.job_title, component: job.comp_name, componentCode: job.comp_code, componentId: job.comp_id,
    assignedTo: '2nd Engineer', approver: 'Chief Engineer', department: 'Engine', maintenanceBasis: 'Calendar', frequencyValue: '30', frequencyUnit: 'Days',
    dueDate: due, nextDueDate: due, status: 'Due', workOrderType: 'Planned', isExecution: false, briefWorkDescription: `${TAG} ${label}` }, CE);
  if (r.json?.wouuid) refs.push(r.json.wouuid);
  return r.json;
}

(async () => {
  hr('0. set-up');
  await shoreSql(`DELETE FROM apprv_workflows WHERE module_id='technical' AND screen_id IN ('pms-spares-cr','pms-wo-postponement')`);
  for (const u of [APPROVER, ADMIN, CE, THIRD]) {
    await shoreSql(`INSERT INTO master_users (id, full_name, role, user_type, is_deleted) VALUES ($1,$2,$3,$4,false)
      ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role, full_name=EXCLUDED.full_name, is_deleted=false`, [u.id, u.name, u.role, u.type]);
  }
  await shoreSql(`INSERT INTO master_user_vessels (user_uuid, vessel_id, is_active, map_status) VALUES ($1,$2,true,'unmapped')
    ON CONFLICT (user_uuid, vessel_id) DO UPDATE SET is_active=true`, [APPROVER.id, V]);
  check('chain: spares CR / Normal Spares', (await call(SHORE, 'POST', '/approval-engine/workflows', oneStep('pms-spares-cr', 'Normal Spares'), ADMIN)).status === 201);
  check('chain: WO postponement / Normal WO', (await call(SHORE, 'POST', '/approval-engine/workflows', oneStep('pms-wo-postponement', 'Normal WO'), ADMIN)).status === 201);
  check('shore + ship have approval_history (migration 179)', (await shoreSql(`SELECT to_regclass('approval_history') t`))[0].t !== null && shipSql(`SELECT to_regclass('approval_history') IS NOT NULL`) === 't');
  check('baseline sync', (await sync('baseline')).success === true);
  const spare = (await shoreSql(`SELECT suuid, remarks FROM spares WHERE vessel_id=$1 AND is_deleted=false AND (critical IS NULL OR critical NOT IN ('Critical','Yes')) ORDER BY suuid DESC OFFSET 2 LIMIT 1`, [V]))[0];
  const job = (await shoreSql(`SELECT j.id, j.job_title, c.cuuid comp_id, c.name comp_name, c.component_code comp_code FROM jobs j JOIN components c ON c.cuuid = j.component_id
    WHERE j.vessel_id=$1 AND j.is_deleted=false AND (j.criticality IS NULL OR j.criticality <> 'Yes') AND (c.critical IS NOT TRUE) AND j.level2_reviewer_rank_id IS NULL ORDER BY j.id LIMIT 1`, [V]))[0];
  check('normal spare + job without office review exist', !!spare && !!job);

  hr('H1. WO completion on the vessel: submit → reject → resubmit → approve');
  const wo = await shipWo(job, 'completion', 5);
  const now = () => new Date().toISOString();
  await call(SHIP, 'PATCH', `/work-orders/${wo.id}`, { status: 'Pending Approval', approvalAction: 'submitted', completionDateTime: now(), dateCompleted: now() }, THIRD);
  await call(SHIP, 'PATCH', `/work-orders/${wo.id}`, { status: 'Rejected', approvalAction: 'rejected', rejectionComments: 'Photos missing' }, CE);
  await call(SHIP, 'PATCH', `/work-orders/${wo.id}`, { status: 'Pending Approval', approvalAction: 'submitted', completionDateTime: now(), dateCompleted: now() }, THIRD);
  const ap = await call(SHIP, 'PATCH', `/work-orders/${wo.id}`, { status: 'Completed', approvalAction: 'approved', approver: 'Chief Engineer', approverRemarks: 'Good job' }, CE);
  check('SHIP: WO approved', ap.status < 300 && shipSql(`SELECT status FROM work_orders WHERE wouuid='${wo.wouuid}'`) === 'Completed');
  const p1 = (await call(SHIP, 'GET', `/work-orders/${wo.id}/approval-process`, undefined, CE)).json;
  console.log('   ', JSON.stringify(summarize(p1?.completion)));
  check('SHIP: two attempts [Submitted, Rejected] + [Resubmitted, Approved]',
    JSON.stringify(labels(p1?.completion)) === JSON.stringify([['Submitted', 'Rejected'], ['Resubmitted', 'Approved']]));
  const ev = p1?.completion?.attempts?.flatMap((a: any) => a.events) ?? [];
  check('SHIP: submitter = HIST Third Engineer (Third Engineer), approver = HIST Chief Engineer (Chief Engineer), every event has a time',
    ev[0]?.byName === THIRD.name && ev[0]?.byPosition === 'Third Engineer' && ev[3]?.byName === CE.name && ev[3]?.byPosition === 'Chief Engineer' && ev.every((e: any) => !!e.at), JSON.stringify(ev));
  check('SHIP: rejection remarks kept', ev[1]?.remarks === 'Photos missing' && ev[3]?.remarks === 'Good job');
  await sync('H1');
  const s1 = (await call(SHORE, 'GET', `/work-orders/${wo.wouuid}/approval-process`, undefined, APPROVER)).json;
  check('OFFICE: the same history after sync', JSON.stringify(summarize(s1?.completion)) === JSON.stringify(summarize(p1?.completion)), JSON.stringify(summarize(s1?.completion)));

  hr('H2. Change request from the vessel, approved in the office');
  const crR = await call(SHIP, 'POST', '/change-requests', { vesselId: V, category: 'spares', title: `${TAG} CR`, reason: TAG, targetType: 'spare', targetId: spare.suuid,
    proposedChangesJson: [{ id: 1, field: 'remarks', oldValue: spare.remarks, newValue: 'HIST-APPLIED' }], status: 'submitted', requestedByUserId: CE.id }, CE);
  const cr = crR.json; if (cr?.cruuid) refs.push(cr.cruuid);
  await sync('H2a');
  const shoreCr = (await shoreSql(`SELECT id FROM change_request WHERE cruuid=$1`, [cr.cruuid]))[0];
  check('OFFICE: approver approves', (await call(SHORE, 'PUT', `/change-requests/${shoreCr.id}/approve`, { comment: 'Fine' }, APPROVER)).status < 300);
  const s2 = (await call(SHORE, 'GET', `/change-requests/${shoreCr.id}/approval-process`, undefined, APPROVER)).json;
  console.log('   ', JSON.stringify(summarize(s2)));
  const e2 = s2?.attempts?.[0]?.events ?? [];
  check('OFFICE: Submitted by HIST Chief Engineer (Chief Engineer), "Approved — Office sign-off" by HIST Approver (Technical Superintendent)',
    e2[0]?.label === 'Submitted' && e2[0]?.byName === CE.name && e2[0]?.byPosition === 'Chief Engineer'
    && e2[1]?.label === 'Approved — Office sign-off' && e2[1]?.byName === APPROVER.name && e2[1]?.byPosition === 'Technical Superintendent' && e2[1]?.remarks === 'Fine', JSON.stringify(e2));
  await sync('H2b');
  const p2 = (await call(SHIP, 'GET', `/change-requests/${cr.id}/approval-process`, undefined, CE)).json;
  check('SHIP: the same CR history after sync', JSON.stringify(summarize(p2)) === JSON.stringify(summarize(s2)), JSON.stringify(summarize(p2)));
  await shoreSql(`UPDATE spares SET remarks=$1 WHERE suuid=$2`, [spare.remarks, spare.suuid]);

  hr('H3. Postponement: requested → rejected → requested again → approved');
  const wo3 = await shipWo(job, 'postponement', 10);
  const newDue = new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10);
  await call(SHIP, 'POST', `/work-orders/${wo3.id}/postpone-request`, { nextDueDate: newDue, reason: 'Awaiting spares.', postponementRemarks: TAG, userId: CE.id }, CE);
  await sync('H3a');
  check('OFFICE: reject', (await call(SHORE, 'POST', `/work-orders/${wo3.id}/postpone-reject`, { approvedBy: APPROVER.name, approvalRemarks: 'Not justified', userUuid: APPROVER.id, role: 'Office' }, APPROVER)).status < 300);
  await sync('H3b');
  await call(SHIP, 'POST', `/work-orders/${wo3.id}/postpone-request`, { nextDueDate: newDue, reason: 'Spares delayed.', postponementRemarks: TAG, userId: CE.id }, CE);
  await sync('H3c');
  check('OFFICE: approve', (await call(SHORE, 'POST', `/work-orders/${wo3.id}/postpone-approve`, { approvedBy: APPROVER.name, approvalRemarks: 'OK now', userUuid: APPROVER.id, role: 'Office' }, APPROVER)).status < 300);
  await sync('H3d');
  const p3 = (await call(SHIP, 'GET', `/work-orders/${wo3.id}/approval-process`, undefined, CE)).json;
  console.log('   ', JSON.stringify(summarize(p3?.postponement)));
  check('SHIP: [Requested, Rejected — Office sign-off] + [Requested again, Approved — Office sign-off]',
    JSON.stringify(labels(p3?.postponement)) === JSON.stringify([['Requested', 'Rejected — Office sign-off'], ['Requested again', 'Approved — Office sign-off']]));

  hr('H4. Withdrawal from the vessel');
  const cr4R = await call(SHIP, 'POST', '/change-requests', { vesselId: V, category: 'spares', title: `${TAG} CR withdraw`, reason: TAG, targetType: 'spare', targetId: spare.suuid,
    proposedChangesJson: [{ id: 1, field: 'remarks', oldValue: spare.remarks, newValue: 'HIST-W' }], status: 'submitted', requestedByUserId: CE.id }, CE);
  const cr4 = cr4R.json; if (cr4?.cruuid) refs.push(cr4.cruuid);
  await sync('H4a');
  check('SHIP: sender withdraws', (await call(SHIP, 'POST', '/approvals/withdrawals', { subjectType: 'change-request', subjectRef: cr4.cruuid, reason: 'Wrong spare' }, CE)).status === 201);
  const p4a = (await call(SHIP, 'GET', `/change-requests/${cr4.id}/approval-process`, undefined, CE)).json;
  check('SHIP: "Withdrawal requested" by HIST Chief Engineer', labels(p4a).flat().includes('Withdrawal requested'), JSON.stringify(labels(p4a)));
  await sync('H4b'); await sync('H4c');
  const p4 = (await call(SHIP, 'GET', `/change-requests/${cr4.id}/approval-process`, undefined, CE)).json;
  const last = p4?.attempts?.[0]?.events?.slice(-1)[0];
  check('SHIP: then "Withdrawn" under the sender, with a time', last?.label === 'Withdrawn' && last?.byName === CE.name && !!last?.at, JSON.stringify(summarize(p4)));

  hr('H5. Tech. Sup. acknowledgement (office)');
  const wo5 = await shipWo(job, 'ack', 5);
  await sync('H5a');
  await shoreSql(`UPDATE work_orders SET status='Pending Approval', approval_tier='superintendent_locked' WHERE wouuid=$1`, [wo5.wouuid]); // fixture: a locked WO
  // The per-vessel Tech. Sup. lock must be on for the acknowledgement; restored right after.
  const lockBefore = (await shoreSql(`SELECT superintendent_lock_enabled v FROM pms_vessel_settings WHERE vessel_id=$1`, [V]))[0];
  if (lockBefore) await shoreSql(`UPDATE pms_vessel_settings SET superintendent_lock_enabled=true WHERE vessel_id=$1`, [V]);
  else await shoreSql(`INSERT INTO pms_vessel_settings (id, vessel_id, updated_by, superintendent_lock_enabled)
    SELECT (SELECT COALESCE(MAX(id), 0) + 1 FROM pms_vessel_settings), $1, 'hist-harness', true`, [V]);
  const ack = await call(SHORE, 'POST', `/work-orders/${wo5.wouuid}/superintendent-acknowledge`, {}, ADMIN);
  if (lockBefore) await shoreSql(`UPDATE pms_vessel_settings SET superintendent_lock_enabled=$2 WHERE vessel_id=$1`, [V, lockBefore.v]);
  else await shoreSql(`DELETE FROM pms_vessel_settings WHERE vessel_id=$1 AND updated_by='hist-harness'`, [V]);
  const s5 = (await call(SHORE, 'GET', `/work-orders/${wo5.wouuid}/approval-process`, undefined, ADMIN)).json;
  const e5 = s5?.completion?.attempts?.flatMap((a: any) => a.events) ?? [];
  check('OFFICE: "Acknowledged by Technical Superintendent" — HIST Admin (Technical Superintendent) with a time',
    ack.status < 300 && e5.some((e: any) => e.label === 'Acknowledged by Technical Superintendent' && e.byName === ADMIN.name && e.byPosition === 'Technical Superintendent' && !!e.at), JSON.stringify(summarize(s5?.completion)));

  hr('H6. Older completed WO (before this change)');
  const old = (await shoreSql(`SELECT w.wouuid FROM work_orders w WHERE w.vessel_id=$1 AND w.status='Completed' AND w.submitted_date IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM approval_history h WHERE h.subject_ref=w.wouuid) LIMIT 1`, [V]))[0];
  if (old) {
    const s6 = (await call(SHORE, 'GET', `/work-orders/${old.wouuid}/approval-process`, undefined, ADMIN)).json;
    const e6 = s6?.completion?.attempts?.flatMap((a: any) => a.events) ?? [];
    console.log('   ', JSON.stringify(summarize(s6?.completion)));
    check('older WO shows its events; who = Not Recorded (no name)', e6.length > 0 && e6[0].label === 'Submitted' && e6[0].byName === null);
  } else {
    console.log('   (no older completed WO with a submitted date on this DB — skipped)');
  }

  hr('sync check: office decisions reached the vessel; vessel events reached the office');
  check('SHIP holds office-recorded rows (CR approval)', Number(shipSql(`SELECT count(*) FROM approval_history WHERE subject_ref='${cr.cruuid}' AND event_type='approved'`)) === 1);
  check('OFFICE holds vessel-recorded rows (WO submitted ×2)', (await shoreSql(`SELECT count(*)::int n FROM approval_history WHERE subject_ref=$1 AND event_type='submitted'`, [wo.wouuid]))[0].n === 2);

  hr('cleanup (shore)');
  await cleanupShore();
  console.log(`\nRESULT: ${passes} passed, ${fails} failed`);
  await pool.end();
  process.exit(fails ? 1 : 0);
})().catch(async (e) => { console.error('HARNESS ERROR:', e); try { await cleanupShore(); } catch { /* best effort */ } await pool.end(); process.exit(1); });
