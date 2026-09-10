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

// The assistant's public address is configured per environment (VITE var or
// tester localStorage). There is deliberately NO baked-in default: the public
// hostname is pending a DNS decision (10-Sep) and publishing a dead URL as a
// default caused a corrected mistake — unconfigured now fails loudly instead.
export const DEFAULT_CENTRAL_URL: string | null = null;

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
