import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, ChevronDown, Plus, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Component, Job, Spare, MasterData } from "@shared/schema";

interface MappedFleetComponent {
  id: string | number;
  fleetEquipmentCode: string;
  fleetEquipmentName: string;
  componentCode?: string | null;
  name?: string | null;
  maker?: string | null;
  makerCode?: string | null;
  model?: string | null;
  modelCode?: string | null;
  location?: string | null;
  rating?: string | null;
  notes?: string | null;
  category?: string | null;
  componentCategory?: string | null;
  department?: string | null;
  eqptSystemDept?: string | null;
  parentFleetEquipmentCode?: string | null;
  sfiCode?: string | null;
  vesselId?: string | null;
  vesselName?: string | null;
  vesselCode?: string | null;
  assignedSubCode?: string | null;
}

function mapMasterDataToFleetComponent(item: MasterData): MappedFleetComponent {
  const fleetCode = item.fleetEquipmentCode;
  const parentCode = item.assignedSubCode 
    ? fleetCode.replace(new RegExp(`\\.${item.assignedSubCode}$`), '') 
    : (fleetCode.includes('.') ? fleetCode.split('.').slice(0, -1).join('.') : null);
  
  return {
    id: item.id,
    fleetEquipmentCode: fleetCode,
    fleetEquipmentName: item.equipmentName,
    componentCode: fleetCode,
    name: item.equipmentName,
    maker: item.makerName,
    makerCode: item.makerCode,
    model: item.model,
    modelCode: item.modelCode,
    sfiCode: item.sfiCode,
    location: null,
    rating: null,
    notes: null,
    category: item.sfiCode?.substring(0, 1) || null,
    componentCategory: null,
    department: null,
    eqptSystemDept: null,
    parentFleetEquipmentCode: parentCode,
    vesselId: item.vesselCode || null,
    vesselName: item.vesselName || null,
    vesselCode: item.vesselCode || null,
    assignedSubCode: item.assignedSubCode || null,
  };
}

type FleetComponent = MappedFleetComponent;
type FleetJob = Job;
type FleetSpare = Spare;

interface TreeNode {
  code: string;
  name: string;
  children: TreeNode[];
  data?: FleetComponent;
  isExpanded?: boolean;
}

function buildTree(components: FleetComponent[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const rootNodes: TreeNode[] = [];

  const sfiCategories = [
    { code: "1", name: "Ship General" },
    { code: "2", name: "Hull" },
    { code: "3", name: "Equipment for Cargo" },
    { code: "4", name: "Ship's Equipment" },
    { code: "5", name: "Equipment for Crew & Passengers" },
    { code: "6", name: "Machinery Main Components" },
    { code: "7", name: "Systems for Machinery Main Components" },
    { code: "8", name: "Ship Common Systems" },
  ];

  sfiCategories.forEach((cat) => {
    const node: TreeNode = {
      code: cat.code,
      name: cat.name,
      children: [],
      isExpanded: false,
    };
    nodeMap.set(cat.code, node);
    rootNodes.push(node);
  });

  const groupedByPrefix = new Map<string, FleetComponent[]>();
  components.forEach((comp) => {
    const code = String(comp.fleetEquipmentCode || comp.componentCode || comp.id);
    if (!code) return;
    const prefix = code.charAt(0);
    if (!groupedByPrefix.has(prefix)) {
      groupedByPrefix.set(prefix, []);
    }
    groupedByPrefix.get(prefix)!.push(comp);
  });

  groupedByPrefix.forEach((items, prefix) => {
    const parentNode = nodeMap.get(prefix);
    if (parentNode) {
      const subGroups = new Map<string, FleetComponent[]>();
      items.forEach((item) => {
        const code = String(item.fleetEquipmentCode || item.componentCode || item.id);
        if (!code) return;
        const parts = code.split(".");
        const subPrefix = parts.length > 0 ? parts[0] : code;
        if (!subGroups.has(subPrefix)) {
          subGroups.set(subPrefix, []);
        }
        subGroups.get(subPrefix)!.push(item);
      });

      subGroups.forEach((subItems, subCode) => {
        if (subItems.length === 1 && subCode.length <= 2) {
          const item = subItems[0];
          const childNode: TreeNode = {
            code: String(item.fleetEquipmentCode || item.componentCode || item.id),
            name: item.fleetEquipmentName || item.name || "Unknown",
            children: [],
            data: item,
          };
          parentNode.children.push(childNode);
        } else {
          const firstItem = subItems[0];
          const subNode: TreeNode = {
            code: subCode,
            name: firstItem?.fleetEquipmentName || firstItem?.name || `Group ${subCode}`,
            children: [],
            isExpanded: false,
          };

          subItems.forEach((item) => {
            const leafNode: TreeNode = {
              code: String(item.fleetEquipmentCode || item.componentCode || item.id),
              name: item.fleetEquipmentName || item.name || "Unknown",
              children: [],
              data: item,
            };
            subNode.children.push(leafNode);
          });

          if (subNode.children.length === 1) {
            parentNode.children.push(subNode.children[0]);
          } else {
            parentNode.children.push(subNode);
          }
        }
      });
    }
  });

  return rootNodes;
}

function TreeItem({
  node,
  level = 0,
  selectedCode,
  onSelect,
  expandedNodes,
  onToggle,
}: {
  node: TreeNode;
  level?: number;
  selectedCode: string | null;
  onSelect: (node: TreeNode) => void;
  expandedNodes: Set<string>;
  onToggle: (code: string) => void;
}) {
  const isExpanded = expandedNodes.has(node.code);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedCode === node.code;

  return (
    <div>
      <div
        className={`flex items-center py-2 px-2 cursor-pointer hover:bg-gray-100 ${
          isSelected ? "bg-blue-100 text-blue-800" : ""
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => {
          if (hasChildren) {
            onToggle(node.code);
          }
          onSelect(node);
        }}
        data-testid={`tree-node-${node.code}`}
      >
        {hasChildren ? (
          <span className="mr-2">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
          </span>
        ) : (
          <span className="mr-2 w-4" />
        )}
        <span className={`text-sm ${level === 0 ? "font-medium" : ""}`}>
          {node.code}. {node.name}
        </span>
      </div>
      {isExpanded &&
        node.children.map((child) => (
          <TreeItem
            key={child.code}
            node={child}
            level={level + 1}
            selectedCode={selectedCode}
            onSelect={onSelect}
            expandedNodes={expandedNodes}
            onToggle={onToggle}
          />
        ))}
    </div>
  );
}

interface ComponentVesselMapping {
  id: number;
  componentId: string;
  fleetEquipmentCode: string;
  vesselId: string;
  vesselCode: string;
  vesselName: string;
  componentCode?: string;
  componentName?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export default function FleetDataView() {
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false);
  const [selectedMappingIds, setSelectedMappingIds] = useState<Set<number>>(new Set());
  const [mappingSearchQuery, setMappingSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedVesselForDetail, setSelectedVesselForDetail] = useState<ComponentVesselMapping | null>(null);
  const [detailSearchQuery, setDetailSearchQuery] = useState("");
  const [selectedDetailMappingIds, setSelectedDetailMappingIds] = useState<Set<number>>(new Set());
  const [isVesselMappingDialogOpen, setIsVesselMappingDialogOpen] = useState(false);
  const [vesselMappingSearchQuery, setVesselMappingSearchQuery] = useState("");
  const [selectedVesselsToMap, setSelectedVesselsToMap] = useState<Set<string>>(new Set());
  const [isComponentMappingDialogOpen, setIsComponentMappingDialogOpen] = useState(false);
  const [componentMappingSearchQuery, setComponentMappingSearchQuery] = useState("");
  const [selectedComponentsToMap, setSelectedComponentsToMap] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const { data: masterDataResponse, isLoading: isComponentsLoading } = useQuery<{
    items: MasterData[];
    total: number;
  }>({
    queryKey: ["/api/fleet-admin/master-data?limit=1000"],
  });

  const { data: fleetJobs } = useQuery<FleetJob[]>({
    queryKey: ["/api/fleet/jobs"],
  });

  const { data: fleetSpares } = useQuery<FleetSpare[]>({
    queryKey: ["/api/fleet/spares"],
  });

  const { data: vessels } = useQuery<{ id: string; code?: string; name: string }[]>({
    queryKey: ["/api/vessels"],
  });

  const { data: componentVesselMappings } = useQuery<ComponentVesselMapping[]>({
    queryKey: ["/api/fleet-admin/component-vessel-mappings"],
  });

  const removeMappingsMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const results = await Promise.all(
        ids.map(id => apiRequest("DELETE", `/api/fleet-admin/component-vessel-mappings/${id}`))
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleet-admin/component-vessel-mappings"] });
      setSelectedMappingIds(new Set());
      toast({
        title: "Success",
        description: "Selected mappings have been removed",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to remove mappings",
        variant: "destructive",
      });
    },
  });

  const addMappingMutation = useMutation({
    mutationFn: async (data: { fleetEquipmentCode: string; vesselCode: string; vesselName: string; componentCode?: string; componentName?: string }) => {
      return apiRequest("POST", "/api/fleet-admin/component-vessel-mappings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleet-admin/component-vessel-mappings"] });
      toast({
        title: "Success",
        description: "Component mapping has been added",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add component mapping",
        variant: "destructive",
      });
    },
  });

  const mappedComponents = useMemo(() => {
    if (!masterDataResponse?.items) return [];
    return masterDataResponse.items.map(mapMasterDataToFleetComponent);
  }, [masterDataResponse?.items]);

  const treeData = useMemo(() => {
    if (!mappedComponents.length) return [];
    return buildTree(mappedComponents);
  }, [mappedComponents]);

  const handleToggle = (code: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(code)) {
        newSet.delete(code);
      } else {
        newSet.add(code);
      }
      return newSet;
    });
  };

  const selectedComponent = selectedNode?.data;

  useEffect(() => {
    setSelectedMappingIds(new Set());
    setMappingSearchQuery("");
  }, [selectedComponent?.id, selectedComponent?.fleetEquipmentCode]);

  const relatedJobs = useMemo(() => {
    if (!selectedComponent || !fleetJobs) return [];
    return fleetJobs.filter(
      (job: FleetJob) =>
        job.fleetEquipmentCode === selectedComponent.fleetEquipmentCode ||
        job.componentCode === selectedComponent.fleetEquipmentCode
    );
  }, [selectedComponent, fleetJobs]);

  const relatedSpares = useMemo(() => {
    if (!selectedComponent || !fleetSpares) return [];
    return fleetSpares.filter(
      (spare: FleetSpare) =>
        spare.fleetEquipmentCode === selectedComponent.fleetEquipmentCode ||
        spare.componentCode === selectedComponent.fleetEquipmentCode
    );
  }, [selectedComponent, fleetSpares]);

  const relatedVessels = useMemo(() => {
    if (!selectedComponent) return [];
    
    // First check if we have component-vessel mappings
    if (componentVesselMappings && componentVesselMappings.length > 0) {
      const mappings = componentVesselMappings.filter(
        (m) => m.fleetEquipmentCode === selectedComponent.fleetEquipmentCode ||
               m.componentId === String(selectedComponent.id)
      );
      if (mappings.length > 0) {
        return mappings.map(m => ({
          id: m.vesselCode,
          name: m.vesselName,
          mapping: m
        }));
      }
    }
    
    // Fallback: if component has vesselId, find that vessel
    if (selectedComponent.vesselId && vessels) {
      const vessel = vessels.find((v) => v.id === selectedComponent.vesselId);
      if (vessel) {
        return [{ id: vessel.code || vessel.id, name: vessel.name, mapping: null }];
      }
    }
    
    return [];
  }, [selectedComponent, vessels, componentVesselMappings]);

  const filteredMappingsForDialog = useMemo(() => {
    if (!selectedComponent || !componentVesselMappings) return [];
    
    let mappings = componentVesselMappings.filter(
      (m) => m.fleetEquipmentCode === selectedComponent.fleetEquipmentCode ||
             m.componentId === String(selectedComponent.id)
    );
    
    if (mappingSearchQuery.trim()) {
      const query = mappingSearchQuery.toLowerCase();
      mappings = mappings.filter(
        (m) => 
          m.vesselName?.toLowerCase().includes(query) ||
          m.vesselCode?.toLowerCase().includes(query) ||
          m.componentCode?.toLowerCase().includes(query) ||
          m.componentName?.toLowerCase().includes(query)
      );
    }
    
    return mappings;
  }, [selectedComponent, componentVesselMappings, mappingSearchQuery]);

  const filteredDetailMappings = useMemo(() => {
    if (!selectedVesselForDetail || !selectedComponent || !componentVesselMappings) return [];
    
    let mappings = componentVesselMappings.filter(
      (m) => (m.vesselCode === selectedVesselForDetail.vesselCode || 
              m.vesselId === selectedVesselForDetail.vesselId) &&
             (m.fleetEquipmentCode === selectedComponent.fleetEquipmentCode ||
              m.componentId === String(selectedComponent.id))
    );
    
    if (detailSearchQuery.trim()) {
      const query = detailSearchQuery.toLowerCase();
      mappings = mappings.filter(
        (m) => 
          m.vesselName?.toLowerCase().includes(query) ||
          (m.componentCode || m.fleetEquipmentCode || "").toLowerCase().includes(query) ||
          (m.componentName || "").toLowerCase().includes(query)
      );
    }
    
    return mappings;
  }, [selectedVesselForDetail, selectedComponent, componentVesselMappings, detailSearchQuery]);

  const unmappedVessels = useMemo(() => {
    if (!selectedComponent || !vessels) return [];
    
    const mappedVesselCodes = new Set(
      (componentVesselMappings || [])
        .filter(m => m.fleetEquipmentCode === selectedComponent.fleetEquipmentCode ||
                     m.componentId === String(selectedComponent.id))
        .map(m => m.vesselCode)
    );
    
    let available = vessels.filter(v => !mappedVesselCodes.has(v.code || v.id));
    
    if (vesselMappingSearchQuery.trim()) {
      const query = vesselMappingSearchQuery.toLowerCase();
      available = available.filter(v => 
        v.name?.toLowerCase().includes(query) ||
        (v.code || v.id)?.toLowerCase().includes(query)
      );
    }
    
    return available;
  }, [selectedComponent, vessels, componentVesselMappings, vesselMappingSearchQuery]);

  const handleVesselMappingCheckboxChange = (vesselCode: string, checked: boolean) => {
    setSelectedVesselsToMap((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(vesselCode);
      } else {
        newSet.delete(vesselCode);
      }
      return newSet;
    });
  };

  const handleSelectAllVesselsToMap = (checked: boolean) => {
    if (checked) {
      setSelectedVesselsToMap(new Set(unmappedVessels.map(v => v.code || v.id)));
    } else {
      setSelectedVesselsToMap(new Set());
    }
  };

  const handleMapVessels = () => {
    if (selectedVesselsToMap.size === 0 || !selectedComponent) return;
    
    const vesselsToMap = unmappedVessels.filter(v => selectedVesselsToMap.has(v.code || v.id));
    
    Promise.all(
      vesselsToMap.map(vessel => 
        addMappingMutation.mutateAsync({
          fleetEquipmentCode: selectedComponent.fleetEquipmentCode,
          vesselCode: vessel.code || vessel.id,
          vesselName: vessel.name,
          componentCode: selectedComponent.fleetEquipmentCode,
          componentName: selectedComponent.fleetEquipmentName,
        })
      )
    ).then(() => {
      setSelectedVesselsToMap(new Set());
      setVesselMappingSearchQuery("");
      setIsVesselMappingDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/fleet-admin/component-vessel-mappings"] });
      toast({
        title: "Success",
        description: `${vesselsToMap.length} vessel(s) have been mapped`,
      });
    }).catch(() => {
      toast({
        title: "Error",
        description: "Failed to map vessels. Please try again.",
        variant: "destructive",
      });
    });
  };

  const unmappedComponentsForVessel = useMemo(() => {
    if (!selectedVesselForDetail || !selectedComponent || !mappedComponents) return [];
    
    const mappedComponentCodes = new Set(
      (componentVesselMappings || [])
        .filter(m => m.vesselCode === selectedVesselForDetail.vesselCode || 
                     m.vesselId === selectedVesselForDetail.vesselId)
        .map(m => m.fleetEquipmentCode || m.componentCode)
    );
    
    let available = mappedComponents.filter(c => {
      const code = c.fleetEquipmentCode || c.componentCode;
      return code && 
             code.startsWith(selectedComponent.fleetEquipmentCode + ".") &&
             !mappedComponentCodes.has(code);
    });
    
    if (componentMappingSearchQuery.trim()) {
      const query = componentMappingSearchQuery.toLowerCase();
      available = available.filter(c => 
        c.fleetEquipmentCode?.toLowerCase().includes(query) ||
        c.fleetEquipmentName?.toLowerCase().includes(query) ||
        c.componentCode?.toLowerCase().includes(query) ||
        c.name?.toLowerCase().includes(query)
      );
    }
    
    return available;
  }, [selectedVesselForDetail, selectedComponent, mappedComponents, componentVesselMappings, componentMappingSearchQuery]);

  const handleComponentMappingCheckboxChange = (componentCode: string, checked: boolean) => {
    setSelectedComponentsToMap((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(componentCode);
      } else {
        newSet.delete(componentCode);
      }
      return newSet;
    });
  };

  const handleSelectAllComponentsToMap = (checked: boolean) => {
    if (checked) {
      setSelectedComponentsToMap(new Set(unmappedComponentsForVessel.map(c => c.fleetEquipmentCode)));
    } else {
      setSelectedComponentsToMap(new Set());
    }
  };

  const handleMapComponents = () => {
    if (selectedComponentsToMap.size === 0 || !selectedVesselForDetail) return;
    
    const componentsToMap = unmappedComponentsForVessel.filter(c => 
      selectedComponentsToMap.has(c.fleetEquipmentCode)
    );
    
    Promise.all(
      componentsToMap.map(component => 
        addMappingMutation.mutateAsync({
          fleetEquipmentCode: component.fleetEquipmentCode,
          vesselCode: selectedVesselForDetail.vesselCode,
          vesselName: selectedVesselForDetail.vesselName,
          componentCode: component.fleetEquipmentCode,
          componentName: component.fleetEquipmentName,
        })
      )
    ).then(() => {
      setSelectedComponentsToMap(new Set());
      setComponentMappingSearchQuery("");
      setIsComponentMappingDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/fleet-admin/component-vessel-mappings"] });
      toast({
        title: "Success",
        description: `${componentsToMap.length} component(s) have been mapped`,
      });
    }).catch(() => {
      toast({
        title: "Error",
        description: "Failed to map components. Please try again.",
        variant: "destructive",
      });
    });
  };

  const handleMappingCheckboxChange = (mappingId: number, checked: boolean) => {
    setSelectedMappingIds((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(mappingId);
      } else {
        newSet.delete(mappingId);
      }
      return newSet;
    });
  };

  const handleSelectAllMappings = (checked: boolean) => {
    if (checked) {
      setSelectedMappingIds(new Set(filteredMappingsForDialog.map((m) => m.id)));
    } else {
      setSelectedMappingIds(new Set());
    }
  };

  const handleRemoveMappings = () => {
    if (selectedMappingIds.size === 0) return;
    removeMappingsMutation.mutate(Array.from(selectedMappingIds));
  };

  const handleDetailMappingCheckboxChange = (mappingId: number, checked: boolean) => {
    setSelectedDetailMappingIds((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(mappingId);
      } else {
        newSet.delete(mappingId);
      }
      return newSet;
    });
  };

  const handleSelectAllDetailMappings = (checked: boolean) => {
    if (checked) {
      setSelectedDetailMappingIds(new Set(filteredDetailMappings.map((m) => m.id)));
    } else {
      setSelectedDetailMappingIds(new Set());
    }
  };

  const handleRemoveDetailMappings = () => {
    if (selectedDetailMappingIds.size === 0) return;
    removeMappingsMutation.mutate(Array.from(selectedDetailMappingIds), {
      onSuccess: () => {
        setSelectedDetailMappingIds(new Set());
        setIsDetailDialogOpen(false);
        setSelectedVesselForDetail(null);
        queryClient.invalidateQueries({ queryKey: ["/api/fleet-admin/component-vessel-mappings"] });
        toast({
          title: "Success",
          description: "Selected mappings have been removed",
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to remove mappings. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  const handleOpenMappingDialog = () => {
    if (selectedComponent) {
      setSelectedMappingIds(new Set());
      setMappingSearchQuery("");
      setIsMappingDialogOpen(true);
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] bg-gray-50">
      <div className="w-80 bg-white border-r flex flex-col">
        <div className="bg-cyan-600 text-white px-4 py-3 font-semibold">
          Fleet Components
        </div>
        <ScrollArea className="flex-1">
          {isComponentsLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="h-8 bg-gray-100 animate-pulse rounded"
                />
              ))}
            </div>
          ) : (
            <div className="py-2">
              {treeData.map((node) => (
                <TreeItem
                  key={node.code}
                  node={node}
                  selectedCode={selectedNode?.code || null}
                  onSelect={setSelectedNode}
                  expandedNodes={expandedNodes}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {selectedComponent ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-600">
                {selectedComponent.fleetEquipmentCode}{" "}
                {selectedComponent.fleetEquipmentName}
              </h2>
              <Button
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
                data-testid="button-add-edit-fleet-component"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add / Edit Fleet Component
              </Button>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-cyan-600">
                  Fleet Component Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500 text-xs">Maker</div>
                    <div className="font-medium">
                      {selectedComponent.maker || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Maker Code</div>
                    <div className="font-medium">
                      {selectedComponent.makerCode || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Model</div>
                    <div className="font-medium">
                      {selectedComponent.model || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Model Code</div>
                    <div className="font-medium">
                      {selectedComponent.modelCode || "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-500 text-xs">
                      Fleet Equipment Code
                    </div>
                    <div className="font-medium">
                      {selectedComponent.fleetEquipmentCode || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Parent Code</div>
                    <div className="font-medium">
                      {selectedComponent.parentFleetEquipmentCode ||
                        selectedComponent.fleetEquipmentCode?.split(".")[0] ||
                        "—"}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-gray-500 text-xs">
                      Fleet Equipment Name
                    </div>
                    <div className="font-medium">
                      {selectedComponent.fleetEquipmentName || selectedComponent.name || "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-500 text-xs">
                      Component Category
                    </div>
                    <div className="font-medium">
                      {selectedComponent.componentCategory || selectedComponent.category || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Location</div>
                    <div className="font-medium">
                      {selectedComponent.location || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Rating</div>
                    <div className="font-medium">
                      {selectedComponent.rating || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">
                      Eqpt / System Department
                    </div>
                    <div className="font-medium">
                      {selectedComponent.eqptSystemDept || selectedComponent.department || "—"}
                    </div>
                  </div>

                  <div className="col-span-4">
                    <div className="text-gray-500 text-xs">Notes</div>
                    <div className="font-medium">
                      {selectedComponent.notes || "—"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-orange-500">
                  Fleet Job Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                {relatedJobs.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-gray-500 text-xs">
                        <th className="text-left py-2 font-normal">Job No.</th>
                        <th className="text-left py-2 font-normal">
                          Job Title
                        </th>
                        <th className="text-left py-2 font-normal">
                          Task Type
                        </th>
                        <th className="text-left py-2 font-normal">
                          Frequency
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatedJobs.map((job: FleetJob, index: number) => (
                        <tr key={index} className="border-b last:border-0">
                          <td className="py-2">{job.fleetJobCode || job.jobNo || job.id}</td>
                          <td className="py-2">
                            {job.jobTitle || "—"}
                          </td>
                          <td className="py-2">
                            {job.maintenanceType || "—"}
                          </td>
                          <td className="py-2">
                            {job.frequencyValue && job.frequencyUnit 
                              ? `${job.frequencyValue} ${job.frequencyUnit}` 
                              : job.intervalRunningHour 
                                ? `${job.intervalRunningHour} RH` 
                                : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-gray-500 text-sm">
                    No jobs linked to this component
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-green-600">
                  Fleet Spares Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                {relatedSpares.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-gray-500 text-xs">
                        <th className="text-left py-2 font-normal">
                          Part Code
                        </th>
                        <th className="text-left py-2 font-normal">
                          Part Name
                        </th>
                        <th className="text-left py-2 font-normal">
                          Part Number
                        </th>
                        <th className="text-left py-2 font-normal">Maker</th>
                        <th className="text-left py-2 font-normal">
                          Unit Of Measurement
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatedSpares.map((spare: FleetSpare, index: number) => (
                        <tr key={index} className="border-b last:border-0">
                          <td className="py-2">
                            {spare.fleetPartCode || spare.partCode}
                          </td>
                          <td className="py-2">
                            {spare.partName || "—"}
                          </td>
                          <td className="py-2">{spare.partNumber || "—"}</td>
                          <td className="py-2">{spare.maker || "—"}</td>
                          <td className="py-2">{spare.uom || spare.unit || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-gray-500 text-sm">
                    No spares linked to this component
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle 
                  className="text-base font-semibold text-purple-600 cursor-pointer hover:underline inline-block border border-purple-600 px-2 py-1 rounded"
                  onClick={handleOpenMappingDialog}
                  data-testid="btn-vessel-mapping-overview-header"
                >
                  Vessel Mapping Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {relatedVessels.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-gray-500 text-xs">
                        <th className="text-left py-2 font-normal">
                          Vessel Code
                        </th>
                        <th className="text-left py-2 font-normal">
                          Vessel Name
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatedVessels.map((vessel, index) => (
                        <tr key={index} className="border-b last:border-0">
                          <td className="py-2">{vessel.id}</td>
                          <td 
                            className="py-2 cursor-pointer text-blue-600 hover:underline"
                            onClick={() => {
                              if (vessel.mapping) {
                                setSelectedVesselForDetail(vessel.mapping);
                                setSelectedDetailMappingIds(new Set());
                                setDetailSearchQuery("");
                                setIsDetailDialogOpen(true);
                              }
                            }}
                            data-testid={`main-vessel-name-${vessel.id}`}
                          >
                            {vessel.name}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-gray-500 text-sm">
                    No vessels mapped to this component
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <FolderTree className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Select a component from the tree</p>
              <p className="text-sm">
                to view its details, jobs, spares, and vessel mappings
              </p>
            </div>
          </div>
        )}
      </div>

      <Dialog 
        open={isMappingDialogOpen} 
        onOpenChange={(open) => {
          setIsMappingDialogOpen(open);
          if (!open) {
            setSelectedMappingIds(new Set());
            setMappingSearchQuery("");
            setIsSearchOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader className="flex flex-row items-center justify-between pb-3">
            <DialogTitle className="text-base font-semibold text-gray-800">
              Vessel Mapping Overview
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemoveMappings}
                disabled={selectedMappingIds.size === 0 || removeMappingsMutation.isPending}
                className="text-blue-600 border-blue-600 hover:bg-blue-50"
                data-testid="btn-remove-mapping"
              >
                Remove Mapping
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  setSelectedVesselsToMap(new Set());
                  setVesselMappingSearchQuery("");
                  setIsVesselMappingDialogOpen(true);
                }}
                data-testid="btn-vessel-mapping"
              >
                Vessel Mapping
              </Button>
            </div>
          </DialogHeader>

          <ScrollArea className="h-[300px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b text-gray-500 text-xs">
                  <th className="text-left py-2 px-2 font-normal w-12">
                    <Checkbox
                      checked={
                        filteredMappingsForDialog.length > 0 &&
                        filteredMappingsForDialog.every((m) => selectedMappingIds.has(m.id))
                      }
                      onCheckedChange={handleSelectAllMappings}
                      data-testid="checkbox-select-all"
                    />
                  </th>
                  <th className="text-left py-2 px-2 font-normal">Vessel Code</th>
                  <th className="text-left py-2 px-2 font-normal">Vessel Name</th>
                </tr>
              </thead>
              <tbody>
                {filteredMappingsForDialog.length > 0 ? (
                  filteredMappingsForDialog.map((mapping) => (
                    <tr key={mapping.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 px-2">
                        <Checkbox
                          checked={selectedMappingIds.has(mapping.id)}
                          onCheckedChange={(checked) =>
                            handleMappingCheckboxChange(mapping.id, checked as boolean)
                          }
                          data-testid={`checkbox-mapping-${mapping.id}`}
                        />
                      </td>
                      <td className="py-2 px-2">{mapping.vesselCode || mapping.vesselId}</td>
                      <td 
                        className="py-2 px-2 cursor-pointer text-blue-600 hover:underline"
                        onClick={() => {
                          setSelectedVesselForDetail(mapping);
                          setSelectedDetailMappingIds(new Set());
                          setDetailSearchQuery("");
                          setIsDetailDialogOpen(true);
                        }}
                        data-testid={`vessel-name-${mapping.id}`}
                      >
                        {mapping.vesselName}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-gray-500">
                      No vessel mappings found for this component
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog 
        open={isDetailDialogOpen} 
        onOpenChange={(open) => {
          setIsDetailDialogOpen(open);
          if (!open) {
            setDetailSearchQuery("");
            setSelectedDetailMappingIds(new Set());
            setSelectedVesselForDetail(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-3">
            <DialogTitle className="text-base font-semibold text-gray-700 border border-gray-300 px-3 py-1 rounded">
              Vessel Component Mapping Overview
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemoveDetailMappings}
                disabled={selectedDetailMappingIds.size === 0 || removeMappingsMutation.isPending}
                className="text-blue-600 border-blue-600 hover:bg-blue-50"
                data-testid="btn-detail-remove-mapping"
              >
                Remove Mapping
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  setSelectedComponentsToMap(new Set());
                  setComponentMappingSearchQuery("");
                  setIsComponentMappingDialogOpen(true);
                }}
                data-testid="btn-detail-component-mapping"
              >
                ComponentMapping
              </Button>
            </div>
          </DialogHeader>
          
          <div className="py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search components..."
                value={detailSearchQuery}
                onChange={(e) => setDetailSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-detail-search"
              />
            </div>
          </div>

          <ScrollArea className="h-[400px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b text-gray-500 text-xs">
                  <th className="text-left py-2 px-2 font-normal w-12">
                    <Checkbox
                      checked={
                        filteredDetailMappings.length > 0 &&
                        filteredDetailMappings.every((m) => selectedDetailMappingIds.has(m.id))
                      }
                      onCheckedChange={handleSelectAllDetailMappings}
                      data-testid="checkbox-detail-select-all"
                    />
                  </th>
                  <th className="text-left py-2 px-2 font-normal">Vessel Name</th>
                  <th className="text-left py-2 px-2 font-normal">Component Code</th>
                  <th className="text-left py-2 px-2 font-normal">Component Name</th>
                </tr>
              </thead>
              <tbody>
                {filteredDetailMappings.length > 0 ? (
                  filteredDetailMappings.map((mapping) => (
                    <tr key={mapping.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 px-2">
                        <Checkbox
                          checked={selectedDetailMappingIds.has(mapping.id)}
                          onCheckedChange={(checked) =>
                            handleDetailMappingCheckboxChange(mapping.id, checked as boolean)
                          }
                          data-testid={`checkbox-detail-row-${mapping.id}`}
                        />
                      </td>
                      <td className="py-2 px-2">{mapping.vesselName}</td>
                      <td className="py-2 px-2">{mapping.componentCode || mapping.fleetEquipmentCode || selectedComponent?.fleetEquipmentCode}</td>
                      <td className="py-2 px-2">{mapping.componentName || selectedComponent?.fleetEquipmentName || "Main Engine"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500">
                      No matching components found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog 
        open={isVesselMappingDialogOpen} 
        onOpenChange={(open) => {
          setIsVesselMappingDialogOpen(open);
          if (!open) {
            setVesselMappingSearchQuery("");
            setSelectedVesselsToMap(new Set());
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader className="flex flex-row items-center justify-between pb-3">
            <DialogTitle className="text-base font-semibold text-gray-800">
              Vessel Mapping
            </DialogTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search..."
                  value={vesselMappingSearchQuery}
                  onChange={(e) => setVesselMappingSearchQuery(e.target.value)}
                  className="w-32 pr-8"
                  data-testid="input-vessel-mapping-search"
                />
                <Search className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                onClick={handleMapVessels}
                disabled={selectedVesselsToMap.size === 0 || addMappingMutation.isPending}
                data-testid="btn-map-vessels"
              >
                Map
              </Button>
            </div>
          </DialogHeader>

          <ScrollArea className="h-[300px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b text-gray-500 text-xs">
                  <th className="text-left py-2 px-2 font-normal w-12">
                    <span className="text-gray-600">Select</span>
                  </th>
                  <th className="text-left py-2 px-2 font-normal text-blue-600">Vessel Code</th>
                  <th className="text-left py-2 px-2 font-normal">Vessel Name</th>
                </tr>
              </thead>
              <tbody>
                {unmappedVessels.length > 0 ? (
                  unmappedVessels.map((vessel) => (
                    <tr key={vessel.code || vessel.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 px-2">
                        <Checkbox
                          checked={selectedVesselsToMap.has(vessel.code || vessel.id)}
                          onCheckedChange={(checked) =>
                            handleVesselMappingCheckboxChange(vessel.code || vessel.id, checked as boolean)
                          }
                          data-testid={`checkbox-vessel-map-${vessel.code || vessel.id}`}
                        />
                      </td>
                      <td className="py-2 px-2">{vessel.code || vessel.id}</td>
                      <td className="py-2 px-2">{vessel.name}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-gray-500">
                      No vessels available to map
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog 
        open={isComponentMappingDialogOpen} 
        onOpenChange={(open) => {
          setIsComponentMappingDialogOpen(open);
          if (!open) {
            setComponentMappingSearchQuery("");
            setSelectedComponentsToMap(new Set());
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader className="flex flex-row items-center justify-between pb-3">
            <DialogTitle className="text-base font-semibold text-gray-800">
              Component Mapping
            </DialogTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Input
                  type="text"
                  placeholder={selectedComponent?.fleetEquipmentCode || "Search..."}
                  value={componentMappingSearchQuery}
                  onChange={(e) => setComponentMappingSearchQuery(e.target.value)}
                  className="w-32 pr-8"
                  data-testid="input-component-mapping-search"
                />
                <Search className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                onClick={handleMapComponents}
                disabled={selectedComponentsToMap.size === 0 || addMappingMutation.isPending}
                data-testid="btn-map-components"
              >
                Map
              </Button>
            </div>
          </DialogHeader>

          <ScrollArea className="h-[300px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b text-gray-500 text-xs">
                  <th className="text-left py-2 px-2 font-normal w-12">
                    <span className="text-gray-600">Select</span>
                  </th>
                  <th className="text-left py-2 px-2 font-normal">Component Code</th>
                  <th className="text-left py-2 px-2 font-normal">Component Name</th>
                </tr>
              </thead>
              <tbody>
                {unmappedComponentsForVessel.length > 0 ? (
                  unmappedComponentsForVessel.map((component) => (
                    <tr key={component.fleetEquipmentCode} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 px-2">
                        <Checkbox
                          checked={selectedComponentsToMap.has(component.fleetEquipmentCode)}
                          onCheckedChange={(checked) =>
                            handleComponentMappingCheckboxChange(component.fleetEquipmentCode, checked as boolean)
                          }
                          data-testid={`checkbox-component-map-${component.fleetEquipmentCode}`}
                        />
                      </td>
                      <td className="py-2 px-2">{component.fleetEquipmentCode}</td>
                      <td className="py-2 px-2">{component.fleetEquipmentName}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-gray-500">
                      No sub-components available to map
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FolderTree(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20 10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2.5a1 1 0 0 1-.8-.4l-.9-1.2A1 1 0 0 0 15 3h-2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z" />
      <path d="M20 21a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-2.9a1 1 0 0 1-.88-.55l-.42-.85a1 1 0 0 0-.88-.55H13a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1Z" />
      <path d="M3 5a2 2 0 0 0 2 2h3" />
      <path d="M3 3v13a2 2 0 0 0 2 2h3" />
    </svg>
  );
}
