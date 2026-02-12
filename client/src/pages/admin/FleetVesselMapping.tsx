import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useVessels } from "@/hooks/useVessels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ship, Box, Wrench, Package, Search, Link2, ArrowLeft, RefreshCw, Zap, CheckCircle2, Anchor } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Component, FleetComponents } from "@shared/schema";

type MappingTab = "components" | "jobs" | "spares";

interface FleetComponentMapping {
  id: number;
  fleetEquipmentCode: string;
  vesselCode: string;
  componentCode: string;
  componentId?: string;
  componentName?: string;
  mappedBy: string;
  mappedAt: string;
  isActive: boolean;
}

interface AutoMatchEntry {
  vesselComponentCode: string;
  vesselComponentName: string;
  vesselComponentId: string;
  fleetEquipmentCode: string;
  fleetEquipmentName: string;
  matched: boolean;
}

export default function FleetVesselMapping({ onBack }: { onBack?: () => void }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<MappingTab>("components");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVessel, setSelectedVessel] = useState<string>("");
  const [selectedFleetItem, setSelectedFleetItem] = useState<string | null>(null);
  const [selectedVesselItem, setSelectedVesselItem] = useState<string | null>(null);
  const [autoMatchDialogOpen, setAutoMatchDialogOpen] = useState(false);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [summaryData, setSummaryData] = useState<{ linked: number; notLinked: number }>({ linked: 0, notLinked: 0 });

  const { data: vessels = [] } = useVessels();

  const { data: fleetComponentsData = [], isLoading: isLoadingFleet } = useQuery<FleetComponents[]>({
    queryKey: ["/technical/api/fleet-admin/fleet-components"],
  });

  const { data: vesselComponentsData = [], isLoading: isLoadingVessel } = useQuery<Component[]>({
    queryKey: ["/technical/api/components", { vesselId: selectedVessel }],
    queryFn: async () => {
      const res = await fetch(`/technical/api/components?vesselId=${selectedVessel}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch vessel components");
      return res.json();
    },
    enabled: !!selectedVessel,
  });

  const { data: mappingsData = [], isLoading: isLoadingMappings } = useQuery<FleetComponentMapping[]>({
    queryKey: ["/technical/api/fleet-admin/fleet-component-mappings", { vesselCode: selectedVessel }],
    queryFn: async () => {
      const res = await fetch(`/technical/api/fleet-admin/fleet-component-mappings?vesselCode=${selectedVessel}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch mappings");
      return res.json();
    },
    enabled: !!selectedVessel,
  });

  const vesselComponents = useMemo(
    () => vesselComponentsData.filter((c) => c.isParent !== true),
    [vesselComponentsData]
  );

  const fleetComponents = useMemo(() => fleetComponentsData, [fleetComponentsData]);

  const mappingsByFleetCode = useMemo(() => {
    const map = new Map<string, FleetComponentMapping[]>();
    for (const m of mappingsData) {
      const arr = map.get(m.fleetEquipmentCode) || [];
      arr.push(m);
      map.set(m.fleetEquipmentCode, arr);
    }
    return map;
  }, [mappingsData]);

  const mappingsByComponentCode = useMemo(() => {
    const map = new Map<string, FleetComponentMapping[]>();
    for (const m of mappingsData) {
      const arr = map.get(m.componentCode) || [];
      arr.push(m);
      map.set(m.componentCode, arr);
    }
    return map;
  }, [mappingsData]);

  const mappedFleetCodes = useMemo(() => new Set(mappingsData.map((m) => m.fleetEquipmentCode)), [mappingsData]);
  const mappedComponentCodes = useMemo(() => new Set(mappingsData.map((m) => m.componentCode)), [mappingsData]);

  const filteredFleetComponents = useMemo(
    () =>
      fleetComponents.filter(
        (fc) =>
          !searchTerm ||
          fc.fleetEquipmentCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          fc.fleetEquipmentName.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [fleetComponents, searchTerm]
  );

  const filteredVesselComponents = useMemo(
    () =>
      vesselComponents.filter(
        (vc) =>
          !searchTerm ||
          (vc.componentCode || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (vc.name || "").toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [vesselComponents, searchTerm]
  );

  const linkedComponentCodes = useMemo(() => {
    if (!selectedFleetItem) return new Set<string>();
    const mappings = mappingsByFleetCode.get(selectedFleetItem) || [];
    return new Set(mappings.map((m) => m.componentCode));
  }, [selectedFleetItem, mappingsByFleetCode]);

  const linkedFleetCodes = useMemo(() => {
    if (!selectedVesselItem) return new Set<string>();
    const vc = vesselComponents.find((c) => c.componentCode === selectedVesselItem);
    if (!vc) return new Set<string>();
    const mappings = mappingsByComponentCode.get(vc.componentCode || "") || [];
    return new Set(mappings.map((m) => m.fleetEquipmentCode));
  }, [selectedVesselItem, vesselComponents, mappingsByComponentCode]);

  const mappedCount = useMemo(() => mappedFleetCodes.size, [mappedFleetCodes]);
  const unmappedCount = useMemo(() => fleetComponents.length - mappedCount, [fleetComponents.length, mappedCount]);

  const selectedFleetData = useMemo(() => {
    if (!selectedFleetItem) return null;
    return fleetComponents.find((fc) => fc.fleetEquipmentCode === selectedFleetItem) || null;
  }, [selectedFleetItem, fleetComponents]);

  const selectedFleetMappings = useMemo(() => {
    if (!selectedFleetItem) return [];
    return mappingsByFleetCode.get(selectedFleetItem) || [];
  }, [selectedFleetItem, mappingsByFleetCode]);

  const autoMatchEntries = useMemo((): AutoMatchEntry[] => {
    const fleetCodeSet = new Set(fleetComponents.map((fc) => fc.fleetEquipmentCode));
    const fleetCodeToName = new Map(fleetComponents.map((fc) => [fc.fleetEquipmentCode, fc.fleetEquipmentName]));

    return vesselComponents.map((vc) => {
      const vcFleetCode = vc.fleetEquipmentCode || "";
      const matched = !!vcFleetCode && fleetCodeSet.has(vcFleetCode);
      return {
        vesselComponentCode: vc.componentCode || "",
        vesselComponentName: vc.name || "",
        vesselComponentId: vc.id,
        fleetEquipmentCode: vcFleetCode,
        fleetEquipmentName: matched ? (fleetCodeToName.get(vcFleetCode) || "") : "",
        matched,
      };
    });
  }, [vesselComponents, fleetComponents]);

  const createMappingMutation = useMutation({
    mutationFn: async (data: {
      fleetEquipmentCode: string;
      vesselCode: string;
      componentCode: string;
      componentName: string;
      componentId: string;
      mappedBy: string;
      isActive: boolean;
    }) => {
      const response = await apiRequest("POST", "/technical/api/fleet-admin/fleet-component-mappings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-component-mappings", { vesselCode: selectedVessel }] });
    },
  });

  const deleteMappingMutation = useMutation({
    mutationFn: async (params: { fleetEquipmentCode: string; vesselCode: string; componentCode: string }) => {
      await apiRequest(
        "DELETE",
        `/technical/api/fleet-admin/fleet-component-mappings?fleetEquipmentCode=${encodeURIComponent(params.fleetEquipmentCode)}&vesselCode=${encodeURIComponent(params.vesselCode)}&componentCode=${encodeURIComponent(params.componentCode)}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-component-mappings", { vesselCode: selectedVessel }] });
      toast({ title: "Success", description: "Mapping removed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to remove mapping", variant: "destructive" });
    },
  });

  const handleManualMap = () => {
    if (!selectedFleetItem || !selectedVesselItem || !selectedVessel) {
      toast({ title: "Error", description: "Select both a fleet item and a vessel component", variant: "destructive" });
      return;
    }
    const vc = vesselComponents.find((c) => c.componentCode === selectedVesselItem);
    if (!vc) return;

    createMappingMutation.mutate(
      {
        fleetEquipmentCode: selectedFleetItem,
        vesselCode: selectedVessel,
        componentCode: vc.componentCode || "",
        componentName: vc.name || "",
        componentId: vc.id,
        mappedBy: "admin",
        isActive: true,
      },
      {
        onSuccess: () => {
          toast({ title: "Success", description: "Mapping created successfully" });
        },
        onError: (error: any) => {
          toast({ title: "Error", description: error.message || "Failed to create mapping", variant: "destructive" });
        },
      }
    );
  };

  const handleRemoveMapping = (m: FleetComponentMapping) => {
    deleteMappingMutation.mutate({
      fleetEquipmentCode: m.fleetEquipmentCode,
      vesselCode: m.vesselCode,
      componentCode: m.componentCode,
    });
  };

  const handleAutoMatch = () => {
    if (!selectedVessel) {
      toast({ title: "Error", description: "Please select a vessel first", variant: "destructive" });
      return;
    }
    setAutoMatchDialogOpen(true);
  };

  const handleCreateAutoMappings = async () => {
    const matchedEntries = autoMatchEntries.filter((e) => e.matched && !mappedComponentCodes.has(e.vesselComponentCode));
    let linked = 0;
    let notLinked = 0;

    for (const entry of matchedEntries) {
      try {
        await apiRequest("POST", "/technical/api/fleet-admin/fleet-component-mappings", {
          fleetEquipmentCode: entry.fleetEquipmentCode,
          vesselCode: selectedVessel,
          componentCode: entry.vesselComponentCode,
          componentName: entry.vesselComponentName,
          componentId: entry.vesselComponentId,
          mappedBy: "auto-match",
          isActive: true,
        });
        linked++;
      } catch {
        notLinked++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-component-mappings", { vesselCode: selectedVessel }] });
    setAutoMatchDialogOpen(false);
    setSummaryData({ linked, notLinked });
    setSummaryDialogOpen(true);
  };

  const handleResync = () => {
    queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-components"] });
    queryClient.invalidateQueries({ queryKey: ["/technical/api/components", { vesselId: selectedVessel }] });
    queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-component-mappings", { vesselCode: selectedVessel }] });
    toast({ title: "Re-syncing", description: "Refreshing all data..." });
  };

  const isLoading = isLoadingFleet || isLoadingVessel || isLoadingMappings;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 rounded-lg">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Ship className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white" data-testid="text-page-title">Fleet Vessel Mapping</h1>
              <p className="text-cyan-100 text-sm mt-0.5">Map fleet components to vessels</p>
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

      <div className="flex items-center gap-4 flex-wrap">
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
        <Select value={selectedVessel} onValueChange={(v) => { setSelectedVessel(v); setSelectedFleetItem(null); setSelectedVesselItem(null); }}>
          <SelectTrigger className="w-64" data-testid="select-vessel-filter">
            <SelectValue placeholder="Select a vessel..." />
          </SelectTrigger>
          <SelectContent>
            {vessels.map((vessel) => (
              <SelectItem key={vessel.id} value={vessel.id}>
                {vessel.id} - {vessel.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={handleAutoMatch}
          disabled={!selectedVessel || isLoading}
          className="border-cyan-500 text-cyan-600"
          data-testid="button-auto-match"
        >
          <Zap className="h-4 w-4 mr-2" />
          Auto-Match
        </Button>
        <Button
          variant="outline"
          onClick={handleResync}
          disabled={isLoading}
          data-testid="button-resync"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Re-sync
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MappingTab)}>
        <TabsList className="mb-4">
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
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span data-testid="text-mapped-count">Mapped: {mappedCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span data-testid="text-unmapped-count">Not Mapped: {unmappedCount}</span>
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
            <div className="grid gap-4" style={{ gridTemplateColumns: "2fr 1fr 2fr" }}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    <Ship className="h-4 w-4 text-cyan-600" />
                    Fleet Equipment
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Code</th>
                          <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoadingFleet ? (
                          <tr>
                            <td colSpan={2} className="text-center py-8">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500 mx-auto" />
                            </td>
                          </tr>
                        ) : filteredFleetComponents.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="text-center py-8 text-gray-500 text-xs">No fleet components found</td>
                          </tr>
                        ) : (
                          filteredFleetComponents.map((fc) => {
                            const isSelected = selectedFleetItem === fc.fleetEquipmentCode;
                            const isLinkedFromRight = linkedFleetCodes.has(fc.fleetEquipmentCode);
                            return (
                              <tr
                                key={fc.id}
                                className={`cursor-pointer border-b transition-colors text-xs ${
                                  isSelected
                                    ? "bg-blue-100"
                                    : isLinkedFromRight
                                    ? "bg-green-100"
                                    : "hover:bg-blue-50/50"
                                }`}
                                onClick={() => {
                                  setSelectedFleetItem(fc.fleetEquipmentCode);
                                }}
                                data-testid={`row-fleet-${fc.fleetEquipmentCode}`}
                              >
                                <td className="px-3 py-2 font-mono">{fc.fleetEquipmentCode}</td>
                                <td className="px-3 py-2 truncate max-w-[200px]" title={fc.fleetEquipmentName}>{fc.fleetEquipmentName}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    <Link2 className="h-4 w-4 text-gray-500" />
                    Mapping Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedFleetItem ? (
                    <div className="text-center py-8 text-gray-400">
                      <Link2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                      <p className="text-sm">Select a fleet item to view or create mappings</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Selected Fleet Item</div>
                        <div className="font-medium text-sm">{selectedFleetData?.fleetEquipmentCode}</div>
                        <div className="text-xs text-gray-600 truncate">{selectedFleetData?.fleetEquipmentName}</div>
                      </div>

                      {selectedFleetMappings.length > 0 ? (
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-gray-500">Linked Components ({selectedFleetMappings.length})</div>
                          {selectedFleetMappings.map((m) => (
                            <div key={`${m.fleetEquipmentCode}-${m.componentCode}`} className="p-2 border rounded-md flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-medium truncate">{m.componentCode}</div>
                                <div className="text-xs text-gray-500 truncate">{m.componentName}</div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveMapping(m)}
                                className="text-red-500 shrink-0"
                                data-testid={`button-remove-mapping-${m.componentCode}`}
                              >
                                <span className="text-xs">x</span>
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <Badge variant="secondary" className="text-xs">Not Mapped</Badge>
                          <p className="text-xs text-gray-500 mt-2">Select a vessel component on the right to create a mapping</p>
                        </div>
                      )}

                      {selectedVesselItem && selectedFleetItem && (
                        <Button
                          onClick={handleManualMap}
                          disabled={createMappingMutation.isPending}
                          className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
                          data-testid="button-create-mapping"
                        >
                          {createMappingMutation.isPending ? "Creating..." : "Link Selected"}
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    <Ship className="h-4 w-4 text-cyan-600" />
                    Vessel Components
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Code</th>
                          <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Name</th>
                          <th className="sticky top-0 bg-gray-50 z-10 text-center px-3 py-2 text-xs font-medium text-gray-500">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoadingVessel ? (
                          <tr>
                            <td colSpan={3} className="text-center py-8">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500 mx-auto" />
                            </td>
                          </tr>
                        ) : filteredVesselComponents.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="text-center py-8 text-gray-500 text-xs">No vessel components found</td>
                          </tr>
                        ) : (
                          filteredVesselComponents.map((vc) => {
                            const code = vc.componentCode || "";
                            const isMapped = mappedComponentCodes.has(code);
                            const isSelected = selectedVesselItem === code;
                            const isLinkedFromLeft = linkedComponentCodes.has(code);
                            return (
                              <tr
                                key={vc.id}
                                className={`cursor-pointer border-b transition-colors text-xs ${
                                  isSelected
                                    ? "bg-blue-100"
                                    : isLinkedFromLeft
                                    ? "bg-green-100"
                                    : "hover:bg-blue-50/50"
                                }`}
                                onClick={() => {
                                  setSelectedVesselItem(code);
                                }}
                                data-testid={`row-vessel-${vc.id}`}
                              >
                                <td className="px-3 py-2 font-mono">{code}</td>
                                <td className="px-3 py-2 truncate max-w-[200px]" title={vc.name || ""}>{vc.name}</td>
                                <td className="px-3 py-2 text-center">
                                  {isMapped ? (
                                    <div className="w-3 h-3 rounded-full bg-green-500 mx-auto" data-testid={`status-mapped-${vc.id}`} />
                                  ) : (
                                    <div className="w-3 h-3 rounded-full border-2 border-gray-300 mx-auto" data-testid={`status-unmapped-${vc.id}`} />
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={autoMatchDialogOpen} onOpenChange={setAutoMatchDialogOpen}>
        <DialogContent className="p-0 gap-0" style={{ width: "50vw", maxWidth: "50vw", maxHeight: "85vh" }}>
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 pl-4 pr-10 py-2.5 flex items-center justify-between gap-2 rounded-t-lg flex-wrap">
            <div className="flex items-center gap-2">
              <Ship className="h-3.5 w-3.5 text-white" />
              <DialogTitle className="text-xs font-semibold text-white m-0">Auto-Match Results</DialogTitle>
            </div>
            <Button
              onClick={handleCreateAutoMappings}
              className="h-6 px-2 text-[10px] bg-white text-blue-700 hover:bg-gray-100"
              data-testid="button-create-auto-mappings"
            >
              Create Mapping
            </Button>
          </div>
          <ScrollArea className="max-h-[70vh]">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Component Code</th>
                  <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Component Name</th>
                  <th className="sticky top-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-medium text-gray-500">Fleet Equipment Code</th>
                  <th className="sticky top-0 bg-gray-50 z-10 text-center px-3 py-2 text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {autoMatchEntries.map((entry) => (
                  <tr key={entry.vesselComponentCode} className="border-b text-xs hover:bg-blue-50/50">
                    <td className="px-3 py-2 font-mono">{entry.vesselComponentCode}</td>
                    <td className="px-3 py-2 truncate max-w-[200px]">{entry.vesselComponentName}</td>
                    <td className="px-3 py-2 font-mono">{entry.fleetEquipmentCode || "-"}</td>
                    <td className="px-3 py-2 text-center">
                      {entry.matched ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">Matched</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px]">No Match</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {autoMatchEntries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-500 text-xs">No vessel components to match</td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={summaryDialogOpen} onOpenChange={setSummaryDialogOpen}>
        <DialogContent className="p-0 gap-0" style={{ maxWidth: "400px" }}>
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 pl-4 pr-10 py-2.5 rounded-t-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              <DialogTitle className="text-xs font-semibold text-white m-0">Auto-Match Summary</DialogTitle>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm" data-testid="text-summary-linked">Successfully Linked: {summaryData.linked}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm" data-testid="text-summary-not-linked">Not Linked: {summaryData.notLinked}</span>
            </div>
            <Button onClick={() => setSummaryDialogOpen(false)} className="w-full" data-testid="button-close-summary">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
