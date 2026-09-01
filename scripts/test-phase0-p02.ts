/**
 * Phase 0 / P0.2 — D1 gate order. Runs against the SHORE pilot (:5000); the ship build is identical.
 * EXPECT (after fix): L2 job, locked tier, no text → 400 JUSTIFICATION_REQUIRED / SUPERINTENDENT_LOCKED
 * exactly like the control job; lock-OFF boundary → CE_REMARKS_REQUIRED; office reviewer-approve on a
 * still-locked WO → 400 SUPERINTENDENT_LOCKED; bulk unchanged. Fixtures tagged PHASE0, deleted at end.
 */
import { SHORE, V, api, shoreSql, shorePool, daysAgo, hr, log, OFFICE } from './drepro-common';
const CE = { id: 'p0-ce', name: 'P0 Chief Engineer', role: 'Vessel Admin', rank: 'Chief Engineer' } as any;
const THIRD = { id: 'p0-3e', name: 'P0 Third Engineer', role: 'Vessel User', rank: 'Third Engineer' } as any;
const OFF = { ...OFFICE, role: 'Admin' } as any;
// drepro-common api() sends x-user-role but not x-user-type; add type via role→type heuristics in headers:
const withType = (who: any, type: 'Office' | 'Ship') => ({ ...who, name: who.name, type });
async function callT(method: string, path: string, body: any, who: any, type: 'Office' | 'Ship') {
  const r = await fetch(`${SHORE}${path}`, { method, headers: { 'Content-Type': 'application/json', 'x-user-id': who.id, 'x-user-name': encodeURIComponent(who.name), 'x-user-role': encodeURIComponent(who.role), 'x-user-type': type, 'x-rank': who.rank }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  log(`→ ${method} ${path} as ${who.role}/${type}${body ? ' ' + JSON.stringify(body).slice(0, 120) : ''}\n← ${r.status} ${text.slice(0, 160).replace(/\s+/g, ' ')}`);
  return { status: r.status, json, text };
}
const COMP = { id: '6351440e-be6a-4334-867c-d76f0b43f729', code: '278', name: 'EXTERNAL CATHODIC PROTECTION' };
const woSql = (id: string) => `SELECT status, approval_tier, superintendent_acknowledged, ce_approval_remarks, skipped_cycles_justification, missed_cycles, days_late FROM work_orders WHERE id='${id}'`;
const show = async (id: string, label: string) => log(`   DB ${label}: ${JSON.stringify((await shoreSql(woSql(id)))[0])}`);
let fails = 0; const check = (l: string, ok: boolean) => { log(`   ${ok ? 'PASS' : 'FAIL'}  ${l}`); if (!ok) fails++; };

async function mkJob(jobNo: string, l2: string | null) { return (await callT('POST', '/jobs', { vesselId: V, componentId: COMP.id, componentCode: COMP.code, componentName: COMP.name, jobNo, jobTitle: `PHASE0 ${jobNo}`, assignedTo: '2nd Engineer', maintenanceType: 'Inspection', maintenanceBasis: 'Calendar', frequencyValue: '30', frequencyUnit: 'Days', jobPriority: 'Medium', classRelated: 'No', briefWorkDescription: 'PHASE0', approver: 'Chief Engineer', level2ReviewerRankId: l2, department: 'Engine', dataScope: 'vessel', criticality: 'No', isActive: true, linkedComponentCodes: [COMP.code] }, OFF, 'Office')).json; }
async function mkWO(job: any, tag: string, daysLate = 40) { return (await callT('POST', '/work-orders', { vesselId: V, jobId: job.id, jobTitle: job.jobTitle, component: COMP.name, componentCode: COMP.code, componentId: COMP.id, assignedTo: '2nd Engineer', approver: 'Chief Engineer', department: 'Engine', maintenanceBasis: 'Calendar', frequencyValue: '30', frequencyUnit: 'Days', dueDate: daysAgo(daysLate), nextDueDate: daysAgo(daysLate), status: 'Due', workOrderType: 'Planned', isExecution: false, briefWorkDescription: `PHASE0 ${tag}` }, OFF, 'Office')).json; }
const submit = (id: string) => { const n = new Date().toISOString(); return callT('PATCH', `/work-orders/${id}`, { status: 'Pending Approval', approvalAction: 'submitted', completionDateTime: n, dateCompleted: n, workCarriedOut: 'PHASE0' }, THIRD, 'Ship'); };
const approve = (id: string, extra: any = {}) => callT('PATCH', `/work-orders/${id}`, { status: 'Completed', approvalAction: 'approved', approver: 'Chief Engineer', ...extra }, CE, 'Ship');
const TEXT = { ceApprovalRemarks: 'twenty characters of remarks here', skippedCyclesJustification: 'thirty characters of justification text here ok' };
// Jeevan's vessel-settings refactor (a4219680b) moved the superintendent lock from the global
// company_approval_settings singleton to the PER-VESSEL pms_vessel_settings row that
// isSuperintendentLockEnabled(vesselId) now reads. Arm it there for the test vessel.
const setLock = async (on: boolean) => {
  await shoreSql(`INSERT INTO pms_vessel_settings (vessel_id, superintendent_lock_enabled, updated_by) VALUES ('${V}', ${on}, 'phase0-harness') ON CONFLICT (vessel_id) DO UPDATE SET superintendent_lock_enabled=${on}, updated_by='phase0-harness'`);
};

(async () => {
  await setLock(true);
  const jobCtrl = await mkJob('PHASE0-CTRL', null), jobL2 = await mkJob('PHASE0-L2', 'Office');
  hr('P0.2-1 lock ON — control vs L2, no text (D1.4)');
  const ctrl = await mkWO(jobCtrl, 'ctrl'), l2 = await mkWO(jobL2, 'l2');
  await submit(ctrl.id); await submit(l2.id); await show(ctrl.id, 'ctrl submitted'); await show(l2.id, 'l2 submitted');
  const c1 = await approve(ctrl.id); check('control, no text → 400 JUSTIFICATION_REQUIRED', c1.status === 400 && c1.json?.code === 'JUSTIFICATION_REQUIRED');
  const c2 = await approve(ctrl.id, TEXT); check('control, with text → 400 SUPERINTENDENT_LOCKED', c2.status === 400 && c2.json?.code === 'SUPERINTENDENT_LOCKED');
  const l1 = await approve(l2.id); check('L2, no text → 400 JUSTIFICATION_REQUIRED (was 200 Pending Office Review)', l1.status === 400 && l1.json?.code === 'JUSTIFICATION_REQUIRED');
  const l2b = await approve(l2.id, TEXT); check('L2, with text → 400 SUPERINTENDENT_LOCKED', l2b.status === 400 && l2b.json?.code === 'SUPERINTENDENT_LOCKED');
  await show(l2.id, 'l2 after attempts'); check('L2 WO still Pending Approval', (await shoreSql(woSql(l2.id)))[0].status === 'Pending Approval');

  hr('P0.2-2 office reviewer-approve on a still-locked WO (Pending Office Review reached by SQL — the pre-fix state)');
  const l2x = await mkWO(jobL2, 'l2-prefix-state'); await submit(l2x.id);
  await shoreSql(`UPDATE work_orders SET status='Pending Office Review', approval_action='approved' WHERE id='${l2x.id}'`); // exactly what the pre-fix intercept produced
  const ra = await callT('POST', `/work-orders/${l2x.id}/reviewer-approve`, { reviewerComments: 'ok' }, OFF, 'Office');
  check('reviewer-approve on locked+unacked → 400 SUPERINTENDENT_LOCKED', ra.status === 400 && /SUPERINTENDENT_LOCKED/.test(ra.text));
  check('WO not completed', (await shoreSql(woSql(l2x.id)))[0].status !== 'Completed');
  await callT('POST', `/work-orders/${l2x.id}/superintendent-acknowledge`, {}, OFF, 'Office');
  const ra2 = await callT('POST', `/work-orders/${l2x.id}/reviewer-approve`, { reviewerComments: 'ok' }, OFF, 'Office');
  check('after superintendent acknowledge → reviewer-approve 200 → Completed', ra2.status === 200 && (await shoreSql(woSql(l2x.id)))[0].status === 'Completed');

  hr('P0.2-3 lock OFF boundary');
  await setLock(false);
  const ctrlOff = await mkWO(jobCtrl, 'ctrl-off'), l2Off = await mkWO(jobL2, 'l2-off');
  await submit(ctrlOff.id); await submit(l2Off.id); await show(l2Off.id, 'l2 submitted (lock OFF)');
  const o1 = await approve(l2Off.id); check('L2 lock OFF, no text → 400 JUSTIFICATION_REQUIRED', o1.status === 400 && o1.json?.code === 'JUSTIFICATION_REQUIRED');
  const o2 = await approve(l2Off.id, { skippedCyclesJustification: TEXT.skippedCyclesJustification }); check('L2 lock OFF, justification only → 400 CE_REMARKS_REQUIRED', o2.status === 400 && o2.json?.code === 'CE_REMARKS_REQUIRED');
  const o3 = await approve(l2Off.id, TEXT); check('L2 lock OFF, both texts → 200 Pending Office Review (intercept still works)', o3.status === 200 && (await shoreSql(woSql(l2Off.id)))[0].status === 'Pending Office Review');
  await show(l2Off.id, 'l2 after'); check('texts persisted on the L2 WO', (await shoreSql(woSql(l2Off.id)))[0].ce_approval_remarks === TEXT.ceApprovalRemarks);
  const c3 = await approve(ctrlOff.id, TEXT); check('control lock OFF, both texts → 200 Completed (unchanged)', c3.status === 200 && (await shoreSql(woSql(ctrlOff.id)))[0].status === 'Completed');
  const ra3 = await callT('POST', `/work-orders/${l2Off.id}/reviewer-approve`, { reviewerComments: 'ok' }, OFF, 'Office');
  check('reviewer-approve with lock OFF on locked-tier WO → 200 (HOD already gave remarks)', ra3.status === 200);
  await setLock(true);

  hr('P0.2-4 bulk path unchanged');
  const l2bulk = await mkWO(jobL2, 'l2-bulk'); await submit(l2bulk.id);
  const b1 = await callT('POST', '/work-orders/bulk-approve', { workOrderIds: [l2bulk.id], approver: 'Chief Engineer' }, CE, 'Ship');
  check('bulk, locked, no text → failed LOCKED', /LOCKED pending Superintendent/.test(b1.text));

  hr('cleanup');
  await shoreSql(`DELETE FROM pms_vessel_settings WHERE vessel_id='${V}' AND updated_by='phase0-harness'`);
  await shoreSql(`DELETE FROM superintendent_notifications WHERE work_order_id IN (SELECT wouuid FROM work_orders WHERE work_order_no LIKE 'PHASE0%')`);
  await shoreSql(`BEGIN; SET LOCAL session_replication_role = replica; DELETE FROM component_maintenance_history WHERE work_order_id IN (SELECT wouuid FROM work_orders WHERE work_order_no LIKE 'PHASE0%'); COMMIT;`);
  await shoreSql(`DELETE FROM work_orders WHERE work_order_no LIKE 'PHASE0%'`); await shoreSql(`DELETE FROM jobs WHERE job_no LIKE 'PHASE0%'`);
  log('   remaining PHASE0:', JSON.stringify((await shoreSql(`SELECT (SELECT count(*) FROM work_orders WHERE work_order_no LIKE 'PHASE0%') wos, (SELECT count(*) FROM jobs WHERE job_no LIKE 'PHASE0%') jobs`))[0]));
  log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAIL(S)'}`); await shorePool.end(); process.exit(fails ? 1 : 0);
})().catch(async (e) => { console.error('CRASH', e); await shorePool.end(); process.exit(1); });
