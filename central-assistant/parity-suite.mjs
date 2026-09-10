/**
 * Stage 3 parity + acceptance harness (CHATBOT-IMPLEMENTATION-PLAN.md Stage 3).
 *
 * SCOPE-ENFORCEMENT PARITY IS BY CONSTRUCTION AND THEN PROVEN: the Data API's
 * execute dispatches to the SAME executeTool function object the embedded bot
 * runs — this suite proves the wrapper preserves the outcomes verbatim (the
 * exact refusal strings the old bot produces) and that the auth wrapper rejects
 * what it must. Old-path END-TO-END LLM runs on the pilot are blocked (the old
 * bot hardcodes gpt-4o, which the authorized key's allow-list refuses, and the
 * pilot has no other key) — reported to the owner as a decision, not worked
 * around here.
 *
 *   env: MODULE_URL (default http://localhost:5000/technical/api)
 *        CENTRAL_URL (default http://127.0.0.1:8013)
 *        SERVICE_SECRET, IDENTITY_SIGNING_KEY, ADMIN_TOKEN
 */
import { signIdentity } from './identity.mjs';

const MODULE_URL = process.env.MODULE_URL || 'http://localhost:5000/technical/api';
const CENTRAL_URL = process.env.CENTRAL_URL || 'http://127.0.0.1:8013';
const SECRET = process.env.SERVICE_SECRET || 'local-pilot-assistant-secret';
const KEY = process.env.IDENTITY_SIGNING_KEY || 'local-pilot-signing-key-stage3';

const OFFICE = { userId: 'p3-office', userName: 'P3 Office', role: 'Sail Admin', tenantDomain: 'parity-tenant' };
const mint = (idn, ttl = 60) => signIdentity(idn, KEY, ttl);

let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${String(detail).slice(0, 90)}` : ''}`); };

const exec = (tool, args, { token, secret } = {}) =>
  fetch(`${MODULE_URL}/assistant/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret === null ? {} : { 'x-service-secret': secret ?? SECRET }),
      ...(token === null ? {} : { 'x-assistant-identity': token ?? mint(OFFICE) }),
    },
    body: JSON.stringify({ tool, args, requestId: `parity-${Date.now()}` }),
  });

const centralChat = (message, idn, extra = {}) =>
  fetch(`${CENTRAL_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-assistant-identity': mint(idn) },
    body: JSON.stringify({ message, context: { module: 'technical' }, ...extra }),
  }).then((r) => r.json());

// ── A. Data API acceptance (auth wrapper) ──
console.log('── A. Data API acceptance ──');
{
  const m = await fetch(`${MODULE_URL}/assistant/manifest`, { headers: { 'x-service-secret': SECRET } }).then((r) => r.json());
  check('manifest: apiVersion 1, module technical, 30 tools', m.apiVersion === 1 && m.module === 'technical' && m.tools?.length === 30);
  check('manifest without secret → 401', (await fetch(`${MODULE_URL}/assistant/manifest`)).status === 401);
  check('execute without secret → 401', (await exec('get_fleet_overview', {}, { secret: null })).status === 401);
  check('execute without identity → 401', (await exec('get_fleet_overview', {}, { token: null })).status === 401);
  const good = mint(OFFICE);
  const tampered = good.slice(0, good.lastIndexOf('.') - 3) + 'AAA' + good.slice(good.lastIndexOf('.'));
  check('tampered identity → 401', (await exec('get_fleet_overview', {}, { token: tampered })).status === 401);
  check('expired identity (beyond leeway) → 401', (await exec('get_fleet_overview', {}, { token: mint(OFFICE, -300) })).status === 401);
  const unk = await (await exec('drop_all_tables', {})).json();
  check('unknown tool → ok:false as data', unk.ok === false, unk.error);
}

// ── B. Scope-enforcement parity (verbatim old-bot outcomes through the wrapper) ──
console.log('\n── B. Scope-enforcement parity (same executeTool, outcomes verbatim) ──');
const fleet = await (await exec('get_fleet_overview', {})).json();
check('Office: fleet overview allowed', fleet.ok === true && Array.isArray(fleet.data?.vessels ?? fleet.data), JSON.stringify(fleet).slice(0, 60));
const vessels = fleet.data?.vessels || fleet.data || [];
const v1 = vessels[0]?.vessel_id || vessels[0]?.id || vessels[0]?.vuuid;
const v2 = vessels[1]?.vessel_id || vessels[1]?.id || vessels[1]?.vuuid;
check('two vessels available for cross-vessel test', !!v1 && !!v2, `${v1} / ${v2}`);
const SHIP = { userId: 'p3-ship', userName: 'P3 Ship', role: 'Ship', vesselId: v1, tenantDomain: 'parity-tenant' };

const shipFleet = await (await exec('get_fleet_overview', {}, { token: mint(SHIP) })).json();
check('Ship: fleet overview REFUSED, old-bot verbatim text', shipFleet.ok === false && /Fleet-wide data isn't available for your role/.test(shipFleet.error), shipFleet.error);
const cross = await (await exec('get_work_orders', { vesselId: v2 }, { token: mint(SHIP) })).json();
check("Ship: other vessel REFUSED, old-bot verbatim text", cross.ok === false && /You don't have access to vessel/.test(cross.error), cross.error);
const own = await (await exec('get_work_orders', { vesselId: v1 }, { token: mint(SHIP) })).json();
check('Ship: own vessel ALLOWED', own.ok === true);
const officeCross = await (await exec('get_work_orders', { vesselId: v2 })).json();
check('Office: any vessel allowed', officeCross.ok === true);

// ── C. Determinism / substance (R7: same call, same answer) ──
console.log('\n── C. Tool-output determinism ──');
for (const [tool, args] of [['get_work_order_counts', { vesselId: v1 }], ['get_low_stock_spares', { vesselId: v1 }], ['get_components', { vesselId: v1 }]]) {
  const a = await (await exec(tool, args)).json();
  const b = await (await exec(tool, args)).json();
  check(`${tool}: ok + identical on repeat`, a.ok === true && JSON.stringify(a.data) === JSON.stringify(b.data));
}

// ── D. Mint contract (req.rbac, refuse mock) ──
console.log('\n── D. Mint contract ──');
{
  const noRbac = await fetch(`${MODULE_URL}/assistant/token`, { headers: { 'x-user-id': 'p3-x' } });
  check('mint WITHOUT forwarded role → 403 refused (rbac source none)', noRbac.status === 403, (await noRbac.json()).error);
  const withRbac = await fetch(`${MODULE_URL}/assistant/token`, {
    headers: { 'x-user-id': 'p3-office', 'x-user-name': 'P3', 'x-user-role': 'Sail Admin', 'x-user-type': 'Office' },
  });
  const tk = await withRbac.json();
  check('mint WITH forwarded role → signed token', withRbac.status === 200 && typeof tk.token === 'string' && tk.token.includes('.'));
  if (tk.token) {
    const used = await (await exec('get_work_order_counts', { vesselId: v1 }, { token: tk.token })).json();
    check('module-minted token accepted end-to-end', used.ok === true);
  }
}

// ── E. Central path end-to-end (tool loop, budgets, forwarded identity) ──
console.log('\n── E. Central path end-to-end ──');
{
  const j = await centralChat('how many vessels are in the fleet and what are their names?', OFFICE);
  check('central data answer via tool loop', j.gate === 'answer' && (j.toolsUsed || []).includes('get_fleet_overview'), `tools=${(j.toolsUsed || []).join(',')}`);
  const wo = await centralChat(`how many overdue work orders are there on vessel ${vessels[0]?.vessel_name || v1}?`, OFFICE);
  check('central WO data answer uses a WO tool', wo.gate === 'answer' && (wo.toolsUsed || []).some((t) => /work_order|overdue/.test(t)), `tools=${(wo.toolsUsed || []).join(',')}`);
  const howto = await centralChat('how do I create a work order?', OFFICE);
  check('central how-to uses search_module_docs + cites Source', (howto.toolsUsed || []).includes('search_module_docs') && /Source:/i.test(howto.response || ''), `tools=${(howto.toolsUsed || []).join(',')}`);
  const shipRefusal = await centralChat('show me the fleet overview', SHIP);
  check('central relays Ship fleet refusal politely (no data leak)', shipRefusal.gate === 'answer' && !/vessel_id/.test(shipRefusal.response || '') && /(not|isn't|unable|cannot|can't).*(available|access|allowed|permission)/i.test(shipRefusal.response || ''), (shipRefusal.response || '').slice(0, 80));
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
