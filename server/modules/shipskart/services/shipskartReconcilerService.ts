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

export async function pushUser(mu: {
  id: string; fullName: string; email: string | null; role: string | null; designation: string | null;
}): Promise<PushResult> {
  const existing = await b2bRepo.getUserLink(mu.id);
  if (existing?.pushStatus === 'pushed' && existing.shipskartUserId) {
    return { status: 'already_pushed', shipskartId: existing.shipskartUserId };
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
    await b2bRepo.upsertUserLink(mu.id, { shipskartUserId: shipskartId, pushStatus: 'pushed', lastError: null });
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

// ── the sweep ──

export interface ReconcileSummary {
  ran: boolean;
  reason?: string;
  vessels: Record<string, number>;
  users: Record<string, number>;
  mappings: Record<string, number>;
}

const tally = (acc: Record<string, number>, s: string) => { acc[s] = (acc[s] || 0) + 1; return acc; };

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
    tally(summary.vessels, (await pushVessel(v)).status);
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
    tally(summary.users, (await pushUser(mu)).status);
  }

  // 3. Assignments not yet mapped whose both ends might now be pushed.
  const pendingAssignments = await db.select().from(masterUserVessels)
    .where(and(eq(masterUserVessels.isActive, true), inArray(masterUserVessels.mapStatus, ['pending', 'awaiting_user', 'awaiting_vessel'])));
  for (const a of pendingAssignments.slice(0, limit)) {
    tally(summary.mappings, (await mapUserToVessel(a.userUuid, a.vesselId)).status);
  }

  console.log(`[Shipskart b2b] reconciliation pass: vessels=${JSON.stringify(summary.vessels)} users=${JSON.stringify(summary.users)} mappings=${JSON.stringify(summary.mappings)}`);
  return summary;
}
