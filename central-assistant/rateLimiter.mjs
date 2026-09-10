/**
 * Per-user sliding-window rate limiter — PORTED AS-IS from the Technical module's
 * server/modules/chatbot/rateLimiter.ts (Stage A), per the implementation plan's
 * moves-vs-new table. In-memory is fine: the central service is single-instance,
 * same as the module under PM2 fork mode.
 */
const WINDOW_MS = parseInt(process.env.CHATBOT_RATE_WINDOW_MS || '60000', 10);
const MAX = parseInt(process.env.CHATBOT_RATE_MAX || '30', 10);

const hits = new Map(); // userId -> number[] (timestamps)

export function checkChatRateLimit(userId) {
  if (MAX <= 0) return { allowed: true };
  const now = Date.now();
  const list = (hits.get(userId) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX) {
    hits.set(userId, list);
    return { allowed: false };
  }
  list.push(now);
  hits.set(userId, list);
  return { allowed: true };
}
