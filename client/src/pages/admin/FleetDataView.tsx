import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useVessels } from "@/hooks/useVessels";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, ChevronDown, Plus, Search, Pencil, X, FileSpreadsheet, Trash2, Anchor } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Component, Job, Spare, MasterData, FleetComponents } from "@shared/schema";

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

function mapFleetComponentsToFleetComponent(item: FleetComponents): MappedFleetComponent {
  return {
    id: item.id,
    fleetEquipmentCode: item.fleetEquipmentCode,
    fleetEquipmentName: item.fleetEquipmentName,
    componentCode: item.fleetEquipmentCode,
    name: item.fleetEquipmentName,
    maker: item.makerName,
    makerCode: item.makerCode,
    model: item.model,
    modelCode: item.modelCode,
    sfiCode: null,
    location: item.location,
    rating: item.rating,
    notes: item.notes,
    category: item.componentCategory,
    componentCategory: item.componentCategory,
    department: item.eqptSystemDept,
    eqptSystemDept: item.eqptSystemDept,
    parentFleetEquipmentCode: item.parentFleetEquipmentCode,
    vesselId: null,
    vesselName: null,
    vesselCode: null,
    assignedSubCode: null,
  };
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
  const [, setLocation] = useLocation();
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
  
  // Fleet Job Information state
  const [isJobInfoDialogOpen, setIsJobInfoDialogOpen] = useState(false);
  const [isJobVesselMappingDialogOpen, setIsJobVesselMappingDialogOpen] = useState(false);
  const [isJobDetailsDialogOpen, setIsJobDetailsDialogOpen] = useState(false);
  const [isEditJobDialogOpen, setIsEditJobDialogOpen] = useState(false);
  const [isAddJobDialogOpen, setIsAddJobDialogOpen] = useState(false);
  const [selectedJobForDetail, setSelectedJobForDetail] = useState<FleetJob | null>(null);
  const [selectedJobVesselIds, setSelectedJobVesselIds] = useState<Set<string>>(new Set());
  const [jobFormData, setJobFormData] = useState<Partial<FleetJob>>({});
  const [newJobFormData, setNewJobFormData] = useState<Partial<FleetJob>>({});
  const [jobSearchQuery, setJobSearchQuery] = useState("");
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  
  // Fleet Spare Information state
  const [isSpareInfoDialogOpen, setIsSpareInfoDialogOpen] = useState(false);
  const [isSpareVesselMappingDialogOpen, setIsSpareVesselMappingDialogOpen] = useState(false);
  const [isSpareDetailsDialogOpen, setIsSpareDetailsDialogOpen] = useState(false);
  const [isEditSpareDialogOpen, setIsEditSpareDialogOpen] = useState(false);
  const [isAddSpareDialogOpen, setIsAddSpareDialogOpen] = useState(false);
  const [selectedSpareForDetail, setSelectedSpareForDetail] = useState<FleetSpare | null>(null);
  const [selectedSpareVesselIds, setSelectedSpareVesselIds] = useState<Set<string>>(new Set());
  const [spareFormData, setSpareFormData] = useState<Partial<FleetSpare>>({});
  
  const { toast } = useToast();

  // Query fleet_components table directly for Fleet Component data
  const { data: fleetComponentsData, isLoading: isFleetComponentsLoading } = useQuery<FleetComponents[]>({
    queryKey: ["/technical/api/fleet-admin/fleet-components"],
  });
  
  // Fallback to master-data for backward compatibility when fleet-components is empty
  const { data: masterDataResponse, isLoading: isMasterDataLoading } = useQuery<{
    items: MasterData[];
    total: number;
  }>({
    queryKey: ["/technical/api/fleet-admin/master-data?limit=1000"],
    enabled: !fleetComponentsData || fleetComponentsData.length === 0,
  });
  
  // Combine loading states
  const isComponentsLoading = isFleetComponentsLoading || isMasterDataLoading;

  const { data: fleetJobs } = useQuery<FleetJob[]>({
    queryKey: ["/technical/api/fleet/jobs"],
  });

  const { data: fleetSpares } = useQuery<FleetSpare[]>({
    queryKey: ["/technical/api/fleet/spares"],
  });

  const { data: vessels } = useVessels();

  const { data: componentVesselMappings } = useQuery<ComponentVesselMapping[]>({
    queryKey: ["/technical/api/fleet-admin/component-vessel-mappings"],
  });

  const removeMappingsMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const results = await Promise.all(
        ids.map(id => apiRequest("DELETE", `/technical/api/fleet-admin/component-vessel-mappings/${id}`))
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/component-vessel-mappings"] });
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
      return apiRequest("POST", "/technical/api/fleet-admin/component-vessel-mappings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/component-vessel-mappings"] });
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

  const createFleetJobMutation = useMutation({
    mutationFn: async (data: Partial<FleetJob> & { fleetEquipmentCode: string }) => {
      return apiRequest("POST", "/technical/api/fleet/jobs", {
        ...data,
        dataScope: "fleet",
        componentCode: data.fleetEquipmentCode,
        componentName: selectedComponent?.fleetEquipmentName || data.fleetEquipmentCode,
        title: data.jobTitle || "New Fleet Job",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet/jobs"] });
      setIsAddJobDialogOpen(false);
      setNewJobFormData({});
      toast({
        title: "Success",
        description: "New job has been created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create fleet job",
        variant: "destructive",
      });
    },
  });

  const mappedComponents = useMemo(() => {
    // Prioritize fleet_components table data
    if (fleetComponentsData && fleetComponentsData.length > 0) {
      return fleetComponentsData.map(mapFleetComponentsToFleetComponent);
    }
    // Fallback to master_data for backward compatibility
    if (!masterDataResponse?.items) return [];
    return masterDataResponse.items.map(mapMasterDataToFleetComponent);
  }, [fleetComponentsData, masterDataResponse?.items]);

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

  const filteredRelatedJobs = useMemo(() => {
    if (!jobSearchQuery.trim()) return relatedJobs;
    const query = jobSearchQuery.toLowerCase();
    return relatedJobs.filter((job: FleetJob) => {
      const jobNo = (job.fleetJobCode || job.jobNo || job.id || "").toString().toLowerCase();
      const jobTitle = (job.jobTitle || "").toLowerCase();
      const taskType = (job.maintenanceType || "").toLowerCase();
      return jobNo.includes(query) || jobTitle.includes(query) || taskType.includes(query);
    });
  }, [relatedJobs, jobSearchQuery]);

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
      queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/component-vessel-mappings"] });
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
      queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/component-vessel-mappings"] });
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
        queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/component-vessel-mappings"] });
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
                onClick={() => setLocation("/admin/fleet-component-editor")}
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
                <CardTitle 
                  className="text-base font-semibold text-orange-500 cursor-pointer hover:underline inline-block border border-orange-500 px-2 py-1 rounded"
                  onClick={() => setIsJobInfoDialogOpen(true)}
                  data-testid="btn-fleet-job-info-header"
                >
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
                        <tr 
                          key={index} 
                          className="border-b last:border-0 cursor-pointer hover:bg-gray-50"
                          onDoubleClick={() => {
                            setSelectedJobForDetail(job);
                            setIsJobDetailsDialogOpen(true);
                          }}
                          data-testid={`job-row-${index}`}
                        >
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
                <CardTitle 
                  className="text-base font-semibold text-green-600 cursor-pointer hover:underline inline-block border border-green-600 px-2 py-1 rounded"
                  onClick={() => setIsSpareInfoDialogOpen(true)}
                  data-testid="btn-fleet-spare-info-header"
                >
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
                        <tr 
                          key={index} 
                          className="border-b last:border-0 hover:bg-gray-50"
                          data-testid={`spare-row-${index}`}
                        >
                          <td className="py-2">
                            <button
                              className="text-blue-600 hover:text-blue-800 underline text-left"
                              onClick={() => {
                                setSelectedSpareForDetail(spare);
                                setIsSpareDetailsDialogOpen(true);
                              }}
                              data-testid={`btn-spare-detail-${index}`}
                            >
                              {spare.fleetPartCode || spare.partCode}
                            </button>
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
          <div className="h-full flex flex-col">
            <div className="flex justify-end mb-4">
              <Button
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
                onClick={() => setLocation("/admin/fleet-component-editor")}
                data-testid="button-add-edit-fleet-component"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add / Edit Fleet Component
              </Button>
            </div>
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <FolderTree className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">Select a component from the tree</p>
                <p className="text-sm">
                  to view its details, jobs, spares, and vessel mappings
                </p>
              </div>
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

      {/* Fleet Job Information Dialog */}
      <Dialog open={isJobInfoDialogOpen} onOpenChange={(open) => {
        setIsJobInfoDialogOpen(open);
        if (!open) {
          setJobSearchQuery("");
          setSelectedJobIds(new Set());
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[80vh]">
          <DialogHeader className="flex flex-row items-center justify-between pb-3">
            <DialogTitle className="text-lg font-semibold text-blue-500">
              Fleet Job Information
            </DialogTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search Job Title/Job No./Task Type"
                  value={jobSearchQuery}
                  onChange={(e) => setJobSearchQuery(e.target.value)}
                  className="pl-9 w-80"
                  data-testid="input-job-search"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-600 hover:text-red-600"
                disabled={selectedJobIds.size === 0}
                data-testid="btn-delete-jobs"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  setNewJobFormData({});
                  setIsAddJobDialogOpen(true);
                }}
                data-testid="btn-add-new-job"
              >
                Add New Job
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setIsJobVesselMappingDialogOpen(true)}
                data-testid="btn-job-vessel-mapping"
              >
                Vessel Mapping
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-green-600 hover:text-green-700"
                data-testid="btn-export-jobs-excel"
              >
                <FileSpreadsheet className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b">
                <tr className="text-gray-600 text-xs">
                  <th className="text-left py-2 px-2 font-medium">Select</th>
                  <th className="text-left py-2 px-2 font-medium">Job No.</th>
                  <th className="text-left py-2 px-2 font-medium">Job Title</th>
                  <th className="text-left py-2 px-2 font-medium">Task Type</th>
                  <th className="text-left py-2 px-2 font-medium">Frequency</th>
                  <th className="text-left py-2 px-2 font-medium">Assigned To</th>
                  <th className="text-left py-2 px-2 font-medium">Approver</th>
                  <th className="text-left py-2 px-2 font-medium">Job Priority</th>
                  <th className="text-left py-2 px-2 font-medium">Class Related</th>
                  <th className="text-left py-2 px-2 font-medium">Department</th>
                  <th className="text-left py-2 px-2 font-medium">Criticality</th>
                </tr>
              </thead>
              <tbody>
                {filteredRelatedJobs.length > 0 ? (
                  filteredRelatedJobs.map((job: FleetJob, index: number) => {
                    const jobId = job.fleetJobCode || job.jobNo || job.id;
                    return (
                      <tr 
                        key={index} 
                        className="border-b last:border-0 cursor-pointer hover:bg-gray-50"
                        onDoubleClick={() => {
                          setSelectedJobForDetail(job);
                          setIsJobDetailsDialogOpen(true);
                        }}
                        data-testid={`job-popup-row-${index}`}
                      >
                        <td className="py-2 px-2">
                          <Checkbox
                            checked={selectedJobIds.has(String(jobId))}
                            onCheckedChange={(checked) => {
                              setSelectedJobIds(prev => {
                                const newSet = new Set(prev);
                                if (checked) newSet.add(String(jobId));
                                else newSet.delete(String(jobId));
                                return newSet;
                              });
                            }}
                            data-testid={`checkbox-job-${index}`}
                          />
                        </td>
                        <td className="py-2 px-2">{job.fleetJobCode || job.jobNo || job.id}</td>
                        <td 
                          className="py-2 px-2 text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedJobForDetail(job);
                            setIsJobDetailsDialogOpen(true);
                          }}
                          data-testid={`job-title-link-${index}`}
                        >
                          {job.jobTitle || "—"}
                        </td>
                        <td className="py-2 px-2">{job.maintenanceType || "—"}</td>
                        <td className="py-2 px-2">
                          {job.frequencyValue && job.frequencyUnit 
                            ? `${job.frequencyValue} ${job.frequencyUnit}` 
                            : job.intervalRunningHour 
                              ? `${job.intervalRunningHour} RH` 
                              : "—"}
                        </td>
                        <td className="py-2 px-2">{job.assignedTo || "—"}</td>
                        <td className="py-2 px-2">{job.approver || "—"}</td>
                        <td className="py-2 px-2">{job.jobPriority || "—"}</td>
                        <td className="py-2 px-2">{job.classRelated || "No"}</td>
                        <td className="py-2 px-2">{job.department || "—"}</td>
                        <td className="py-2 px-2">{job.criticality || "—"}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-gray-500">
                      {relatedJobs.length === 0 ? "No jobs linked to this component" : "No jobs match your search"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Job Vessel Mapping Dialog */}
      <Dialog open={isJobVesselMappingDialogOpen} onOpenChange={setIsJobVesselMappingDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader className="flex flex-row items-center justify-between pb-3">
            <DialogTitle className="text-base font-semibold text-gray-800">
              Vessel Mapping
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={selectedJobVesselIds.size === 0}
                className="text-blue-600 border-blue-600 hover:bg-blue-50"
                data-testid="btn-job-remove-vessel"
              >
                Remove Mapping
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={selectedJobVesselIds.size === 0}
                data-testid="btn-job-map-vessel"
              >
                Map
              </Button>
            </div>
          </DialogHeader>
          <ScrollArea className="h-[300px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b text-gray-500 text-xs">
                  <th className="text-left py-2 px-2 font-normal w-12">Select</th>
                  <th className="text-left py-2 px-2 font-normal">Vessel Code</th>
                  <th className="text-left py-2 px-2 font-normal">Vessel Name</th>
                </tr>
              </thead>
              <tbody>
                {relatedVessels.length > 0 ? (
                  relatedVessels.map((vessel, index) => (
                    <tr key={index} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 px-2">
                        <Checkbox
                          checked={selectedJobVesselIds.has(vessel.id)}
                          onCheckedChange={(checked) => {
                            setSelectedJobVesselIds(prev => {
                              const newSet = new Set(prev);
                              if (checked) newSet.add(vessel.id);
                              else newSet.delete(vessel.id);
                              return newSet;
                            });
                          }}
                          data-testid={`checkbox-job-vessel-${vessel.id}`}
                        />
                      </td>
                      <td className="py-2 px-2">{vessel.id}</td>
                      <td className="py-2 px-2">{vessel.name}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-gray-500">
                      No vessels linked to this equipment
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Job Details Dialog */}
      <Dialog open={isJobDetailsDialogOpen} onOpenChange={setIsJobDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-3">
            <DialogTitle className="text-base font-semibold text-gray-800">
              Job Details
            </DialogTitle>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                setJobFormData(selectedJobForDetail || {});
                setIsEditJobDialogOpen(true);
              }}
              data-testid="btn-edit-job"
            >
              Edit
            </Button>
          </DialogHeader>
          {selectedJobForDetail && (
            <div className="py-4 space-y-6">
              {/* Row 1: Job No., Job Title, Task Type */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Job No.</div>
                  <div className="text-sm font-medium">{selectedJobForDetail.fleetJobCode || selectedJobForDetail.jobNo || "—"}</div>
                </div>
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Job Title</div>
                  <div className="text-sm font-medium">{selectedJobForDetail.jobTitle || "—"}</div>
                </div>
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Task Type</div>
                  <div className="text-sm font-medium">{selectedJobForDetail.maintenanceType || "—"}</div>
                </div>
              </div>

              {/* Row 2: Maintenance Basis, Interval Value, Unit, Interval Running Hour */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Maintenance Basis</div>
                  <div className="text-sm font-medium">{selectedJobForDetail.maintenanceBasis || "—"}</div>
                </div>
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Interval Value</div>
                  <div className="text-sm font-medium">{selectedJobForDetail.frequencyValue || "—"}</div>
                </div>
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Unit</div>
                  <div className="text-sm font-medium">{selectedJobForDetail.frequencyUnit || "—"}</div>
                </div>
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Interval Running Hour</div>
                  <div className="text-sm font-medium">{selectedJobForDetail.intervalRunningHour || "—"}</div>
                </div>
              </div>

              {/* Row 3: Assigned To, Approver, Job Priority, Class Related */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Assigned To</div>
                  <div className="text-sm font-medium">{selectedJobForDetail.assignedTo || "—"}</div>
                </div>
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Approver</div>
                  <div className="text-sm font-medium">{selectedJobForDetail.approver || "—"}</div>
                </div>
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Job Priority</div>
                  <div className="text-sm font-medium">{selectedJobForDetail.jobPriority || "—"}</div>
                </div>
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Class Related</div>
                  <div className="text-sm font-medium">{selectedJobForDetail.classRelated || "No"}</div>
                </div>
              </div>

              {/* Row 4: Department, Criticality, Is Active */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Department</div>
                  <div className="text-sm font-medium">{selectedJobForDetail.department || "—"}</div>
                </div>
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Criticality</div>
                  <div className="text-sm font-medium">{selectedJobForDetail.criticality || "—"}</div>
                </div>
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Is Active</div>
                  <div className="text-sm font-medium">
                    {selectedJobForDetail.isActive === true ? "Yes" : selectedJobForDetail.isActive === false ? "No" : "—"}
                  </div>
                </div>
              </div>

              {/* Row 5: Brief Work Description */}
              <div>
                <div className="text-blue-600 text-xs font-medium mb-1">Brief Work Description</div>
                <div className="text-sm font-medium">{selectedJobForDetail.jobDescription || "—"}</div>
              </div>

              {/* Divider */}
              <div className="border-t pt-4">
                <h4 className="text-base font-semibold text-gray-800 mb-3">Job Mapped Vessel Detail</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-blue-600 text-xs">
                      <th className="text-left py-2 font-medium">Vessel Code</th>
                      <th className="text-left py-2 font-medium">Vessel Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatedVessels.length > 0 ? (
                      relatedVessels.map((vessel, index) => (
                        <tr key={index} className="border-t">
                          <td className="py-2">{vessel.id}</td>
                          <td className="py-2">{vessel.name}</td>
                        </tr>
                      ))
                    ) : (
                      <tr className="border-t">
                        <td colSpan={2} className="py-4 text-center text-gray-500">
                          No vessels mapped to this job
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Job Dialog */}
      <Dialog open={isEditJobDialogOpen} onOpenChange={setIsEditJobDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-3">
            <DialogTitle className="text-base font-semibold">Edit Job Details</DialogTitle>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsEditJobDialogOpen(false)}
                data-testid="btn-cancel-edit-job"
              >
                Cancel
              </Button>
              <Button 
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  toast({ title: "Success", description: "Job updated successfully" });
                  setIsEditJobDialogOpen(false);
                }}
                data-testid="btn-save-job"
              >
                Save
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Row 1: Job No., Job Title, Task Type */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-blue-600 mb-1 block">Job No.</label>
                <Input
                  placeholder="Input Field"
                  value={jobFormData.fleetJobCode || jobFormData.jobNo || ""}
                  onChange={(e) => setJobFormData(prev => ({ ...prev, fleetJobCode: e.target.value }))}
                  className="h-9"
                  data-testid="input-edit-job-no"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-blue-600 mb-1 block">Job Title</label>
                <Input
                  placeholder="Input Field"
                  value={jobFormData.jobTitle || ""}
                  onChange={(e) => setJobFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                  className="h-9"
                  data-testid="input-edit-job-title"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-blue-600 mb-1 block">Task Type</label>
                <Input
                  placeholder="Input Field"
                  value={jobFormData.maintenanceType || ""}
                  onChange={(e) => setJobFormData(prev => ({ ...prev, maintenanceType: e.target.value }))}
                  className="h-9"
                  data-testid="input-edit-task-type"
                />
              </div>
            </div>

            {/* Row 2: Maintenance Basis, Interval Value, Unit, Interval Running Hour */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-blue-600 mb-1 block">Maintenance Basis</label>
                <Input
                  placeholder="Input Field"
                  value={jobFormData.maintenanceBasis || ""}
                  onChange={(e) => setJobFormData(prev => ({ ...prev, maintenanceBasis: e.target.value }))}
                  className="h-9"
                  data-testid="input-edit-maint-basis"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-blue-600 mb-1 block">Interval Value</label>
                <Input
                  placeholder="Input Field"
                  value={jobFormData.frequencyValue || ""}
                  onChange={(e) => setJobFormData(prev => ({ ...prev, frequencyValue: e.target.value }))}
                  className="h-9"
                  data-testid="input-edit-interval-value"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-blue-600 mb-1 block">Unit</label>
                <Input
                  placeholder="Input Field"
                  value={jobFormData.frequencyUnit || ""}
                  onChange={(e) => setJobFormData(prev => ({ ...prev, frequencyUnit: e.target.value }))}
                  className="h-9"
                  data-testid="input-edit-unit"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-blue-600 mb-1 block">Interval Running Hour</label>
                <Input
                  placeholder="Input Field"
                  value={jobFormData.intervalRunningHour?.toString() || ""}
                  onChange={(e) => setJobFormData(prev => ({ ...prev, intervalRunningHour: e.target.value ? parseInt(e.target.value, 10) || 0 : undefined }))}
                  className="h-9"
                  data-testid="input-edit-interval-rh"
                />
              </div>
            </div>

            {/* Row 3: Assigned To, Approver, Job Priority, Class Related */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-blue-600 mb-1 block">Assigned To</label>
                <Input
                  placeholder="Input Field"
                  value={jobFormData.assignedTo || ""}
                  onChange={(e) => setJobFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                  className="h-9"
                  data-testid="input-edit-assigned-to"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-blue-600 mb-1 block">Approver</label>
                <Input
                  placeholder="Input Field"
                  value={jobFormData.approver || ""}
                  onChange={(e) => setJobFormData(prev => ({ ...prev, approver: e.target.value }))}
                  className="h-9"
                  data-testid="input-edit-approver"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-blue-600 mb-1 block">Job Priority</label>
                <Input
                  placeholder="Input Field"
                  value={jobFormData.jobPriority || ""}
                  onChange={(e) => setJobFormData(prev => ({ ...prev, jobPriority: e.target.value }))}
                  className="h-9"
                  data-testid="input-edit-priority"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-blue-600 mb-1 block">Class Related</label>
                <Input
                  placeholder="Input Field"
                  value={jobFormData.classRelated || ""}
                  onChange={(e) => setJobFormData(prev => ({ ...prev, classRelated: e.target.value }))}
                  className="h-9"
                  data-testid="input-edit-class-related"
                />
              </div>
            </div>

            {/* Row 4: Department, Criticality, Is Active */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-blue-600 mb-1 block">Department</label>
                <Input
                  placeholder="Input Field"
                  value={jobFormData.department || ""}
                  onChange={(e) => setJobFormData(prev => ({ ...prev, department: e.target.value }))}
                  className="h-9"
                  data-testid="input-edit-department"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-blue-600 mb-1 block">Criticality</label>
                <Input
                  placeholder="Input Field"
                  value={jobFormData.criticality || ""}
                  onChange={(e) => setJobFormData(prev => ({ ...prev, criticality: e.target.value }))}
                  className="h-9"
                  data-testid="input-edit-criticality"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-blue-600 mb-1 block">Is Active</label>
                <Input
                  placeholder="Input Field"
                  value={jobFormData.isActive === true ? "Yes" : jobFormData.isActive === false ? "No" : ""}
                  onChange={(e) => setJobFormData(prev => ({ ...prev, isActive: e.target.value.toLowerCase() === "yes" }))}
                  className="h-9"
                  data-testid="input-edit-is-active"
                />
              </div>
            </div>

            {/* Row 5: Brief Work Description */}
            <div>
              <label className="text-xs font-medium text-blue-600 mb-1 block">Brief Work Description</label>
              <Input
                placeholder="Input Field"
                value={jobFormData.jobDescription || ""}
                onChange={(e) => setJobFormData(prev => ({ ...prev, jobDescription: e.target.value }))}
                className="h-9"
                data-testid="input-edit-job-desc"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add New Job Information Dialog */}
      <Dialog open={isAddJobDialogOpen} onOpenChange={(open) => {
        setIsAddJobDialogOpen(open);
        if (!open) setNewJobFormData({});
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-3">
            <DialogTitle className="text-base font-semibold">Add New Job Information</DialogTitle>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setIsAddJobDialogOpen(false);
                  setNewJobFormData({});
                }}
                data-testid="btn-cancel-new-job"
              >
                Cancel
              </Button>
              <Button 
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={createFleetJobMutation.isPending || !selectedComponent}
                onClick={() => {
                  if (!selectedComponent) {
                    toast({ 
                      title: "Error", 
                      description: "No component selected", 
                      variant: "destructive" 
                    });
                    return;
                  }
                  createFleetJobMutation.mutate({
                    ...newJobFormData,
                    fleetEquipmentCode: selectedComponent.fleetEquipmentCode,
                  });
                }}
                data-testid="btn-save-new-job"
              >
                {createFleetJobMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Row 1: Job No., Job Title, Task Type */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Job No.</label>
                <Input
                  placeholder="Input Field"
                  value={newJobFormData.fleetJobCode || ""}
                  onChange={(e) => setNewJobFormData(prev => ({ ...prev, fleetJobCode: e.target.value }))}
                  className="h-9"
                  data-testid="input-new-job-no"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Job Title</label>
                <Input
                  placeholder="Input Field"
                  value={newJobFormData.jobTitle || ""}
                  onChange={(e) => setNewJobFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                  className="h-9"
                  data-testid="input-new-job-title"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Task Type</label>
                <Input
                  placeholder="Input Field"
                  value={newJobFormData.maintenanceType || ""}
                  onChange={(e) => setNewJobFormData(prev => ({ ...prev, maintenanceType: e.target.value }))}
                  className="h-9"
                  data-testid="input-new-task-type"
                />
              </div>
            </div>

            {/* Row 2: Maintenance Basis, Interval Value, Unit, Interval Running Hour */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Maintenance Basis</label>
                <Input
                  placeholder="Input Field"
                  value={newJobFormData.maintenanceBasis || ""}
                  onChange={(e) => setNewJobFormData(prev => ({ ...prev, maintenanceBasis: e.target.value }))}
                  className="h-9"
                  data-testid="input-new-maint-basis"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Interval Value</label>
                <Input
                  placeholder="Input Field"
                  value={newJobFormData.frequencyValue || ""}
                  onChange={(e) => setNewJobFormData(prev => ({ ...prev, frequencyValue: e.target.value }))}
                  className="h-9"
                  data-testid="input-new-interval-value"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Unit</label>
                <Input
                  placeholder="Input Field"
                  value={newJobFormData.frequencyUnit || ""}
                  onChange={(e) => setNewJobFormData(prev => ({ ...prev, frequencyUnit: e.target.value }))}
                  className="h-9"
                  data-testid="input-new-unit"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Interval Running Hour</label>
                <Input
                  placeholder="Input Field"
                  type="number"
                  value={newJobFormData.intervalRunningHour || ""}
                  onChange={(e) => setNewJobFormData(prev => ({ ...prev, intervalRunningHour: e.target.value ? parseInt(e.target.value) : undefined }))}
                  className="h-9"
                  data-testid="input-new-interval-rh"
                />
              </div>
            </div>

            {/* Row 3: Assigned To, Approver, Job Priority, Class Related */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Assigned To</label>
                <Input
                  placeholder="Input Field"
                  value={newJobFormData.assignedTo || ""}
                  onChange={(e) => setNewJobFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                  className="h-9"
                  data-testid="input-new-assigned-to"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Approver</label>
                <Input
                  placeholder="Input Field"
                  value={newJobFormData.approver || ""}
                  onChange={(e) => setNewJobFormData(prev => ({ ...prev, approver: e.target.value }))}
                  className="h-9"
                  data-testid="input-new-approver"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Job Priority</label>
                <Input
                  placeholder="Input Field"
                  value={newJobFormData.jobPriority || ""}
                  onChange={(e) => setNewJobFormData(prev => ({ ...prev, jobPriority: e.target.value }))}
                  className="h-9"
                  data-testid="input-new-priority"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Class Related</label>
                <Input
                  placeholder="Input Field"
                  value={newJobFormData.classRelated || ""}
                  onChange={(e) => setNewJobFormData(prev => ({ ...prev, classRelated: e.target.value }))}
                  className="h-9"
                  data-testid="input-new-class-related"
                />
              </div>
            </div>

            {/* Row 4: Department, Criticality, Is Active */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Department</label>
                <Input
                  placeholder="Input Field"
                  value={newJobFormData.department || ""}
                  onChange={(e) => setNewJobFormData(prev => ({ ...prev, department: e.target.value }))}
                  className="h-9"
                  data-testid="input-new-department"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Criticality</label>
                <Input
                  placeholder="Input Field"
                  value={newJobFormData.criticality || ""}
                  onChange={(e) => setNewJobFormData(prev => ({ ...prev, criticality: e.target.value }))}
                  className="h-9"
                  data-testid="input-new-criticality"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Is Active</label>
                <Input
                  placeholder="Input Field"
                  value={newJobFormData.isActive === true ? "Yes" : newJobFormData.isActive === false ? "No" : ""}
                  onChange={(e) => {
                    const val = e.target.value.toLowerCase();
                    setNewJobFormData(prev => ({ 
                      ...prev, 
                      isActive: val === 'yes' || val === 'true' ? true : val === 'no' || val === 'false' ? false : undefined 
                    }));
                  }}
                  className="h-9"
                  data-testid="input-new-is-active"
                />
              </div>
            </div>

            {/* Row 5: Brief Work Description */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Brief Work Description</label>
              <Input
                placeholder="Input Field"
                value={newJobFormData.briefWorkDescription || ""}
                onChange={(e) => setNewJobFormData(prev => ({ ...prev, briefWorkDescription: e.target.value }))}
                className="h-9"
                data-testid="input-new-work-desc"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fleet Spare Information Dialog */}
      <Dialog open={isSpareInfoDialogOpen} onOpenChange={setIsSpareInfoDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-3">
            <DialogTitle className="text-base font-semibold text-green-600 border border-green-600 px-3 py-1 rounded">
              Fleet Spares Information
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSpareVesselMappingDialogOpen(true)}
                className="text-blue-600 border-blue-600 hover:bg-blue-50"
                data-testid="btn-spare-vessel-mapping"
              >
                Vessel Mapping
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  setSpareFormData({});
                  setIsAddSpareDialogOpen(true);
                }}
                data-testid="btn-add-new-spare"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add New Spare
              </Button>
            </div>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b text-gray-500 text-xs">
                  <th className="text-left py-2 px-2 font-normal">Part Code</th>
                  <th className="text-left py-2 px-2 font-normal">Part Name</th>
                  <th className="text-left py-2 px-2 font-normal">Part Number</th>
                  <th className="text-left py-2 px-2 font-normal">Maker</th>
                  <th className="text-left py-2 px-2 font-normal">Unit</th>
                </tr>
              </thead>
              <tbody>
                {relatedSpares.length > 0 ? (
                  relatedSpares.map((spare: FleetSpare, index: number) => (
                    <tr 
                      key={index} 
                      className="border-b last:border-0 hover:bg-gray-50"
                      data-testid={`spare-popup-row-${index}`}
                    >
                      <td className="py-2 px-2">
                        <button
                          className="text-blue-600 hover:text-blue-800 underline text-left"
                          onClick={() => {
                            setSelectedSpareForDetail(spare);
                            setIsSpareDetailsDialogOpen(true);
                          }}
                          data-testid={`btn-spare-popup-detail-${index}`}
                        >
                          {spare.fleetPartCode || spare.partCode}
                        </button>
                      </td>
                      <td className="py-2 px-2">{spare.partName || "—"}</td>
                      <td className="py-2 px-2">{spare.partNumber || "—"}</td>
                      <td className="py-2 px-2">{spare.maker || "—"}</td>
                      <td className="py-2 px-2">{spare.uom || spare.unit || "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No spares linked to this component
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Spare Vessel Mapping Dialog */}
      <Dialog open={isSpareVesselMappingDialogOpen} onOpenChange={setIsSpareVesselMappingDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader className="flex flex-row items-center justify-between pb-3">
            <DialogTitle className="text-base font-semibold text-gray-800">
              Vessel Mapping
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={selectedSpareVesselIds.size === 0}
                className="text-blue-600 border-blue-600 hover:bg-blue-50"
                data-testid="btn-spare-remove-vessel"
              >
                Remove Mapping
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={selectedSpareVesselIds.size === 0}
                data-testid="btn-spare-map-vessel"
              >
                Map
              </Button>
            </div>
          </DialogHeader>
          <ScrollArea className="h-[300px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b text-gray-500 text-xs">
                  <th className="text-left py-2 px-2 font-normal w-12">Select</th>
                  <th className="text-left py-2 px-2 font-normal">Vessel Code</th>
                  <th className="text-left py-2 px-2 font-normal">Vessel Name</th>
                </tr>
              </thead>
              <tbody>
                {relatedVessels.length > 0 ? (
                  relatedVessels.map((vessel, index) => (
                    <tr key={index} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 px-2">
                        <Checkbox
                          checked={selectedSpareVesselIds.has(vessel.id)}
                          onCheckedChange={(checked) => {
                            setSelectedSpareVesselIds(prev => {
                              const newSet = new Set(prev);
                              if (checked) newSet.add(vessel.id);
                              else newSet.delete(vessel.id);
                              return newSet;
                            });
                          }}
                          data-testid={`checkbox-spare-vessel-${vessel.id}`}
                        />
                      </td>
                      <td className="py-2 px-2">{vessel.id}</td>
                      <td className="py-2 px-2">{vessel.name}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-gray-500">
                      No vessels linked to this equipment
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Spare Details Dialog */}
      <Dialog open={isSpareDetailsDialogOpen} onOpenChange={setIsSpareDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-3">
            <DialogTitle className="text-base font-semibold text-gray-800">
              Spare Details
            </DialogTitle>
            <Button
              size="sm"
              className="bg-blue-500 hover:bg-blue-600 text-white"
              onClick={() => {
                setSpareFormData(selectedSpareForDetail || {});
                setIsEditSpareDialogOpen(true);
              }}
              data-testid="btn-edit-spare"
            >
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </DialogHeader>
          {selectedSpareForDetail && (
            <div className="py-4 space-y-6">
              {/* Row 1: Part Code, Part Name, Part Number, Drawing Number */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Part Code</div>
                  <div className="text-sm font-medium">{selectedSpareForDetail.fleetPartCode || selectedSpareForDetail.partCode || "—"}</div>
                </div>
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Part Name</div>
                  <div className="text-sm font-medium">{selectedSpareForDetail.partName || "—"}</div>
                </div>
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Part Number</div>
                  <div className="text-sm font-medium">{selectedSpareForDetail.partNumber || "—"}</div>
                </div>
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Drawing Number</div>
                  <div className="text-sm font-medium">{selectedSpareForDetail.drawingNumber || "—"}</div>
                </div>
              </div>

              {/* Row 2: Maker, Maker Code, Is Active, Position Number */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Maker</div>
                  <div className="text-sm font-medium">{selectedSpareForDetail.maker || "—"}</div>
                </div>
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Maker Code</div>
                  <div className="text-sm font-medium">{selectedSpareForDetail.makerCode || "—"}</div>
                </div>
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Is Active</div>
                  <div className="text-sm font-medium">{selectedSpareForDetail.isActive ? "Yes" : "No"}</div>
                </div>
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Position Number</div>
                  <div className="text-sm font-medium">{selectedSpareForDetail.positionNumber || "—"}</div>
                </div>
              </div>

              {/* Row 3: Criticality, Unit Of Measurement, Specification */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Criticality</div>
                  <div className="text-sm font-medium">{selectedSpareForDetail.criticality || "—"}</div>
                </div>
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Unit Of Measurement</div>
                  <div className="text-sm font-medium">{selectedSpareForDetail.uom || selectedSpareForDetail.unit || "—"}</div>
                </div>
                <div>
                  <div className="text-blue-600 text-xs font-medium mb-1">Specification</div>
                  <div className="text-sm font-medium">{selectedSpareForDetail.specification || "—"}</div>
                </div>
              </div>

              {/* Row 4: Note */}
              <div>
                <div className="text-blue-600 text-xs font-medium mb-1">Note</div>
                <div className="text-sm font-medium">{selectedSpareForDetail.note || "—"}</div>
              </div>

              {/* Anchor Icon Divider */}
              <div className="flex items-center justify-center py-2 gap-4">
                <div className="flex-1 h-px bg-gray-200"></div>
                <Anchor className="h-5 w-5 text-blue-500" />
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>

              {/* Spare Mapped Vessel Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Spare Mapped Vessel Details</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 text-blue-600 font-medium">Vessel Code</th>
                      <th className="py-2 text-blue-600 font-medium">Vessel Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const mappedVessels = (vessels || []).filter(v => 
                        v.id === selectedSpareForDetail.vesselId
                      );
                      return mappedVessels.length > 0 ? (
                        mappedVessels.map((vessel, idx) => (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="py-2">{vessel.id}</td>
                            <td className="py-2">{vessel.name}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="py-4 text-center text-gray-500">
                            No vessels mapped to this spare
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Spare Dialog */}
      <Dialog open={isEditSpareDialogOpen} onOpenChange={setIsEditSpareDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-3">
            <DialogTitle className="text-base font-semibold">Edit Spare Details</DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditSpareDialogOpen(false)} data-testid="btn-cancel-edit-spare">
                Cancel
              </Button>
              <Button 
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  toast({ title: "Success", description: "Spare updated successfully" });
                  setIsEditSpareDialogOpen(false);
                }}
                data-testid="btn-save-spare"
              >
                Save
              </Button>
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="py-4 space-y-4">
              {/* Row 1: Part Code, Part Name, Part Number, Drawing Number */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-blue-600 text-xs font-medium mb-1 block">Part Code</label>
                  <Input
                    value={spareFormData.fleetPartCode || spareFormData.partCode || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, fleetPartCode: e.target.value }))}
                    data-testid="input-edit-part-code"
                  />
                </div>
                <div>
                  <label className="text-blue-600 text-xs font-medium mb-1 block">Part Name</label>
                  <Input
                    value={spareFormData.partName || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, partName: e.target.value }))}
                    data-testid="input-edit-part-name"
                  />
                </div>
                <div>
                  <label className="text-blue-600 text-xs font-medium mb-1 block">Part Number</label>
                  <Input
                    value={spareFormData.partNumber || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, partNumber: e.target.value }))}
                    data-testid="input-edit-part-number"
                  />
                </div>
                <div>
                  <label className="text-blue-600 text-xs font-medium mb-1 block">Drawing Number</label>
                  <Input
                    value={spareFormData.drawingNumber || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, drawingNumber: e.target.value }))}
                    data-testid="input-edit-drawing-number"
                  />
                </div>
              </div>

              {/* Row 2: Maker, Maker Code, Is Active, Position Number */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-blue-600 text-xs font-medium mb-1 block">Maker</label>
                  <Input
                    value={spareFormData.maker || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, maker: e.target.value }))}
                    data-testid="input-edit-maker"
                  />
                </div>
                <div>
                  <label className="text-blue-600 text-xs font-medium mb-1 block">Maker Code</label>
                  <Input
                    value={spareFormData.makerCode || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, makerCode: e.target.value }))}
                    data-testid="input-edit-maker-code"
                  />
                </div>
                <div>
                  <label className="text-blue-600 text-xs font-medium mb-1 block">Is Active</label>
                  <Select
                    value={spareFormData.isActive ? "Yes" : "No"}
                    onValueChange={(value) => setSpareFormData(prev => ({ ...prev, isActive: value === "Yes" }))}
                  >
                    <SelectTrigger data-testid="select-edit-spare-is-active">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-blue-600 text-xs font-medium mb-1 block">Position Number</label>
                  <Input
                    value={spareFormData.positionNumber || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, positionNumber: e.target.value }))}
                    data-testid="input-edit-position-number"
                  />
                </div>
              </div>

              {/* Row 3: Criticality, Unit Of Measurement, Specification */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-blue-600 text-xs font-medium mb-1 block">Criticality</label>
                  <Select
                    value={spareFormData.criticality || ""}
                    onValueChange={(value) => setSpareFormData(prev => ({ ...prev, criticality: value }))}
                  >
                    <SelectTrigger data-testid="select-edit-spare-criticality">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Critical">Critical</SelectItem>
                      <SelectItem value="Non-Critical">Non-Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-blue-600 text-xs font-medium mb-1 block">Unit Of Measurement</label>
                  <Input
                    value={spareFormData.uom || spareFormData.unit || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, uom: e.target.value }))}
                    data-testid="input-edit-uom"
                  />
                </div>
                <div>
                  <label className="text-blue-600 text-xs font-medium mb-1 block">Specification</label>
                  <Input
                    value={spareFormData.specification || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, specification: e.target.value }))}
                    data-testid="input-edit-specification"
                  />
                </div>
              </div>

              {/* Row 4: Note */}
              <div>
                <label className="text-blue-600 text-xs font-medium mb-1 block">Note</label>
                <Input
                  value={spareFormData.note || ""}
                  onChange={(e) => setSpareFormData(prev => ({ ...prev, note: e.target.value }))}
                  data-testid="input-edit-note"
                />
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Add New Spare Dialog */}
      <Dialog open={isAddSpareDialogOpen} onOpenChange={setIsAddSpareDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-3">
            <DialogTitle className="text-base font-semibold">Add New Spare Information</DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsAddSpareDialogOpen(false)} data-testid="btn-cancel-add-spare">
                Cancel
              </Button>
              <Button 
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  toast({ title: "Success", description: "New spare added successfully" });
                  setIsAddSpareDialogOpen(false);
                }}
                data-testid="btn-save-new-spare"
              >
                Save
              </Button>
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="py-4 space-y-4">
              {/* Row 1: Part Code, Part Name, Part Number, Drawing Number */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-blue-600 text-xs font-medium mb-1 block">Part Code</label>
                  <Input
                    value={spareFormData.fleetPartCode || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, fleetPartCode: e.target.value }))}
                    data-testid="input-new-part-code"
                  />
                </div>
                <div>
                  <label className="text-blue-600 text-xs font-medium mb-1 block">Part Name</label>
                  <Input
                    value={spareFormData.partName || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, partName: e.target.value }))}
                    data-testid="input-new-part-name"
                  />
                </div>
                <div>
                  <label className="text-blue-600 text-xs font-medium mb-1 block">Part Number</label>
                  <Input
                    value={spareFormData.partNumber || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, partNumber: e.target.value }))}
                    data-testid="input-new-part-number"
                  />
                </div>
                <div>
                  <label className="text-blue-600 text-xs font-medium mb-1 block">Drawing Number</label>
                  <Input
                    value={spareFormData.drawingNumber || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, drawingNumber: e.target.value }))}
                    data-testid="input-new-drawing-number"
                  />
                </div>
              </div>

              {/* Row 2: Maker, Maker Code, Is Active, Position Number */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-blue-600 text-xs font-medium mb-1 block">Maker</label>
                  <Input
                    value={spareFormData.maker || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, maker: e.target.value }))}
                    data-testid="input-new-maker"
                  />
                </div>
                <div>
                  <label className="text-blue-600 text-xs font-medium mb-1 block">Maker Code</label>
                  <Input
                    value={spareFormData.makerCode || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, makerCode: e.target.value }))}
                    data-testid="input-new-maker-code"
                  />
                </div>
                <div>
                  <label className="text-blue-600 text-xs font-medium mb-1 block">Is Active</label>
                  <Select
                    value={spareFormData.isActive !== false ? "Yes" : "No"}
                    onValueChange={(value) => setSpareFormData(prev => ({ ...prev, isActive: value === "Yes" }))}
                  >
                    <SelectTrigger data-testid="select-new-spare-is-active">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-blue-600 text-xs font-medium mb-1 block">Position Number</label>
                  <Input
                    value={spareFormData.positionNumber || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, positionNumber: e.target.value }))}
                    data-testid="input-new-position-number"
                  />
                </div>
              </div>

              {/* Row 3: Criticality, Unit Of Measurement, Specification */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-blue-600 text-xs font-medium mb-1 block">Criticality</label>
                  <Select
                    value={spareFormData.criticality || ""}
                    onValueChange={(value) => setSpareFormData(prev => ({ ...prev, criticality: value }))}
                  >
                    <SelectTrigger data-testid="select-new-spare-criticality">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Critical">Critical</SelectItem>
                      <SelectItem value="Non-Critical">Non-Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-blue-600 text-xs font-medium mb-1 block">Unit Of Measurement</label>
                  <Input
                    value={spareFormData.uom || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, uom: e.target.value }))}
                    data-testid="input-new-uom"
                  />
                </div>
                <div>
                  <label className="text-blue-600 text-xs font-medium mb-1 block">Specification</label>
                  <Input
                    value={spareFormData.specification || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, specification: e.target.value }))}
                    data-testid="input-new-specification"
                  />
                </div>
              </div>

              {/* Row 4: Note */}
              <div>
                <label className="text-blue-600 text-xs font-medium mb-1 block">Note</label>
                <Input
                  value={spareFormData.note || ""}
                  onChange={(e) => setSpareFormData(prev => ({ ...prev, note: e.target.value }))}
                  data-testid="input-new-note"
                />
              </div>
            </div>
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
