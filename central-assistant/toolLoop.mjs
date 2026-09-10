/**
 * Stage 3 — manifest-driven tool registry + the ported LLM loop.
 *
 * The loop shape is the Technical bot's processChatMessage, relocated, with the
 * §5.7 budget reconciliation applied:
 *   max 8 tool iterations (kept) · 30 s per LLM call (was 60) ·
 *   10 s per module tool call ENFORCED HERE (timeout fed back to the LLM as
 *   data, not an abort) · 90 s SOFT DEADLINE — past it, no further tool calls,
 *   final synthesis over what was gathered, answer plainly labelled partial ·
 *   the hard ceiling stays the caller's generic error fallback.
 *
 * Module tools come from each module's /assistant/manifest (fetched lazily,
 * cached, refreshed on interval). The caller's SIGNED identity token is
 * FORWARDED UNMODIFIED to /assistant/execute (§5.6) — the central service never
 * re-mints or upgrades an identity; the module's own scope enforcement (R2)
 * decides with the same identity the user presented here.
 */

const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || '30000', 10);
const TOOL_TIMEOUT_MS = parseInt(process.env.TOOL_TIMEOUT_MS || '10000', 10);
const SOFT_DEADLINE_MS = parseInt(process.env.SOFT_DEADLINE_MS || '90000', 10);
const MAX_ITERATIONS = parseInt(process.env.MAX_TOOL_ITERATIONS || '8', 10);
const MANIFEST_TTL_MS = parseInt(process.env.MANIFEST_TTL_MS || '300000', 10);

/** env ASSISTANT_MODULE_APIS = {"technical":{"url":"http://...:5000/technical/api","secret":"..."}} */
function moduleApis() {
  try {
    return JSON.parse(process.env.ASSISTANT_MODULE_APIS || '{}');
  } catch {
    return {};
  }
}

const manifestCache = new Map(); // module -> {at, tools}
export async function manifestFor(module) {
  const api = moduleApis()[module];
  if (!api) return null;
  const cached = manifestCache.get(module);
  if (cached && Date.now() - cached.at < MANIFEST_TTL_MS) return cached;
  try {
    const r = await fetch(`${api.url}/assistant/manifest`, {
      headers: { 'x-service-secret': api.secret },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`manifest HTTP ${r.status}`);
    const j = await r.json();
    const entry = { at: Date.now(), apiVersion: j.apiVersion, tools: j.tools || [] };
    if (entry.apiVersion !== 1) throw new Error(`unsupported manifest apiVersion ${entry.apiVersion}`);
    manifestCache.set(module, entry);
    return entry;
  } catch (e) {
    console.error(`[assistant] manifest(${module}) failed:`, e?.message || e);
    return cached || null; // last-known-good if we ever had one
  }
}

async function executeModuleTool(module, tool, args, identityToken, requestId) {
  const api = moduleApis()[module];
  if (!api) return { ok: false, error: `no data API configured for module ${module}` };
  try {
    const r = await fetch(`${api.url}/assistant/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-secret': api.secret,
        'x-assistant-identity': identityToken, // forwarded unmodified (§5.6)
      },
      body: JSON.stringify({ tool, args, requestId }),
      signal: AbortSignal.timeout(TOOL_TIMEOUT_MS), // R5: 10 s enforced centrally
    });
    if (r.status === 401) return { ok: false, error: 'module rejected the forwarded identity' };
    if (!r.ok) return { ok: false, error: `module API HTTP ${r.status}` };
    return await r.json();
  } catch (e) {
    const timedOut = e?.name === 'TimeoutError' || /abort/i.test(e?.message || '');
    return { ok: false, error: timedOut ? `${module}/${tool} timed out` : `${module}/${tool} failed: ${e?.message || e}` };
  }
}

const SEARCH_DOCS_TOOL = {
  name: 'search_module_docs',
  description:
    'Search the official SAIL user manuals for how-to/procedural information. Use for any question about HOW to do something in the application. Returns manual excerpts with manual name and section for citation, or reports that the topic is not documented.',
  parameters: {
    type: 'object',
    properties: { query: { type: 'string', description: 'The how-to question or topic to look up' } },
    required: ['query'],
  },
};

/**
 * Run the ported tool loop. deps supplies the Stage 1/2 primitives so this file
 * stays free of duplicated retrieval logic:
 *   deps.searchDocs(query) -> {gate, module?, candidates?, chunks:[{manual,section,text}]}
 *   deps.chatCompletion(messages, tools?) -> OpenAI response json (counts llmCalls)
 */
export async function runToolLoop({ message, uiModule, identityToken, deps }) {
  const startedAt = Date.now();
  const manifest = await manifestFor(uiModule);
  const moduleTools = (manifest?.tools || []).map((t) => ({ type: 'function', function: t }));
  const tools = [{ type: 'function', function: SEARCH_DOCS_TOOL }, ...moduleTools];
  const toolsUsed = [];
  let partial = false;

  const messages = [
    {
      role: 'system',
      content:
        `You are the SAIL Maritime PMS assistant for the ${uiModule} module. ` +
        `For LIVE DATA questions (work orders, spares, running hours, defects, fleet...) call the module data tools. ` +
        `For HOW-TO questions call search_module_docs and answer ONLY from the excerpts it returns, ending with a "Source:" line naming manual and section; if it reports the topic is not documented, say so plainly — never guess. ` +
        `If a tool returns an error or a permission refusal, relay it politely and do not retry the same call. ` +
        `Answer in short plain language; numbered steps for how-tos.`,
    },
    { role: 'user', content: message },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const pastSoftDeadline = Date.now() - startedAt > SOFT_DEADLINE_MS;
    const j = await deps.chatCompletion(messages, pastSoftDeadline ? undefined : tools, LLM_TIMEOUT_MS);
    const choice = j.choices?.[0]?.message;
    if (!choice) throw new Error('empty LLM response');

    if (!choice.tool_calls?.length || pastSoftDeadline) {
      const text = choice.content || '';
      return {
        text: partial && pastSoftDeadline ? `${text}\n\n(Note: answered from partial data — some lookups did not complete in time.)` : text,
        toolsUsed,
        usage: j.usage || null,
        partial: partial && pastSoftDeadline,
      };
    }

    messages.push(choice);
    for (const tc of choice.tool_calls) {
      const name = tc.function?.name;
      let args = {};
      try { args = JSON.parse(tc.function?.arguments || '{}'); } catch { /* leave empty */ }
      toolsUsed.push(name);
      let result;
      if (name === 'search_module_docs') {
        result = await deps.searchDocs(String(args.query || message));
      } else {
        const out = await executeModuleTool(uiModule, name, args, identityToken, `${startedAt}-${i}`);
        if (out.ok === false) partial = partial || /timed out/.test(out.error || '');
        result = out.ok ? out.data : { error: out.error };
      }
      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result).slice(0, 24000) });
    }
  }
  // Iteration cap reached — synthesize from what we have, no more tools.
  const final = await deps.chatCompletion(
    [...messages, { role: 'user', content: 'Answer now from the information gathered above. If it is incomplete, say so plainly.' }],
    undefined,
    LLM_TIMEOUT_MS,
  );
  return { text: final.choices?.[0]?.message?.content || '', toolsUsed, usage: final.usage || null, partial: true };
}
