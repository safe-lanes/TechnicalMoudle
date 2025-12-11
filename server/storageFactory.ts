import type { IStorage } from './storage';
import { PersistentFileStorage } from './persistentStorage';

export type StorageMode = 'file' | 'postgres' | 'dual';

/**
 * Get the current storage mode from environment
 * Default is 'file' for backward compatibility
 */
export function getStorageMode(): StorageMode {
  const mode = process.env.STORAGE_MODE?.toLowerCase();
  if (mode === 'postgres' || mode === 'postgresql') return 'postgres';
  if (mode === 'dual') return 'dual';
  return 'file';
}

/**
 * Check if PostgreSQL is available (DATABASE_URL is set)
 */
export function isPostgresAvailable(): boolean {
  return !!process.env.DATABASE_URL;
}

/**
 * Storage Factory - returns appropriate storage implementation
 * 
 * MIGRATION STRATEGY:
 * - During incremental migration, we use PersistentFileStorage as the base
 * - PostgresStorage methods are only used when directly called for Module 1 operations
 * - Full postgres mode requires all IStorage methods to be implemented in PostgresStorage
 * - Until then, file mode is the safe default
 * 
 * After all modules are migrated to PostgresStorage, the factory will return
 * PostgresStorage directly for postgres mode.
 */
class StorageFactory {
  private static instance: IStorage | null = null;
  private static mode: StorageMode | null = null;

  static getStorage(): IStorage {
    const currentMode = getStorageMode();
    
    if (this.instance && this.mode === currentMode) {
      return this.instance;
    }

    console.log(`[StorageFactory] Initializing storage in ${currentMode} mode`);

    switch (currentMode) {
      case 'postgres':
        if (!isPostgresAvailable()) {
          console.warn('[StorageFactory] PostgreSQL not available (no DATABASE_URL), falling back to file storage');
          this.instance = new PersistentFileStorage();
        } else {
          console.log('[StorageFactory] PostgreSQL mode requested - using PersistentFileStorage until full migration complete');
          console.log('[StorageFactory] Module 1 (users, fleets, vessels, pms_vessel_settings) can be accessed via PostgresStorage directly');
          this.instance = new PersistentFileStorage();
        }
        break;
      case 'dual':
        if (!isPostgresAvailable()) {
          console.warn('[StorageFactory] Dual mode requires DATABASE_URL, falling back to file storage');
          this.instance = new PersistentFileStorage();
        } else {
          console.log('[StorageFactory] Dual-write mode - using PersistentFileStorage (PostgresStorage for validation)');
          this.instance = new PersistentFileStorage();
        }
        break;
      case 'file':
      default:
        this.instance = new PersistentFileStorage();
        break;
    }

    this.mode = currentMode;
    return this.instance!;
  }

  static resetInstance(): void {
    this.instance = null;
    this.mode = null;
  }
}

export function getStorage(): IStorage {
  return StorageFactory.getStorage();
}

export { StorageFactory };
