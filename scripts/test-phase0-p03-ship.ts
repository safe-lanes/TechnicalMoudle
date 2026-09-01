/**
 * Phase 0 — SHIP end-to-end on the rebuilt container (ship :5100 + shore :5000, same build).
 *  A. P0.3b: component CR approved ON THE SHIP → 403 SHORE_OWNED_TARGET, component unchanged; spare CR
 *     approved on ship → 200 (bidirectional table); component CR approved on SHORE → ship receives it.
 *  B. D1 end-to-end: L2 job (created on shore → one-way to ship), WO on ship 40 days late; HOD approve on
 *     ship without text → 400; ack on shore (Office) → sync → HOD approve with texts → Pending Office Review
 *     → sync → reviewer-approve on shore → Completed → sync → ship Completed.
 *  C. P0.4 on ship: awc PUT as Office → 403 shore_only; superintendent-ack as Vessel User → 403.
 *  D. P0.3d across sync: postpone request on ship, approve on shore, ship sees request row Approved + decision.
 * Fixtures PHASE0 on both sides, deleted at end.
 */
import { SHIP, SHORE, V, shipSql, shoreSql, shorePool, syncShip, daysAgo, hr, log } from './drepro-common';
const OFF = { id: 'p0-office', name: 'P0 Office Admin', role: 'Admin', rank: 'Technical Superintendent', type: 'Office' };
const VU = { id: 'p0-3e', name: 'P0 Third Engineer', role: 'Vessel User', rank: 'Third Engineer', type: 'Ship' };
const VA = { id: 'p0-ce', name: 'P0 Chief Engineer', role: 'Vessel Admin', rank: 'Chief Engineer', type: 'Ship' };
async function call(base: string, method: string, path: string, body: any, who: any) {
  const r = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', 'x-user-id': who.id, 'x-user-name': encodeURIComponent(who.name), 'x-user-role': encodeURIComponent(who.role), 'x-user-type': who.type, 'x-rank': who.rank }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  log(`→ ${base === SHIP ? 'SHIP ' : 'SHORE'} ${method} ${path} as ${who.role}${body ? ' ' + JSON.stringify(body).slice(0, 100) : ''}\n← ${r.status} ${text.slice(0, 150).replace(/\s+/g, ' ')}`);
  return { status: r.status, json, text };
}
let fails = 0; const check = (l: string, ok: boolean) => { log(`   ${ok ? 'PASS' : 'FAIL'}  ${l}`); if (!ok) fails++; };
const COMP = { cuuid: '6351440e-be6a-4334-867c-d76f0b43f729', code: '278', name: 'EXTERNAL CATHODIC PROTECTION' };
const SPARE = { suuid: '6ea1d16f-2dc6-4083-b2e2-414ab4cdb426' };
const TEXT = { ceApprovalRemarks: 'twenty characters of remarks here', skippedCyclesJustification: 'thirty characters of justification text here ok' };
const woShip = (id: string) => shipSql(`SELECT status||'|'||approval_tier||'|'||superintendent_acknowledged FROM work_orders WHERE id='${id}'`);
const woShore = async (id: string) => { const r = (await shoreSql(`SELECT status, approval_tier, superintendent_acknowledged FROM work_orders WHERE id='${id}'`))[0]; return r ? `${r.status}|${r.approval_tier}|${r.superintendent_acknowledged}` : '<absent>'; };

(async () => {
  // Enable the per-vessel superintendent lock (migration 168, default FALSE) on BOTH sides so
  // section B's locked-WO assertions test the lock, not a default-off state (p02 does this on shore).
  await shoreSql(`INSERT INTO pms_vessel_settings (vessel_id, superintendent_lock_enabled, updated_by) VALUES ('${V}', true, 'p03-harness') ON CONFLICT (vessel_id) DO UPDATE SET superintendent_lock_enabled=true`);
  shipSql(`INSERT INTO pms_vessel_settings (vessel_id, superintendent_lock_enabled, updated_by) VALUES ('${V}', true, 'p03-harness') ON CONFLICT (vessel_id) DO UPDATE SET superintendent_lock_enabled=true`);

  hr('A. P0.3b ship-side CR approval of a shore-owned target');
  const crC = (await call(SHIP, 'POST', '/change-requests', { vesselId: V, category: 'components', title: 'PHASE0 ship comp CR', reason: 'PHASE0', targetType: 'component', targetId: COMP.cuuid, proposedChangesJson: [{ id: 1, field: 'maker', oldValue: null, newValue: 'PHASE0-SHIPSIDE' }], status: 'submitted', requestedByUserId: VU.id }, VU)).json;
  const a1 = await call(SHIP, 'PUT', `/change-requests/${crC.id}/approve`, { comment: 'on ship' }, OFF);
  check('component CR approve on SHIP → 403 SHORE_OWNED_TARGET', a1.status === 403 && a1.json?.details?.code === 'SHORE_OWNED_TARGET');
  check('component unchanged on ship, CR still submitted', shipSql(`SELECT coalesce(maker,'<null>') FROM components WHERE cuuid='${COMP.cuuid}'`) === '<null>' && shipSql(`SELECT status FROM change_request WHERE id=${crC.id}`) === 'submitted');
  const crS = (await call(SHIP, 'POST', '/change-requests', { vesselId: V, category: 'spares', title: 'PHASE0 ship spare CR', reason: 'PHASE0', targetType: 'spare', targetId: SPARE.suuid, proposedChangesJson: [{ id: 1, field: 'remarks', oldValue: 'MD (Material Declaration)', newValue: 'PHASE0-SHIP-SPARE' }], status: 'submitted', requestedByUserId: VU.id }, VU)).json;
  const a2 = await call(SHIP, 'PUT', `/change-requests/${crS.id}/approve`, { comment: 'on ship' }, OFF);
  check('spare CR approve on SHIP → 200 (bidirectional table, unchanged behaviour)', a2.status === 200 && shipSql(`SELECT remarks FROM spares WHERE suuid='${SPARE.suuid}'`) === 'PHASE0-SHIP-SPARE');
  await syncShip('ship→shore');
  const shoreCrC = (await shoreSql(`SELECT id FROM change_request WHERE cruuid='${crC.cruuid}'`))[0];
  const a3 = await call(SHORE, 'PUT', `/change-requests/${shoreCrC.id}/approve`, { comment: 'on shore' }, OFF);
  check('same component CR approved on SHORE → 200', a3.status === 200);
  await syncShip('shore→ship'); await syncShip('shore→ship #2');
  check('ship received component maker via one-way row sync', shipSql(`SELECT coalesce(maker,'<null>') FROM components WHERE cuuid='${COMP.cuuid}'`) === 'PHASE0-SHIPSIDE');
  check('ship CR row now approved (bidirectional CR table)', shipSql(`SELECT status FROM change_request WHERE id=${crC.id}`) === 'approved');
  check('shore spare remarks arrived from the ship approve', (await shoreSql(`SELECT remarks FROM spares WHERE suuid='${SPARE.suuid}'`))[0].remarks === 'PHASE0-SHIP-SPARE');

  hr('B. D1 end-to-end through sync');
  const job = (await call(SHORE, 'POST', '/jobs', { vesselId: V, componentId: COMP.cuuid, componentCode: COMP.code, componentName: COMP.name, jobNo: 'PHASE0-E2E-L2', jobTitle: 'PHASE0 e2e L2 job', assignedTo: '2nd Engineer', maintenanceType: 'Inspection', maintenanceBasis: 'Calendar', frequencyValue: '30', frequencyUnit: 'Days', jobPriority: 'Medium', classRelated: 'No', briefWorkDescription: 'PHASE0', approver: 'Chief Engineer', level2ReviewerRankId: 'Office', department: 'Engine', dataScope: 'vessel', criticality: 'No', isActive: true, linkedComponentCodes: [COMP.code] }, OFF)).json;
  await syncShip('job shore→ship');
  check('L2 job arrived on ship', shipSql(`SELECT level2_reviewer_rank_id FROM jobs WHERE juuid='${job.juuid}'`) === 'Office');
  const wo = (await call(SHIP, 'POST', '/work-orders', { vesselId: V, jobId: job.id, jobTitle: job.jobTitle, component: COMP.name, componentCode: COMP.code, componentId: COMP.cuuid, assignedTo: '2nd Engineer', approver: 'Chief Engineer', department: 'Engine', maintenanceBasis: 'Calendar', frequencyValue: '30', frequencyUnit: 'Days', dueDate: daysAgo(40), nextDueDate: daysAgo(40), status: 'Due', workOrderType: 'Planned', isExecution: false, briefWorkDescription: 'PHASE0 e2e' }, VA)).json;
  const n = new Date().toISOString();
  await call(SHIP, 'PATCH', `/work-orders/${wo.id}`, { status: 'Pending Approval', approvalAction: 'submitted', completionDateTime: n, dateCompleted: n, workCarriedOut: 'PHASE0' }, VU);
  log('   SHIP after submit:', woShip(wo.id));
  const h1 = await call(SHIP, 'PATCH', `/work-orders/${wo.id}`, { status: 'Completed', approvalAction: 'approved', approver: 'Chief Engineer' }, VA);
  check('HOD approve on ship, L2 job, no text → 400 JUSTIFICATION_REQUIRED', h1.status === 400 && h1.json?.code === 'JUSTIFICATION_REQUIRED');
  const h2 = await call(SHIP, 'PATCH', `/work-orders/${wo.id}`, { status: 'Completed', approvalAction: 'approved', approver: 'Chief Engineer', ...TEXT }, VA);
  check('HOD approve with texts while locked → 400 SUPERINTENDENT_LOCKED', h2.status === 400 && h2.json?.code === 'SUPERINTENDENT_LOCKED');
  check('superintendent-acknowledge on SHIP as Vessel User → 403', (await call(SHIP, 'POST', `/work-orders/${wo.id}/superintendent-acknowledge`, {}, VU)).status === 403);
  await syncShip('wo ship→shore');
  log('   SHORE after sync:', await woShore(wo.id));
  check('acknowledge on SHORE as Office → 200', (await call(SHORE, 'POST', `/work-orders/${wo.id}/superintendent-acknowledge`, {}, OFF)).status === 200);
  await syncShip('ack shore→ship');
  log('   SHIP after ack sync:', woShip(wo.id));
  check('ship sees ack (tier ce_with_justification, ack=true)', /ce_with_justification\|true/.test(woShip(wo.id)));
  const h3 = await call(SHIP, 'PATCH', `/work-orders/${wo.id}`, { status: 'Completed', approvalAction: 'approved', approver: 'Chief Engineer', ...TEXT }, VA);
  check('HOD approve with texts after ack → 200 Pending Office Review', h3.status === 200 && /^Pending Office Review/.test(woShip(wo.id)));
  await syncShip('por ship→shore');
  check('reviewer-approve on SHORE as Vessel User → 403', (await call(SHORE, 'POST', `/work-orders/${wo.id}/reviewer-approve`, { reviewerComments: 'x' }, VU)).status === 403);
  check('reviewer-approve on SHORE as Office → 200', (await call(SHORE, 'POST', `/work-orders/${wo.id}/reviewer-approve`, { reviewerComments: 'ok' }, OFF)).status === 200);
  await syncShip('completed shore→ship');
  log('   SHIP final:', woShip(wo.id), '| SHORE final:', await woShore(wo.id));
  check('ship shows Completed with texts persisted', /^Completed/.test(woShip(wo.id)) && shipSql(`SELECT ce_approval_remarks FROM work_orders WHERE id='${wo.id}'`) === TEXT.ceApprovalRemarks);

  hr('C. P0.4 on ship — awc PUT shore-only');
  const g = await call(SHIP, 'GET', '/admin/approval-workflow-config', undefined, OFF);
  const target = (g.json?.data ?? []).find((r: any) => r.functionId === 'pms-spares-cr' && r.variableName === 'Normal Spares');
  const put = await call(SHIP, 'PUT', '/admin/approval-workflow-config', { rows: [{ ...target, level1Enabled: true }] }, OFF);
  check('awc PUT on SHIP as Office → 403 shore_only', put.status === 403 && put.json?.error === 'shore_only');

  hr('D. P0.3d across sync');
  const wo2 = (await call(SHIP, 'POST', '/work-orders', { vesselId: V, jobId: job.id, jobTitle: job.jobTitle, component: COMP.name, componentCode: COMP.code, componentId: COMP.cuuid, assignedTo: '2nd Engineer', approver: 'Chief Engineer', department: 'Engine', maintenanceBasis: 'Calendar', frequencyValue: '30', frequencyUnit: 'Days', dueDate: daysAgo(-10), nextDueDate: daysAgo(-10), status: 'Due', workOrderType: 'Planned', isExecution: false, briefWorkDescription: 'PHASE0 e2e postpone' }, VA)).json;
  await call(SHIP, 'POST', `/work-orders/${wo2.id}/postpone-request`, { nextDueDate: daysAgo(-40).slice(0, 10), reason: 'Awaiting spare parts onboard.', postponementRemarks: 'PHASE0', userId: VU.id }, VU);
  await syncShip('request ship→shore');
  check('postpone-approve on SHORE → 200', (await call(SHORE, 'POST', `/work-orders/${wo2.id}/postpone-approve`, { approvedBy: OFF.name, approvalRemarks: 'PHASE0', userUuid: OFF.id, role: 'Office' }, OFF)).status === 200);
  await syncShip('approval shore→ship');
  const rowsShip = shipSql(`SELECT string_agg(postponement_number||':'||status, ',' ORDER BY postponement_number) FROM work_order_postponements WHERE work_order_id='${wo2.wouuid}'`);
  log('   SHIP rows:', rowsShip, '| SHIP WO:', woShip(wo2.id));
  check('ship: request row #1 Approved + decision #2 Approved, WO Postponement Approved, no Awaiting row', rowsShip === '1:Approved,2:Approved' && /^Postponement Approved/.test(woShip(wo2.id)));

  hr('cleanup both sides');
  await shoreSql(`UPDATE pms_vessel_settings SET superintendent_lock_enabled=false WHERE vessel_id='${V}'`);
  shipSql(`UPDATE pms_vessel_settings SET superintendent_lock_enabled=false WHERE vessel_id='${V}'`);
  for (const side of ['ship', 'shore'] as const) {
    const run = async (sql: string) => side === 'ship' ? shipSql(sql) : (await shoreSql(sql), '');
    await run(`DELETE FROM superintendent_notifications WHERE work_order_id IN (SELECT wouuid FROM work_orders WHERE work_order_no LIKE 'PHASE0%' OR brief_work_description LIKE 'PHASE0%')`);
    await run(`DELETE FROM work_order_postponements WHERE work_order_id IN (SELECT wouuid FROM work_orders WHERE brief_work_description LIKE 'PHASE0%')`);
    await run(`BEGIN; SET LOCAL session_replication_role = replica; DELETE FROM component_maintenance_history WHERE work_order_id IN (SELECT wouuid FROM work_orders WHERE brief_work_description LIKE 'PHASE0%'); COMMIT;`);
    await run(`DELETE FROM work_orders WHERE brief_work_description LIKE 'PHASE0%' OR work_order_no LIKE 'PHASE0%'`);
    await run(`DELETE FROM change_request WHERE title LIKE 'PHASE0%'`);
    await run(`DELETE FROM jobs WHERE job_no LIKE 'PHASE0%'`);
    await run(`UPDATE components SET maker=NULL WHERE cuuid='${COMP.cuuid}' AND maker LIKE 'PHASE0%'`);
    await run(`UPDATE spares SET remarks='MD (Material Declaration)' WHERE suuid='${SPARE.suuid}'`);
  }
  log('   SHIP remaining PHASE0 WOs/CRs/jobs:', shipSql(`SELECT (SELECT count(*) FROM work_orders WHERE brief_work_description LIKE 'PHASE0%')||'/'||(SELECT count(*) FROM change_request WHERE title LIKE 'PHASE0%')||'/'||(SELECT count(*) FROM jobs WHERE job_no LIKE 'PHASE0%')`));
  log('   SHORE remaining:', JSON.stringify((await shoreSql(`SELECT (SELECT count(*) FROM work_orders WHERE brief_work_description LIKE 'PHASE0%') wos, (SELECT count(*) FROM change_request WHERE title LIKE 'PHASE0%') crs, (SELECT count(*) FROM jobs WHERE job_no LIKE 'PHASE0%') jobs`))[0]));
  log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAIL(S)'}`); await shorePool.end(); process.exit(fails ? 1 : 0);
})().catch(async (e) => { console.error('CRASH', e); await shorePool.end(); process.exit(1); });
