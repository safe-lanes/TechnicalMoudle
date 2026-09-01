/**
 * Phase 2 / W6 — full SHIP→SHORE→SHIP end-to-end through a configured 2-step chain (one OR
 * pool step), for ONE CR and ONE postponement; plus the ship-side no-engine facts.
 *  A. ship: engine NOT mounted (log) + engine status route 404 (client hook fail-soft input).
 *  B. seed (shore): pool + office users; save chains (spares CR 'Critical Spares' + 'Normal WO'
 *     postponement) — same shapes as the shore harness.
 *  C. SHIP creates a spare CR (submitted) → sync → ARRIVAL SWEEP starts the chain on shore →
 *     pool member approves → office approves → CR approved + value applied on shore → sync →
 *     SHIP sees CR approved + spare value (existing bidirectional sync — D-4: ships see only
 *     subject status, no engine rows anywhere on the ship).
 *  D. SHIP postpone-request → sync → sweep → chain → pool + office approve → 'Postponement
 *     Approved' → sync → SHIP status + request row settled; apprv_* tables EMPTY on the ship.
 * Cleanup both sides.
 */
import { SHIP, SHORE, V, api as dreproApi, shipSql, shoreSql, shorePool, syncShip, daysAgo, hr, log } from './drepro-common';

const OFF1 = { id: 'p2-off-1', name: 'P2 Office One', role: 'Admin (OLDBUILD-MATCHED)', type: 'Office', rank: 'Technical Superintendent' };
const MOCA = { id: 'p2-moc-a', name: 'P2 Pool A', role: 'Admin (OLDBUILD-MATCHED)', type: 'Office', rank: 'Technical Superintendent' };
const MOCB = { id: 'p2-moc-b', name: 'P2 Pool B', role: 'Admin (OLDBUILD-MATCHED)', type: 'Office', rank: 'Technical Superintendent' };
const ADMIN = { id: 'p2-admin', name: 'P2 Admin', role: 'Sail Admin', type: 'Office', rank: 'Technical Superintendent' }; // F6/Q2: builder is admin-only
const VU = { id: 'p2-vu', name: 'P2 Vessel User', role: 'Vessel User', type: 'Ship', rank: 'Third Engineer' };
const ADMIN_RUID = '28893a97-e475-4e19-afc5-d17f1b9adbb6';
const SPARE = { suuid: '6ea1d16f-2dc6-4083-b2e2-414ab4cdb426' };

async function call(base: string, method: string, path: string, body: any, who: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (who?.id) { headers['x-user-id'] = who.id; headers['x-user-name'] = encodeURIComponent(who.name); headers['x-user-role'] = encodeURIComponent(who.role); headers['x-user-type'] = who.type; headers['x-rank'] = who.rank; }
  const r = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  log(`→ ${base === SHIP ? 'SHIP ' : 'SHORE'} ${method} ${path} as ${who?.role ?? 'anon'}${body ? ' ' + JSON.stringify(body).slice(0, 100) : ''}\n← ${r.status} ${text.slice(0, 150).replace(/\s+/g, ' ')}`);
  return { status: r.status, json, text };
}
let fails = 0; const check = (l: string, ok: boolean) => { log(`   ${ok ? 'PASS' : 'FAIL'}  ${l}`); if (!ok) fails++; };
const chain2step = (screenId: string, classification: string) => ({
  scope: { moduleId: 'technical', screenId, actionId: '' }, classification, mode: 'simple', label: 'P2 e2e chain',
  nodes: [
    { key: 'step-1', type: 'approval-step', label: 'Pool review', ordinal: 0, quorum: { rule: 'any' }, slots: [{ roleId: 'moc:Level 1', roleLabel: 'Approver Pool — Level 1 (moc list)' }] },
    { key: 'step-2', type: 'approval-step', label: 'Office sign-off', ordinal: 1, quorum: { rule: 'all' }, slots: [{ roleId: ADMIN_RUID, roleLabel: 'Admin (OLDBUILD-MATCHED)' }] },
    { key: 'end', type: 'end', label: 'End', ordinal: 2 },
  ],
  edges: [{ from: 'step-1', to: 'step-2' }, { from: 'step-2', to: 'end' }],
});

(async () => {
  hr('A. ship-side facts');
  const { execSync } = await import('child_process');
  check('ship log: engine NOT mounted (shore-only)', /Approval engine NOT mounted/.test(execSync('docker logs pms-ship 2>&1 | grep -c "Approval engine NOT mounted" || true', { encoding: 'utf8' }) === '0\n' ? '' : 'Approval engine NOT mounted'));
  const shipStatus = await call(SHIP, 'GET', '/approval-engine/requests/status?moduleId=technical&screenId=pms-spares-cr&actionId=&subjectRef=x', undefined, VU);
  check('engine status route on SHIP → 404 (client hook fail-soft)', shipStatus.status === 404);
  check('apprv_* tables exist on ship (migration ran) but stay EMPTY', shipSql(`SELECT count(*) FROM apprv_requests`) === '0');

  hr('B. seed + chains on shore');
  for (const u of [OFF1, MOCA, MOCB, VU]) {
    await shoreSql(`INSERT INTO master_users (id, full_name, role, user_type, is_deleted) VALUES ('${u.id}', '${u.name}', '${u.role}', '${u.type}', false) ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role, is_deleted=false`);
  }
  for (const m of [MOCA, MOCB]) {
    await shoreSql(`INSERT INTO moc_approvers (mauuid, name, user_uuid, approver_level, is_active, modulename, is_deleted) VALUES ('p2-moc-${m.id}', '${m.name}', '${m.id}', 'Level 1', 1, 'Technical', false)`);
  }
  // APPROVAL_VESSEL_SCOPE_STRICT (default ON): the office approver must be assigned to the vessel,
  // else the engine's office step resolves to zero approvers and the office approve → 403 NOT_YOUR_TURN.
  await shoreSql(`INSERT INTO master_user_vessels (user_uuid, vessel_id, is_active, map_status) VALUES ('p2-off-1', '${V}', true, 'unmapped') ON CONFLICT (user_uuid, vessel_id) DO UPDATE SET is_active=true`);
  check('spares chain saved (Critical Spares)', (await call(SHORE, 'POST', '/approval-engine/workflows', chain2step('pms-spares-cr', 'Critical Spares'), ADMIN)).status === 201);
  check('postponement chain saved (Normal WO)', (await call(SHORE, 'POST', '/approval-engine/workflows', chain2step('pms-wo-postponement', 'Normal WO'), ADMIN)).status === 201);

  hr('C. SHIP spare CR → sync → sweep → chain → decide ×2 → sync → ship sees the result');
  const cr = (await call(SHIP, 'POST', '/change-requests', { vesselId: V, category: 'spares', title: 'P2E2E ship spare CR', reason: 'P2E2E', targetType: 'spare', targetId: SPARE.suuid, proposedChangesJson: [{ id: 1, field: 'remarks', oldValue: 'MD (Material Declaration)', newValue: 'P2E2E-VIA-CHAIN' }], status: 'submitted', requestedByUserId: VU.id }, VU)).json;
  check('ship CR created (no engine row on ship)', !!cr.cruuid && shipSql(`SELECT count(*) FROM apprv_requests`) === '0');
  await syncShip('CR ship→shore');
  await new Promise((r) => setTimeout(r, 1500)); // arrival sweep is fire-and-forget post-response
  const reqRows = await shoreSql(`SELECT requuid, status, current_node_key FROM apprv_requests WHERE subject_ref='${cr.cruuid}'`);
  check('ARRIVAL SWEEP started the chain on shore (step-1)', reqRows.length === 1 && reqRows[0].status === 'pending' && reqRows[0].current_node_key === 'step-1');
  const shoreCrId = (await shoreSql(`SELECT id FROM change_request WHERE cruuid='${cr.cruuid}'`))[0].id;
  check('pool member approves (OR) → step-2', (await call(SHORE, 'PUT', `/change-requests/${shoreCrId}/approve`, { comment: 'pool ok' }, MOCB)).status === 200
    && (await shoreSql(`SELECT current_node_key FROM apprv_requests WHERE subject_ref='${cr.cruuid}'`))[0].current_node_key === 'step-2');
  check('office approves → CR approved + value applied on shore', (await call(SHORE, 'PUT', `/change-requests/${shoreCrId}/approve`, { comment: 'final ok' }, OFF1)).status === 200
    && (await shoreSql(`SELECT status FROM change_request WHERE id=${shoreCrId}`))[0].status === 'approved'
    && (await shoreSql(`SELECT remarks FROM spares WHERE suuid='${SPARE.suuid}'`))[0].remarks === 'P2E2E-VIA-CHAIN');
  await syncShip('result shore→ship');
  check('SHIP sees CR approved + spare value (D-4: subject status only, no engine rows)',
    shipSql(`SELECT status FROM change_request WHERE cruuid='${cr.cruuid}'`) === 'approved'
    && shipSql(`SELECT remarks FROM spares WHERE suuid='${SPARE.suuid}'`) === 'P2E2E-VIA-CHAIN'
    && shipSql(`SELECT count(*) FROM apprv_requests`) === '0');

  hr('D. SHIP postponement → sync → sweep → chain → decide ×2 → sync → ship settled');
  const job = (await shoreSql(`SELECT j.id, j.job_title FROM jobs j LEFT JOIN components c ON c.cuuid = j.component_id WHERE j.vessel_id='${V}' AND j.maintenance_basis='Calendar' AND j.is_deleted=false AND (j.criticality IS NULL OR j.criticality <> 'Yes') AND (c.critical IS NOT TRUE) ORDER BY j.id LIMIT 1`))[0];
  const wo = (await call(SHIP, 'POST', '/work-orders', { vesselId: V, jobId: job.id, jobTitle: job.job_title, component: 'EXTERNAL CATHODIC PROTECTION', componentCode: '278', componentId: '6351440e-be6a-4334-867c-d76f0b43f729', assignedTo: '2nd Engineer', approver: 'Chief Engineer', department: 'Engine', maintenanceBasis: 'Calendar', frequencyValue: '30', frequencyUnit: 'Days', dueDate: daysAgo(-10), nextDueDate: daysAgo(-10), status: 'Due', workOrderType: 'Planned', isExecution: false, briefWorkDescription: 'P2E2E postpone' }, VU)).json;
  await call(SHIP, 'POST', `/work-orders/${wo.id}/postpone-request`, { nextDueDate: daysAgo(-40).slice(0, 10), reason: 'Awaiting spare parts onboard.', postponementRemarks: 'P2E2E', userId: VU.id }, VU);
  check('ship WO Awaiting Office Approval, request row Awaiting (legacy shapes intact)',
    shipSql(`SELECT status FROM work_orders WHERE wouuid='${wo.wouuid}'`) === 'Awaiting Office Approval'
    && shipSql(`SELECT string_agg(status, ',') FROM work_order_postponements WHERE work_order_id='${wo.wouuid}'`) === 'Awaiting Approval');
  await syncShip('postpone ship→shore');
  await new Promise((r) => setTimeout(r, 1500));
  const reqP = await shoreSql(`SELECT requuid, status, current_node_key FROM apprv_requests WHERE subject_ref='${wo.wouuid}'`);
  check('sweep started the postponement chain', reqP.length === 1 && reqP[0].current_node_key === 'step-1');
  check('pool approve → step-2', (await call(SHORE, 'POST', `/work-orders/${wo.id}/postpone-approve`, { approvedBy: MOCA.name, approvalRemarks: 'pool ok', userUuid: MOCA.id, role: 'Office' }, MOCA)).status === 200
    && (await shoreSql(`SELECT current_node_key FROM apprv_requests WHERE subject_ref='${wo.wouuid}'`))[0].current_node_key === 'step-2');
  check('office approve → Postponement Approved + rows settled', (await call(SHORE, 'POST', `/work-orders/${wo.id}/postpone-approve`, { approvedBy: OFF1.name, approvalRemarks: 'final ok', userUuid: OFF1.id, role: 'Office' }, OFF1)).status === 200
    && (await shoreSql(`SELECT status FROM work_orders WHERE wouuid='${wo.wouuid}'`))[0].status === 'Postponement Approved'
    && (await shoreSql(`SELECT string_agg(status, ',' ORDER BY postponement_number) FROM work_order_postponements WHERE work_order_id='${wo.wouuid}'`))[0].string_agg === 'Approved,Approved');
  await syncShip('result shore→ship');
  check('SHIP sees Postponement Approved + settled rows + still zero engine rows',
    /^Postponement Approved/.test(shipSql(`SELECT status FROM work_orders WHERE wouuid='${wo.wouuid}'`))
    && shipSql(`SELECT string_agg(status, ',' ORDER BY postponement_number) FROM work_order_postponements WHERE work_order_id='${wo.wouuid}'`) === 'Approved,Approved'
    && shipSql(`SELECT count(*) FROM apprv_requests`) === '0');

  hr('cleanup both sides');
  for (const side of ['ship', 'shore'] as const) {
    const run = async (sql: string) => side === 'ship' ? shipSql(sql) : (await shoreSql(sql), '');
    await run(`DELETE FROM work_order_postponements WHERE work_order_id IN (SELECT wouuid FROM work_orders WHERE brief_work_description LIKE 'P2E2E%')`);
    await run(`DELETE FROM work_orders WHERE brief_work_description LIKE 'P2E2E%'`);
    await run(`DELETE FROM change_request WHERE title LIKE 'P2E2E%'`);
    await run(`UPDATE spares SET remarks='MD (Material Declaration)' WHERE suuid='${SPARE.suuid}'`);
  }
  await shoreSql(`DELETE FROM apprv_request_slots WHERE requuid IN (SELECT requuid FROM apprv_requests WHERE module_id='technical')`);
  await shoreSql(`DELETE FROM apprv_requests WHERE module_id='technical'`);
  await shoreSql(`DELETE FROM apprv_node_slots WHERE workflow_wfuuid IN (SELECT wfuuid FROM apprv_workflows WHERE module_id='technical')`);
  await shoreSql(`DELETE FROM apprv_node_edges WHERE workflow_wfuuid IN (SELECT wfuuid FROM apprv_workflows WHERE module_id='technical')`);
  await shoreSql(`DELETE FROM apprv_workflow_nodes WHERE workflow_wfuuid IN (SELECT wfuuid FROM apprv_workflows WHERE module_id='technical')`);
  await shoreSql(`DELETE FROM apprv_workflows WHERE module_id='technical'`);
  await shoreSql(`DELETE FROM master_user_vessels WHERE user_uuid LIKE 'p2-%'`);
  await shoreSql(`DELETE FROM master_users WHERE id LIKE 'p2-%'`);
  await shoreSql(`DELETE FROM moc_approvers WHERE mauuid LIKE 'p2-moc-%'`);
  await shoreSql(`DELETE FROM audit_log WHERE entity_type='approval_request'`);
  log('   SHORE remaining:', JSON.stringify((await shoreSql(`SELECT (SELECT count(*) FROM apprv_requests) ae, (SELECT count(*) FROM change_request WHERE title LIKE 'P2E2E%') crs, (SELECT count(*) FROM master_users WHERE id LIKE 'p2-%') users`))[0]));
  log('   SHIP remaining:', shipSql(`SELECT (SELECT count(*) FROM change_request WHERE title LIKE 'P2E2E%')||'/'||(SELECT count(*) FROM work_orders WHERE brief_work_description LIKE 'P2E2E%')`));
  log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAIL(S)'}`);
  await shorePool.end(); process.exit(fails ? 1 : 0);
})().catch(async (e) => { console.error('CRASH', e); await shorePool.end(); process.exit(1); });
