/**
 * Phase 0 / P0.1c — pilot proof (SHORE :5000 on the branch build).
 *  A. reviewer-approve (already guarded): forwarded vessel rank → 403; forwarded Office → 200.
 *  B. Regression battery with REAL roles — every row must behave as before P0.1 except the
 *     explicitly-listed new enforcement (fleet master-list-types is Sail-Admin-only by name).
 * Creates one L2 WO fixture (PHASE0 tag) and deletes it at the end.
 */
import { SHORE, V, api, shoreSql, shorePool, daysAgo, hr, log } from './drepro-common';
type Who = { id: string; name: string; role: string; rank: string; type?: 'Office' | 'Ship' };
const U = {
  sail: { id: 'p0-sail', name: 'P0 Sail Admin', role: 'Sail Admin', rank: 'Technical Superintendent', type: 'Office' as const },
  admin: { id: 'p0-admin', name: 'P0 Office Admin', role: 'Admin', rank: 'Technical Superintendent', type: 'Office' as const },
  vuser: { id: 'p0-vuser', name: 'P0 Vessel User', role: 'Vessel User', rank: 'Third Engineer', type: 'Ship' as const },
  vadmin: { id: 'p0-vadmin', name: 'P0 Vessel Admin', role: 'Vessel Admin', rank: 'Chief Engineer', type: 'Ship' as const },
  none: { id: '', name: '', role: '', rank: '' },
};
async function call(method: string, path: string, body: any, who: Who) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (who.id) { headers['x-user-id'] = who.id; headers['x-user-name'] = encodeURIComponent(who.name); headers['x-user-role'] = encodeURIComponent(who.role); headers['x-rank'] = who.rank; if (who.type) headers['x-user-type'] = who.type; }
  const r = await fetch(`${SHORE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  return { status: r.status, json, text };
}
const row = (label: string, r: { status: number; text: string }, expect: number | number[]) => {
  const ok = Array.isArray(expect) ? expect.includes(r.status) : r.status === expect;
  log(`   ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(78)} → ${r.status}  ${r.text.slice(0, 90).replace(/\s+/g, ' ')}`);
  return ok;
};
(async () => {
  let fails = 0;
  hr('P0.1c-A  reviewer-approve guard with real roles');
  const COMP = { id: '6351440e-be6a-4334-867c-d76f0b43f729', code: '278', name: 'EXTERNAL CATHODIC PROTECTION' };
  const job = (await call('POST', '/jobs', { vesselId: V, componentId: COMP.id, componentCode: COMP.code, componentName: COMP.name, jobNo: 'PHASE0-L2', jobTitle: 'PHASE0 L2 job', assignedTo: '2nd Engineer', maintenanceType: 'Inspection', maintenanceBasis: 'Calendar', frequencyValue: '30', frequencyUnit: 'Days', jobPriority: 'Medium', classRelated: 'No', briefWorkDescription: 'PHASE0', approver: 'Chief Engineer', level2ReviewerRankId: 'Office', department: 'Engine', dataScope: 'vessel', criticality: 'No', isActive: true, linkedComponentCodes: [COMP.code] }, U.sail)).json;
  const wo = (await call('POST', '/work-orders', { vesselId: V, jobId: job.id, jobTitle: job.jobTitle, component: COMP.name, componentCode: COMP.code, componentId: COMP.id, assignedTo: '2nd Engineer', approver: 'Chief Engineer', department: 'Engine', maintenanceBasis: 'Calendar', frequencyValue: '30', frequencyUnit: 'Days', dueDate: daysAgo(2), nextDueDate: daysAgo(2), status: 'Due', workOrderType: 'Planned', isExecution: false, briefWorkDescription: 'PHASE0 p01' }, U.sail)).json;
  await call('PATCH', `/work-orders/${wo.id}`, { status: 'Pending Approval', approvalAction: 'submitted', completionDateTime: new Date().toISOString(), dateCompleted: new Date().toISOString() }, U.vuser);
  await call('PATCH', `/work-orders/${wo.id}`, { status: 'Completed', approvalAction: 'approved', approver: 'Chief Engineer' }, U.vadmin);
  log('   WO', wo.workOrderNo, 'status:', JSON.stringify((await shoreSql(`SELECT status, approval_tier FROM work_orders WHERE wouuid='${wo.wouuid}'`))[0]));
  fails += !row('reviewer-approve as Vessel User (Third Engineer)', await call('POST', `/work-orders/${wo.id}/reviewer-approve`, { reviewerComments: 'x' }, U.vuser), 403) ? 1 : 0;
  fails += !row('reviewer-approve as Vessel Admin (Chief Engineer)', await call('POST', `/work-orders/${wo.id}/reviewer-approve`, { reviewerComments: 'x' }, U.vadmin), 403) ? 1 : 0;
  fails += !row('reviewer-approve with NO identity headers', await call('POST', `/work-orders/${wo.id}/reviewer-approve`, { reviewerComments: 'x' }, U.none), 403) ? 1 : 0;
  log('   status still:', JSON.stringify((await shoreSql(`SELECT status FROM work_orders WHERE wouuid='${wo.wouuid}'`))[0]));
  fails += !row('reviewer-approve as Office "Admin"', await call('POST', `/work-orders/${wo.id}/reviewer-approve`, { reviewerComments: 'ok' }, U.admin), 200) ? 1 : 0;
  log('   status now:', JSON.stringify((await shoreSql(`SELECT status FROM work_orders WHERE wouuid='${wo.wouuid}'`))[0]));

  hr('P0.1c-B  regression battery with real roles (must equal pre-P0.1 behaviour unless marked NEW)');
  fails += !row('GET /work-orders?vesselId (open) as Vessel User', await call('GET', `/work-orders?vesselId=${V}`, undefined, U.vuser), 200) ? 1 : 0;
  fails += !row('GET /approval-policy as Vessel User (open read)', await call('GET', '/approval-policy', undefined, U.vuser), 200) ? 1 : 0;
  // Jeevan's vessel-settings refactor RETIRED the global /approval-policy PUT (now 410 for all callers;
  // the lock moved to per-vessel pms_vessel_settings). Endpoint retired → RBAC on it is moot; expect 410.
  fails += !row('PUT /approval-policy → 410 retired (Jeevan moved the lock per-vessel; endpoint deprecated)', await call('PUT', '/approval-policy', { superintendentLockEnabled: true }, U.admin), 410) ? 1 : 0;
  fails += !row('GET /admin/approval-workflow-config as Office Admin', await call('GET', '/admin/approval-workflow-config', undefined, U.admin), 200) ? 1 : 0;
  fails += !row('GET /sync/settings as Office Admin (requireOfflineAdmin reads legacy role → unchanged)', await call('GET', '/sync/settings', undefined, U.admin), 200) ? 1 : 0;
  fails += !row('GET /sync/fleet-overview as Sail Admin', await call('GET', '/sync/fleet-overview', undefined, U.sail), 200) ? 1 : 0;
  fails += !row('POST /jobs as Office Admin (requirePermission pass-through → unchanged)', await call('POST', '/jobs', { vesselId: V, componentId: COMP.id, componentCode: COMP.code, componentName: COMP.name, jobNo: 'PHASE0-ADM', jobTitle: 'PHASE0 admin job', assignedTo: '2nd Engineer', maintenanceBasis: 'Calendar', frequencyValue: '30', frequencyUnit: 'Days', approver: 'Chief Engineer', department: 'Engine', dataScope: 'vessel', isActive: true, linkedComponentCodes: [COMP.code] }, U.admin), 201) ? 1 : 0;
  const crVu = await call('POST', '/change-requests', { vesselId: V, category: 'components', title: 'PHASE0 CR by vessel user', reason: 'PHASE0', targetType: 'component', targetId: COMP.id, proposedChangesJson: [{ id: 1, field: 'maker', oldValue: null, newValue: 'PHASE0-X' }], status: 'draft', requestedByUserId: U.vuser.id }, U.vuser);
  fails += !row('POST /change-requests as Vessel User (requirePermission pass-through → unchanged)', crVu, 201) ? 1 : 0;
  const sp = (await shoreSql(`SELECT id FROM spares WHERE vessel_id='${V}' AND is_deleted=false ORDER BY id LIMIT 1`))[0];
  fails += !row('POST /spares/:id/consume as Vessel User (requirePMSAdmin legacy alias → pass-through, unchanged)', await call('POST', `/spares/${sp.id}/consume`, { quantity: 0, remarks: 'PHASE0 zero-qty probe' }, U.vuser), [200, 400]) ? 1 : 0;
  fails += !row('NEW ENFORCEMENT: POST /fleet/master-list-types as Office Admin (requireRole Sail Admin by name)', await call('POST', '/fleet/master-list-types', { name: 'PHASE0-x' }, U.admin), 403) ? 1 : 0;
  fails += !row('NEW ENFORCEMENT: same as Sail Admin passes the guard (body may still be rejected downstream)', await call('POST', '/fleet/master-list-types', {}, U.sail), [200, 201, 400, 500]) ? 1 : 0;
  fails += !row('superintendent-acknowledge as Vessel User (403 since P0.4 guarded it)', await call('POST', `/work-orders/${wo.id}/superintendent-acknowledge`, {}, U.vuser), 403) ? 1 : 0;

  hr('cleanup');
  await shoreSql(`DELETE FROM change_request WHERE title LIKE 'PHASE0%'`);
  await shoreSql(`DELETE FROM superintendent_notifications WHERE work_order_id IN (SELECT wouuid FROM work_orders WHERE work_order_no LIKE 'PHASE0%')`);
  await shoreSql(`DELETE FROM work_orders WHERE work_order_no LIKE 'PHASE0%'`);
  await shoreSql(`DELETE FROM jobs WHERE job_no LIKE 'PHASE0%'`);
  log('   deleted PHASE0 WOs/jobs/CRs:', JSON.stringify((await shoreSql(`SELECT (SELECT count(*) FROM work_orders WHERE work_order_no LIKE 'PHASE0%') wos, (SELECT count(*) FROM jobs WHERE job_no LIKE 'PHASE0%') jobs, (SELECT count(*) FROM change_request WHERE title LIKE 'PHASE0%') crs`))[0]));
  log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAIL(S)'}`);
  await shorePool.end(); process.exit(fails ? 1 : 0);
})().catch(async (e) => { console.error('CRASH', e); await shorePool.end(); process.exit(1); });
