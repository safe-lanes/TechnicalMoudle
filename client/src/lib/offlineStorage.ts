import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface SyncQueueItem {
  id: string;
  timestamp: number;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: 'component' | 'job' | 'workOrder' | 'spare' | 'defect' | 'runningHours';
  entityId: string;
  data: any;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed' | 'conflict';
  serverVersion?: any;
  errorMessage?: string;
}

interface CachedEntity {
  id: string;
  entityType: string;
  data: any;
  lastFetched: number;
  vesselId: string;
}

interface PMSOfflineDB extends DBSchema {
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: { 'by-status': string; 'by-timestamp': number; 'by-entity': [string, string] };
  };
  cachedData: {
    key: string;
    value: CachedEntity;
    indexes: { 'by-type': string; 'by-vessel': string; 'by-type-vessel': [string, string] };
  };
  metadata: {
    key: string;
    value: { key: string; value: any };
  };
}

const DB_NAME = 'pms-offline-db';
const DB_VERSION = 1;

class OfflineStorageService {
  private db: IDBPDatabase<PMSOfflineDB> | null = null;
  private initPromise: Promise<IDBPDatabase<PMSOfflineDB>> | null = null;

  async init(): Promise<IDBPDatabase<PMSOfflineDB>> {
    if (this.db) return this.db;
    
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = openDB<PMSOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('by-status', 'status');
          syncStore.createIndex('by-timestamp', 'timestamp');
          syncStore.createIndex('by-entity', ['entityType', 'entityId']);
        }
        
        if (!db.objectStoreNames.contains('cachedData')) {
          const cacheStore = db.createObjectStore('cachedData', { keyPath: 'id' });
          cacheStore.createIndex('by-type', 'entityType');
          cacheStore.createIndex('by-vessel', 'vesselId');
          cacheStore.createIndex('by-type-vessel', ['entityType', 'vesselId']);
        }
        
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      }
    });
    
    this.db = await this.initPromise;
    return this.db;
  }

  async addToSyncQueue(
    operation: SyncQueueItem['operation'],
    entityType: SyncQueueItem['entityType'],
    entityId: string,
    data: any
  ): Promise<string> {
    const db = await this.init();
    const id = `${entityType}-${entityId}-${Date.now()}`;
    
    const queueItem: SyncQueueItem = {
      id,
      timestamp: Date.now(),
      operation,
      entityType,
      entityId,
      data,
      retryCount: 0,
      status: 'pending'
    };
    
    await db.put('syncQueue', queueItem);
    return id;
  }

  async getPendingSyncItems(): Promise<SyncQueueItem[]> {
    const db = await this.init();
    return db.getAllFromIndex('syncQueue', 'by-status', 'pending');
  }

  async getFailedSyncItems(): Promise<SyncQueueItem[]> {
    const db = await this.init();
    return db.getAllFromIndex('syncQueue', 'by-status', 'failed');
  }

  async getConflictItems(): Promise<SyncQueueItem[]> {
    const db = await this.init();
    return db.getAllFromIndex('syncQueue', 'by-status', 'conflict');
  }

  async updateSyncItemStatus(
    id: string, 
    status: SyncQueueItem['status'],
    errorMessage?: string,
    serverVersion?: any
  ): Promise<void> {
    const db = await this.init();
    const item = await db.get('syncQueue', id);
    if (item) {
      item.status = status;
      item.retryCount = (item.retryCount || 0) + (status === 'failed' ? 1 : 0);
      if (errorMessage) item.errorMessage = errorMessage;
      if (serverVersion) item.serverVersion = serverVersion;
      await db.put('syncQueue', item);
    }
  }

  async removeSyncItem(id: string): Promise<void> {
    const db = await this.init();
    await db.delete('syncQueue', id);
  }

  async cacheData(
    entityType: string,
    entityId: string,
    vesselId: string,
    data: any
  ): Promise<void> {
    const db = await this.init();
    const id = `${entityType}-${entityId}`;
    
    await db.put('cachedData', {
      id,
      entityType,
      data,
      lastFetched: Date.now(),
      vesselId
    });
  }

  async getCachedData(entityType: string, entityId: string): Promise<any | null> {
    const db = await this.init();
    const cached = await db.get('cachedData', `${entityType}-${entityId}`);
    return cached?.data || null;
  }

  async getCachedDataByType(entityType: string, vesselId?: string): Promise<any[]> {
    const db = await this.init();
    
    if (vesselId) {
      const items = await db.getAllFromIndex('cachedData', 'by-type-vessel', [entityType, vesselId]);
      return items.map(item => item.data);
    }
    
    const items = await db.getAllFromIndex('cachedData', 'by-type', entityType);
    return items.map(item => item.data);
  }

  async clearCachedData(entityType?: string): Promise<void> {
    const db = await this.init();
    
    if (entityType) {
      const items = await db.getAllFromIndex('cachedData', 'by-type', entityType);
      const tx = db.transaction('cachedData', 'readwrite');
      await Promise.all(items.map(item => tx.store.delete(item.id)));
      await tx.done;
    } else {
      await db.clear('cachedData');
    }
  }

  async setMetadata(key: string, value: any): Promise<void> {
    const db = await this.init();
    await db.put('metadata', { key, value });
  }

  async getMetadata(key: string): Promise<any | null> {
    const db = await this.init();
    const item = await db.get('metadata', key);
    return item?.value || null;
  }

  async getLastSyncTime(): Promise<number | null> {
    return this.getMetadata('lastSyncTime');
  }

  async setLastSyncTime(timestamp: number): Promise<void> {
    return this.setMetadata('lastSyncTime', timestamp);
  }

  async getSyncQueueCount(): Promise<number> {
    const db = await this.init();
    return db.count('syncQueue');
  }

  async getPendingCount(): Promise<number> {
    const db = await this.init();
    return db.countFromIndex('syncQueue', 'by-status', 'pending');
  }

  async resolveConflict(
    syncItemId: string, 
    resolution: 'keepLocal' | 'keepServer' | 'merge',
    mergedData?: any
  ): Promise<void> {
    const db = await this.init();
    const item = await db.get('syncQueue', syncItemId);
    
    if (!item) return;
    
    if (resolution === 'keepServer') {
      await db.delete('syncQueue', syncItemId);
      if (item.serverVersion) {
        await this.cacheData(
          item.entityType,
          item.entityId,
          item.data?.vesselId || 'V001',
          item.serverVersion
        );
      }
    } else if (resolution === 'keepLocal') {
      item.status = 'pending';
      item.retryCount = 0;
      item.errorMessage = undefined;
      item.serverVersion = undefined;
      await db.put('syncQueue', item);
    } else if (resolution === 'merge' && mergedData) {
      item.data = mergedData;
      item.status = 'pending';
      item.retryCount = 0;
      item.errorMessage = undefined;
      item.serverVersion = undefined;
      await db.put('syncQueue', item);
    }
  }

  async clearAll(): Promise<void> {
    const db = await this.init();
    await db.clear('syncQueue');
    await db.clear('cachedData');
    await db.clear('metadata');
  }
}

export const offlineStorage = new OfflineStorageService();
export type { SyncQueueItem, CachedEntity };
