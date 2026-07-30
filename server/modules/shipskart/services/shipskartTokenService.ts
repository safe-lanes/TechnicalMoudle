/**
 * Shipskart b2b token manager.
 *
 * STORAGE SPLIT (approved design): bootstrap SEED credentials (username/password) live in
 * env; the ROTATING pair (access + refresh token, expiries) lives in shipskart_tenant_config
 * so it survives restarts. One row per tenant.
 *
 * BOOTSTRAP is a deliberate manual step: tenant-login-api sends an OTP to the API user's
 * registered EMAIL (UAT uses a static OTP, settable via SHIPSKART_B2B_BOOTSTRAP_OTP).
 * Production re-bootstrap is therefore a human procedure — documented, never silently
 * required: when the ~90-day refresh token nears expiry this service logs a LOUD countdown
 * (14d warn / 3d error) instead of dying quietly.
 *
 * OPEN ITEM (flagged, not solved): whether the refresh token self-renews on refresh is
 * unknown — UAT returns the SAME refreshToken with an unchanged expiry, which suggests it
 * does NOT. Both behaviours work here: we always persist whatever the refresh response
 * returns (rotated or not).
 *
 * Response-shape quirk (proven): auth-token returns the access token as `token`, refresh
 * returns it as `accessToken`. Both read.
 */
import { getB2bConfig, signedB2bRequest, type B2bResponse } from './shipskartB2bClient';
import * as b2bRepo from '../repositories/shipskartB2bRepository';

const REFRESH_SKEW_MS = 2 * 60 * 1000;      // refresh when <2 min of access validity left
const WARN_14D_MS = 14 * 24 * 60 * 60 * 1000;
const WARN_3D_MS = 3 * 24 * 60 * 60 * 1000;

/** Single-flight: concurrent callers share one in-flight refresh per process. */
let refreshInFlight: Promise<string> | null = null;

function parseDate(v: unknown): Date | null {
  if (!v || typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function warnOnRefreshExpiry(refreshExpiresAt: Date | null): void {
  if (!refreshExpiresAt) return;
  const left = refreshExpiresAt.getTime() - Date.now();
  if (left < WARN_3D_MS) {
    console.error(`[Shipskart b2b] 🔴 refresh token expires ${refreshExpiresAt.toISOString()} (<3 days) — MANUAL RE-BOOTSTRAP REQUIRED SOON (POST /shipskart/b2b/bootstrap with the emailed OTP).`);
  } else if (left < WARN_14D_MS) {
    console.warn(`[Shipskart b2b] ⚠️ refresh token expires ${refreshExpiresAt.toISOString()} (<14 days) — plan the manual re-bootstrap.`);
  }
}

/**
 * One-time (per ~90 days) manual bootstrap: login (sends OTP) → auth-token(OTP) → persist
 * the rotating pair. `otp` falls back to SHIPSKART_B2B_BOOTSTRAP_OTP (UAT static).
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
    throw Object.assign(new Error('[Shipskart b2b] No refresh token stored — bootstrap required (POST /shipskart/b2b/bootstrap)'), { statusCode: 503 });
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

/** Valid access token from DB state; auto-refresh (single-flight) when near expiry. */
export async function getAccessToken(): Promise<string> {
  const cfg = getB2bConfig();
  const row = await b2bRepo.getTenantConfig(cfg.tenantId);
  if (!row?.accessToken) {
    throw Object.assign(new Error('[Shipskart b2b] Not bootstrapped for this tenant — run POST /shipskart/b2b/bootstrap once'), { statusCode: 503 });
  }
  warnOnRefreshExpiry(row.refreshExpiresAt ?? null);
  const expiresSoon = !row.accessExpiresAt || row.accessExpiresAt.getTime() - Date.now() < REFRESH_SKEW_MS;
  if (!expiresSoon) return row.accessToken;
  if (!refreshInFlight) {
    refreshInFlight = refreshNow().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

/**
 * Authorized b2b call: bearer attached, and on a 401 exactly ONE forced refresh + retry,
 * then fail loud. This is the function everything above the transport uses.
 */
export async function authorizedB2bRequest(
  method: 'GET' | 'POST',
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
  return {
    tenantId: cfg.tenantId,
    bootstrapped: !!row?.refreshToken,
    accessExpiresAt: row?.accessExpiresAt?.toISOString() ?? null,
    refreshExpiresAt: row?.refreshExpiresAt?.toISOString() ?? null,
    lastBootstrapAt: row?.lastBootstrapAt?.toISOString() ?? null,
    reconcilerEnabled: row?.reconcilerEnabled ?? false,
  };
}
