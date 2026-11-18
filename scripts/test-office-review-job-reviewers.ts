/**
 * Regression harness — "Job's Office Reviewers" (18-Nov-2026).
 * WO Office Review through the approval engine, with the approvers and the Any one (OR) / All
 * (AND) rule taken from the work order's Job:
 *   1. the special approver is offered only for WO Office Review
 *   2. OR  : one box per Job role; one approval completes the WO (reviewer approve logic ran)
 *   3. AND : every role must approve (different people); then the WO completes
 *   4. AND reject → WO Reopened
 *   5. the request keeps the roles it started with when the Job changes afterwards
 *   6. a Job with no Office Reviewer roles → submit refused (400), nothing created
 *
 * Runs against a THROWAWAY shore (default :5077) on a THROWAWAY database (default pms_ae_test);
 * refuses any database whose name does not end in _test. Cleans up what it creates and restores
 * the Job it borrows.
 *   npx tsx scripts/test-office-review-job-reviewers.ts
 */
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

const BASE = process.env.AE_TEST_BASE || 'http://localhost:5077/technical/api';
const DB = process.env.AE_TEST_DB || 'pms_ae_test';
if (!DB.endsWith('_test')) { console.error(`refusing: database '${DB}' is not a *_test database`); process.exit(2); }
const pool = new Pool({ connectionString: `postgres://postgres:admin123@localhost:5432/${DB}` });
const sql = async (q: string, p: any[] = []) => (await pool.query(q, p)).rows;

const V = '743ef9d1-841a-11ed-aa7c-7003bca91a86'; // WK Frontier Pilot
const TAG = 'JOR';
const SCREEN = 'pms-wo-office-review';
const SPECIAL = 'job:office-reviewers';
const AE = '/approval-engine';
const scope = { moduleId: 'technical', screenId: SCREEN, actionId: '' };
const ADMIN = { id: 'jor-admin', name: 'JOR Admin', role: 'Sail Admin', type: 'Office', rank: 'Technical Superintendent' };

async function call(method: string, path: string, body: any, who: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json',
    'x-user-id': who.id, 'x-user-name': encodeURIComponent(who.name), 'x-user-role': encodeURIComponent(who.role), 'x-user-type': who.type, 'x-rank': who.rank };
  const r = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* not json */ }
  console.log(`   → ${method} ${path} as ${who.id} ← ${r.status} ${text.slice(0, 140).replace(/\s+/g, ' ')}`);
  return { status: r.status, json, text };
}
let fails = 0; let passes = 0;
const check = (label: string, ok: boolean) => { console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${label}`); ok ? passes++ : fails++; };
const hr = (t: string) => console.log(`\n── ${t}`);

const created = { woUuids: [] as string[] };
let jobBackup: { juuid: string; roles: any; rule: string } | null = null;

async function cleanup() {
  const u = created.woUuids;
  if (u.length) {
    await sql(`DELETE FROM apprv_request_slots WHERE requuid IN (SELECT requuid FROM apprv_requests WHERE subject_ref = ANY($1))`, [u]);
    await sql(`DELETE FROM apprv_requests WHERE subject_ref = ANY($1)`, [u]);
    await sql(`DELETE FROM sync_field_log WHERE row_uuid = ANY($1)`, [u]);
    for (const t of ['maintenance_history', 'wo_approval_events', 'skipped_cycles']) {
      const has = await sql(`SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND column_name IN ('work_order_id','wo_uuid','wouuid')`, [t]);
      for (const c of has) await sql(`DELETE FROM ${t} WHERE ${c.column_name} = ANY($1)`, [u]).catch(() => {});
    }
    await sql(`DELETE FROM audit_logs WHERE entity_id = ANY($1)`, [u]).catch(() => {});
    await sql(`DELETE FROM work_orders WHERE wouuid = ANY($1)`, [u]);
  }
  await sql(`DELETE FROM apprv_workflows WHERE label = $1`, [`${TAG} chain`]);
  await sql(`DELETE FROM apprv_scope_settings WHERE module_id='technical' AND screen_id=$1`, [SCREEN]);
  await sql(`DELETE FROM master_user_vessels WHERE user_uuid LIKE 'jor-%'`);
  await sql(`DELETE FROM master_users WHERE id LIKE 'jor-%'`);
  if (jobBackup) await sql(`UPDATE jobs SET office_reviewer_role_ruids=$2, office_reviewer_rule=$3 WHERE juuid=$1`, [jobBackup.juuid, JSON.stringify(jobBackup.roles ?? []), jobBackup.rule]);
}

(async () => {
  hr('0. set-up (throwaway DB)');
  const roles = await sql(`SELECT ruid, assigned_role FROM admn_role_master WHERE is_active=true AND is_deleted=false AND roletype <> 'Ship' ORDER BY assigned_role LIMIT 2`);
  check('two office roles found', roles.length === 2);
  const [R1, R2] = roles;
  const USER_A = { id: 'jor-a', name: 'JOR Role-1 User', role: R1.assigned_role, type: 'Office', rank: 'Technical Superintendent' };
  const USER_A2 = { id: 'jor-a2', name: 'JOR Role-1 User 2', role: R1.assigned_role, type: 'Office', rank: 'Technical Superintendent' };
  const USER_B = { id: 'jor-b', name: 'JOR Role-2 User', role: R2.assigned_role, type: 'Office', rank: 'Technical Superintendent' };
  const STRANGER = { id: 'jor-x', name: 'JOR Stranger', role: 'Vessel User', type: 'Ship', rank: 'Third Engineer' };
  for (const u of [ADMIN, USER_A, USER_A2, USER_B, STRANGER]) {
    await sql(`INSERT INTO master_users (id, full_name, role, user_type, is_deleted) VALUES ($1,$2,$3,$4,false)
      ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role, full_name=EXCLUDED.full_name, is_deleted=false`, [u.id, u.name, u.role, u.type]);
  }
  for (const u of [USER_A, USER_A2, USER_B]) {
    await sql(`INSERT INTO master_user_vessels (user_uuid, vessel_id, is_active, map_status) VALUES ($1,$2,true,'unmapped')
      ON CONFLICT (user_uuid, vessel_id) DO UPDATE SET is_active=true`, [u.id, V]);
  }
  const src = (await sql(`SELECT w.wouuid, w.job_id FROM work_orders w JOIN jobs j ON j.juuid = w.job_id
    WHERE w.vessel_id=$1 AND coalesce(w.is_deleted,false)=false ORDER BY w.wouuid LIMIT 1`, [V]))[0];
  check('found a work order with a Job on the pilot vessel', !!src);
  const job = (await sql(`SELECT juuid, office_reviewer_role_ruids roles, office_reviewer_rule rule FROM jobs WHERE juuid=$1`, [src.job_id]))[0];
  jobBackup = { juuid: job.juuid, roles: job.roles, rule: job.rule };
  const setJob = (roleIds: string[], rule: 'any' | 'all') =>
    sql(`UPDATE jobs SET office_reviewer_role_ruids=$2, office_reviewer_rule=$3 WHERE juuid=$1`, [job.juuid, JSON.stringify(roleIds), rule]);
  const newWo = async () => {
    const wouuid = randomUUID();
    const id = `${TAG}-${wouuid.slice(0, 8)}`;
    await sql(`INSERT INTO work_orders SELECT (jsonb_populate_record(NULL::work_orders,
        to_jsonb(w) || jsonb_build_object('id', $2::text, 'wouuid', $3::text, 'work_order_no', $2::text, 'status', 'Pending Office Review', 'date_completed', to_char(now(), 'YYYY-MM-DD'),
          'superintendent_acknowledged', true, 'approval_tier', null))).* FROM work_orders w WHERE w.wouuid = $1`, [src.wouuid, id, wouuid]);
    created.woUuids.push(wouuid);
    return wouuid;
  };
  const submit = (wouuid: string) => call('POST', `${AE}/requests`, { scope, subjectRef: wouuid, subject: { kind: 'wo', workOrderId: wouuid }, vesselId: V }, ADMIN);
  const slots = async (requuid: string) => sql(`SELECT role_id, status FROM apprv_request_slots WHERE requuid=$1 ORDER BY slot_ordinal`, [requuid]);
  const woStatus = async (wouuid: string) => (await sql(`SELECT status FROM work_orders WHERE wouuid=$1`, [wouuid]))[0]?.status;
  const decide = (requuid: string, who: any, decision: 'approve' | 'reject', remarks?: string) =>
    call('POST', `${AE}/requests/${requuid}/decide`, { decision, remarks }, who);

  hr('1. the special approver is offered only for WO Office Review');
  const rolesHere = await call('GET', `${AE}/roles?moduleId=technical&screenId=${SCREEN}&actionId=`, undefined, ADMIN);
  check("WO Office Review offers \"Job's Office Reviewers\"", Array.isArray(rolesHere.json) && rolesHere.json.some((r: any) => r.roleId === SPECIAL));
  const rolesCr = await call('GET', `${AE}/roles?moduleId=technical&screenId=pms-spares-cr&actionId=`, undefined, ADMIN);
  check('a change-request chain does not offer it', Array.isArray(rolesCr.json) && !rolesCr.json.some((r: any) => r.roleId === SPECIAL));
  const chain = {
    scope, classification: 'Office Review', mode: 'simple', label: `${TAG} chain`,
    nodes: [
      { key: 'step-1', type: 'approval-step', label: 'Office review', ordinal: 0, quorum: { rule: 'all' }, slots: [{ roleId: SPECIAL, roleLabel: "Job's Office Reviewers" }] },
      { key: 'end', type: 'end', label: 'End', ordinal: 1 },
    ],
    edges: [{ from: 'step-1', to: 'end' }],
  };
  check('admin saves the chain (one step: Job\'s Office Reviewers)', (await call('POST', `${AE}/workflows`, chain, ADMIN)).status === 201);

  hr('2. OR: one box per Job role, one approval completes the WO');
  await setJob([R1.ruid, R2.ruid], 'any');
  const wo1 = await newWo();
  const s1 = await submit(wo1);
  check('submit → STARTED', s1.json?.outcome === 'STARTED');
  const sl1 = await slots(s1.json.requuid);
  check('two boxes, the Job roles', sl1.length === 2 && sl1.map((r: any) => r.role_id).sort().join() === [R1.ruid, R2.ruid].sort().join());
  check('a stranger is refused (403)', (await decide(s1.json.requuid, STRANGER, 'approve')).status === 403);
  const d1 = await decide(s1.json.requuid, USER_B, 'approve', `${TAG} OR ok`);
  check('one approval (role 2) → request approved', d1.json?.requestStatus === 'approved');
  check('WO completed by the reviewer-approve logic', (await woStatus(wo1)) === 'Completed');

  hr('3. AND: each Job role must approve (different people)');
  await setJob([R1.ruid, R2.ruid], 'all');
  const wo2 = await newWo();
  const s2 = await submit(wo2);
  const a1 = await decide(s2.json.requuid, USER_A, 'approve');
  check('role 1 approves → still pending', a1.json?.requestStatus === 'pending' && a1.json?.nodeSatisfied === false);
  check('WO still Pending Office Review', (await woStatus(wo2)) === 'Pending Office Review');
  check('the same person cannot fill the second box (403)', (await decide(s2.json.requuid, USER_A, 'approve')).status === 403);
  check('another holder of role 1 cannot fill role 2\'s box (403)', (await decide(s2.json.requuid, USER_A2, 'approve')).status === 403);
  const a2 = await decide(s2.json.requuid, USER_B, 'approve');
  check('role 2 approves → approved', a2.json?.requestStatus === 'approved');
  check('WO completed', (await woStatus(wo2)) === 'Completed');

  hr('4. AND reject → WO reopened');
  const wo3 = await newWo();
  const s3 = await submit(wo3);
  const r3 = await decide(s3.json.requuid, USER_B, 'reject', `${TAG} please redo`);
  check('reject → returned', r3.json?.requestStatus === 'returned');
  check('WO Reopened', (await woStatus(wo3)) === 'Reopened');

  hr('5. the request keeps the roles it started with');
  await setJob([R1.ruid, R2.ruid], 'all');
  const wo4 = await newWo();
  const s4 = await submit(wo4);
  await setJob([R1.ruid], 'any'); // Job edited while the review runs
  const sl4 = await slots(s4.json.requuid);
  check('still two boxes after the Job changed', sl4.length === 2);
  const b4 = await decide(s4.json.requuid, USER_A, 'approve');
  check('still AND: one approval leaves it pending', b4.json?.requestStatus === 'pending');

  hr('6. a Job with no Office Reviewer roles → refused');
  await setJob([], 'any');
  const wo5 = await newWo();
  const s5 = await submit(wo5);
  check('submit → 400 EMPTY_SLOT_EXPANSION', s5.status === 400 && s5.json?.code === 'EMPTY_SLOT_EXPANSION');
  check('no engine request created', (await sql(`SELECT count(*) c FROM apprv_requests WHERE subject_ref=$1`, [wo5]))[0].c === '0');

  hr('7. admin panel lookup for the special approver');
  const look = await call('GET', `/approvals/role-approvers?roleId=${encodeURIComponent(SPECIAL)}`, undefined, ADMIN);
  check('panel says it is set on each Job', look.status === 200 && /Set on each Job/.test(JSON.stringify(look.json)));
})()
  .catch((e) => { console.error('ERROR', e); fails++; })
  .finally(async () => {
    await cleanup().catch((e) => console.error('cleanup failed', e));
    console.log(`\n${passes} passed, ${fails} failed`);
    await pool.end();
    process.exit(fails ? 1 : 0);
  });
