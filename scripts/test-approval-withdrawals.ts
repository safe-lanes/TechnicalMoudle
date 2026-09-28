/**
 * Regression harness — sender withdrawal of a pending approval (28-Sep-2026, Sahil E6).
 * Needs the shore+ship pair built from this tree:
 *   shore AE_TEST_BASE (default :5077, DB pms_ae_test) · ship AE_TEST_SHIP_BASE (default :5177, container pms-ship-ae)
 *
 *   W1  ship CR, chain running on shore: another ship user → 403; the sender withdraws on board (waits
 *       for the office); after sync the shore cancels the request by itself — CR back to draft, engine
 *       request 'withdrawn', the approver gets a 'withdrawn' bell notification; next sync the ship shows it.
 *   W2  ship WO postponement: the sender withdraws on board, but the office approves before the sync →
 *       'too-late', the approval stands (Postponement Approved) and the ship sees the too-late note.
 *   W3  ship WO postponement withdrawn in time → WO back to its original due date, decision row 'Withdrawn'.
 *   W4  shore CR: the sender withdraws in the office → settled at once (no sync).
 *   W5  shore defect extension: stranger → 403; sender → entry 'Withdrawn', target date unchanged;
 *       a new extension can be asked afterwards; a defect verification cannot be withdrawn (400).
 *
 * Refuses a shore DB not ending in _test. Cleans up the shore rows it creates (the ship container is a
 * throwaway, reset by re-provisioning).
 *   npx tsx scripts/test-approval-withdrawals.ts
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
const TAG = 'WDRW';
const APPROVER = { id: 'wdrw-approver', name: 'WDRW Approver', role: 'Admin (OLDBUILD-MATCHED)', type: 'Office', rank: 'Technical Superintendent' };
const ADMIN = { id: 'wdrw-admin', name: 'WDRW Admin', role: 'Sail Admin', type: 'Office', rank: 'Technical Superintendent' };
const OFFICE_SENDER = { id: 'wdrw-office', name: 'WDRW Office Sender', role: 'Vessel Admin', type: 'Office', rank: 'Technical Superintendent' };
const STRANGER = { id: 'wdrw-stranger', name: 'WDRW Stranger', role: 'Vessel Admin', type: 'Office', rank: 'Technical Superintendent' };
const CE = { id: 'wdrw-ce', name: 'WDRW Chief Engineer', role: 'Vessel Admin', type: 'Ship', rank: 'Chief Engineer' };
const SECOND = { id: 'wdrw-2e', name: 'WDRW Second Engineer', role: 'Vessel User', type: 'Ship', rank: 'Second Engineer' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** work_orders.due_date is text — stored as DD-MM-YYYY or YYYY-MM-DD; compare as a calendar day. */
const isoDay = (v: unknown): string => {
  const s = String(v ?? '');
  const dmy = /^(\d{2})-(\d{2})-(\d{4})/.exec(s);
  return dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : s.slice(0, 10);
};

async function call(base: string, method: string, path: string, body: any, who: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json',
    'x-user-id': who.id, 'x-user-name': encodeURIComponent(who.name), 'x-user-role': encodeURIComponent(who.role), 'x-user-type': who.type, 'x-rank': who.rank };
  const r = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* not json */ }
  console.log(`   → ${base === SHIP ? 'SHIP ' : 'SHORE'} ${method} ${path} as ${who.name} ← ${r.status} ${text.slice(0, 150).replace(/\s+/g, ' ')}`);
  return { status: r.status, json, text };
}
let fails = 0; let passes = 0;
const check = (label: string, ok: boolean, detail = '') => { console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail ? '  — ' + detail : ''}`); ok ? passes++ : fails++; };
const hr = (t: string) => console.log(`\n── ${t}`);
const oneStep = (moduleId: string, screenId: string, classification: string) => ({
  scope: { moduleId, screenId, actionId: '' }, classification, mode: 'simple', label: `${TAG} chain`,
  nodes: [
    { key: 'step-1', type: 'approval-step', label: 'Office sign-off', ordinal: 0, quorum: { rule: 'any' }, slots: [{ roleId: ADMIN_RUID, roleLabel: 'Admin (OLDBUILD-MATCHED)' }] },
    { key: 'end', type: 'end', label: 'End', ordinal: 1 },
  ],
  edges: [{ from: 'step-1', to: 'end' }],
});
const engineReqs = (moduleId: string, screenId: string, ref: string) =>
  shoreSql(`SELECT requuid, status FROM apprv_requests WHERE module_id=$1 AND screen_id=$2 AND subject_ref=$3 ORDER BY submitted_at DESC`, [moduleId, screenId, ref]);
const withdrawnNotes = (ref: string) =>
  shoreSql(`SELECT user_uuid FROM approval_notifications WHERE subject_ref=$1 AND kind='withdrawn'`, [ref]);
const shoreWithdrawal = async (ref: string) => (await shoreSql(`SELECT outcome, outcome_note, requested_by_uuid FROM approval_withdrawals WHERE subject_ref=$1 ORDER BY requested_at DESC LIMIT 1`, [ref]))[0];

async function sync(label: string) {
  let r = await call(SHIP, 'POST', '/sync/trigger', { vesselId: V }, ADMIN);
  for (let attempt = 0; attempt < 6 && r.json && r.json.success === false && !r.json.batchUuid; attempt++) {
    await sleep(10000);
    r = await call(SHIP, 'POST', '/sync/trigger', { vesselId: V }, ADMIN);
  }
  const j = r.json || {};
  console.log(`   sync(${label}): ok=${j.success} pushed=${j.recordsPushed} pulled=${j.recordsPulled}`);
  await sleep(5000); // the shore arrival sweep runs right after the response
  return j;
}

const refs: string[] = [];
const defectIds: string[] = [];
async function cleanupShore() {
  if (refs.length) {
    await shoreSql(`DELETE FROM approval_notifications WHERE subject_ref = ANY($1)`, [refs]);
    await shoreSql(`DELETE FROM apprv_request_slots WHERE requuid IN (SELECT requuid FROM apprv_requests WHERE subject_ref = ANY($1))`, [refs]);
    await shoreSql(`DELETE FROM apprv_requests WHERE subject_ref = ANY($1)`, [refs]);
    await shoreSql(`DELETE FROM approval_withdrawals WHERE subject_ref = ANY($1)`, [refs]);
    await shoreSql(`DELETE FROM change_request WHERE cruuid = ANY($1)`, [refs]);
  }
  if (defectIds.length) await shoreSql(`DELETE FROM defects WHERE id = ANY($1)`, [defectIds]);
  await shoreSql(`DELETE FROM apprv_workflows WHERE label=$1`, [`${TAG} chain`]);
  await shoreSql(`DELETE FROM master_user_vessels WHERE user_uuid LIKE 'wdrw-%'`);
  await shoreSql(`DELETE FROM master_users WHERE id LIKE 'wdrw-%'`);
}

async function shipWo(job: any, label: string) {
  const due = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const woR = await call(SHIP, 'POST', '/work-orders', { vesselId: V, jobId: job.id, jobTitle: job.job_title, component: job.comp_name, componentCode: job.comp_code, componentId: job.comp_id,
    assignedTo: '2nd Engineer', approver: 'Chief Engineer', department: 'Engine', maintenanceBasis: 'Calendar', frequencyValue: '30', frequencyUnit: 'Days',
    dueDate: due, nextDueDate: due, status: 'Due', workOrderType: 'Planned', isExecution: false, briefWorkDescription: `${TAG} ${label}` }, CE);
  const wo = woR.json; if (wo?.wouuid) refs.push(wo.wouuid);
  const newDue = new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10);
  const p = await call(SHIP, 'POST', `/work-orders/${wo.id}/postpone-request`, { nextDueDate: newDue, reason: 'Awaiting spares.', postponementRemarks: TAG, userId: CE.id }, CE);
  return { wo, due, ok: woR.status < 300 && p.status < 300 };
}

(async () => {
  hr('0. set-up — users + one-step chains (spares CR, WO postponement, defect extension)');
  await shoreSql(`DELETE FROM apprv_workflows WHERE module_id='technical' AND screen_id IN ('pms-spares-cr','pms-wo-postponement')`);
  await shoreSql(`DELETE FROM apprv_workflows WHERE module_id='defects' AND screen_id='defects-extension' AND classification='Normal'`);
  for (const u of [APPROVER, ADMIN, OFFICE_SENDER, STRANGER, CE, SECOND]) {
    await shoreSql(`INSERT INTO master_users (id, full_name, role, user_type, is_deleted) VALUES ($1,$2,$3,$4,false)
      ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role, full_name=EXCLUDED.full_name, is_deleted=false`, [u.id, u.name, u.role, u.type]);
  }
  await shoreSql(`INSERT INTO master_user_vessels (user_uuid, vessel_id, is_active, map_status) VALUES ($1,$2,true,'unmapped')
    ON CONFLICT (user_uuid, vessel_id) DO UPDATE SET is_active=true`, [APPROVER.id, V]);
  check('chain: spares CR / Normal Spares', (await call(SHORE, 'POST', '/approval-engine/workflows', oneStep('technical', 'pms-spares-cr', 'Normal Spares'), ADMIN)).status === 201);
  check('chain: WO postponement / Normal WO', (await call(SHORE, 'POST', '/approval-engine/workflows', oneStep('technical', 'pms-wo-postponement', 'Normal WO'), ADMIN)).status === 201);
  check('chain: defect extension / Normal', (await call(SHORE, 'POST', '/approval-engine/workflows', oneStep('defects', 'defects-extension', 'Normal'), ADMIN)).status === 201);
  check('shore has the approval_withdrawals table (migration 178)', (await shoreSql(`SELECT to_regclass('approval_withdrawals') AS t`))[0].t !== null);
  check('ship has the approval_withdrawals table', shipSql(`SELECT to_regclass('approval_withdrawals') IS NOT NULL`) === 't');
  const base = await sync('baseline');
  check('baseline sync succeeds', base.success === true);

  const spare = (await shoreSql(`SELECT suuid, remarks FROM spares WHERE vessel_id=$1 AND is_deleted=false
    AND (critical IS NULL OR critical NOT IN ('Critical','Yes')) ORDER BY suuid DESC OFFSET 1 LIMIT 1`, [V]))[0];
  const job = (await shoreSql(`SELECT j.id, j.job_title, c.cuuid comp_id, c.name comp_name, c.component_code comp_code FROM jobs j JOIN components c ON c.cuuid = j.component_id
    WHERE j.vessel_id=$1 AND j.is_deleted=false AND (j.criticality IS NULL OR j.criticality <> 'Yes') AND (c.critical IS NOT TRUE) ORDER BY j.id LIMIT 1`, [V]))[0];
  check('a normal spare and a normal job exist on shore and ship', !!spare && !!job
    && shipSql(`SELECT count(*) FROM spares WHERE suuid='${spare.suuid}'`) === '1' && shipSql(`SELECT count(*) FROM jobs WHERE id='${job.id}'`) === '1');

  hr('W1. ship CR withdrawn on board → the office cancels it after sync');
  const crR = await call(SHIP, 'POST', '/change-requests', { vesselId: V, category: 'spares', title: `${TAG} ship CR`, reason: TAG, targetType: 'spare', targetId: spare.suuid,
    proposedChangesJson: [{ id: 1, field: 'remarks', oldValue: spare.remarks, newValue: 'WDRW-SHOULD-NOT-APPLY' }], status: 'submitted', requestedByUserId: CE.id }, CE);
  const cr = crR.json; if (cr?.cruuid) refs.push(cr.cruuid);
  await sync('W1a');
  check('shore: chain started for the ship CR', (await engineReqs('technical', 'pms-spares-cr', cr.cruuid))[0]?.status === 'pending');
  const st = await call(SHIP, 'GET', `/approvals/withdrawals/status?subjectType=change-request&subjectRef=${cr.cruuid}`, undefined, CE);
  check('SHIP: the sender sees Withdraw', st.status === 200 && st.json?.canWithdraw === true);
  const st2 = await call(SHIP, 'GET', `/approvals/withdrawals/status?subjectType=change-request&subjectRef=${cr.cruuid}`, undefined, SECOND);
  check('SHIP: another user does not', st2.status === 200 && st2.json?.canWithdraw === false && st2.json?.blockedReason === 'NOT_SENDER');
  check('SHIP: another user withdraws → 403', (await call(SHIP, 'POST', '/approvals/withdrawals', { subjectType: 'change-request', subjectRef: cr.cruuid }, SECOND)).status === 403);
  const w1 = await call(SHIP, 'POST', '/approvals/withdrawals', { subjectType: 'change-request', subjectRef: cr.cruuid, reason: 'Wrong spare' }, CE);
  check('SHIP: the sender withdraws → 201, waiting for the office', w1.status === 201 && w1.json?.outcome === null);
  check('SHIP: CR unchanged on board until the office settles it', shipSql(`SELECT status FROM change_request WHERE cruuid='${cr.cruuid}'`) === 'submitted');
  check('SHIP: a second withdrawal → 409 already asked', (await call(SHIP, 'POST', '/approvals/withdrawals', { subjectType: 'change-request', subjectRef: cr.cruuid }, CE)).status === 409);
  await sync('W1b');
  const w1s = await shoreWithdrawal(cr.cruuid);
  check('shore: withdrawal settled "withdrawn" with no approver action', w1s?.outcome === 'withdrawn', JSON.stringify(w1s ?? {}));
  check('shore: engine request withdrawn', (await engineReqs('technical', 'pms-spares-cr', cr.cruuid))[0]?.status === 'withdrawn');
  check('shore: CR back to draft', (await shoreSql(`SELECT status FROM change_request WHERE cruuid=$1`, [cr.cruuid]))[0]?.status === 'draft');
  check('shore: the approver got a "withdrawn" notification', (await withdrawnNotes(cr.cruuid)).some((n: any) => n.user_uuid === APPROVER.id));
  check('shore: the spare was NOT changed', (await shoreSql(`SELECT remarks FROM spares WHERE suuid=$1`, [spare.suuid]))[0].remarks === spare.remarks);
  await sync('W1c');
  check('SHIP: CR draft', shipSql(`SELECT status FROM change_request WHERE cruuid='${cr.cruuid}'`) === 'draft');
  check('SHIP: the withdrawal shows "withdrawn"', shipSql(`SELECT outcome FROM approval_withdrawals WHERE subject_ref='${cr.cruuid}'`) === 'withdrawn');

  hr('W2. ship postponement withdrawn, but the office approves first → too late');
  const p2 = await shipWo(job, 'too-late');
  check('SHIP: WO + postponement request', p2.ok);
  await sync('W2a');
  check('shore: postponement chain started', (await engineReqs('technical', 'pms-wo-postponement', p2.wo.wouuid))[0]?.status === 'pending');
  check('SHIP: the sender withdraws → 201', (await call(SHIP, 'POST', '/approvals/withdrawals', { subjectType: 'wo-postponement', subjectRef: p2.wo.id }, CE)).status === 201);
  const ap = await call(SHORE, 'POST', `/work-orders/${p2.wo.id}/postpone-approve`, { approvedBy: APPROVER.name, approvalRemarks: 'ok', userUuid: APPROVER.id, role: 'Office' }, APPROVER);
  check('shore: approver approves before the withdrawal arrives', ap.status < 300);
  await sync('W2b');
  const w2s = await shoreWithdrawal(p2.wo.wouuid);
  check('shore: withdrawal "too-late"', w2s?.outcome === 'too-late', JSON.stringify(w2s ?? {}));
  check('shore: the approval stands (Postponement Approved)', (await shoreSql(`SELECT status FROM work_orders WHERE wouuid=$1`, [p2.wo.wouuid]))[0]?.status === 'Postponement Approved');
  await sync('W2c');
  check('SHIP: the too-late note arrived', shipSql(`SELECT outcome FROM approval_withdrawals WHERE subject_ref='${p2.wo.wouuid}'`) === 'too-late');
  check('SHIP: WO Postponement Approved', shipSql(`SELECT status FROM work_orders WHERE wouuid='${p2.wo.wouuid}'`) === 'Postponement Approved');

  hr('W3. ship postponement withdrawn in time → WO keeps its original date');
  const p3 = await shipWo(job, 'in-time');
  await sync('W3a');
  check('shore: chain started', (await engineReqs('technical', 'pms-wo-postponement', p3.wo.wouuid))[0]?.status === 'pending');
  check('SHIP: the sender withdraws → 201', (await call(SHIP, 'POST', '/approvals/withdrawals', { subjectType: 'wo-postponement', subjectRef: p3.wo.id, reason: 'Spares arrived' }, CE)).status === 201);
  await sync('W3b');
  const w3wo = (await shoreSql(`SELECT status, due_date FROM work_orders WHERE wouuid=$1`, [p3.wo.wouuid]))[0];
  check('shore: withdrawal settled "withdrawn"', (await shoreWithdrawal(p3.wo.wouuid))?.outcome === 'withdrawn');
  check('shore: engine request withdrawn', (await engineReqs('technical', 'pms-wo-postponement', p3.wo.wouuid))[0]?.status === 'withdrawn');
  check('shore: WO no longer awaiting, original due date kept', w3wo?.status !== 'Awaiting Office Approval' && isoDay(w3wo?.due_date) === p3.due, JSON.stringify(w3wo ?? {}));
  check('shore: decision row recorded as Withdrawn', (await shoreSql(`SELECT count(*)::int n FROM work_order_postponements WHERE work_order_id=$1 AND status='Withdrawn'`, [p3.wo.wouuid]))[0].n === 1);
  check('shore: the approver got a "withdrawn" notification', (await withdrawnNotes(p3.wo.wouuid)).some((n: any) => n.user_uuid === APPROVER.id));
  await sync('W3c');
  check('SHIP: WO no longer awaiting', shipSql(`SELECT status FROM work_orders WHERE wouuid='${p3.wo.wouuid}'`) !== 'Awaiting Office Approval');
  const shipDue = shipSql(`SELECT due_date FROM work_orders WHERE wouuid='${p3.wo.wouuid}'`);
  check('SHIP: original due date kept', isoDay(shipDue) === p3.due, shipDue);

  hr('W4. shore CR withdrawn by its sender in the office → settled at once');
  const crS = await call(SHORE, 'POST', '/change-requests', { vesselId: V, category: 'spares', title: `${TAG} office CR`, reason: TAG, targetType: 'spare', targetId: spare.suuid,
    proposedChangesJson: [{ id: 1, field: 'remarks', oldValue: spare.remarks, newValue: 'WDRW-OFFICE' }], status: 'submitted', requestedByUserId: OFFICE_SENDER.id }, OFFICE_SENDER);
  const cr4 = crS.json; if (cr4?.cruuid) refs.push(cr4.cruuid);
  check('shore: chain started', (await engineReqs('technical', 'pms-spares-cr', cr4.cruuid))[0]?.status === 'pending');
  check('shore: a stranger withdraws → 403', (await call(SHORE, 'POST', '/approvals/withdrawals', { subjectType: 'change-request', subjectRef: cr4.cruuid }, STRANGER)).status === 403);
  const w4 = await call(SHORE, 'POST', '/approvals/withdrawals', { subjectType: 'change-request', subjectRef: cr4.cruuid }, OFFICE_SENDER);
  check('shore: the sender withdraws → 201 "withdrawn" at once', w4.status === 201 && w4.json?.outcome === 'withdrawn');
  check('shore: CR draft + engine request withdrawn', (await shoreSql(`SELECT status FROM change_request WHERE cruuid=$1`, [cr4.cruuid]))[0]?.status === 'draft'
    && (await engineReqs('technical', 'pms-spares-cr', cr4.cruuid))[0]?.status === 'withdrawn');
  const hist = await call(SHORE, 'GET', `/approvals/withdrawals?subjectRef=${cr4.cruuid}`, undefined, STRANGER);
  check('history: "withdrawn by" name and date recorded', hist.status === 200 && hist.json?.[0]?.requestedByName && hist.json?.[0]?.outcomeAt);

  hr('W5. shore defect extension');
  const comp = (await shoreSql(`SELECT cuuid FROM components WHERE vessel_id=$1 AND cuuid IS NOT NULL AND critical IS NOT TRUE LIMIT 1`, [V]))[0];
  const dR = await call(SHORE, 'POST', '/defects', { vesselId: V, vesselName: 'WK Frontier Pilot', description: `${TAG} defect`, category: 'Defect',
    issueDate: '2026-09-01', reportedBy: TAG, status: 'Open', targetCloseDate: '2026-09-10', equipmentCategory: TAG, componentId: comp.cuuid, is_coc: false, critical: false }, CE);
  const d = (await shoreSql(`SELECT id, duuid, target_close_date FROM defects WHERE id=$1`, [dR.json?.id]))[0];
  defectIds.push(d.id); refs.push(d.duuid);
  const entry = { id: 'EXT-WDRW-1', existingTargetDate: '2026-09-10', newTargetDate: '2026-10-10', reasonForExtension: TAG,
    submitForApprovalTo: '', submitForApprovalToName: '', status: 'Requested', approvalDate: '', approverComments: '', requestedAt: new Date().toISOString() };
  check('extension requested → chain started', (await call(SHORE, 'PATCH', `/defects/${d.id}`, { targetDateExtensions: [entry] }, CE)).status < 300
    && (await engineReqs('defects', 'defects-extension', d.duuid))[0]?.status === 'pending');
  const stored = (await shoreSql(`SELECT target_date_extensions t FROM defects WHERE id=$1`, [d.id]))[0].t;
  check('the requester is stamped by the server', stored?.[0]?.requestedByUserId === CE.id, JSON.stringify(stored?.[0] ?? {}));
  const forged = await call(SHORE, 'PATCH', `/defects/${d.id}`, { targetDateExtensions: [{ ...stored[0], requestedByUserId: STRANGER.id }] }, STRANGER);
  check('a browser cannot change the requester', (await shoreSql(`SELECT target_date_extensions t FROM defects WHERE id=$1`, [d.id]))[0].t?.[0]?.requestedByUserId === CE.id, `PATCH ${forged.status}`);
  check('stranger withdraws → 403', (await call(SHORE, 'POST', '/approvals/withdrawals', { subjectType: 'defect-extension', subjectRef: d.id, extensionId: entry.id }, STRANGER)).status === 403);
  check('a defect verification cannot be withdrawn → 400', (await call(SHORE, 'POST', '/approvals/withdrawals', { subjectType: 'defect-verification', subjectRef: d.id }, CE)).status === 400);
  const w5 = await call(SHORE, 'POST', '/approvals/withdrawals', { subjectType: 'defect-extension', subjectRef: d.id, extensionId: entry.id }, CE);
  const after = (await shoreSql(`SELECT target_date_extensions t, target_close_date FROM defects WHERE id=$1`, [d.id]))[0];
  check('sender withdraws → "withdrawn"', w5.status === 201 && w5.json?.outcome === 'withdrawn');
  check('entry marked Withdrawn, target date unchanged', after.t?.[0]?.status === 'Withdrawn' && String(after.target_close_date) === String(d.target_close_date), JSON.stringify(after));
  check('engine request withdrawn + approver notified', (await engineReqs('defects', 'defects-extension', d.duuid))[0]?.status === 'withdrawn'
    && (await withdrawnNotes(d.duuid)).some((n: any) => n.user_uuid === APPROVER.id));
  const entry2 = { ...entry, id: 'EXT-WDRW-2', requestedAt: new Date().toISOString() };
  const again = await call(SHORE, 'PATCH', `/defects/${d.id}`, { targetDateExtensions: [after.t[0], entry2] }, CE);
  check('a new extension can be asked afterwards → new chain', again.status < 300 && (await engineReqs('defects', 'defects-extension', d.duuid))[0]?.status === 'pending');

  hr('cleanup (shore)');
  await cleanupShore();
  console.log(`\nRESULT: ${passes} passed, ${fails} failed`);
  await pool.end();
  process.exit(fails ? 1 : 0);
})().catch(async (e) => { console.error('HARNESS ERROR:', e); try { await cleanupShore(); } catch { /* best effort */ } await pool.end(); process.exit(1); });
