import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useVessels } from "@/hooks/useVessels";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, ChevronDown, Plus, Search, Pencil, X, FileSpreadsheet, Trash2, Anchor, Briefcase, Info, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionBlock } from "@/components/SectionBlock";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Component, Job, Spare, FleetComponents, FleetJobs, FleetSpares } from "@shared/schema";

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


type FleetComponent = MappedFleetComponent;
type FleetJob = FleetJobs;
type FleetSpare = FleetSpares;

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

  components.forEach((comp) => {
    const code = comp.fleetEquipmentCode || comp.componentCode || String(comp.id);
    if (!code) return;
    
    const node: TreeNode = {
      code: code,
      name: comp.fleetEquipmentName || comp.name || "Unknown",
      children: [],
      data: comp,
      isExpanded: false,
    };
    nodeMap.set(code, node);
  });

  components.forEach((comp) => {
    const code = comp.fleetEquipmentCode || comp.componentCode || String(comp.id);
    if (!code) return;
    
    const node = nodeMap.get(code);
    if (!node) return;
    
    const parentCode = comp.parentFleetEquipmentCode;
    
    if (parentCode && nodeMap.has(parentCode)) {
      const parentNode = nodeMap.get(parentCode)!;
      parentNode.children.push(node);
    } else {
      rootNodes.push(node);
    }
  });

  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    nodes.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    nodes.forEach((node) => {
      if (node.children.length > 0) {
        sortNodes(node.children);
      }
    });
    return nodes;
  };

  return sortNodes(rootNodes);
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
        className={`flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 ${
          isSelected ? "bg-blue-50" : ""
        }`}
        style={{ paddingLeft: `${level * 20 + 12}px` }}
        onClick={() => onSelect(node)}
        data-testid={`tree-node-${node.code}`}
      >
        <button
          className="mr-2 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) {
              onToggle(node.code);
            }
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-600" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-600" />
            )
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </button>
        <span className="text-sm text-gray-700">
          {node.code} {node.name}
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

export default function FleetDataView({ onBack }: { onBack?: () => void }) {
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
  
  // Collapsible section state for right panel
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    A: false,
    B: false,
    C: true,
    D: true,
  });

  // Fleet Spare Information state
  const [isSpareInfoDialogOpen, setIsSpareInfoDialogOpen] = useState(false);
  const [isSpareVesselMappingDialogOpen, setIsSpareVesselMappingDialogOpen] = useState(false);
  const [isSpareDetailsDialogOpen, setIsSpareDetailsDialogOpen] = useState(false);
  const [isEditSpareDialogOpen, setIsEditSpareDialogOpen] = useState(false);
  const [isAddSpareDialogOpen, setIsAddSpareDialogOpen] = useState(false);
  const [selectedSpareForDetail, setSelectedSpareForDetail] = useState<FleetSpare | null>(null);
  const [selectedSpareVesselIds, setSelectedSpareVesselIds] = useState<Set<string>>(new Set());
  const [spareFormData, setSpareFormData] = useState<Partial<FleetSpare>>({});
  const [spareSearchQuery, setSpareSearchQuery] = useState("");
  const [selectedSpareIds, setSelectedSpareIds] = useState<Set<string>>(new Set());
  
  const { toast } = useToast();

  // Query fleet_components table directly as the single source of truth
  const { data: fleetComponentsData, isLoading: isComponentsLoading } = useQuery<FleetComponents[]>({
    queryKey: ["/technical/api/fleet-admin/fleet-components"],
  });

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
        title: data.woTitle || "New Fleet Job",
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

  const updateFleetJobMutation = useMutation({
    mutationFn: async ({ id, data, jobCode }: { id: number; data: Partial<FleetJob>; jobCode?: string }) => {
      const res = await apiRequest('PATCH', `/technical/api/fleet/jobs/${id}`, data);
      try {
        const json = await res.json();
        return { ...json, _jobCode: jobCode };
      } catch {
        return { affectedCount: 1, _jobCode: jobCode };
      }
    },
    onSuccess: (responseData: any) => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/jobs'], exact: false });
      const count = responseData?.affectedCount || 1;
      const jobCode = responseData?._jobCode || '';
      toast({
        title: "Success",
        description: count > 1
          ? `Updated ${count} records with job code ${jobCode}`
          : "Job updated successfully",
      });
      setIsEditJobDialogOpen(false);
      if (selectedJobForDetail) {
        setSelectedJobForDetail({ ...selectedJobForDetail, ...jobFormData } as FleetJob);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update fleet job",
        variant: "destructive",
      });
    },
  });

  const handleSaveEditJob = () => {
    if (!selectedJobForDetail) return;
    const EDITABLE_FIELDS: (keyof FleetJob)[] = [
      'woTitle', 'jobCode', 'maintenanceBasis', 'intervalValue', 'unit',
      'taskType', 'assignedTo', 'approver', 'jobPriority',
      'classRelated', 'briefWorkDescription', 'department',
      'criticality', 'isActive',
      'ppeRequirements', 'permitRequirements', 'otherSafetyRequirements',
      'requiredSpareParts', 'requiredTools',
    ];
    const changedPayload: Record<string, any> = {};
    for (const field of EDITABLE_FIELDS) {
      const newVal = jobFormData[field];
      const oldVal = selectedJobForDetail[field];
      if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
        changedPayload[field] = newVal;
      }
    }
    if (Object.keys(changedPayload).length === 0) {
      toast({
        title: "No Changes",
        description: "No fields were modified",
      });
      return;
    }
    updateFleetJobMutation.mutate({
      id: selectedJobForDetail.id,
      data: changedPayload,
      jobCode: jobFormData.jobCode,
    });
  };

  const mappedComponents = useMemo(() => {
    if (!fleetComponentsData || fleetComponentsData.length === 0) return [];
    return fleetComponentsData.map(mapFleetComponentsToFleetComponent);
  }, [fleetComponentsData]);

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
        job.fleetEquipmentCode === selectedComponent.fleetEquipmentCode
    );
  }, [selectedComponent, fleetJobs]);

  const relatedSpares = useMemo(() => {
    if (!selectedComponent || !fleetSpares) return [];
    return fleetSpares.filter(
      (spare: FleetSpare) =>
        spare.fleetEquipmentCode === selectedComponent.fleetEquipmentCode
    );
  }, [selectedComponent, fleetSpares]);

  const filteredRelatedJobs = useMemo(() => {
    if (!jobSearchQuery.trim()) return relatedJobs;
    const query = jobSearchQuery.toLowerCase();
    return relatedJobs.filter((job: FleetJob) => {
      const jobNo = (job.jobCode || job.id || "").toString().toLowerCase();
      const jobTitle = (job.woTitle || "").toLowerCase();
      const taskType = (job.taskType || "").toLowerCase();
      return jobNo.includes(query) || jobTitle.includes(query) || taskType.includes(query);
    });
  }, [relatedJobs, jobSearchQuery]);

  const filteredRelatedSpares = useMemo(() => {
    if (!spareSearchQuery.trim()) return relatedSpares;
    const query = spareSearchQuery.toLowerCase();
    return relatedSpares.filter((spare: FleetSpare) => {
      const partCode = (spare.partCode || "").toLowerCase();
      const partName = (spare.partName || "").toLowerCase();
      const partNumber = (spare.partNumber || "").toLowerCase();
      return partCode.includes(query) || partName.includes(query) || partNumber.includes(query);
    });
  }, [relatedSpares, spareSearchQuery]);

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
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-3 font-semibold">
          <div className="flex items-center justify-between gap-4">
            <span>Fleet Components</span>
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
          <div className="flex flex-col h-full">
            <div className="p-4 border-b-2 border-[#52baf3] flex-shrink-0">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="text-lg font-semibold text-[#15569e]" data-testid="text-selected-component-title">
                  {selectedComponent.fleetEquipmentCode}{" "}
                  {selectedComponent.fleetEquipmentName}
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[#52baf3] border-[#52baf3]"
                  onClick={() => setLocation(`/admin/fleet-component-editor/${selectedComponent.id}`)}
                  data-testid="button-add-edit-fleet-component"
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit Fleet Component
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="space-y-2">

                <Card className="rounded-sm border border-gray-200" data-testid="section-card-component-info">
                  <CardHeader
                    className="py-3 cursor-pointer"
                    onClick={() => setCollapsedSections(prev => ({ ...prev, A: !prev.A }))}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-[#16569e] flex items-center gap-2">
                        A. Fleet Component Information
                      </CardTitle>
                      <span>
                        {collapsedSections.A ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </span>
                    </div>
                  </CardHeader>
                  {!collapsedSections.A && (
                    <CardContent className="pt-4 border-t border-gray-100">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Fleet Equipment Code</label>
                          <div className="text-sm text-gray-900">{selectedComponent.fleetEquipmentCode || "—"}</div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Fleet Equipment Name</label>
                          <div className="text-sm text-gray-900">{selectedComponent.fleetEquipmentName || selectedComponent.name || "—"}</div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Parent Code</label>
                          <div className="text-sm text-gray-900">
                            {selectedComponent.parentFleetEquipmentCode ||
                              selectedComponent.fleetEquipmentCode?.split(".")[0] ||
                              "—"}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Component Category</label>
                          <div className="text-sm text-gray-900">{selectedComponent.componentCategory || selectedComponent.category || "—"}</div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Maker</label>
                          <div className="text-sm text-gray-900">{selectedComponent.maker || "—"}</div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Maker Code</label>
                          <div className="text-sm text-gray-900">{selectedComponent.makerCode || "—"}</div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Model</label>
                          <div className="text-sm text-gray-900">{selectedComponent.model || "—"}</div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Model Code</label>
                          <div className="text-sm text-gray-900">{selectedComponent.modelCode || "—"}</div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Location</label>
                          <div className="text-sm text-gray-900">{selectedComponent.location || "—"}</div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Rating</label>
                          <div className="text-sm text-gray-900">{selectedComponent.rating || "—"}</div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Eqpt / System Department</label>
                          <div className="text-sm text-gray-900">{selectedComponent.eqptSystemDept || selectedComponent.department || "—"}</div>
                        </div>
                        <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
                          <label className="text-xs font-medium text-gray-600 block mb-1">Notes</label>
                          <div className="text-sm text-gray-900">{selectedComponent.notes || "—"}</div>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>

                <Card className="rounded-sm border border-gray-200" data-testid="section-card-job-info">
                  <CardHeader className="py-3 cursor-pointer" onClick={() => setCollapsedSections(prev => ({ ...prev, B: !prev.B }))}>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-[#16569e] flex items-center gap-2" data-testid="btn-fleet-job-collapse">
                        B. Fleet Job Information
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setIsJobInfoDialogOpen(true); }}
                          className="text-[#52baf3] border-[#52baf3]"
                          data-testid="btn-fleet-job-info-header"
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Manage Jobs
                        </Button>
                        <span>
                          {collapsedSections.B ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  {!collapsedSections.B && (
                    <CardContent className="pt-4 border-t border-gray-100">
                      {relatedJobs.length > 0 ? (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 text-xs font-medium text-gray-600">Job No.</th>
                              <th className="text-left py-2 text-xs font-medium text-gray-600">Job Title</th>
                              <th className="text-left py-2 text-xs font-medium text-gray-600">Task Type</th>
                              <th className="text-left py-2 text-xs font-medium text-gray-600">Frequency</th>
                            </tr>
                          </thead>
                          <tbody>
                            {relatedJobs.map((job: FleetJob, index: number) => (
                              <tr 
                                key={index} 
                                className="border-b border-gray-100 last:border-0 cursor-pointer"
                                onDoubleClick={() => {
                                  setSelectedJobForDetail(job);
                                  setIsJobDetailsDialogOpen(true);
                                }}
                                data-testid={`job-row-${index}`}
                              >
                                <td className="py-2 text-sm text-gray-900">{job.jobCode || job.id}</td>
                                <td className="py-2 text-sm text-gray-900">{job.woTitle || "—"}</td>
                                <td className="py-2 text-sm text-gray-900">{job.taskType || "—"}</td>
                                <td className="py-2 text-sm text-gray-900">
                                  {job.intervalValue && job.unit 
                                    ? `${job.intervalValue} ${job.unit}` 
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-gray-500 text-sm">No jobs linked to this component</p>
                      )}
                    </CardContent>
                  )}
                </Card>

                <Card className="rounded-sm border border-gray-200" data-testid="section-card-spare-info">
                  <CardHeader className="py-3 cursor-pointer" onClick={() => setCollapsedSections(prev => ({ ...prev, C: !prev.C }))}>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-[#16569e] flex items-center gap-2" data-testid="btn-fleet-spare-collapse">
                        C. Fleet Spares Information
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setIsSpareInfoDialogOpen(true); }}
                          className="text-[#52baf3] border-[#52baf3]"
                          data-testid="btn-fleet-spare-info-header"
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Manage Spares
                        </Button>
                        <span>
                          {collapsedSections.C ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  {!collapsedSections.C && (
                    <CardContent className="pt-4 border-t border-gray-100">
                      {relatedSpares.length > 0 ? (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 text-xs font-medium text-gray-600">Part Code</th>
                              <th className="text-left py-2 text-xs font-medium text-gray-600">Part Name</th>
                              <th className="text-left py-2 text-xs font-medium text-gray-600">Part Number</th>
                              <th className="text-left py-2 text-xs font-medium text-gray-600">Maker</th>
                              <th className="text-left py-2 text-xs font-medium text-gray-600">Unit Of Measurement</th>
                            </tr>
                          </thead>
                          <tbody>
                            {relatedSpares.map((spare: FleetSpare, index: number) => (
                              <tr 
                                key={index} 
                                className="border-b border-gray-100 last:border-0"
                                data-testid={`spare-row-${index}`}
                              >
                                <td className="py-2">
                                  <button
                                    className="text-blue-600 underline text-left text-sm"
                                    onClick={() => {
                                      setSelectedSpareForDetail(spare);
                                      setIsSpareDetailsDialogOpen(true);
                                    }}
                                    data-testid={`btn-spare-detail-${index}`}
                                  >
                                    {spare.partCode}
                                  </button>
                                </td>
                                <td className="py-2 text-sm text-gray-900">{spare.partName || "—"}</td>
                                <td className="py-2 text-sm text-gray-900">{spare.partNumber || "—"}</td>
                                <td className="py-2 text-sm text-gray-900">{spare.maker || "—"}</td>
                                <td className="py-2 text-sm text-gray-900">{spare.unitOfMeasurement || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-gray-500 text-sm">No spares linked to this component</p>
                      )}
                    </CardContent>
                  )}
                </Card>

                <Card className="rounded-sm border border-gray-200" data-testid="section-card-vessel-mapping">
                  <CardHeader className="py-3 cursor-pointer" onClick={() => setCollapsedSections(prev => ({ ...prev, D: !prev.D }))}>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-[#16569e] flex items-center gap-2" data-testid="btn-vessel-mapping-collapse">
                        D. Vessel Mapping Overview
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleOpenMappingDialog(); }}
                          className="text-[#52baf3] border-[#52baf3]"
                          data-testid="btn-vessel-mapping-overview-header"
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Manage Mappings
                        </Button>
                        <span>
                          {collapsedSections.D ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  {!collapsedSections.D && (
                    <CardContent className="pt-4 border-t border-gray-100">
                      {relatedVessels.length > 0 ? (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 text-xs font-medium text-gray-600">Vessel Code</th>
                              <th className="text-left py-2 text-xs font-medium text-gray-600">Vessel Name</th>
                            </tr>
                          </thead>
                          <tbody>
                            {relatedVessels.map((vessel, index) => (
                              <tr key={index} className="border-b border-gray-100 last:border-0">
                                <td className="py-2 text-sm text-gray-900">{vessel.id}</td>
                                <td 
                                  className="py-2 cursor-pointer text-blue-600 underline text-sm"
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
                        <p className="text-gray-500 text-sm">No vessels mapped to this component</p>
                      )}
                    </CardContent>
                  )}
                </Card>

              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                className="border-cyan-600 text-cyan-600"
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
        <DialogContent className="w-[95vw] max-w-[95vw] h-[90vh] max-h-[90vh] p-0 overflow-hidden flex flex-col" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Fleet Job Information</DialogTitle>
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white" data-testid="title-fleet-job-info">Fleet Job Information</h1>
                <p className="text-cyan-100 text-sm mt-0.5">
                  Jobs linked to: {selectedComponent?.fleetEquipmentName || selectedComponent?.name || "Selected Component"}
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <h2 className="text-base font-semibold text-gray-800" data-testid="subtitle-all-jobs">All Jobs</h2>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 no-default-hover-elevate no-default-active-elevate" data-testid="badge-total-jobs">
                    <Briefcase className="h-3 w-3 mr-1" />
                    {filteredRelatedJobs.length} Total
                  </Badge>
                  {selectedJobIds.size > 0 && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 no-default-hover-elevate no-default-active-elevate" data-testid="badge-selected-jobs">
                      {selectedJobIds.size} Selected
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 sm:min-w-[280px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search Job Title/Job No./Task Type"
                    value={jobSearchQuery}
                    onChange={(e) => setJobSearchQuery(e.target.value)}
                    className="pl-10 bg-white border-gray-300"
                    data-testid="input-job-search"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-600"
                  disabled={selectedJobIds.size === 0}
                  data-testid="btn-delete-jobs"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
                <Button
                  className="bg-cyan-600 whitespace-nowrap"
                  onClick={() => {
                    setNewJobFormData({});
                    setIsAddJobDialogOpen(true);
                  }}
                  data-testid="btn-add-new-job"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Job
                </Button>
                <Button
                  className="bg-cyan-600 whitespace-nowrap"
                  onClick={() => setIsJobVesselMappingDialogOpen(true)}
                  data-testid="btn-job-vessel-mapping"
                >
                  <Anchor className="mr-2 h-4 w-4" />
                  Vessel Mapping
                </Button>
                <Button
                  variant="outline"
                  className="border-gray-300 text-gray-700"
                  data-testid="btn-export-jobs-excel"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto px-6 py-4">
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b border-gray-200">
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3 w-12">Select</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3">Job No.</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3">Job Title</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3">Task Type</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3">Frequency</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3">Assigned To</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3">Approver</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3">Job Priority</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3">Class Related</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3">Department</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3">Criticality</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRelatedJobs.length > 0 ? (
                    filteredRelatedJobs.map((job: FleetJob, index: number) => {
                      const jobId = job.jobCode || job.id;
                      return (
                        <TableRow
                          key={index}
                          className="border-b border-gray-100 cursor-pointer"
                          onDoubleClick={() => {
                            setSelectedJobForDetail(job);
                            setIsJobDetailsDialogOpen(true);
                          }}
                          data-testid={`job-popup-row-${index}`}
                        >
                          <TableCell className="py-3 px-2">
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
                          </TableCell>
                          <TableCell className="py-3 font-mono text-sm text-gray-700">{job.jobCode || job.id}</TableCell>
                          <TableCell
                            className="py-3 text-blue-600 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedJobForDetail(job);
                              setIsJobDetailsDialogOpen(true);
                            }}
                            data-testid={`job-title-link-${index}`}
                          >
                            <span className="font-medium">{job.woTitle || "—"}</span>
                          </TableCell>
                          <TableCell className="py-3 text-gray-600">{job.taskType || "—"}</TableCell>
                          <TableCell className="py-3 text-gray-600">
                            {job.intervalValue && job.unit
                              ? `${job.intervalValue} ${job.unit}`
                              : "—"}
                          </TableCell>
                          <TableCell className="py-3 text-gray-600">{job.assignedTo || "—"}</TableCell>
                          <TableCell className="py-3 text-gray-600">{job.approver || "—"}</TableCell>
                          <TableCell className="py-3 text-gray-600">{job.jobPriority || "—"}</TableCell>
                          <TableCell className="py-3 text-gray-600">{job.classRelated || "No"}</TableCell>
                          <TableCell className="py-3 text-gray-600">{job.department || "—"}</TableCell>
                          <TableCell className="py-3 text-gray-600">{job.criticality || "—"}</TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={11} className="py-16 text-center">
                        <div className="flex flex-col items-center">
                          <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                            <Briefcase className="h-8 w-8 text-gray-400" />
                          </div>
                          <p className="text-gray-600 font-medium">
                            {relatedJobs.length === 0 ? "No jobs linked to this component" : "No jobs match your search"}
                          </p>
                          <p className="text-gray-400 text-sm mt-1">
                            {relatedJobs.length === 0 ? "Add a new job to get started" : "Try adjusting your search terms"}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
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
        <DialogContent className="w-screen max-w-screen h-screen max-h-screen p-0 overflow-hidden flex flex-col rounded-none" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Job Details</DialogTitle>
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white" data-testid="title-job-details">Job Details</h1>
                <p className="text-cyan-100 text-sm mt-0.5">
                  {selectedJobForDetail?.woTitle || "Job Information"}
                </p>
              </div>
            </div>
            <Button
              className="bg-white/20 text-white border-white/30"
              variant="outline"
              onClick={() => {
                setJobFormData(selectedJobForDetail || {});
                setIsEditJobDialogOpen(true);
              }}
              data-testid="btn-edit-job"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>

          <div className="flex-1 overflow-auto px-6 py-6">
            {selectedJobForDetail && (
              <div className="max-w-5xl mx-auto space-y-6">
                <SectionBlock
                  id="job-info"
                  number="A1"
                  title="Job Information"
                  description="Basic details and configuration for this job"
                >
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <Label className="text-sm text-[#8798ad]">Job Title</Label>
                        <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-job-title">
                          {selectedJobForDetail.woTitle || '-'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm text-[#8798ad]">Component Name</Label>
                        <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-component-name">
                          {selectedJobForDetail.fleetEquipmentName || '-'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm text-[#8798ad]">Component Code</Label>
                        <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-component-code">
                          {selectedJobForDetail.fleetEquipmentCode || '-'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm text-[#8798ad]">Job Code</Label>
                        <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-job-code">
                          {selectedJobForDetail.jobCode || '-'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm text-[#8798ad]">Maintenance Basis</Label>
                        <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-maintenance-basis">
                          {selectedJobForDetail.maintenanceBasis || '-'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm text-[#8798ad]">Frequency</Label>
                        <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-frequency">
                          {selectedJobForDetail.intervalValue && selectedJobForDetail.unit
                            ? `${selectedJobForDetail.intervalValue} ${selectedJobForDetail.unit}`
                            : selectedJobForDetail.intervalValue || '-'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm text-[#8798ad]">Task Type</Label>
                        <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-task-type">
                          {selectedJobForDetail.taskType || '-'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm text-[#8798ad]">Assigned To (Rank)</Label>
                        <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-assigned-to">
                          {selectedJobForDetail.assignedTo || '-'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm text-[#8798ad]">Approver (Rank)</Label>
                        <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-approver">
                          {selectedJobForDetail.approver || '-'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm text-[#8798ad]">Job Priority</Label>
                        <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-job-priority">
                          {selectedJobForDetail.jobPriority || '-'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm text-[#8798ad]">Class Related</Label>
                        <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-class-related">
                          {selectedJobForDetail.classRelated || 'No'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm text-[#8798ad]">Interval Running Hour</Label>
                        <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-interval-rh">
                          -
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm text-[#8798ad]">Department</Label>
                        <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-department">
                          {selectedJobForDetail.department || '-'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm text-[#8798ad]">Criticality</Label>
                        <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-criticality">
                          {selectedJobForDetail.criticality || '-'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm text-[#8798ad]">Is Active</Label>
                        <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-is-active">
                          {selectedJobForDetail.isActive === true ? 'Yes' : selectedJobForDetail.isActive === false ? 'No' : '-'}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Brief Work Description</Label>
                      <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-3 rounded-md border border-gray-200 min-h-[60px]" data-testid="field-brief-work-description">
                        {selectedJobForDetail.briefWorkDescription || '-'}
                      </div>
                    </div>
                  </div>
                </SectionBlock>

                <SectionBlock
                  id="spare-parts"
                  number="A2"
                  title="Required Spare Parts"
                  description="Spare parts needed for this job"
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-gray-200">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left p-2 font-medium text-gray-700 w-[20%]">PART NO.</th>
                          <th className="text-left p-2 font-medium text-gray-700 w-[40%]">DESCRIPTION</th>
                          <th className="text-left p-2 font-medium text-gray-700 w-[15%]">QTY REQUIRED</th>
                          <th className="text-left p-2 font-medium text-gray-700 w-[10%]">ROB</th>
                          <th className="text-left p-2 font-medium text-gray-700 w-[15%]">STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(selectedJobForDetail.requiredSpareParts) && selectedJobForDetail.requiredSpareParts.length > 0) ? (
                          (selectedJobForDetail.requiredSpareParts as any[]).map((part: any, index: number) => {
                            const robValue = part.rob !== null && part.rob !== undefined ? part.rob : null;
                            const qtyRequired = parseInt(part.quantityRequired) || 0;
                            const isAvailable = robValue !== null && robValue >= qtyRequired;
                            return (
                              <tr key={index} className="border-b border-gray-200">
                                <td className="p-2">{part.partNo || '-'}</td>
                                <td className="p-2">{part.description || '-'}</td>
                                <td className="p-2">{part.quantityRequired || '-'}</td>
                                <td className="p-2 text-center">{robValue !== null ? robValue : '-'}</td>
                                <td className="p-2">
                                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {isAvailable ? 'Available' : 'Unavailable'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={5} className="text-center p-4 text-gray-500 italic">
                              No spare parts added yet
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </SectionBlock>

                <SectionBlock
                  id="tools"
                  number="A3"
                  title="Required Tools & Equipment"
                  description="Tools and equipment needed for this job"
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-gray-200">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left p-2 font-medium text-gray-700 w-[50%]">DESCRIPTION</th>
                          <th className="text-left p-2 font-medium text-gray-700 w-[15%]">QTY REQUIRED</th>
                          <th className="text-left p-2 font-medium text-gray-700 w-[10%]">ROB</th>
                          <th className="text-left p-2 font-medium text-gray-700 w-[15%]">STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(selectedJobForDetail.requiredTools) && selectedJobForDetail.requiredTools.length > 0) ? (
                          (selectedJobForDetail.requiredTools as any[]).map((tool: any, index: number) => (
                            <tr key={index} className="border-b border-gray-200">
                              <td className="p-2">{tool.toolName || tool.description || '-'}</td>
                              <td className="p-2">{tool.quantity || '-'}</td>
                              <td className="p-2 text-center">-</td>
                              <td className="p-2">
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                  Available
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="text-center p-4 text-gray-500 italic">
                              No tools added yet
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </SectionBlock>

                <SectionBlock
                  id="safety"
                  number="A4"
                  title="Safety Requirements"
                  description="Safety requirements and permits for this job"
                >
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Personal Protective Equipment (PPE):</Label>
                      {selectedJobForDetail.ppeRequirements ? (
                        <ul className="list-disc list-inside mt-1 text-sm text-gray-600">
                          {selectedJobForDetail.ppeRequirements.split(',').map((item: string, index: number) => (
                            <li key={index}>{item.trim()}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500 italic mt-1">No PPE requirements specified</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Permits Required:</Label>
                      {selectedJobForDetail.permitRequirements ? (
                        <ul className="list-disc list-inside mt-1 text-sm text-gray-600">
                          {selectedJobForDetail.permitRequirements.split(',').map((item: string, index: number) => (
                            <li key={index}>{item.trim()}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500 italic mt-1">No permits required</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Other Safety Requirements:</Label>
                      {selectedJobForDetail.otherSafetyRequirements ? (
                        <ul className="list-disc list-inside mt-1 text-sm text-gray-600">
                          {selectedJobForDetail.otherSafetyRequirements.split(',').map((item: string, index: number) => (
                            <li key={index}>{item.trim()}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500 italic mt-1">No other safety requirements specified</p>
                      )}
                    </div>
                  </div>
                </SectionBlock>

                <SectionBlock
                  id="vessel-mapping"
                  number="A5"
                  title="Job Mapped Vessel Details"
                  description="Vessel mapping information related to this job"
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-gray-200">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left p-2 font-medium text-gray-700 w-[40%]">VESSEL CODE</th>
                          <th className="text-left p-2 font-medium text-gray-700 w-[60%]">VESSEL NAME</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatedVessels.length > 0 ? (
                          relatedVessels.map((vessel, index) => (
                            <tr key={index} className="border-b border-gray-200" data-testid={`vessel-mapping-row-${index}`}>
                              <td className="p-2">{vessel.id}</td>
                              <td className="p-2">{vessel.name}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={2} className="text-center p-4 text-gray-500 italic">
                              No vessels mapped to this job
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </SectionBlock>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Job Dialog */}
      <Dialog open={isEditJobDialogOpen} onOpenChange={setIsEditJobDialogOpen}>
        <DialogContent className="w-screen max-w-screen h-screen max-h-screen p-0 overflow-hidden flex flex-col rounded-none" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Edit Job Details</DialogTitle>
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Pencil className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white" data-testid="title-edit-job">Edit Job Details</h1>
                <p className="text-cyan-100 text-sm mt-0.5">
                  {jobFormData.woTitle || selectedJobForDetail?.woTitle || "Edit job information"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                className="bg-white/20 text-white border-white/30"
                variant="outline"
                onClick={() => setIsEditJobDialogOpen(false)}
                data-testid="btn-cancel-edit-job"
              >
                Cancel
              </Button>
              <Button
                className="bg-white text-blue-600"
                onClick={handleSaveEditJob}
                disabled={updateFleetJobMutation.isPending}
                data-testid="btn-save-job"
              >
                {updateFleetJobMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto px-6 py-6">
            <div className="max-w-5xl mx-auto space-y-6">
              <SectionBlock
                id="edit-job-info"
                number="A1"
                title="Job Information"
                description="Basic details and configuration for this job"
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Job Title</Label>
                      <Input
                        placeholder="Enter job title"
                        value={jobFormData.woTitle || ""}
                        onChange={(e) => setJobFormData(prev => ({ ...prev, woTitle: e.target.value }))}
                        data-testid="input-edit-job-title"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Component Name</Label>
                      <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-edit-component-name">
                        {selectedComponent?.fleetEquipmentName || selectedJobForDetail?.fleetEquipmentName || '-'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Component Code</Label>
                      <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-edit-component-code">
                        {selectedComponent?.fleetEquipmentCode || selectedJobForDetail?.fleetEquipmentCode || '-'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Job Code</Label>
                      <Input
                        placeholder="Enter job code"
                        value={jobFormData.jobCode || ""}
                        onChange={(e) => setJobFormData(prev => ({ ...prev, jobCode: e.target.value }))}
                        data-testid="input-edit-job-no"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Maintenance Basis</Label>
                      <Input
                        placeholder="Enter maintenance basis"
                        value={jobFormData.maintenanceBasis || ""}
                        onChange={(e) => setJobFormData(prev => ({ ...prev, maintenanceBasis: e.target.value }))}
                        data-testid="input-edit-maint-basis"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Frequency</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Value"
                          value={jobFormData.intervalValue || ""}
                          onChange={(e) => setJobFormData(prev => ({ ...prev, intervalValue: e.target.value }))}
                          className="flex-1"
                          data-testid="input-edit-interval-value"
                        />
                        <Input
                          placeholder="Unit"
                          value={jobFormData.unit || ""}
                          onChange={(e) => setJobFormData(prev => ({ ...prev, unit: e.target.value }))}
                          className="flex-1"
                          data-testid="input-edit-unit"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Task Type</Label>
                      <Input
                        placeholder="Enter task type"
                        value={jobFormData.taskType || ""}
                        onChange={(e) => setJobFormData(prev => ({ ...prev, taskType: e.target.value }))}
                        data-testid="input-edit-task-type"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Assigned To (Rank)</Label>
                      <Input
                        placeholder="Enter assigned rank"
                        value={jobFormData.assignedTo || ""}
                        onChange={(e) => setJobFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                        data-testid="input-edit-assigned-to"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Approver (Rank)</Label>
                      <Input
                        placeholder="Enter approver rank"
                        value={jobFormData.approver || ""}
                        onChange={(e) => setJobFormData(prev => ({ ...prev, approver: e.target.value }))}
                        data-testid="input-edit-approver"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Job Priority</Label>
                      <Input
                        placeholder="Enter priority"
                        value={jobFormData.jobPriority || ""}
                        onChange={(e) => setJobFormData(prev => ({ ...prev, jobPriority: e.target.value }))}
                        data-testid="input-edit-priority"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Class Related</Label>
                      <Input
                        placeholder="Yes / No"
                        value={jobFormData.classRelated || ""}
                        onChange={(e) => setJobFormData(prev => ({ ...prev, classRelated: e.target.value }))}
                        data-testid="input-edit-class-related"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Interval Running Hour</Label>
                      <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-edit-interval-rh">
                        -
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Department</Label>
                      <Input
                        placeholder="Enter department"
                        value={jobFormData.department || ""}
                        onChange={(e) => setJobFormData(prev => ({ ...prev, department: e.target.value }))}
                        data-testid="input-edit-department"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Criticality</Label>
                      <Input
                        placeholder="Enter criticality"
                        value={jobFormData.criticality || ""}
                        onChange={(e) => setJobFormData(prev => ({ ...prev, criticality: e.target.value }))}
                        data-testid="input-edit-criticality"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Is Active</Label>
                      <Input
                        placeholder="Yes / No"
                        value={jobFormData.isActive === true ? "Yes" : jobFormData.isActive === false ? "No" : ""}
                        onChange={(e) => setJobFormData(prev => ({ ...prev, isActive: e.target.value.toLowerCase() === "yes" }))}
                        data-testid="input-edit-is-active"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm text-[#8798ad]">Brief Work Description</Label>
                    <Input
                      placeholder="Enter brief work description"
                      value={jobFormData.briefWorkDescription || ""}
                      onChange={(e) => setJobFormData(prev => ({ ...prev, briefWorkDescription: e.target.value }))}
                      data-testid="input-edit-job-desc"
                    />
                  </div>
                </div>
              </SectionBlock>

              <SectionBlock
                id="edit-spare-parts"
                number="A2"
                title="Required Spare Parts"
                description="Spare parts needed for this job"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-gray-200">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left p-2 font-medium text-gray-700 w-[20%]">PART NO.</th>
                        <th className="text-left p-2 font-medium text-gray-700 w-[40%]">DESCRIPTION</th>
                        <th className="text-left p-2 font-medium text-gray-700 w-[15%]">QTY REQUIRED</th>
                        <th className="text-left p-2 font-medium text-gray-700 w-[10%]">ROB</th>
                        <th className="text-left p-2 font-medium text-gray-700 w-[15%]">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(jobFormData.requiredSpareParts) && (jobFormData.requiredSpareParts as any[]).length > 0) ? (
                        (jobFormData.requiredSpareParts as any[]).map((part: any, index: number) => {
                          const partNo = part.partNo || part.partNumber || part.code || '-';
                          const desc = part.description || part.name || part.partName || '-';
                          const qty = part.qty || part.quantity || part.qtyRequired || '-';
                          const rob = part.rob || '-';
                          const status = part.status || '-';
                          return (
                            <tr key={index} className="border-b border-gray-200">
                              <td className="p-2 font-mono text-xs" data-testid={`edit-spare-partno-${index}`}>{partNo}</td>
                              <td className="p-2" data-testid={`edit-spare-desc-${index}`}>{desc}</td>
                              <td className="p-2" data-testid={`edit-spare-qty-${index}`}>{qty}</td>
                              <td className="p-2" data-testid={`edit-spare-rob-${index}`}>{rob}</td>
                              <td className="p-2" data-testid={`edit-spare-status-${index}`}>{status}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center p-4 text-gray-500 italic">
                            No spare parts linked to this job
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionBlock>

              <SectionBlock
                id="edit-tools"
                number="A3"
                title="Required Tools & Equipment"
                description="Tools and equipment needed for this job"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-gray-200">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left p-2 font-medium text-gray-700 w-[50%]">DESCRIPTION</th>
                        <th className="text-left p-2 font-medium text-gray-700 w-[15%]">QTY REQUIRED</th>
                        <th className="text-left p-2 font-medium text-gray-700 w-[10%]">ROB</th>
                        <th className="text-left p-2 font-medium text-gray-700 w-[15%]">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(jobFormData.requiredTools) && (jobFormData.requiredTools as any[]).length > 0) ? (
                        (jobFormData.requiredTools as any[]).map((tool: any, index: number) => (
                          <tr key={index} className="border-b border-gray-200">
                            <td className="p-2" data-testid={`edit-tool-desc-${index}`}>{tool.description || tool.name || '-'}</td>
                            <td className="p-2" data-testid={`edit-tool-qty-${index}`}>{tool.qty || tool.quantity || '-'}</td>
                            <td className="p-2" data-testid={`edit-tool-rob-${index}`}>{tool.rob || '-'}</td>
                            <td className="p-2" data-testid={`edit-tool-status-${index}`}>{tool.status || '-'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="text-center p-4 text-gray-500 italic">
                            No tools linked to this job
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionBlock>

              <SectionBlock
                id="edit-safety"
                number="A4"
                title="Safety Requirements"
                description="Safety requirements and permits for this job"
              >
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Personal Protective Equipment (PPE):</Label>
                    <Input
                      placeholder="Enter PPE requirements (comma-separated)"
                      value={jobFormData.ppeRequirements || ""}
                      onChange={(e) => setJobFormData(prev => ({ ...prev, ppeRequirements: e.target.value }))}
                      className="mt-1"
                      data-testid="input-edit-ppe"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Permits Required:</Label>
                    <Input
                      placeholder="Enter permit requirements (comma-separated)"
                      value={jobFormData.permitRequirements || ""}
                      onChange={(e) => setJobFormData(prev => ({ ...prev, permitRequirements: e.target.value }))}
                      className="mt-1"
                      data-testid="input-edit-permits"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Other Safety Requirements:</Label>
                    <Input
                      placeholder="Enter other safety requirements (comma-separated)"
                      value={jobFormData.otherSafetyRequirements || ""}
                      onChange={(e) => setJobFormData(prev => ({ ...prev, otherSafetyRequirements: e.target.value }))}
                      className="mt-1"
                      data-testid="input-edit-other-safety"
                    />
                  </div>
                </div>
              </SectionBlock>

              <SectionBlock
                id="edit-vessel-mapping"
                number="A5"
                title="Job Mapped Vessel Details"
                description="Vessel mapping information related to this job"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-gray-200">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left p-2 font-medium text-gray-700 w-[40%]">VESSEL CODE</th>
                        <th className="text-left p-2 font-medium text-gray-700 w-[60%]">VESSEL NAME</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={2} className="text-center p-4 text-gray-500 italic">
                          No vessels mapped to this job
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </SectionBlock>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add New Job Information Dialog */}
      <Dialog open={isAddJobDialogOpen} onOpenChange={(open) => {
        setIsAddJobDialogOpen(open);
        if (!open) setNewJobFormData({});
      }}>
        <DialogContent className="w-screen max-w-screen h-screen max-h-screen p-0 overflow-hidden flex flex-col rounded-none" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Add New Job Information</DialogTitle>
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Plus className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white" data-testid="title-add-new-job">Add New Job Information</h1>
                <p className="text-cyan-100 text-sm mt-0.5">
                  {selectedComponent?.fleetEquipmentName || "Create a new job"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                className="bg-white/20 text-white border-white/30"
                variant="outline"
                onClick={() => {
                  setIsAddJobDialogOpen(false);
                  setNewJobFormData({});
                }}
                data-testid="btn-cancel-new-job"
              >
                Cancel
              </Button>
              <Button
                className="bg-white text-blue-600"
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
          </div>

          <div className="flex-1 overflow-auto px-6 py-6">
            <div className="max-w-5xl mx-auto space-y-6">
              <SectionBlock
                id="new-job-info"
                number="A1"
                title="Job Information"
                description="Basic details and configuration for this job"
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Job Title</Label>
                      <Input
                        placeholder="Enter job title"
                        value={newJobFormData.woTitle || ""}
                        onChange={(e) => setNewJobFormData(prev => ({ ...prev, woTitle: e.target.value }))}
                        data-testid="input-new-job-title"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Component Name</Label>
                      <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-new-component-name">
                        {selectedComponent?.fleetEquipmentName || '-'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Component Code</Label>
                      <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-new-component-code">
                        {selectedComponent?.fleetEquipmentCode || '-'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Job Code</Label>
                      <Input
                        placeholder="Enter job code"
                        value={newJobFormData.jobCode || ""}
                        onChange={(e) => setNewJobFormData(prev => ({ ...prev, jobCode: e.target.value }))}
                        data-testid="input-new-job-no"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Maintenance Basis</Label>
                      <Input
                        placeholder="Enter maintenance basis"
                        value={newJobFormData.maintenanceBasis || ""}
                        onChange={(e) => setNewJobFormData(prev => ({ ...prev, maintenanceBasis: e.target.value }))}
                        data-testid="input-new-maint-basis"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Frequency</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Value"
                          value={newJobFormData.intervalValue || ""}
                          onChange={(e) => setNewJobFormData(prev => ({ ...prev, intervalValue: e.target.value }))}
                          className="flex-1"
                          data-testid="input-new-interval-value"
                        />
                        <Input
                          placeholder="Unit"
                          value={newJobFormData.unit || ""}
                          onChange={(e) => setNewJobFormData(prev => ({ ...prev, unit: e.target.value }))}
                          className="flex-1"
                          data-testid="input-new-unit"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Task Type</Label>
                      <Input
                        placeholder="Enter task type"
                        value={newJobFormData.taskType || ""}
                        onChange={(e) => setNewJobFormData(prev => ({ ...prev, taskType: e.target.value }))}
                        data-testid="input-new-task-type"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Assigned To (Rank)</Label>
                      <Input
                        placeholder="Enter assigned rank"
                        value={newJobFormData.assignedTo || ""}
                        onChange={(e) => setNewJobFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                        data-testid="input-new-assigned-to"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Approver (Rank)</Label>
                      <Input
                        placeholder="Enter approver rank"
                        value={newJobFormData.approver || ""}
                        onChange={(e) => setNewJobFormData(prev => ({ ...prev, approver: e.target.value }))}
                        data-testid="input-new-approver"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Job Priority</Label>
                      <Input
                        placeholder="Enter priority"
                        value={newJobFormData.jobPriority || ""}
                        onChange={(e) => setNewJobFormData(prev => ({ ...prev, jobPriority: e.target.value }))}
                        data-testid="input-new-priority"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Class Related</Label>
                      <Input
                        placeholder="Yes / No"
                        value={newJobFormData.classRelated || ""}
                        onChange={(e) => setNewJobFormData(prev => ({ ...prev, classRelated: e.target.value }))}
                        data-testid="input-new-class-related"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Interval Running Hour</Label>
                      <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-new-interval-rh">
                        -
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Department</Label>
                      <Input
                        placeholder="Enter department"
                        value={newJobFormData.department || ""}
                        onChange={(e) => setNewJobFormData(prev => ({ ...prev, department: e.target.value }))}
                        data-testid="input-new-department"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Criticality</Label>
                      <Input
                        placeholder="Enter criticality"
                        value={newJobFormData.criticality || ""}
                        onChange={(e) => setNewJobFormData(prev => ({ ...prev, criticality: e.target.value }))}
                        data-testid="input-new-criticality"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Is Active</Label>
                      <Input
                        placeholder="Yes / No"
                        value={newJobFormData.isActive === true ? "Yes" : newJobFormData.isActive === false ? "No" : ""}
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase();
                          setNewJobFormData(prev => ({ 
                            ...prev, 
                            isActive: val === 'yes' || val === 'true' ? true : val === 'no' || val === 'false' ? false : undefined 
                          }));
                        }}
                        data-testid="input-new-is-active"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm text-[#8798ad]">Brief Work Description</Label>
                    <Input
                      placeholder="Enter brief work description"
                      value={newJobFormData.briefWorkDescription || ""}
                      onChange={(e) => setNewJobFormData(prev => ({ ...prev, briefWorkDescription: e.target.value }))}
                      data-testid="input-new-work-desc"
                    />
                  </div>
                </div>
              </SectionBlock>

              <SectionBlock
                id="new-spare-parts"
                number="A2"
                title="Required Spare Parts"
                description="Spare parts needed for this job"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-gray-200">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left p-2 font-medium text-gray-700 w-[20%]">PART NO.</th>
                        <th className="text-left p-2 font-medium text-gray-700 w-[40%]">DESCRIPTION</th>
                        <th className="text-left p-2 font-medium text-gray-700 w-[15%]">QTY REQUIRED</th>
                        <th className="text-left p-2 font-medium text-gray-700 w-[10%]">ROB</th>
                        <th className="text-left p-2 font-medium text-gray-700 w-[15%]">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={5} className="text-center p-4 text-gray-500 italic">
                          No spare parts added yet
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </SectionBlock>

              <SectionBlock
                id="new-tools"
                number="A3"
                title="Required Tools & Equipment"
                description="Tools and equipment needed for this job"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-gray-200">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left p-2 font-medium text-gray-700 w-[50%]">DESCRIPTION</th>
                        <th className="text-left p-2 font-medium text-gray-700 w-[15%]">QTY REQUIRED</th>
                        <th className="text-left p-2 font-medium text-gray-700 w-[10%]">ROB</th>
                        <th className="text-left p-2 font-medium text-gray-700 w-[15%]">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={4} className="text-center p-4 text-gray-500 italic">
                          No tools added yet
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </SectionBlock>

              <SectionBlock
                id="new-safety"
                number="A4"
                title="Safety Requirements"
                description="Safety requirements and permits for this job"
              >
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Personal Protective Equipment (PPE):</Label>
                    <Input
                      placeholder="Enter PPE requirements (comma-separated)"
                      value={newJobFormData.ppeRequirements || ""}
                      onChange={(e) => setNewJobFormData(prev => ({ ...prev, ppeRequirements: e.target.value }))}
                      className="mt-1"
                      data-testid="input-new-ppe"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Permits Required:</Label>
                    <Input
                      placeholder="Enter permit requirements (comma-separated)"
                      value={newJobFormData.permitRequirements || ""}
                      onChange={(e) => setNewJobFormData(prev => ({ ...prev, permitRequirements: e.target.value }))}
                      className="mt-1"
                      data-testid="input-new-permits"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Other Safety Requirements:</Label>
                    <Input
                      placeholder="Enter other safety requirements (comma-separated)"
                      value={newJobFormData.otherSafetyRequirements || ""}
                      onChange={(e) => setNewJobFormData(prev => ({ ...prev, otherSafetyRequirements: e.target.value }))}
                      className="mt-1"
                      data-testid="input-new-other-safety"
                    />
                  </div>
                </div>
              </SectionBlock>

              <SectionBlock
                id="new-vessel-mapping"
                number="A5"
                title="Job Mapped Vessel Details"
                description="Vessel mapping information related to this job"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-gray-200">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left p-2 font-medium text-gray-700 w-[40%]">VESSEL CODE</th>
                        <th className="text-left p-2 font-medium text-gray-700 w-[60%]">VESSEL NAME</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={2} className="text-center p-4 text-gray-500 italic">
                          No vessels mapped yet — save the job first to map vessels
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </SectionBlock>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fleet Spare Information Dialog */}
      <Dialog open={isSpareInfoDialogOpen} onOpenChange={(open) => {
        setIsSpareInfoDialogOpen(open);
        if (!open) {
          setSpareSearchQuery("");
          setSelectedSpareIds(new Set());
        }
      }}>
        <DialogContent className="w-[95vw] max-w-[95vw] h-[90vh] max-h-[90vh] p-0 overflow-hidden flex flex-col" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Fleet Spares Information</DialogTitle>
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Anchor className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white" data-testid="title-fleet-spare-info">Fleet Spares Information</h1>
                <p className="text-cyan-100 text-sm mt-0.5">
                  Spares linked to: {selectedComponent?.fleetEquipmentName || selectedComponent?.name || "Selected Component"}
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <h2 className="text-base font-semibold text-gray-800" data-testid="subtitle-all-spares">All Spares</h2>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 no-default-hover-elevate no-default-active-elevate" data-testid="badge-total-spares">
                    <Anchor className="h-3 w-3 mr-1" />
                    {filteredRelatedSpares.length} Total
                  </Badge>
                  {selectedSpareIds.size > 0 && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 no-default-hover-elevate no-default-active-elevate" data-testid="badge-selected-spares">
                      {selectedSpareIds.size} Selected
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 sm:min-w-[280px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search Part Code/Part Name/Part Number"
                    value={spareSearchQuery}
                    onChange={(e) => setSpareSearchQuery(e.target.value)}
                    className="pl-10 bg-white border-gray-300"
                    data-testid="input-spare-search"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-600"
                  disabled={selectedSpareIds.size === 0}
                  data-testid="btn-delete-spares"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
                <Button
                  className="bg-cyan-600 whitespace-nowrap"
                  onClick={() => {
                    setSpareFormData({});
                    setIsAddSpareDialogOpen(true);
                  }}
                  data-testid="btn-add-new-spare"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Spare
                </Button>
                <Button
                  className="bg-cyan-600 whitespace-nowrap"
                  onClick={() => setIsSpareVesselMappingDialogOpen(true)}
                  data-testid="btn-spare-vessel-mapping"
                >
                  <Anchor className="mr-2 h-4 w-4" />
                  Vessel Mapping
                </Button>
                <Button
                  variant="outline"
                  className="border-gray-300 text-gray-700"
                  data-testid="btn-export-spares-excel"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto px-6 py-4">
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b border-gray-200">
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3 w-12">Select</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3">Part Code</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3">Part Name</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3">Part Number</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3">Unit</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3">Maker</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3">Drawing Number</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3">Position Number</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3">Critical</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRelatedSpares.length > 0 ? (
                    filteredRelatedSpares.map((spare: FleetSpare, index: number) => {
                      const spareId = spare.partCode || String(spare.id);
                      return (
                        <TableRow
                          key={index}
                          className="border-b border-gray-100 cursor-pointer"
                          onDoubleClick={() => {
                            setSelectedSpareForDetail(spare);
                            setIsSpareDetailsDialogOpen(true);
                          }}
                          data-testid={`spare-popup-row-${index}`}
                        >
                          <TableCell className="py-3 px-2">
                            <Checkbox
                              checked={selectedSpareIds.has(String(spareId))}
                              onCheckedChange={(checked) => {
                                setSelectedSpareIds(prev => {
                                  const newSet = new Set(prev);
                                  if (checked) newSet.add(String(spareId));
                                  else newSet.delete(String(spareId));
                                  return newSet;
                                });
                              }}
                              data-testid={`checkbox-spare-${index}`}
                            />
                          </TableCell>
                          <TableCell
                            className="py-3 text-blue-600 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSpareForDetail(spare);
                              setIsSpareDetailsDialogOpen(true);
                            }}
                            data-testid={`spare-code-link-${index}`}
                          >
                            <span className="font-medium">{spare.partCode || "—"}</span>
                          </TableCell>
                          <TableCell className="py-3 text-gray-600">{spare.partName || "—"}</TableCell>
                          <TableCell className="py-3 font-mono text-sm text-gray-700">{spare.partNumber || "—"}</TableCell>
                          <TableCell className="py-3 text-gray-600">{spare.unitOfMeasurement || "—"}</TableCell>
                          <TableCell className="py-3 text-gray-600">{spare.maker || "—"}</TableCell>
                          <TableCell className="py-3 text-gray-600">{spare.drawingNumber || "—"}</TableCell>
                          <TableCell className="py-3 text-gray-600">{spare.positionNumber || "—"}</TableCell>
                          <TableCell className="py-3 text-gray-600">{spare.criticality || "—"}</TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="py-16 text-center">
                        <div className="flex flex-col items-center">
                          <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                            <Anchor className="h-8 w-8 text-gray-400" />
                          </div>
                          <p className="text-gray-600 font-medium">
                            {relatedSpares.length === 0 ? "No spares linked to this component" : "No spares match your search"}
                          </p>
                          <p className="text-gray-400 text-sm mt-1">
                            {relatedSpares.length === 0 ? "Add a new spare to get started" : "Try adjusting your search terms"}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600" />
              Spare Details
            </DialogTitle>
            <Button
              size="sm"
              className="bg-blue-500 text-white"
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
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Part Code:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpareForDetail.partCode || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Part Name:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpareForDetail.partName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Part Number:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpareForDetail.partNumber || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">UOM:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpareForDetail.unitOfMeasurement || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Equipment:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpareForDetail.fleetEquipmentName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Equipment Code:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpareForDetail.fleetEquipmentCode || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Status & Classification</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Criticality:</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                      selectedSpareForDetail.criticality === 'Yes' || selectedSpareForDetail.criticality === 'Critical'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {selectedSpareForDetail.criticality || 'No'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Is Active:</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                      selectedSpareForDetail.isActive !== false
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedSpareForDetail.isActive !== false ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">IHM:</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                      selectedSpareForDetail.ihm === 'Yes'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {selectedSpareForDetail.ihm || 'No'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Evidence Type:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpareForDetail.evidenceType || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Technical Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Maker:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpareForDetail.maker || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Maker Code:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpareForDetail.makerCode || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Drawing Number:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpareForDetail.drawingNumber || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Position Number:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpareForDetail.positionNumber || '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Specification:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpareForDetail.specification || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Manual Reference</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Manual Name:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpareForDetail.manualName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Page Number:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpareForDetail.pageNumber || '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Note:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpareForDetail.note || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Spare Mapped Vessel Details</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 text-gray-600 font-medium">Vessel Code</th>
                      <th className="py-2 text-gray-600 font-medium">Vessel Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const mappedVessels = (vessels || []).filter((v: any) => 
                        v.id === (selectedSpareForDetail as any).vesselId
                      );
                      return mappedVessels.length > 0 ? (
                        mappedVessels.map((vessel: any, idx: number) => (
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-600" />
              Edit Spare Details
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditSpareDialogOpen(false)} data-testid="btn-cancel-edit-spare">
                Cancel
              </Button>
              <Button 
                size="sm"
                className="bg-blue-600 text-white"
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
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Part Code</label>
                  <Input
                    value={spareFormData.partCode || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, partCode: e.target.value }))}
                    data-testid="input-edit-part-code"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Part Name</label>
                  <Input
                    value={spareFormData.partName || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, partName: e.target.value }))}
                    data-testid="input-edit-part-name"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Part Number</label>
                  <Input
                    value={spareFormData.partNumber || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, partNumber: e.target.value }))}
                    data-testid="input-edit-part-number"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Unit Of Measurement</label>
                  <Input
                    value={spareFormData.unitOfMeasurement || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, unitOfMeasurement: e.target.value }))}
                    data-testid="input-edit-uom"
                  />
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Status & Classification</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Criticality</label>
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
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Is Active</label>
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
                  <label className="text-gray-500 text-xs font-medium mb-1 block">IHM</label>
                  <Select
                    value={spareFormData.ihm || "No"}
                    onValueChange={(value) => setSpareFormData(prev => ({ ...prev, ihm: value }))}
                  >
                    <SelectTrigger data-testid="select-edit-spare-ihm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Evidence Type</label>
                  <Input
                    value={spareFormData.evidenceType || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, evidenceType: e.target.value }))}
                    data-testid="input-edit-evidence-type"
                  />
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Technical Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Maker</label>
                  <Input
                    value={spareFormData.maker || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, maker: e.target.value }))}
                    data-testid="input-edit-maker"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Maker Code</label>
                  <Input
                    value={spareFormData.makerCode || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, makerCode: e.target.value }))}
                    data-testid="input-edit-maker-code"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Drawing Number</label>
                  <Input
                    value={spareFormData.drawingNumber || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, drawingNumber: e.target.value }))}
                    data-testid="input-edit-drawing-number"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Position Number</label>
                  <Input
                    value={spareFormData.positionNumber || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, positionNumber: e.target.value }))}
                    data-testid="input-edit-position-number"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Specification</label>
                  <Input
                    value={spareFormData.specification || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, specification: e.target.value }))}
                    data-testid="input-edit-specification"
                  />
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Manual Reference</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Manual Name</label>
                  <Input
                    value={spareFormData.manualName || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, manualName: e.target.value }))}
                    data-testid="input-edit-manual-name"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Page Number</label>
                  <Input
                    value={spareFormData.pageNumber || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, pageNumber: e.target.value }))}
                    data-testid="input-edit-page-number"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Note</label>
                  <Input
                    value={spareFormData.note || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, note: e.target.value }))}
                    data-testid="input-edit-note"
                  />
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add New Spare Dialog */}
      <Dialog open={isAddSpareDialogOpen} onOpenChange={setIsAddSpareDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Add New Spare Information
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsAddSpareDialogOpen(false)} data-testid="btn-cancel-add-spare">
                Cancel
              </Button>
              <Button 
                size="sm"
                className="bg-blue-600 text-white"
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
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Part Code</label>
                  <Input
                    value={spareFormData.partCode || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, partCode: e.target.value }))}
                    data-testid="input-new-part-code"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Part Name</label>
                  <Input
                    value={spareFormData.partName || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, partName: e.target.value }))}
                    data-testid="input-new-part-name"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Part Number</label>
                  <Input
                    value={spareFormData.partNumber || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, partNumber: e.target.value }))}
                    data-testid="input-new-part-number"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Unit Of Measurement</label>
                  <Input
                    value={spareFormData.unitOfMeasurement || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, unitOfMeasurement: e.target.value }))}
                    data-testid="input-new-uom"
                  />
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Status & Classification</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Criticality</label>
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
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Is Active</label>
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
                  <label className="text-gray-500 text-xs font-medium mb-1 block">IHM</label>
                  <Select
                    value={spareFormData.ihm || "No"}
                    onValueChange={(value) => setSpareFormData(prev => ({ ...prev, ihm: value }))}
                  >
                    <SelectTrigger data-testid="select-new-spare-ihm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Evidence Type</label>
                  <Input
                    value={spareFormData.evidenceType || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, evidenceType: e.target.value }))}
                    data-testid="input-new-evidence-type"
                  />
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Technical Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Maker</label>
                  <Input
                    value={spareFormData.maker || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, maker: e.target.value }))}
                    data-testid="input-new-maker"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Maker Code</label>
                  <Input
                    value={spareFormData.makerCode || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, makerCode: e.target.value }))}
                    data-testid="input-new-maker-code"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Drawing Number</label>
                  <Input
                    value={spareFormData.drawingNumber || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, drawingNumber: e.target.value }))}
                    data-testid="input-new-drawing-number"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Position Number</label>
                  <Input
                    value={spareFormData.positionNumber || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, positionNumber: e.target.value }))}
                    data-testid="input-new-position-number"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Specification</label>
                  <Input
                    value={spareFormData.specification || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, specification: e.target.value }))}
                    data-testid="input-new-specification"
                  />
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Manual Reference</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Manual Name</label>
                  <Input
                    value={spareFormData.manualName || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, manualName: e.target.value }))}
                    data-testid="input-new-manual-name"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Page Number</label>
                  <Input
                    value={spareFormData.pageNumber || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, pageNumber: e.target.value }))}
                    data-testid="input-new-page-number"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-gray-500 text-xs font-medium mb-1 block">Note</label>
                  <Input
                    value={spareFormData.note || ""}
                    onChange={(e) => setSpareFormData(prev => ({ ...prev, note: e.target.value }))}
                    data-testid="input-new-note"
                  />
                </div>
              </div>
            </div>
          </div>
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
