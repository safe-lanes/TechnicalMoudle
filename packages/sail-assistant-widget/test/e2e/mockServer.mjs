// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MOCK servers for the widget demos and browser tests. NOT the central assistant and NOT any module's real login:
//   :HOST_PORT  (default 4801) — serves the three example hosts + the SAME built widget bundle, and MOCK token endpoints
//                                 that stand in for each module's future authenticated `…/assistant/token`.
//   :ASSIST_PORT (default 4802) — a MOCK assistant on ANOTHER origin (so the browser does real CORS), speaking the
//                                 central assistant's wire contract (POST /chat, GET /suggestions, x-assistant-identity).
// Mock tokens carry "mock": true and are signed with nothing; the real assistant would reject them.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = fileURLToPath(new URL('../../', import.meta.url));
const { version } = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
const HOST_PORT = Number(process.env.HOST_PORT || 4801);
const ASSIST_PORT = Number(process.env.ASSIST_PORT || 4802);
const HOST_ORIGIN = `http://localhost:${HOST_PORT}`;

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.map': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain' };

// Static roots: the widget bundle and each example's build output (SPA fallback to its index.html).
const STATIC = [
  { prefix: `/widget/${version}/`, dir: join(pkgDir, 'dist', version), spa: false },
  { prefix: '/plain/', dir: join(pkgDir, 'examples', 'plain-html'), spa: false },
  { prefix: '/crewing/', dir: join(pkgDir, 'examples', 'crewing-react', 'dist'), spa: true },
  { prefix: '/audit-app/', dir: join(pkgDir, 'examples', 'audit-angular', 'dist', 'browser'), spa: true },
];

// ── test controls (POST /__control on the assistant port) ──
const state = { rejectNextTokens: 0, failNext: 0, delayMs: 0, chatCalls: [], suggestionCalls: [], tokenMints: [] };
function resetState() {
  Object.assign(state, { rejectNextTokens: 0, failNext: 0, delayMs: 0, chatCalls: [], suggestionCalls: [], tokenMints: [] });
}

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
// LIVE PILOT MODE (only when LIVE_SIGNING_KEY_FILE is set): the token endpoints sign REAL identity tokens with a
// PILOT-ONLY instance key read from that env file (ASSISTANT_IDENTITY_SIGNING_KEY=…, never logged), issuer LIVE_ISSUER,
// so a real central assistant pilot accepts them. The identity itself is still MOCK (no module login happened).
const LIVE = (() => {
  const f = process.env.LIVE_SIGNING_KEY_FILE;
  if (!f) return null;
  const line = readFileSync(f, 'utf8').split(/\r?\n/).find((l) => l.startsWith('ASSISTANT_IDENTITY_SIGNING_KEY='));
  const key = line ? line.slice(line.indexOf('=') + 1).split(' #')[0].trim().replace(/^"|"$/g, '') : '';
  if (!key) throw new Error('LIVE_SIGNING_KEY_FILE has no ASSISTANT_IDENTITY_SIGNING_KEY');
  return { key, iss: process.env.LIVE_ISSUER || 'technical-pilotlocal' };
})();
let badNextMints = 0;
async function hmac(body, key) {
  const { createHmac } = await import('node:crypto');
  return createHmac('sha256', key).update(body).digest('base64url');
}
async function mintMock(identity, ttl = 60) {
  const now = Math.floor(Date.now() / 1000);
  if (LIVE) {
    const { iss: _ignored, ...rest } = identity;
    const body = b64url({ ...rest, iss: LIVE.iss, iat: now, exp: now + ttl });
    if (badNextMints > 0) { badNextMints--; return `${body}.${await hmac(body, 'deliberately-wrong-key')}`; }
    return `${body}.${await hmac(body, LIVE.key)}`;
  }
  return `${b64url({ ...identity, mock: true, iat: now, exp: now + ttl })}.MOCK-UNSIGNED`;
}
function readMock(token) {
  try {
    const p = JSON.parse(Buffer.from(String(token).split('.')[0], 'base64url').toString('utf8'));
    return p && p.mock === true ? p : null;
  } catch { return null; }
}
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};
const readBody = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => r(d)); });

// ── MOCK host: static + MOCK token endpoints ──
createServer(async (req, res) => {
  const url = new URL(req.url, HOST_ORIGIN);
  if (url.pathname === '/__host-control' && req.method === 'POST') { // LIVE mode test hook: next N mints are badly signed
    const b = JSON.parse((await readBody(req)) || '{}');
    if (typeof b.badNextMints === 'number') badNextMints = b.badNextMints;
    return send(res, 200, { live: !!LIVE, badNextMints, mints: state.tokenMints.length });
  }
  // MOCK stand-ins for each module's authenticated token endpoint. The demo "login" is a mock session value the example
  // host keeps; a real endpoint verifies the module's own JWT/session on the server and reads role/tenant from it.
  const m = url.pathname.match(/^\/mock-token\/(crewing|audit|safety|incident|plain)$/);
  if (m) {
    const auth = req.headers.authorization || '';
    const session = auth.startsWith('Bearer mock-session:') ? auth.slice('Bearer mock-session:'.length) : '';
    if (!session) return send(res, 401, { error: 'not signed in (MOCK)' });
    const [userId, tenant, role] = session.split('|');
    if (role === 'NoAssistant') return send(res, 403, { error: 'role not allowed (MOCK)' });
    const token = await mintMock({ iss: `${m[1]}-mock`, userId, userName: `Mock ${userId}`, role,
      tenantDomain: LIVE ? `widget-test-${tenant}` : tenant });
    state.tokenMints.push({ module: m[1], userId, tenant });
    return send(res, 200, { token });
  }
  for (const s of STATIC) {
    if (!url.pathname.startsWith(s.prefix)) continue;
    let rel = decodeURIComponent(url.pathname.slice(s.prefix.length)) || 'index.html';
    let file = normalize(join(s.dir, rel));
    if (!file.startsWith(s.dir)) return send(res, 403, { error: 'forbidden' });
    if ((!existsSync(file) || statSync(file).isDirectory()) && s.spa) file = join(s.dir, 'index.html');
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) return send(res, 404, { error: 'not found' });
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    return res.end(readFileSync(file));
  }
  if (url.pathname === '/bare/') { // empty host page (no bundle) — live test loads the bundle from the assistant itself
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end('<!doctype html><html><head><meta charset="utf-8"><title>Bare host</title></head><body></body></html>');
  }
  if (url.pathname === '/') { res.writeHead(302, { location: '/plain/' }); return res.end(); }
  send(res, 404, { error: 'not found' });
}).listen(HOST_PORT, () => console.log(`[mock] hosts + widget ${version} + MOCK token endpoints on ${HOST_ORIGIN}`
  + (LIVE ? ` — LIVE PILOT MODE: tokens signed for issuer ${LIVE.iss} (identity is still MOCK)` : '')));

// ── MOCK assistant (other origin) ──
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'Content-Type, x-assistant-identity', 'access-control-max-age': '600' };

const SUGGESTIONS = {
  crewing: ['How do I create a new crew record?', 'How do I approve or reject a rotation plan?', 'How do I download the IMO crew list?'],
  audit: ['How do I create a new preparation?', 'How do I access Fleet Sharing?'],
  safety: ['How do I create a new MOC?', 'How do I open a new safety meeting form?'],
  incident: [],
  technical: ['How do I complete a work order?'],
};
const MODULE_LABEL = { crewing: 'Crewing', audit: 'Audit', safety: 'Safety', incident: 'Incident', technical: 'Technical' };

function answer(body) {
  const ctx = body.context || {};
  const hist = Array.isArray(body.conversationHistory) ? body.conversationHistory : [];
  const q = String(body.message || '');
  const label = MODULE_LABEL[ctx.module] || ctx.module;
  const where = `module **${ctx.module}**${ctx.vesselId ? `, vessel **${ctx.vesselName || ctx.vesselId}**` : ', no vessel'}`;
  const lastUser = [...hist].reverse().find((h) => h.role === 'user');
  if (/table/i.test(q)) {
    return { response: `MOCK answer (${where}).\n\n| Step | Screen | Action |\n|---|---|---|\n| 1 | ${label} › List | Click **+ New** |\n| 2 | Form | Fill the mandatory fields |\n| 3 | Form | Click **Save** |\n\nThat is all.`,
      gate: 'answer', module: label, citations: [{ module: ctx.module, manual: `${label} - User Manual (MOCK)`, section: '1.2 HOW TO CREATE A RECORD' }] };
  }
  if (lastUser && /^(and|what about|step|explain|then)\b/i.test(q)) {
    return { response: `MOCK follow-up (${where}) to your earlier question "${lastUser.content}" — history had ${hist.length} messages.`,
      gate: 'answer', module: label, citations: [{ module: ctx.module, manual: `${label} - User Manual (MOCK)`, section: '1.2 HOW TO CREATE A RECORD' }] };
  }
  return { response: `MOCK answer to "${q}" (${where}).\n\n1. Open the screen.\n2. Click **+ New**.\n3. Save.`, gate: 'answer', module: label,
    citations: [{ module: ctx.module, manual: `${label} - User Manual (MOCK)`, section: '1.1 OVERVIEW' }, { module: ctx.module, manual: `${label} - User Manual (MOCK)`, section: '1.1 OVERVIEW' }] };
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${ASSIST_PORT}`);
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (url.pathname === '/__control' && req.method === 'POST') {
    const b = JSON.parse((await readBody(req)) || '{}');
    if (b.reset) resetState();
    for (const k of ['rejectNextTokens', 'failNext', 'delayMs']) if (typeof b[k] === 'number') state[k] = b[k];
    return send(res, 200, state, CORS);
  }
  if (url.pathname === '/__state') return send(res, 200, state, CORS);
  if (url.pathname === '/health') return send(res, 200, { ok: true, mock: true }, CORS);

  const ident = readMock(req.headers['x-assistant-identity']);
  const expired = !ident || ident.exp < Date.now() / 1000;
  if (url.pathname === '/suggestions' && req.method === 'GET') {
    const module = String(url.searchParams.get('module') || '');
    state.suggestionCalls.push({ module, user: ident?.userId ?? null });
    if (expired) return send(res, 401, { error: 'identity rejected: expired' }, CORS);
    return send(res, 200, { module, questions: SUGGESTIONS[module] || [] }, CORS);
  }
  if (url.pathname === '/chat' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}');
    const call = { message: body.message, context: body.context, historyLength: (body.conversationHistory || []).length,
      user: ident?.userId ?? null, tenant: ident?.tenantDomain ?? null, conversationId: body.conversationId };
    state.chatCalls.push(call);
    if (state.rejectNextTokens > 0) { state.rejectNextTokens--; return send(res, 401, { error: 'identity rejected: expired' }, CORS); }
    if (expired) return send(res, 401, { error: 'identity rejected: expired' }, CORS);
    if (state.failNext > 0) { state.failNext--; return send(res, 503, { error: 'unavailable (MOCK)' }, CORS); }
    const delay = /slow/i.test(String(body.message)) ? 2500 : state.delayMs;
    if (delay) await new Promise((r) => setTimeout(r, delay));
    return send(res, 200, answer(body), CORS);
  }
  send(res, 404, { error: 'not found' }, CORS);
}).listen(ASSIST_PORT, () => console.log(`[mock] MOCK assistant on http://localhost:${ASSIST_PORT}`));
