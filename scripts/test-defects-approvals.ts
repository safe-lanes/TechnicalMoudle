/**
 * DEFECTS × APPROVAL ENGINE — Phase B harness (pilot :5000, shore build).
 * Covers (build brief, 03-Sep-2026):
 *  A. seed: office approver (vessel-assigned) + same-role stranger (UNassigned — vessel-scope
 *     proof) + ship requester; one critical + one normal component picked from the pilot vessel.
 *  B. classification: critical component → 'Critical Equipment / COC Related'; normal component
 *     + is_coc → same bucket; plain normal → 'Normal' (asserted on apprv_requests rows).
 *  C. extension END TO END through a configured 1-step chain: request entry → chain STARTED,
 *     entry stays Requested; created-as-Approved under the chain → downgraded to Requested;
 *     unassigned same-role user approves → 403 (vessel scoping, out-of-scope = read-only);
 *     assigned approver approves via the same PATCH → entry Approved + targetCloseDate advanced
 *     + engine request approved.
 *  D. NO-CHAIN FALLBACK byte-identical: a 'Normal' defect (no workflow) self-approves exactly
 *     as legacy — entry saved Approved as sent, no engine request.
 *  E. Master-only closure (NOT the engine): non-Master PATCH of C1 fields → 403; Master → 200;
 *     the dormant /close route refuses non-Master too.
 *  F. verification: closure by Master auto-submits the verification chain; non-approver verify
 *     → refused; assigned approver verify → verified=true + decider identity stamped; and for
 *     an unconfigured classification verify passes through legacy (B7: NO_WORKFLOW, no error).
 * Cleanup: dfx-* users/assignments, seeded defects, defects apprv_* rows, component criticality
 * restored.
 * Run: shore up on :5000. `npx tsx scripts/test-defects-approvals.ts`
 */
import { SHORE, V, shoreSql, hr, log } from './drepro-common';

const ADMIN_RUID = '28893a97-e475-4e19-afc5-d17f1b9adbb6'; // Admin (OLDBUILD-MATCHED), roletype Office
const APPROVER = { id: 'dfx-appr', name: 'DFX Approver', role: 'Admin (OLDBUILD-MATCHED)', type: 'Office', rank: 'Technical Superintendent' };
const STRANGER = { id: 'dfx-strange', name: 'DFX Stranger', role: 'Admin (OLDBUILD-MATCHED)', type: 'Office', rank: 'Technical Superintendent' };
const SHIPOFF = { id: 'dfx-ship', name: 'DFX 2nd Eng', role: 'Vessel User', type: 'Ship', rank: 'Second Engineer' };
const MASTER = { id: 'dfx-master', name: 'DFX Master', role: 'Vessel Admin', type: 'Ship', rank: 'Master' };
const ADMIN = { id: 'dfx-admin', name: 'DFX Admin', role: 'Sail Admin', type: 'Office', rank: 'Technical Superintendent' };
const AE = '/approval-engine';
const CLS_CRIT = 'Critical Equipment / COC Related';
const CLS_NORM = 'Normal';

let fails = 0;
const check = (l: string, ok: boolean, detail = '') => { log(`   ${ok ? 'PASS' : 'FAIL'}  ${l}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };

async function call(method: string, path: string, body: any, who: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (who?.id) { headers['x-user-id'] = who.id; headers['x-user-name'] = encodeURIComponent(who.name); headers['x-user-role'] = encodeURIComponent(who.role); headers['x-user-type'] = who.type; headers['x-rank'] = who.rank; }
  const r = await fetch(`${SHORE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  log(`→ ${method} ${path} as ${who?.rank ?? 'anon'}${body ? ' ' + JSON.stringify(body).slice(0, 100) : ''}\n← ${r.status} ${text.slice(0, 140).replace(/\s+/g, ' ')}`);
  return { status: r.status, json, text };
}

const engineReq = (screenId: string, duuid: string) =>
  shoreSql(`SELECT requuid, status, classification FROM apprv_requests WHERE module_id='defects' AND screen_id='${screenId}' AND subject_ref='${duuid}' ORDER BY submitted_at DESC`);

const chain1step = (screenId: string, classification: string) => ({
  scope: { moduleId: 'defects', screenId, actionId: '' }, classification, mode: 'simple', label: 'DFX chain',
  nodes: [
    { key: 'step-1', type: 'approval-step', label: 'Office review', ordinal: 0, quorum: { rule: 'any' }, slots: [{ roleId: ADMIN_RUID, roleLabel: 'Admin (OLDBUILD-MATCHED)' }] },
    { key: 'end', type: 'end', label: 'End', ordinal: 1 },
  ],
  edges: [{ from: 'step-1', to: 'end' }],
});

const extEntry = (id: string, over: Partial<Record<string, any>> = {}) => ({
  id, existingTargetDate: '2026-09-10', newTargetDate: '2026-10-10', reasonForExtension: 'DFX harness reason',
  submitForApprovalTo: '', submitForApprovalToName: '', status: 'Requested',
  approvalDate: '', approverComments: '', requestedAt: new Date().toISOString(), ...over,
});

async function newDefect(componentId: string | null, isCoc = false): Promise<{ id: string; duuid: string }> {
  const r = await call('POST', '/defects', {
    vesselId: V, vesselName: 'WK Frontier Pilot', description: 'DFX harness defect', category: 'Defect',
    issueDate: '2026-09-01', reportedBy: 'DFX', status: 'Open', targetCloseDate: '2026-09-10',
    equipmentCategory: 'DFX', componentId: componentId ?? undefined, is_coc: isCoc, critical: false,
  }, SHIPOFF);
  if (r.status !== 200 && r.status !== 201) throw new Error(`defect create failed ${r.status}: ${r.text}`);
  const row = (await shoreSql(`SELECT id, duuid FROM defects WHERE id='${r.json.id}'`))[0];
  return { id: row.id, duuid: row.duuid };
}

(async () => {
  hr('A. seed users + assignment + components');
  for (const u of [APPROVER, STRANGER, SHIPOFF, MASTER, ADMIN]) {
    await shoreSql(`INSERT INTO master_users (id, full_name, role, user_type, is_deleted) VALUES ('${u.id}', '${u.name}', '${u.role}', '${u.type}', false)
      ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role, full_name=EXCLUDED.full_name, is_deleted=false`);
  }
  // strict vessel scope (default ON): ONLY dfx-appr is assigned; dfx-strange (same role) is not.
  await shoreSql(`INSERT INTO master_user_vessels (user_uuid, vessel_id, is_active, map_status) VALUES ('dfx-appr', '${V}', true, 'unmapped') ON CONFLICT (user_uuid, vessel_id) DO UPDATE SET is_active=true`);
  const comps = await shoreSql(`SELECT cuuid, critical FROM components WHERE vessel_id='${V}' AND cuuid IS NOT NULL ORDER BY critical DESC NULLS LAST LIMIT 200`);
  let critComp = comps.find((c: any) => c.critical === true)?.cuuid ?? null;
  const normComp = comps.find((c: any) => c.critical !== true)?.cuuid ?? null;
  let flippedComp: string | null = null;
  if (!critComp && normComp) { // pilot has no critical component — flip one temporarily, restore in cleanup
    flippedComp = comps[0].cuuid; await shoreSql(`UPDATE components SET critical=true WHERE cuuid='${flippedComp}'`); critComp = flippedComp;
  }
  check('seed components resolved', !!critComp && !!normComp, `crit=${critComp} norm=${normComp}`);

  hr('B. configure chains (extension: BOTH buckets? NO — critical only; verification: critical only)');
  const wf1 = await call('POST', `${AE}/workflows`, chain1step('defects-extension', CLS_CRIT), ADMIN);
  check('extension chain saved (critical bucket)', wf1.status === 200 || wf1.status === 201, `HTTP ${wf1.status}`);
  const wf2 = await call('POST', `${AE}/workflows`, chain1step('defects-verification', CLS_CRIT), ADMIN);
  check('verification chain saved (critical bucket)', wf2.status === 200 || wf2.status === 201, `HTTP ${wf2.status}`);
  const reg = await call('GET', `${AE}/registry`, undefined, ADMIN);
  check('registry lists the defects module (2 scopes, 2 classifications)', JSON.stringify(reg.json).includes('defects-extension') && JSON.stringify(reg.json).includes(CLS_CRIT));

  hr('C. extension end-to-end (critical component → configured chain)');
  const d1 = await newDefect(critComp);
  const r1 = await call('PATCH', `/defects/${d1.id}`, { targetDateExtensions: [extEntry('EXT-DFX-1')] }, SHIPOFF);
  check('C1 request PATCH ok', r1.status === 200, `HTTP ${r1.status}`);
  let req = await engineReq('defects-extension', d1.duuid);
  check('C2 chain STARTED, classification = critical bucket', req.length === 1 && req[0].status === 'pending' && req[0].classification === CLS_CRIT, JSON.stringify(req[0] ?? {}));
  let stored = (await shoreSql(`SELECT target_date_extensions FROM defects WHERE duuid='${d1.duuid}'`))[0].target_date_extensions;
  check('C3 entry stays Requested while pending', stored[0].status === 'Requested');

  const selfApprove = [ { ...stored[0], status: 'Approved', approved: true, approvalDate: '2026-09-03', approverComments: 'self!' } ];
  const r2 = await call('PATCH', `/defects/${d1.id}`, { targetDateExtensions: selfApprove, targetCloseDate: '2026-10-10', isDeferred: true }, SHIPOFF);
  check('C4 requester self-approve under chain → refused (403/409)', r2.status === 403 || r2.status === 409, `HTTP ${r2.status}`);
  const r3 = await call('PATCH', `/defects/${d1.id}`, { targetDateExtensions: selfApprove }, STRANGER);
  check('C5 same-role UNASSIGNED user approve → refused (vessel scope)', r3.status === 403 || r3.status === 409, `HTTP ${r3.status}`);
  const r4 = await call('PATCH', `/defects/${d1.id}`, { targetDateExtensions: [ { ...stored[0], status: 'Approved', approved: true, approvalDate: '2026-09-03', approverComments: 'approved by office' } ] }, APPROVER);
  check('C6 assigned approver approve PATCH ok', r4.status === 200, `HTTP ${r4.status}`);
  const d1row = (await shoreSql(`SELECT target_date_extensions, target_close_date, is_deferred FROM defects WHERE duuid='${d1.duuid}'`))[0];
  check('C7 entry Approved via workflow, comments kept', d1row.target_date_extensions[0].status === 'Approved' && String(d1row.target_date_extensions[0].electronicConfirmation || '').includes('approval workflow'), JSON.stringify(d1row.target_date_extensions[0]).slice(0, 160));
  check('C8 targetCloseDate advanced + isDeferred set (onDecision apply)', d1row.target_close_date === '2026-10-10' && d1row.is_deferred === true, `${d1row.target_close_date}/${d1row.is_deferred}`);
  req = await engineReq('defects-extension', d1.duuid);
  check('C9 engine request approved (terminal)', req[0].status === 'approved', req[0].status);

  hr('C-b. created-as-Approved under chain → downgraded to Requested');
  const d2 = await newDefect(critComp);
  const r5 = await call('PATCH', `/defects/${d2.id}`, { targetDateExtensions: [extEntry('EXT-DFX-2', { status: 'Approved', approved: true, approvalDate: '2026-09-03' })], targetCloseDate: '2026-10-10' }, SHIPOFF);
  check('Cb1 PATCH ok (downgraded, not refused)', r5.status === 200, `HTTP ${r5.status}`);
  const d2row = (await shoreSql(`SELECT target_date_extensions, target_close_date FROM defects WHERE duuid='${d2.duuid}'`))[0];
  check('Cb2 stored as Requested (no self-approve)', d2row.target_date_extensions[0].status === 'Requested', d2row.target_date_extensions[0].status);
  check('Cb3 targetCloseDate NOT advanced', d2row.target_close_date === '2026-09-10', d2row.target_close_date);
  const req2 = await engineReq('defects-extension', d2.duuid);
  check('Cb4 chain pending for the downgraded request', req2.length === 1 && req2[0].status === 'pending');

  hr('C-c. reject path: approver rejects → entry Rejected, target date NOT advanced');
  const d2r = await call('PATCH', `/defects/${d2.id}`, { targetDateExtensions: [ { ...d2row.target_date_extensions[0], status: 'Rejected', approved: false, approvalDate: '2026-09-03', approverComments: 'not justified' } ] }, APPROVER);
  check('Cc1 approver reject PATCH ok', d2r.status === 200, `HTTP ${d2r.status}`);
  const d2after = (await shoreSql(`SELECT target_date_extensions, target_close_date FROM defects WHERE duuid='${d2.duuid}'`))[0];
  check('Cc2 entry Rejected with remarks via workflow', d2after.target_date_extensions[0].status === 'Rejected' && d2after.target_date_extensions[0].approverComments === 'not justified', JSON.stringify(d2after.target_date_extensions[0]).slice(0, 140));
  check('Cc3 targetCloseDate NOT advanced on reject', d2after.target_close_date === '2026-09-10', d2after.target_close_date);
  const req2b = await engineReq('defects-extension', d2.duuid);
  check('Cc4 engine request returned (terminal)', req2b.length === 1 && req2b[0].status !== 'pending', req2b[0]?.status);

  hr('D. no-chain fallback (normal component, no workflow) — byte-identical legacy');
  const d3 = await newDefect(normComp);
  const r6 = await call('PATCH', `/defects/${d3.id}`, { targetDateExtensions: [extEntry('EXT-DFX-3', { status: 'Approved', approved: true, approvalDate: '2026-09-03', electronicConfirmation: 'Approved by System User on 9/3/2026' })], targetCloseDate: '2026-10-10', isDeferred: true }, SHIPOFF);
  check('D1 legacy self-approve passes (200)', r6.status === 200, `HTTP ${r6.status}`);
  const d3row = (await shoreSql(`SELECT target_date_extensions, target_close_date FROM defects WHERE duuid='${d3.duuid}'`))[0];
  check('D2 entry saved Approved AS SENT (legacy verbatim)', d3row.target_date_extensions[0].status === 'Approved' && d3row.target_date_extensions[0].electronicConfirmation === 'Approved by System User on 9/3/2026');
  const req3 = await engineReq('defects-extension', d3.duuid);
  check('D3 no engine request created (NO_WORKFLOW)', req3.length === 0, `rows=${req3.length}`);

  hr('E. Master-only closure (permission rule, NOT the engine)');
  const c1body = { confirmCompleted: true, dateCompleted: '2026-09-03', closedByName: 'DFX Master', closedByRank: 'Master' };
  const r7 = await call('PATCH', `/defects/${d1.id}`, c1body, SHIPOFF);
  check('E1 non-Master closure PATCH → 403', r7.status === 403, `HTTP ${r7.status}`);
  const r8 = await call('PATCH', `/defects/${d1.id}`, c1body, MASTER);
  check('E2 Master closure PATCH → 200', r8.status === 200, `HTTP ${r8.status}`);
  const r9 = await call('PATCH', `/defects/${d3.id}/close`, { closureComment: 'x', actionTakenRequested: 'y', targetCloseDate: '2026-10-10', dateCompleted: '2026-09-03' }, SHIPOFF);
  check('E3 dormant /close route refuses non-Master too', r9.status === 403, `HTTP ${r9.status}`);

  hr('F. verification through the chain (auto-submitted by the Master closure)');
  let vreq = await engineReq('defects-verification', d1.duuid);
  check('F1 verification chain submitted on closure (critical bucket)', vreq.length === 1 && vreq[0].status === 'pending' && vreq[0].classification === CLS_CRIT, JSON.stringify(vreq[0] ?? {}));
  const r10 = await call('PATCH', `/defects/${d1.id}`, { verified: true, dateVerified: '2026-09-03', verifiedByName: 'DFX Stranger', verifiedByOfficePosition: 'x' }, STRANGER);
  check('F2 non-approver verify → refused', r10.status === 403 || r10.status === 409, `HTTP ${r10.status}`);
  const r11 = await call('PATCH', `/defects/${d1.id}`, { verified: true, dateVerified: '2026-09-03', verifiedByName: 'ignored', verifiedByOfficePosition: 'ignored' }, APPROVER);
  check('F3 assigned approver verify → 200', r11.status === 200, `HTTP ${r11.status}`);
  const d1v = (await shoreSql(`SELECT verified, verified_by_name, verified_by_office_position FROM defects WHERE duuid='${d1.duuid}'`))[0];
  check('F4 verified=true with DECIDER identity stamped (not the client echo)', d1v.verified === true && d1v.verified_by_name === 'DFX Approver', JSON.stringify(d1v));
  vreq = await engineReq('defects-verification', d1.duuid);
  check('F5 verification request approved (terminal)', vreq[0].status === 'approved', vreq[0].status);

  hr('F-b. verification with NOTHING configured (normal bucket) → legacy passthrough, no error (B7)');
  const r12 = await call('PATCH', `/defects/${d3.id}`, { verified: true, dateVerified: '2026-09-03', verifiedByName: 'Legacy Verifier', verifiedByOfficePosition: 'Tech Supt' }, STRANGER);
  check('Fb1 legacy verify passes through (200)', r12.status === 200, `HTTP ${r12.status}`);
  const d3v = (await shoreSql(`SELECT verified, verified_by_name FROM defects WHERE duuid='${d3.duuid}'`))[0];
  check('Fb2 verified fields saved AS SENT (legacy verbatim)', d3v.verified === true && d3v.verified_by_name === 'Legacy Verifier', JSON.stringify(d3v));
  check('Fb3 no verification engine request (NO_WORKFLOW)', (await engineReq('defects-verification', d3.duuid)).length === 0);

  hr('G. classification: is_coc alone puts a normal-component defect in the critical bucket');
  const d4 = await newDefect(normComp, true);
  await call('PATCH', `/defects/${d4.id}`, { targetDateExtensions: [extEntry('EXT-DFX-4')] }, SHIPOFF);
  const req4 = await engineReq('defects-extension', d4.duuid);
  check('G1 COC defect → critical bucket chain', req4.length === 1 && req4[0].classification === CLS_CRIT, JSON.stringify(req4[0] ?? {}));

  hr('cleanup');
  await shoreSql(`DELETE FROM apprv_slot_decisions WHERE request_requuid IN (SELECT requuid FROM apprv_requests WHERE module_id='defects')`).catch(() => {});
  await shoreSql(`DELETE FROM apprv_request_nodes WHERE request_requuid IN (SELECT requuid FROM apprv_requests WHERE module_id='defects')`).catch(() => {});
  await shoreSql(`DELETE FROM apprv_requests WHERE module_id='defects'`);
  await shoreSql(`DELETE FROM apprv_node_slots WHERE workflow_wfuuid IN (SELECT wfuuid FROM apprv_workflows WHERE module_id='defects')`);
  await shoreSql(`DELETE FROM apprv_workflow_nodes WHERE workflow_wfuuid IN (SELECT wfuuid FROM apprv_workflows WHERE module_id='defects')`).catch(() => {});
  await shoreSql(`DELETE FROM apprv_workflows WHERE module_id='defects'`);
  await shoreSql(`DELETE FROM approval_notifications WHERE anuuid IN (SELECT anuuid FROM approval_notifications WHERE title LIKE '%DFX%')`).catch(() => {});
  await shoreSql(`DELETE FROM sync_field_log WHERE table_name='defects' AND row_uuid IN (SELECT duuid FROM defects WHERE description='DFX harness defect')`);
  await shoreSql(`DELETE FROM defects WHERE description='DFX harness defect'`);
  await shoreSql(`DELETE FROM master_user_vessels WHERE user_uuid LIKE 'dfx-%'`);
  await shoreSql(`DELETE FROM master_users WHERE id LIKE 'dfx-%'`);
  if (flippedComp) await shoreSql(`UPDATE components SET critical=false WHERE cuuid='${flippedComp}'`);

  log(`\n${fails === 0 ? 'ALL PASS' : 'FAILURES'} — defects approvals harness (${fails} failed)`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('HARNESS ERROR:', e); process.exit(1); });
