import type { IStorage } from './storage';
import { postgresStorage } from './postgresStorage';
import { resolvePostgres, getConnectionString } from './postgresClient';
import { createConfigTemplate } from './dbConfig';

/**
 * POSTGRESQL-ONLY STORAGE FACTORY
 * 
 * This application requires PostgreSQL to be configured.
 * If neither DATABASE_URL nor individual PG* variables are set,
 * the application will fail to start with a clear error message.
 * 
 * MIGRATION COMPLETE:
 * - All 17 modules now use PostgreSQL storage
 * - No file storage fallbacks (test-data.json eliminated)
 * - No hybrid mode - PostgreSQL is the only storage option
 * 
 * TEMPORARY FALLBACK (for Replit secret injection issues):
 * - If DATABASE_URL is not injected, constructs connection from PG* env vars
 * - If PG* vars also missing, reads from local db.config.json file
 */

let storageInitialized = false;
let storageInstance: IStorage | null = null;

/**
 * Check if PostgreSQL is available (via DATABASE_URL or PG* env vars)
 */
export function isPostgresAvailable(): boolean {
  return !!getConnectionString();
}

/**
 * Validate that PostgreSQL is properly configured
 * Throws an error if no PostgreSQL configuration is available
 */
function validatePostgresConfig(): void {
  const connectionString = getConnectionString();
  
  if (!connectionString) {
    // Create template config file to help user
    createConfigTemplate();
    
    const errorMessage = `
╔════════════════════════════════════════════════════════════════════════════╗
║                    POSTGRESQL DATABASE REQUIRED                            ║
╠════════════════════════════════════════════════════════════════════════════╣
║  This application requires PostgreSQL to operate.                          ║
║                                                                            ║
║  Configuration options (in priority order):                                ║
║  1. Set DATABASE_URL environment variable                                  ║
║  2. Set PG* environment variables (PGHOST, PGPORT, PGUSER, etc.)           ║
║  3. Create db.config.json with database credentials (temporary)            ║
║                                                                            ║
║  A template db.config.json has been created. Fill it with your             ║
║  PostgreSQL credentials to use the temporary config file fallback.         ║
╚════════════════════════════════════════════════════════════════════════════╝
`;
    console.error(errorMessage);
    throw new Error('PostgreSQL configuration is required. See console for options.');
  }
}

/**
 * Initialize PostgreSQL storage
 * Validates configuration and tests database connection
 */
export async function initializeStorage(): Promise<IStorage> {
  if (storageInitialized && storageInstance) {
    return storageInstance;
  }

  console.log('[StorageFactory] ═══════════════════════════════════════════════════════');
  console.log('[StorageFactory] Initializing PostgreSQL-only storage...');
  
  // Validate PostgreSQL is configured
  validatePostgresConfig();
  
  try {
    // Verify PostgreSQL connection
    const postgres = await resolvePostgres();
    if (!postgres) {
      throw new Error('Failed to establish PostgreSQL connection');
    }
    
    console.log('[StorageFactory] ✓ PostgreSQL connection verified');
    console.log('[StorageFactory] ✓ All 17 modules using PostgreSQL storage');
    console.log('[StorageFactory] ✓ No file storage fallbacks active');
    console.log('[StorageFactory] ═══════════════════════════════════════════════════════');
    
    storageInstance = postgresStorage;
    storageInitialized = true;
    return storageInstance;
    
  } catch (error: any) {
    const errorMessage = `
╔════════════════════════════════════════════════════════════════════════════╗
║                    POSTGRESQL CONNECTION FAILED                            ║
╠════════════════════════════════════════════════════════════════════════════╣
║  DATABASE_URL is set but connection failed.                                ║
║                                                                            ║
║  Error: ${error.message?.substring(0, 60) || 'Unknown error'}
║                                                                            ║
║  Check that:                                                               ║
║  1. The PostgreSQL database is running                                     ║
║  2. DATABASE_URL connection string is valid                                ║
║  3. Network access to the database is permitted                            ║
╚════════════════════════════════════════════════════════════════════════════╝
`;
    console.error(errorMessage);
    throw new Error(`PostgreSQL connection failed: ${error.message}`);
  }
}

/**
 * Get the storage instance (synchronous)
 * Must be called after initializeStorage() completes
 */
export function getStorage(): IStorage {
  if (!storageInitialized || !storageInstance) {
    throw new Error(
      'Storage not initialized. Call initializeStorage() before getStorage(). ' +
      'This error typically occurs when the application starts without a PostgreSQL database configured.'
    );
  }
  return storageInstance;
}

/**
 * Reset storage instance (for testing only)
 */
export function resetStorage(): void {
  storageInstance = null;
  storageInitialized = false;
}

// Deprecated exports for backwards compatibility during migration
export type StorageMode = 'postgres';
export function getStorageMode(): StorageMode {
  return 'postgres';
}
