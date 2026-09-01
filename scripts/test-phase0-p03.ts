/**
 * Phase 0 / P0.3 — D2 + D3 (shore part; P0.3b ship refusal is in test-phase0-p03-ship.ts).
 *  a. component + job CR approved on SHORE: apply works; field-log rows = 0 BY SYNC DESIGN (ONE_WAY tables —
 *     requiresFieldLogging is BOTH_EDITABLE only); spare control = 1 row. Ship later receives comp/job via
 *     one-way row sync (covered by the end-to-end run).
 *  c. zero-step CR approved twice → second call 409 CR_ALREADY_DECIDED, revision stays 1, no re-apply.
 *  d. postponement approve: request row settled (no 'Awaiting Approval' left), getLatestAwaitingPostponement
 *     empty, replay still 400, one decision row.
 * Fixtures tagged PHASE0, deleted at end. Pass --before to only assert the pre-fix facts (for evidence).
 */
import { SHORE, V, shoreSql, shorePool, daysAgo, hr, log } from './drepro-common';
const OFF = { id: 'p0-office', name: 'P0 Office Admin', role: 'Admin', rank: 'Technical Superintendent', type: 'Office' };
const VU = { id: 'p0-3e', name: 'P0 Third Engineer', role: 'Vessel User', rank: 'Third Engineer', type: 'Ship' };
async function call(method: string, path: string, body: any, who: any) {
  const r = await fetch(`${SHORE}${path}`, { method, headers: { 'Content-Type': 'application/json', 'x-user-id': who.id, 'x-user-name': encodeURIComponent(who.name), 'x-user-role': encodeURIComponent(who.role), 'x-user-type': who.type, 'x-rank': who.rank }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  log(`→ ${method} ${path} as ${who.role}${body ? ' ' + JSON.stringify(body).slice(0, 110) : ''}\n← ${r.status} ${text.slice(0, 170).replace(/\s+/g, ' ')}`);
  return { status: r.status, json, text };
}
let fails = 0; const check = (l: string, ok: boolean) => { log(`   ${ok ? 'PASS' : 'FAIL'}  ${l}`); if (!ok) fails++; };
const COMP = { cuuid: '6351440e-be6a-4334-867c-d76f0b43f729', code: '278', name: 'EXTERNAL CATHODIC PROTECTION' };
const JOB = { juuid: '67a218d0-9974-43f3-a684-b8e145e8fd46' };
const SPARE = { suuid: '6ea1d16f-2dc6-4083-b2e2-414ab4cdb426' };
const mkCR = (category: string, targetType: string, targetId: string, field: string, oldValue: any, newValue: any, who = VU) =>
  call('POST', '/change-requests', { vesselId: V, category, title: `PHASE0 ${targetType} ${field}`, reason: 'PHASE0', targetType, targetId, proposedChangesJson: [{ id: 1, field, oldValue, newValue, justification: 'PHASE0' }], status: 'submitted', requestedByUserId: who.id }, who);

(async () => {
  hr('P0.3a component/job/spare CR approve on shore — applies + field-log rows');
  const logMax = (await shoreSql(`SELECT max(id) m FROM sync_field_log`))[0].m;
  const crC = (await mkCR('components', 'component', COMP.cuuid, 'maker', null, 'PHASE0-MAKER')).json;
  const crJ = (await mkCR('work_orders', 'job', JOB.juuid, 'jobPriority', 'Medium', 'High')).json;
  const crS = (await mkCR('spares', 'spare', SPARE.suuid, 'remarks', 'MD (Material Declaration)', 'PHASE0-REMARKS')).json;
  for (const cr of [crC, crJ, crS]) { const r = await call('PUT', `/change-requests/${cr.id}/approve`, { comment: 'PHASE0 approve' }, OFF); check(`approve ${cr.targetType} CR ${cr.id} → 200 approved`, r.status === 200 && r.json?.status === 'approved'); }
  const vals = (await shoreSql(`SELECT (SELECT maker FROM components WHERE cuuid='${COMP.cuuid}') maker, (SELECT job_priority FROM jobs WHERE juuid='${JOB.juuid}') prio, (SELECT remarks FROM spares WHERE suuid='${SPARE.suuid}') remarks`))[0];
  check('values applied on shore (maker/prio/remarks)', vals.maker === 'PHASE0-MAKER' && vals.prio === 'High' && vals.remarks === 'PHASE0-REMARKS');
  const rows = await shoreSql(`SELECT table_name, count(*) c FROM sync_field_log WHERE id > ${logMax} AND table_name IN ('components','jobs','spares') GROUP BY 1 ORDER BY 1`);
  log('   field-log rows by table since approve:', JSON.stringify(rows));
  const cnt = (t: string) => Number(rows.find((r: any) => r.table_name === t)?.c ?? 0);
  check('spares (BOTH_EDITABLE) logged 1 row', cnt('spares') === 1);
  check('components/jobs logged 0 rows — by sync design (ONE_WAY_SHORE_TO_SHIP; requiresFieldLogging=BOTH_EDITABLE only)', cnt('components') === 0 && cnt('jobs') === 0);

  hr('P0.3c zero-step CR approved twice');
  const crD = (await mkCR('spares', 'spare', SPARE.suuid, 'remarks', 'PHASE0-REMARKS', 'PHASE0-DOUBLE')).json;
  check('zero approval steps on this CR', Number((await shoreSql(`SELECT count(*) FROM change_request_approval WHERE change_request_id=${crD.id}`))[0].count) === 0);
  const a1 = await call('PUT', `/change-requests/${crD.id}/approve`, { comment: 'first' }, OFF);
  const a2 = await call('PUT', `/change-requests/${crD.id}/approve`, { comment: 'second (replay)' }, OFF);
  const crRow = (await shoreSql(`SELECT status, revision_number FROM change_request WHERE id=${crD.id}`))[0];
  check('first approve → 200 approved rev 1', a1.status === 200 && a1.json?.revisionNumber === 1);
  check('second approve → 409 CR_ALREADY_DECIDED (was 200 rev 2)', a2.status === 409 && a2.json?.details?.code === 'CR_ALREADY_DECIDED');
  check('revision stays 1', Number(crRow.revision_number) === 1);
  const rj = await call('PUT', `/change-requests/${crD.id}/reject`, { comment: 'reject after approve?' }, OFF);
  check('reject on an approved CR → 409 CR_ALREADY_DECIDED (same class, observed on the pilot → guarded)', rj.status === 409 && rj.json?.details?.code === 'CR_ALREADY_DECIDED');

  hr('P0.3d postponement finalize — request row settled, one tx, replay still 400');
  const job = (await shoreSql(`SELECT id, job_title FROM jobs WHERE vessel_id='${V}' AND maintenance_basis='Calendar' AND is_deleted=false ORDER BY id LIMIT 1`))[0];
  const wo = (await call('POST', '/work-orders', { vesselId: V, jobId: job.id, jobTitle: job.job_title, component: COMP.name, componentCode: COMP.code, componentId: COMP.cuuid, assignedTo: '2nd Engineer', approver: 'Chief Engineer', department: 'Engine', maintenanceBasis: 'Calendar', frequencyValue: '30', frequencyUnit: 'Days', dueDate: daysAgo(-10), nextDueDate: daysAgo(-10), status: 'Due', workOrderType: 'Planned', isExecution: false, briefWorkDescription: 'PHASE0 postpone' }, OFF)).json;
  await shoreSql(`UPDATE work_orders SET work_order_no='PHASE0-'||work_order_no WHERE id='${wo.id}'`);
  await call('POST', `/work-orders/${wo.id}/postpone-request`, { nextDueDate: daysAgo(-40).slice(0, 10), reason: 'Awaiting spare parts onboard.', postponementRemarks: 'PHASE0', userId: VU.id }, VU);
  const rowsSql = `SELECT postponement_number n, status, approved_by FROM work_order_postponements WHERE work_order_id='${wo.wouuid}' ORDER BY n, status`;
  log('   rows before:', JSON.stringify(await shoreSql(rowsSql)));
  const p1 = await call('POST', `/work-orders/${wo.id}/postpone-approve`, { approvedBy: OFF.name, approvalRemarks: 'PHASE0 approve', userUuid: OFF.id, role: 'Office' }, OFF);
  const after = await shoreSql(rowsSql); log('   rows after:', JSON.stringify(after));
  check('approve → 200, WO Postponement Approved', p1.status === 200 && (await shoreSql(`SELECT status FROM work_orders WHERE wouuid='${wo.wouuid}'`))[0].status === 'Postponement Approved');
  check('no dangling Awaiting Approval row', after.every((r: any) => r.status !== 'Awaiting Approval'));
  check('exactly one decision row (#2 Approved) + request row #1 settled to Approved', after.length === 2 && after.filter((r: any) => r.status === 'Approved').length === 2);
  const p2 = await call('POST', `/work-orders/${wo.id}/postpone-approve`, { approvedBy: OFF.name, approvalRemarks: 'PHASE0 replay', userUuid: OFF.id, role: 'Office' }, OFF);
  check('sequential replay still 400 (status guard unchanged)', p2.status === 400);
  check('row count unchanged after replay', (await shoreSql(rowsSql)).length === 2);
  const logs = await shoreSql(`SELECT table_name, count(*) c FROM sync_field_log WHERE row_uuid IN ('${wo.wouuid}') OR row_uuid IN (SELECT id FROM work_order_postponements WHERE work_order_id='${wo.wouuid}') GROUP BY 1 ORDER BY 1`);
  log('   field-log rows for this WO + its postponement rows:', JSON.stringify(logs));
  check('field logs exist for work_orders and work_order_postponements (tx-joined)', logs.some((l: any) => l.table_name === 'work_orders') && logs.some((l: any) => l.table_name === 'work_order_postponements'));

  hr('cleanup');
  await shoreSql(`DELETE FROM work_order_postponements WHERE work_order_id='${wo.wouuid}'`); await shoreSql(`DELETE FROM work_orders WHERE wouuid='${wo.wouuid}'`);
  await shoreSql(`DELETE FROM change_request WHERE title LIKE 'PHASE0%'`);
  await shoreSql(`UPDATE components SET maker=NULL WHERE cuuid='${COMP.cuuid}' AND maker LIKE 'PHASE0%'`); await shoreSql(`UPDATE jobs SET job_priority='Medium' WHERE juuid='${JOB.juuid}'`); await shoreSql(`UPDATE spares SET remarks='MD (Material Declaration)' WHERE suuid='${SPARE.suuid}'`);
  log('   remaining PHASE0 CRs/WOs:', JSON.stringify((await shoreSql(`SELECT (SELECT count(*) FROM change_request WHERE title LIKE 'PHASE0%') crs, (SELECT count(*) FROM work_orders WHERE work_order_no LIKE 'PHASE0%') wos`))[0]));
  log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAIL(S)'}`); await shorePool.end(); process.exit(fails ? 1 : 0);
})().catch(async (e) => { console.error('CRASH', e); await shorePool.end(); process.exit(1); });
