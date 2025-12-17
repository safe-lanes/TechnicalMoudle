import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from "@shared/schema";
import { getDatabaseUrl } from './dbConfig';

// Cached PostgreSQL client to avoid connection pool leaks
let cachedPostgres: { db: ReturnType<typeof drizzle>, pool: Pool } | null = null;
let cacheInitialized = false;

/**
 * Get the PostgreSQL connection string
 * Uses the centralized dbConfig module which handles:
 * 1. DATABASE_URL environment variable
 * 2. Individual PG* environment variables
 * 3. Local config file fallback (temporary workaround)
 */
export function getConnectionString(): string | undefined {
  return getDatabaseUrl();
}

/**
 * Runtime PostgreSQL database resolver with caching
 * Returns database client if DATABASE_URL is available and connection works
 * Returns undefined if no PostgreSQL configuration is available
 * Throws if connection string exists but connection fails
 * 
 * IMPORTANT: This function caches the connection pool to prevent socket leaks
 */
export async function resolvePostgres(): Promise<{ db: ReturnType<typeof drizzle>, pool: Pool } | undefined> {
  // Return cached client if already initialized
  if (cacheInitialized) {
    return cachedPostgres || undefined;
  }

  // Get connection string (tries DATABASE_URL first, then constructs from PG* vars)
  const connectionString = getConnectionString();
  
  if (!connectionString) {
    cacheInitialized = true;
    cachedPostgres = null;
    return undefined; // No PostgreSQL configuration available
  }

  try {
    // Create connection pool (only once) using native pg driver
    const pool = new Pool({ connectionString });
    const db = drizzle(pool, { schema });

    // Lightweight connection test - verify database is accessible
    await db.execute(sql`SELECT 1`);

    // Cache the connection
    cachedPostgres = { db, pool };
    cacheInitialized = true;

    return cachedPostgres;
  } catch (error: any) {
    cacheInitialized = true;
    cachedPostgres = null;
    
    throw new Error(
      `PostgreSQL connection failed: ${error.message}. ` +
      `Check database credentials and network connectivity.`
    );
  }
}

/**
 * Get cached PostgreSQL client (throws if not initialized or unavailable)
 * Use this for code that requires PostgreSQL to be active
 */
export function getPostgresClient() {
  if (!cacheInitialized) {
    throw new Error('PostgreSQL client not initialized. Call resolvePostgres() first.');
  }
  if (!cachedPostgres) {
    throw new Error('PostgreSQL is not available (DATABASE_URL not configured)');
  }
  return cachedPostgres;
}
