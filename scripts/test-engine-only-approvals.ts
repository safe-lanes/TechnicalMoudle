/**
 * Regression harness — Technical approvals run on the ENGINE ONLY (25-Sep-2026).
 * The old Level 1 / Level 2 ticks (approval_workflow_config) are retired:
 *   1. no active chain            → submit BLOCKED with a message, nothing changes, no old step rows
 *   2. scope switched off         → submit BLOCKED ("switched off")
 *   3. chain set up               → submit starts the chain; an enabled OLD tick creates no step rows
 *   4. only the engine decides    → a non-approver is refused; the approver's decision applies
 *   5. in-flight OLD steps        → a CR submitted before cutover (Pending Level 1 row) is refused
 *                                   a direct approve; once its chain runs, the old row is Superseded
 *   6. postponement               → blocked without a chain; runs through the chain with one
 *   7. Work-Order-target CR       → exempt (no engine action by decision) — approves as before
 *
 * Runs against a THROWAWAY shore (default :5077) on a THROWAWAY database (default pms_ae_test);
 * it refuses any database whose name does not end in _test. Cleans up everything it creates.
 *   npx tsx scripts/test-engine-only-approvals.ts
 */
import { Pool } from 'pg';

const BASE = process.env.AE_TEST_BASE || 'http://localhost:5077/technical/api';
const DB = process.env.AE_TEST_DB || 'pms_ae_test';
if (!DB.endsWith('_test')) { console.error(`refusing: database '${DB}' is not a *_test database`); process.exit(2); }
const pool = new Pool({ connectionString: `postgres://postgres:admin123@localhost:5432/${DB}` });
const sql = async (q: string, p: any[] = []) => (await pool.query(q, p)).rows;

const V = '743ef9d1-841a-11ed-aa7c-7003bca91a86'; // WK Frontier Pilot
const ADMIN_RUID = '28893a97-e475-4e19-afc5-d17f1b9adbb6'; // Admin (OLDBUILD-MATCHED), Office
const TAG = 'EOA';
const APPROVER = { id: 'eoa-approver', name: 'EOA Approver', role: 'Admin (OLDBUILD-MATCHED)', type: 'Office', rank: 'Technical Superintendent' };
const STRANGER = { id: 'eoa-stranger', name: 'EOA Stranger', role: 'Office', type: 'Office', rank: 'Technical Superintendent' };
const ADMIN = { id: 'eoa-admin', name: 'EOA Admin', role: 'Sail Admin', type: 'Office', rank: 'Technical Superintendent' };
const SHIPUSER = { id: 'eoa-ship', name: 'EOA Ship User', role: 'Vessel User', type: 'Ship', rank: 'Third Engineer' };
const AE = '/approval-engine';
const scope = (screenId: string) => ({ moduleId: 'technical', screenId, actionId: '' });

async function call(method: string, path: string, body: any, who: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json',
    'x-user-id': who.id, 'x-user-name': encodeURIComponent(who.name), 'x-user-role': encodeURIComponent(who.role), 'x-user-type': who.type, 'x-rank': who.rank };
  const r = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* not json */ }
  console.log(`   → ${method} ${path} as ${who.role} ← ${r.status} ${text.slice(0, 150).replace(/\s+/g, ' ')}`);
  return { status: r.status, json, text };
}
let fails = 0; let passes = 0;
const check = (label: string, ok: boolean) => { console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${label}`); ok ? passes++ : fails++; };
const hr = (t: string) => console.log(`\n── ${t}`);
const oneStep = (screenId: string, classification: string) => ({
  scope: scope(screenId), classification, mode: 'simple', label: `${TAG} chain`,
  nodes: [
    { key: 'step-1', type: 'approval-step', label: 'Office sign-off', ordinal: 0, quorum: { rule: 'any' }, slots: [{ roleId: ADMIN_RUID, roleLabel: 'Admin (OLDBUILD-MATCHED)' }] },
    { key: 'end', type: 'end', label: 'End', ordinal: 1 },
  ],
  edges: [{ from: 'step-1', to: 'end' }],
});
const engineReqs = (screenId: string, ref: string) =>
  sql(`SELECT requuid, status FROM apprv_requests WHERE module_id='technical' AND screen_id=$1 AND subject_ref=$2 ORDER BY submitted_at DESC`, [screenId, ref]);

const created = { crIds: [] as number[], woIds: [] as string[] };

async function cleanup() {
  const crs = created.crIds.length ? await sql(`SELECT cruuid FROM change_request WHERE id = ANY($1)`, [created.crIds]) : [];
  const refs = [...crs.map((r: any) => r.cruuid)];
  const wos = created.woIds.length ? await sql(`SELECT wouuid FROM work_orders WHERE id = ANY($1)`, [created.woIds]) : [];
  refs.push(...wos.map((r: any) => r.wouuid));
  if (refs.length) {
    await sql(`DELETE FROM apprv_request_slots WHERE requuid IN (SELECT requuid FROM apprv_requests WHERE subject_ref = ANY($1))`, [refs]);
    await sql(`DELETE FROM apprv_requests WHERE subject_ref = ANY($1)`, [refs]);
  }
  // Rows deleted below must not leave sync_field_log entries behind — a ship can never pull a
  // change for a row that no longer exists (it would sit in 'remaining to pull' forever).
  if (created.crIds.length) {
    await sql(`DELETE FROM sync_field_log WHERE row_uuid IN (SELECT crauuid FROM change_request_approval WHERE change_request_id = ANY($1))`, [created.crIds]);
    await sql(`DELETE FROM sync_field_log WHERE row_uuid IN (SELECT cruuid FROM change_request WHERE id = ANY($1))`, [created.crIds]);
  }
  if (wos.length) {
    const u = wos.map((r: any) => r.wouuid);
    await sql(`DELETE FROM sync_field_log WHERE row_uuid IN (SELECT wpauuid FROM wo_postponement_approvals WHERE work_order_id = ANY($1))`, [u]);
    await sql(`DELETE FROM sync_field_log WHERE row_uuid IN (SELECT id::text FROM work_order_postponements WHERE work_order_id = ANY($1))`, [u]);
    await sql(`DELETE FROM sync_field_log WHERE row_uuid = ANY($1)`, [u]);
  }
  if (created.crIds.length) {
    await sql(`DELETE FROM change_request_approval WHERE change_request_id = ANY($1)`, [created.crIds]);
    await sql(`DELETE FROM change_request WHERE id = ANY($1)`, [created.crIds]);
  }
  if (wos.length) {
    const u = wos.map((r: any) => r.wouuid);
    await sql(`DELETE FROM wo_postponement_approvals WHERE work_order_id = ANY($1)`, [u]);
    await sql(`DELETE FROM work_order_postponements WHERE work_order_id = ANY($1)`, [u]);
    await sql(`DELETE FROM work_orders WHERE wouuid = ANY($1)`, [u]);
  }
  await sql(`DELETE FROM apprv_workflows WHERE label = $1`, [`${TAG} chain`]);
  await sql(`DELETE FROM apprv_scope_settings WHERE module_id='technical' AND screen_id IN ('pms-spares-cr','pms-wo-postponement')`);
  await sql(`DELETE FROM master_user_vessels WHERE user_uuid LIKE 'eoa-%'`);
  await sql(`DELETE FROM master_users WHERE id LIKE 'eoa-%'`);
  await sql(`UPDATE approval_workflow_config SET level1_enabled=false WHERE function_id='pms-spares-cr' AND variable_name='Normal Spares'`);
}

(async () => {
  hr('0. set-up (throwaway DB) — no Technical chains for spares CR / WO postponement');
  await sql(`DELETE FROM apprv_workflows WHERE module_id='technical' AND screen_id IN ('pms-spares-cr','pms-wo-postponement')`);
  for (const u of [APPROVER, STRANGER, ADMIN, SHIPUSER]) {
    await sql(`INSERT INTO master_users (id, full_name, role, user_type, is_deleted) VALUES ($1,$2,$3,$4,false)
      ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role, is_deleted=false`, [u.id, u.name, u.role, u.type]);
  }
  await sql(`INSERT INTO master_user_vessels (user_uuid, vessel_id, is_active, map_status) VALUES ($1,$2,true,'unmapped')
    ON CONFLICT (user_uuid, vessel_id) DO UPDATE SET is_active=true`, [APPROVER.id, V]);
  // An OLD tick switched ON — it must be ignored (no step rows) from now on.
  await sql(`UPDATE approval_workflow_config SET level1_enabled=true WHERE function_id='pms-spares-cr' AND variable_name='Normal Spares'`);
  const spare = (await sql(`SELECT suuid, remarks FROM spares WHERE vessel_id=$1 AND is_deleted=false
    AND (critical IS NULL OR critical NOT IN ('Critical','Yes')) ORDER BY suuid LIMIT 1`, [V]))[0];
  check('found a normal spare on the pilot vessel', !!spare);
  const newCr = (title: string, value: string, who = SHIPUSER) => call('POST', '/change-requests', {
    vesselId: V, category: 'spares', title, reason: TAG, targetType: 'spare', targetId: spare.suuid,
    proposedChangesJson: [{ id: 1, field: 'remarks', oldValue: spare.remarks, newValue: value }], status: 'submitted', requestedByUserId: who.id }, who);
  const trackDraft = async (title: string) => {
    const r = await sql(`SELECT id, status FROM change_request WHERE title=$1 ORDER BY id DESC LIMIT 1`, [title]);
    if (r[0]) created.crIds.push(Number(r[0].id));
    return r[0];
  };

  hr('1. no chain → CR submit BLOCKED');
  const r1 = await newCr(`${TAG} no chain`, 'EOA-SHOULD-NOT-APPLY');
  const d1 = await trackDraft(`${TAG} no chain`);
  check('HTTP 400 with the "not set up" message', r1.status === 400 && /No approval workflow is set up for "Modify PMS — Spare Change Requests" \(Normal Spares\)/.test(r1.json?.error ?? ''));
  check('CR stays a draft (not submitted)', d1?.status === 'draft');
  check('no old Level 1/2 step rows created', Number((await sql(`SELECT count(*) c FROM change_request_approval WHERE change_request_id=$1`, [d1.id]))[0].c) === 0);

  hr('2. scope switched off → BLOCKED ("switched off")');
  check('admin switches the scope off', (await call('PUT', `${AE}/scopes/enabled`, { scope: scope('pms-spares-cr'), enabled: false }, ADMIN)).status === 200);
  const r2 = await newCr(`${TAG} disabled`, 'EOA-SHOULD-NOT-APPLY');
  await trackDraft(`${TAG} disabled`);
  check('HTTP 400 "switched off"', r2.status === 400 && /is switched off/.test(r2.json?.error ?? ''));
  check('admin switches the scope back on', (await call('PUT', `${AE}/scopes/enabled`, { scope: scope('pms-spares-cr'), enabled: true }, ADMIN)).status === 200);

  hr('3. chain set up → submit starts the chain; the old tick creates nothing');
  check('admin saves a 1-step chain (Normal Spares)', (await call('POST', `${AE}/workflows`, oneStep('pms-spares-cr', 'Normal Spares'), ADMIN)).status === 201);
  const r3 = await newCr(`${TAG} with chain`, 'EOA-ENGINE-APPLIED');
  const cr3 = r3.json; if (cr3?.id) created.crIds.push(Number(cr3.id));
  check('submit → 2xx, CR submitted', r3.status < 300 && cr3?.status === 'submitted');
  check('engine chain pending', (await engineReqs('pms-spares-cr', cr3.cruuid))[0]?.status === 'pending');
  check('no old step rows although the old Level 1 tick is ON', Number((await sql(`SELECT count(*) c FROM change_request_approval WHERE change_request_id=$1`, [cr3.id]))[0].c) === 0);

  hr('4. only the engine decides');
  check('non-approver office user → 403', (await call('PUT', `/change-requests/${cr3.id}/approve`, { comment: 'me?' }, STRANGER)).status === 403);
  const a4 = await call('PUT', `/change-requests/${cr3.id}/approve`, { comment: 'ok' }, APPROVER);
  const after4 = (await sql(`SELECT status FROM change_request WHERE id=$1`, [cr3.id]))[0];
  check('approver → CR approved', a4.status < 300 && after4.status === 'approved');
  check('spare value applied', (await sql(`SELECT remarks FROM spares WHERE suuid=$1`, [spare.suuid]))[0].remarks === 'EOA-ENGINE-APPLIED');
  check('engine request approved', (await engineReqs('pms-spares-cr', cr3.cruuid))[0]?.status === 'approved');
  await sql(`UPDATE spares SET remarks=$1 WHERE suuid=$2`, [spare.remarks, spare.suuid]);

  hr('5. in-flight CR from before the cutover (Pending old Level 1 row, no chain yet)');
  const d5 = await call('POST', '/change-requests', { vesselId: V, category: 'spares', title: `${TAG} in-flight`, reason: TAG, targetType: 'spare', targetId: spare.suuid,
    proposedChangesJson: [{ id: 1, field: 'remarks', oldValue: spare.remarks, newValue: 'EOA-INFLIGHT-APPLIED' }], status: 'draft', requestedByUserId: SHIPUSER.id }, SHIPUSER);
  const cr5 = d5.json; created.crIds.push(Number(cr5.id));
  await sql(`UPDATE change_request SET status='submitted', submitted_at=now() WHERE id=$1`, [cr5.id]);
  await sql(`INSERT INTO change_request_approval (change_request_id, change_request_uuid, approval_level, status) VALUES ($1,$2,'Level 1','Pending')`, [cr5.id, cr5.cruuid]);
  const a5 = await call('PUT', `/change-requests/${cr5.id}/approve`, { comment: 'direct' }, APPROVER);
  check('direct approve with no chain started → 409 "not started yet"', a5.status === 409 && /has not started its approval workflow yet/.test(a5.json?.error ?? ''));
  check('Sail Admin direct approve is refused too (no bypass)', (await call('PUT', `/change-requests/${cr5.id}/approve`, { comment: 'admin' }, ADMIN)).status === 409);
  const s5 = await call('POST', `${AE}/requests`, { scope: scope('pms-spares-cr'), subjectRef: cr5.cruuid, subject: { kind: 'cr', targetType: 'spare', targetId: spare.suuid }, vesselId: V }, APPROVER);
  check('chain started for the in-flight CR (what the shore sweep does after sync)', s5.status < 300 && (await engineReqs('pms-spares-cr', cr5.cruuid))[0]?.status === 'pending');
  const a5b = await call('PUT', `/change-requests/${cr5.id}/approve`, { comment: 'via chain' }, APPROVER);
  check('approver → CR approved', a5b.status < 300 && (await sql(`SELECT status FROM change_request WHERE id=$1`, [cr5.id]))[0].status === 'approved');
  check('old Level 1 row kept and marked Superseded', (await sql(`SELECT status FROM change_request_approval WHERE change_request_id=$1`, [cr5.id]))[0]?.status === 'Superseded');
  await sql(`UPDATE spares SET remarks=$1 WHERE suuid=$2`, [spare.remarks, spare.suuid]);

  hr('6. WO postponement');
  const job = (await sql(`SELECT j.id, j.job_title, c.cuuid comp_id, c.name comp_name, c.component_code comp_code FROM jobs j JOIN components c ON c.cuuid = j.component_id
    WHERE j.vessel_id=$1 AND j.is_deleted=false AND (j.criticality IS NULL OR j.criticality <> 'Yes') AND (c.critical IS NOT TRUE) ORDER BY j.id LIMIT 1`, [V]))[0];
  const due = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const newDue = new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10);
  const wo = (await call('POST', '/work-orders', { vesselId: V, jobId: job.id, jobTitle: job.job_title, component: job.comp_name, componentCode: job.comp_code, componentId: job.comp_id, assignedTo: '2nd Engineer', approver: 'Chief Engineer',
    department: 'Engine', maintenanceBasis: 'Calendar', frequencyValue: '30', frequencyUnit: 'Days', dueDate: due, nextDueDate: due, status: 'Due',
    workOrderType: 'Planned', isExecution: false, briefWorkDescription: `${TAG} postpone` }, APPROVER)).json;
  created.woIds.push(wo.id);
  const statusBefore = (await sql(`SELECT status FROM work_orders WHERE id=$1`, [wo.id]))[0].status;
  const p1 = await call('POST', `/work-orders/${wo.id}/postpone-request`, { nextDueDate: newDue, reason: 'Awaiting spares.', postponementRemarks: TAG, userId: SHIPUSER.id }, SHIPUSER);
  check('no chain → 400 "not set up" (Work Order Postponement / Normal WO)', p1.status === 400 && /No approval workflow is set up for "Work Order Postponement" \(Normal WO\)/.test(p1.json?.error ?? ''));
  check('WO status unchanged, no postponement row', (await sql(`SELECT status FROM work_orders WHERE id=$1`, [wo.id]))[0].status === statusBefore
    && Number((await sql(`SELECT count(*) c FROM work_order_postponements WHERE work_order_id=$1`, [wo.wouuid]))[0].c) === 0);
  check('admin saves a 1-step chain (Normal WO)', (await call('POST', `${AE}/workflows`, oneStep('pms-wo-postponement', 'Normal WO'), ADMIN)).status === 201);
  const p2 = await call('POST', `/work-orders/${wo.id}/postpone-request`, { nextDueDate: newDue, reason: 'Awaiting spares.', postponementRemarks: TAG, userId: SHIPUSER.id }, SHIPUSER);
  check('with chain → 2xx, WO Awaiting Office Approval, chain pending, no old step rows', p2.status < 300
    && (await sql(`SELECT status FROM work_orders WHERE id=$1`, [wo.id]))[0].status === 'Awaiting Office Approval'
    && (await engineReqs('pms-wo-postponement', wo.wouuid))[0]?.status === 'pending'
    && Number((await sql(`SELECT count(*) c FROM wo_postponement_approvals WHERE work_order_id=$1`, [wo.wouuid]))[0].c) === 0);
  check('non-approver → 403', (await call('POST', `/work-orders/${wo.id}/postpone-approve`, { approvedBy: STRANGER.name, approvalRemarks: 'me?', userUuid: STRANGER.id, role: 'Office' }, STRANGER)).status === 403);
  const p3 = await call('POST', `/work-orders/${wo.id}/postpone-approve`, { approvedBy: APPROVER.name, approvalRemarks: 'ok', userUuid: APPROVER.id, role: 'Office' }, APPROVER);
  check('approver → Postponement Approved', p3.status < 300 && (await sql(`SELECT status FROM work_orders WHERE id=$1`, [wo.id]))[0].status === 'Postponement Approved');

  hr('7. Work-Order-target CR is exempt (no engine action by decision)');
  const r7 = await call('POST', '/change-requests', { vesselId: V, category: 'work_orders', title: `${TAG} wo-target`, reason: TAG, targetType: 'work_order', targetId: wo.id,
    proposedChangesJson: [{ id: 1, field: 'briefWorkDescription', oldValue: `${TAG} postpone`, newValue: `${TAG} postpone (edited)` }], status: 'submitted', requestedByUserId: SHIPUSER.id }, SHIPUSER);
  if (r7.json?.id) created.crIds.push(Number(r7.json.id));
  check('submit → 2xx (not blocked)', r7.status < 300 && r7.json?.status === 'submitted');
  const a7 = await call('PUT', `/change-requests/${r7.json.id}/approve`, { comment: 'ok' }, APPROVER);
  check('office approve → approved, as before', a7.status < 300 && (await sql(`SELECT status FROM change_request WHERE id=$1`, [r7.json.id]))[0].status === 'approved');

  hr('cleanup');
  await cleanup();
  const left = await sql(`SELECT (SELECT count(*) FROM change_request WHERE title LIKE 'EOA %') cr, (SELECT count(*) FROM master_users WHERE id LIKE 'eoa-%') u,
    (SELECT count(*) FROM apprv_workflows WHERE label='EOA chain') wf`);
  console.log(`   remaining: ${JSON.stringify(left[0])}`);
  console.log(`\nRESULT: ${passes} passed, ${fails} failed`);
  await pool.end();
  process.exit(fails ? 1 : 0);
})().catch(async (e) => { console.error('HARNESS ERROR:', e); try { await cleanup(); } catch { /* best effort */ } await pool.end(); process.exit(1); });
