import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { offlineStorage, SyncQueueItem } from '@/lib/offlineStorage';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { getCreateJobUrl, getUpdateJobUrl, getDeleteJobUrl } from '@/modules/components/api/jobsApiV2';

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  conflictCount: number;
  lastSyncTime: number | null;
}

interface OfflineContextType {
  status: SyncStatus;
  syncNow: () => Promise<void>;
  addPendingChange: (
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    entityType: 'component' | 'job' | 'workOrder' | 'spare' | 'defect' | 'runningHours',
    entityId: string,
    data: any
  ) => Promise<void>;
  getConflicts: () => Promise<SyncQueueItem[]>;
  resolveConflict: (
    syncItemId: string,
    resolution: 'keepLocal' | 'keepServer' | 'merge',
    mergedData?: any
  ) => Promise<void>;
  getCachedData: <T>(entityType: string, vesselId?: string) => Promise<T[]>;
  cacheData: (entityType: string, entityId: string, vesselId: string, data: any) => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

const ENTITY_ENDPOINTS: Record<string, { create: () => string; update: (id: string) => string; delete: (id: string) => string }> = {
  component: {
    create: () => '/technical/api/components',
    update: (id) => `/technical/api/components/${id}`,
    delete: (id) => `/technical/api/components/${id}`
  },
  job: {
    create: () => getCreateJobUrl(),
    update: (id) => getUpdateJobUrl(id),
    delete: (id) => getDeleteJobUrl(id)
  },
  workOrder: {
    create: () => '/technical/api/work-orders',
    update: (id) => `/technical/api/work-orders/${id}`,
    delete: (id) => `/technical/api/work-orders/${id}`
  },
  spare: {
    create: () => '/technical/api/spares',
    update: (id) => `/technical/api/spares/${id}`,
    delete: (id) => `/technical/api/spares/${id}`
  },
  defect: {
    create: () => '/technical/api/defects',
    update: (id) => `/technical/api/defects/${id}`,
    delete: (id) => `/technical/api/defects/${id}`
  },
  runningHours: {
    create: () => '/technical/api/running-hours/cascade-update',
    update: (id) => `/technical/api/running-hours/cascade-update`,
    delete: (id) => `/technical/api/running-hours/${id}`
  }
};

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
    failedCount: 0,
    conflictCount: 0,
    lastSyncTime: null
  });

  const updateCounts = useCallback(async () => {
    const pending = await offlineStorage.getPendingSyncItems();
    const failed = await offlineStorage.getFailedSyncItems();
    const conflicts = await offlineStorage.getConflictItems();
    const lastSync = await offlineStorage.getLastSyncTime();
    
    setStatus(prev => ({
      ...prev,
      pendingCount: pending.length,
      failedCount: failed.length,
      conflictCount: conflicts.length,
      lastSyncTime: lastSync
    }));
  }, []);

  useEffect(() => {
    offlineStorage.init().then(() => updateCounts());
    
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }));
      toast({ title: 'Back online', description: 'Syncing pending changes...' });
      syncNow();
    };
    
    const handleOffline = () => {
      setStatus(prev => ({ ...prev, isOnline: false }));
      toast({ 
        title: 'You are offline', 
        description: 'Changes will be saved locally and synced when back online.',
        variant: 'destructive'
      });
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine) {
      toast({ title: 'Cannot sync', description: 'You are currently offline', variant: 'destructive' });
      return;
    }
    
    setStatus(prev => ({ ...prev, isSyncing: true }));
    
    try {
      const pendingItems = await offlineStorage.getPendingSyncItems();
      
      for (const item of pendingItems) {
        await offlineStorage.updateSyncItemStatus(item.id, 'syncing');
        
        try {
          const endpoints = ENTITY_ENDPOINTS[item.entityType];
          if (!endpoints) {
            throw new Error(`Unknown entity type: ${item.entityType}`);
          }
          
          let response;
          switch (item.operation) {
            case 'CREATE':
              response = await apiRequest('POST', endpoints.create(), item.data);
              break;
            case 'UPDATE':
              response = await apiRequest('PATCH', endpoints.update(item.entityId), item.data);
              break;
            case 'DELETE':
              response = await apiRequest('DELETE', endpoints.delete(item.entityId));
              break;
          }
          
          await offlineStorage.removeSyncItem(item.id);
          
        } catch (error: any) {
          if (error.status === 409) {
            const serverData = error.data;
            await offlineStorage.updateSyncItemStatus(
              item.id,
              'conflict',
              'Server data has been modified',
              serverData
            );
          } else if (item.retryCount >= 3) {
            await offlineStorage.updateSyncItemStatus(
              item.id,
              'failed',
              error.message || 'Max retries exceeded'
            );
          } else {
            await offlineStorage.updateSyncItemStatus(
              item.id,
              'pending',
              error.message
            );
          }
        }
      }
      
      await offlineStorage.setLastSyncTime(Date.now());
      await updateCounts();
      
      const conflicts = await offlineStorage.getConflictItems();
      if (conflicts.length > 0) {
        toast({ 
          title: 'Sync conflicts detected', 
          description: `${conflicts.length} item(s) need your attention`,
          variant: 'destructive'
        });
      } else {
        toast({ title: 'Sync complete', description: 'All changes have been synchronized' });
      }
      
    } catch (error: any) {
      toast({ 
        title: 'Sync failed', 
        description: error.message || 'Failed to sync changes',
        variant: 'destructive'
      });
    } finally {
      setStatus(prev => ({ ...prev, isSyncing: false }));
    }
  }, [toast, updateCounts]);

  const addPendingChange = useCallback(async (
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    entityType: 'component' | 'job' | 'workOrder' | 'spare' | 'defect' | 'runningHours',
    entityId: string,
    data: any
  ) => {
    await offlineStorage.addToSyncQueue(operation, entityType, entityId, data);
    await updateCounts();
    
    if (navigator.onLine) {
      syncNow();
    }
  }, [syncNow, updateCounts]);

  const getConflicts = useCallback(async () => {
    return offlineStorage.getConflictItems();
  }, []);

  const resolveConflict = useCallback(async (
    syncItemId: string,
    resolution: 'keepLocal' | 'keepServer' | 'merge',
    mergedData?: any
  ) => {
    await offlineStorage.resolveConflict(syncItemId, resolution, mergedData);
    await updateCounts();
    
    if (resolution !== 'keepServer' && navigator.onLine) {
      syncNow();
    }
  }, [syncNow, updateCounts]);

  const getCachedData = useCallback(async <T,>(entityType: string, vesselId?: string): Promise<T[]> => {
    return offlineStorage.getCachedDataByType(entityType, vesselId) as Promise<T[]>;
  }, []);

  const cacheData = useCallback(async (
    entityType: string, 
    entityId: string, 
    vesselId: string, 
    data: any
  ) => {
    await offlineStorage.cacheData(entityType, entityId, vesselId, data);
  }, []);

  return (
    <OfflineContext.Provider value={{
      status,
      syncNow,
      addPendingChange,
      getConflicts,
      resolveConflict,
      getCachedData,
      cacheData
    }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}

export function useOfflineStatus() {
  const { status } = useOffline();
  return status;
}
