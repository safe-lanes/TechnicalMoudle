import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from "@shared/schema";

// Cached PostgreSQL client to avoid connection pool leaks
let cachedPostgres: { db: ReturnType<typeof drizzle>, pool: Pool } | null = null;
let cacheInitialized = false;

/**
 * Get the PostgreSQL connection string from DATABASE_URL only
 * No fallback to config files - environment variable is the only source
 */
export function getConnectionString(): string | undefined {
  return process.env.DATABASE_URL;
}

/**
 * Runtime PostgreSQL database resolver with caching
 * Returns database client if DATABASE_URL is available and connection works
 * Returns undefined if DATABASE_URL is not set (file-storage mode)
 * Throws if DATABASE_URL exists but connection fails
 * 
 * IMPORTANT: This function caches the connection pool to prevent socket leaks
 */
export async function resolvePostgres(): Promise<{ db: ReturnType<typeof drizzle>, pool: Pool } | undefined> {
  // Return cached client if already initialized
  if (cacheInitialized) {
    return cachedPostgres || undefined;
  }

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    cacheInitialized = true;
    cachedPostgres = null;
    return undefined; // File-storage mode
  }

  try {
    // Create connection pool (only once) using native pg driver
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
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
      `PostgreSQL connection failed despite DATABASE_URL being set: ${error.message}. ` +
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

/**
 * Reset cached state (for testing only)
 */
export function resetPostgresCache(): void {
  cachedPostgres = null;
  cacheInitialized = false;
}
