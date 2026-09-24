/**
 * Signed forwarded identity — §5.3 of CHATBOT-CENTRAL-SERVICE-PLAN.md, built day one.
 *
 * Token = b64url(JSON payload) + "." + b64url(HMAC-SHA256(payloadB64, key)).
 * Payload: { userId, userName, role, vesselId?, tenantDomain, tuid?, iat, exp }.
 * TTL is short (default 60 s) — the token is a per-request assertion, not a session.
 *
 * PRODUCTION MINT CONTRACT (Stage 4, module-side — recorded here so it cannot drift):
 * the mint endpoint lives in the MODULE backend and MUST source the role from the
 * module's REAL resolved identity — `req.rbac` (the forwarded SAILERP role) — NEVER
 * from the mock `req.user.role` fallback in middleware/auth.ts. A token minted from
 * the mock would launder its over-permission behind a valid signature. A mint request
 * whose rbac source is "none" must be refused, not defaulted.
 *
 * Stage 2 provides mint only as a local test utility (mint-token.mjs) plus this
 * library; the service itself only VERIFIES.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Mint and verify run on DIFFERENT machines (module backend vs central service) —
 *  bounded clock-skew leeway is required, PROVEN on the pilot: the AI server runs
 *  62 s ahead of the build workstation, making 60 s tokens expired-on-arrival.
 *  Leeway bounds BOTH directions: expiry gets grace, and a token future-dated
 *  beyond the leeway is rejected (anti-pre-mint). */
const CLOCK_LEEWAY_SEC = parseInt(process.env.IDENTITY_CLOCK_LEEWAY_SEC || '90', 10);

const b64url = (buf) => Buffer.from(buf).toString('base64url');

export function signIdentity(identity, key, ttlSec = 60) {
  if (!key) throw new Error('signing key required');
  const now = Math.floor(Date.now() / 1000);
  const payload = { ...identity, iat: now, exp: now + ttlSec };
  const body = b64url(JSON.stringify(payload));
  const mac = createHmac('sha256', key).update(body).digest('base64url');
  return `${body}.${mac}`;
}

/** @returns {{ok:true, identity:object} | {ok:false, reason:'missing'|'malformed'|'bad-signature'|'expired'}} */
export function verifyIdentity(token, key) {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'missing' };
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return { ok: false, reason: 'malformed' };
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac('sha256', key).update(body).digest();
  let given;
  try {
    given = Buffer.from(mac, 'base64url');
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'bad-signature' };
  }
  let identity;
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
