/**
 * Paths under /technical/api that must NOT be routed by tenantMiddleware (the
 * SAILERP-Bearer → JWT-domain tenant resolver). Consulted ONLY by tenantMiddleware,
 * which is itself inert when MASTER_DATABASE_URL is unset. Input is the request path
 * relative to the /technical/api mount (Express `req.path`, e.g. "/sync/push").
 *
 * Phase 4b — exempt ONLY the server-to-server sync PROTOCOL routes + public probes:
 *
 *   Protocol (ship→shore): /sync/initiate, /sync/push, /sync/pull, /sync/complete,
 *     /sync/file/upload-chunk. These carry NO SAILERP Bearer; they authenticate
 *     server-to-server with X-Sync-Instance-Id + per-tenant X-Sync-Api-Key and are
 *     routed/validated fail-closed by syncTenantGuard (mounted on these routes).
 *   Public probes: /sync/instance-info, /sync/health (ship/shore reachability).
 *
 * EVERYTHING ELSE under /sync (resolve-conflict, conflicts/review/*, settings,
 * fleet-overview, provision/*, batches, status, trigger, file/queue, …) is a
 * BROWSER route hit by the authenticated SPA, so it is NOT exempt — it routes via
 * tenantMiddleware (Bearer → JWT domain → tenant DB) like any other /technical/api
 * call. (Flag-off/dev: tenantMiddleware is inert, so this distinction is a no-op.)
 */

const EXEMPT_EXACT = [
  "/sync/instance-info",
  "/sync/health",
  // server-to-server protocol routes (guarded by syncTenantGuard)
  "/sync/initiate",
  "/sync/push",
  "/sync/pull",
  "/sync/complete",
  // self-heal fetch (ship→shore server-to-server, X-Sync headers only; syncTenantGuard-guarded)
  "/sync/fetch-rows",
  "/sync/file/upload-chunk",
  // shore→ship file PULL (mirror of upload-chunk; also guarded by syncTenantGuard).
  // Ships call these server-to-server with X-Sync-* (no SAILERP Bearer) — must bypass
  // tenantMiddleware like the push, or they'd 401 before the guard runs.
  "/sync/file/pending",
  "/sync/file/download-chunk",
];

// Dynamic server-to-server routes: /sync/file/<queueUuid>/{complete,fail} (pull ack / dead-letter).
// retry & skip are deliberately NOT here — they are authenticated operator/dashboard actions.
const EXEMPT_PATTERNS: RegExp[] = [
  /^\/sync\/file\/[^/]+\/(complete|fail)$/,
];

/** `relPath` is the path relative to the /technical/api mount (Express req.path). */
export function isExemptPath(relPath: string): boolean {
  const p = (relPath.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  if (EXEMPT_EXACT.includes(p)) return true;
  return EXEMPT_PATTERNS.some((re) => re.test(p));
}
