/**
 * Shipskart b2b integration — low-level signed HTTP client.
 *
 * SEPARATE from shipskartSsoService's signedPost (body-only HMAC for the legacy
 * /api/v1/sso/* endpoints — untouched). The b2b /integration/SAIL/* endpoints use the
 * 4-part signature: `{ts}\n{METHOD}\n{path}\n{rawBody}`, HMAC-SHA256(clientSecret),
 * "sha256=" prefix, plus X-Api-Key / X-Timestamp (epoch seconds) / X-Nonce (GUID) /
 * x-tenant-id headers.
 *
 * SIGNING RULE (proven on UAT 2026-07-30, A/B on the same request): the deployed verifier
 * signs the PATH ONLY — the query string is EXCLUDED, contradicting Shipskart's own Postman
 * script and PDF (which say path+query). We build on what is deployed, behind a switch:
 * set SHIPSKART_B2B_SIGN_QUERY=true to include the query string if/when their verifier
 * changes. One env line to flip for production parity.
 *
 * TENANT ID GOES IN THE HEADER ONLY (Sachin, 30-Jul): this client THROWS if a request body
 * carries a top-level `tenantId` (or `data.tenantId`) so no call can regress.
 * ⚠️ OPEN ITEM, not a solved cause: UAT currently resolves SSO with AND without body
 * tenantId — removing it was not what fixed SSO (something changed on Shipskart's side);
 * production parity unverified. The header-only rule is their instruction, enforced here.
 *
 * Bootstrap endpoints ALSO require the full signature set (proven: dropping only
 * X-Signature → 401 SIGNATURE_MISSING "Sign every request with your client secret",
 * contradicting Sachin's emailed answer) — so this client signs everything.
 */
import crypto from 'crypto';

const REQUEST_TIMEOUT_MS = 30_000;

export interface B2bConfig {
  baseUrl: string;
  apiKey: string;
  clientSecret: string;
  tenantId: string;
  bootstrapUserName: string | null;
  bootstrapPassword: string | null;
  bootstrapOtp: string | null; // UAT static OTP only; production OTP arrives by email
  signQuery: boolean;
}

export function getB2bConfig(): B2bConfig {
  const baseUrl = (process.env.SHIPSKART_B2B_BASE_URL || '').replace(/\/+$/, '');
  const apiKey = process.env.SHIPSKART_B2B_API_KEY || '';
  const clientSecret = process.env.SHIPSKART_B2B_CLIENT_SECRET || '';
  const tenantId = process.env.SHIPSKART_B2B_TENANT_ID || '';
  if (!baseUrl || !apiKey || !clientSecret || !tenantId) {
    throw Object.assign(
      new Error('[Shipskart b2b] Missing SHIPSKART_B2B_BASE_URL / _API_KEY / _CLIENT_SECRET / _TENANT_ID env'),
      { statusCode: 503 },
    );
  }
  return {
    baseUrl, apiKey, clientSecret, tenantId,
    bootstrapUserName: process.env.SHIPSKART_B2B_BOOTSTRAP_USERNAME || null,
    bootstrapPassword: process.env.SHIPSKART_B2B_BOOTSTRAP_PASSWORD || null,
    bootstrapOtp: process.env.SHIPSKART_B2B_BOOTSTRAP_OTP || null,
    signQuery: (process.env.SHIPSKART_B2B_SIGN_QUERY || '').toLowerCase() === 'true',
  };
}

export interface B2bResponse {
  status: number;
  ok: boolean;
  json: any;
  /** first 300 chars of a non-JSON body, for error reporting */
  text?: string;
}

function assertNoTenantInBody(body: unknown): void {
  if (body && typeof body === 'object') {
    const b = body as Record<string, any>;
    if ('tenantId' in b || (b.data && typeof b.data === 'object' && 'tenantId' in b.data)) {
      throw new Error(
        '[Shipskart b2b] tenantId must NEVER be in a request body — it travels in the x-tenant-id header only (Sachin, 2026-07-30). Remove it from the payload.',
      );
    }
  }
}

/**
 * One signed request. `bearer` is passed by the caller (the token service owns tokens —
 * this layer deliberately knows nothing about them, which keeps the dependency one-way).
 */
export async function signedB2bRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  pathAndQuery: string,
  opts: { body?: unknown; bearer?: string } = {},
): Promise<B2bResponse> {
  const cfg = getB2bConfig();
  assertNoTenantInBody(opts.body);

  // Serialize ONCE and sign that exact string (same discipline as the SSO client).
  const raw = opts.body === undefined ? '' : JSON.stringify(opts.body);
  const ts = Math.floor(Date.now() / 1000).toString();
  const signedPath = cfg.signQuery ? pathAndQuery : pathAndQuery.split('?')[0];
  const signature = 'sha256=' + crypto
    .createHmac('sha256', cfg.clientSecret)
    .update(`${ts}\n${method}\n${signedPath}\n${raw}`, 'utf8')
    .digest('hex');

  const headers: Record<string, string> = {
    'X-Api-Key': cfg.apiKey,
    'X-Timestamp': ts,
    'X-Nonce': crypto.randomUUID(),
    'X-Signature': signature,
    'x-tenant-id': cfg.tenantId,
  };
  if (opts.bearer) headers['Authorization'] = `Bearer ${opts.bearer}`;
  // PUT added 2026-08-04: their updated collection signs AND sends the body on PUT
  // (earlier UAT rejected PUT bodies with a signature mismatch — contract now fixed).
  // DELETE added 2026-08-05: their delete-vessel-user curl sends --data '{}', so DELETE
  // carries an (empty-object) body and signs it like any non-GET — proven live on UAT.
  if (method !== 'GET') headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${cfg.baseUrl}${pathAndQuery}`, {
      method,
      headers,
      body: method !== 'GET' ? raw : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err: any) {
    const code = err?.cause?.code ? ` (${err.cause.code})` : '';
    throw new Error(`[Shipskart b2b] Network error calling ${pathAndQuery}${code}: ${err?.message || err}`);
  }

  const text = await response.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: response.status, ok: response.ok, json, text: json ? undefined : text.slice(0, 300) };
}
