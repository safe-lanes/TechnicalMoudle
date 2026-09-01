/**
 * AE-21 END-TO-END proof — a real NON-Sail-Admin Office user with a legacy moc_approvers
 * Level-1 row completing a CR approve, INCLUDING the client button-visibility condition.
 *
 * Why this covers what fix-round-1-proof.ts (p04) missed: p04 exercised engine-pool button
 * visibility and the route guard, never a legacy moc_approvers Level-1 approver's button on a
 * legacy CR. Synthetic clicks can't drive AG-Grid, so the button gate is asserted by running
 * the SAME shared logic the client runs (anyLevelMatches from @shared/approvals/level) against
 * the LIVE /approval-steps + /admin/local-approvers responses — then the approve is driven
 * end to end over HTTP.
 *
 * Run: shore up on :5000 (PMS_AUTH_MOCK_RBAC=0). `npx tsx scripts/test-ae21-approve-e2e.ts`
 */
import { Pool } from 'pg';
import { anyLevelMatches } from '@shared/approvals/level';

const DB = 'postgres://postgres:admin123@localhost:5432/pms_arch';
const BASE = 'http://localhost:5000';
const VESSEL = '743ef9d1-841a-11ed-aa7c-7003bca91a86';
const APPROVER = 'p2e-off-1';   // Office, role 'User' (NOT Sail Admin)
const STRANGER = 'p2e-strange'; // Office, no approver row

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); ok ? pass++ : fail++; };

// Faithful replica of the ModifyPMS legacy client gate (post-fix).
function clientButtonShows(localApprovers: any[], currentUserUuid: string | null, activeStepLevel: string | null, assignedVesselIds: string[], crVesselId: string | null, isVessel = false, isHeadOfDept = false) {
  const userApproverLevels = localApprovers
    .filter((a) => a.userUuid && currentUserUuid && a.userUuid === currentUserUuid && a.isActive === 1 && !a.isDeleted)
    .map((a) => a.approverLevel as string);
  const userIsApproverForActiveStep = !!activeStepLevel && anyLevelMatches(userApproverLevels, activeStepLevel);
  const crVesselIsAssigned = assignedVesselIds.length === 0 || (!!crVesselId && assignedVesselIds.includes(crVesselId));
  const noApproversConfigured = !localApprovers.some((a) => a.isActive === 1 && !a.isDeleted);
  const legacyUserCanAct = crVesselIsAssigned && (
    (!currentUserUuid) ? false
      : noApproversConfigured ? (!isVessel && !isHeadOfDept)
      : userIsApproverForActiveStep
  );
  return legacyUserCanAct;
}
// The OLD exact-match gate (pre-fix) — to prove the level-drift case would have been HIDDEN.
function oldGate(localApprovers: any[], uuid: string, stepLevel: string) {
  const levels = localApprovers.filter((a) => a.userUuid === uuid && a.isActive === 1 && !a.isDeleted).map((a) => a.approverLevel);
  return levels.includes(stepLevel);
}

const api = (path: string, method = 'GET', body?: any, uuid = APPROVER, type = 'Office') =>
  fetch(`${BASE}${path}`, { method, headers: { 'x-user-id': uuid, 'x-user-type': type, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

async function seedCR(p: Pool, level: string, approverLevel: string | null) {
  const cruuid = 'ae21e2e-' + Date.now() + '-' + Math.floor(pass * 1000 + fail);
  const cr = await p.query(
    `INSERT INTO change_request (vessel_id,category,title,reason,target_type,target_id,status,requested_by_user_id,submitted_at,cruuid,is_deleted)
     VALUES ($1,'component','AE-21 e2e','t','component','comp-z','submitted','p2e-buildr',now(),$2,false) RETURNING id`, [VESSEL, cruuid]);
  const crId = cr.rows[0].id;
  await p.query(`INSERT INTO change_request_approval (crauuid,change_request_id,change_request_uuid,approval_level,status,is_deleted) VALUES ($1,$2,$3,$4,'Pending',false)`,
    ['ae21e2e-s-' + Date.now() + Math.random(), crId, cruuid, level]);
  if (approverLevel !== null) {
    await p.query(`INSERT INTO moc_approvers (mauuid,name,user_id,user_uuid,approver_level,email_id,is_active,modulename,is_deleted) VALUES ($1,'E2E Office One',$2,$2,$3,'x@x',1,'Technical',false)`,
      ['ae21e2e-a-' + Date.now() + Math.random(), APPROVER, approverLevel]);
  }
  return crId;
}

(async () => {
  const p = new Pool({ connectionString: DB });
  await p.query(`DELETE FROM change_request_approval WHERE change_request_uuid LIKE 'ae21e2e-%'`);
  await p.query(`DELETE FROM change_request WHERE cruuid LIKE 'ae21e2e-%'`);
  await p.query(`DELETE FROM moc_approvers WHERE mauuid LIKE 'ae21e2e-%'`);

  // ── CASE A — baseline: step 'Level 1', approver 'Level 1' ──
  const crA = await seedCR(p, 'Level 1', 'Level 1');
  const stepsA = await (await api(`/technical/api/change-requests/${crA}/approval-steps`)).json();
  const apprA = await (await api(`/technical/api/admin/local-approvers`)).json();
  const stepLvlA = stepsA[0].approvalLevel;
  check('A1 client button SHOWS for genuine Level-1 approver (baseline)', clientButtonShows(apprA, APPROVER, stepLvlA, [], VESSEL));
  const approveA = await api(`/technical/api/change-requests/${crA}/approve`, 'PUT', { comment: 'e2e A' });
  check('A2 approve completes end-to-end (HTTP 200)', approveA.status === 200, `HTTP ${approveA.status}`);

  // ── CASE B — level-format drift: step 'Level 1', approver stored 'Level1' (no space) ──
  await p.query(`DELETE FROM moc_approvers WHERE mauuid LIKE 'ae21e2e-%'`);
  const crB = await seedCR(p, 'Level 1', 'Level1');
  const stepsB = await (await api(`/technical/api/change-requests/${crB}/approval-steps`)).json();
  const apprB = await (await api(`/technical/api/admin/local-approvers`)).json();
  const stepLvlB = stepsB[0].approvalLevel;
  check('B1 OLD exact-match gate would HIDE the button (reproduces AE-21)', oldGate(apprB, APPROVER, stepLvlB) === false, `old=${oldGate(apprB, APPROVER, stepLvlB)}`);
  check('B2 FIXED gate SHOWS the button despite "Level1" vs "Level 1"', clientButtonShows(apprB, APPROVER, stepLvlB, [], VESSEL) === true);
  const approveB = await api(`/technical/api/change-requests/${crB}/approve`, 'PUT', { comment: 'e2e B' });
  check('B3 approve completes end-to-end (HTTP 200)', approveB.status === 200, `HTTP ${approveB.status}`);

  // ── CASE C — negative: a stranger with NO approver row must NOT see the button ──
  const crC = await seedCR(p, 'Level 1', null); // no moc_approvers row seeded
  const stepsC = await (await api(`/technical/api/change-requests/${crC}/approval-steps`, 'GET', undefined, STRANGER)).json();
  const apprC = await (await api(`/technical/api/admin/local-approvers`, 'GET', undefined, STRANGER)).json();
  check('C1 client button HIDDEN for a non-approver (stranger)', clientButtonShows(apprC, STRANGER, stepsC[0].approvalLevel, [], VESSEL) === false);

  // ── D — pending-for-approver list now matches by user_uuid (was user_id) ──
  await p.query(`DELETE FROM moc_approvers WHERE mauuid LIKE 'ae21e2e-%'`);
  const crD = await seedCR(p, 'Level 1', 'Level 1');
  const listD = await (await api(`/technical/api/change-requests?pendingForApprover=${APPROVER}`)).json();
  check('D1 CR appears in pending-for-approver list keyed by user_uuid', Array.isArray(listD) && listD.some((c: any) => c.id === crD), `count=${Array.isArray(listD) ? listD.length : 'n/a'}`);

  // cleanup
  await p.query(`DELETE FROM change_request_approval WHERE change_request_uuid LIKE 'ae21e2e-%'`);
  await p.query(`DELETE FROM change_request WHERE cruuid LIKE 'ae21e2e-%'`);
  await p.query(`DELETE FROM moc_approvers WHERE mauuid LIKE 'ae21e2e-%'`);
  await p.end();
  console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('HARNESS ERROR:', e.message); process.exit(1); });
