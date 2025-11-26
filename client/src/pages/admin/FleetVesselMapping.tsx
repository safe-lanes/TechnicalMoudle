import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Ship, Box, Wrench, Package, Search, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Component, Job, Spare } from "@shared/schema";

type MappingTab = 'equipment-vessel' | 'equipment-component' | 'jobs-vessel' | 'spares-vessel';

interface VesselMapping {
  id: string;
  fleetEntityType: 'component' | 'job' | 'spare';
  fleetEntityId: string;
  fleetEntityCode: string;
  fleetEntityName: string;
  vesselId: string;
  vesselComponentCode?: string;
  mappedAt: string;
  mappedBy: string;
}

export default function FleetVesselMapping() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<MappingTab>('equipment-vessel');
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVessel, setSelectedVessel] = useState<string>("all");
  const [addMappingDialogOpen, setAddMappingDialogOpen] = useState(false);
  const [selectedFleetItems, setSelectedFleetItems] = useState<string[]>([]);
  const [targetVessel, setTargetVessel] = useState<string>("");
  const [targetComponentCode, setTargetComponentCode] = useState<string>("");

  const { data: fleetComponents = [], isLoading: isLoadingComponents } = useQuery<Component[]>({
    queryKey: ['/api/fleet/components'],
  });

  const { data: fleetJobs = [], isLoading: isLoadingJobs } = useQuery<Job[]>({
    queryKey: ['/api/fleet/jobs'],
  });

  const { data: fleetSpares = [], isLoading: isLoadingSpares } = useQuery<Spare[]>({
    queryKey: ['/api/fleet/spares'],
  });

  const { data: vessels = [] } = useQuery<Array<{id: string, name: string, code: string}>>({
    queryKey: ['/api/vessels'],
  });

  const { data: vesselMappings = [], isLoading: isLoadingMappings } = useQuery<VesselMapping[]>({
    queryKey: ['/api/fleet/vessel-mappings'],
  });

  const createMappingMutation = useMutation({
    mutationFn: async (data: { 
      fleetEntityType: string; 
      fleetEntityIds: string[]; 
      vesselId: string;
      vesselComponentCode?: string;
    }) => {
      const response = await apiRequest('POST', '/api/fleet/vessel-mappings', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fleet/vessel-mappings'] });
      toast({ title: "Success", description: "Mappings created successfully" });
      setAddMappingDialogOpen(false);
      setSelectedFleetItems([]);
      setTargetVessel("");
      setTargetComponentCode("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create mappings", variant: "destructive" });
    }
  });

  const deleteMappingMutation = useMutation({
    mutationFn: async (mappingId: string) => {
      await apiRequest('DELETE', `/api/fleet/vessel-mappings/${mappingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fleet/vessel-mappings'] });
      toast({ title: "Success", description: "Mapping removed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to remove mapping", variant: "destructive" });
    }
  });

  const getEntityTypeForTab = (tab: MappingTab): 'component' | 'job' | 'spare' => {
    switch (tab) {
      case 'equipment-vessel':
      case 'equipment-component':
        return 'component';
      case 'jobs-vessel':
        return 'job';
      case 'spares-vessel':
        return 'spare';
    }
  };

  const getFleetItemsForTab = (tab: MappingTab) => {
    switch (tab) {
      case 'equipment-vessel':
      case 'equipment-component':
        return fleetComponents.filter(c => c.dataScope === 'fleet');
      case 'jobs-vessel':
        return fleetJobs.filter(j => (j as any).dataScope === 'fleet');
      case 'spares-vessel':
        return fleetSpares.filter(s => s.dataScope === 'fleet');
      default:
        return [];
    }
  };

  const filteredMappings = vesselMappings.filter(m => {
    const matchesType = m.fleetEntityType === getEntityTypeForTab(activeTab);
    const matchesSearch = searchTerm === "" || 
      m.fleetEntityCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.fleetEntityName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.vesselId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesVessel = selectedVessel === "all" || m.vesselId === selectedVessel;
    return matchesType && matchesSearch && matchesVessel;
  });

  const fleetItems = getFleetItemsForTab(activeTab);
  const filteredFleetItems = fleetItems.filter((item: any) => 
    searchTerm === "" || 
    (item.fleetEquipmentCode || item.jobNo || item.partCode || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.fleetEquipmentName || item.jobTitle || item.partName || item.name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateMappings = () => {
    if (selectedFleetItems.length === 0) {
      toast({ title: "Error", description: "Please select at least one item to map", variant: "destructive" });
      return;
    }
    if (!targetVessel) {
      toast({ title: "Error", description: "Please select a target vessel", variant: "destructive" });
      return;
    }

    createMappingMutation.mutate({
      fleetEntityType: getEntityTypeForTab(activeTab),
      fleetEntityIds: selectedFleetItems,
      vesselId: targetVessel,
      vesselComponentCode: activeTab === 'equipment-component' ? targetComponentCode : undefined
    });
  };

  const handleToggleItem = (itemId: string) => {
    setSelectedFleetItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    const allIds = filteredFleetItems.map((item: any) => item.id);
    setSelectedFleetItems(prev => 
      prev.length === allIds.length ? [] : allIds
    );
  };

  const getItemCode = (item: any) => item.fleetEquipmentCode || item.jobNo || item.partCode || item.id;
  const getItemName = (item: any) => item.fleetEquipmentName || item.jobTitle || item.partName || item.name || "";

  const renderTabContent = () => {
    const isLoading = isLoadingComponents || isLoadingJobs || isLoadingSpares || isLoadingMappings;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
                data-testid="input-search-mappings"
              />
            </div>
            <Select value={selectedVessel} onValueChange={setSelectedVessel}>
              <SelectTrigger className="w-48" data-testid="select-vessel-filter">
                <SelectValue placeholder="All Vessels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vessels</SelectItem>
                {vessels.map((vessel) => (
                  <SelectItem key={vessel.id} value={vessel.id}>
                    {vessel.code} - {vessel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => setAddMappingDialogOpen(true)}
            className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white"
            data-testid="button-add-mapping"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Mapping
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {activeTab === 'equipment-vessel' && "Fleet Equipment → Vessel Mappings"}
              {activeTab === 'equipment-component' && "Fleet Equipment → Vessel Component Mappings"}
              {activeTab === 'jobs-vessel' && "Fleet Jobs → Vessel Mappings"}
              {activeTab === 'spares-vessel' && "Fleet Spares → Vessel Mappings"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#52baf3]"></div>
              </div>
            ) : filteredMappings.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Ship className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No mappings found</p>
                <p className="text-sm mt-1">Click "Add Mapping" to create vessel mappings</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fleet Code</TableHead>
                    <TableHead>Fleet Name</TableHead>
                    <TableHead>Vessel</TableHead>
                    {activeTab === 'equipment-component' && <TableHead>Vessel Component Code</TableHead>}
                    <TableHead>Mapped At</TableHead>
                    <TableHead>Mapped By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMappings.map((mapping) => (
                    <TableRow key={mapping.id} data-testid={`row-mapping-${mapping.id}`}>
                      <TableCell className="font-medium">{mapping.fleetEntityCode}</TableCell>
                      <TableCell>{mapping.fleetEntityName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{mapping.vesselId}</Badge>
                      </TableCell>
                      {activeTab === 'equipment-component' && (
                        <TableCell>{mapping.vesselComponentCode || "-"}</TableCell>
                      )}
                      <TableCell className="text-gray-500 text-sm">
                        {new Date(mapping.mappedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">{mapping.mappedBy}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMappingMutation.mutate(mapping.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          data-testid={`button-delete-mapping-${mapping.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Unmapped Fleet Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-500 mb-4">
              {activeTab === 'equipment-vessel' && `${fleetItems.length} fleet equipment items available`}
              {activeTab === 'equipment-component' && `${fleetItems.length} fleet equipment items available`}
              {activeTab === 'jobs-vessel' && `${fleetItems.length} fleet jobs available`}
              {activeTab === 'spares-vessel' && `${fleetItems.length} fleet spares available`}
            </div>
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedFleetItems.length === filteredFleetItems.length && filteredFleetItems.length > 0}
                        onCheckedChange={handleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Mapped Vessels</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFleetItems.slice(0, 50).map((item: any) => {
                    const itemMappings = vesselMappings.filter(m => 
                      m.fleetEntityId === item.id && 
                      m.fleetEntityType === getEntityTypeForTab(activeTab)
                    );
                    return (
                      <TableRow key={item.id} data-testid={`row-fleet-item-${item.id}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedFleetItems.includes(item.id)}
                            onCheckedChange={() => handleToggleItem(item.id)}
                            data-testid={`checkbox-item-${item.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{getItemCode(item)}</TableCell>
                        <TableCell>{getItemName(item)}</TableCell>
                        <TableCell>
                          {itemMappings.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {itemMappings.slice(0, 3).map(m => (
                                <Badge key={m.id} variant="secondary" className="text-xs">
                                  {m.vesselId}
                                </Badge>
                              ))}
                              {itemMappings.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{itemMappings.length - 3} more
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">Not mapped</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Fleet Vessel Mapping</h1>
        <p className="text-gray-600 mt-1">
          Map fleet-level equipment, jobs, and spares to specific vessels
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MappingTab)}>
        <TabsList className="mb-6">
          <TabsTrigger value="equipment-vessel" className="flex items-center gap-2" data-testid="tab-equipment-vessel">
            <Box className="h-4 w-4" />
            Equipment → Vessel
          </TabsTrigger>
          <TabsTrigger value="equipment-component" className="flex items-center gap-2" data-testid="tab-equipment-component">
            <Box className="h-4 w-4" />
            Equipment → Component
          </TabsTrigger>
          <TabsTrigger value="jobs-vessel" className="flex items-center gap-2" data-testid="tab-jobs-vessel">
            <Wrench className="h-4 w-4" />
            Jobs → Vessel
          </TabsTrigger>
          <TabsTrigger value="spares-vessel" className="flex items-center gap-2" data-testid="tab-spares-vessel">
            <Package className="h-4 w-4" />
            Spares → Vessel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="equipment-vessel">{renderTabContent()}</TabsContent>
        <TabsContent value="equipment-component">{renderTabContent()}</TabsContent>
        <TabsContent value="jobs-vessel">{renderTabContent()}</TabsContent>
        <TabsContent value="spares-vessel">{renderTabContent()}</TabsContent>
      </Tabs>

      <Dialog open={addMappingDialogOpen} onOpenChange={setAddMappingDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Vessel Mapping</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Selected Items ({selectedFleetItems.length})</Label>
              <div className="text-sm text-gray-500">
                {selectedFleetItems.length === 0 
                  ? "No items selected. Select items from the table below."
                  : `${selectedFleetItems.length} item(s) selected for mapping`
                }
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-vessel">Target Vessel *</Label>
              <Select value={targetVessel} onValueChange={setTargetVessel}>
                <SelectTrigger data-testid="select-target-vessel">
                  <SelectValue placeholder="Select a vessel" />
                </SelectTrigger>
                <SelectContent>
                  {vessels.map((vessel) => (
                    <SelectItem key={vessel.id} value={vessel.id}>
                      {vessel.code} - {vessel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeTab === 'equipment-component' && (
              <div className="space-y-2">
                <Label htmlFor="target-component">Vessel Component Code (Optional)</Label>
                <Input
                  id="target-component"
                  placeholder="e.g., 1.2.3.4"
                  value={targetComponentCode}
                  onChange={(e) => setTargetComponentCode(e.target.value)}
                  data-testid="input-target-component"
                />
                <p className="text-xs text-gray-500">
                  Specify the vessel component code to link this fleet equipment to
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMappingDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateMappings}
              disabled={selectedFleetItems.length === 0 || !targetVessel || createMappingMutation.isPending}
              className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white"
              data-testid="button-confirm-mapping"
            >
              {createMappingMutation.isPending ? "Creating..." : "Create Mapping"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
