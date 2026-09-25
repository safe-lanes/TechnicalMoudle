/**
 * Regression harness — SHIP leg of engine-only Technical approvals (25-Sep-2026).
 * Needs a provisioned shore+ship pair built from this tree:
 *   shore  AE_TEST_BASE      (default http://localhost:5077/technical/api, DB AE_TEST_DB=pms_ae_test)
 *   ship   AE_TEST_SHIP_BASE (default http://localhost:5177/technical/api, container AE_TEST_SHIP=pms-ship-ae)
 *
 *   S1  no chain on shore → the SHIP still accepts a CR and a postponement request (it cannot know);
 *       after sync they wait on shore (no engine request); a direct shore approve is refused.
 *   S2  the ship cannot decide: a direct approve on the ship → 403 "approval happens in the office".
 *   S3  admin sets the chains on shore → next sync, the arrival sweep starts both chains.
 *   S4  approver decides on shore → CR approved + spare value applied; WO Postponement Approved;
 *       after sync the SHIP shows both results.
 *   S5  re-postponement on the ship is no longer refused for missing old configuration.
 *
 * Refuses a shore DB not ending in _test. Cleans up shore rows it creates; the ship container is
 * a throwaway (reset by re-provisioning).
 *   npx tsx scripts/test-engine-only-approvals-ship.ts
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
const TAG = 'EOAS';
const APPROVER = { id: 'eoas-approver', name: 'EOAS Approver', role: 'Admin (OLDBUILD-MATCHED)', type: 'Office', rank: 'Technical Superintendent' };
const ADMIN = { id: 'eoas-admin', name: 'EOAS Admin', role: 'Sail Admin', type: 'Office', rank: 'Technical Superintendent' };
const CE = { id: 'eoas-ce', name: 'EOAS Chief Engineer', role: 'Vessel Admin', type: 'Ship', rank: 'Chief Engineer' };
const scope = (screenId: string) => ({ moduleId: 'technical', screenId, actionId: '' });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(base: string, method: string, path: string, body: any, who: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json',
    'x-user-id': who.id, 'x-user-name': encodeURIComponent(who.name), 'x-user-role': encodeURIComponent(who.role), 'x-user-type': who.type, 'x-rank': who.rank };
  const r = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* not json */ }
  console.log(`   → ${base === SHIP ? 'SHIP ' : 'SHORE'} ${method} ${path} as ${who.role} ← ${r.status} ${text.slice(0, 140).replace(/\s+/g, ' ')}`);
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
  shoreSql(`SELECT requuid, status FROM apprv_requests WHERE module_id='technical' AND screen_id=$1 AND subject_ref=$2 ORDER BY submitted_at DESC`, [screenId, ref]);

async function sync(label: string) {
  const r = await call(SHIP, 'POST', '/sync/trigger', { vesselId: V }, ADMIN);
  const j = r.json || {};
  console.log(`   sync(${label}): ok=${j.success} pushed=${j.recordsPushed} pulled=${j.recordsPulled} remainPush=${j.remainingPush} remainPull=${j.remainingPull}`);
  await sleep(4000); // the shore arrival sweep runs right after the response (fire-and-forget)
  return j;
}

const cleanupRefs: string[] = [];
async function cleanupShore() {
  if (cleanupRefs.length) {
    await shoreSql(`DELETE FROM apprv_request_slots WHERE requuid IN (SELECT requuid FROM apprv_requests WHERE subject_ref = ANY($1))`, [cleanupRefs]);
    await shoreSql(`DELETE FROM apprv_requests WHERE subject_ref = ANY($1)`, [cleanupRefs]);
  }
  await shoreSql(`DELETE FROM apprv_workflows WHERE label=$1`, [`${TAG} chain`]);
  await shoreSql(`DELETE FROM master_user_vessels WHERE user_uuid LIKE 'eoas-%'`);
  await shoreSql(`DELETE FROM master_users WHERE id LIKE 'eoas-%'`);
}

(async () => {
  hr('0. set-up — shore users, NO Technical chains for spares CR / WO postponement / re-postponement');
  await shoreSql(`DELETE FROM apprv_workflows WHERE module_id='technical' AND screen_id IN ('pms-spares-cr','pms-wo-postponement','pms-wo-re-postponement')`);
  for (const u of [APPROVER, ADMIN]) {
    await shoreSql(`INSERT INTO master_users (id, full_name, role, user_type, is_deleted) VALUES ($1,$2,$3,$4,false)
      ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role, is_deleted=false`, [u.id, u.name, u.role, u.type]);
  }
  await shoreSql(`INSERT INTO master_user_vessels (user_uuid, vessel_id, is_active, map_status) VALUES ($1,$2,true,'unmapped')
    ON CONFLICT (user_uuid, vessel_id) DO UPDATE SET is_active=true`, [APPROVER.id, V]);
  const base = await sync('baseline');
  check('baseline sync succeeds', base.success === true);

  const spare = (await shoreSql(`SELECT suuid, remarks FROM spares WHERE vessel_id=$1 AND is_deleted=false
    AND (critical IS NULL OR critical NOT IN ('Critical','Yes')) ORDER BY suuid LIMIT 1`, [V]))[0];
  const job = (await shoreSql(`SELECT j.id, j.job_title, c.cuuid comp_id, c.name comp_name, c.component_code comp_code FROM jobs j JOIN components c ON c.cuuid = j.component_id
    WHERE j.vessel_id=$1 AND j.is_deleted=false AND (j.criticality IS NULL OR j.criticality <> 'Yes') AND (c.critical IS NOT TRUE) ORDER BY j.id LIMIT 1`, [V]))[0];
  check('shore has a normal spare and a normal job; both exist on the ship',
    !!spare && !!job && shipSql(`SELECT count(*) FROM spares WHERE suuid='${spare.suuid}'`) === '1' && shipSql(`SELECT count(*) FROM jobs WHERE id='${job.id}'`) === '1');

  hr('S1. ship raises a CR and a postponement while NO chain exists on shore');
  const crR = await call(SHIP, 'POST', '/change-requests', { vesselId: V, category: 'spares', title: `${TAG} ship CR`, reason: TAG, targetType: 'spare', targetId: spare.suuid,
    proposedChangesJson: [{ id: 1, field: 'remarks', oldValue: spare.remarks, newValue: 'EOAS-SHIP-CR-APPLIED' }], status: 'submitted', requestedByUserId: CE.id }, CE);
  const cr = crR.json; if (cr?.cruuid) cleanupRefs.push(cr.cruuid);
  check('SHIP accepts the CR (it cannot see shore chains) → submitted, no old step rows',
    crR.status < 300 && cr?.status === 'submitted' && shipSql(`SELECT count(*) FROM change_request_approval WHERE change_request_uuid='${cr.cruuid}'`) === '0');
  const due = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const newDue = new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10);
  const woR = await call(SHIP, 'POST', '/work-orders', { vesselId: V, jobId: job.id, jobTitle: job.job_title, component: job.comp_name, componentCode: job.comp_code, componentId: job.comp_id,
    assignedTo: '2nd Engineer', approver: 'Chief Engineer', department: 'Engine', maintenanceBasis: 'Calendar', frequencyValue: '30', frequencyUnit: 'Days',
    dueDate: due, nextDueDate: due, status: 'Due', workOrderType: 'Planned', isExecution: false, briefWorkDescription: `${TAG} postpone` }, CE);
  const wo = woR.json; if (wo?.wouuid) cleanupRefs.push(wo.wouuid);
  check('SHIP creates a WO', woR.status < 300 && !!wo?.wouuid);
  const pR = await call(SHIP, 'POST', `/work-orders/${wo.id}/postpone-request`, { nextDueDate: newDue, reason: 'Awaiting spares.', postponementRemarks: TAG, userId: CE.id }, CE);
  check('SHIP accepts the postponement request → Awaiting Office Approval, no old step rows', pR.status < 300
    && shipSql(`SELECT status FROM work_orders WHERE wouuid='${wo.wouuid}'`) === 'Awaiting Office Approval'
    && shipSql(`SELECT count(*) FROM wo_postponement_approvals WHERE work_order_id='${wo.wouuid}'`) === '0');

  hr('S2. the ship cannot decide');
  // A Chief Engineer is already stopped by the role guard; the case the new rule must stop is an
  // office admin logged in ON THE SHIP (before 25-Sep that approved directly on board).
  check('SHIP: Chief Engineer approve → 403 (role guard)', (await call(SHIP, 'PUT', `/change-requests/${cr.id}/approve`, { comment: 'ship tries' }, CE)).status === 403);
  const shipApprove = await call(SHIP, 'PUT', `/change-requests/${cr.id}/approve`, { comment: 'admin on ship tries' }, ADMIN);
  check('SHIP: Sail Admin direct CR approve → 403 "approval happens in the office"', shipApprove.status === 403 && /Approval happens in the office/.test(shipApprove.json?.error ?? ''));
  const shipPApprove = await call(SHIP, 'POST', `/work-orders/${wo.id}/postpone-approve`, { approvedBy: ADMIN.name, approvalRemarks: 'admin on ship tries', userUuid: ADMIN.id, role: 'Sail Admin' }, ADMIN);
  check('SHIP: Sail Admin direct postponement approve → 403 "approval happens in the office"', shipPApprove.status === 403 && /Approval happens in the office/.test(shipPApprove.json?.error ?? ''));
  check('SHIP: CR still submitted, WO still awaiting', shipSql(`SELECT status FROM change_request WHERE cruuid='${cr.cruuid}'`) === 'submitted'
    && shipSql(`SELECT status FROM work_orders WHERE wouuid='${wo.wouuid}'`) === 'Awaiting Office Approval');

  hr('S1b. after sync, both wait on shore (no chain → no engine request)');
  const s1 = await sync('S1');
  check('sync succeeds', s1.success === true);
  const shoreCr = (await shoreSql(`SELECT id, status FROM change_request WHERE cruuid=$1`, [cr.cruuid]))[0];
  check('shore has the CR, still submitted', shoreCr?.status === 'submitted');
  check('shore WO Awaiting Office Approval', (await shoreSql(`SELECT status FROM work_orders WHERE wouuid=$1`, [wo.wouuid]))[0]?.status === 'Awaiting Office Approval');
  check('no engine request for either (nothing to start)', (await engineReqs('pms-spares-cr', cr.cruuid)).length === 0 && (await engineReqs('pms-wo-postponement', wo.wouuid)).length === 0);
  const shoreDirect = await call(SHORE, 'PUT', `/change-requests/${shoreCr.id}/approve`, { comment: 'direct' }, APPROVER);
  check('shore direct approve → 400 "not set up"', shoreDirect.status === 400 && /No approval workflow is set up/.test(shoreDirect.json?.error ?? ''));

  hr('S3. admin sets the chains → next sync starts them');
  check('chain saved: spares CR / Normal Spares', (await call(SHORE, 'POST', '/approval-engine/workflows', oneStep('pms-spares-cr', 'Normal Spares'), ADMIN)).status === 201);
  check('chain saved: WO postponement / Normal WO', (await call(SHORE, 'POST', '/approval-engine/workflows', oneStep('pms-wo-postponement', 'Normal WO'), ADMIN)).status === 201);
  check('chain saved: WO re-postponement / Normal WO', (await call(SHORE, 'POST', '/approval-engine/workflows', oneStep('pms-wo-re-postponement', 'Normal WO'), ADMIN)).status === 201);
  await sync('S3');
  check('arrival sweep started the CR chain', (await engineReqs('pms-spares-cr', cr.cruuid))[0]?.status === 'pending');
  check('arrival sweep started the postponement chain', (await engineReqs('pms-wo-postponement', wo.wouuid))[0]?.status === 'pending');

  hr('S4. approver decides on shore → results reach the ship');
  const a = await call(SHORE, 'PUT', `/change-requests/${shoreCr.id}/approve`, { comment: 'ok' }, APPROVER);
  check('shore: CR approved, spare value applied', a.status < 300
    && (await shoreSql(`SELECT status FROM change_request WHERE cruuid=$1`, [cr.cruuid]))[0].status === 'approved'
    && (await shoreSql(`SELECT remarks FROM spares WHERE suuid=$1`, [spare.suuid]))[0].remarks === 'EOAS-SHIP-CR-APPLIED');
  const pa = await call(SHORE, 'POST', `/work-orders/${wo.id}/postpone-approve`, { approvedBy: APPROVER.name, approvalRemarks: 'ok', userUuid: APPROVER.id, role: 'Office' }, APPROVER);
  check('shore: WO Postponement Approved', pa.status < 300 && (await shoreSql(`SELECT status FROM work_orders WHERE wouuid=$1`, [wo.wouuid]))[0].status === 'Postponement Approved');
  await sync('S4');
  check('SHIP: CR approved', shipSql(`SELECT status FROM change_request WHERE cruuid='${cr.cruuid}'`) === 'approved');
  check('SHIP: spare value arrived', shipSql(`SELECT remarks FROM spares WHERE suuid='${spare.suuid}'`) === 'EOAS-SHIP-CR-APPLIED');
  check('SHIP: WO Postponement Approved', shipSql(`SELECT status FROM work_orders WHERE wouuid='${wo.wouuid}'`) === 'Postponement Approved');

  hr('S5. re-postponement on the ship (old "configuration not yet available" refusal is gone)');
  const newDue2 = new Date(Date.now() + 70 * 86400000).toISOString().slice(0, 10);
  const rp = await call(SHIP, 'POST', `/work-orders/${wo.id}/re-postpone-request`, { nextDueDate: newDue2, reason: 'Still awaiting spares.', postponementRemarks: TAG, userId: CE.id }, CE);
  check('SHIP accepts the re-postponement → Awaiting Office Approval', rp.status < 300 && shipSql(`SELECT status FROM work_orders WHERE wouuid='${wo.wouuid}'`) === 'Awaiting Office Approval');
  await sync('S5');
  check('arrival sweep started the re-postponement chain', (await engineReqs('pms-wo-re-postponement', wo.wouuid))[0]?.status === 'pending');
  const rpa = await call(SHORE, 'POST', `/work-orders/${wo.id}/re-postpone-approve`, { approvedBy: APPROVER.name, approvalRemarks: 'ok', userUuid: APPROVER.id, role: 'Office' }, APPROVER);
  check('shore: re-postponement approved', rpa.status < 300 && (await shoreSql(`SELECT status FROM work_orders WHERE wouuid=$1`, [wo.wouuid]))[0].status === 'Postponement Approved');
  await sync('S5b');
  check('SHIP: WO Postponement Approved after re-postponement', shipSql(`SELECT status FROM work_orders WHERE wouuid='${wo.wouuid}'`) === 'Postponement Approved');

  hr('restore + cleanup (shore)');
  await shoreSql(`UPDATE spares SET remarks=$1 WHERE suuid=$2`, [spare.remarks, spare.suuid]);
  await cleanupShore();
  console.log(`\nRESULT: ${passes} passed, ${fails} failed`);
  await pool.end();
  process.exit(fails ? 1 : 0);
})().catch(async (e) => { console.error('HARNESS ERROR:', e); try { await cleanupShore(); } catch { /* best effort */ } await pool.end(); process.exit(1); });
