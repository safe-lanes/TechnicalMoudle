/**
 * Shipskart SSO Service — stateless backend caller for Shipskart's
 * ticket-based SSO (Purchasing module integration).
 *
 * We hold NO state: no DB tables, no session storage. Shipskart owns the
 * one-time SSO code, the 8-hour JWT, and session lifecycle. We only sign
 * and forward requests.
 *
 * Endpoints (per SafeLane_SSO_INTEGRATION_GUIDE.pdf):
 *   POST {base}/api/v1/sso/initiate  — headers X-Api-Key + X-Signature
 *   POST {base}/api/v1/sso/logout    — headers X-Api-Key + X-Signature
 * (/sso/consume is called by the Flutter app inside the iframe, NOT here.)
 *
 * Signing (Section 8): X-Signature = lowercase hex HMAC-SHA256 of the EXACT
 * raw JSON body bytes sent over the wire. We serialize ONCE into `raw`, sign
 * `raw`, then send `raw` as the fetch body — never re-serialize.
 */

import crypto from 'crypto';
import { AppError } from '../../shared/errors';
import * as roleMappingRepo from '../repositories/shipskartRoleMappingRepository';

const REQUEST_TIMEOUT_MS = 15_000;

// ── Config (cached getter, fail-fast, no fallback values) ──
// Mirrors the pattern in server/config/externalApi.ts. Reads process.env
// directly — no dotenv loading (env is CLI-prefixed per CLAUDE.md).

interface ShipskartConfig {
  baseUrl: string;
  apiKey: string;
  hmacSecret: string;
  tenantId: string;
}

/**
 * Thrown when the current user's role has no Shipskart externalUserId mapping.
 * The controller catches this specifically and returns 403 ROLE_NOT_MAPPED so
 * the frontend can show "Purchasing is not available for your role".
 */
export class ShipskartRoleNotMappedError extends Error {
  constructor(public readonly userRole: string) {
    super(`No Shipskart externalUserId mapping for role "${userRole || '(none)'}".`);
    this.name = 'ShipskartRoleNotMappedError';
  }
}

/**
 * Thrown when the user's role IS mapped but their OWN Shipskart account cannot be created
 * or resolved. The controller returns 409 USER_NOT_PROVISIONED so Purchasing shows a clear
 * "not available yet, contact your administrator" screen.
 *
 * DELIBERATELY NOT a shared-account fallback (Ghazi, 2026-07-30): the shared per-role
 * account is being retired, and on the WK trial a VISIBLE failure beats users quietly
 * sharing one Shipskart identity — a shared session would attribute one user's
 * requisitions to another and make the audit trail meaningless.
 */
export class ShipskartUserNotProvisionedError extends Error {
  constructor(public readonly userUuid: string, public readonly reason: string) {
    super(`Shipskart account not provisioned for user ${userUuid}: ${reason}`);
    this.name = 'ShipskartUserNotProvisionedError';
  }
}

let _cachedConfig: ShipskartConfig | null = null;

function getShipskartConfig(): ShipskartConfig {
  if (_cachedConfig !== null) return _cachedConfig;

  const baseUrl = process.env.SHIPSKART_SSO_BASE_URL;
  const apiKey = process.env.SHIPSKART_API_KEY;
  const hmacSecret = process.env.SHIPSKART_HMAC_SECRET;
  const tenantId = process.env.SHIPSKART_TENANT_ID;

  const missing: string[] = [];
  if (!baseUrl) missing.push('SHIPSKART_SSO_BASE_URL');
  if (!apiKey) missing.push('SHIPSKART_API_KEY');
  if (!hmacSecret) missing.push('SHIPSKART_HMAC_SECRET');
  if (!tenantId) missing.push('SHIPSKART_TENANT_ID');

  // At least one Shipskart-role ACCOUNT must be configured (new role-named vars or their
  // legacy SAIL-role-named aliases), otherwise every mapped user would still be blocked.
  const hasAnyRoleMapping = !!(
    process.env.SHIPSKART_USER_CAPTAIN || process.env.SHIPSKART_USER_VESSEL_ADMIN ||
    process.env.SHIPSKART_USER_PURCHASER || process.env.SHIPSKART_USER_ADMIN ||
    process.env.SHIPSKART_USER_MANAGER || process.env.SHIPSKART_USER_REGULAR
  );
  if (!hasAnyRoleMapping) {
    missing.push('at least one SHIPSKART_USER_* account (CAPTAIN/PURCHASER/MANAGER or legacy VESSEL_ADMIN/ADMIN/REGULAR)');
  }

  if (missing.length > 0) {
    throw new AppError(
      503,
      `[Shipskart] Missing required environment variables: ${missing.join(', ')}. ` +
        `Set them before using the Purchasing SSO integration.`,
    );
  }

  _cachedConfig = {
    baseUrl: baseUrl!.replace(/\/+$/, ''),
    apiKey: apiKey!,
    hmacSecret: hmacSecret!,
    tenantId: tenantId!,
  };

  console.log('[Shipskart] SSO config loaded (base host masked):', maskUrl(_cachedConfig.baseUrl));
  return _cachedConfig;
}

function maskUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.substring(0, 30) + '...';
  }
}

/**
 * Compute the X-Signature: lowercase hex HMAC-SHA256 over the EXACT raw
 * JSON string that will be sent as the request body.
 *
 * @param raw  the exact body string (already serialized) that goes on the wire
 */
export function computeHmacSignature(raw: string, hmacSecret: string): string {
  return crypto.createHmac('sha256', hmacSecret).update(raw, 'utf8').digest('hex');
}

/** Shared signed POST helper. Serializes body ONCE, signs that exact string. */
async function signedPost(path: string, body: Record<string, unknown>): Promise<any> {
  const cfg = getShipskartConfig();

  // ADJ-5: serialize exactly once; sign the same string we send.
  const raw = JSON.stringify(body);
  const signature = computeHmacSignature(raw, cfg.hmacSecret);

  const url = `${cfg.baseUrl}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': cfg.apiKey,
        'X-Signature': signature,
      },
      body: raw, // never the object — that would re-serialize and break the signature
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err: any) {
    // Network/timeout — enrich with cause.code like the sync engine does
    const code = err?.cause?.code ? ` (${err.cause.code})` : '';
    throw new AppError(502, `[Shipskart] Network error calling ${path}${code}: ${err?.message || err}`);
  }

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    // non-JSON body
  }

  if (!response.ok || (payload && payload.success === false)) {
    const errorCode = payload?.errorCode || `HTTP_${response.status}`;
    const message = payload?.message || `Shipskart ${path} failed with status ${response.status}`;
    const retryable = payload?.retryable === true;
    throw new AppError(response.status || 502, `[Shipskart] ${errorCode}: ${message}`, {
      errorCode,
      retryable,
    });
  }

  return payload;
}

/**
 * Shipskart-role → externalUserId ACCOUNT layer. This is the TEMPORARY bridge until
 * Shipskart's User Registration API gives us per-user accounts: today every user resolved
 * to the same Shipskart role shares that role's account. Reads the NEW role-named env vars
 * first (SHIPSKART_USER_CAPTAIN/PURCHASER/MANAGER) and falls back to the LEGACY SAIL-role-
 * named ones (VESSEL_ADMIN/ADMIN/REGULAR) so existing deployments keep working without an
 * .env change (the recurring re-seed gotcha).
 */
export function accountForShipskartRole(shipskartRole: string): string | null {
  const accounts: Record<string, string | undefined> = {
    captain:   process.env.SHIPSKART_USER_CAPTAIN   || process.env.SHIPSKART_USER_VESSEL_ADMIN,
    purchaser: process.env.SHIPSKART_USER_PURCHASER || process.env.SHIPSKART_USER_ADMIN,
    manager:   process.env.SHIPSKART_USER_MANAGER   || process.env.SHIPSKART_USER_REGULAR,
  };
  const exact = accounts[shipskartRole];
  if (exact) return exact;

  // LIVE ROLE NAMES (from get-all-roles, e.g. 'WAH-KWONG-PUCHASER') have no legacy env
  // account, so an admin mapping a role to a live name used to BLOCK every user who had
  // not been pushed yet — the legacy fallback silently disappeared (found by test,
  // 2026-07-30). Two escape hatches, in order:
  //   1. an explicit per-live-role env var: SHIPSKART_USER_WAH_KWONG_PUCHASER=<account>
  //   2. a logged bucket match on the role name (captain / purchaser / manager)
  // Both are TRANSITIONAL: once a user is pushed by the b2b reconciler, the per-user path
  // in resolveExternalUserId wins and this bridge is never consulted for them.
  const envKey = `SHIPSKART_USER_${shipskartRole.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
  const explicit = process.env[envKey];
  if (explicit) return explicit;

  const upper = shipskartRole.toUpperCase();
  const bucket = /CAPTAIN|MASTER/.test(upper) ? 'captain'
    : /PURCHAS|PUCHAS|BUYER/.test(upper) ? 'purchaser'      // 'PUCHASER' matches their live typo
    : /MANAGER|SUPER/.test(upper) ? 'manager'
    : null;
  if (bucket && accounts[bucket]) {
    console.warn(
      `[Shipskart] Live role '${shipskartRole}' has no account env; using the '${bucket}' shared account ` +
      `as a TRANSITIONAL fallback for users not yet pushed to Shipskart. Set ${envKey} to be explicit.`,
    );
    return accounts[bucket]!;
  }
  return null;
}

/**
 * Resolve the Shipskart externalUserId for one of our roles.
 *
 * Two layers (both many-to-one friendly):
 *   1. SAIL role → Shipskart role: the UI-CONFIGURABLE shipskart_role_mappings table
 *      (per-tenant via db-per-tenant; replaces the old hardcoded roleMap — admins edit it
 *      under Admin → Access Control). Many SAIL roles may map to the same Shipskart role.
 *      This table will also serve the future user-registration push (role assignment at
 *      user creation, once Shipskart's Registration API lands).
 *   2. Shipskart role → account: accountForShipskartRole() env bridge (see above).
 *
 * Returns null when the role has no mapping row OR the mapped Shipskart role has no
 * account configured → caller blocks with ROLE_NOT_MAPPED (block-not-default by design:
 * never silently grant Purchasing to an unmapped role).
 *
 * For dev testing on this codebase, temporarily change mockAuthMiddleware
 * (server/middleware/auth.ts) to return a mapped role instead of "Sail Admin" —
 * or simply add a 'Sail Admin' mapping row via the Access Control UI.
 */
export async function resolveExternalUserId(userRole: string, userUuid?: string | null): Promise<string | null> {
  // LAYER 0 (per-user, preferred): if this user has been pushed to Shipskart by the b2b
  // reconciler, their externalUserId IS our own uuid — proven on UAT 2026-07-30: SSO
  // initiate resolves on that value and the session carries THAT user's identity, not a
  // shared role account. Checked FIRST so per-user sessions win as soon as a user is pushed.
  //
  // The legacy shared-account bridge below remains the fallback for users not yet pushed,
  // so a partially-migrated fleet keeps working. It retires when every user is pushed
  // (decision deferred until after the WK trial).
  if (userUuid) {
    const { getUserLink } = await import('../repositories/shipskartB2bRepository');
    let link: Awaited<ReturnType<typeof getUserLink>>;
    let lookupError: string | null = null;
    try {
      link = await getUserLink(userUuid);
    } catch (err: any) {
      lookupError = `link lookup failed: ${err?.message || err}`;
      link = undefined;
    }

    // JIT: not pushed yet → try once, here and now, so new joiners / role changes / users
    // the reconciler has not reached resolve on their FIRST click (no cutover day).
    // Opt-out via SHIPSKART_B2B_JIT=false.
    let jitReason: string | null = null;
    if (!lookupError && link?.pushStatus !== 'pushed' && (process.env.SHIPSKART_B2B_JIT || '').toLowerCase() !== 'false') {
      try {
        const { ensureUserPushed } = await import('./shipskartReconcilerService');
        const jit = await ensureUserPushed(userUuid, userRole || null);
        jitReason = jit.reason;
        if (jit.pushed) {
          link = await getUserLink(userUuid);
        }
      } catch (err: any) {
        jitReason = `jit threw: ${err?.message || err}`;
      }
    }

    if (link?.pushStatus === 'pushed') return userUuid;

    // ── NO SHARED-ACCOUNT FALLBACK for an identified user ──
    // The shared per-role account is being retired. A user whose role IS mapped but whose
    // OWN account cannot be created/resolved is BLOCKED with a clear message rather than
    // silently dropped into a shared identity (Ghazi, 2026-07-30). The link row already
    // carries the machine-readable status + the raw upstream error, so the reconciler
    // retries it durably and the admin console shows WHY.
    const mappingForUser = userRole ? await roleMappingRepo.getMappingForSailRole(userRole) : undefined;
    if (mappingForUser) {
      const reason = lookupError
        ?? jitReason
        ?? (link ? `link status '${link.pushStatus}'${link.lastError ? `: ${link.lastError}` : ''}` : 'no link row yet');
      console.warn(
        `[Shipskart] BLOCKING Purchasing for user ${userUuid} (role '${userRole}' is mapped to ` +
        `'${mappingForUser.shipskartRole}') — own Shipskart account not provisioned: ${reason}. ` +
        `No shared-account fallback by design; the reconciler will retry.`,
      );
      // Make sure the reason is DURABLE. pushUser/ensureUserPushed already record their own
      // specific statuses (unmapped_role / missing_email / blocked_duplicate / error /
      // no_master_row) — do not overwrite those. Only fill the gaps: no row at all, or a
      // failure that happened before any push was attempted (lookup error / JIT threw).
      if (!link || lookupError || (jitReason ?? '').startsWith('jit threw')) {
        try {
          const { upsertUserLink } = await import('../repositories/shipskartB2bRepository');
          await upsertUserLink(userUuid, { pushStatus: 'jit_failed', lastError: reason.slice(0, 400) });
        } catch (writeErr: any) {
          console.warn(`[Shipskart] could not record the block reason for ${userUuid}: ${writeErr?.message || writeErr}`);
        }
      }
      throw new ShipskartUserNotProvisionedError(userUuid, reason);
    }
    // No role mapping at all → the existing ROLE_NOT_MAPPED path below (null return).
  }

  // LEGACY shared-account bridge — reached ONLY when NO user uuid was forwarded, i.e. a
  // deployment that is not identity-integrated (no x-user-id). Kept in place, unused on
  // integrated deployments; deletion is a post-trial decision.
  if (!userRole) return null;
  const mapping = await roleMappingRepo.getMappingForSailRole(userRole);
  if (!mapping) return null;
  console.warn(
    `[Shipskart] No forwarded user identity (x-user-id) — using the LEGACY shared '${mapping.shipskartRole}' ` +
    `account for role '${userRole}'. Per-user SSO requires the identity header.`,
  );
  const account = accountForShipskartRole(mapping.shipskartRole);
  if (!account) {
    console.warn(
      `[Shipskart] Role '${userRole}' maps to '${mapping.shipskartRole}' but no account env is set ` +
      `(SHIPSKART_USER_${mapping.shipskartRole.toUpperCase()} or its legacy alias) — blocking SSO.`,
    );
    return null;
  }
  return account;
}

/**
 * POST /api/v1/sso/initiate — backend only.
 * Returns { success, ssoCode, expiresIn, partnerName, iframeUrl }.
 * The iframeUrl is fully-formed (code + partner embedded) — the caller must
 * use it as-is and must NOT reconstruct it.
 *
 * @param userRole  the current user's role; resolved to an externalUserId via
 *                  the per-role map. Unmapped roles throw ShipskartRoleNotMappedError.
 * @param userUuid  the current user's uuid (x-user-id / req.user.userUuid). When this user
 *                  has been pushed by the b2b reconciler, the PER-USER path is taken: the
 *                  uuid itself is the externalUserId and initiate goes through the b2b
 *                  endpoint (that is the tenant the user lives in). Otherwise the legacy
 *                  shared-account bridge is used, unchanged.
 *
 * SECURITY: never log the returned ssoCode.
 */
export async function initiateSso(userRole: string, userUuid?: string | null): Promise<{
  success: boolean;
  ssoCode: string;
  expiresIn: number;
  partnerName: string;
  iframeUrl: string;
}> {
  const externalUserId = await resolveExternalUserId(userRole, userUuid);
  if (externalUserId === null) {
    throw new ShipskartRoleNotMappedError(userRole);
  }

  // PER-USER path: externalUserId === our own uuid means the b2b link exists, so initiate
  // must go to the b2b tenant/endpoint. tenantId travels in the x-tenant-id HEADER only
  // (Sachin, 2026-07-30) — the b2b client enforces that and rejects it in a body.
  if (userUuid && externalUserId === userUuid) {
    const { signedB2bRequest } = await import('./shipskartB2bClient');
    const res = await signedB2bRequest('POST', '/integration/SAIL/sso/initiate', { body: { externalUserId } });
    if (!res.ok || !res.json?.iframeUrl) {
      const errorCode = res.json?.errorCode || res.json?.error?.code || `HTTP_${res.status}`;
      throw new AppError(res.status || 502, `[Shipskart] per-user SSO initiate failed (${errorCode})`, { errorCode });
    }
    console.log(`[Shipskart] SSO initiate OK — PER-USER (role=${userRole}, partner=${res.json.partnerName}, expiresIn=${res.json.expiresIn}s)`);
    return res.json;
  }

  // LEGACY path (user not pushed yet): shared per-role account, tenantId in the body as
  // that older endpoint expects. Retires when every user is pushed.
  const cfg = getShipskartConfig();
  const body = {
    externalUserId,
    tenantId: cfg.tenantId,
  };

  const result = await signedPost('/api/v1/sso/initiate', body);
  console.log(
    `[Shipskart] SSO initiate OK — legacy shared account (role=${userRole}, partner=${result?.partnerName}, expiresIn=${result?.expiresIn}s)`,
  ); // intentionally NOT logging ssoCode or externalUserId
  return result;
}

/**
 * POST /api/v1/sso/logout — backend only. Idempotent (200 even with no
 * active sessions). Callers should wrap in try/catch and never block the
 * user's local logout if this fails.
 *
 * @param userRole  the current user's role. If unmapped, this is a NO-OP
 *                  (returns without calling Shipskart and without throwing) —
 *                  local logout must always complete.
 */
export async function logoutSso(userRole: string, userUuid?: string | null): Promise<{ success: boolean; message?: string }> {
  // A non-provisioned user never had a session — resolving must not throw out of logout,
  // which is best-effort by contract and must never block the local logout.
  let externalUserId: string | null;
  try {
    externalUserId = await resolveExternalUserId(userRole, userUuid);
  } catch (err: any) {
    return { success: true, message: `No Shipskart session to evict (${err?.name || 'resolve failed'})` };
  }
  if (externalUserId === null) {
    // Unmapped role never had a Shipskart session — nothing to evict.
    return { success: true, message: 'No Shipskart mapping for role — logout skipped' };
  }
  // Per-user sessions were opened through the b2b endpoint; evict them there. Callers
  // already treat logout as best-effort (never blocks local logout).
  if (userUuid && externalUserId === userUuid) {
    const { signedB2bRequest } = await import('./shipskartB2bClient');
    const res = await signedB2bRequest('POST', '/integration/SAIL/sso/logout', { body: { externalUserId } });
    console.log(`[Shipskart] SSO logout (per-user) → ${res.status}`);
    return { success: res.ok, message: res.ok ? undefined : `remote status ${res.status}` };
  }
  const body = { externalUserId };
  const result = await signedPost('/api/v1/sso/logout', body);
  console.log('[Shipskart] SSO logout OK');
  return result;
}
