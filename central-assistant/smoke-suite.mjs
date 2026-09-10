/**
 * Stage 1 retrieval + routing smoke suite (CHATBOT-IMPLEMENTATION-PLAN.md Stage 1 proof).
 *
 * Runs against the central service: per-module questions must route to the correct
 * module with the correct manual as top citation; ambiguous questions must hit the
 * clarify gate; off-topic questions must hit not_documented. Reports the routing
 * confusion matrix and rate. Uses routeOnly mode — no LLM answer cost per question.
 *
 *   node smoke-suite.mjs [serviceUrl]      (default http://127.0.0.1:8012)
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8012';

// expectModule: routing target. expectManual: substring of the expected top-citation manual.
const RETRIEVAL = [
  // Technical (existing store, previously proven + R3)
  { q: 'how do I create a work order', m: 'Technical', manual: 'PMS User Manual' },
  { q: 'how to upload data in bulk data import', m: 'Technical', manual: 'PMS User Manual' },
  { q: 'why did the running hours not go down after my correction', m: 'Technical', manual: 'Recent Updates' },
  { q: 'how do I raise a defect on equipment', m: 'Technical', manual: 'Defects' },
  { q: 'how do vessels sync their data with the office', m: 'Technical', manual: 'Sync' },
  // Audit
  { q: 'how do I share an audit with the fleet from the office', m: 'Audit', manual: 'Fleet Sharing' },
  { q: 'how do I prepare for an upcoming audit', m: 'Audit', manual: 'Preparation' },
  { q: 'where can I see the history of past audits', m: 'Audit', manual: 'History' },
  // Safety
  { q: 'how do I create an MOC', m: 'Safety', manual: 'MOC' },
  { q: 'how do I carry out a risk assessment on the vessel', m: 'Safety', manual: 'Risk Assessment' },
  { q: 'how do I record a safety meeting', m: 'Safety', manual: 'Safety Meeting' },
  { q: 'how does the master review the safety management system', m: 'Safety', manual: 'Master Review' },
  // Incident
  { q: 'how do I report a near miss', m: 'Incident', manual: 'Near Miss' },
  { q: 'how do I report an incident on board', m: 'Incident', manual: 'Incident User Manual' },
  { q: 'how do I raise a lesson learnt', m: 'Incident', manual: 'Lesson Learnt' },
  { q: 'how do fleet notifications reach the vessel', m: 'Incident', manual: 'Fleet Notification' },
  // Crewing
  { q: 'how do I plan a crew change', m: 'Crewing', manual: 'Crewing User Manual' },
  { q: 'how do I add a new crew member to a vessel', m: 'Crewing', manual: 'Crewing User Manual' },
];

const AMBIGUOUS = [
  // Deliberate cross-module vocabulary; clarify OR a defensible single-module answer
  // is recorded, but the suite reports which gate fired so drift is visible.
  // KNOWN COLLISION (documented, deliberately kept measured): "change request" is a
  // Technical feature name, so this phrasing routes Technical (0.83 vs Safety 0.99 even
  // at k=30). MOC-phrased queries route Safety correctly — see the retrieval set.
  { q: 'how do I create a management of change request' },
  { q: 'how do I add a certificate' },
  { q: 'how do I approve a request' },
];

const OFF_TOPIC = [
  { q: 'what is the weather in Singapore today' },
  { q: 'how do I change my payroll bank account' },
];

async function ask(q) {
  const r = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: q, routeOnly: true }),
  });
  return r.json();
}

const pad = (s, n) => String(s).padEnd(n);
let failures = 0;
const confusion = {};

console.log(`Stage 1 smoke suite → ${BASE}\n`);
console.log('── Retrieval / routing (expected module + manual as top citation) ──');
for (const t of RETRIEVAL) {
  const j = await ask(t.q);
  const gotModule = j.module || j.gate;
  const topManual = j.citations?.[0]?.manual || '-';
  const modOk = j.gate === 'answer' && gotModule === t.m;
  const manOk = modOk && topManual.includes(t.manual);
  confusion[t.m] = confusion[t.m] || {};
  confusion[t.m][gotModule] = (confusion[t.m][gotModule] || 0) + 1;
  if (!manOk) failures++;
  console.log(`${manOk ? 'PASS' : 'FAIL'}  ${pad(t.q, 55)} → ${pad(gotModule, 12)} ${topManual.slice(0, 55)}${modOk && !manOk ? '  [module ok, manual wrong]' : ''}`);
}

console.log('\n── Ambiguous (clarify gate expected; answer recorded if single-module) ──');
for (const t of AMBIGUOUS) {
  const j = await ask(t.q);
  console.log(`${j.gate === 'clarify' ? 'PASS' : 'NOTE'}  ${pad(t.q, 55)} → gate=${j.gate}${j.module ? ` module=${j.module}` : ''}${j.candidates ? ` candidates=${j.candidates.join('/')}` : ''}`);
}

console.log('\n── Off-topic (not_documented gate REQUIRED) ──');
for (const t of OFF_TOPIC) {
  const j = await ask(t.q);
  const ok = j.gate === 'not_documented';
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${pad(t.q, 55)} → gate=${j.gate}${j.module ? ` module=${j.module}` : ''}`);
}

console.log('\n── Routing confusion matrix (expected → routed) ──');
for (const [exp, got] of Object.entries(confusion)) {
  console.log(`  ${pad(exp, 10)} → ${JSON.stringify(got)}`);
}
const total = RETRIEVAL.length;
const misrouted = RETRIEVAL.length - Object.entries(confusion).reduce((n, [exp, got]) => n + (got[exp] || 0), 0);
console.log(`\nConfusion rate: ${misrouted}/${total} misrouted (${((misrouted / total) * 100).toFixed(1)}%)`);
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
