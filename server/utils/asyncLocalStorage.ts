import { AsyncLocalStorage } from "node:async_hooks";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

/**
 * Per-request tenant context (multi-tenant mode). Holds the resolved tenant's
 * Drizzle db + pg pool so the lazy accessors (getDb / getPool / getPostgresClient)
 * return the tenant's connection with no parameter passing.
 *
 * SINGLE shared ALS instance — imported by the accessors (server/db.ts,
 * server/postgresClient.ts) and the tenant connection manager. Independent of the
 * audit-actor ALS in server/middleware/requestContext.ts (different instance).
 *
 * SAFETY (flag off): when MASTER_DATABASE_URL is unset, nobody ever calls
 * runInTenantContext, so getStore() is always undefined and every accessor falls
 * through to the legacy single-pool path — byte-identical to today.
 */
export interface TenantContext {
  tuid: string;
  db: ReturnType<typeof drizzle>;
  pool: Pool;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function getCurrentTenantContext(): TenantContext | undefined {
  return tenantStorage.getStore();
}
