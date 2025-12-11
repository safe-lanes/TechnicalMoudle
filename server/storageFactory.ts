import type { IStorage } from './storage';
import { PersistentFileStorage } from './persistentStorage';
import { HybridStorage, createHybridStorage } from './hybridStorage';
import { resolvePostgres } from './postgresClient';

export type StorageMode = 'file' | 'hybrid' | 'postgres';

/**
 * Get the current storage mode from environment
 * Default is 'hybrid' when DATABASE_URL is available, 'file' otherwise
 */
export function getStorageMode(): StorageMode {
  const mode = process.env.STORAGE_MODE?.toLowerCase();
  if (mode === 'file') return 'file';
  if (mode === 'postgres' || mode === 'postgresql') return 'hybrid';
  return process.env.DATABASE_URL ? 'hybrid' : 'file';
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
 * - When DATABASE_URL is available, use HybridStorage
 * - HybridStorage routes Module 1 (users, fleets, vessels, pms_vessel_settings) to PostgreSQL
 * - All other modules continue to use PersistentFileStorage until migrated
 * - When no DATABASE_URL, fall back to pure file storage
 */
class StorageFactory {
  private static instance: IStorage | null = null;
  private static mode: StorageMode | null = null;
  private static initializationPromise: Promise<IStorage> | null = null;

  static async getStorageAsync(): Promise<IStorage> {
    const currentMode = getStorageMode();
    
    if (this.instance && this.mode === currentMode) {
      return this.instance;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.initializeStorage(currentMode);
    return this.initializationPromise;
  }

  private static async initializeStorage(mode: StorageMode): Promise<IStorage> {
    console.log(`[StorageFactory] Initializing storage in ${mode} mode`);

    switch (mode) {
      case 'hybrid':
        if (!isPostgresAvailable()) {
          console.warn('[StorageFactory] DATABASE_URL not set, falling back to file storage');
          this.instance = new PersistentFileStorage();
        } else {
          try {
            const postgres = await resolvePostgres();
            if (postgres) {
              console.log('[StorageFactory] PostgreSQL connection verified - using HybridStorage');
              console.log('[StorageFactory] Module 1 (users, fleets, vessels, pms_vessel_settings) → PostgreSQL');
              console.log('[StorageFactory] All other modules → PersistentFileStorage');
              this.instance = await createHybridStorage();
            } else {
              console.warn('[StorageFactory] PostgreSQL connection failed, falling back to file storage');
              this.instance = new PersistentFileStorage();
            }
          } catch (error: any) {
            console.error('[StorageFactory] PostgreSQL initialization error:', error.message);
            console.warn('[StorageFactory] Falling back to file storage');
            this.instance = new PersistentFileStorage();
          }
        }
        break;
        
      case 'file':
      default:
        console.log('[StorageFactory] Using PersistentFileStorage for all operations');
        this.instance = new PersistentFileStorage();
        break;
    }

    this.mode = mode;
    this.initializationPromise = null;
    return this.instance!;
  }

  static getStorage(): IStorage {
    if (!this.instance) {
      console.warn('[StorageFactory] getStorage() called before async initialization - using sync fallback');
      const mode = getStorageMode();
      
      if (mode === 'hybrid' && isPostgresAvailable()) {
        console.log('[StorageFactory] Creating HybridStorage synchronously - initialize() must be called');
        this.instance = new HybridStorage();
      } else {
        this.instance = new PersistentFileStorage();
      }
      this.mode = mode;
    }
    return this.instance!;
  }

  static resetInstance(): void {
    this.instance = null;
    this.mode = null;
    this.initializationPromise = null;
  }
}

export async function initializeStorage(): Promise<IStorage> {
  return StorageFactory.getStorageAsync();
}

export function getStorage(): IStorage {
  return StorageFactory.getStorage();
}

export { StorageFactory };
