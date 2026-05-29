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

const REQUEST_TIMEOUT_MS = 15_000;

// ── Config (cached getter, fail-fast, no fallback values) ──
// Mirrors the pattern in server/config/externalApi.ts. Reads process.env
// directly — no dotenv loading (env is CLI-prefixed per CLAUDE.md).

interface ShipskartConfig {
  baseUrl: string;
  apiKey: string;
  hmacSecret: string;
  externalUserId: string;
  tenantId: string;
}

let _cachedConfig: ShipskartConfig | null = null;

function getShipskartConfig(): ShipskartConfig {
  if (_cachedConfig !== null) return _cachedConfig;

  const baseUrl = process.env.SHIPSKART_SSO_BASE_URL;
  const apiKey = process.env.SHIPSKART_API_KEY;
  const hmacSecret = process.env.SHIPSKART_HMAC_SECRET;
  const externalUserId = process.env.SHIPSKART_EXTERNAL_USER_ID;
  const tenantId = process.env.SHIPSKART_TENANT_ID;

  const missing: string[] = [];
  if (!baseUrl) missing.push('SHIPSKART_SSO_BASE_URL');
  if (!apiKey) missing.push('SHIPSKART_API_KEY');
  if (!hmacSecret) missing.push('SHIPSKART_HMAC_SECRET');
  if (!externalUserId) missing.push('SHIPSKART_EXTERNAL_USER_ID');
  if (!tenantId) missing.push('SHIPSKART_TENANT_ID');

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
    externalUserId: externalUserId!,
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
 * POST /api/v1/sso/initiate — backend only.
 * Returns { success, ssoCode, expiresIn, partnerName, iframeUrl }.
 * The iframeUrl is fully-formed (code + partner embedded) — the caller must
 * use it as-is and must NOT reconstruct it.
 *
 * SECURITY: never log the returned ssoCode.
 */
export async function initiateSso(): Promise<{
  success: boolean;
  ssoCode: string;
  expiresIn: number;
  partnerName: string;
  iframeUrl: string;
}> {
  const cfg = getShipskartConfig();

  // externalUserId is hardcoded (via env) to a single dev user for this
  // integration; tenantId is likewise fixed for dev.
  const body = {
    externalUserId: cfg.externalUserId,
    tenantId: cfg.tenantId,
  };

  const result = await signedPost('/api/v1/sso/initiate', body);
  console.log(
    `[Shipskart] SSO initiate OK (partner=${result?.partnerName}, expiresIn=${result?.expiresIn}s)`,
  ); // intentionally NOT logging ssoCode
  return result;
}

/**
 * POST /api/v1/sso/logout — backend only. Idempotent (200 even with no
 * active sessions). Callers should wrap in try/catch and never block the
 * user's local logout if this fails.
 */
export async function logoutSso(): Promise<{ success: boolean; message?: string }> {
  const cfg = getShipskartConfig();
  const body = { externalUserId: cfg.externalUserId };
  const result = await signedPost('/api/v1/sso/logout', body);
  console.log('[Shipskart] SSO logout OK');
  return result;
}
