/**
 * Shipskart b2b reconciler (Stage 2 skeleton).
 *
 * SAILERP is master: users/vessels flow SAILERP → our tables (master_users / vessels /
 * master_user_vessels) → HERE → Shipskart. Nothing is ever created Shipskart-side first.
 *
 * SEQUENCING: vessels → users → user↔vessel mappings (mappings need BOTH Shipskart ids).
 * ROLE-MAPPED USERS ONLY: a user whose SAIL role has no row in shipskart_role_mappings —
 * or whose mapped Shipskart role has no live roleId on the tenant — is recorded as
 * 'unmapped_role' and skipped, never guessed.
 * IDEMPOTENT: every push is keyed on the link tables; status 'pushed' short-circuits.
 * Shipskart's returned data.id is persisted IN THE SAME breath as the create call —
 * there are NO lookup endpoints on their side, so a lost response = unmappable entity.
 * A clean duplicate-400 is recorded as 'blocked_duplicate' (surfaced, not silent) because
 * without a lookup endpoint we cannot recover the existing id from here.
 *
 * GUARDS: shore-only (ships never talk to Shipskart) and the per-tenant
 * reconciler_enabled flag (default FALSE — a fresh deploy cannot start pushing by
 * accident). Batch-limited per run.
 *
 * PROVEN ENDPOINT FACTS baked in (UAT 2026-07-30): vessel endpoint authorization FLIPPED
 * twice on their side within one day (morning: create-vessel 201 / -new 403; afternoon:
 * -new 201 / old 403) — so the endpoint is env-switchable, defaulting to create-vessel-new
 * (matches their collection; SHIPSKART_B2B_VESSEL_ENDPOINT overrides). smcId NOT required
 * on either variant (both proven with it omitted). roleId is authoritative (roleName
 * cosmetic); externalUserId = OUR SAILERP uuid and is what SSO keys on; tenantId travels
 * in the header only (enforced by the client).
 */
import crypto from 'crypto';
import { inArray, eq, and } from 'drizzle-orm';
import { getDb } from '../../../db';
import { masterUsers, vessels, masterUserVessels, shipskartUserLinks, shipskartVesselLinks } from '@shared/schema';
import { isShipInstance } from '../../sync/syncRole';
import { authorizedB2bRequest } from './shipskartTokenService';
import { resolveShipskartRoleId } from './shipskartRoleSource';
import * as roleMappingRepo from '../repositories/shipskartRoleMappingRepository';
import * as b2bRepo from '../repositories/shipskartB2bRepository';
import { getB2bConfig } from './shipskartB2bClient';

const DEFAULT_BATCH_LIMIT = 25;

/**
 * Pacing between b2b calls in SWEEP loops (Sachin, 2026-08-04: constant back-to-back
 * requests trip their security throttling — space them 5–10s and they go through).
 * Applied ONLY where a real API call just happened, and NEVER on the JIT click path
 * (interactive; 1–3 calls total is not "constant").
 */
const B2B_PACE_MS = Math.max(0, Number(process.env.SHIPSKART_B2B_PACE_MS ?? 5000));
const paceB2b = () => new Promise((r) => setTimeout(r, B2B_PACE_MS));
/** Statuses that mean a Shipskart API call was actually made (→ pace after them). */
const API_HIT_STATUSES = new Set(['pushed', 'mapped', 'blocked_duplicate', 'error', 'role_updated', 'role_update_failed', 'unmapped', 'mapping_update_failed']);

/**
 * CALLSIGN SEAM: Shipskart requires callSign and real call signs are not available yet —
 * agreed workaround (Shipskart-confirmed) is to pass the IMO number. When real call signs
 * land, this one function changes and nothing else does.
 */
export function resolveCallSign(v: { imoNumber: string | null }): string | null {
  return v.imoNumber;
}

/** Shipskart vessel `type` is a numeric code; our vesselType is free text. Tolerant map, '99' Other fallback. */
function resolveVesselTypeCode(vesselType: string | null): string {
  const t = (vesselType || '').toLowerCase();
  if (t.includes('tank')) return '1';
  if (t.includes('container')) return '2';
  if (t.includes('bulk')) return '3';
  if (t.includes('general')) return '4';
  if (t.includes('passenger')) return '5';
  if (t.includes('roro') || t.includes('ro-ro')) return '6';
  if (t.includes('lng') || t.includes('gas')) return '7';
  return '99';
}

const tally = (acc: Record<string, number>, s: string) => { acc[s] = (acc[s] || 0) + 1; return acc; };

const isDuplicate400 = (res: { status: number; json: any }) =>
  res.status === 400 && /already in use|already exists|duplicate/i.test(JSON.stringify(res.json ?? ''));

export interface PushResult { status: string; shipskartId?: string; error?: string }

// ── vessels ──

export async function pushVessel(v: {
  vuuid: string; name: string; imoNumber: string | null; vesselType?: string | null;
}): Promise<PushResult> {
  const existing = await b2bRepo.getVesselLink(v.vuuid);
  if (existing?.pushStatus === 'pushed' && existing.shipskartVesselId) {
    return { status: 'already_pushed', shipskartId: existing.shipskartVesselId };
  }
  if (!v.imoNumber || !/^\d{7}$/.test(v.imoNumber)) {
    await b2bRepo.upsertVesselLink(v.vuuid, { imoNumber: v.imoNumber ?? null, pushStatus: 'invalid_imo', lastError: `IMO must be exactly 7 digits, got '${v.imoNumber ?? ''}'` });
    return { status: 'invalid_imo' };
  }
  const vesselEndpoint = process.env.SHIPSKART_B2B_VESSEL_ENDPOINT || '/integration/SAIL/create-vessel-new';
  const cfg = getB2bConfig();
  const res = await authorizedB2bRequest('POST', vesselEndpoint, {
    body: { data: {
      name: v.name,
      imoNumber: v.imoNumber,
      callSign: resolveCallSign(v),
      type: resolveVesselTypeCode(v.vesselType ?? null),
      operationalStatus: '1',
      // smcId IS required in practice: create accepts its omission, but map-user-to-vessel
      // then rejects the vessel ("Vessel does not have a valid SMCTenantId") — proven
      // end-to-end 2026-07-30. It is a per-tenant constant equal to the tenant id
      // (their own example does the same); override via SHIPSKART_B2B_SMC_ID if that
      // ever stops being true.
      smcId: process.env.SHIPSKART_B2B_SMC_ID || cfg.tenantId,
      smcName: process.env.SHIPSKART_B2B_SMC_NAME || null,
    } },
  });
  const shipskartId = res.json?.data?.id;
  if (res.ok && shipskartId) {
    await b2bRepo.upsertVesselLink(v.vuuid, { imoNumber: v.imoNumber, shipskartVesselId: shipskartId, pushStatus: 'pushed', lastError: null });
    return { status: 'pushed', shipskartId };
  }
  const status = isDuplicate400(res) ? 'blocked_duplicate' : 'error';
  const error = JSON.stringify(res.json ?? res.text)?.slice(0, 400);
  await b2bRepo.upsertVesselLink(v.vuuid, { imoNumber: v.imoNumber, pushStatus: status, lastError: error });
  return { status, error };
}

// ── users ──

/**
 * ROLE-DRIFT SELF-HEAL (their 03-Aug collection — item "Update User Role" =
 * PUT /integration/SAIL/update-user-details/{userId}; the sibling update-vessel-user
 * takes the identical body but targets vessel-user records, not the company users
 * create-user makes — proven live, see harness). Before this, a link at 'pushed' was
 * skipped forever and a SAILERP role change never reached Shipskart.
 *
 * pushedRoleId NULL = pushed before mig 153 (remote role unknown) → align once, then
 * the stamp makes every later check a free local comparison. A currently-unmapped role
 * updates nothing (never guess a role); the remote user keeps the last mapped role.
 */
async function syncRoleIfDrifted(
  link: { userUuid: string; shipskartUserId: string; pushedRoleId: string | null },
  sailRole: string | null,
): Promise<PushResult> {
  const mapping = sailRole ? await roleMappingRepo.getMappingForSailRole(sailRole) : undefined;
  const roleId = mapping ? await resolveShipskartRoleId(mapping.shipskartRole) : null;
  if (!mapping || !roleId || link.pushedRoleId === roleId) {
    return { status: 'already_pushed', shipskartId: link.shipskartUserId };
  }
  const res = await authorizedB2bRequest('PUT', `/integration/SAIL/update-user-details/${link.shipskartUserId}`, {
    body: { id: link.shipskartUserId, data: { roleId, roleName: mapping.shipskartRole } },
  });
  if (res.ok) {
    await b2bRepo.upsertUserLink(link.userUuid, {
      pushStatus: 'pushed', lastError: null,
      pushedRoleId: roleId, pushedRoleName: mapping.shipskartRole,
    });
    console.log(`[Shipskart b2b] role updated for ${link.userUuid} → '${mapping.shipskartRole}'`);
    return { status: 'role_updated', shipskartId: link.shipskartUserId };
  }
  const error = JSON.stringify(res.json ?? res.text)?.slice(0, 400);
  // Link STAYS 'pushed' (the user exists remotely and must not be re-created); the
  // error is recorded and the next sweep retries because the stamp was not written.
  await b2bRepo.upsertUserLink(link.userUuid, { pushStatus: 'pushed', lastError: `role update failed: ${error}` });
  return { status: 'role_update_failed', error };
}

export async function pushUser(mu: {
  id: string; fullName: string; email: string | null; role: string | null; designation: string | null;
}): Promise<PushResult> {
  const existing = await b2bRepo.getUserLink(mu.id);
  if (existing?.pushStatus === 'pushed' && existing.shipskartUserId) {
    return syncRoleIfDrifted(
      { userUuid: mu.id, shipskartUserId: existing.shipskartUserId, pushedRoleId: existing.pushedRoleId ?? null },
      mu.role,
    );
  }
  if (!mu.email) {
    await b2bRepo.upsertUserLink(mu.id, { pushStatus: 'missing_email', lastError: 'master_users row has no email — Shipskart requires one' });
    return { status: 'missing_email' };
  }
  const mapping = mu.role ? await roleMappingRepo.getMappingForSailRole(mu.role) : undefined;
  const roleId = mapping ? await resolveShipskartRoleId(mapping.shipskartRole) : null;
  if (!mapping || !roleId) {
    await b2bRepo.upsertUserLink(mu.id, {
      pushStatus: 'unmapped_role',
      lastError: mapping
        ? `mapped Shipskart role '${mapping.shipskartRole}' has no live roleId on this tenant`
        : `SAIL role '${mu.role ?? ''}' has no shipskart_role_mappings row`,
    });
    return { status: 'unmapped_role' };
  }

  const nameParts = (mu.fullName || '').trim().split(/\s+/);
  const firstName = nameParts[0] || 'User';
  const lastName = nameParts.slice(1).join(' ') || firstName;
  // Deterministic userName (stable across retries → duplicate handling stays predictable).
  const userName = `sail_${mu.id.replace(/[^a-z0-9]/gi, '').slice(0, 16).toLowerCase()}`;

  const res = await authorizedB2bRequest('POST', '/integration/SAIL/create-user', {
    body: { data: {
      firstName, lastName, middleName: null,
      email: mu.email,
      userName,
      // SSO is the only entry path — nobody ever types this password; strong throwaway.
      passwordHash: crypto.randomBytes(16).toString('base64') + 'aA1!',
      roleId, roleName: mapping.shipskartRole, // roleName cosmetic (proven); roleId decides
      rank: mu.designation ?? null,
      status: '1',
      externalUserId: mu.id, // OUR SAILERP uuid — the value Shipskart SSO keys on (proven)
    } },
  });
  const shipskartId = res.json?.data?.id;
  if (res.ok && shipskartId) {
    await b2bRepo.upsertUserLink(mu.id, {
      shipskartUserId: shipskartId, pushStatus: 'pushed', lastError: null,
      // mig 153: stamp what we pushed so later role changes are a free local comparison
      pushedRoleId: roleId, pushedRoleName: mapping.shipskartRole,
    });
    return { status: 'pushed', shipskartId };
  }
  const status = isDuplicate400(res) ? 'blocked_duplicate' : 'error';
  const error = JSON.stringify(res.json ?? res.text)?.slice(0, 400);
  await b2bRepo.upsertUserLink(mu.id, { pushStatus: status, lastError: error });
  return { status, error };
}

// ── user↔vessel mapping ──

export async function mapUserToVessel(userUuid: string, vesselVuuid: string, ctx?: {
  userFullName?: string; vesselName?: string;
}): Promise<PushResult> {
  const assignment = await b2bRepo.getAssignment(userUuid, vesselVuuid);
  if (assignment?.mapStatus === 'mapped' && assignment.shipskartMappingId) {
    return { status: 'already_mapped', shipskartId: assignment.shipskartMappingId };
  }
  // RE-ACTIVATION: a mapping that already has a Shipskart id (user was removed from the
  // vessel and came back) must be UPDATED to active, not POSTed again — a second POST
  // would create a duplicate mapping row on their side.
  if (assignment?.shipskartMappingId) {
    return updateVesselUserMapping(
      { userUuid, vesselId: vesselVuuid, shipskartMappingId: assignment.shipskartMappingId }, true, ctx);
  }
  const userLink = await b2bRepo.getUserLink(userUuid);
  const vesselLink = await b2bRepo.getVesselLink(vesselVuuid);
  if (userLink?.pushStatus !== 'pushed' || !userLink.shipskartUserId) {
    await b2bRepo.upsertAssignment(userUuid, vesselVuuid, { mapStatus: 'awaiting_user', lastError: `user link status: ${userLink?.pushStatus ?? 'absent'}` });
    return { status: 'awaiting_user' };
  }
  if (vesselLink?.pushStatus !== 'pushed' || !vesselLink.shipskartVesselId) {
    await b2bRepo.upsertAssignment(userUuid, vesselVuuid, { mapStatus: 'awaiting_vessel', lastError: `vessel link status: ${vesselLink?.pushStatus ?? 'absent'}` });
    return { status: 'awaiting_vessel' };
  }
  const res = await authorizedB2bRequest('POST', '/integration/SAIL/map-user-to-vessel', {
    body: { data: {
      vesselId: vesselLink.shipskartVesselId,
      vesselName: ctx?.vesselName ?? null,
      userId: userLink.shipskartUserId,
      userFullName: ctx?.userFullName ?? null,
      isActive: true,
    } },
  });
  const mappingId = res.json?.data?.id;
  if (res.ok && mappingId) {
    await b2bRepo.upsertAssignment(userUuid, vesselVuuid, { shipskartMappingId: mappingId, mapStatus: 'mapped', lastError: null });
    return { status: 'mapped', shipskartId: mappingId };
  }
  const status = isDuplicate400(res) ? 'blocked_duplicate' : 'error';
  const error = JSON.stringify(res.json ?? res.text)?.slice(0, 400);
  await b2bRepo.upsertAssignment(userUuid, vesselVuuid, { mapStatus: status, lastError: error });
  return { status, error };
}

// ── vessel-user mapping UPDATE ──
//
// Shape from Sachin's 04-Aug curl (integrated ahead of their deploy, at his request, so
// nothing changes on our side when they release): PUT /update-vessel-user/{mappingId}
// with the FULL mapping record in `data` — vesselId/userId are THEIR ids, and isActive
// is the on/off switch. This is how a user is REMOVED from a vessel (isActive:false);
// there is no delete endpoint. Until their release, calls fail and are simply recorded
// on the assignment row — every sweep retries them.

export async function updateVesselUserMapping(
  a: { userUuid: string; vesselId: string; shipskartMappingId: string },
  isActive: boolean,
  ctx?: { userFullName?: string | null; vesselName?: string | null },
): Promise<PushResult> {
  const userLink = await b2bRepo.getUserLink(a.userUuid);
  const vesselLink = await b2bRepo.getVesselLink(a.vesselId);
  if (!userLink?.shipskartUserId || !vesselLink?.shipskartVesselId) {
    await b2bRepo.upsertAssignment(a.userUuid, a.vesselId, { lastError: 'mapping update needs both Shipskart ids — user or vessel link missing' });
    return { status: 'missing_links' };
  }
  const res = await authorizedB2bRequest('PUT', `/integration/SAIL/update-vessel-user/${a.shipskartMappingId}`, {
    body: { id: a.shipskartMappingId, data: {
      vesselId: vesselLink.shipskartVesselId,
      vesselName: ctx?.vesselName ?? null,
      userId: userLink.shipskartUserId,
      userFullName: ctx?.userFullName ?? null,
      isActive,
      updatedAt: new Date().toISOString(),
      updatedBy: 'System',
    } },
  });
  if (res.ok) {
    await b2bRepo.upsertAssignment(a.userUuid, a.vesselId, { mapStatus: isActive ? 'mapped' : 'unmapped', lastError: null });
    return { status: isActive ? 'mapped' : 'unmapped', shipskartId: a.shipskartMappingId };
  }
  const error = JSON.stringify(res.json ?? res.text)?.slice(0, 400);
  await b2bRepo.upsertAssignment(a.userUuid, a.vesselId, { lastError: `mapping update failed: ${error}` });
  return { status: 'mapping_update_failed', error };
}

// ── JIT (just-in-time) push at first Purchasing click ──
//
// WHY: without it, a new joiner / role change / user the reconciler has not reached yet
// cannot open Purchasing until the next sweep. With it the system self-heals on first
// click and there is no cutover day.
//
// MEASURED COST (UAT, 2026-07-30): warm path (already pushed) = 1 API call ≈ 470 ms;
// cold JIT = 3 API calls ≈ 950 ms (+1 per extra vessel). Token and role lookups are
// cached and cost no API call.
//
// RULES:
//  • VESSELS ARE NEVER CREATED HERE. Fleet data is the reconciler's job; a wrong IMO or
//    type created under click-time pressure would put junk in Shipskart. A user whose
//    vessel is not pushed yet still gets IN — their vessel mapping simply follows later.
//  • MAPPING FAILURE NEVER BLOCKS THE USER. create-user is what SSO needs; mappings are
//    best-effort and recorded on the assignment rows for the reconciler to retry.
//  • ATTEMPT CAP so a permanently failing user cannot hammer Shipskart on every click.
//    In-memory by design (per process, resets on restart): the durable retry path is the
//    reconciler, and a restart-proof counter would need a migration for no real gain.

const JIT_MAX_ATTEMPTS = 3;
const jitAttempts = new Map<string, number>();

export interface JitResult { pushed: boolean; reason: string; mappings?: Record<string, number> }

export async function ensureUserPushed(userUuid: string, sailRole: string | null): Promise<JitResult> {
  const existing = await b2bRepo.getUserLink(userUuid);
  if (existing?.pushStatus === 'pushed' && existing.shipskartUserId) {
    // Role-drift self-heal at click time: free local comparison when nothing changed;
    // exactly one PUT when the SAILERP role drifted. A failed update never blocks the
    // click — the user is in with their previous role and the sweep retries durably.
    let reason = 'already_pushed';
    try {
      const drift = await syncRoleIfDrifted(
        { userUuid, shipskartUserId: existing.shipskartUserId, pushedRoleId: existing.pushedRoleId ?? null },
        sailRole,
      );
      if (drift.status === 'role_updated') reason = 'already_pushed_role_updated';
    } catch (err: any) {
      console.warn(`[Shipskart JIT] role-drift check failed for ${userUuid} (user is still in; sweep retries): ${err?.message || err}`);
    }
    return { pushed: true, reason };
  }
  // A duplicate block cannot be resolved from here — Shipskart has no lookup endpoint, so
  // retrying would fail forever. Leave it for the console/human.
  if (existing?.pushStatus === 'blocked_duplicate') {
    return { pushed: false, reason: 'blocked_duplicate' };
  }
  const attempts = jitAttempts.get(userUuid) ?? 0;
  if (attempts >= JIT_MAX_ATTEMPTS) {
    return { pushed: false, reason: `jit_attempt_cap_reached (${attempts}) — the reconciler keeps retrying durably` };
  }
  jitAttempts.set(userUuid, attempts + 1);

  const db = await getDb();
  const rows = await db.select({
    id: masterUsers.id, fullName: masterUsers.fullName, email: masterUsers.email,
    role: masterUsers.role, designation: masterUsers.designation,
  }).from(masterUsers).where(eq(masterUsers.id, userUuid)).limit(1);

  // A user who has never been through sync-masters has no master_users row. Fall back to
  // the identity we do have (uuid + the role the request carries) rather than refusing:
  // email is the only hard requirement on Shipskart's side.
  const mu = rows[0];
  if (!mu) {
    await b2bRepo.upsertUserLink(userUuid, {
      pushStatus: 'no_master_row',
      lastError: 'no master_users row — run Admin → sync-masters so this user can be pushed',
    });
    return { pushed: false, reason: 'no_master_row' };
  }

  const push = await pushUser({ ...mu, role: mu.role ?? sailRole ?? null });
  if (push.status !== 'pushed' && push.status !== 'already_pushed') {
    return { pushed: false, reason: push.status };
  }
  jitAttempts.delete(userUuid);

  // Best-effort mappings for this user's ACTIVE assignments (capture-at-login fills them).
  const mappings: Record<string, number> = {};
  try {
    const vesselIds = await b2bRepo.getActiveVesselIdsForUser(userUuid);
    for (const vesselId of vesselIds) {
      const m = await mapUserToVessel(userUuid, vesselId, { userFullName: mu.fullName });
      tally(mappings, m.status);
    }
  } catch (err: any) {
    console.warn(`[Shipskart JIT] mapping sweep failed for ${userUuid} (user is still in; reconciler will retry): ${err?.message || err}`);
  }
  return { pushed: true, reason: 'pushed_jit', mappings };
}

// ── the sweep ──

export interface ReconcileSummary {
  ran: boolean;
  reason?: string;
  vessels: Record<string, number>;
  users: Record<string, number>;
  mappings: Record<string, number>;
}

/**
 * One bounded reconciliation pass. Never throws mid-sweep — every per-record failure is
 * recorded on its link row and counted in the summary.
 */
export async function runReconciliation(opts: { limit?: number } = {}): Promise<ReconcileSummary> {
  const limit = Math.max(1, Math.min(200, opts.limit ?? DEFAULT_BATCH_LIMIT));
  const summary: ReconcileSummary = { ran: false, vessels: {}, users: {}, mappings: {} };

  if (await isShipInstance()) {
    summary.reason = 'ship instance — the reconciler is shore-only';
    return summary;
  }
  const cfg = getB2bConfig();
  const tenant = await b2bRepo.getTenantConfig(cfg.tenantId);
  if (!tenant?.reconcilerEnabled) {
    summary.reason = 'reconciler_enabled is false for this tenant (default) — enable it in shipskart_tenant_config to start pushing';
    return summary;
  }
  summary.ran = true;
  const db = await getDb();

  // 1. Vessels without a successful link.
  const pushedVessels = await db.select({ v: shipskartVesselLinks.vesselVuuid })
    .from(shipskartVesselLinks).where(eq(shipskartVesselLinks.pushStatus, 'pushed'));
  const pushedVesselSet = new Set(pushedVessels.map((r) => r.v));
  const vesselRows = await db.select({
    vuuid: vessels.vuuid, name: vessels.name, imoNumber: vessels.imoNumber, vesselType: vessels.vesselType,
  }).from(vessels).where(eq(vessels.isActive, true));
  for (const v of vesselRows.filter((r) => !pushedVesselSet.has(r.vuuid)).slice(0, limit)) {
    const st = (await pushVessel(v)).status;
    tally(summary.vessels, st);
    if (API_HIT_STATUSES.has(st)) await paceB2b();
  }

  // 2. Users without a successful link (role-mapped only — pushUser enforces it).
  const pushedUsers = await db.select({ u: shipskartUserLinks.userUuid })
    .from(shipskartUserLinks).where(eq(shipskartUserLinks.pushStatus, 'pushed'));
  const pushedUserSet = new Set(pushedUsers.map((r) => r.u));
  const userRows = await db.select({
    id: masterUsers.id, fullName: masterUsers.fullName, email: masterUsers.email,
    role: masterUsers.role, designation: masterUsers.designation,
  }).from(masterUsers).where(eq(masterUsers.isDeleted, false));
  for (const mu of userRows.filter((r) => !pushedUserSet.has(r.id)).slice(0, limit)) {
    const st = (await pushUser(mu)).status;
    tally(summary.users, st);
    if (API_HIT_STATUSES.has(st)) await paceB2b();
  }

  // 2b. Role drift for already-pushed users (their 03-Aug update endpoints). pushUser
  // routes a pushed link through syncRoleIfDrifted — a free local comparison unless the
  // SAILERP role actually changed (or the pre-mig-153 stamp is missing), so this pass
  // normally makes zero API calls. 'already_pushed' is not tallied to keep the summary
  // signal-only.
  for (const mu of userRows.filter((r) => pushedUserSet.has(r.id)).slice(0, limit)) {
    const st = (await pushUser(mu)).status;
    if (st !== 'already_pushed') tally(summary.users, st);
    if (API_HIT_STATUSES.has(st)) await paceB2b();
  }

  // 3. Assignments not yet mapped whose both ends might now be pushed.
  const pendingAssignments = await db.select().from(masterUserVessels)
    .where(and(eq(masterUserVessels.isActive, true), inArray(masterUserVessels.mapStatus, ['pending', 'awaiting_user', 'awaiting_vessel'])));
  for (const a of pendingAssignments.slice(0, limit)) {
    const st = (await mapUserToVessel(a.userUuid, a.vesselId)).status;
    tally(summary.mappings, st);
    if (API_HIT_STATUSES.has(st)) await paceB2b();
  }

  // 3b. REVOKED assignments (capture-at-login removed the vessel) — deactivate the
  // Shipskart mapping via update-vessel-user isActive:false. A revoked row that never
  // reached Shipskart has nothing to undo remotely → closed out locally as 'unmapped'.
  const revokedAssignments = await db.select().from(masterUserVessels)
    .where(and(eq(masterUserVessels.isActive, false), eq(masterUserVessels.mapStatus, 'revoked')));
  for (const a of revokedAssignments.slice(0, limit)) {
    if (!a.shipskartMappingId) {
      await b2bRepo.upsertAssignment(a.userUuid, a.vesselId, { mapStatus: 'unmapped', lastError: null });
      tally(summary.mappings, 'unmapped_local_only');
      continue;
    }
    const st = (await updateVesselUserMapping(
      { userUuid: a.userUuid, vesselId: a.vesselId, shipskartMappingId: a.shipskartMappingId }, false)).status;
    tally(summary.mappings, st);
    if (API_HIT_STATUSES.has(st)) await paceB2b();
  }

  console.log(`[Shipskart b2b] reconciliation pass: vessels=${JSON.stringify(summary.vessels)} users=${JSON.stringify(summary.users)} mappings=${JSON.stringify(summary.mappings)}`);
  return summary;
}
