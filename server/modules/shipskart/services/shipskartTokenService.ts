/**
 * Shipskart b2b token manager.
 *
 * STORAGE SPLIT (approved design): bootstrap SEED credentials (username/password) live in
 * env; the ROTATING pair (access + refresh token, expiries) lives in shipskart_tenant_config
 * so it survives restarts. One row per tenant.
 *
 * BOOTSTRAP IS AUTOMATIC (Sachin, 2026-07-31: the OTP is STATIC in production too), so no
 * human is needed anywhere — see autoBootstrap() below for the trigger conditions and the
 * account-lockout guard.
 *
 * SETTLED, was an open item: the refresh token does NOT self-renew. Measured 2026-07-31 —
 * refreshing 20h after bootstrap returned the SAME refreshToken with refreshTokenExpiresAt
 * identical to the microsecond. The ~90-day clock therefore runs from bootstrap regardless
 * of use, which is exactly why auto-bootstrap exists. (We still persist whatever the
 * refresh returns, so a future rotation on their side needs no change here.)
 *
 * THE EXPIRY COUNTDOWN IS KEPT even though bootstrap is automatic: automation makes
 * failure quieter, not less likely (Ghazi). A failing auto-bootstrap is loud and greppable.
 *
 * Response-shape quirk (proven): auth-token returns the access token as `token`, refresh
 * returns it as `accessToken`. Both read.
 */
import { getB2bConfig, signedB2bRequest, type B2bResponse } from './shipskartB2bClient';
import * as b2bRepo from '../repositories/shipskartB2bRepository';

const REFRESH_SKEW_MS = 2 * 60 * 1000;      // refresh when <2 min of access validity left
const WARN_14D_MS = 14 * 24 * 60 * 60 * 1000;
const WARN_3D_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * AUTO-BOOTSTRAP (Sachin confirmed 2026-07-31: the OTP is STATIC in production too, so the
 * login+OTP exchange needs no human anywhere).
 *
 * WHY IT IS STILL NEEDED AT ALL: refreshing does NOT extend the refresh token. Proven by
 * measurement — refreshed 20h after bootstrap, `refreshTokenExpiresAt` came back identical
 * to the microsecond and the token was not rotated. So the ~90-day clock runs from
 * bootstrap regardless of use and WILL expire; we simply re-bootstrap ourselves before it
 * does, instead of paging a person.
 *
 * Re-bootstrap fires when: no token stored · the refresh token has expired · it expires
 * within AUTO_BOOTSTRAP_LEAD_MS (proactive, so it never actually lapses).
 *
 * 🔴 ACCOUNT-LOCKOUT GUARD: Shipskart's tenant-login locks the account after repeated
 * failures ("Account is locked until …" in their guide). Automation must therefore NEVER
 * retry in a tight loop: attempts are single-flight, spaced by AUTO_BOOTSTRAP_COOLDOWN_MS,
 * and every failure is logged with the greppable tag below. Ghazi's rule stands —
 * automation makes failure quieter, not less likely, so the expiry alert is kept and a
 * failed auto-bootstrap is LOUD.
 */
const AUTO_BOOTSTRAP_LEAD_MS = 7 * 24 * 60 * 60 * 1000;  // re-bootstrap a week early
const AUTO_BOOTSTRAP_COOLDOWN_MS = 15 * 60 * 1000;        // never hammer their login endpoint
export const BOOTSTRAP_FAILED_TAG = '[Shipskart][BOOTSTRAP-FAILED]';

/** Single-flight: concurrent callers share one in-flight refresh per process. */
let refreshInFlight: Promise<string> | null = null;
/** Single-flight + cooldown state for auto-bootstrap (lockout protection). */
let autoBootstrapInFlight: Promise<void> | null = null;
let lastAutoBootstrapAttempt = 0;
let consecutiveBootstrapFailures = 0;

function parseDate(v: unknown): Date | null {
  if (!v || typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function warnOnRefreshExpiry(refreshExpiresAt: Date | null): void {
  if (!refreshExpiresAt) return;
  const left = refreshExpiresAt.getTime() - Date.now();
  if (left < WARN_3D_MS) {
    console.error(`[Shipskart b2b] 🔴 refresh token expires ${refreshExpiresAt.toISOString()} (<3 days) and auto-bootstrap has NOT renewed it — check for ${BOOTSTRAP_FAILED_TAG} lines; Purchasing dies when it lapses.`);
  } else if (left < WARN_14D_MS) {
    console.warn(`[Shipskart b2b] ⚠️ refresh token expires ${refreshExpiresAt.toISOString()} (<14 days). Auto-bootstrap renews a week early — if this keeps appearing, it is failing.`);
  }
}

/**
 * The bootstrap exchange: login → auth-token(OTP) → persist the rotating pair. Called
 * automatically by autoBootstrap(); also exposed on the admin endpoint for a forced run.
 * `otp` falls back to SHIPSKART_B2B_BOOTSTRAP_OTP (static in every environment).
 */
export async function bootstrap(otp?: string): Promise<{ accessExpiresAt: string | null; refreshExpiresAt: string | null }> {
  const cfg = getB2bConfig();
  const userName = cfg.bootstrapUserName;
  const password = cfg.bootstrapPassword;
  const effectiveOtp = otp || cfg.bootstrapOtp;
  if (!userName || !password) throw Object.assign(new Error('[Shipskart b2b] SHIPSKART_B2B_BOOTSTRAP_USERNAME/_PASSWORD not configured'), { statusCode: 503 });
  if (!effectiveOtp) throw Object.assign(new Error('[Shipskart b2b] OTP required — it was emailed to the API user (UAT: set SHIPSKART_B2B_BOOTSTRAP_OTP)'), { statusCode: 400 });

  const login = await signedB2bRequest('POST', '/integration/SAIL/tenant-login-api', { body: { userName, password } });
  if (!login.ok || !login.json?.preAuthToken) {
    throw Object.assign(new Error(`[Shipskart b2b] tenant-login failed (${login.status}): ${JSON.stringify(login.json ?? login.text)?.slice(0, 200)}`), { statusCode: 502 });
  }
  const auth = await signedB2bRequest('POST', '/integration/SAIL/tenant-auth-token-api', { body: { preAuthToken: login.json.preAuthToken, otp: effectiveOtp } });
  const accessToken = auth.json?.token || auth.json?.accessToken;
  if (!auth.ok || !accessToken || !auth.json?.refreshToken) {
    throw Object.assign(new Error(`[Shipskart b2b] tenant-auth-token failed (${auth.status}): ${JSON.stringify(auth.json ?? auth.text)?.slice(0, 200)}`), { statusCode: 502 });
  }
  const accessExpiresAt = parseDate(auth.json.expiresAt);
  const refreshExpiresAt = parseDate(auth.json.refreshTokenExpiresAt);
  await b2bRepo.upsertTokenState(cfg.tenantId, {
    accessToken, refreshToken: auth.json.refreshToken, accessExpiresAt, refreshExpiresAt, isBootstrap: true,
  });
  console.log(`[Shipskart b2b] bootstrap OK — access until ${accessExpiresAt?.toISOString() ?? '?'}, refresh until ${refreshExpiresAt?.toISOString() ?? '?'}`);
  return { accessExpiresAt: accessExpiresAt?.toISOString() ?? null, refreshExpiresAt: refreshExpiresAt?.toISOString() ?? null };
}

async function refreshNow(): Promise<string> {
  const cfg = getB2bConfig();
  const row = await b2bRepo.getTenantConfig(cfg.tenantId);
  if (!row?.refreshToken) {
    throw Object.assign(new Error('[Shipskart b2b] No refresh token stored — auto-bootstrap should have run; see BOOTSTRAP-FAILED lines'), { statusCode: 503 });
  }
  const res = await signedB2bRequest('POST', '/integration/SAIL/tenant-refresh-token-api', { body: { refreshToken: row.refreshToken } });
  const accessToken = res.json?.accessToken || res.json?.token;
  if (!res.ok || !accessToken) {
    throw Object.assign(new Error(`[Shipskart b2b] token refresh failed (${res.status}): ${JSON.stringify(res.json ?? res.text)?.slice(0, 200)} — if the refresh token expired, re-bootstrap manually`), { statusCode: 502 });
  }
  const accessExpiresAt = parseDate(res.json.expiresAt);
  const refreshExpiresAt = parseDate(res.json.refreshTokenExpiresAt) ?? row.refreshExpiresAt ?? null;
  // Persist whatever came back — works whether or not their refresh token rotates.
  await b2bRepo.upsertTokenState(cfg.tenantId, {
    accessToken,
    refreshToken: res.json.refreshToken || row.refreshToken,
    accessExpiresAt, refreshExpiresAt,
  });
  warnOnRefreshExpiry(refreshExpiresAt);
  return accessToken;
}

/**
 * Harness-only: clear the auto-bootstrap cooldown so a test can exercise the expired /
 * proactive paths without waiting 15 real minutes. Never called by production code
 * (same convention as _clearRoleCache in shipskartRoleSource).
 */
export function _resetAutoBootstrapCooldownForTest(): void {
  lastAutoBootstrapAttempt = 0;
  autoBootstrapInFlight = null;
}

/** Does this tenant need a (re-)bootstrap right now? */
function needsBootstrap(row: { refreshToken?: string | null; refreshExpiresAt?: Date | null } | undefined): string | null {
  if (!row?.refreshToken) return 'no refresh token stored';
  if (!row.refreshExpiresAt) return null; // unknown expiry — leave it to the refresh call
  const left = row.refreshExpiresAt.getTime() - Date.now();
  if (left <= 0) return `refresh token expired ${row.refreshExpiresAt.toISOString()}`;
  if (left < AUTO_BOOTSTRAP_LEAD_MS) return `refresh token expires ${row.refreshExpiresAt.toISOString()} (<7 days) — renewing early`;
  return null;
}

/**
 * Re-bootstrap without a human. Single-flight + cooldown so a failing configuration can
 * never loop against their login endpoint and lock the API account.
 * Returns true if a bootstrap actually succeeded.
 */
async function autoBootstrap(reason: string): Promise<boolean> {
  const cfg = getB2bConfig();
  if (!cfg.bootstrapUserName || !cfg.bootstrapPassword || !cfg.bootstrapOtp) {
    console.error(
      `${BOOTSTRAP_FAILED_TAG} cannot auto-bootstrap (${reason}): missing ` +
      `SHIPSKART_B2B_BOOTSTRAP_USERNAME / _PASSWORD / _OTP. Purchasing will stop working when the ` +
      `current token expires. Set them, or run POST /shipskart/b2b/bootstrap manually with the OTP.`,
    );
    return false;
  }
  const sinceLast = Date.now() - lastAutoBootstrapAttempt;
  if (sinceLast < AUTO_BOOTSTRAP_COOLDOWN_MS) {
    console.warn(
      `${BOOTSTRAP_FAILED_TAG} auto-bootstrap needed (${reason}) but the last attempt was ` +
      `${Math.round(sinceLast / 1000)}s ago — waiting out the ${AUTO_BOOTSTRAP_COOLDOWN_MS / 60000}min cooldown ` +
      `so repeated failures cannot lock the Shipskart account.`,
    );
    return false;
  }
  if (autoBootstrapInFlight) { await autoBootstrapInFlight; return true; }

  lastAutoBootstrapAttempt = Date.now();
  console.warn(`[Shipskart b2b] AUTO-BOOTSTRAP starting — ${reason}. (Static OTP; no human needed, confirmed by Shipskart 2026-07-31.)`);
  autoBootstrapInFlight = bootstrap()
    .then((r) => {
      consecutiveBootstrapFailures = 0;
      console.log(`[Shipskart b2b] AUTO-BOOTSTRAP OK — refresh valid until ${r.refreshExpiresAt ?? '?'}`);
    })
    .finally(() => { autoBootstrapInFlight = null; });

  try {
    await autoBootstrapInFlight;
    return true;
  } catch (err: any) {
    consecutiveBootstrapFailures++;
    // LOUD by design: automation makes failure quieter, not less likely (Ghazi, 2026-07-31).
    console.error(
      `${BOOTSTRAP_FAILED_TAG} auto-bootstrap FAILED (attempt ${consecutiveBootstrapFailures}, ${reason}): ` +
      `${err?.message || err}. Purchasing will stop working when the current token expires — ` +
      `check the credentials and whether the Shipskart account is locked. Retrying no sooner than ` +
      `${AUTO_BOOTSTRAP_COOLDOWN_MS / 60000}min from now.`,
    );
    return false;
  }
}

export async function getAccessToken(): Promise<string> {
  const cfg = getB2bConfig();
  let row = await b2bRepo.getTenantConfig(cfg.tenantId);

  // Auto-(re)bootstrap: no token yet, expired, or within the early-renewal window. The
  // ~90-day refresh clock does NOT extend on use (measured), so this is what keeps the
  // integration alive without a person.
  const bootstrapReason = needsBootstrap(row ?? undefined);
  if (bootstrapReason) {
    if (await autoBootstrap(bootstrapReason)) {
      row = await b2bRepo.getTenantConfig(cfg.tenantId);
    }
  }

  if (!row?.accessToken) {
    throw Object.assign(
      new Error('[Shipskart b2b] No usable token for this tenant and auto-bootstrap did not succeed — see the BOOTSTRAP-FAILED log line'),
      { statusCode: 503 },
    );
  }
  // Kept deliberately even with automation in place: a visible countdown beats a silent
  // dead integration if auto-bootstrap is ever failing.
  warnOnRefreshExpiry(row.refreshExpiresAt ?? null);

  const expiresSoon = !row.accessExpiresAt || row.accessExpiresAt.getTime() - Date.now() < REFRESH_SKEW_MS;
  if (!expiresSoon) return row.accessToken;
  if (!refreshInFlight) {
    refreshInFlight = refreshNow().finally(() => { refreshInFlight = null; });
  }
  try {
    return await refreshInFlight;
  } catch (err: any) {
    // The refresh token itself was rejected (expired/revoked) — fall back to a full
    // re-bootstrap rather than failing the user's click.
    console.warn(`[Shipskart b2b] refresh failed (${err?.message || err}) — attempting auto-bootstrap`);
    if (await autoBootstrap('refresh rejected by Shipskart')) {
      const fresh = await b2bRepo.getTenantConfig(cfg.tenantId);
      if (fresh?.accessToken) return fresh.accessToken;
    }
    throw err;
  }
}

/**
 * Authorized b2b call: bearer attached, and on a 401 exactly ONE forced refresh + retry,
 * then fail loud. This is the function everything above the transport uses.
 */
export async function authorizedB2bRequest(
  method: 'GET' | 'POST' | 'PUT',
  pathAndQuery: string,
  opts: { body?: unknown } = {},
): Promise<B2bResponse> {
  const first = await signedB2bRequest(method, pathAndQuery, { ...opts, bearer: await getAccessToken() });
  if (first.status !== 401) return first;
  console.warn(`[Shipskart b2b] 401 on ${pathAndQuery} — forcing one token refresh and retrying once`);
  if (!refreshInFlight) refreshInFlight = refreshNow().finally(() => { refreshInFlight = null; });
  const fresh = await refreshInFlight;
  return signedB2bRequest(method, pathAndQuery, { ...opts, bearer: fresh });
}

/** For the status endpoint: expiries + bootstrap freshness, never the tokens themselves. */
export async function tokenStatus(): Promise<Record<string, unknown>> {
  const cfg = getB2bConfig();
  const row = await b2bRepo.getTenantConfig(cfg.tenantId);
  const daysLeft = row?.refreshExpiresAt
    ? Math.round((row.refreshExpiresAt.getTime() - Date.now()) / 86_400_000)
    : null;
  return {
    tenantId: cfg.tenantId,
    bootstrapped: !!row?.refreshToken,
    accessExpiresAt: row?.accessExpiresAt?.toISOString() ?? null,
    refreshExpiresAt: row?.refreshExpiresAt?.toISOString() ?? null,
    refreshDaysLeft: daysLeft,
    lastBootstrapAt: row?.lastBootstrapAt?.toISOString() ?? null,
    reconcilerEnabled: row?.reconcilerEnabled ?? false,
    // Auto-bootstrap health — the alert Ghazi asked to keep even with automation:
    // a non-zero failure count means the integration is heading for a silent death.
    autoBootstrap: {
      configured: !!(cfg.bootstrapUserName && cfg.bootstrapPassword && cfg.bootstrapOtp),
      consecutiveFailures: consecutiveBootstrapFailures,
      lastAttemptAt: lastAutoBootstrapAttempt ? new Date(lastAutoBootstrapAttempt).toISOString() : null,
    },
  };
}
