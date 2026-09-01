/**
 * VESSEL-SCOPE harness (Task 2). Proves, against the authoritative server resolver:
 *   1. in-scope approver can act (office user assigned to the vessel → in resolved set);
 *   2. out-of-scope SAME-ROLE user gets read-only (excluded from resolved set → no button;
 *      the request/chain still exists so the panel renders);
 *   3. a step that resolves to ZERO approvers is flagged with the new F3 message;
 *   4. APPROVAL_VESSEL_SCOPE_STRICT off restores current behaviour (office = fleet-wide).
 *
 * Isolated: its own role + two users, so it never depends on other seeded fixtures.
 * The flag is read from process.env at call time, so both states are exercised in-process.
 *
 * Run: shore up on :5000. `npx tsx scripts/test-vessel-scope.ts`
 */
import { Pool } from 'pg';
import * as fs from 'fs';

const DB = 'postgres://postgres:admin123@localhost:5432/pms_arch';
const V = '743ef9d1-841a-11ed-aa7c-7003bca91a86';   // WK Frontier Pilot — vs-in assigned here
const V2 = '743feb08-841a-11ed-aa7c-7003bca91a86';  // Vessel 2 — nobody assigned (zero-resolve)
const RUID = 'vs-test-office-ruid';
const ROLE = 'VS-TEST-OFFICE';
process.env.DATABASE_URL = DB;

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); ok ? pass++ : fail++; };

// Faithful replica of the client vessel gate (post-Task-2).
function clientButton(assignedVesselIds: string[], crVesselId: string, isSailAdmin: boolean, vesselScopeStrict: boolean, isApproverForStep: boolean) {
  const crVesselIsAssigned = isSailAdmin || (!vesselScopeStrict && assignedVesselIds.length === 0) || assignedVesselIds.includes(crVesselId);
  return crVesselIsAssigned && isApproverForStep;
}

(async () => {
  const p = new Pool({ connectionString: DB });
  const sql = (q: string, params: any[] = []) => p.query(q, params);

  // ── seed: isolated office role + two office users; vs-in assigned to V only ──
  await sql(`DELETE FROM change_request WHERE cruuid LIKE 'vs-scope-%'`);
  await sql(`DELETE FROM master_user_vessels WHERE user_uuid IN ('vs-in','vs-out')`);
  await sql(`DELETE FROM master_users WHERE id IN ('vs-in','vs-out')`);
  await sql(`DELETE FROM admn_role_master WHERE ruid=$1`, [RUID]);
  await sql(`INSERT INTO admn_role_master (id, ruid, assigned_role, roletype, is_deleted) VALUES ((SELECT COALESCE(MAX(id),0)+1 FROM admn_role_master),$1,$2,'Office',false)`, [RUID, ROLE]);
  for (const id of ['vs-in', 'vs-out']) {
    await sql(`INSERT INTO master_users (id, full_name, role, user_type, is_deleted) VALUES ($1,$1,$2,'Office',false)`, [id, ROLE]);
  }
  await sql(`INSERT INTO master_user_vessels (user_uuid, vessel_id, is_active, map_status) VALUES ('vs-in',$1,true,'unmapped') ON CONFLICT (user_uuid, vessel_id) DO UPDATE SET is_active=true`, [V]);
  const crIn = (await sql(`INSERT INTO change_request (vessel_id,category,title,reason,target_type,target_id,status,requested_by_user_id,submitted_at,cruuid,is_deleted) VALUES ($1,'spares','vs in','t','spare','s1','submitted','req',now(),'vs-scope-in',false) RETURNING cruuid`, [V])).rows[0].cruuid;
  const crZero = (await sql(`INSERT INTO change_request (vessel_id,category,title,reason,target_type,target_id,status,requested_by_user_id,submitted_at,cruuid,is_deleted) VALUES ($1,'spares','vs zero','t','spare','s2','submitted','req',now(),'vs-scope-zero',false) RETURNING cruuid`, [V2])).rows[0].cruuid;

  const { initStorage } = await import('../server/storage');
  await initStorage();
  const { technicalApprovalCard } = await import('../server/modules/approvals/approvalCard');
  const scope = { moduleId: 'technical', screenId: 'pms-spares-cr', actionId: '' } as any;
  const resolve = (subjectRef: string) => technicalApprovalCard.resolveApprovers({ tenantId: 'default' }, scope, RUID, subjectRef);

  // ── STRICT ON (default) ──
  delete process.env.APPROVAL_VESSEL_SCOPE_STRICT; // default = on
  const strictIn: string[] = await resolve(crIn);
  check('1. in-scope office approver IS in the resolved set (strict)', strictIn.includes('vs-in'), `resolved=${JSON.stringify(strictIn)}`);
  check('2. out-of-scope SAME-ROLE user is EXCLUDED (strict) → read-only', !strictIn.includes('vs-out'));
  const strictZero: string[] = await resolve(crZero);
  check('3. step resolves to ZERO approvers on an unassigned vessel (strict)', strictZero.length === 0, `resolved=${JSON.stringify(strictZero)}`);

  // client read-only affordance (replica): in-scope shows button, out-of-scope hidden, request still opens
  check('2b. client button SHOWS for in-scope approver', clientButton([V], V, false, true, true) === true);
  check('2c. client button HIDDEN for out-of-scope approver (read-only; dialog/panel still render)', clientButton([V2], V, false, true, true) === false);

  // F3 message text present
  const cp = fs.readFileSync('client/src/components/approvals/ApprovalChainProgress.tsx', 'utf8');
  check('3b. F3 flag uses the new "assign the vessel in SAILERP" message', cp.includes('assign the vessel to an approver') && cp.includes('no approver assigned for this vessel'));

  // ── STRICT OFF → fleet-wide restored ──
  process.env.APPROVAL_VESSEL_SCOPE_STRICT = 'off';
  const looseIn: string[] = await resolve(crIn);
  check('4. flag OFF restores fleet-wide: BOTH same-role users resolved', looseIn.includes('vs-in') && looseIn.includes('vs-out'), `resolved=${JSON.stringify(looseIn)}`);
  const looseZero: string[] = await resolve(crZero);
  check('4b. flag OFF: unassigned vessel also resolves fleet-wide (no zero)', looseZero.includes('vs-in') && looseZero.includes('vs-out'));

  // cleanup
  delete process.env.APPROVAL_VESSEL_SCOPE_STRICT;
  await sql(`DELETE FROM change_request WHERE cruuid LIKE 'vs-scope-%'`);
  await sql(`DELETE FROM master_user_vessels WHERE user_uuid IN ('vs-in','vs-out')`);
  await sql(`DELETE FROM master_users WHERE id IN ('vs-in','vs-out')`);
  await sql(`DELETE FROM admn_role_master WHERE ruid=$1`, [RUID]);
  await p.end();
  console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('HARNESS ERROR:', e.message); process.exit(1); });
