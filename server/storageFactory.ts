import type { IStorage } from './storage';
import { postgresStorage } from './postgresStorage';
import { resolvePostgres } from './postgresClient';

/**
 * POSTGRESQL-ONLY STORAGE FACTORY
 * 
 * This application requires PostgreSQL to be configured.
 * If DATABASE_URL is not set or PostgreSQL connection fails,
 * the application will fail to start with a clear error message.
 * 
 * MIGRATION COMPLETE:
 * - All 17 modules now use PostgreSQL storage
 * - No file storage fallbacks (test-data.json eliminated)
 * - No hybrid mode - PostgreSQL is the only storage option
 */

let storageInitialized = false;
let storageInstance: IStorage | null = null;

/**
 * Check if PostgreSQL is available (DATABASE_URL is set)
 */
export function isPostgresAvailable(): boolean {
  return !!process.env.DATABASE_URL;
}

/**
 * Validate that PostgreSQL is properly configured
 * Throws an error if DATABASE_URL is not set
 */
function validatePostgresConfig(): void {
  if (!process.env.DATABASE_URL) {
    const errorMessage = `
╔════════════════════════════════════════════════════════════════════════════╗
║                    POSTGRESQL DATABASE REQUIRED                            ║
╠════════════════════════════════════════════════════════════════════════════╣
║  This application requires PostgreSQL to operate.                          ║
║                                                                            ║
║  To fix this:                                                              ║
║  1. Provision a PostgreSQL database in the Replit Database panel           ║
║  2. Ensure DATABASE_URL environment variable is set                        ║
║                                                                            ║
║  File-based storage (test-data.json) has been removed.                     ║
║  PostgreSQL is now the ONLY supported storage option.                      ║
╚════════════════════════════════════════════════════════════════════════════╝
`;
    console.error(errorMessage);
    throw new Error('DATABASE_URL is required. PostgreSQL database must be configured.');
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
