/**
 * SAIL AI Assistant — widget client (Stage 4 of docs/CHATBOT-IMPLEMENTATION-PLAN.md).
 *
 * THE FLAG (§3 of the plan): where the chat window sends its messages.
 *   1. localStorage 'ASSISTANT_CENTRAL_URL'  — per-session tester override
 *   2. VITE_ASSISTANT_CENTRAL_URL            — per-environment build flag
 *   3. unset → null                          — legacy embedded /technical/api/chat (today)
 * During the transition the widget also FALLS BACK PER-REQUEST: if the central
 * call fails (network / 5xx / timeout), it silently retries the legacy endpoint,
 * so a central outage degrades to today's bot, never to a broken chat.
 *
 * Identity: the widget never invents identity. The mint call below is a
 * same-origin module API request, so the app's global fetch wrapper
 * (lib/activeRank.ts) attaches the real x-user-* / x-rank headers from the
 * decrypted session — the module signs from req.rbac and REFUSES the mock.
 * Central calls carry only the minted token (x-assistant-identity).
 */

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
  usedCentral: boolean;
}

const CENTRAL_TIMEOUT_MS = 45_000;

export function resolveCentralUrl(): string | null {
  try {
    const override = window.localStorage.getItem('ASSISTANT_CENTRAL_URL');
    if (override === 'off') return null; // tester force-legacy
    if (override) return override.replace(/\/$/, '');
  } catch {
    /* storage unavailable — fall through */
  }
  const env = (import.meta as any).env?.VITE_ASSISTANT_CENTRAL_URL as string | undefined;
  return env ? env.replace(/\/$/, '') : null;
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

export async function sendToCentral(
  centralUrl: string,
  message: string,
  history: Array<{ role: string; content: string }>,
  ctx: AssistantContext,
  signal?: AbortSignal,
): Promise<AssistantReply> {
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
  return { ...j, usedCentral: true };
}
