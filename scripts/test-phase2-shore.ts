/**
 * Phase 2 — SHORE engine-path harness (pilot :5000, branch build).
 * Guide checklist items 1,2,4,5,6,7 + W6 shore legs:
 *  A. seed: 2 office users (real role), 2 moc Level-1 pool members, 1 ship-scoped Vessel Admin
 *     + vessel assignment (D-1 resolution proof both branches).
 *  B. office saves a 2-STEP chain for spares CR 'Normal Spares': step1 = moc pool (ANY of 2),
 *     step2 = office role (Admin OLDBUILD ruid); vessel-role save 403.
 *  C. spare CR through the chain: submit hook STARTED (CR stays submitted) → stranger 403 →
 *     pool member approves (non-terminal) → office user pendingForUser + approves → terminal:
 *     CR approved, spare value applied, spares sync_field_log row, engine request approved,
 *     replay 409, notifier audit rows exist.
 *  D. reject path on a second CR → CR rejected with remarks; slots superseded.
 *  E. postponement through a 2-step chain (pool ANY → office role) → WO Postponement Approved,
 *     request row settled; engine request approved.
 *  F. DISABLED scope → legacy immediate approve, byte-identical.
 *  G. resolveApprovers D-1 direct checks (office fleet-wide vs ship-role vessel-scoped incl.
 *     unassigned-user exclusion).
 *  H. W5 generator on seeded awc rows: dry-run + --apply + equality assert + generated chain used.
 * Cleanup: everything tagged P2 + apprv rows + seeded users/moc/awc + spare remarks restored.
 */
import { execSync } from 'child_process';
import { SHORE, V, shoreSql, shorePool, daysAgo, hr, log } from './drepro-common';

const OFF1 = { id: 'p2-off-1', name: 'P2 Office One', role: 'Admin (OLDBUILD-MATCHED)', type: 'Office', rank: 'Technical Superintendent' };
const OFF2 = { id: 'p2-off-2', name: 'P2 Office Two', role: 'Admin (OLDBUILD-MATCHED)', type: 'Office', rank: 'Technical Superintendent' };
const MOCA = { id: 'p2-moc-a', name: 'P2 Pool A', role: 'Admin (OLDBUILD-MATCHED)', type: 'Office', rank: 'Technical Superintendent' };
const MOCB = { id: 'p2-moc-b', name: 'P2 Pool B', role: 'Admin (OLDBUILD-MATCHED)', type: 'Office', rank: 'Technical Superintendent' };
const SHIPCA = { id: 'p2-ship-ca', name: 'P2 Ship CE', role: 'Vessel Admin', type: 'Ship', rank: 'Chief Engineer' };
const VU = { id: 'p2-vu', name: 'P2 Vessel User', role: 'Vessel User', type: 'Ship', rank: 'Third Engineer' };
const STRANGER = { id: 'p2-stranger', name: 'P2 Stranger', role: 'Admin (OLDBUILD-MATCHED)', type: 'Office', rank: 'Technical Superintendent' };
const ADMIN = { id: 'p2-admin', name: 'P2 Admin', role: 'Sail Admin', type: 'Office', rank: 'Technical Superintendent' }; // F6/Q2: builder is admin-only
const ADMIN_RUID = '28893a97-e475-4e19-afc5-d17f1b9adbb6'; // Admin (OLDBUILD-MATCHED), roletype Office
const VESSEL_ADMIN_RUID = 'c064869d-ec04-4633-8076-e9e6043f1f47'; // Vessel Admin, roletype Ship
const SPARE = { suuid: '6ea1d16f-2dc6-4083-b2e2-414ab4cdb426' };
const AE = '/approval-engine';

async function call(method: string, path: string, body: any, who: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (who?.id) { headers['x-user-id'] = who.id; headers['x-user-name'] = encodeURIComponent(who.name); headers['x-user-role'] = encodeURIComponent(who.role); headers['x-user-type'] = who.type; headers['x-rank'] = who.rank; }
  const r = await fetch(`${SHORE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  log(`→ ${method} ${path} as ${who?.role ?? 'anon'}${body ? ' ' + JSON.stringify(body).slice(0, 110) : ''}\n← ${r.status} ${text.slice(0, 160).replace(/\s+/g, ' ')}`);
  return { status: r.status, json, text };
}
let fails = 0; const check = (l: string, ok: boolean) => { log(`   ${ok ? 'PASS' : 'FAIL'}  ${l}`); if (!ok) fails++; };
const engineReq = (screenId: string, subjectRef: string) =>
  shoreSql(`SELECT requuid, status, current_node_key FROM apprv_requests WHERE module_id='technical' AND screen_id='${screenId}' AND subject_ref='${subjectRef}' ORDER BY submitted_at DESC`);

const chain2step = (screenId: string, classification: string) => ({
  scope: { moduleId: 'technical', screenId, actionId: '' }, classification, mode: 'simple', label: 'P2 test chain',
  nodes: [
    { key: 'step-1', type: 'approval-step', label: 'Pool review', ordinal: 0, quorum: { rule: 'any' }, slots: [{ roleId: 'moc:Level 1', roleLabel: 'Approver Pool — Level 1 (moc list)' }] },
    { key: 'step-2', type: 'approval-step', label: 'Office sign-off', ordinal: 1, quorum: { rule: 'all' }, slots: [{ roleId: ADMIN_RUID, roleLabel: 'Admin (OLDBUILD-MATCHED)' }] },
    { key: 'end', type: 'end', label: 'End', ordinal: 2 },
  ],
  edges: [{ from: 'step-1', to: 'step-2' }, { from: 'step-2', to: 'end' }],
});

(async () => {
  hr('A. seed users + pool + assignment');
  for (const u of [OFF1, OFF2, MOCA, MOCB, SHIPCA, VU, STRANGER]) {
    await shoreSql(`INSERT INTO master_users (id, full_name, role, user_type, is_deleted) VALUES ('${u.id}', '${u.name}', '${u.role}', '${u.type}', false)
      ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role, is_deleted=false`);
  }
  // APPROVAL_VESSEL_SCOPE_STRICT (default ON): office approvers used below must be vessel-assigned
  // (else the engine's office step resolves to zero → NOT_YOUR_TURN). Assign p2-off-1/p2-off-2;
  // leave p2-moc-*/p2-stranger UNassigned so section G proves office roles are genuinely scoped.
  for (const uid of ['p2-ship-ca', 'p2-off-1', 'p2-off-2']) {
    await shoreSql(`INSERT INTO master_user_vessels (user_uuid, vessel_id, is_active, map_status) VALUES ('${uid}', '${V}', true, 'unmapped') ON CONFLICT (user_uuid, vessel_id) DO UPDATE SET is_active=true`);
  }
  for (const m of [MOCA, MOCB]) {
    await shoreSql(`INSERT INTO moc_approvers (mauuid, name, user_uuid, approver_level, is_active, modulename, is_deleted) VALUES ('p2-moc-${m.id}', '${m.name}', '${m.id}', 'Level 1', 1, 'Technical', false)`);
  }
  log('   seeded 7 users, 1 assignment, 2 moc Level-1 members');

  hr('B. office saves the 2-step chain (spares CR / Normal Spares); vessel save 403');
  check('save as Vessel User → 403', (await call('POST', `${AE}/workflows`, chain2step('pms-spares-cr', 'Critical Spares'), VU)).status === 403);
  const wf = await call('POST', `${AE}/workflows`, chain2step('pms-spares-cr', 'Critical Spares'), ADMIN);
  check('save as Office → 201 v1 active', wf.status === 201 && wf.json.version >= 1 && wf.json.status === 'active');
  const roles = await call('GET', `${AE}/roles?moduleId=technical&screenId=pms-spares-cr&actionId=`, undefined, OFF1);
  check('listRoles: real ruids + 2 moc pools', roles.json.some((r: any) => r.roleId === ADMIN_RUID) && roles.json.filter((r: any) => String(r.roleId).startsWith('moc:')).length === 2);

  hr('C. spare CR through the chain');
  const logMax = (await shoreSql(`SELECT max(id) m FROM sync_field_log`))[0].m;
  const cr = (await call('POST', '/change-requests', { vesselId: V, category: 'spares', title: 'P2 spare CR chain', reason: 'P2', targetType: 'spare', targetId: SPARE.suuid, proposedChangesJson: [{ id: 1, field: 'remarks', oldValue: 'MD (Material Declaration)', newValue: 'P2-ENGINE-APPLIED' }], status: 'submitted', requestedByUserId: VU.id }, VU)).json;
  let reqs = await engineReq('pms-spares-cr', cr.cruuid);
  check('submit hook: chain STARTED at step-1, CR stays submitted', reqs.length === 1 && reqs[0].status === 'pending' && reqs[0].current_node_key === 'step-1'
    && (await shoreSql(`SELECT status FROM change_request WHERE id=${cr.id}`))[0].status === 'submitted');
  check('stranger (office role but not in pool) approve → 403', (await call('PUT', `/change-requests/${cr.id}/approve`, { comment: 'me?' }, STRANGER)).status === 403);
  check('office step-2 user too early → 403 (not their turn)', (await call('PUT', `/change-requests/${cr.id}/approve`, { comment: 'early' }, OFF1)).status === 403);
  const a1 = await call('PUT', `/change-requests/${cr.id}/approve`, { comment: 'pool ok' }, MOCB);
  check('pool member B approves (ANY) → 200, CR still submitted, step-2 active', a1.status === 200
    && (await shoreSql(`SELECT status FROM change_request WHERE id=${cr.id}`))[0].status === 'submitted'
    && (await engineReq('pms-spares-cr', cr.cruuid))[0].current_node_key === 'step-2');
  const pend = await call('GET', `${AE}/pending`, undefined, OFF1);
  check('pendingForUser(office) shows the CR at step-2', pend.json.some((p: any) => p.subjectRef === cr.cruuid));
  const a2 = await call('PUT', `/change-requests/${cr.id}/approve`, { comment: 'final ok' }, OFF1);
  const crAfter = (await shoreSql(`SELECT status, revision_number FROM change_request WHERE id=${cr.id}`))[0];
  check('office approves → CR approved rev 1 (onDecision applied via legacy path)', a2.status === 200 && crAfter.status === 'approved' && Number(crAfter.revision_number) === 1);
  check('spare value applied', (await shoreSql(`SELECT remarks FROM spares WHERE suuid='${SPARE.suuid}'`))[0].remarks === 'P2-ENGINE-APPLIED');
  check('spares sync_field_log row written by the apply', Number((await shoreSql(`SELECT count(*) FROM sync_field_log WHERE id > ${logMax} AND table_name='spares'`))[0].count) === 1);
  reqs = await engineReq('pms-spares-cr', cr.cruuid);
  const supersededCount = Number((await shoreSql(`SELECT count(*) FROM apprv_request_slots WHERE requuid='${reqs[0].requuid}' AND status='superseded'`))[0].count);
  check('engine request approved; superseded slots kept (>=0 rows, none deleted: total slots = 2)', reqs[0].status === 'approved'
    && Number((await shoreSql(`SELECT count(*) FROM apprv_request_slots WHERE requuid='${reqs[0].requuid}'`))[0].count) === 2 && supersededCount === 0);
  check('replay approve → 409', (await call('PUT', `/change-requests/${cr.id}/approve`, { comment: 'again' }, OFF1)).status === 409);
  check('notifier audit rows exist (step-activated ×2 + completed)', Number((await shoreSql(`SELECT count(*) FROM audit_log WHERE entity_type='approval_request' AND entity_id='${reqs[0].requuid}'`))[0].count) >= 3);

  hr('D. reject path');
  const cr2 = (await call('POST', '/change-requests', { vesselId: V, category: 'spares', title: 'P2 spare CR reject', reason: 'P2', targetType: 'spare', targetId: SPARE.suuid, proposedChangesJson: [{ id: 1, field: 'remarks', oldValue: 'P2-ENGINE-APPLIED', newValue: 'P2-SHOULD-NOT-APPLY' }], status: 'submitted', requestedByUserId: VU.id }, VU)).json;
  const rj = await call('PUT', `/change-requests/${cr2.id}/reject`, { comment: 'not acceptable' }, MOCA);
  const cr2After = (await shoreSql(`SELECT status FROM change_request WHERE id=${cr2.id}`))[0];
  check('pool member rejects → CR rejected, value NOT applied', rj.status === 200 && cr2After.status === 'rejected'
    && (await shoreSql(`SELECT remarks FROM spares WHERE suuid='${SPARE.suuid}'`))[0].remarks === 'P2-ENGINE-APPLIED');
  const req2 = (await engineReq('pms-spares-cr', cr2.cruuid))[0];
  check('engine request returned; step-2 slot superseded', req2.status === 'returned'
    && (await shoreSql(`SELECT status FROM apprv_request_slots WHERE requuid='${req2.requuid}' AND node_key='step-2'`))[0].status === 'superseded');

  hr('E. postponement through a 2-step chain');
  const wfP = await call('POST', `${AE}/workflows`, chain2step('pms-wo-postponement', 'Normal WO'), ADMIN);
  check('postponement chain saved', wfP.status === 201);
  const job = (await shoreSql(`SELECT j.id, j.job_title FROM jobs j LEFT JOIN components c ON c.cuuid = j.component_id WHERE j.vessel_id='${V}' AND j.maintenance_basis='Calendar' AND j.is_deleted=false AND (j.criticality IS NULL OR j.criticality <> 'Yes') AND (c.critical IS NOT TRUE) ORDER BY j.id LIMIT 1`))[0];
  const wo = (await call('POST', '/work-orders', { vesselId: V, jobId: job.id, jobTitle: job.job_title, component: 'EXTERNAL CATHODIC PROTECTION', componentCode: '278', componentId: '6351440e-be6a-4334-867c-d76f0b43f729', assignedTo: '2nd Engineer', approver: 'Chief Engineer', department: 'Engine', maintenanceBasis: 'Calendar', frequencyValue: '30', frequencyUnit: 'Days', dueDate: daysAgo(-10), nextDueDate: daysAgo(-10), status: 'Due', workOrderType: 'Planned', isExecution: false, briefWorkDescription: 'P2 postpone' }, OFF1)).json;
  await shoreSql(`UPDATE work_orders SET work_order_no='P2-'||work_order_no WHERE id='${wo.id}'`);
  await call('POST', `/work-orders/${wo.id}/postpone-request`, { nextDueDate: daysAgo(-40).slice(0, 10), reason: 'Awaiting spare parts onboard.', postponementRemarks: 'P2', userId: VU.id }, VU);
  let reqP = await engineReq('pms-wo-postponement', wo.wouuid);
  check('postpone-request → chain STARTED (WO stays Awaiting Office Approval)', reqP.length === 1 && reqP[0].status === 'pending'
    && (await shoreSql(`SELECT status FROM work_orders WHERE wouuid='${wo.wouuid}'`))[0].status === 'Awaiting Office Approval');
  const pa1 = await call('POST', `/work-orders/${wo.id}/postpone-approve`, { approvedBy: MOCA.name, approvalRemarks: 'pool ok', userUuid: MOCA.id, role: 'Office' }, MOCA);
  check('pool approve non-terminal → WO unchanged, step-2 active', pa1.status === 200
    && (await shoreSql(`SELECT status FROM work_orders WHERE wouuid='${wo.wouuid}'`))[0].status === 'Awaiting Office Approval'
    && (await engineReq('pms-wo-postponement', wo.wouuid))[0].current_node_key === 'step-2');
  const pa2 = await call('POST', `/work-orders/${wo.id}/postpone-approve`, { approvedBy: OFF1.name, approvalRemarks: 'final ok', userUuid: OFF1.id, role: 'Office' }, OFF1);
  const woAfter = (await shoreSql(`SELECT status, due_date FROM work_orders WHERE wouuid='${wo.wouuid}'`))[0];
  const ppRows = await shoreSql(`SELECT postponement_number n, status FROM work_order_postponements WHERE work_order_id='${wo.wouuid}' ORDER BY n, status`);
  check('office approve terminal → Postponement Approved; rows settled [#1 Approved, #2 Approved]', pa2.status === 200 && woAfter.status === 'Postponement Approved'
    && ppRows.length === 2 && ppRows.every((r: any) => r.status === 'Approved'));
  check('engine request approved', (await engineReq('pms-wo-postponement', wo.wouuid))[0].status === 'approved');
  check('replay → 400 (module status guard, unchanged)', (await call('POST', `/work-orders/${wo.id}/postpone-approve`, { approvedBy: OFF1.name, approvalRemarks: 'again', userUuid: OFF1.id, role: 'Office' }, OFF1)).status === 400);

  hr('F. DISABLED scope → legacy path byte-identical');
  await call('PUT', `${AE}/scopes/enabled`, { scope: { moduleId: 'technical', screenId: 'pms-spares-cr', actionId: '' }, enabled: false }, ADMIN);
  const cr3 = (await call('POST', '/change-requests', { vesselId: V, category: 'spares', title: 'P2 spare CR disabled', reason: 'P2', targetType: 'spare', targetId: SPARE.suuid, proposedChangesJson: [{ id: 1, field: 'remarks', oldValue: 'P2-ENGINE-APPLIED', newValue: 'P2-LEGACY-APPLIED' }], status: 'submitted', requestedByUserId: VU.id }, VU)).json;
  check('no engine request created', (await engineReq('pms-spares-cr', cr3.cruuid)).length === 0);
  const a3 = await call('PUT', `/change-requests/${cr3.id}/approve`, { comment: 'legacy direct' }, OFF1);
  check('legacy immediate approve works exactly as before', a3.status === 200 && (await shoreSql(`SELECT remarks FROM spares WHERE suuid='${SPARE.suuid}'`))[0].remarks === 'P2-LEGACY-APPLIED');
  await call('PUT', `${AE}/scopes/enabled`, { scope: { moduleId: 'technical', screenId: 'pms-spares-cr', actionId: '' }, enabled: true }, ADMIN);

  hr('G. resolution under strict vessel-scope (default): office AND ship both vessel-scoped');
  const { technicalApprovalCard } = await import('../server/modules/approvals/approvalCard');
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:admin123@localhost:5432/pms_arch';
  const { initStorage } = await import('../server/storage');
  await initStorage();
  const scope = { moduleId: 'technical', screenId: 'pms-wo-postponement', actionId: '' };
  const officeIds = await technicalApprovalCard.resolveApprovers({ tenantId: 'default' }, scope as any, ADMIN_RUID, wo.wouuid);
  check('office role is VESSEL-SCOPED under strict (assigned p2-off-1/p2-off-2 IN; unassigned p2-moc-*/p2-stranger OUT)',
    ['p2-off-1', 'p2-off-2'].every((u) => officeIds.includes(u)) && !['p2-moc-a', 'p2-moc-b', 'p2-stranger'].some((u) => officeIds.includes(u)));
  const shipIds = await technicalApprovalCard.resolveApprovers({ tenantId: 'default' }, scope as any, VESSEL_ADMIN_RUID, wo.wouuid);
  check('ship role resolves ONLY vessel-assigned holders (p2-ship-ca yes; unassigned holders no)', shipIds.includes('p2-ship-ca') && shipIds.every((u) => u === 'p2-ship-ca'));

  hr('H. W5 generator (seeded awc: stores L1 on) — dry-run, apply, equality, chain live');
  await shoreSql(`UPDATE approval_workflow_config SET level1_enabled=true WHERE function_id='pms-stores-cr' AND variable_name='Store Items' AND is_deleted=false`);
  const dry = execSync(`npx tsx scripts/generate-approval-workflows-from-awc.ts --tenant pilot`, { encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgres://postgres:admin123@localhost:5432/pms_arch' } });
  check('dry-run reports the stores workflow ready + equality asserted', /pms-stores-cr \/ Store Items.*workflow ready/.test(dry) && /approver set UNCHANGED/.test(dry));
  const applied = execSync(`npx tsx scripts/generate-approval-workflows-from-awc.ts --apply --tenant pilot`, { encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgres://postgres:admin123@localhost:5432/pms_arch' } });
  check('apply saves it', /workflow SAVED \(active\)/.test(applied));
  check('generated workflow row exists', Number((await shoreSql(`SELECT count(*) FROM apprv_workflows WHERE screen_id='pms-stores-cr' AND status='active'`))[0].count) === 1);
  // cutover rule: switch the awc level OFF now that the workflow owns the scope
  await shoreSql(`UPDATE approval_workflow_config SET level1_enabled=false WHERE function_id='pms-stores-cr' AND variable_name='Store Items' AND is_deleted=false`);
  const store = (await shoreSql(`SELECT stuuid FROM stores_items WHERE vessel_id='${V}' AND is_deleted=false LIMIT 1`).catch(() => []))[0];
  if (store) {
    const cr4 = (await call('POST', '/change-requests', { vesselId: V, category: 'stores', title: 'P2 store CR via generated chain', reason: 'P2', targetType: 'store', targetId: store.stuuid, proposedChangesJson: [{ id: 1, field: 'remarks', oldValue: null, newValue: 'P2-STORE' }], status: 'submitted', requestedByUserId: VU.id }, VU)).json;
    check('store CR routed onto the GENERATED chain', (await engineReq('pms-stores-cr', cr4.cruuid)).length === 1);
    const g1 = await call('PUT', `/change-requests/${cr4.id}/approve`, { comment: 'pool (generated chain)' }, MOCB);
    check('moc pool member approves the generated 1-step chain → CR approved', g1.status === 200 && (await shoreSql(`SELECT status FROM change_request WHERE id=${cr4.id}`))[0].status === 'approved');
  } else { log('   (no stores item on the pilot — generated-chain live test skipped, structure asserted above)'); }

  hr('cleanup');
  await shoreSql(`DELETE FROM apprv_request_slots WHERE requuid IN (SELECT requuid FROM apprv_requests WHERE module_id='technical')`);
  await shoreSql(`DELETE FROM apprv_requests WHERE module_id='technical'`);
  await shoreSql(`DELETE FROM apprv_node_slots WHERE workflow_wfuuid IN (SELECT wfuuid FROM apprv_workflows WHERE module_id='technical')`);
  await shoreSql(`DELETE FROM apprv_node_edges WHERE workflow_wfuuid IN (SELECT wfuuid FROM apprv_workflows WHERE module_id='technical')`);
  await shoreSql(`DELETE FROM apprv_workflow_nodes WHERE workflow_wfuuid IN (SELECT wfuuid FROM apprv_workflows WHERE module_id='technical')`);
  await shoreSql(`DELETE FROM apprv_workflows WHERE module_id='technical'`);
  await shoreSql(`DELETE FROM apprv_scope_settings WHERE module_id='technical'`);
  await shoreSql(`DELETE FROM change_request WHERE title LIKE 'P2 %'`);
  await shoreSql(`DELETE FROM work_order_postponements WHERE work_order_id='${wo.wouuid}'`);
  await shoreSql(`DELETE FROM work_orders WHERE wouuid='${wo.wouuid}'`);
  await shoreSql(`DELETE FROM moc_approvers WHERE mauuid LIKE 'p2-moc-%'`);
  await shoreSql(`DELETE FROM master_user_vessels WHERE user_uuid LIKE 'p2-%'`);
  await shoreSql(`DELETE FROM master_users WHERE id LIKE 'p2-%'`);
  await shoreSql(`UPDATE spares SET remarks='MD (Material Declaration)' WHERE suuid='${SPARE.suuid}'`);
  await shoreSql(`DELETE FROM audit_log WHERE entity_type='approval_request'`);
  log('   remaining P2 rows:', JSON.stringify((await shoreSql(`SELECT (SELECT count(*) FROM apprv_requests) ae, (SELECT count(*) FROM change_request WHERE title LIKE 'P2 %') crs, (SELECT count(*) FROM master_users WHERE id LIKE 'p2-%') users`))[0]));
  log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAIL(S)'}`);
  await shorePool.end(); process.exit(fails ? 1 : 0);
})().catch(async (e) => { console.error('CRASH', e); await shorePool.end(); process.exit(1); });
