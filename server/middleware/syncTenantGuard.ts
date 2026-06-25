import type { Request, Response, NextFunction } from "express";
import { tenantConnectionManager } from "../utils/tenantConnectionManager";
import { getPool } from "../db";

/**
 * Phase 4b — fail-closed tenant guard for the server-to-server sync PROTOCOL routes
 * (/sync/initiate, /sync/push, /sync/pull, /sync/complete, /sync/file/upload-chunk).
 *
 * Shore is the SOLE authority: it routes purely from the ship's X-Sync-Instance-Id
 * via the master tenant_instances map. The ship NEVER declares its domain.
 *
 * Order (front-door auth BEFORE any tenant DB is opened):
 *   1. read X-Sync-Instance-Id + X-Sync-Api-Key headers.
 *   2. resolveInstanceDomain(instanceId) from the MASTER map.
 *        not found            -> 403 unknown_instance, zero rows, NEVER default-route.
 *   3. compare X-Sync-Api-Key to the map's stored key (still at master level).
 *        missing/mismatch      -> 403 invalid_sync_key, zero rows, no tenant DB touched.
 *   4. resolveTenant(domain) -> runInTenantContext(next): the handler's writes land
 *      in the resolved tenant DB. Context kept open for the whole request.
 *   5. push/pull/complete defense-in-depth: assert the header instance ==
 *      batch.initiatedByInstance (inside the tenant context).
 *
 * SAFETY — byte-identical when off: returns next() immediately if multi-tenant is
 * disabled (MASTER_DATABASE_URL unset). So dev/test and the ship (which has no master
 * DB) are unchanged; no header is consumed, no map lookup happens.
 */

function header(req: Request, name: string): string {
  const raw = req.headers[name];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === "string" ? v.trim() : "";
}

/** Defense-in-depth: the batch (if any) must have been initiated by this instance. */
async function batchInstanceMatches(req: Request, instanceId: string): Promise<boolean> {
  const batchUuid = (req.body && req.body.batchUuid) as string | undefined;
  if (!batchUuid) return true; // initiate / upload-chunk carry no batch — nothing to cross-check
  const pool = await getPool(); // tenant pool (we are inside runInTenantContext here)
  const r = await pool.query(
    `SELECT initiated_by_instance FROM sync_batches WHERE batch_uuid = $1 LIMIT 1`,
    [batchUuid],
  );
  if (r.rows.length === 0) return true; // unknown batch — the handler will 404; not the guard's call
  return r.rows[0].initiated_by_instance === instanceId;
}

export function syncTenantGuard(req: Request, res: Response, next: NextFunction): void {
  // Inert unless multi-tenant is on — preserves the single-tenant/ship path exactly.
  if (!tenantConnectionManager.isMultiTenantEnabled) return next();

  const instanceId = header(req, "x-sync-instance-id");
  const apiKey = header(req, "x-sync-api-key");
  if (!instanceId) {
    res.status(401).json({ error: "missing_instance", message: "X-Sync-Instance-Id required" });
    return;
  }

  tenantConnectionManager
    .resolveInstanceDomain(instanceId)
    .then((entry) => {
      // 2. Unknown instance -> fail closed. Never default-route.
      if (!entry) {
        res.status(403).json({ error: "unknown_instance", message: "Instance not registered" });
        return;
      }
      // 3. Per-tenant key validation at the MASTER level, BEFORE opening any tenant DB.
      if (!entry.syncApiKey || apiKey !== entry.syncApiKey) {
        res.status(403).json({ error: "invalid_sync_key", message: "Sync key rejected" });
        return;
      }
      // 4. Authenticated — resolve the tenant DB and run the handler inside its context.
      return tenantConnectionManager.resolveTenant(entry.domain).then((tenant) =>
        tenantConnectionManager.runInTenantContext(tenant.tuid, async () => {
          // 5. Defense-in-depth batch cross-check (push/pull/complete).
          const okBatch = await batchInstanceMatches(req, instanceId);
          if (!okBatch) {
            if (!res.headersSent) {
              res.status(403).json({ error: "instance_mismatch", message: "Batch belongs to a different instance" });
            }
            return;
          }
          await new Promise<void>((resolve, reject) => {
            res.on("finish", resolve);
            res.on("close", resolve);
            res.on("error", reject);
            next();
          });
        }),
      );
    })
    .catch((err: any) => {
      if (res.headersSent) return;
      switch (err?.name) {
        case "TenantNotFoundError":
          res.status(403).json({ error: "invalid_tenant", message: err.message });
          return;
        case "TenantInactiveError":
          res.status(403).json({ error: "tenant_inactive", message: err.message });
          return;
        default:
          res.status(503).json({ error: "tenant_unavailable", message: "Tenant database unavailable" });
      }
    });
}
