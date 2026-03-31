import type { IStorage } from './storage';
import { postgresStorage } from './postgresStorage';
import { resolvePostgres } from './postgresClient';

let storageInitialized = false;
let storageInstance: IStorage | null = null;

export function isPostgresAvailable(): boolean {
  return !!process.env.DATABASE_URL;
}

export async function initializeStorage(): Promise<IStorage> {
  if (storageInitialized && storageInstance) {
    return storageInstance;
  }

  console.log('[StorageFactory] ═══════════════════════════════════════════════════════');

  if (!process.env.DATABASE_URL) {
    const errorMessage = `
╔════════════════════════════════════════════════════════════════════════════╗
║                    DATABASE_URL REQUIRED                                   ║
╠════════════════════════════════════════════════════════════════════════════╣
║  DATABASE_URL environment variable is not set.                             ║
║                                                                            ║
║  This application requires a PostgreSQL database to run.                   ║
║  Set DATABASE_URL to a valid PostgreSQL connection string.                  ║
╚════════════════════════════════════════════════════════════════════════════╝
`;
    console.error(errorMessage);
    throw new Error('DATABASE_URL is required. This application requires a PostgreSQL database.');
  }

  console.log('[StorageFactory] DATABASE_URL found - attempting PostgreSQL connection...');

  try {
    const postgres = await resolvePostgres();
    if (postgres) {
      console.log('[StorageFactory] ✓ PostgreSQL connection verified');
      console.log('[StorageFactory] ✓ Using PostgreSQL storage');
      console.log('[StorageFactory] ═══════════════════════════════════════════════════════');

      storageInstance = postgresStorage as unknown as IStorage;
      storageInitialized = true;
      return storageInstance;
    }
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

  throw new Error('PostgreSQL connection could not be established.');
}

export function getStorage(): IStorage {
  if (!storageInitialized || !storageInstance) {
    throw new Error(
      'Storage not initialized. Call initializeStorage() before getStorage(). ' +
      'This error typically occurs when storage is accessed before server startup completes.'
    );
  }
  return storageInstance;
}

export function resetStorage(): void {
  storageInstance = null;
  storageInitialized = false;
}
