import { useState } from 'react';
import { useLocation } from 'wouter';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useOffline } from '@/contexts/OfflineContext';
import { SyncConflictDialog } from './SyncConflictDialog';

export function SyncStatusIndicator() {
  const { status, syncNow } = useOffline();
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [, setLocation] = useLocation();

  const hasPendingChanges = status.pendingCount > 0 || status.failedCount > 0 || status.conflictCount > 0;
  
  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="relative h-8 px-2"
            data-testid="sync-status-indicator"
          >
            {status.isOnline ? (
              status.isSyncing ? (
                <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
              ) : hasPendingChanges ? (
                <Cloud className="h-4 w-4 text-yellow-500" />
              ) : (
                <Cloud className="h-4 w-4 text-green-500" />
              )
            ) : (
              <CloudOff className="h-4 w-4 text-red-500" />
            )}
            
            {hasPendingChanges && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-yellow-500 text-[10px] text-white flex items-center justify-center">
                {status.pendingCount + status.failedCount + status.conflictCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-64" align="end">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Sync Status</span>
              <Badge variant={status.isOnline ? 'default' : 'destructive'}>
                {status.isOnline ? 'Online' : 'Offline'}
              </Badge>
            </div>
            
            <div className="text-xs text-muted-foreground">
              Last sync: {formatLastSync(status.lastSyncTime)}
            </div>
            
            {status.pendingCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <RefreshCw className="h-4 w-4 text-blue-500" />
                <span>{status.pendingCount} pending changes</span>
              </div>
            )}
            
            {status.failedCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertTriangle className="h-4 w-4" />
                <span>{status.failedCount} failed syncs</span>
              </div>
            )}
            
            {status.conflictCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span>{status.conflictCount} conflicts</span>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="h-auto p-0 text-xs"
                  onClick={() => setConflictDialogOpen(true)}
                  data-testid="btn-resolve-conflicts"
                >
                  Resolve
                </Button>
              </div>
            )}
            
            {!hasPendingChanges && status.isOnline && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <Check className="h-4 w-4" />
                <span>All changes synced</span>
              </div>
            )}
            
            <Button
              size="sm"
              className="w-full"
              onClick={syncNow}
              disabled={!status.isOnline || status.isSyncing}
              data-testid="btn-sync-now"
            >
              {status.isSyncing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Now
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => setLocation('/admin/sync-dashboard')}
              data-testid="btn-open-sync-dashboard"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open Sync Dashboard
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      
      <SyncConflictDialog 
        open={conflictDialogOpen} 
        onOpenChange={setConflictDialogOpen} 
      />
    </>
  );
}
