/**
 * IDENTITY GUARD — is this request carrying a REAL forwarded user identity?
 *
 * WHY THIS EXISTS (found 2026-07-30, hole closed before the WK trial):
 * `mockAuthMiddleware` sets `req.user.userUuid = fwdId || '00000000-0000-0000-0000-000000000001'`.
 * So `req.user.userUuid` is NEVER null — a request with no `x-user-id` header silently
 * carries the SHARED DEFAULT uuid. Keying per-user Shipskart SSO on that value would map
 * EVERY un-identified user onto ONE Shipskart account: exactly the silent account-sharing
 * we removed the shared-account fallback to prevent, just arriving through the new path.
 *
 * So: per-user decisions must read the FORWARDED HEADER, not the resolved mock user.
 * No header → no identity → the caller REFUSES the request with a clear reason (the
 * shared-account fallback is retired) instead of pretending the default uuid is a person.
 *
 * The header is set client-side by `activeRank.ts`'s interceptor from `setActiveIdentity`
 * (AuthContext, after the encrypted userProfile is decrypted). It is therefore MISSING
 * whenever: the deployment is not identity-integrated with SAILERP, the profile could not
 * be decrypted, the logged-in user has no id in the profile, or a caller bypasses the
 * interceptor (curl/Postman/a server-to-server call).
 *
 * GREPPABLE TAG: every "running without identity integration" event logs the exact string
 *   [Shipskart][IDENTITY-MISSING]
 * which appears nowhere else, so `grep "IDENTITY-MISSING"` on a shore log answers
 * "is this deployment wired for per-user Purchasing?" in one command.
 */
import type { Request } from 'express';

/** The mock-auth default. A request resolving to this had NO forwarded identity. */
export const MOCK_DEFAULT_USER_UUID = '00000000-0000-0000-0000-000000000001';

export const IDENTITY_MISSING_TAG = '[Shipskart][IDENTITY-MISSING]';

let warnedThisProcess = false;

/**
 * The forwarded user uuid, or NULL when the request carries no identity.
 * Never falls back to the mock default — that is the whole point.
 *
 * @param context short label for the log line (e.g. 'sso/initiate')
 */
export function forwardedUserUuid(req: Request, context: string): string | null {
  const raw = req.headers['x-user-id'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  let decoded: string | null = null;
  if (typeof value === 'string' && value.trim()) {
    try { decoded = decodeURIComponent(value).trim() || null; } catch { decoded = value.trim(); }
  }

  if (!decoded) {
    // Loud once per process (a per-request line would flood), then quiet but still visible
    // at debug level via the tag on the caller's own fallback log.
    if (!warnedThisProcess) {
      warnedThisProcess = true;
      console.warn(
        `${IDENTITY_MISSING_TAG} ${context}: request arrived with NO x-user-id header. This shore is ` +
        `NOT identity-integrated, so per-user Purchasing accounts cannot be used and the request is ` +
        `REFUSED (the legacy shared-account fallback is retired). If this is any production shore, ` +
        `FIX THE INTEGRATION — until then every affected user is blocked from Purchasing with an ` +
        `identity-missing reason. (This warning prints once per process.)`,
      );
    } else {
      console.warn(`${IDENTITY_MISSING_TAG} ${context}: no x-user-id header (see the first occurrence for detail).`);
    }
    return null;
  }

  if (decoded === MOCK_DEFAULT_USER_UUID) {
    // The header was present but carries the mock default — same danger, different route.
    console.warn(
      `${IDENTITY_MISSING_TAG} ${context}: x-user-id is the MOCK DEFAULT uuid (${MOCK_DEFAULT_USER_UUID}). ` +
      `Treating as no identity so users cannot silently share one Shipskart account. Real identities ` +
      `must come from the SAILERP profile.`,
    );
    return null;
  }
  return decoded;
}

/**
 * Boot-time note (shore only). Cannot prove the header will arrive — that is per-request —
 * but it states the dependency and names the tag to grep for, so a misconfigured shore is
 * discovered from the log rather than from a mis-attributed requisition.
 */
export function logIdentityIntegrationExpectation(): void {
  console.log(
    `[Shipskart][IDENTITY] Per-user Purchasing SSO requires the x-user-id header forwarded by the ` +
    `frontend (SAILERP profile). Any request without it is REFUSED with an identity-missing reason and ` +
    `logs "${IDENTITY_MISSING_TAG}" — grep that tag to confirm this deployment is identity-integrated.`,
  );
}
