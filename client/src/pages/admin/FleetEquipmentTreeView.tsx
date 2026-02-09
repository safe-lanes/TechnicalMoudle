import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronRight,
  ChevronDown,
  Search,
  Settings,
  Wrench,
  Package,
  RefreshCw,
  FolderTree,
  FileText,
  Info,
  ArrowLeft,
  GitBranch,
} from 'lucide-react';
import type { MasterData, Job, FleetSpares } from '@shared/schema';

interface TreeNode {
  id: string;
  code: string;
  name: string;
  children?: TreeNode[];
  isExpanded?: boolean;
  data?: MasterData;
  level: number;
}

type MasterDataResponse = { items: MasterData[]; total: number };

export default function FleetEquipmentTreeView({ onBack }: { onBack?: () => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedEquipment, setSelectedEquipment] = useState<MasterData | null>(null);
  
  const { data: masterDataResponse, isLoading, refetch } = useQuery<MasterDataResponse>({
    queryKey: ['/technical/api/fleet-admin/master-data', 'tree'],
    queryFn: async () => {
      const response = await fetch('/technical/api/fleet-admin/master-data?limit=10000');
      if (!response.ok) throw new Error('Failed to fetch master data');
      return response.json();
    }
  });
  
  const { data: fleetJobsData } = useQuery<Job[]>({
    queryKey: ['/technical/api/fleet/jobs'],
  });
  
  const { data: fleetSparesData } = useQuery<FleetSpares[]>({
    queryKey: ['/technical/api/fleet/spares'],
  });
  
  const masterDataList = masterDataResponse?.items ?? [];
  
  const treeData = useMemo(() => {
    const sfiGroups: Record<string, TreeNode> = {};
    
    masterDataList.forEach((item) => {
      const sfiCode = item.sfiCode || '000';
      const sfiPrefix = sfiCode.substring(0, 3);
      
      if (!sfiGroups[sfiPrefix]) {
        sfiGroups[sfiPrefix] = {
          id: `sfi-${sfiPrefix}`,
          code: sfiPrefix,
          name: `SFI ${sfiPrefix}`,
          children: [],
          level: 0,
        };
      }
      
      sfiGroups[sfiPrefix].children!.push({
        id: `equip-${item.id}`,
        code: item.fleetEquipmentCode || '',
        name: item.equipmentName || 'Unnamed Equipment',
        data: item,
        level: 1,
      });
    });
    
    return Object.values(sfiGroups).sort((a, b) => a.code.localeCompare(b.code));
  }, [masterDataList]);
  
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return treeData;
    
    const query = searchQuery.toLowerCase();
    return treeData
      .map((group) => ({
        ...group,
        children: group.children?.filter(
          (item) =>
            item.code.toLowerCase().includes(query) ||
            item.name.toLowerCase().includes(query) ||
            item.data?.makerName?.toLowerCase().includes(query) ||
            item.data?.model?.toLowerCase().includes(query)
        ),
      }))
      .filter((group) => group.children && group.children.length > 0);
  }, [treeData, searchQuery]);
  
  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };
  
  const expandAll = () => {
    const allNodeIds = filteredTree.map((node) => node.id);
    setExpandedNodes(new Set(allNodeIds));
  };
  
  const collapseAll = () => {
    setExpandedNodes(new Set());
  };
  
  const relatedJobs = useMemo(() => {
    if (!selectedEquipment || !fleetJobsData) return [];
    const equipCode = selectedEquipment.fleetEquipmentCode;
    const sfiCode = selectedEquipment.sfiCode || '';
    return (fleetJobsData as Job[]).filter((job) => 
      job.fleetEquipmentCode === equipCode || 
      job.sfiCode === sfiCode ||
      job.componentCode?.startsWith(sfiCode)
    ).slice(0, 20);
  }, [selectedEquipment, fleetJobsData]);
  
  const relatedSpares = useMemo(() => {
    if (!selectedEquipment || !fleetSparesData) return [];
    const equipCode = selectedEquipment.fleetEquipmentCode;
    const sfiCode = selectedEquipment.sfiCode || '';
    return (fleetSparesData as FleetSpares[]).filter((spare) => 
      spare.fleetEquipmentCode === equipCode
    ).slice(0, 20);
  }, [selectedEquipment, fleetSparesData]);
  
  const renderTreeNode = (node: TreeNode, isLast = false) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedEquipment?.id?.toString() === node.data?.id?.toString();
    
    return (
      <div key={node.id} className="select-none">
        <div
          className={`flex items-center gap-1 py-1.5 px-2 cursor-pointer hover:bg-muted/50 rounded-md transition-colors ${
            isSelected ? 'bg-primary/10 border-l-2 border-primary' : ''
          }`}
          style={{ paddingLeft: `${node.level * 16 + 8}px` }}
          onClick={() => {
            if (hasChildren) {
              toggleNode(node.id);
            }
            if (node.data) {
              setSelectedEquipment(node.data);
            }
          }}
          data-testid={`tree-node-${node.id}`}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )
          ) : (
            <div className="w-4" />
          )}
          
          {node.level === 0 ? (
            <FolderTree className="w-4 h-4 text-blue-500 flex-shrink-0" />
          ) : (
            <Settings className="w-4 h-4 text-green-500 flex-shrink-0" />
          )}
          
          <span className="font-mono text-xs text-muted-foreground flex-shrink-0">
            {node.code}
          </span>
          <span className="text-sm truncate flex-1">{node.name}</span>
          
          {hasChildren && (
            <Badge variant="secondary" className="text-xs">
              {node.children?.length}
            </Badge>
          )}
        </div>
        
        {hasChildren && isExpanded && (
          <div className="tree-children">
            {node.children?.map((child, index) =>
              renderTreeNode(child, index === node.children!.length - 1)
            )}
          </div>
        )}
      </div>
    );
  };
  
  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="flex gap-4">
          <Skeleton className="h-[600px] w-1/3" />
          <Skeleton className="h-[600px] w-2/3" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-4">
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 rounded-lg">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <GitBranch className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Fleet Equipment Data Tree View</h1>
              <p className="text-cyan-100 text-sm mt-0.5">Browse fleet equipment hierarchy</p>
            </div>
          </div>
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-cyan-100 hover:text-white text-sm transition-colors"
              data-testid="button-back-to-dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Badge variant="outline">{masterDataList.length} Equipment</Badge>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="btn-refresh-tree">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <FolderTree className="w-5 h-5" />
              Equipment Tree
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search equipment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-tree"
              />
            </div>
            
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={expandAll} data-testid="btn-expand-all">
                Expand All
              </Button>
              <Button variant="ghost" size="sm" onClick={collapseAll} data-testid="btn-collapse-all">
                Collapse All
              </Button>
            </div>
            
            <Separator />
            
            <ScrollArea className="h-[500px]">
              {filteredTree.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderTree className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No equipment found</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredTree.map((node) => renderTreeNode(node))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
        
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              {selectedEquipment ? (
                <>
                  <Settings className="w-5 h-5" />
                  {selectedEquipment.equipmentName || 'Equipment Details'}
                </>
              ) : (
                <>
                  <Info className="w-5 h-5" />
                  Select Equipment
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedEquipment ? (
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="details" data-testid="tab-details">
                    <FileText className="w-4 h-4 mr-2" />
                    Details
                  </TabsTrigger>
                  <TabsTrigger value="jobs" data-testid="tab-jobs">
                    <Wrench className="w-4 h-4 mr-2" />
                    Jobs ({relatedJobs.length})
                  </TabsTrigger>
                  <TabsTrigger value="spares" data-testid="tab-spares">
                    <Package className="w-4 h-4 mr-2" />
                    Spares ({relatedSpares.length})
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="details" className="mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-muted-foreground">Fleet Equipment Code</label>
                      <p className="font-mono text-lg">{selectedEquipment.fleetEquipmentCode}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-muted-foreground">SFI Code</label>
                      <p className="font-mono">{selectedEquipment.sfiCode || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-muted-foreground">Equipment Name</label>
                      <p>{selectedEquipment.equipmentName || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-muted-foreground">Vessel</label>
                      <p>{selectedEquipment.vesselName || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-muted-foreground">Maker</label>
                      <p>{selectedEquipment.makerName || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-muted-foreground">Model</label>
                      <p>{selectedEquipment.model || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-muted-foreground">Model Code</label>
                      <p className="font-mono">{selectedEquipment.modelCode || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <Badge variant={selectedEquipment.isActive ? 'default' : 'secondary'}>
                        {selectedEquipment.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="jobs" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    {relatedJobs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Wrench className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No related jobs found</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {relatedJobs.map((job) => (
                          <Card key={job.id} className="p-3" data-testid={`job-card-${job.id}`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{job.jobTitle}</p>
                                <p className="text-sm text-muted-foreground">
                                  {job.jobNo || job.fleetJobCode || 'No code'}
                                </p>
                              </div>
                              <div className="text-right">
                                <Badge variant="outline">{job.frequencyType || 'N/A'}</Badge>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {job.frequencyValue && job.frequencyUnit ? `${job.frequencyValue} ${job.frequencyUnit}` : ''}
                                  {job.intervalRunningHour ? `${job.intervalRunningHour} hours` : ''}
                                </p>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="spares" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    {relatedSpares.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No related spares found</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {relatedSpares.map((spare) => (
                          <Card key={spare.id} className="p-3" data-testid={`spare-card-${spare.id}`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{spare.partName}</p>
                                <p className="text-sm text-muted-foreground">
                                  {spare.partNumber || spare.partCode || 'No part number'}
                                </p>
                              </div>
                              <div className="text-right">
                                <Badge variant="outline">{spare.unitOfMeasurement || "—"}</Badge>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {spare.maker || "—"}
                                </p>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Settings className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Select equipment from the tree to view details</p>
                <p className="text-sm mt-2">
                  Click on any equipment item to see its details, related jobs, and spare parts
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
