import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import { resolvePostgres, getPostgresClient } from './postgresClient';

/**
 * DEPRECATED: Use getDb() or getPool() instead
 * Legacy eager initialization kept for backward compatibility
 * Will be removed once all importers are updated to use lazy helpers
 */
let pool: Pool | undefined;
let db: ReturnType<typeof drizzle> | undefined;

if (process.env.DATABASE_URL) {
  // Only initialize if DATABASE_URL is available
  // This allows the module to be imported without crashing if DATABASE_URL is not yet resolved
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
}

export { pool, db };

/**
 * Get PostgreSQL database client (lazy, cached)
 * Preferred over importing db directly
 */
export async function getDb() {
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
  const postgres = await resolvePostgres();
  if (!postgres) {
    throw new Error('PostgreSQL is not available (DATABASE_URL not configured)');
  }
  return postgres.pool;
}
