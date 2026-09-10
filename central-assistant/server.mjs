/**
 * SAIL AI Assistant — central service.
 * Stage 1: documentation answers with §4.2 routing gates + citations.
 * Stage 2: own Postgres store (pairs matrix / conversation log / ratings /
 *          notifications), signed-identity verification (§5.3, day one),
 *          client×module self-registration default-ON with admin notification
 *          (§4.1), per-user rate limit (ported Stage A), kill switch fail-closed.
 *
 * Request flow for POST /chat (order matters — every gate before any LLM cost):
 *   verify signed identity (401 unsigned/tampered/expired)
 *   → rate limit (clean 200 message)
 *   → resolve client×module pair (first sight: register ON + notify admin)
 *   → pair disabled: clean 200 "not enabled", ZERO LLM calls
 *   → embed → route (§4.2 gates) → grounded answer with citations
 *   → fire-and-forget conversation log row.
 */
import http from 'node:http';
import { verifyIdentity } from './identity.mjs';
import { checkChatRateLimit } from './rateLimiter.mjs';
import { initSchema, pool, resolvePair, logConversation } from './db.mjs';
import { notifyNewPair } from './notify.mjs';
import { runToolLoop, manifestFor } from './toolLoop.mjs';

const PORT = parseInt(process.env.PORT || '8000', 10);
const HOST = process.env.HOST || '0.0.0.0'; // container-internal; host binding stays 127.0.0.1
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const IDENTITY_SIGNING_KEY = process.env.IDENTITY_SIGNING_KEY || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const CHROMA_URL = process.env.CHROMA_URL || 'http://technical-chromadb:8000';
const COLLECTION = process.env.CHROMA_COLLECTION || 'technical_docs';
const EMBED_MODEL = process.env.EMBED_MODEL || 'text-embedding-3-large';
const CHAT_MODEL = process.env.CHAT_MODEL || 'gpt-4o-mini';
const SIM_FLOOR = parseFloat(process.env.ROUTE_SIM_FLOOR || '1.15');
const ROUTE_MARGIN = parseFloat(process.env.ROUTE_MARGIN || '0.07');
const TOP_K = parseInt(process.env.ROUTE_TOP_K || '10', 10);
const ANSWER_CHUNKS = parseInt(process.env.ANSWER_CHUNKS || '5', 10);
const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || '30000', 10);

const MODULE_LABELS = { technical: 'Technical', audit: 'Audit', safety: 'Safety', incident: 'Incident', crewing: 'Crewing' };

/** Every OpenAI request increments this — the kill-switch proof reads its delta. */
let llmCalls = 0;

let collectionId = null;
async function chromaCollectionId() {
  if (collectionId) return collectionId;
  const r = await fetch(`${CHROMA_URL}/api/v2/tenants/default_tenant/databases/default_database/collections`);
  if (!r.ok) throw new Error(`chroma collections: HTTP ${r.status}`);
  const col = (await r.json()).find((c) => c.name === COLLECTION);
  if (!col) throw new Error(`collection '${COLLECTION}' not found`);
  collectionId = col.id;
  return collectionId;
}

/** Shared LLM chat call — counts llmCalls, honors the per-call timeout. */
async function chatCompletion(messages, tools, timeoutMs = LLM_TIMEOUT_MS) {
  llmCalls++;
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: CHAT_MODEL, temperature: 0.2, messages, ...(tools ? { tools } : {}) }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`chat: HTTP ${r.status}`);
  return r.json();
}

/** search_module_docs backing: Stage 1 retrieval reused, packaged for the tool loop. */
async function searchDocsTool(query) {
  const routed = route(await retrieve(await embed(query)));
  if (routed.gate === 'not_documented') return { documented: false, note: 'This topic is not covered in the module documentation.' };
  if (routed.gate === 'clarify') return { documented: false, ambiguous: true, candidates: routed.candidates, note: 'Ambiguous across modules — ask the user which module they mean.' };
  return {
    documented: true,
    module: MODULE_LABELS[routed.module],
    excerpts: routed.hits.map((h) => ({ manual: manualOf(h.meta), section: sectionOf(h.meta), text: h.text.slice(0, 3000) })),
  };
}

async function embed(text) {
  llmCalls++;
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`embeddings: HTTP ${r.status}`);
  return (await r.json()).data[0].embedding;
}

function moduleOf(meta) {
  if (meta?.module) return String(meta.module).toLowerCase();
  const prefix = (meta?.file || '').split(' - ')[0].trim().toLowerCase();
  return MODULE_LABELS[prefix] ? prefix : 'unknown';
}

async function retrieve(queryEmbedding) {
  const id = await chromaCollectionId();
  const r = await fetch(
    `${CHROMA_URL}/api/v2/tenants/default_tenant/databases/default_database/collections/${id}/query`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query_embeddings: [queryEmbedding], n_results: TOP_K, include: ['metadatas', 'documents', 'distances'] }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!r.ok) throw new Error(`chroma query: HTTP ${r.status}`);
  const j = await r.json();
  const metas = j.metadatas?.[0] || [];
  const docs = j.documents?.[0] || [];
  const dists = j.distances?.[0] || [];
  return metas.map((m, i) => ({ meta: m || {}, text: docs[i] || '', distance: dists[i] ?? 99, module: moduleOf(m) }));
}

function route(hits) {
  if (!hits.length || hits[0].distance > SIM_FLOOR) return { gate: 'not_documented', hits: [], confidence: 0 };
  const bestByModule = new Map();
  for (const h of hits) {
    if (h.distance <= SIM_FLOOR && (!bestByModule.has(h.module) || h.distance < bestByModule.get(h.module))) {
      bestByModule.set(h.module, h.distance);
    }
  }
  const ranked = [...bestByModule.entries()].sort((a, b) => a[1] - b[1]);
  const [topModule, topDist] = ranked[0];
  const margin = ranked.length > 1 ? ranked[1][1] - topDist : 1;
  if (margin < ROUTE_MARGIN) {
    return { gate: 'clarify', candidates: ranked.slice(0, 3).map(([m]) => MODULE_LABELS[m] || m), hits: [], confidence: margin };
  }
  return { gate: 'answer', module: topModule, hits: hits.filter((h) => h.module === topModule && h.distance <= SIM_FLOOR).slice(0, ANSWER_CHUNKS), confidence: margin };
}

const manualOf = (meta) => (meta.file || 'unknown').replace(/\.(pdf|docx|html)$/i, '');
function sectionOf(meta) {
  const parts = (meta.breadcrumb || '').split('>').map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(' > ') : parts[0] || 'Document';
}

async function answer(message, routed) {
  const context = routed.hits.map((h, i) => `[${i + 1}] (${manualOf(h.meta)} — ${sectionOf(h.meta)})\n${h.text}`).join('\n\n---\n\n');
  const system =
    `You are the SAIL Maritime PMS assistant. Answer the user's question using ONLY the manual excerpts provided. ` +
    `Rules: if the excerpts do not answer the question, say plainly that it is not covered in the ${MODULE_LABELS[routed.module]} documentation — never guess. ` +
    `Answer in short plain language, as numbered steps when the question is a how-to. ` +
    `End with a "Source:" line naming the manual and section(s) you used.`;
  llmCalls++;
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: CHAT_MODEL,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Manual excerpts:\n\n${context}\n\nQuestion: ${message}` },
      ],
    }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`chat: HTTP ${r.status}`);
  const j = await r.json();
  return { text: j.choices?.[0]?.message?.content || '', usage: j.usage || null };
}

async function handleChat(body, identity) {
  const startedAt = Date.now();
  const message = String(body?.message || '').trim();
  if (!message) return { status: 400, json: { error: 'Message is required' } };
  const uiModule = String(body?.context?.module || 'technical').toLowerCase();
  const tenantDomain = identity.tenantDomain || 'single-tenant';

  const log = (gate, answerText, extra = {}) =>
    void logConversation({
      tenantDomain, tuid: identity.tuid || null, userId: identity.userId, userName: identity.userName || null,
      userRole: identity.role, module: extra.module || uiModule, gate, question: message,
      answer: answerText, citations: extra.citations || [], confidence: extra.confidence ?? null,
      toolsUsed: extra.toolsUsed || [],
      tokensIn: extra.usage?.prompt_tokens ?? null, tokensOut: extra.usage?.completion_tokens ?? null,
      latencyMs: Date.now() - startedAt, model: extra.model || null, conversationId: body?.conversationId || null,
    }).catch((e) => console.error('[assistant] log failed (non-fatal):', e?.message || e));

  // Rate limit (Stage A port) — before any store or LLM work.
  if (!checkChatRateLimit(identity.userId).allowed) {
    const msg = "You're sending requests too quickly — please wait a moment and try again.";
    log('rate_limited', msg);
    return { status: 200, json: { response: msg, gate: 'rate_limited', citations: [] } };
  }

  // Client×module pair: self-register on first sight (default ON + admin notification);
  // fail-closed once a pair is switched off — ZERO LLM calls on the disabled path.
  const { pair, isNew } = await resolvePair(tenantDomain, identity.tuid || null, uiModule);
  if (isNew) {
    void notifyNewPair(pair).catch((e) => console.error('[assistant] notify failed (non-fatal):', e?.message || e));
  }
  if (!pair.enabled) {
    const msg = `The assistant isn't enabled for ${MODULE_LABELS[uiModule] || uiModule} in your organization. Please contact your administrator.`;
    log('disabled', msg);
    return { status: 200, json: { response: msg, gate: 'disabled', citations: [] } };
  }

  // Stage 3: when this module has a configured Data API, full answers run the ported
  // tool loop (data tools + search_module_docs). routeOnly and modules without a Data
  // API keep the Stage 1 docs-only behavior unchanged.
  if (body?.routeOnly !== true && (await manifestFor(uiModule))) {
    const identityToken = body.__identityToken;
    const result = await runToolLoop({
      message, uiModule, identityToken,
      deps: { chatCompletion, searchDocs: searchDocsTool },
    });
    log('answer', result.text, { module: uiModule, usage: result.usage, model: CHAT_MODEL, toolsUsed: result.toolsUsed });
    return { status: 200, json: { response: result.text, gate: 'answer', module: MODULE_LABELS[uiModule] || uiModule, toolsUsed: result.toolsUsed, partial: result.partial || false, usage: result.usage } };
  }

  const routed = route(await retrieve(await embed(message)));

  if (routed.gate === 'not_documented') {
    const msg = "That isn't covered in the module documentation I have. Please rephrase, or contact support if you believe it should be documented.";
    log('not_documented', msg, { confidence: routed.confidence });
    return { status: 200, json: { response: msg, gate: 'not_documented', module: null, citations: [], confidence: routed.confidence } };
  }
  if (routed.gate === 'clarify') {
    const msg = `Your question could relate to more than one module — is this about ${routed.candidates.join(' or ')}?`;
    log('clarify', msg, { confidence: routed.confidence });
    return { status: 200, json: { response: msg, gate: 'clarify', module: null, candidates: routed.candidates, citations: [], confidence: routed.confidence } };
  }
  const citations = routed.hits.map((h) => ({
    module: MODULE_LABELS[routed.module], manual: manualOf(h.meta), section: sectionOf(h.meta), distance: Number(h.distance.toFixed(4)),
  }));
  if (body?.routeOnly === true) {
    log('route_only', null, { module: routed.module, citations, confidence: routed.confidence });
    return { status: 200, json: { gate: 'answer', module: MODULE_LABELS[routed.module], confidence: Number(routed.confidence.toFixed(4)), citations, routeOnly: true } };
  }
  const a = await answer(message, routed);
  log('answer', a.text, { module: routed.module, citations, confidence: routed.confidence, usage: a.usage, model: CHAT_MODEL });
  return { status: 200, json: { response: a.text, gate: 'answer', module: MODULE_LABELS[routed.module], citations, confidence: Number(routed.confidence.toFixed(4)), usage: a.usage } };
}

// ── admin surface (internal-only host binding + ADMIN_TOKEN header) ──
async function handleAdmin(req, url, body) {
  if (!ADMIN_TOKEN || req.headers['x-admin-token'] !== ADMIN_TOKEN) return { status: 401, json: { error: 'admin token required' } };
  if (req.method === 'GET' && url === '/admin/pairs') {
    const r = await pool.query('SELECT * FROM assistant_pairs ORDER BY first_seen DESC');
    return { status: 200, json: r.rows };
  }
  if (req.method === 'POST' && url === '/admin/pairs/toggle') {
    const { tenantDomain, module, enabled } = body || {};
    const r = await pool.query(
      'UPDATE assistant_pairs SET enabled=$3 WHERE tenant_domain=$1 AND module=$2 RETURNING *',
      [tenantDomain, module, enabled === true],
    );
    return r.rows.length ? { status: 200, json: r.rows[0] } : { status: 404, json: { error: 'pair not found' } };
  }
  if (req.method === 'GET' && url === '/admin/notifications') {
    const r = await pool.query('SELECT * FROM assistant_notifications ORDER BY ts DESC LIMIT 50');
    return { status: 200, json: r.rows };
  }
  if (req.method === 'GET' && url === '/admin/conversations/count') {
    const r = await pool.query('SELECT count(*)::int AS c FROM assistant_conversations');
    return { status: 200, json: { count: r.rows[0].c } };
  }
  return { status: 404, json: { error: 'not found' } };
}

const server = http.createServer(async (req, res) => {
  const send = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  try {
    let raw = '';
    if (req.method === 'POST') for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};

    if (req.method === 'GET' && req.url === '/health') {
      const id = await chromaCollectionId().catch(() => null);
      const dbOk = await pool.query('SELECT 1').then(() => true).catch(() => false);
      return send(200, { ok: true, collection: COLLECTION, chroma: id ? 'connected' : 'unreachable', db: dbOk ? 'connected' : 'unreachable', llmCalls });
    }
    if (req.url?.startsWith('/admin/')) return send(...Object.values(await handleAdmin(req, req.url, body)));

    if (req.method === 'POST' && req.url === '/chat') {
      // §5.3: signed identity verified BEFORE anything else; unsigned/tampered/expired → 401.
      const v = verifyIdentity(req.headers['x-assistant-identity'], IDENTITY_SIGNING_KEY);
      if (!v.ok) return send(401, { error: `identity rejected: ${v.reason}` });
      body.__identityToken = req.headers['x-assistant-identity']; // forwarded unmodified to module APIs (§5.6)
      const out = await handleChat(body, v.identity);
      return send(out.status, out.json);
    }
    if (req.method === 'POST' && req.url === '/rate') {
      const v = verifyIdentity(req.headers['x-assistant-identity'], IDENTITY_SIGNING_KEY);
      if (!v.ok) return send(401, { error: `identity rejected: ${v.reason}` });
      const rating = body?.rating === 1 || body?.rating === -1 ? body.rating : null;
      if (rating === null) return send(400, { error: 'rating must be 1 or -1' });
      await pool.query(
        'INSERT INTO assistant_ratings (conversation_id, rating, rated_by, note) VALUES ($1,$2,$3,$4)',
        [body?.conversationId || null, rating, v.identity.userId, body?.note || null],
      );
      return send(200, { ok: true });
    }
    return send(404, { error: 'not found' });
  } catch (e) {
    console.error('[assistant]', e?.message || e);
    return send(200, { response: "I'm having trouble answering right now. Please try again in a moment.", gate: 'error', citations: [] });
  }
});

await initSchema();
server.listen(PORT, HOST, () => console.log(`[assistant] Stage 2 service on ${HOST}:${PORT} → ${CHROMA_URL}/${COLLECTION}; model=${CHAT_MODEL}`));
