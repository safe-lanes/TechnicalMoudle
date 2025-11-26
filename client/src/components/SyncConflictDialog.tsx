import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Check, X, GitMerge, ArrowLeft, ArrowRight } from 'lucide-react';
import { useOffline } from '@/contexts/OfflineContext';
import { SyncQueueItem } from '@/lib/offlineStorage';

interface SyncConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SyncConflictDialog({ open, onOpenChange }: SyncConflictDialogProps) {
  const { getConflicts, resolveConflict, status } = useOffline();
  const [conflicts, setConflicts] = useState<SyncQueueItem[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<SyncQueueItem | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    if (open) {
      loadConflicts();
    }
  }, [open, status.conflictCount]);

  const loadConflicts = async () => {
    const items = await getConflicts();
    setConflicts(items);
    if (items.length > 0 && !selectedConflict) {
      setSelectedConflict(items[0]);
    }
  };

  const handleResolve = async (resolution: 'keepLocal' | 'keepServer' | 'merge') => {
    if (!selectedConflict) return;
    
    setIsResolving(true);
    try {
      await resolveConflict(selectedConflict.id, resolution);
      await loadConflicts();
      
      if (conflicts.length <= 1) {
        onOpenChange(false);
      } else {
        const remaining = conflicts.filter(c => c.id !== selectedConflict.id);
        setSelectedConflict(remaining[0] || null);
      }
    } finally {
      setIsResolving(false);
    }
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const getChangedFields = (): string[] => {
    if (!selectedConflict?.data || !selectedConflict?.serverVersion) return [];
    
    const localData = selectedConflict.data;
    const serverData = selectedConflict.serverVersion;
    const changedFields: string[] = [];
    
    const allKeys = Array.from(new Set([...Object.keys(localData), ...Object.keys(serverData)]));
    
    for (const key of allKeys) {
      if (JSON.stringify(localData[key]) !== JSON.stringify(serverData[key])) {
        changedFields.push(key);
      }
    }
    
    return changedFields;
  };

  const entityTypeLabels: Record<string, string> = {
    component: 'Component',
    job: 'Job',
    workOrder: 'Work Order',
    spare: 'Spare Part',
    defect: 'Defect',
    runningHours: 'Running Hours'
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Sync Conflicts ({conflicts.length})
          </DialogTitle>
          <DialogDescription>
            These changes conflict with updates made on the server. Please review and resolve each conflict.
          </DialogDescription>
        </DialogHeader>
        
        {conflicts.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Check className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p>No conflicts to resolve</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-1 border-r pr-4">
              <h4 className="text-sm font-medium mb-2">Conflicts</h4>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {conflicts.map((conflict) => (
                    <button
                      key={conflict.id}
                      onClick={() => setSelectedConflict(conflict)}
                      className={`w-full text-left p-2 rounded-md border transition-colors ${
                        selectedConflict?.id === conflict.id
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent hover:bg-muted'
                      }`}
                      data-testid={`conflict-item-${conflict.id}`}
                    >
                      <Badge variant="outline" className="mb-1">
                        {entityTypeLabels[conflict.entityType] || conflict.entityType}
                      </Badge>
                      <p className="text-sm truncate">
                        {conflict.data?.name || conflict.data?.jobTitle || conflict.data?.partName || conflict.entityId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {conflict.operation}
                      </p>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
            
            <div className="col-span-3">
              {selectedConflict && (
                <>
                  <Tabs defaultValue="compare" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="compare">Compare Changes</TabsTrigger>
                      <TabsTrigger value="details">Full Details</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="compare" className="mt-4">
                      <ScrollArea className="h-[350px]">
                        <div className="space-y-3">
                          {getChangedFields().map((field) => (
                            <div key={field} className="grid grid-cols-3 gap-2 p-2 bg-muted/50 rounded-md">
                              <div className="font-medium text-sm">{field}</div>
                              <div className="text-sm">
                                <Badge variant="outline" className="mb-1 text-xs">Local</Badge>
                                <pre className="text-xs bg-blue-50 dark:bg-blue-950 p-1 rounded overflow-auto max-h-20">
                                  {formatValue(selectedConflict.data?.[field])}
                                </pre>
                              </div>
                              <div className="text-sm">
                                <Badge variant="outline" className="mb-1 text-xs">Server</Badge>
                                <pre className="text-xs bg-green-50 dark:bg-green-950 p-1 rounded overflow-auto max-h-20">
                                  {formatValue(selectedConflict.serverVersion?.[field])}
                                </pre>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                    
                    <TabsContent value="details" className="mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                            <ArrowLeft className="h-4 w-4" /> Your Changes
                          </h4>
                          <ScrollArea className="h-[300px] bg-blue-50 dark:bg-blue-950 rounded-md p-2">
                            <pre className="text-xs">
                              {JSON.stringify(selectedConflict.data, null, 2)}
                            </pre>
                          </ScrollArea>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                            Server Version <ArrowRight className="h-4 w-4" />
                          </h4>
                          <ScrollArea className="h-[300px] bg-green-50 dark:bg-green-950 rounded-md p-2">
                            <pre className="text-xs">
                              {JSON.stringify(selectedConflict.serverVersion, null, 2)}
                            </pre>
                          </ScrollArea>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                  
                  <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => handleResolve('keepServer')}
                      disabled={isResolving}
                      data-testid="btn-keep-server"
                    >
                      <ArrowRight className="h-4 w-4 mr-1" />
                      Keep Server Version
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleResolve('keepLocal')}
                      disabled={isResolving}
                      data-testid="btn-keep-local"
                    >
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Keep My Changes
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
