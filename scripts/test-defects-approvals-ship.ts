/**
 * Regression harness — DEFECTS approval workflow (Sahil, 13–17 Sep 2026) on a real SHORE + SHIP pair.
 * Sahil's handover says browser e2e could not run and nothing was tested across sync; this does.
 *   shore AE_TEST_BASE (default :5077, DB pms_ae_test) · ship AE_TEST_SHIP_BASE (default :5177, container pms-ship-ae)
 *
 *   R  routing: CoC → 'Critical Equipment / COC Related'; extension > 90 days → critical; plain → 'Normal'
 *   N  no chains: ship extension request stays Requested and waits on shore (no request); on shore a
 *      new extension (Requested or self-Approved) or a decision on the waiting one is BLOCKED (25-Sep);
 *      shore verification of a ship-closed defect is BLOCKED (VERIFICATION_WORKFLOW_UNAVAILABLE)
 *   X  chains set → sync → sweep starts extension + verification chains
 *      ship cannot decide (403 decided ashore); shore Master closeout blocked while extension pending
 *      approver approves extension → Approved + target date advanced + isDeferred → reaches ship
 *   RP repeat extension → defects-repeat-extension scope; reject → Rejected, date unchanged → ship
 *   V  approver verifies → verified with the DECIDER's identity → reaches ship
 *   RJ verification rejected → transactional reopen: status Open, C1 cleared, one immutable
 *      closure-history row (UPDATE refused by trigger) → reopened state reaches ship
 * Refuses a shore DB not ending in _test; cleans up shore rows it creates.
 *   npx tsx scripts/test-defects-approvals-ship.ts
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
const TAG = 'DFS';
const NORMAL = 'Normal';
const CRIT = 'Critical Equipment / COC Related';
const APPROVER = { id: 'dfs-appr', name: 'DFS Approver', role: 'Admin (OLDBUILD-MATCHED)', type: 'Office', rank: 'Technical Superintendent' };
const ADMIN = { id: 'dfs-admin', name: 'DFS Admin', role: 'Sail Admin', type: 'Office', rank: 'Technical Superintendent' };
const OFFICER = { id: 'dfs-2e', name: 'DFS 2nd Eng', role: 'Vessel User', type: 'Ship', rank: 'Second Engineer' };
const MASTER = { id: 'dfs-master', name: 'DFS Master', role: 'Vessel Admin', type: 'Ship', rank: 'Master' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(base: string, method: string, path: string, body: any, who: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json',
    'x-user-id': who.id, 'x-user-name': encodeURIComponent(who.name), 'x-user-role': encodeURIComponent(who.role), 'x-user-type': who.type, 'x-rank': who.rank };
  const r = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* not json */ }
  console.log(`   → ${base === SHIP ? 'SHIP ' : 'SHORE'} ${method} ${path} as ${who.rank} ← ${r.status} ${text.slice(0, 140).replace(/\s+/g, ' ')}`);
  return { status: r.status, json, text };
}
let fails = 0; let passes = 0;
const check = (label: string, ok: boolean, detail = '') => { console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${label}${detail && !ok ? '  — ' + detail : ''}`); ok ? passes++ : fails++; };
const hr = (t: string) => console.log(`\n── ${t}`);
const chain = (screenId: string, classification: string) => ({
  scope: { moduleId: 'defects', screenId, actionId: '' }, classification, mode: 'simple', label: `${TAG} chain`,
  nodes: [
    { key: 'step-1', type: 'approval-step', label: 'Office review', ordinal: 0, quorum: { rule: 'any' }, slots: [{ roleId: ADMIN_RUID, roleLabel: 'Admin (OLDBUILD-MATCHED)' }] },
    { key: 'end', type: 'end', label: 'End', ordinal: 1 },
  ],
  edges: [{ from: 'step-1', to: 'end' }],
});
const engineReqs = (ref: string) =>
  shoreSql(`SELECT requuid, screen_id, classification, status FROM apprv_requests WHERE module_id='defects' AND subject_ref=$1 ORDER BY submitted_at DESC`, [ref]);
const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const extEntry = (id: string, existing: string, next: string) => ({
  id, existingTargetDate: existing, newTargetDate: next, reasonForExtension: `${TAG} reason`,
  submitForApprovalTo: '', submitForApprovalToName: '', status: 'Requested', approvalDate: '', approverComments: '', requestedAt: new Date().toISOString(),
});
const shipDefect = (duuid: string, col: string) => shipSql(`SELECT ${col} FROM defects WHERE duuid='${duuid}'`);

async function sync(label: string) {
  const r = await call(SHIP, 'POST', '/sync/trigger', { vesselId: V }, ADMIN);
  const j = r.json || {};
  console.log(`   sync(${label}): ok=${j.success} pushed=${j.recordsPushed} pulled=${j.recordsPulled} remainPush=${j.remainingPush} remainPull=${j.remainingPull}`);
  await sleep(5000);
  return j;
}
const duuids: string[] = [];
async function newShipDefect(label: string, target: string, extra: any = {}) {
  const r = await call(SHIP, 'POST', '/defects', { vesselId: V, vesselName: 'WK Frontier Pilot', description: `${TAG} ${label}`, category: 'Defect',
    issueDate: iso(-5), reportedBy: TAG, status: 'Open', targetCloseDate: target, equipmentCategory: TAG, is_coc: false, critical: false, ...extra }, OFFICER);
  if (r.status >= 300) throw new Error(`ship defect create failed ${r.status}: ${r.text}`);
  duuids.push(r.json.duuid);
  return { id: r.json.id as string, duuid: r.json.duuid as string };
}
async function cleanup() {
  if (duuids.length) {
    await shoreSql(`DELETE FROM apprv_request_slots WHERE requuid IN (SELECT requuid FROM apprv_requests WHERE subject_ref = ANY($1))`, [duuids]);
    await shoreSql(`DELETE FROM apprv_requests WHERE subject_ref = ANY($1)`, [duuids]);
  }
  await shoreSql(`DELETE FROM apprv_workflows WHERE label=$1`, [`${TAG} chain`]);
  await shoreSql(`DELETE FROM master_user_vessels WHERE user_uuid LIKE 'dfs-%'`);
  await shoreSql(`DELETE FROM master_users WHERE id LIKE 'dfs-%'`);
  // defects + immutable closure history stay in the throwaway DB (history cannot be deleted by design)
}

(async () => {
  hr('0. set-up — users, NO defects chains');
  await shoreSql(`DELETE FROM apprv_workflows WHERE module_id='defects'`);
  for (const u of [APPROVER, ADMIN, OFFICER, MASTER]) {
    await shoreSql(`INSERT INTO master_users (id, full_name, role, user_type, is_deleted) VALUES ($1,$2,$3,$4,false)
      ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role, full_name=EXCLUDED.full_name, is_deleted=false`, [u.id, u.name, u.role, u.type]);
  }
  await shoreSql(`INSERT INTO master_user_vessels (user_uuid, vessel_id, is_active, map_status) VALUES ($1,$2,true,'unmapped')
    ON CONFLICT (user_uuid, vessel_id) DO UPDATE SET is_active=true`, [APPROVER.id, V]);
  check('baseline sync', (await sync('baseline')).success === true);

  const T0 = iso(20);
  const d1 = await newShipDefect('extension', T0);
  const d2 = await newShipDefect('verify', T0);
  const d3 = await newShipDefect('reject-verify', T0);
  const dCoc = await newShipDefect('coc', T0, { is_coc: true });
  check('sync ship defects to shore', (await sync('defects')).success === true);
  const shoreId = async (duuid: string) => (await shoreSql(`SELECT id FROM defects WHERE duuid=$1`, [duuid]))[0]?.id as string;
  const s1 = await shoreId(d1.duuid); const s2 = await shoreId(d2.duuid); const s3 = await shoreId(d3.duuid); const sCoc = await shoreId(dCoc.duuid);
  check('all 4 ship defects arrived on shore', !!s1 && !!s2 && !!s3 && !!sCoc);

  hr('R. classification / routing (read-only endpoint)');
  const rPlain = await call(SHORE, 'GET', `/defects/${s1}/approval-routing?action=extension&newTargetDate=${iso(40)}`, undefined, APPROVER);
  check('plain defect, 20-day extension → Normal', rPlain.status === 200 && JSON.stringify(rPlain.json).includes(`"classification":"${NORMAL}"`), rPlain.text.slice(0, 200));
  const rLong = await call(SHORE, 'GET', `/defects/${s1}/approval-routing?action=extension&newTargetDate=${iso(20 + 91)}`, undefined, APPROVER);
  check('extension of 91 days beyond the current target → critical', rLong.status === 200 && JSON.stringify(rLong.json).includes(`"classification":"${CRIT}"`), rLong.text.slice(0, 200));
  const rCoc = await call(SHORE, 'GET', `/defects/${sCoc}/approval-routing?action=extension&newTargetDate=${iso(30)}`, undefined, APPROVER);
  check('CoC defect → critical', rCoc.status === 200 && JSON.stringify(rCoc.json).includes(`"classification":"${CRIT}"`), rCoc.text.slice(0, 200));

  hr('N. no chains configured');
  const e1 = await call(SHIP, 'PATCH', `/defects/${d1.id}`, { targetDateExtensions: [extEntry(`EXT-${TAG}-1`, T0, iso(40))] }, OFFICER);
  check('SHIP extension request saved as Requested', e1.status < 300 && shipDefect(d1.duuid, "target_date_extensions->0->>'status'") === 'Requested');
  const c1 = { confirmCompleted: true, dateCompleted: iso(-1), closedByName: 'DFS Master', closedByRank: 'Master' };
  check('SHIP: non-Master closeout → 403', (await call(SHIP, 'PATCH', `/defects/${d2.id}`, c1, OFFICER)).status === 403);
  check('SHIP: Master closes d2 and d3', (await call(SHIP, 'PATCH', `/defects/${d2.id}`, c1, MASTER)).status < 300 && (await call(SHIP, 'PATCH', `/defects/${d3.id}`, c1, MASTER)).status < 300);
  await sync('N');
  check('shore: d1 extension arrived Requested, no engine request (no chain)',
    (await shoreSql(`SELECT target_date_extensions->0->>'status' s FROM defects WHERE duuid=$1`, [d1.duuid]))[0].s === 'Requested' && (await engineReqs(d1.duuid)).length === 0);
  // 25-Sep-2026 (Ghazi): no chain → a Defects extension is BLOCKED on shore (no more self-approve)
  const orphan = (await shoreSql(`SELECT target_date_extensions t FROM defects WHERE duuid=$1`, [d1.duuid]))[0].t[0];
  const selfOk = await call(SHORE, 'PATCH', `/defects/${s1}`, { targetDateExtensions: [{ ...orphan, status: 'Approved', approved: true, approvalDate: iso(0) }] }, APPROVER);
  check('shore: approving the waiting ship request with no chain → 409 "not set up"', selfOk.status === 409
    && /No approval workflow is set up for "Defect Target Date Extension" \(Normal\)/.test(selfOk.json?.error ?? ''));
  const newShore = await call(SHORE, 'PATCH', `/defects/${sCoc}`, { targetDateExtensions: [extEntry(`EXT-${TAG}-S`, T0, iso(30))] }, OFFICER);
  check('shore: new extension request with no chain → 409 (CoC → critical bucket named)', newShore.status === 409
    && /No approval workflow is set up for "Defect Target Date Extension" \(Critical Equipment \/ COC Related\)/.test(newShore.json?.error ?? ''));
  const newSelf = await call(SHORE, 'PATCH', `/defects/${sCoc}`, { targetDateExtensions: [{ ...extEntry(`EXT-${TAG}-T`, T0, iso(30)), status: 'Approved', approved: true, approvalDate: iso(0) }], targetCloseDate: iso(30) }, OFFICER);
  const cocRow = (await shoreSql(`SELECT target_date_extensions t, target_close_date FROM defects WHERE duuid=$1`, [dCoc.duuid]))[0];
  check('shore: new self-Approved extension with no chain → 409, nothing saved', newSelf.status === 409
    && (!cocRow.t || cocRow.t.length === 0) && String(cocRow.target_close_date).slice(0, 10) === T0);
  const vNo = await call(SHORE, 'PATCH', `/defects/${s2}`, { verified: true, dateVerified: iso(0), verifiedByName: 'x', verifiedByOfficePosition: 'x' }, APPROVER);
  check('shore: verify with no chain → 409 VERIFICATION_WORKFLOW_UNAVAILABLE', vNo.status === 409 && /Verification approval workflow is unavailable/.test(vNo.json?.error ?? ''));

  hr('X. chains set → next sync starts them');
  for (const sc of ['defects-extension', 'defects-repeat-extension', 'defects-verification']) {
    const w = await call(SHORE, 'POST', '/approval-engine/workflows', chain(sc, NORMAL), ADMIN);
    check(`chain saved: ${sc} / Normal`, w.status === 201);
  }
  await sync('X');
  let r1 = await engineReqs(d1.duuid);
  check('sweep started the extension chain (defects-extension, Normal)', r1[0]?.screen_id === 'defects-extension' && r1[0]?.classification === NORMAL && r1[0]?.status === 'pending', JSON.stringify(r1));
  check('sweep started verification chains for d2 and d3', (await engineReqs(d2.duuid))[0]?.status === 'pending' && (await engineReqs(d3.duuid))[0]?.status === 'pending');
  const shipEntry = JSON.parse(shipDefect(d1.duuid, 'target_date_extensions'))[0];
  check('SHIP cannot decide the extension → 403 decided ashore',
    (await call(SHIP, 'PATCH', `/defects/${d1.id}`, { targetDateExtensions: [{ ...shipEntry, status: 'Approved', approved: true, approvalDate: iso(0) }] }, MASTER)).status === 403);
  const shoreClose = await call(SHORE, 'PATCH', `/defects/${s1}`, c1, MASTER);
  check('shore: Master closeout while the extension is pending → 409', shoreClose.status === 409 && /pending extension approval/.test(shoreClose.json?.error ?? ''));
  const shoreEntry = (await shoreSql(`SELECT target_date_extensions t FROM defects WHERE duuid=$1`, [d1.duuid]))[0].t[0];
  const ap = await call(SHORE, 'PATCH', `/defects/${s1}`, { targetDateExtensions: [{ ...shoreEntry, status: 'Approved', approved: true, approvalDate: iso(0), approverComments: 'ok' }] }, APPROVER);
  const row1 = (await shoreSql(`SELECT target_date_extensions t, target_close_date, is_deferred FROM defects WHERE duuid=$1`, [d1.duuid]))[0];
  check('shore: approver approves → entry Approved, target date advanced, isDeferred', ap.status < 300 && row1.t[0].status === 'Approved'
    && String(row1.target_close_date).slice(0, 10) === iso(40) && row1.is_deferred === true, JSON.stringify(row1).slice(0, 200));
  await sync('X2');
  check('SHIP: extension Approved + new target date + isDeferred', shipDefect(d1.duuid, "target_date_extensions->0->>'status'") === 'Approved'
    && shipDefect(d1.duuid, 'target_close_date').startsWith(iso(40)) && shipDefect(d1.duuid, 'is_deferred') === 't');

  hr('RP. repeat extension');
  const cur = JSON.parse(shipDefect(d1.duuid, 'target_date_extensions'));
  const e2 = await call(SHIP, 'PATCH', `/defects/${d1.id}`, { targetDateExtensions: [...cur, extEntry(`EXT-${TAG}-2`, iso(40), iso(60))] }, OFFICER);
  check('SHIP second extension request saved', e2.status < 300);
  await sync('RP');
  r1 = await engineReqs(d1.duuid);
  check('sweep started the REPEAT scope (defects-repeat-extension)', r1[0]?.screen_id === 'defects-repeat-extension' && r1[0]?.status === 'pending', JSON.stringify(r1[0] ?? {}));
  const ents = (await shoreSql(`SELECT target_date_extensions t FROM defects WHERE duuid=$1`, [d1.duuid]))[0].t;
  const rej = await call(SHORE, 'PATCH', `/defects/${s1}`, { targetDateExtensions: [ents[0], { ...ents[1], status: 'Rejected', approved: false, approvalDate: iso(0), approverComments: 'not justified' }] }, APPROVER);
  const row1b = (await shoreSql(`SELECT target_date_extensions t, target_close_date FROM defects WHERE duuid=$1`, [d1.duuid]))[0];
  check('shore: reject → second entry Rejected with reason, date stays', rej.status < 300 && row1b.t[1].status === 'Rejected'
    && row1b.t[1].approverComments === 'not justified' && String(row1b.target_close_date).slice(0, 10) === iso(40), JSON.stringify(row1b.t[1] ?? {}).slice(0, 200));
  await sync('RP2');
  check('SHIP: second extension Rejected, date unchanged', shipDefect(d1.duuid, "target_date_extensions->1->>'status'") === 'Rejected' && shipDefect(d1.duuid, 'target_close_date').startsWith(iso(40)));

  hr('V. verification approved');
  const vOk = await call(SHORE, 'PATCH', `/defects/${s2}`, { verified: true, dateVerified: iso(0), verifiedByName: 'client echo', verifiedByOfficePosition: 'x' }, APPROVER);
  const row2 = (await shoreSql(`SELECT verified, verified_by_name FROM defects WHERE duuid=$1`, [d2.duuid]))[0];
  check('shore: verified with the DECIDER identity', vOk.status < 300 && row2.verified === true && row2.verified_by_name === APPROVER.name, JSON.stringify(row2));
  await sync('V');
  check('SHIP: d2 verified', shipDefect(d2.duuid, 'verified') === 't');

  hr('RJ. verification rejected → reopen + immutable closure history');
  const req3 = (await engineReqs(d3.duuid))[0];
  const dec = await call(SHORE, 'POST', `/approval-engine/requests/${req3.requuid}/decide`, { decision: 'reject', remarks: 'closure evidence missing' }, APPROVER);
  const row3 = (await shoreSql(`SELECT status, confirm_completed, closed_by_name, verified FROM defects WHERE duuid=$1`, [d3.duuid]))[0];
  check('shore: rejection reopens the defect (Open, C1 cleared, not verified)', dec.status < 300 && row3.status === 'Open' && row3.confirm_completed !== true && !row3.closed_by_name && row3.verified !== true, JSON.stringify(row3));
  const hist = await shoreSql(`SELECT id, attempt_number, rejection_reason FROM defect_closure_history WHERE defect_duuid=$1`, [d3.duuid]);
  check('shore: one closure-history row with the reason', hist.length === 1 && hist[0].attempt_number === 1 && hist[0].rejection_reason === 'closure evidence missing', JSON.stringify(hist));
  const upd = await pool.query(`UPDATE defect_closure_history SET rejection_reason='tamper' WHERE defect_duuid=$1`, [d3.duuid]).then(() => 'allowed', (e) => 'refused: ' + e.message);
  check('closure history is immutable (UPDATE refused by trigger)', upd.startsWith('refused'), upd);
  const hc = await call(SHORE, 'GET', `/defects/${s3}/closure-history`, undefined, APPROVER);
  check('closure-history endpoint returns the attempt', hc.status === 200 && JSON.stringify(hc.json).includes('closure evidence missing'));
  await sync('RJ');
  check('SHIP: d3 reopened (Open, not completed)', shipDefect(d3.duuid, 'status') === 'Open' && shipDefect(d3.duuid, 'confirm_completed') !== 't');
  const shipHist = shipSql(`SELECT count(*) FROM defect_closure_history WHERE defect_duuid='${d3.duuid}'`);
  console.log(`   INFO  ship closure-history rows = ${shipHist} (no sync registry entry yet — plan item B4, Sahil: shore → ship)`);

  hr('cleanup (shore approval rows, users, chains)');
  await cleanup();
  console.log(`\nRESULT: ${passes} passed, ${fails} failed`);
  await pool.end();
  process.exit(fails ? 1 : 0);
})().catch(async (e) => { console.error('HARNESS ERROR:', e); try { await cleanup(); } catch { /* best effort */ } await pool.end(); process.exit(1); });
