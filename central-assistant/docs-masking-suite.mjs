/**
 * Docs-only path masking proof (owner ask, 11-Sep-2026): the Stage 5 claim was narrower
 * than it read — the Node service masked the EMBEDDING input on the docs path but sent
 * the RAW question to the chat completion. This suite proves, on captured wire bodies,
 * that the Python service masks BOTH on the docs-only path (no module Data API involved):
 *
 *   1. a docs question naming the context vessel and the caller → gate=answer
 *   2. the captured /v1/embeddings body contains no real name, and a token
 *   3. the captured /v1/chat/completions body contains no real name, and a token
 *   4. the user still sees the real name in the answer (un-masked on the way back)
 *
 *   IDENTITY_SIGNING_KEY=... node docs-masking-suite.mjs <serviceUrl> <capture.jsonl>
 * Run against an instance started with ASSISTANT_CAPTURE_OUTBOUND and NO module API.
 */
import { readFileSync } from 'node:fs';
import { signIdentity } from './identity.mjs';

const BASE = process.argv[2] || 'http://127.0.0.1:8016';
const CAPTURE = process.argv[3];
const KEY = process.env.IDENTITY_SIGNING_KEY;
if (!KEY || !CAPTURE) { console.error('IDENTITY_SIGNING_KEY and <capture.jsonl> required'); process.exit(1); }

const VESSEL = 'Gas Mia';
const PERSON = 'Rahul Singh';
const IDN = { userId: 'docs-mask', userName: PERSON, role: 'Sail Admin', tenantDomain: 'smoke-suite-tenant' };

let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${String(detail).slice(0, 100)}` : ''}`); };

const before = readFileSync(CAPTURE, 'utf8').split('\n').filter(Boolean).length;
const r = await fetch(`${BASE}/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-assistant-identity': signIdentity(IDN, KEY, 60) },
  body: JSON.stringify({
    message: `How do I create a work order on ${VESSEL}? ${PERSON} asked me to do it.`,
    context: { module: 'incident', vesselName: VESSEL },   // a module WITHOUT a Data API → docs-only path
  }),
}).then((x) => x.json());
check('docs-only question answered (gate=answer, no tools)', r.gate === 'answer' && !(r.toolsUsed || []).length, `gate=${r.gate}`);
check('user sees the REAL vessel name in the answer (un-masked inbound)', (r.response || '').includes(VESSEL), (r.response || '').slice(0, 80));

await new Promise((s) => setTimeout(s, 500));
const lines = readFileSync(CAPTURE, 'utf8').split('\n').filter(Boolean).slice(before).map((l) => JSON.parse(l));
const emb = lines.filter((l) => l.url.includes('/embeddings'));
const chat = lines.filter((l) => l.url.includes('/chat/completions'));
check('exactly one embeddings call + one chat call captured for this turn', emb.length === 1 && chat.length === 1, `emb=${emb.length} chat=${chat.length}`);
const leak = (b) => (b.includes(VESSEL) ? ` ${VESSEL}` : '') + (b.includes(PERSON) ? ` ${PERSON}` : '');
const tok = (b) => (b.match(/\[(VESSEL|PERSON|IMO|ID)_\d+\]/g) || []).length;
for (const e of emb) check('EMBEDDING input masked (no real name, token present)', !leak(e.body) && tok(e.body) > 0, `leaks:${leak(e.body) || ' none'} tokens=${tok(e.body)}`);
for (const c of chat) check('CHAT question masked (no real name, token present) — the Stage 5 gap, closed', !leak(c.body) && tok(c.body) > 0, `leaks:${leak(c.body) || ' none'} tokens=${tok(c.body)}`);

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
