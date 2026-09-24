/**
 * Assistant Data API — multi-tenant authentication matrix (TRACKED regression harness, 23-Sep-2026).
 *
 * Drives a RUNNING shore in multi-tenant mode (MASTER_DATABASE_URL + JWT_SECRET set) over real HTTP and
 * asserts the whole credential chain of CHATBOT-CENTRAL-SERVICE-PLAN §5.3 + MT Phase 2:
 *
 *   browser session (SAILERP-shaped HS256 JWT) → GET /assistant/token (mint, tenant from the JWT)
 *   → POST /assistant/execute (service secret + module-signed identity → tenant from the identity)
 *
 * What it proves: tenant/database selection, permitted vessel access, cross-tenant refusal, and rejection
 * of missing / expired / tampered credentials at BOTH hops. What it cannot prove: that a production
 * SAILERP JWT carries these claims (the JWT here is minted by the test with the pilot JWT_SECRET, as
 * scripts/verify-mt-parity.ts does) — see docs/ASSISTANT-API.md §3.
 *
 * Usage (values come from the running shore's env; never commit them):
 *   set -a; . local-test-env/.env.shore.example; set +a
 *   BASE=http://localhost:5000/technical/api DOMAIN_A=pilot DOMAIN_B=pilot-b \
 *   VESSEL=743ef9d1-841a-11ed-aa7c-7003bca91a86 EXPECT_OVERDUE=142 [SHIP_BASE=http://localhost:5100/technical/api] \
 *   npx tsx scripts/verify-assistant-multitenant-auth.ts
 */
import { createHmac } from 'crypto';
import jwt from 'jsonwebtoken';
import { signIdentity } from '../server/modules/assistant-api/identityToken';

const BASE = process.env.BASE || 'http://localhost:5000/technical/api';
const SHIP_BASE = process.env.SHIP_BASE || '';
const JWT_SECRET = process.env.JWT_SECRET || '';
const SERVICE_SECRET = process.env.ASSISTANT_SERVICE_SECRET || '';
const SIGNING_KEY = process.env.ASSISTANT_IDENTITY_SIGNING_KEY || '';
const INSTANCE_ID = process.env.ASSISTANT_INSTANCE_ID || ''; // 24-Sep-2026: tokens name their issuing instance (`iss`)
const DOMAIN_A = process.env.DOMAIN_A || 'pilot';
const DOMAIN_B = process.env.DOMAIN_B || 'pilot-b';
const VESSEL = process.env.VESSEL || '743ef9d1-841a-11ed-aa7c-7003bca91a86';
const EXPECT_OVERDUE = process.env.EXPECT_OVERDUE ? Number(process.env.EXPECT_OVERDUE) : null;

if (!JWT_SECRET || !SERVICE_SECRET || !SIGNING_KEY) {
  console.error('JWT_SECRET, ASSISTANT_SERVICE_SECRET and ASSISTANT_IDENTITY_SIGNING_KEY are required (source the shore env).');
  process.exit(2);
}

type Case = { name: string; pass: boolean; got: string };
const results: Case[] = [];
function record(name: string, pass: boolean, got: string) {
  results.push({ name, pass, got });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  → ${got}`);
}

// SAILERP-shaped login token: { id, domain, userType, role } (claim names per SAILERP_JWT_USER_CLAIMS, default id,role,userType)
const sailerpJwt = (domain: string, userId: string, opts: jwt.SignOptions = {}, secret = JWT_SECRET,
                    claims: Record<string, unknown> = { role: 'Sail Admin', userType: 'Office' }) =>
  jwt.sign({ id: userId, domain, ...claims }, secret, { algorithm: 'HS256', expiresIn: '1h', ...opts });

const identityHeaders = (userId: string, role: string, type: 'Office' | 'Ship') => ({
  'x-user-id': userId, 'x-user-name': `Test ${userId}`, 'x-user-type': type, 'x-user-role': role,
});

async function call(base: string, path: string, init: RequestInit): Promise<{ status: number; body: any; text: string }> {
  const r = await fetch(base + path, init);
  const text = await r.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: r.status, body, text };
}

function decodeIdentity(token: string): any {
  const body = token.slice(0, token.lastIndexOf('.'));
  return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
}

async function mint(base: string, bearer: string | null, hdrs: Record<string, string>) {
  const headers: Record<string, string> = { ...hdrs };
  if (bearer) headers['Authorization'] = `Bearer ${bearer}`;
  return call(base, '/assistant/token', { headers });
}

async function execute(base: string, secret: string | null, identity: string | null, tool: string, args: any) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (secret !== null) headers['x-service-secret'] = secret;
  if (identity !== null) headers['x-assistant-identity'] = identity;
  return call(base, '/assistant/execute', { method: 'POST', headers, body: JSON.stringify({ tool, args }) });
}

async function main() {
  const office = identityHeaders('pilot-super-1', 'Sail Admin', 'Office');

  // ── hop 1: the mint rides the SAILERP Bearer (tenantMiddleware) ──
  let r = await mint(BASE, null, office);
  record('mint: no Bearer → 401', r.status === 401, `${r.status} ${r.body?.error ?? ''}`);
  r = await mint(BASE, sailerpJwt(DOMAIN_A, 'pilot-super-1', { expiresIn: '-1m' }), office);
  record('mint: expired JWT → 401 token_expired', r.status === 401 && r.body?.error === 'token_expired', `${r.status} ${r.body?.error ?? ''}`);
  r = await mint(BASE, sailerpJwt(DOMAIN_A, 'pilot-super-1', {}, 'not-the-secret'), office);
  record('mint: JWT signed with another secret → 401 invalid_token', r.status === 401 && r.body?.error === 'invalid_token', `${r.status} ${r.body?.error ?? ''}`);
  r = await mint(BASE, jwt.sign({ id: 1, userType: 'Office' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' }), office);
  record('mint: JWT without domain claim → 401', r.status === 401, `${r.status} ${r.body?.error ?? ''}`);
  r = await mint(BASE, sailerpJwt('no-such-tenant', 'pilot-super-1'), office);
  record('mint: unknown tenant domain → 403 invalid_tenant', r.status === 403 && r.body?.error === 'invalid_tenant', `${r.status} ${r.body?.error ?? ''}`);

  r = await mint(BASE, sailerpJwt(DOMAIN_A, 'pilot-super-1'), office);
  const tokenA: string = r.body?.token || '';
  const idA = tokenA ? decodeIdentity(tokenA) : {};
  record(`mint: valid tenant-A JWT → 200, identity.tenantDomain=${DOMAIN_A}`, r.status === 200 && idA.tenantDomain === DOMAIN_A && idA.userId === 'pilot-super-1',
    `${r.status} tenantDomain=${idA.tenantDomain} tuid=${idA.tuid} userId=${idA.userId} role=${idA.role}`);

  r = await mint(BASE, sailerpJwt(DOMAIN_B, 'pilot-b-admin'), identityHeaders('pilot-b-admin', 'Sail Admin', 'Office'));
  const tokenB: string = r.body?.token || '';
  const idB = tokenB ? decodeIdentity(tokenB) : {};
  record(`mint: valid tenant-B JWT → 200, identity.tenantDomain=${DOMAIN_B}`, r.status === 200 && idB.tenantDomain === DOMAIN_B, `${r.status} tenantDomain=${idB.tenantDomain} tuid=${idB.tuid}`);

  // ── Option A (24-Sep-2026): user identity comes from the VERIFIED token, never from browser headers ──
  r = await mint(BASE, sailerpJwt(DOMAIN_A, 'pilot-super-1'), identityHeaders('attacker-id', 'Sail Admin', 'Ship'));
  const idH = r.body?.token ? decodeIdentity(r.body.token) : {};
  record('optionA: headers claim another user id / type → token carries the JWT values (headers ignored)',
    r.status === 200 && idH.userId === 'pilot-super-1' && idH.userType === 'Office', `${r.status} userId=${idH.userId} userType=${idH.userType} role=${idH.role}`);
  r = await mint(BASE, sailerpJwt(DOMAIN_A, 'pilot-super-1'), {});
  record('optionA: no x-user-* headers at all, valid JWT → 200 (headers not needed)', r.status === 200, `${r.status}`);
  r = await mint(BASE, sailerpJwt(DOMAIN_A, 'pilot-super-1', {}, JWT_SECRET, { userType: 'Office' }), office);
  record('optionA: JWT without role claim, headers carry a role → 403, no header fallback', r.status === 403 && /missing required claim/.test(r.text) && /role/.test(r.text), `${r.status} ${r.body?.error ?? ''}`);
  r = await mint(BASE, sailerpJwt(DOMAIN_A, 'pilot-super-1', {}, JWT_SECRET, { role: 'Sail Admin' }), office);
  record('optionA: JWT without userType claim → 403', r.status === 403 && /userType/.test(r.text), `${r.status} ${r.body?.error ?? ''}`);
  r = await mint(BASE, sailerpJwt(DOMAIN_A, 'u-user-1', {}, JWT_SECRET, { role: 'User', userType: 'Office' }), identityHeaders('u-user-1', 'Sail Admin', 'Office'));
  record("optionA: verified role 'User' (header says Sail Admin) → 403 not permitted (server-enforced allow-list)", r.status === 403 && /not permitted/.test(r.text), `${r.status} ${r.body?.error ?? ''}`);

  // ── hop 2: execute = service secret + module-signed identity (tenant from the identity) ──
  r = await call(BASE, '/assistant/manifest', { headers: { 'x-service-secret': SERVICE_SECRET } });
  record('manifest: service secret → 200', r.status === 200 && Array.isArray(r.body?.tools), `${r.status} tools=${r.body?.tools?.length}`);
  r = await call(BASE, '/assistant/manifest', {});
  record('manifest: no secret → 401', r.status === 401, `${r.status}`);

  r = await execute(BASE, null, tokenA, 'get_work_order_counts', { vesselId: VESSEL });
  record('execute: no service secret → 401', r.status === 401, `${r.status} ${r.body?.message ?? r.body?.error ?? ''}`);
  r = await execute(BASE, 'wrong-secret', tokenA, 'get_work_order_counts', { vesselId: VESSEL });
  record('execute: wrong service secret → 401', r.status === 401, `${r.status}`);
  r = await execute(BASE, SERVICE_SECRET, null, 'get_work_order_counts', { vesselId: VESSEL });
  record('execute: secret but no identity → 401 missing', r.status === 401 && /missing/.test(r.text), `${r.status} ${r.body?.message ?? ''}`);

  const tampered = (() => {
    const dot = tokenA.lastIndexOf('.');
    const body = JSON.parse(Buffer.from(tokenA.slice(0, dot), 'base64url').toString('utf8'));
    body.tenantDomain = DOMAIN_B;
    return Buffer.from(JSON.stringify(body)).toString('base64url') + tokenA.slice(dot);
  })();
  r = await execute(BASE, SERVICE_SECRET, tampered, 'get_work_order_counts', { vesselId: VESSEL });
  record('execute: identity with tenantDomain flipped after signing → 401 bad-signature', r.status === 401 && /bad-signature/.test(r.text), `${r.status} ${r.body?.message ?? ''}`);

  const noDomain = signIdentity({ userId: 'pilot-super-1', role: 'Sail Admin', userType: 'Office', vesselId: null, tenantDomain: null, tuid: null, iss: INSTANCE_ID }, SIGNING_KEY, 60);
  r = await execute(BASE, SERVICE_SECRET, noDomain, 'get_work_order_counts', { vesselId: VESSEL });
  record('execute: correctly signed identity WITHOUT tenant domain → 401 invalid_identity (fail closed)', r.status === 401 && r.body?.error === 'invalid_identity', `${r.status} ${r.body?.error ?? ''}`);

  const expired = (() => {
    const now = Math.floor(Date.now() / 1000) - 3600;
    const payload = { userId: 'pilot-super-1', role: 'Sail Admin', userType: 'Office', tenantDomain: DOMAIN_A, iss: INSTANCE_ID, iat: now, exp: now + 60 };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const mac = createHmac('sha256', SIGNING_KEY).update(body).digest('base64url');
    return `${body}.${mac}`;
  })();
  r = await execute(BASE, SERVICE_SECRET, expired, 'get_work_order_counts', { vesselId: VESSEL });
  record('execute: expired identity (1 h old) → 401 expired', r.status === 401 && /expired/.test(r.text), `${r.status} ${r.body?.message ?? ''}`);

  r = await execute(BASE, SERVICE_SECRET, tokenA, 'get_work_order_counts', { vesselId: VESSEL });
  const dA = r.body?.data || {};
  record(`execute: tenant A → its own database (vessel found${EXPECT_OVERDUE != null ? `, overdue=${EXPECT_OVERDUE}` : ''})`,
    r.status === 200 && r.body?.ok === true && (EXPECT_OVERDUE == null || dA.overdue === EXPECT_OVERDUE),
    `${r.status} ok=${r.body?.ok} total=${dA.total} overdue=${dA.overdue}`);

  r = await execute(BASE, SERVICE_SECRET, tokenB, 'get_work_order_counts', { vesselId: VESSEL });
  record('execute: tenant B identity asking for tenant A\'s vessel → refused (unknown in B\'s database)',
    r.status === 200 && r.body?.ok === false && /Unknown vessel/.test(r.body?.error || ''), `${r.status} ok=${r.body?.ok} ${String(r.body?.error || '').slice(0, 70)}`);

  const shipTokenA = await mint(BASE, sailerpJwt(DOMAIN_A, 'u-vesseluser', {}, JWT_SECRET, { role: 'Vessel User', userType: 'Ship' }), identityHeaders('u-vesseluser', 'Vessel User', 'Ship'));
  record("mint: verified Ship-type 'Vessel User' → 403 (role not permitted; ship users never reach the shore assistant)", shipTokenA.status === 403, `${shipTokenA.status} ${shipTokenA.body?.error ?? ''}`);
  // the vessel-scope rule itself, exercised with a Ship-type identity signed directly (as a permitted Ship role would be)
  const shipIdentity = signIdentity({ userId: 'u-vesseluser', role: 'Vessel User', userType: 'Ship', vesselId: null, tenantDomain: DOMAIN_A, tuid: idA.tuid ?? null, iss: INSTANCE_ID }, SIGNING_KEY, 60);
  r = await execute(BASE, SERVICE_SECRET, shipIdentity, 'get_work_order_counts', { vesselId: VESSEL });
  record('execute: Ship-type identity with no assigned vessel → vessel refused', r.status === 200 && r.body?.ok === false && /access/.test(r.body?.error || ''), `${r.status} ok=${r.body?.ok} ${String(r.body?.error || '').slice(0, 60)}`);

  // ── 24-Sep-2026: the Data API accepts only tokens minted by THIS instance ──
  const otherInstance = signIdentity({ userId: 'pilot-super-1', role: 'Sail Admin', userType: 'Office', vesselId: null, tenantDomain: DOMAIN_A, tuid: idA.tuid ?? null, iss: 'technical-other' }, SIGNING_KEY, 60);
  r = await execute(BASE, SERVICE_SECRET, otherInstance, 'get_work_order_counts', { vesselId: VESSEL });
  record(`execute: correctly signed token naming another instance (iss≠${INSTANCE_ID || '-'}) → 401`, r.status === 401 && /issuer/.test(r.text), `${r.status} ${r.body?.error ?? ''}`);
  record(`mint: token carries iss=${INSTANCE_ID || '(unset)'}`, !!INSTANCE_ID && idA.iss === INSTANCE_ID, `iss=${idA.iss}`);

  // ── shore-only: the ship refuses every assistant route before any credential is read ──
  if (SHIP_BASE) {
    r = await call(SHIP_BASE, '/assistant/manifest', { headers: { 'x-service-secret': SERVICE_SECRET } });
    record('ship: manifest with the correct secret → 403 shore-only', r.status === 403, `${r.status} ${r.body?.error ?? ''}`);
    r = await execute(SHIP_BASE, SERVICE_SECRET, tokenA, 'get_work_order_counts', { vesselId: VESSEL });
    record('ship: execute with valid credentials → 403 shore-only', r.status === 403, `${r.status} ${r.body?.error ?? ''}`);
    r = await mint(SHIP_BASE, sailerpJwt(DOMAIN_A, 'pilot-super-1'), office);
    record('ship: token mint → 403 shore-only', r.status === 403, `${r.status} ${r.body?.error ?? ''}`);
  }

  // ── optional: a GENUINE SAILERP session (docs/ASSISTANT-API.md §3.3) — prints claim NAMES only, never the token ──
  const genuine = process.env.GENUINE_BEARER || '';
  if (genuine) {
    const claims = (() => { try { return JSON.parse(Buffer.from(genuine.split('.')[1], 'base64url').toString('utf8')); } catch { return null; } })();
    const names = claims ? Object.keys(claims).sort().join(',') : 'undecodable';
    const expectDomain = process.env.GENUINE_DOMAIN || '';
    r = await mint(BASE, genuine, office);
    const gid = r.body?.token ? decodeIdentity(r.body.token) : {};
    record(`genuine session: mint → 200 and tenantDomain=${expectDomain || '(any)'} [claims present: ${names}]`,
      r.status === 200 && (!expectDomain || gid.tenantDomain === expectDomain),
      `${r.status} ${r.body?.error ?? ''} tenantDomain=${gid.tenantDomain ?? '-'} has(userType)=${claims ? 'userType' in claims : '?'} has(id)=${claims ? ('id' in claims || 'userId' in claims) : '?'} has(role)=${claims ? 'role' in claims : '?'}`);
  }

  const failed = results.filter((c) => !c.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? ` — FAILED: ${failed.map((c) => c.name).join(' | ')}` : ''}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
