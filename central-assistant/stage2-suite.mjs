/**
 * Stage 2 proof suite (CHATBOT-IMPLEMENTATION-PLAN.md Stage 2):
 *   1. unsigned / tampered / expired identity → 401
 *   2. new client×module pair auto-registers (default ON) + admin notification recorded
 *   3. kill switch off → clean "not enabled" AND ZERO LLM calls (llmCalls delta = 0)
 *   4. matrix fail-closed stays off until re-enabled
 *   5. one conversation log row per turn
 *   6. rate limit fires on request MAX+1
 *   7. rating endpoint stores a row
 *
 *   IDENTITY_SIGNING_KEY=... ADMIN_TOKEN=... node stage2-suite.mjs [serviceUrl]
 */
import { signIdentity } from './identity.mjs';

const BASE = process.argv[2] || 'http://127.0.0.1:8112';
const KEY = process.env.IDENTITY_SIGNING_KEY;
const ADMIN = process.env.ADMIN_TOKEN;
if (!KEY || !ADMIN) { console.error('IDENTITY_SIGNING_KEY and ADMIN_TOKEN required'); process.exit(1); }

const TENANT = `stage2-test-${Date.now()}`;
const USER = { userId: `s2-user-${Date.now()}`, userName: 'Stage2 Suite', role: 'Sail Admin', tenantDomain: TENANT };
const token = () => signIdentity(USER, KEY, 60);

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const chat = (opts = {}) =>
  fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(opts.token === null ? {} : { 'x-assistant-identity': opts.token ?? token() }) },
    body: JSON.stringify({ message: opts.message || 'how do I create a work order', routeOnly: opts.routeOnly !== false, context: { module: opts.module || 'technical' } }),
  });
const admin = (path, body) =>
  fetch(`${BASE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN },
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => r.json());
const llmCount = async () => (await fetch(`${BASE}/health`).then((r) => r.json())).llmCalls;
const convCount = async () => (await admin('/admin/conversations/count')).count;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 1. identity gates ──
console.log('── 1. Signed identity (§5.3) ──');
check('unsigned identity → 401', (await chat({ token: null })).status === 401);
const good = token();
const tampered = good.slice(0, good.lastIndexOf('.') - 3) + 'AAA' + good.slice(good.lastIndexOf('.'));
check('tampered identity → 401', (await chat({ token: tampered })).status === 401);
const expired = signIdentity(USER, KEY, -300); // beyond the 90s clock-skew leeway
check('expired identity → 401', (await chat({ token: expired })).status === 401);
const wrongKey = signIdentity(USER, 'not-the-real-key', 60);
check('wrong-key signature → 401', (await chat({ token: wrongKey })).status === 401);

// ── 2. self-registration + notification ──
console.log('\n── 2. Self-registration (§4.1, default ON + notification) ──');
const first = await chat({});
check('first interaction answers (pair default ON)', first.status === 200 && (await first.json()).gate === 'answer');
await sleep(600);
const pairs = await admin('/admin/pairs');
const pair = pairs.find((p) => p.tenant_domain === TENANT && p.module === 'technical');
check('pair auto-registered', !!pair, pair ? `enabled=${pair.enabled}, first_seen=${pair.first_seen}` : 'row missing');
check('pair default ENABLED', pair?.enabled === true);
const notes = await admin('/admin/notifications');
const note = notes.find((n) => n.payload?.tenantDomain === TENANT);
check('admin notification recorded', !!note, note ? `delivered=${note.delivered} (${(note.delivery_detail || '').slice(0, 60)})` : 'missing');

// ── 3+4. kill switch fail-closed, zero LLM ──
console.log('\n── 3. Kill switch (fail-closed, zero LLM calls) ──');
await admin('/admin/pairs/toggle', { tenantDomain: TENANT, module: 'technical', enabled: false });
const before = await llmCount();
const off = await (await chat({})).json();
const after = await llmCount();
check('disabled pair → clean "not enabled"', off.gate === 'disabled', off.response?.slice(0, 60));
check('disabled path made ZERO LLM calls', after - before === 0, `llmCalls delta=${after - before}`);
const offAgain = await (await chat({})).json();
check('stays off until re-enabled (fail-closed)', offAgain.gate === 'disabled');
await admin('/admin/pairs/toggle', { tenantDomain: TENANT, module: 'technical', enabled: true });
check('re-enabled → answers again', (await (await chat({})).json()).gate === 'answer');

// ── 5. conversation log ──
console.log('\n── 4. Conversation log (a row per turn) ──');
await sleep(2500); // let prior sections' fire-and-forget rows land before baselining
const c0 = await convCount();
await chat({ message: 'how do I report a near miss', module: 'incident' });
await chat({ message: 'what is the weather today' });
await sleep(2500);
const c1 = await convCount();
check('one log row per turn (2 turns → +2)', c1 - c0 === 2, `delta=${c1 - c0}`);

// ── 6. rate limit ──
console.log('\n── 5. Rate limit (ported Stage A) ──');
const rlUser = { ...USER, userId: `s2-rl-${Date.now()}` };
// Concurrent burst (sequential calls can outlast the 60s sliding window — the
// limiter is per-window by design; a real spam burst is concurrent).
const burst = await Promise.all(Array.from({ length: 35 }, () => chat({ token: signIdentity(rlUser, KEY, 60) }).then((r) => r.json())));
const limited = burst.filter((b) => b.gate === 'rate_limited').length;
check('burst of 35 → exactly 5 rate-limited (30 allowed)', limited === 5, `limited=${limited}`);

// ── 7. rating ──
console.log('\n── 6. Rating ──');
const rate = await fetch(`${BASE}/rate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-assistant-identity': token() },
  body: JSON.stringify({ conversationId: 'suite-conv-1', rating: 1, note: 'stage2 suite' }),
});
check('rating stored', rate.status === 200);

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
