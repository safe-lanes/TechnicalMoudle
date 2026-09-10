/**
 * SAIL AI Assistant — central service, Stage 1 (documentation answers ONLY).
 *
 * Scope (CHATBOT-IMPLEMENTATION-PLAN.md Stage 1):
 *   POST /chat {message} → intent routing over the tagged knowledge store →
 *   grounded answer with citations (module + manual + section), or the
 *   clarify / not-documented gates (CHATBOT-CENTRAL-SERVICE-PLAN.md §4.2).
 *   No data tools, no widget, no external exposure (bind internal-only).
 *
 * Zero npm dependencies — Node 20 built-ins only (global fetch, node:http).
 *
 * Routing design (retrieval-based, deterministic, measurable):
 *   The query is embedded once and searched across ALL modules. The top hits'
 *   module tags decide the route: best-scoring module wins when its best hit
 *   beats the runner-up module's best hit by ROUTE_MARGIN; otherwise the
 *   clarify gate asks which module was meant. If even the best hit is farther
 *   than SIM_FLOOR, the not-documented gate answers honestly. Distances are
 *   L2 on normalized text-embedding-3-large vectors (lower = closer;
 *   d² = 2 − 2·cos, range 0..2).
 */
import http from 'node:http';

const PORT = parseInt(process.env.PORT || '8000', 10);
const HOST = process.env.HOST || '0.0.0.0'; // container-internal; host binding stays 127.0.0.1
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const CHROMA_URL = process.env.CHROMA_URL || 'http://technical-chromadb:8000';
const COLLECTION = process.env.CHROMA_COLLECTION || 'technical_docs';
const EMBED_MODEL = process.env.EMBED_MODEL || 'text-embedding-3-large';
const CHAT_MODEL = process.env.CHAT_MODEL || 'gpt-4o';
const SIM_FLOOR = parseFloat(process.env.ROUTE_SIM_FLOOR || '1.15'); // L2 distance; larger = farther
const ROUTE_MARGIN = parseFloat(process.env.ROUTE_MARGIN || '0.05');
const TOP_K = parseInt(process.env.ROUTE_TOP_K || '10', 10);
const ANSWER_CHUNKS = parseInt(process.env.ANSWER_CHUNKS || '5', 10);
const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || '30000', 10);

const MODULE_LABELS = { technical: 'Technical', audit: 'Audit', safety: 'Safety', incident: 'Incident', crewing: 'Crewing' };

let collectionId = null;
async function chromaCollectionId() {
  if (collectionId) return collectionId;
  const r = await fetch(`${CHROMA_URL}/api/v2/tenants/default_tenant/databases/default_database/collections`);
  if (!r.ok) throw new Error(`chroma collections: HTTP ${r.status}`);
  const cols = await r.json();
  const col = cols.find((c) => c.name === COLLECTION);
  if (!col) throw new Error(`collection '${COLLECTION}' not found`);
  collectionId = col.id;
  return collectionId;
}

async function embed(text) {
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
  const file = meta?.file || '';
  const prefix = file.split(' - ')[0].trim().toLowerCase();
  return MODULE_LABELS[prefix] ? prefix : 'unknown';
}

async function retrieve(queryEmbedding) {
  const id = await chromaCollectionId();
  const r = await fetch(
    `${CHROMA_URL}/api/v2/tenants/default_tenant/databases/default_database/collections/${id}/query`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query_embeddings: [queryEmbedding],
        n_results: TOP_K,
        include: ['metadatas', 'documents', 'distances'],
      }),
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

/** Routing decision per §4.2: returns {gate:'answer'|'clarify'|'not_documented', module?, candidates?, hits, confidence}. */
function route(hits) {
  if (!hits.length || hits[0].distance > SIM_FLOOR) {
    return { gate: 'not_documented', hits: [], confidence: 0 };
  }
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
    return {
      gate: 'clarify',
      candidates: ranked.slice(0, 3).map(([m]) => MODULE_LABELS[m] || m),
      hits: [],
      confidence: margin,
    };
  }
  return {
    gate: 'answer',
    module: topModule,
    hits: hits.filter((h) => h.module === topModule && h.distance <= SIM_FLOOR).slice(0, ANSWER_CHUNKS),
    confidence: margin,
  };
}

function manualOf(meta) {
  const f = (meta.file || 'unknown').replace(/\.(pdf|docx|html)$/i, '');
  return f;
}
function sectionOf(meta) {
  const bc = meta.breadcrumb || '';
  const parts = bc.split('>').map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(' > ') : parts[0] || 'Document';
}

async function answer(message, routed) {
  const context = routed.hits
    .map((h, i) => `[${i + 1}] (${manualOf(h.meta)} — ${sectionOf(h.meta)})\n${h.text}`)
    .join('\n\n---\n\n');
  const system =
    `You are the SAIL Maritime PMS assistant. Answer the user's question using ONLY the manual excerpts provided. ` +
    `Rules: if the excerpts do not answer the question, say plainly that it is not covered in the ${MODULE_LABELS[routed.module]} documentation — never guess. ` +
    `Answer in short plain language, as numbered steps when the question is a how-to. ` +
    `End with a "Source:" line naming the manual and section(s) you used, e.g. Source: <manual> — <section>.`;
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

async function handleChat(body) {
  const message = String(body?.message || '').trim();
  if (!message) return { status: 400, json: { error: 'Message is required' } };

  const queryEmbedding = await embed(message);
  const hits = await retrieve(queryEmbedding);
  const routed = route(hits);

  if (routed.gate === 'not_documented') {
    return {
      status: 200,
      json: {
        response: "That isn't covered in the module documentation I have. Please rephrase, or contact support if you believe it should be documented.",
        gate: 'not_documented', module: null, citations: [], confidence: routed.confidence,
      },
    };
  }
  if (routed.gate === 'clarify') {
    return {
      status: 200,
      json: {
        response: `Your question could relate to more than one module — is this about ${routed.candidates.join(' or ')}?`,
        gate: 'clarify', module: null, candidates: routed.candidates, citations: [], confidence: routed.confidence,
      },
    };
  }
  if (body?.routeOnly === true) {
    // Test/diagnostic mode: report the routing decision without an LLM call.
    return {
      status: 200,
      json: {
        gate: 'answer', module: MODULE_LABELS[routed.module], confidence: Number(routed.confidence.toFixed(4)),
        citations: routed.hits.map((h) => ({ manual: manualOf(h.meta), section: sectionOf(h.meta), distance: Number(h.distance.toFixed(4)) })),
        routeOnly: true,
      },
    };
  }
  const a = await answer(message, routed);
  const citations = routed.hits.map((h) => ({
    module: MODULE_LABELS[routed.module],
    manual: manualOf(h.meta),
    section: sectionOf(h.meta),
    distance: Number(h.distance.toFixed(4)),
  }));
  return {
    status: 200,
    json: { response: a.text, gate: 'answer', module: MODULE_LABELS[routed.module], citations, confidence: Number(routed.confidence.toFixed(4)), usage: a.usage },
  };
}

const server = http.createServer(async (req, res) => {
  const send = (status, obj) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };
  try {
    if (req.method === 'GET' && req.url === '/health') {
      const id = await chromaCollectionId().catch(() => null);
      return send(200, { ok: true, collection: COLLECTION, chroma: id ? 'connected' : 'unreachable' });
    }
    if (req.method === 'POST' && req.url === '/chat') {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const out = await handleChat(JSON.parse(raw || '{}'));
      return send(out.status, out.json);
    }
    return send(404, { error: 'not found' });
  } catch (e) {
    console.error('[assistant]', e?.message || e);
    return send(200, { response: "I'm having trouble answering right now. Please try again in a moment.", gate: 'error', citations: [] });
  }
});

server.listen(PORT, HOST, () => console.log(`[assistant] Stage 1 doc-answer service on ${HOST}:${PORT} → ${CHROMA_URL}/${COLLECTION}`));
