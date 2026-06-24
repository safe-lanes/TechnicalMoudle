/**
 * Phase 2 — paths under /technical/api that must NOT require a SAILERP browser
 * Bearer. Consulted ONLY by tenantMiddleware, which is itself inert when
 * MASTER_DATABASE_URL is unset. Input is the request path relative to the
 * /technical/api mount (Express `req.path`, e.g. "/sync/push").
 *
 * Why these are exempt (completeness checked against the full /technical/api route
 * surface — the /sync/* family is the ONLY non-browser-Bearer traffic; every other
 * route is hit by the authenticated SPA which forwards the Bearer):
 *
 *   /sync/*  — the ship→shore sync engine calls these SERVER-TO-SERVER and
 *              authenticates with X-Sync-Api-Key + X-Sync-Instance-Id, NOT a
 *              SAILERP browser token. The prefix also covers /sync/instance-info
 *              (public ship/shore probe), /sync/health, the Sync Dashboard reads,
 *              and /sync/provision/*. Sync's own per-tenant routing + caller
 *              authentication is Phase 4 (G3); until then sync stays on the
 *              legacy/single path. Exempting the whole prefix is the correct
 *              Phase-2 boundary — without it, the flag flip would 401 all sync.
 */

const EXEMPT_PREFIXES = ["/sync/"];
const EXEMPT_EXACT = ["/sync", "/sync/instance-info", "/sync/health"];

/** `relPath` is the path relative to the /technical/api mount (Express req.path). */
export function isExemptPath(relPath: string): boolean {
  const p = (relPath.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  if (EXEMPT_EXACT.includes(p)) return true;
  return EXEMPT_PREFIXES.some((pre) => p.startsWith(pre));
}
