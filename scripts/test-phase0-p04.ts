/**
 * Phase 0 / P0.4 — D4 guards on the approval surfaces (SHORE pilot :5000).
 *  superintendent-acknowledge (single + bulk): vessel rank / anonymous → 403; Office → 200 (lock cleared)
 *  PUT /admin/approval-workflow-config: vessel rank / anonymous → 403; bad body → 400; Office → 200 + updated_by_uuid stamped
 *  GET /admin/approval-workflow-config and GET /admin/local-approvers: still open (read on ships too)
 *  CR approve/reject: vessel rank / anonymous → 403; Office → 200
 * Fixtures PHASE0, deleted at end.
 */
import { SHORE, V, shoreSql, shorePool, daysAgo, hr, log } from './drepro-common';
const OFF = { id: 'p0-office', name: 'P0 Office Admin', role: 'Admin', rank: 'Technical Superintendent', type: 'Office' };
const VU = { id: 'p0-3e', name: 'P0 Third Engineer', role: 'Vessel User', rank: 'Third Engineer', type: 'Ship' };
const VA = { id: 'p0-ce', name: 'P0 Chief Engineer', role: 'Vessel Admin', rank: 'Chief Engineer', type: 'Ship' };
const NONE = { id: '', name: '', role: '', rank: '', type: '' };
async function call(method: string, path: string, body: any, who: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (who.id) { headers['x-user-id'] = who.id; headers['x-user-name'] = encodeURIComponent(who.name); headers['x-user-role'] = encodeURIComponent(who.role); headers['x-user-type'] = who.type; headers['x-rank'] = who.rank; }
  const r = await fetch(`${SHORE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  log(`→ ${method} ${path} as ${who.role || 'anonymous'}${body ? ' ' + JSON.stringify(body).slice(0, 100) : ''}\n← ${r.status} ${text.slice(0, 150).replace(/\s+/g, ' ')}`);
  return { status: r.status, json, text };
}
let fails = 0; const check = (l: string, ok: boolean) => { log(`   ${ok ? 'PASS' : 'FAIL'}  ${l}`); if (!ok) fails++; };
const COMP = { id: '6351440e-be6a-4334-867c-d76f0b43f729', code: '278', name: 'EXTERNAL CATHODIC PROTECTION' };
(async () => {
  // Jeevan's vessel-settings refactor moved the superintendent lock to the per-vessel
  // pms_vessel_settings row; arm it so a high-severity WO computes the 'superintendent_locked'
  // tier and the acknowledge endpoints see a locked WO (was the implicit global default before).
  await shoreSql(`INSERT INTO pms_vessel_settings (vessel_id, superintendent_lock_enabled, updated_by) VALUES ('${V}', true, 'phase0-harness') ON CONFLICT (vessel_id) DO UPDATE SET superintendent_lock_enabled=true, updated_by='phase0-harness'`);
  hr('P0.4-1 superintendent-acknowledge (single + bulk)');
  const job = (await shoreSql(`SELECT id, job_title FROM jobs WHERE vessel_id='${V}' AND maintenance_basis='Calendar' AND is_deleted=false AND level2_reviewer_rank_id IS NULL ORDER BY id LIMIT 1`))[0];
  const mkLocked = async (tag: string) => {
    const wo = (await call('POST', '/work-orders', { vesselId: V, jobId: job.id, jobTitle: job.job_title, component: COMP.name, componentCode: COMP.code, componentId: COMP.id, assignedTo: '2nd Engineer', approver: 'Chief Engineer', department: 'Engine', maintenanceBasis: 'Calendar', frequencyValue: '30', frequencyUnit: 'Days', dueDate: daysAgo(40), nextDueDate: daysAgo(40), status: 'Due', workOrderType: 'Planned', isExecution: false, briefWorkDescription: `PHASE0 ${tag}` }, OFF)).json;
    await shoreSql(`UPDATE work_orders SET work_order_no='PHASE0-'||work_order_no WHERE id='${wo.id}'`);
    const n = new Date().toISOString();
    await call('PATCH', `/work-orders/${wo.id}`, { status: 'Pending Approval', approvalAction: 'submitted', completionDateTime: n, dateCompleted: n }, VU);
    return wo;
  };
  const tier = async (id: string) => (await shoreSql(`SELECT approval_tier, superintendent_acknowledged FROM work_orders WHERE id='${id}'`))[0];
  const w1 = await mkLocked('ack-single'), w2 = await mkLocked('ack-bulk');
  check('fixture locked', (await tier(w1.id)).approval_tier === 'superintendent_locked');
  check('single ack as Vessel User → 403', (await call('POST', `/work-orders/${w1.id}/superintendent-acknowledge`, {}, VU)).status === 403);
  check('single ack as Vessel Admin → 403', (await call('POST', `/work-orders/${w1.id}/superintendent-acknowledge`, {}, VA)).status === 403);
  check('single ack anonymous → 403', (await call('POST', `/work-orders/${w1.id}/superintendent-acknowledge`, {}, NONE)).status === 403);
  check('lock still in place after refused calls', (await tier(w1.id)).approval_tier === 'superintendent_locked' && (await tier(w1.id)).superintendent_acknowledged === false);
  check('single ack as Office → 200 and lock cleared', (await call('POST', `/work-orders/${w1.id}/superintendent-acknowledge`, {}, OFF)).status === 200 && (await tier(w1.id)).superintendent_acknowledged === true);
  check('bulk ack as Vessel User → 403', (await call('POST', '/work-orders/bulk-superintendent-acknowledge', { workOrderIds: [w2.id] }, VU)).status === 403);
  check('bulk ack as Office → 200', (await call('POST', '/work-orders/bulk-superintendent-acknowledge', { workOrderIds: [w2.id] }, OFF)).status === 200 && (await tier(w2.id)).superintendent_acknowledged === true);

  hr('P0.4-2 approval-workflow-config');
  const g = await call('GET', '/admin/approval-workflow-config', undefined, VU);
  check('GET as Vessel User → 200 (read kept open)', g.status === 200);
  const target = (g.json?.data ?? []).find((r: any) => r.functionId === 'pms-spares-cr' && r.variableName === 'Normal Spares');
  check('PUT as Vessel User → 403', (await call('PUT', '/admin/approval-workflow-config', { rows: [{ ...target, level1Enabled: true }] }, VU)).status === 403);
  check('PUT anonymous → 403', (await call('PUT', '/admin/approval-workflow-config', { rows: [{ ...target, level1Enabled: true }] }, NONE)).status === 403);
  check('PUT bad body as Office → 400', (await call('PUT', '/admin/approval-workflow-config', { rows: [{ functionId: 'x' }] }, OFF)).status === 400);
  check('PUT empty rows as Office → 400', (await call('PUT', '/admin/approval-workflow-config', { rows: [] }, OFF)).status === 400);
  const p = await call('PUT', '/admin/approval-workflow-config', { rows: [{ ...target, level1Enabled: true }] }, OFF);
  const dbRow = (await shoreSql(`SELECT level1_enabled, updated_by_uuid FROM approval_workflow_config WHERE function_id='pms-spares-cr' AND variable_name='Normal Spares' AND is_deleted=false`))[0];
  check('PUT as Office → 200, persisted, updated_by_uuid stamped from the request', p.status === 200 && dbRow.level1_enabled === true && dbRow.updated_by_uuid === OFF.id);
  log('   DB row:', JSON.stringify(dbRow));
  await call('PUT', '/admin/approval-workflow-config', { rows: [{ ...target, level1Enabled: false }] }, OFF);
  check('reverted', (await shoreSql(`SELECT level1_enabled FROM approval_workflow_config WHERE function_id='pms-spares-cr' AND variable_name='Normal Spares' AND is_deleted=false`))[0].level1_enabled === false);
  check('GET /admin/local-approvers as Vessel User → 200 (read used on ship Dashboard — kept open)', (await call('GET', '/admin/local-approvers', undefined, VU)).status === 200);

  hr('P0.4-3 CR approve / reject');
  const mkCR = async (who: any) => (await call('POST', '/change-requests', { vesselId: V, category: 'spares', title: 'PHASE0 p04 CR', reason: 'PHASE0', targetType: 'spare', targetId: 'e18a901d-5af6-4a7a-9201-4d62c592b4c6', proposedChangesJson: [{ id: 1, field: 'remarks', oldValue: 'MD (Material Declaration)', newValue: 'PHASE0-P04' }], status: 'submitted', requestedByUserId: who.id }, who)).json;
  const cr = await mkCR(VU);
  check('CR create as Vessel User still 201 (unchanged)', !!cr?.id);
  check('approve as Vessel User → 403', (await call('PUT', `/change-requests/${cr.id}/approve`, { comment: 'x' }, VU)).status === 403);
  check('approve as Vessel Admin → 403', (await call('PUT', `/change-requests/${cr.id}/approve`, { comment: 'x' }, VA)).status === 403);
  check('approve anonymous → 403', (await call('PUT', `/change-requests/${cr.id}/approve`, { comment: 'x' }, NONE)).status === 403);
  check('CR still submitted', (await shoreSql(`SELECT status FROM change_request WHERE id=${cr.id}`))[0].status === 'submitted');
  check('approve as Office → 200', (await call('PUT', `/change-requests/${cr.id}/approve`, { comment: 'ok' }, OFF)).status === 200);
  const cr2 = await mkCR(VU);
  check('reject as Vessel User → 403', (await call('PUT', `/change-requests/${cr2.id}/reject`, { comment: 'x' }, VU)).status === 403);
  check('reject as Office → 200', (await call('PUT', `/change-requests/${cr2.id}/reject`, { comment: 'no' }, OFF)).status === 200);

  hr('cleanup');
  await shoreSql(`DELETE FROM pms_vessel_settings WHERE vessel_id='${V}' AND updated_by='phase0-harness'`);
  await shoreSql(`DELETE FROM superintendent_notifications WHERE work_order_id IN (SELECT wouuid FROM work_orders WHERE work_order_no LIKE 'PHASE0%')`);
  await shoreSql(`DELETE FROM work_orders WHERE work_order_no LIKE 'PHASE0%'`); await shoreSql(`DELETE FROM change_request WHERE title LIKE 'PHASE0%'`);
  await shoreSql(`UPDATE spares SET remarks='MD (Material Declaration)' WHERE suuid='e18a901d-5af6-4a7a-9201-4d62c592b4c6'`);
  log('   remaining PHASE0:', JSON.stringify((await shoreSql(`SELECT (SELECT count(*) FROM work_orders WHERE work_order_no LIKE 'PHASE0%') wos, (SELECT count(*) FROM change_request WHERE title LIKE 'PHASE0%') crs`))[0]));
  log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAIL(S)'}`); await shorePool.end(); process.exit(fails ? 1 : 0);
})().catch(async (e) => { console.error('CRASH', e); await shorePool.end(); process.exit(1); });
