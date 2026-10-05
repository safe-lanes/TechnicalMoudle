/**
 * SAIL AI Assistant — widget client.
 *
 * The widget talks ONLY to the central assistant service (the legacy embedded
 * chatbot was removed — product decision 10-Sep-2026: it was never tested or
 * grounded, so it was scaffolding, not a fallback). If the assistant is
 * unreachable, the widget shows an honest "temporarily unavailable" message.
 *
 * Endpoint resolution:
 *   1. localStorage 'ASSISTANT_CENTRAL_URL' — per-session tester override
 *   2. VITE_ASSISTANT_CENTRAL_URL           — per-environment build setting
 *   3. DEFAULT_CENTRAL_URL                  — the enterprise deployment
 *
 * Identity: the widget never invents identity. The mint call is a same-origin
 * module API request, so the app's global fetch wrapper (lib/activeRank.ts)
 * attaches the real x-user-* / x-rank headers from the decrypted session — the
 * module signs from req.rbac and REFUSES the mock. Central calls carry only
 * the minted token (x-assistant-identity).
 */

// Permanent public home (A record created by the owner 11-Sep-2026). Publicly
// verified over real DNS — TLS chain, health, admin blocked, unsigned chat refused —
// before this default was set. The interim viqmap.sl-sail.com/assistant path still
// answers during the transition; VITE_ASSISTANT_CENTRAL_URL / localStorage override.
export const DEFAULT_CENTRAL_URL: string | null = 'https://assistant.sl-sail.com';

export interface AssistantContext {
  module: string;
  vesselId?: string;
  vesselName?: string;
  currentPage?: string;
}

export interface AssistantReply {
  response: string;
  gate?: string;
  module?: string | null;
  candidates?: string[];
  citations?: Array<{ module?: string; manual: string; section: string }>;
  toolsUsed?: string[];
  partial?: boolean;
}

const CENTRAL_TIMEOUT_MS = 45_000;

export const ASSISTANT_UNAVAILABLE_MESSAGE =
  'The assistant is temporarily unavailable. Please try again in a moment — if this persists, contact support.';

export function resolveCentralUrl(): string {
  try {
    const override = window.localStorage.getItem('ASSISTANT_CENTRAL_URL');
    if (override) return override.replace(/\/$/, '');
  } catch {
    /* storage unavailable — fall through */
  }
  const env = (import.meta as any).env?.VITE_ASSISTANT_CENTRAL_URL as string | undefined;
  if (env) return env.replace(/\/$/, '');
  if (DEFAULT_CENTRAL_URL) return DEFAULT_CENTRAL_URL.replace(/\/$/, '');
  throw new Error('assistant address not configured (VITE_ASSISTANT_CENTRAL_URL)');
}

/** Mint a short-lived signed identity from the module (same-origin; wrapper adds identity headers). */
async function mintToken(): Promise<string> {
  const r = await fetch('/technical/api/assistant/token');
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body?.error || `token mint failed (HTTP ${r.status})`);
  }
  return (await r.json()).token as string;
}

export async function sendToAssistant(
  message: string,
  history: Array<{ role: string; content: string }>,
  ctx: AssistantContext,
  signal?: AbortSignal,
): Promise<AssistantReply> {
  const centralUrl = resolveCentralUrl();
  const token = await mintToken();
  const r = await fetch(`${centralUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-assistant-identity': token },
    body: JSON.stringify({ message, conversationHistory: history, context: ctx }),
    signal: signal ?? AbortSignal.timeout(CENTRAL_TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`central assistant HTTP ${r.status}`);
  const j = await r.json();
  if (typeof j?.response !== 'string') throw new Error('central assistant returned no response');
  return j;
}

/**
 * "Report this answer" (30-Sep-2026): sends the question, the answer and the user's note to the central
 * assistant, which files it as a review item for the module's knowledge trainers. It never changes what the assistant says.
 */
export async function reportAnswer(report: {
  question: string;
  answer: string;
  note: string;
  citations?: AssistantReply['citations'];
  module?: string;
}): Promise<void> {
  const token = await mintToken();
  const r = await fetch(`${resolveCentralUrl()}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-assistant-identity': token },
    body: JSON.stringify({ module: 'technical', ...report }),
    signal: AbortSignal.timeout(CENTRAL_TIMEOUT_MS),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body?.error || `report failed (HTTP ${r.status})`);
  }
}

/**
 * Is the signed-in user a knowledge trainer for any module? (1-Oct-2026) Decided by the central assistant from the
 * signed identity and its trainer grants; used only to show or hide the "Manage knowledge" icon — every action on the
 * knowledge screen is checked again on the server. Any failure means "no".
 * `supported` (5-Oct-2026) says whether this central service has knowledge management at all (an older service answers
 * 404); "Report this answer" is shown only when it does, so users of an older service never get a broken button.
 */
export async function knowledgeEligibility(): Promise<{ supported: boolean; trainer: boolean; modules: string[] }> {
  try {
    const token = await mintToken();
    const r = await fetch(`${resolveCentralUrl()}/kb/eligibility`, {
      headers: { 'x-assistant-identity': token },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return { supported: false, trainer: false, modules: [] };
    const j = await r.json();
    return { supported: true, trainer: j?.trainer === true, modules: Array.isArray(j?.modules) ? j.modules : [] };
  } catch {
    return { supported: false, trainer: false, modules: [] };
  }
}

/**
 * "Manage knowledge": opens the central knowledge screen signed in as the current user. The one-time identity
 * travels in the URL fragment (never sent to a server by the browser); the screen exchanges it for a session.
 * Whether the user may change anything is decided by the central service, not here.
 */
export async function openKnowledgeManager(): Promise<void> {
  const w = window.open('about:blank', '_blank'); // opened synchronously so a popup blocker allows it
  try {
    const token = await mintToken();
    const url = `${resolveCentralUrl()}/kb#t=${encodeURIComponent(token)}`;
    if (w) {
      w.opener = null;
      w.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (e) {
    w?.close();
    throw e;
  }
}
