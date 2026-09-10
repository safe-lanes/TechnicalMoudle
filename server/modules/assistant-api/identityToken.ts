/**
 * Signed forwarded-identity token — module-side twin of central-assistant/identity.mjs
 * (CHATBOT-CENTRAL-SERVICE-PLAN.md §5.3). Same wire format, same rules:
 * token = b64url(JSON payload) + "." + b64url(HMAC-SHA256(payloadB64, key)).
 *
 * Clock-skew leeway (default 90 s, both directions) is REQUIRED: mint and verify run
 * on different machines — measured 62 s skew between the AI server and the build
 * workstation, and clock mismatch has caused real incidents in this fleet before.
 */
import { createHmac, timingSafeEqual } from 'crypto';

const CLOCK_LEEWAY_SEC = parseInt(process.env.IDENTITY_CLOCK_LEEWAY_SEC || '90', 10);

export interface ForwardedIdentity {
  userId: string;
  userName?: string;
  role: string;
  vesselId?: string | null;
  tenantDomain?: string | null;
  tuid?: string | null;
  iat?: number;
  exp?: number;
}

export function signIdentity(identity: Omit<ForwardedIdentity, 'iat' | 'exp'>, key: string, ttlSec = 60): string {
  if (!key) throw new Error('signing key required');
  const now = Math.floor(Date.now() / 1000);
  const payload = { ...identity, iat: now, exp: now + ttlSec };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', key).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export type VerifyResult =
  | { ok: true; identity: ForwardedIdentity }
  | { ok: false; reason: 'missing' | 'malformed' | 'bad-signature' | 'expired' | 'future-dated' };

export function verifyIdentity(token: unknown, key: string): VerifyResult {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'missing' };
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return { ok: false, reason: 'malformed' };
  const body = token.slice(0, dot);
  const expected = createHmac('sha256', key).update(body).digest();
  let given: Buffer;
  try {
    given = Buffer.from(token.slice(dot + 1), 'base64url');
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'bad-signature' };
  }
  let identity: ForwardedIdentity;
  try {
    identity = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const now = Math.floor(Date.now() / 1000);
  if (!identity.exp || identity.exp + CLOCK_LEEWAY_SEC < now) return { ok: false, reason: 'expired' };
  if (identity.iat && identity.iat - CLOCK_LEEWAY_SEC > now) return { ok: false, reason: 'future-dated' };
  if (!identity.userId || !identity.role) return { ok: false, reason: 'malformed' };
  return { ok: true, identity };
}
