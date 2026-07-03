import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import { resolvePostgres, getPostgresClient } from './postgresClient';
import { getCurrentTenantContext } from './utils/asyncLocalStorage';

/**
 * @deprecated Use getDb() / getPool() instead. Legacy eager singletons kept only
 * for backward compatibility; scheduled for removal in the Phase 5 multi-tenant
 * decommission. Phase 0 (seam refactor) migrated all module importers to the lazy
 * accessors so these are no longer imported anywhere on the live path. Importing
 * `db`/`pool` directly bypasses the tenant-aware seam introduced in later phases —
 * `scripts/check-direct-db-imports.sh` enforces zero direct imports.
 */
let pool: Pool | undefined;
let db: ReturnType<typeof drizzle> | undefined;

if (process.env.DATABASE_URL) {
  // Only initialize if DATABASE_URL is available
  // This allows the module to be imported without crashing if DATABASE_URL is not yet resolved
  // Keep pool sizing in lockstep with server/postgresClient.ts (the runtime pool).
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX) || 25,
    connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 10000,
    idleTimeoutMillis: 30000,
  });
  db = drizzle(pool, { schema });
}

export { pool, db };

/**
 * Get PostgreSQL database client (lazy, cached)
 * Preferred over importing db directly
 */
export async function getDb() {
  // Multi-tenant: inside a tenant request, return that tenant's db. When
  // MASTER_DATABASE_URL is unset no context is ever entered, so this is undefined
  // and we fall through to the legacy single-pool path (byte-identical to today).
  const ctx = getCurrentTenantContext();
  if (ctx) return ctx.db;

  const postgres = await resolvePostgres();
  if (!postgres) {
    throw new Error('PostgreSQL is not available (DATABASE_URL not configured)');
  }
  return postgres.db;
}

/**
 * Get PostgreSQL connection pool (lazy, cached)
 * Preferred over importing pool directly
 */
export async function getPool() {
  const ctx = getCurrentTenantContext();
  if (ctx) return ctx.pool;

  const postgres = await resolvePostgres();
  if (!postgres) {
    throw new Error('PostgreSQL is not available (DATABASE_URL not configured)');
  }
  return postgres.pool;
}
