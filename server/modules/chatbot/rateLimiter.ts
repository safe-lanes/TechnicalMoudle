// Chatbot Stage A: lightweight in-memory per-user sliding-window rate limiter.
//
// Config via env (tunable later):
//   CHATBOT_RATE_MAX         max requests per window per user (default 30). <=0 disables.
//   CHATBOT_RATE_WINDOW_MS   window length in ms (default 60000).
//
// In-memory is sufficient for the single-instance PM2 fork deployment. If the app is ever
// run multi-instance, move this to a shared store (Redis / DB). Default (30/min) is generous
// enough that normal single-user chat is unaffected — byte-identical for normal use.

const WINDOW_MS = Math.max(1000, parseInt(process.env.CHATBOT_RATE_WINDOW_MS || '', 10) || 60_000);
const MAX = process.env.CHATBOT_RATE_MAX !== undefined ? parseInt(process.env.CHATBOT_RATE_MAX, 10) : 30;

const hits = new Map<string, number[]>();

export interface RateResult {
  allowed: boolean;
  retryAfterMs: number;
}

/** Record + check one request for `key` (e.g. the user id). Fail-open if disabled. */
export function checkChatRateLimit(key: string): RateResult {
  if (!Number.isFinite(MAX) || MAX <= 0) return { allowed: true, retryAfterMs: 0 }; // disabled
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX) {
    hits.set(key, recent);
    return { allowed: false, retryAfterMs: Math.max(0, WINDOW_MS - (now - recent[0])) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { allowed: true, retryAfterMs: 0 };
}
