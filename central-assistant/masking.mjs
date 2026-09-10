/**
 * Stage 5 — mask-out / un-mask-in (enterprise plan B3; implementation plan Stage 5).
 *
 * PRINCIPLE — one choke point per direction:
 *   OUTBOUND (to OpenAI): every string that leaves for the LLM/embeddings passes
 *   maskText/maskMessages. Real vessel names, person names, IMO numbers and DB
 *   UUIDs are replaced by stable per-request tokens: [VESSEL_1], [PERSON_1],
 *   [IMO_1], [ID_1].
 *   INBOUND (from OpenAI): the final answer passes unmaskText — tokens become the
 *   real values again, so the user reads real names and OpenAI never saw them.
 *   Tool-call arguments produced by the LLM contain tokens; unmaskJson restores
 *   them BEFORE the module Data API is called (modules always work on real data).
 *
 * WHAT is masked:
 *   - names registered up front (context.vesselName, the caller's userName)
 *   - names LEARNED from data-tool results: values of name-bearing fields
 *     (vessel_name, *_by, *_by_name, approver, observer, master, full_name, …)
 *   - UUIDs (DB identifiers) and standalone 7-digit numbers (IMO shape) found in
 *     any outbound string — masked on sight, mapped for restore.
 *   Name replacement is WHOLE-NAME, word-boundary, case-insensitive — a vessel
 *   called "Gas Mia" masks only the full name, never the word "gas"; a string
 *   that merely LOOKS like a vessel name but is not ours is untouched (we mask
 *   OUR identifiers, not the concept of names).
 *
 * FAILURE POLICY (owner-confirmed direction):
 *   - Masking failure  → the REQUEST FAILS before any LLM call (never send raw).
 *   - Un-mask failure (unknown token in the answer) → the placeholder stays
 *     VISIBLE and a warning is logged. A visible [VESSEL_9] is honest and
 *     debuggable; silently guessing or leaking is not.
 *   Test seam: a message containing '__MASK_FAIL_TEST__' makes maskText throw,
 *   so the fail-closed path is provable end-to-end.
 */

const NAME_KEY_RE = /(vessel_?name|user_?name|full_?name|display_?name|_by_name|_by$|approver|observer|reported_by|completed_by|created_by|updated_by|master|chief|requestedBy|assignee)/i;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const IMO_RE = /\b\d{7}\b/g;
const TOKEN_RE = /\[(VESSEL|PERSON|IMO|ID)_(\d+)\]/g;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function createMasker() {
  const realToToken = new Map(); // lowercased real -> token
  const tokenToReal = new Map(); // token -> real (original casing)
  const counters = { VESSEL: 0, PERSON: 0, IMO: 0, ID: 0 };
  let nameRe = null; // combined regex over registered names, longest-first
  const warnings = [];

  function register(value, kind) {
    const v = String(value ?? '').trim();
    if (v.length < 3) return null;
    const key = v.toLowerCase();
    if (realToToken.has(key)) return realToToken.get(key);
    const token = `[${kind}_${++counters[kind]}]`;
    realToToken.set(key, token);
    tokenToReal.set(token, v);
    nameRe = null; // rebuild lazily
    return token;
  }

  function buildNameRe() {
    const names = [...realToToken.keys()]
      .filter((k) => !UUID_RE.test(k) && !/^\d{7}$/.test(k))
      .sort((a, b) => b.length - a.length);
    UUID_RE.lastIndex = 0;
    if (!names.length) return null;
    return new RegExp(`(?<![\\w])(${names.map(escapeRe).join('|')})(?![\\w])`, 'gi');
  }

  // A bare `name`/`title` field is a real identifier only when its OBJECT also
  // carries a signal of what it names — a vessel (imo/code/vessel id) or a person
  // (rank/email/crew). This is what stops manual excerpts like {title:"Save as
  // Draft"} being masked while {name:"Gas Mia", imoNumber:...} IS masked.
  const VESSEL_SIGNAL = /^(imo|imo_?number|vessel_?id|vuuid|v_?code|vessel_?code|flag)$/i;
  const PERSON_SIGNAL = /^(rank|rank_?name|email|crew_?id|employee_?id|designation|department)$/i;
  const BARE_NAME_KEY = /^(name|full_?name|title)$/i;

  /** Learn identifier values from a data-tool result (walks the JSON, sibling-aware). */
  function learnFromJson(obj) {
    const walk = (o) => {
      if (o === null || o === undefined) return;
      if (Array.isArray(o)) return o.forEach(walk);
      if (typeof o === 'object') {
        const keys = Object.keys(o);
        const hasVesselSignal = keys.some((k) => VESSEL_SIGNAL.test(k));
        const hasPersonSignal = keys.some((k) => PERSON_SIGNAL.test(k));
        for (const [k, v] of Object.entries(o)) {
          if (typeof v === 'string') {
            if (NAME_KEY_RE.test(k)) {
              register(v, /vessel/i.test(k) ? 'VESSEL' : 'PERSON');
            } else if (BARE_NAME_KEY.test(k) && (hasVesselSignal || hasPersonSignal)) {
              register(v, hasVesselSignal ? 'VESSEL' : 'PERSON');
            } else if (/^(imo|imo_?number)$/i.test(k) && /^\d{6,8}$/.test(v.trim())) {
              register(v.trim(), 'IMO');
            }
          } else if (typeof v === 'number' && /^(imo|imo_?number)$/i.test(k)) {
            register(String(v), 'IMO');
          }
          walk(v);
        }
      }
    };
    walk(obj);
  }

  function maskText(s) {
    if (typeof s !== 'string' || !s) return s;
    if (s.includes('__MASK_FAIL_TEST__')) throw new Error('masking self-test failure requested');
    let out = s;
    if (!nameRe) nameRe = buildNameRe();
    if (nameRe) {
      nameRe.lastIndex = 0;
      out = out.replace(nameRe, (m) => realToToken.get(m.toLowerCase()) || m);
    }
    out = out.replace(UUID_RE, (m) => realToToken.get(m.toLowerCase()) || register(m, 'ID'));
    out = out.replace(IMO_RE, (m) => realToToken.get(m) || register(m, 'IMO'));
    return out;
  }

  /** Deep-mask every string in an OpenAI messages array (returns a copy). */
  function maskMessages(messages) {
    return messages.map((m) => {
      const c = { ...m };
      if (typeof c.content === 'string') c.content = maskText(c.content);
      return c;
    });
  }

  function unmaskText(s) {
    if (typeof s !== 'string' || !s) return s;
    TOKEN_RE.lastIndex = 0;
    return s.replace(TOKEN_RE, (tok) => {
      const real = tokenToReal.get(tok);
      if (real === undefined) {
        warnings.push(`unmapped token left visible: ${tok}`);
        return tok; // visible placeholder beats a guess or a leak
      }
      return real;
    });
  }

  /** Restore real values inside LLM-produced tool arguments (deep). */
  function unmaskJson(obj) {
    if (typeof obj === 'string') return unmaskText(obj);
    if (Array.isArray(obj)) return obj.map(unmaskJson);
    if (obj && typeof obj === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(obj)) out[k] = unmaskJson(v);
      return out;
    }
    return obj;
  }

  return {
    register, learnFromJson, maskText, maskMessages, unmaskText, unmaskJson,
    warnings, size: () => tokenToReal.size,
  };
}
