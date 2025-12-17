import type { IStorage } from './storage';
import { postgresStorage } from './postgresStorage';
import { memStorage } from './memStorage';
import { resolvePostgres } from './postgresClient';

/**
 * STORAGE FACTORY WITH DUAL-MODE SUPPORT
 * 
 * Storage selection is based on DATABASE_URL environment variable:
 * - DATABASE_URL present → PostgreSQL storage (production mode)
 * - DATABASE_URL absent → File-based storage (preview/development mode)
 * 
 * This allows the application to run in Replit Preview without
 * database credentials while still supporting full PostgreSQL
 * in production deployments.
 */

let storageInitialized = false;
let storageInstance: IStorage | null = null;
let currentStorageMode: 'postgres' | 'file' = 'file';

/**
 * Check if PostgreSQL is available (DATABASE_URL is set)
 */
export function isPostgresAvailable(): boolean {
  return !!process.env.DATABASE_URL;
}

/**
 * Get the current storage mode
 */
export function getStorageMode(): 'postgres' | 'file' {
  return currentStorageMode;
}

/**
 * Initialize storage based on environment
 * - If DATABASE_URL is set, uses PostgreSQL
 * - If DATABASE_URL is not set, falls back to file-based storage
 */
export async function initializeStorage(): Promise<IStorage> {
  if (storageInitialized && storageInstance) {
    return storageInstance;
  }

  console.log('[StorageFactory] ═══════════════════════════════════════════════════════');
  
  // Check if DATABASE_URL is available
  if (process.env.DATABASE_URL) {
    console.log('[StorageFactory] DATABASE_URL found - attempting PostgreSQL connection...');
    
    try {
      // Verify PostgreSQL connection
      const postgres = await resolvePostgres();
      if (postgres) {
        console.log('[StorageFactory] ✓ PostgreSQL connection verified');
        console.log('[StorageFactory] ✓ Using PostgreSQL storage');
        console.log('[StorageFactory] ═══════════════════════════════════════════════════════');
        
        // PostgresStorage implements the IStorage interface
        storageInstance = postgresStorage as unknown as IStorage;
        storageInitialized = true;
        currentStorageMode = 'postgres';
        return storageInstance;
      }
    } catch (error: any) {
      console.error(`[StorageFactory] ⚠ PostgreSQL connection failed: ${error.message}`);
      console.log('[StorageFactory] Falling back to file-based storage...');
    }
  } else {
    console.log('[StorageFactory] DATABASE_URL not set');
  }
  
  // Fall back to file-based storage
  console.log('[StorageFactory] ✓ Using file-based storage (test-data.json)');
  console.log('[StorageFactory] ⚠ Data changes in this mode are for preview only');
  console.log('[StorageFactory] ═══════════════════════════════════════════════════════');
  
  // Use type assertion for preview mode - MemStorage implements core methods
  // but may not have all IStorage methods (acceptable for UI preview)
  storageInstance = memStorage as unknown as IStorage;
  storageInitialized = true;
  currentStorageMode = 'file';
  return storageInstance;
}

/**
 * Get the storage instance (synchronous)
 * Must be called after initializeStorage() completes
 */
export function getStorage(): IStorage {
  if (!storageInitialized || !storageInstance) {
    throw new Error(
      'Storage not initialized. Call initializeStorage() before getStorage(). ' +
      'This error typically occurs when storage is accessed before server startup completes.'
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
  currentStorageMode = 'file';
}

// Type export for backwards compatibility
export type StorageMode = 'postgres' | 'file';
