/**
 * Regression harness — shared approval diagnostics + "Apply again" (28-Sep-2026, Sahil C3/C4/C5).
 * Throwaway shore (default :5077, DB pms_ae_test). Refuses a DB not ending in _test. Cleans up.
 *   D1 blocked actions  — an action with no chain is listed
 *   D2 roles nobody holds / D3 stalled — a chain whose role nobody holds: role gap + stalled request
 *   D4 failed update     — CR approved by the engine, then its record forced back to 'submitted'
 *                          (simulated onDecision failure, finished > 2 min ago) → listed with its request
 *   D5 Apply again       — view-only role refused (403); Sail Admin → 200, CR approved, row gone
 *   npx tsx scripts/test-approval-diagnostics.ts
 */
import { Pool } from 'pg';

const BASE = process.env.AE_TEST_BASE || 'http://localhost:5077/technical/api';
const DB = process.env.AE_TEST_DB || 'pms_ae_test';
if (!DB.endsWith('_test')) { console.error(`refusing: database '${DB}' is not a *_test database`); process.exit(2); }
const pool = new Pool({ connectionString: `postgres://postgres:admin123@localhost:5432/${DB}` });
const sql = async (q: string, p: any[] = []) => (await pool.query(q, p)).rows;

const V = '743ef9d1-841a-11ed-aa7c-7003bca91a86';
const ADMIN_RUID = '28893a97-e475-4e19-afc5-d17f1b9adbb6';      // Admin (OLDBUILD-MATCHED)
const NOBODY_RUID = 'c66b5ff4-85ca-48d7-930b-75e205b8160f';     // Super Admin — no user holds it in the pilot copy
const TAG = 'DIAG';
const APPROVER = { id: 'diag-appr', name: 'DIAG Approver', role: 'Admin (OLDBUILD-MATCHED)', type: 'Office', rank: 'Technical Superintendent' };
const ADMIN = { id: 'diag-admin', name: 'DIAG Admin', role: 'Sail Admin', type: 'Office', rank: 'Technical Superintendent' };
const VIEWER = { id: 'diag-viewer', name: 'DIAG Viewer', role: 'Vessel Admin', type: 'Ship', rank: 'Chief Engineer' };
const SHIPUSER = { id: 'diag-ship', name: 'DIAG Ship', role: 'Vessel User', type: 'Ship', rank: 'Third Engineer' };
const scope = (screenId: string) => ({ moduleId: 'technical', screenId, actionId: '' });

async function call(method: string, path: string, body: any, who: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-user-id': who.id, 'x-user-name': encodeURIComponent(who.name),
    'x-user-role': encodeURIComponent(who.role), 'x-user-type': who.type, 'x-rank': who.rank };
  const r = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* not json */ }
  console.log(`   → ${method} ${path} as ${who.role} ← ${r.status} ${text.slice(0, 120).replace(/\s+/g, ' ')}`);
  return { status: r.status, json };
}
let fails = 0; let passes = 0;
const check = (l: string, ok: boolean, d = '') => { console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${l}${d && !ok ? '  — ' + d : ''}`); ok ? passes++ : fails++; };
const hr = (t: string) => console.log(`\n── ${t}`);
const chain = (screenId: string, classification: string, roleId: string, roleLabel: string) => ({
  scope: scope(screenId), classification, mode: 'simple', label: `${TAG} chain`,
  nodes: [
    { key: 'step-1', type: 'approval-step', label: 'Step', ordinal: 0, quorum: { rule: 'any' }, slots: [{ roleId, roleLabel }] },
    { key: 'end', type: 'end', label: 'End', ordinal: 1 },
  ], edges: [{ from: 'step-1', to: 'end' }],
});
const group = (d: any, key: string) => (d?.groups ?? []).find((g: any) => g.key === key);
const crIds: number[] = [];

async function cleanup() {
  const crs = crIds.length ? await sql(`SELECT cruuid FROM change_request WHERE id = ANY($1)`, [crIds]) : [];
  const refs = crs.map((r: any) => r.cruuid);
  if (refs.length) {
    await sql(`DELETE FROM approval_notifications WHERE subject_ref = ANY($1)`, [refs]);
    await sql(`DELETE FROM apprv_request_slots WHERE requuid IN (SELECT requuid FROM apprv_requests WHERE subject_ref = ANY($1))`, [refs]);
    await sql(`DELETE FROM apprv_requests WHERE subject_ref = ANY($1)`, [refs]);
    await sql(`DELETE FROM sync_field_log WHERE row_uuid = ANY($1)`, [refs]);
    await sql(`DELETE FROM change_request WHERE id = ANY($1)`, [crIds]);
  }
  await sql(`DELETE FROM apprv_workflows WHERE label = $1`, [`${TAG} chain`]);
  await sql(`DELETE FROM master_user_vessels WHERE user_uuid LIKE 'diag-%'`);
  await sql(`DELETE FROM master_users WHERE id LIKE 'diag-%'`);
}

(async () => {
  hr('0. set-up');
  await sql(`DELETE FROM apprv_workflows WHERE module_id='technical' AND screen_id IN ('pms-spares-cr','pms-stores-cr')`);
  for (const u of [APPROVER, ADMIN, VIEWER, SHIPUSER]) {
    await sql(`INSERT INTO master_users (id, full_name, role, user_type, is_deleted) VALUES ($1,$2,$3,$4,false)
      ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role, is_deleted=false`, [u.id, u.name, u.role, u.type]);
  }
  await sql(`INSERT INTO master_user_vessels (user_uuid, vessel_id, is_active, map_status) VALUES ($1,$2,true,'unmapped')
    ON CONFLICT (user_uuid, vessel_id) DO UPDATE SET is_active=true`, [APPROVER.id, V]);
  check('chain saved: spares / Normal Spares (approver role)', (await call('POST', '/approval-engine/workflows', chain('pms-spares-cr', 'Normal Spares', ADMIN_RUID, 'Admin (OLDBUILD-MATCHED)'), ADMIN)).status === 201);
  check('chain saved: stores / Store Items (role nobody holds)', (await call('POST', '/approval-engine/workflows', chain('pms-stores-cr', 'Store Items', NOBODY_RUID, 'Super Admin'), ADMIN)).status === 201);

  hr('D1 blocked actions');
  let d = (await call('GET', '/approvals/diagnostics', undefined, ADMIN)).json;
  const blocked = group(d, 'blockedActions');
  check('components CR (no chain) is listed as blocked', !!blocked?.rows?.some((r: any) => /Component Change Requests/.test(r.text)));
  check('spares Normal Spares (has a chain) is NOT listed', !blocked?.rows?.some((r: any) => /Spare Change Requests — Normal Spares/.test(r.text)));

  hr('D2/D3 role nobody holds + stalled request');
  const store = (await sql(`SELECT id FROM stores_items WHERE vessel_id=$1 LIMIT 1`, [V]))[0];
  const st = await call('POST', '/change-requests', { vesselId: V, category: 'stores', title: `${TAG} stalled`, reason: TAG, targetType: 'store', targetId: String(store.id),
    proposedChangesJson: [{ id: 1, field: 'remarks', oldValue: '', newValue: TAG }], status: 'submitted', requestedByUserId: SHIPUSER.id }, SHIPUSER);
  if (st.json?.id) crIds.push(Number(st.json.id));
  d = (await call('GET', '/approvals/diagnostics', undefined, ADMIN)).json;
  check('role nobody holds is listed (Super Admin, stores chain)', !!group(d, 'rolesWithoutApprover')?.rows?.some((r: any) => /Super Admin/.test(r.text) && /Store Change Requests/.test(r.detail ?? '')));
  check('the stores request is listed as stalled', !!group(d, 'stalled')?.rows?.some((r: any) => /DIAG stalled/.test(r.text)));

  hr('D4 failed update (simulated)');
  const spare = (await sql(`SELECT suuid, remarks FROM spares WHERE vessel_id=$1 AND is_deleted=false AND (critical IS NULL OR critical NOT IN ('Critical','Yes')) ORDER BY suuid LIMIT 1`, [V]))[0];
  const cr = await call('POST', '/change-requests', { vesselId: V, category: 'spares', title: `${TAG} failed update`, reason: TAG, targetType: 'spare', targetId: spare.suuid,
    proposedChangesJson: [{ id: 1, field: 'remarks', oldValue: spare.remarks, newValue: 'DIAG-APPLIED' }], status: 'submitted', requestedByUserId: SHIPUSER.id }, SHIPUSER);
  crIds.push(Number(cr.json.id));
  check('approver approves → CR approved', (await call('PUT', `/change-requests/${cr.json.id}/approve`, { comment: 'ok' }, APPROVER)).status < 300
    && (await sql(`SELECT status FROM change_request WHERE id=$1`, [cr.json.id]))[0].status === 'approved');
  const reqRow = (await sql(`SELECT requuid FROM apprv_requests WHERE subject_ref=$1`, [cr.json.cruuid]))[0];
  await sql(`UPDATE change_request SET status='submitted' WHERE id=$1`, [cr.json.id]);
  await sql(`UPDATE apprv_requests SET finalized_at = now() - interval '10 minutes' WHERE requuid=$1`, [reqRow.requuid]);
  d = (await call('GET', '/approvals/diagnostics', undefined, ADMIN)).json;
  const failedRow = group(d, 'failedUpdates')?.rows?.find((r: any) => r.requuid === reqRow.requuid);
  check('failed update listed with its request id', !!failedRow, JSON.stringify(group(d, 'failedUpdates') ?? {}).slice(0, 200));

  hr('D5 Apply again');
  check('view-only role (Vessel Admin) → 403', (await call('POST', `/approvals/diagnostics/${reqRow.requuid}/reapply`, undefined, VIEWER)).status === 403);
  const ok = await call('POST', `/approvals/diagnostics/${reqRow.requuid}/reapply`, undefined, ADMIN);
  check('Sail Admin → 200 and the CR is approved again', ok.status === 200 && (await sql(`SELECT status FROM change_request WHERE id=$1`, [cr.json.id]))[0].status === 'approved');
  d = (await call('GET', '/approvals/diagnostics', undefined, ADMIN)).json;
  check('the failed update is gone', !group(d, 'failedUpdates')?.rows?.some((r: any) => r.requuid === reqRow.requuid));
  check('Apply again on a still-waiting request → 409', (await call('POST', `/approvals/diagnostics/${(await sql(`SELECT requuid FROM apprv_requests WHERE subject_ref=$1`, [st.json.cruuid]))[0].requuid}/reapply`, undefined, ADMIN)).status === 409);
  await sql(`UPDATE spares SET remarks=$1 WHERE suuid=$2`, [spare.remarks, spare.suuid]);

  hr('cleanup');
  await cleanup();
  console.log(`\nRESULT: ${passes} passed, ${fails} failed`);
  await pool.end();
  process.exit(fails ? 1 : 0);
})().catch(async (e) => { console.error('HARNESS ERROR:', e); try { await cleanup(); } catch { /* best effort */ } await pool.end(); process.exit(1); });
