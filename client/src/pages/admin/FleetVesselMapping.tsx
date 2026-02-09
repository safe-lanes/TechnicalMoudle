import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useVessels } from "@/hooks/useVessels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Plus, Trash2, Ship, Box, Wrench, Package, Search, CheckCircle2, XCircle, 
  ArrowRight, RefreshCw, Link2, Link2Off, AlertTriangle, Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Component, Job, Spare } from "@shared/schema";
import { getJobsListQueryKey } from "@/modules/components/api/jobsApiV2";

type MappingTab = 'components' | 'jobs' | 'spares';

interface VesselMapping {
  id: string;
  fleetEntityType: 'component' | 'job' | 'spare';
  fleetEntityId: string;
  fleetEntityCode: string;
  fleetEntityName: string;
  vesselId: string;
  vesselEntityId?: string;
  vesselEntityCode?: string;
  vesselEntityName?: string;
  mappedAt: string;
  mappedBy: string;
  autoMatched?: boolean;
}

type MappingStatus = 'mapped' | 'not-mapped' | 'conflicting';

interface EntityWithStatus {
  id: string;
  code: string;
  name: string;
  status: MappingStatus;
  mappedToVessel?: string;
  mappedEntityCode?: string;
  mappedEntityName?: string;
  mappingId?: string;
  hasConflict?: boolean;
  conflictReason?: string;
}

export default function FleetVesselMapping() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<MappingTab>('components');
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVessel, setSelectedVessel] = useState<string>("");
  const [addMappingDialogOpen, setAddMappingDialogOpen] = useState(false);
  const [autoMatchDialogOpen, setAutoMatchDialogOpen] = useState(false);
  const [selectedFleetItem, setSelectedFleetItem] = useState<EntityWithStatus | null>(null);
  const [selectedVesselItem, setSelectedVesselItem] = useState<string>("");
  const [autoMatchResults, setAutoMatchResults] = useState<Array<{fleetId: string, fleetCode: string, vesselId: string, vesselCode: string, matchReason: string}>>([]);
  const [selectedAutoMatches, setSelectedAutoMatches] = useState<string[]>([]);

  const { data: fleetComponents = [], isLoading: isLoadingFleetComponents } = useQuery<Component[]>({
    queryKey: ['/technical/api/fleet/components'],
  });

  const { data: fleetJobs = [], isLoading: isLoadingFleetJobs } = useQuery<Job[]>({
    queryKey: ['/technical/api/fleet/jobs'],
  });

  const { data: fleetSpares = [], isLoading: isLoadingFleetSpares } = useQuery<Spare[]>({
    queryKey: ['/technical/api/fleet/spares'],
  });

  const { data: vesselComponents = [], isLoading: isLoadingVesselComponents } = useQuery<Component[]>({
    queryKey: ['/technical/api/components', selectedVessel],
    enabled: !!selectedVessel,
  });

  const { data: vesselJobs = [], isLoading: isLoadingVesselJobs } = useQuery<Job[]>({
    queryKey: getJobsListQueryKey(selectedVessel),
    enabled: !!selectedVessel,
  });

  const { data: vesselSpares = [], isLoading: isLoadingVesselSpares } = useQuery<Spare[]>({
    queryKey: ['/technical/api/spares', selectedVessel],
    enabled: !!selectedVessel,
  });

  const { data: vessels = [] } = useVessels();

  const { data: vesselMappings = [], isLoading: isLoadingMappings } = useQuery<VesselMapping[]>({
    queryKey: ['/technical/api/fleet/vessel-mappings'],
  });

  const createMappingMutation = useMutation({
    mutationFn: async (data: { 
      fleetEntityType: string; 
      fleetEntityIds: string[]; 
      vesselId: string;
      vesselEntityId?: string;
      vesselEntityCode?: string;
    }) => {
      const response = await apiRequest('POST', '/technical/api/fleet/vessel-mappings', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/vessel-mappings'] });
      toast({ title: "Success", description: "Mapping created successfully" });
      setAddMappingDialogOpen(false);
      setSelectedFleetItem(null);
      setSelectedVesselItem("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create mapping", variant: "destructive" });
    }
  });

  const deleteMappingMutation = useMutation({
    mutationFn: async (mappingId: string) => {
      await apiRequest('DELETE', `/technical/api/fleet/vessel-mappings/${mappingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/vessel-mappings'] });
      toast({ title: "Success", description: "Mapping removed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to remove mapping", variant: "destructive" });
    }
  });

  const bulkCreateMappingsMutation = useMutation({
    mutationFn: async (mappings: Array<{fleetEntityType: string; fleetEntityIds: string[]; vesselId: string; vesselEntityCode?: string}>) => {
      const results = [];
      for (const mapping of mappings) {
        const response = await apiRequest('POST', '/technical/api/fleet/vessel-mappings', mapping);
        results.push(await response.json());
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/vessel-mappings'] });
      toast({ title: "Success", description: "Mappings created successfully" });
      setAutoMatchDialogOpen(false);
      setAutoMatchResults([]);
      setSelectedAutoMatches([]);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create mappings", variant: "destructive" });
    }
  });

  const getFleetItems = (): EntityWithStatus[] => {
    let items: any[] = [];
    const entityType = activeTab === 'components' ? 'component' : activeTab === 'jobs' ? 'job' : 'spare';
    
    if (activeTab === 'components') {
      items = fleetComponents.filter(c => c.dataScope === 'fleet');
    } else if (activeTab === 'jobs') {
      items = fleetJobs.filter(j => (j as any).dataScope === 'fleet');
    } else {
      items = fleetSpares.filter(s => s.dataScope === 'fleet');
    }

    return items.map((item: any) => {
      const code = item.fleetEquipmentCode || item.componentCode || item.jobNo || item.partCode || item.id;
      const name = item.fleetEquipmentName || item.name || item.jobTitle || item.partName || "";
      
      const existingMapping = vesselMappings.find(m => 
        m.fleetEntityId === item.id && 
        m.fleetEntityType === entityType &&
        (!selectedVessel || m.vesselId === selectedVessel)
      );

      let status: MappingStatus = 'not-mapped';
      if (existingMapping) {
        status = 'mapped';
      }

      return {
        id: item.id,
        code,
        name,
        status,
        mappedToVessel: existingMapping?.vesselId,
        mappedEntityCode: existingMapping?.vesselEntityCode,
        mappedEntityName: existingMapping?.vesselEntityName,
        mappingId: existingMapping?.id,
      };
    });
  };

  const getVesselItems = (): Array<{id: string, code: string, name: string, isMapped: boolean}> => {
    let items: any[] = [];
    
    if (activeTab === 'components') {
      items = vesselComponents;
    } else if (activeTab === 'jobs') {
      items = vesselJobs;
    } else {
      items = vesselSpares;
    }

    const entityType = activeTab === 'components' ? 'component' : activeTab === 'jobs' ? 'job' : 'spare';

    return items.map((item: any) => {
      const code = item.componentCode || item.jobNo || item.partCode || item.id;
      const name = item.name || item.jobTitle || item.partName || "";
      
      const existingMapping = vesselMappings.find(m => 
        m.vesselEntityId === item.id && 
        m.fleetEntityType === entityType &&
        m.vesselId === selectedVessel
      );

      return {
        id: item.id,
        code,
        name,
        isMapped: !!existingMapping,
      };
    });
  };

  const fleetItems = getFleetItems();
  const vesselItems = selectedVessel ? getVesselItems() : [];

  const filteredFleetItems = fleetItems.filter(item => 
    searchTerm === "" || 
    item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredVesselItems = vesselItems.filter(item => 
    searchTerm === "" || 
    item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAutoMatch = () => {
    if (!selectedVessel) {
      toast({ title: "Error", description: "Please select a vessel first", variant: "destructive" });
      return;
    }

    const results: Array<{fleetId: string, fleetCode: string, vesselId: string, vesselCode: string, matchReason: string}> = [];
    const entityType = activeTab === 'components' ? 'component' : activeTab === 'jobs' ? 'job' : 'spare';

    fleetItems.forEach(fleetItem => {
      if (fleetItem.status === 'mapped') return;

      const matchingVesselItem = vesselItems.find(vesselItem => {
        const codeMatch = vesselItem.code.toLowerCase() === fleetItem.code.toLowerCase();
        const nameMatch = vesselItem.name.toLowerCase() === fleetItem.name.toLowerCase();
        return codeMatch || (nameMatch && vesselItem.name.length > 3);
      });

      if (matchingVesselItem && !matchingVesselItem.isMapped) {
        const matchReason = matchingVesselItem.code.toLowerCase() === fleetItem.code.toLowerCase() 
          ? 'Code match' 
          : 'Name match';
        
        results.push({
          fleetId: fleetItem.id,
          fleetCode: fleetItem.code,
          vesselId: matchingVesselItem.id,
          vesselCode: matchingVesselItem.code,
          matchReason
        });
      }
    });

    if (results.length === 0) {
      toast({ title: "No matches found", description: "No automatic matches could be determined", variant: "default" });
      return;
    }

    setAutoMatchResults(results);
    setSelectedAutoMatches(results.map(r => r.fleetId));
    setAutoMatchDialogOpen(true);
  };

  const handleConfirmAutoMatches = () => {
    const entityType = activeTab === 'components' ? 'component' : activeTab === 'jobs' ? 'job' : 'spare';
    
    const mappingsToCreate = autoMatchResults
      .filter(r => selectedAutoMatches.includes(r.fleetId))
      .map(r => ({
        fleetEntityType: entityType,
        fleetEntityIds: [r.fleetId],
        vesselId: selectedVessel,
        vesselEntityId: r.vesselId,
        vesselEntityCode: r.vesselCode
      }));

    if (mappingsToCreate.length > 0) {
      bulkCreateMappingsMutation.mutate(mappingsToCreate);
    }
  };

  const handleCreateManualMapping = () => {
    if (!selectedFleetItem || !selectedVesselItem || !selectedVessel) {
      toast({ title: "Error", description: "Please select both fleet and vessel items", variant: "destructive" });
      return;
    }

    const entityType = activeTab === 'components' ? 'component' : activeTab === 'jobs' ? 'job' : 'spare';
    const vesselItem = vesselItems.find(v => v.id === selectedVesselItem);

    createMappingMutation.mutate({
      fleetEntityType: entityType,
      fleetEntityIds: [selectedFleetItem.id],
      vesselId: selectedVessel,
      vesselEntityId: selectedVesselItem,
      vesselEntityCode: vesselItem?.code
    });
  };

  const handleRemoveMapping = (mappingId: string) => {
    deleteMappingMutation.mutate(mappingId);
  };

  const getStatusBadge = (status: MappingStatus) => {
    switch (status) {
      case 'mapped':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Mapped</Badge>;
      case 'not-mapped':
        return <Badge className="bg-gray-100 text-gray-600 border-gray-200"><Link2Off className="h-3 w-3 mr-1" />Not Mapped</Badge>;
      case 'conflicting':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200"><AlertTriangle className="h-3 w-3 mr-1" />Conflicting</Badge>;
    }
  };

  const isLoading = isLoadingFleetComponents || isLoadingFleetJobs || isLoadingFleetSpares || 
    isLoadingVesselComponents || isLoadingVesselJobs || isLoadingVesselSpares || isLoadingMappings;

  const mappedCount = fleetItems.filter(i => i.status === 'mapped').length;
  const unmappedCount = fleetItems.filter(i => i.status === 'not-mapped').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fleet Vessel Mapping</h1>
        <p className="text-gray-600 mt-1">
          Map fleet-level templates to vessel-specific instances
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-mappings"
          />
        </div>
        <Select value={selectedVessel} onValueChange={setSelectedVessel}>
          <SelectTrigger className="w-64" data-testid="select-vessel-filter">
            <SelectValue placeholder="Select a vessel..." />
          </SelectTrigger>
          <SelectContent>
            {vessels.map((vessel) => (
              <SelectItem key={vessel.id} value={vessel.id}>
                <div className="flex items-center gap-2">
                  <Ship className="h-4 w-4" />
                  {vessel.code} - {vessel.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={handleAutoMatch}
          disabled={!selectedVessel || isLoading}
          className="border-[#52baf3] text-[#52baf3] hover:bg-[#52baf3]/10"
          data-testid="button-auto-match"
        >
          <Zap className="h-4 w-4 mr-2" />
          Auto-Match
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/vessel-mappings'] });
            queryClient.invalidateQueries({ queryKey: ['/technical/api/components', selectedVessel] });
            queryClient.invalidateQueries({ queryKey: getJobsListQueryKey(selectedVessel) });
            queryClient.invalidateQueries({ queryKey: ['/technical/api/spares', selectedVessel] });
          }}
          disabled={isLoading}
          data-testid="button-refresh"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Re-sync
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MappingTab)}>
        <TabsList className="mb-6">
          <TabsTrigger value="components" className="flex items-center gap-2" data-testid="tab-components">
            <Box className="h-4 w-4" />
            Components Mapping
          </TabsTrigger>
          <TabsTrigger value="jobs" className="flex items-center gap-2" data-testid="tab-jobs">
            <Wrench className="h-4 w-4" />
            Jobs Mapping
          </TabsTrigger>
          <TabsTrigger value="spares" className="flex items-center gap-2" data-testid="tab-spares">
            <Package className="h-4 w-4" />
            Spares Mapping
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <div className="mb-4 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Mapped: {mappedCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400"></div>
              <span>Not Mapped: {unmappedCount}</span>
            </div>
          </div>

          {!selectedVessel ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-gray-500">
                  <Ship className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-medium mb-2">Select a Vessel</h3>
                  <p className="text-sm">Choose a vessel from the dropdown above to view and manage mappings</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {/* Left Column - Fleet Items */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Box className="h-4 w-4 text-[#52baf3]" />
                    Fleet {activeTab === 'components' ? 'Equipment' : activeTab === 'jobs' ? 'Jobs' : 'Spares'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[500px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky top-0 bg-white">Code</TableHead>
                          <TableHead className="sticky top-0 bg-white">Name</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center py-8">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#52baf3] mx-auto"></div>
                            </TableCell>
                          </TableRow>
                        ) : filteredFleetItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center py-8 text-gray-500">
                              No items found
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredFleetItems.map((item) => (
                            <TableRow 
                              key={item.id} 
                              className={`cursor-pointer hover:bg-gray-50 ${selectedFleetItem?.id === item.id ? 'bg-blue-50' : ''} ${item.status === 'mapped' ? 'bg-green-50/50' : ''}`}
                              onClick={() => setSelectedFleetItem(item)}
                              data-testid={`row-fleet-${item.id}`}
                            >
                              <TableCell className="font-mono text-sm">{item.code}</TableCell>
                              <TableCell className="text-sm truncate max-w-[150px]" title={item.name}>{item.name}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Middle Column - Mapping Status */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-gray-500" />
                    Mapping Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedFleetItem ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-500 mb-1">Selected Fleet Item</div>
                        <div className="font-medium">{selectedFleetItem.code}</div>
                        <div className="text-sm text-gray-600 truncate">{selectedFleetItem.name}</div>
                      </div>

                      <div className="flex justify-center">
                        <ArrowRight className="h-6 w-6 text-gray-400" />
                      </div>

                      <div className="p-4 rounded-lg border-2 border-dashed border-gray-200">
                        {selectedFleetItem.status === 'mapped' ? (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              {getStatusBadge(selectedFleetItem.status)}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => selectedFleetItem.mappingId && handleRemoveMapping(selectedFleetItem.mappingId)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="text-sm text-gray-500 mb-1">Mapped to</div>
                            <div className="font-medium">{selectedFleetItem.mappedEntityCode || selectedFleetItem.mappedToVessel}</div>
                            {selectedFleetItem.mappedEntityName && (
                              <div className="text-sm text-gray-600">{selectedFleetItem.mappedEntityName}</div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center">
                            {getStatusBadge(selectedFleetItem.status)}
                            <p className="text-sm text-gray-500 mt-2">Select a vessel item to create mapping</p>
                            
                            {selectedVesselItem && (
                              <div className="mt-4">
                                <Button
                                  onClick={handleCreateManualMapping}
                                  disabled={createMappingMutation.isPending}
                                  className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white"
                                  data-testid="button-create-mapping"
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Create Mapping
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Link2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p className="text-sm">Select a fleet item to view or create mappings</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Right Column - Vessel Items */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Ship className="h-4 w-4 text-green-600" />
                    Vessel {activeTab === 'components' ? 'Components' : activeTab === 'jobs' ? 'Jobs' : 'Spares'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[500px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky top-0 bg-white">Code</TableHead>
                          <TableHead className="sticky top-0 bg-white">Name</TableHead>
                          <TableHead className="sticky top-0 bg-white w-16">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-8">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#52baf3] mx-auto"></div>
                            </TableCell>
                          </TableRow>
                        ) : filteredVesselItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                              No items found
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredVesselItems.map((item) => (
                            <TableRow 
                              key={item.id} 
                              className={`cursor-pointer hover:bg-gray-50 ${selectedVesselItem === item.id ? 'bg-blue-50' : ''} ${item.isMapped ? 'opacity-50' : ''}`}
                              onClick={() => !item.isMapped && setSelectedVesselItem(item.id)}
                              data-testid={`row-vessel-${item.id}`}
                            >
                              <TableCell className="font-mono text-sm">{item.code}</TableCell>
                              <TableCell className="text-sm truncate max-w-[120px]" title={item.name}>{item.name}</TableCell>
                              <TableCell>
                                {item.isMapped ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : (
                                  <div className="h-4 w-4 rounded-full border-2 border-gray-300"></div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Auto-Match Confirmation Dialog */}
      <Dialog open={autoMatchDialogOpen} onOpenChange={setAutoMatchDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-[#52baf3]" />
              Confirm Auto-Matched Items
            </DialogTitle>
            <DialogDescription>
              The following items were automatically matched based on code or name similarity. 
              Please review and confirm the mappings you want to create.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedAutoMatches.length === autoMatchResults.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedAutoMatches(autoMatchResults.map(r => r.fleetId));
                        } else {
                          setSelectedAutoMatches([]);
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Fleet Code</TableHead>
                  <TableHead className="text-center"><ArrowRight className="h-4 w-4 mx-auto" /></TableHead>
                  <TableHead>Vessel Code</TableHead>
                  <TableHead>Match Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {autoMatchResults.map((result) => (
                  <TableRow key={result.fleetId}>
                    <TableCell>
                      <Checkbox
                        checked={selectedAutoMatches.includes(result.fleetId)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedAutoMatches(prev => [...prev, result.fleetId]);
                          } else {
                            setSelectedAutoMatches(prev => prev.filter(id => id !== result.fleetId));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">{result.fleetCode}</TableCell>
                    <TableCell className="text-center"><ArrowRight className="h-4 w-4 mx-auto text-gray-400" /></TableCell>
                    <TableCell className="font-mono text-sm">{result.vesselCode}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{result.matchReason}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAutoMatchDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAutoMatches}
              disabled={selectedAutoMatches.length === 0 || bulkCreateMappingsMutation.isPending}
              className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white"
              data-testid="button-confirm-auto-match"
            >
              {bulkCreateMappingsMutation.isPending ? "Creating..." : `Create ${selectedAutoMatches.length} Mapping(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
