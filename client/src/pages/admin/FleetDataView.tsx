import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useVessels } from "@/hooks/useVessels";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, ChevronDown, Plus, Search, Pencil, X, FileSpreadsheet, Trash2, Anchor, Briefcase, Info, ArrowLeft, Ship, GripVertical, ChevronsUpDown, ChevronsDownUp, Save, RotateCcw } from "lucide-react";
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
import type { Component, Job, Spare, FleetComponents, FleetJobs, FleetSpares, Maker } from "@shared/schema";

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
  sortOrder?: number | null;
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
    sortOrder: item.sortOrder,
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
    nodes.sort((a, b) => {
      const aSortOrder = a.data?.sortOrder ?? 0;
      const bSortOrder = b.data?.sortOrder ?? 0;
      if (aSortOrder !== 0 || bSortOrder !== 0) {
        if (aSortOrder !== bSortOrder) return aSortOrder - bSortOrder;
      }
      return a.code.localeCompare(b.code, undefined, { numeric: true });
    });
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
  isEditMode,
  dragOverCode,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  node: TreeNode;
  level?: number;
  selectedCode: string | null;
  onSelect: (node: TreeNode) => void;
  expandedNodes: Set<string>;
  onToggle: (code: string) => void;
  isEditMode?: boolean;
  dragOverCode?: string | null;
  onDragStart?: (e: React.DragEvent, code: string, parentCode: string | null | undefined) => void;
  onDragOver?: (e: React.DragEvent, code: string, parentCode: string | null | undefined) => void;
  onDrop?: (e: React.DragEvent, code: string, parentCode: string | null | undefined) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}) {
  const isExpanded = expandedNodes.has(node.code);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedCode === node.code;
  const isDragOver = dragOverCode === node.code;

  return (
    <div>
      <div
        className={`flex items-center px-3 py-2 cursor-pointer border-b border-gray-100 ${
          isSelected ? "bg-blue-50" : ""
        }${isDragOver ? " bg-blue-100 border-t-2 border-t-blue-400" : ""}`}
        style={{ paddingLeft: `${level * 20 + (isEditMode ? 4 : 12)}px` }}
        onClick={() => { if (!isEditMode) onSelect(node); }}
        data-testid={`tree-node-${node.code}`}
        draggable={isEditMode}
        onDragStart={isEditMode && onDragStart ? (e) => onDragStart(e, node.code, node.data?.parentFleetEquipmentCode) : undefined}
        onDragOver={isEditMode && onDragOver ? (e) => onDragOver(e, node.code, node.data?.parentFleetEquipmentCode) : undefined}
        onDrop={isEditMode && onDrop ? (e) => onDrop(e, node.code, node.data?.parentFleetEquipmentCode) : undefined}
        onDragEnd={isEditMode && onDragEnd ? onDragEnd : undefined}
      >
        {isEditMode && (
          <GripVertical className="h-4 w-4 text-gray-400 mr-1 flex-shrink-0 cursor-grab" data-testid={`drag-handle-${node.code}`} />
        )}
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
            isEditMode={isEditMode}
            dragOverCode={dragOverCode}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
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
  const [makerSearchText, setMakerSearchText] = useState("");
  const [showMakerSuggestions, setShowMakerSuggestions] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);
  const [editTreeData, setEditTreeData] = useState<TreeNode[]>([]);
  const [dragSourceCode, setDragSourceCode] = useState<string | null>(null);
  const [dragSourceParent, setDragSourceParent] = useState<string | null | undefined>(null);
  const [dragOverCode, setDragOverCode] = useState<string | null>(null);
  const [isSavingSortOrder, setIsSavingSortOrder] = useState(false);
  
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

  const { data: makers = [] } = useQuery<Maker[]>({
    queryKey: ['/technical/api/fleet/makers'],
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

  const filteredMakers = useMemo(() => {
    if (!makerSearchText.trim()) return [];
    return makers.filter(m =>
      m.makerName?.toLowerCase().includes(makerSearchText.toLowerCase())
    );
  }, [makerSearchText, makers]);

  const handleMakerSearchChange = (value: string) => {
    setMakerSearchText(value);
    setShowMakerSuggestions(true);
    if (!value.trim()) {
      setSpareFormData(prev => ({ ...prev, maker: "", makerCode: "" }));
    }
  };

  const handleMakerSelect = (maker: Maker) => {
    setMakerSearchText(maker.makerName || "");
    setSpareFormData(prev => ({
      ...prev,
      maker: maker.makerName || "",
      makerCode: maker.makerCode || "",
    }));
    setShowMakerSuggestions(false);
  };

  const handleClearMaker = () => {
    setMakerSearchText("");
    setSpareFormData(prev => ({ ...prev, maker: "", makerCode: "" }));
    setShowMakerSuggestions(false);
  };

  useEffect(() => {
    if (jobFormData.maintenanceBasis === 'Running Hours') {
      setJobFormData(prev => ({ ...prev, unit: 'Hours' }));
    }
  }, [jobFormData.maintenanceBasis]);

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

  const normalizeJobPriority = (val: string | null | undefined): string => {
    if (!val) return '';
    const lower = val.toLowerCase();
    if (lower === 'high') return 'High';
    if (lower === 'medium') return 'Medium';
    if (lower === 'low') return 'Low';
    return val;
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

  const collectAllCodes = (node: TreeNode): string[] => {
    const codes = [node.code];
    node.children.forEach((child) => {
      codes.push(...collectAllCodes(child));
    });
    return codes;
  };

  const findNodeByCode = (nodes: TreeNode[], code: string): TreeNode | null => {
    for (const node of nodes) {
      if (node.code === code) return node;
      const found = findNodeByCode(node.children, code);
      if (found) return found;
    }
    return null;
  };

  const handleExpandSelected = () => {
    if (!selectedNode) {
      toast({
        title: "No Selection",
        description: "Please select a component to expand.",
      });
      return;
    }
    const codesToExpand = collectAllCodes(selectedNode);
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      codesToExpand.forEach((c) => newSet.add(c));
      return newSet;
    });
  };

  const handleCollapseAll = () => {
    setExpandedNodes(new Set());
  };

  const deepCloneTree = (nodes: TreeNode[]): TreeNode[] => {
    return nodes.map((node) => ({
      ...node,
      children: deepCloneTree(node.children),
    }));
  };

  const handleEnterEditMode = () => {
    setEditTreeData(deepCloneTree(treeData));
    setIsEditMode(true);
  };

  const handleCancelEditMode = () => {
    setEditTreeData([]);
    setIsEditMode(false);
    setDragSourceCode(null);
    setDragSourceParent(null);
    setDragOverCode(null);
  };

  const handleDragStart = (e: React.DragEvent, code: string, parentCode: string | null | undefined) => {
    setDragSourceCode(code);
    setDragSourceParent(parentCode);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", code);
  };

  const handleDragOver = (e: React.DragEvent, code: string, parentCode: string | null | undefined) => {
    e.preventDefault();
    if (dragSourceCode === code) return;
    if (dragSourceParent !== parentCode) return;
    setDragOverCode(code);
    e.dataTransfer.dropEffect = "move";
  };

  const reorderSiblings = (nodes: TreeNode[], sourceCode: string, targetCode: string, parentCode: string | null | undefined): TreeNode[] => {
    if (!parentCode) {
      const sourceIndex = nodes.findIndex((n) => n.code === sourceCode);
      const targetIndex = nodes.findIndex((n) => n.code === targetCode);
      if (sourceIndex !== -1 && targetIndex !== -1) {
        const newNodes = [...nodes];
        const [moved] = newNodes.splice(sourceIndex, 1);
        newNodes.splice(targetIndex, 0, moved);
        return newNodes;
      }
      return nodes;
    }

    return nodes.map((node) => {
      if (node.code === parentCode) {
        const sourceIndex = node.children.findIndex((n) => n.code === sourceCode);
        const targetIndex = node.children.findIndex((n) => n.code === targetCode);
        if (sourceIndex !== -1 && targetIndex !== -1) {
          const newChildren = [...node.children];
          const [moved] = newChildren.splice(sourceIndex, 1);
          newChildren.splice(targetIndex, 0, moved);
          return { ...node, children: newChildren };
        }
        return node;
      }

      return {
        ...node,
        children: reorderSiblings(node.children, sourceCode, targetCode, parentCode),
      };
    });
  };

  const handleDrop = (e: React.DragEvent, targetCode: string, targetParentCode: string | null | undefined) => {
    e.preventDefault();
    setDragOverCode(null);
    if (!dragSourceCode || dragSourceCode === targetCode) return;
    if (dragSourceParent !== targetParentCode) return;

    setEditTreeData((prev) => {
      if (!dragSourceParent && !targetParentCode) {
        const sourceIndex = prev.findIndex((n) => n.code === dragSourceCode);
        const targetIndex = prev.findIndex((n) => n.code === targetCode);
        if (sourceIndex !== -1 && targetIndex !== -1) {
          const newNodes = [...prev];
          const [moved] = newNodes.splice(sourceIndex, 1);
          newNodes.splice(targetIndex, 0, moved);
          return newNodes;
        }
        return prev;
      }
      return reorderSiblings(prev, dragSourceCode!, targetCode, dragSourceParent);
    });

    setDragSourceCode(null);
    setDragSourceParent(null);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDragSourceCode(null);
    setDragSourceParent(null);
    setDragOverCode(null);
  };

  const collectSortUpdates = (nodes: TreeNode[]): { id: number; sortOrder: number }[] => {
    const updates: { id: number; sortOrder: number }[] = [];
    nodes.forEach((node, index) => {
      if (node.data?.id && typeof node.data.id === "number") {
        updates.push({ id: node.data.id, sortOrder: index + 1 });
      }
      if (node.children.length > 0) {
        updates.push(...collectSortUpdates(node.children));
      }
    });
    return updates;
  };

  const handleSaveEditMode = async () => {
    setIsSavingSortOrder(true);
    try {
      const updates = collectSortUpdates(editTreeData);
      await apiRequest("POST", "/technical/api/fleet/components/sort-order", { updates });
      queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-components"] });
      setIsEditMode(false);
      setEditTreeData([]);
      toast({
        title: "Success",
        description: "Sort order saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save sort order",
        variant: "destructive",
      });
    } finally {
      setIsSavingSortOrder(false);
    }
  };

  const activeTreeData = isEditMode ? editTreeData : treeData;

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
    
    if (componentVesselMappings && componentVesselMappings.length > 0) {
      const mappings = componentVesselMappings.filter(
        (m) => m.fleetEquipmentCode === selectedComponent.fleetEquipmentCode ||
               m.componentId === String(selectedComponent.id)
      );
      if (mappings.length > 0) {
        const vesselMap = new Map<string, { id: string; name: string; mapping: any }>();
        for (const m of mappings) {
          const key = m.vesselCode || m.vesselId || "";
          if (!vesselMap.has(key)) {
            const resolvedName = m.vesselName || (vessels || []).find(v => v.id === m.vesselCode)?.name || m.vesselCode;
            vesselMap.set(key, { id: key, name: resolvedName, mapping: m });
          }
        }
        return Array.from(vesselMap.values());
      }
    }
    
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
    
    const vesselMap = new Map<string, { vesselCode: string; vesselName: string; allMappingIds: number[]; mapping: any }>();
    for (const m of mappings) {
      const key = m.vesselCode || m.vesselId || "";
      const existing = vesselMap.get(key);
      if (existing) {
        existing.allMappingIds.push(m.id);
      } else {
        const resolvedName = m.vesselName || (vessels || []).find(v => v.id === m.vesselCode)?.name || key;
        vesselMap.set(key, { vesselCode: key, vesselName: resolvedName, allMappingIds: [m.id], mapping: m });
      }
    }
    return Array.from(vesselMap.values());
  }, [selectedComponent, componentVesselMappings, mappingSearchQuery, vessels]);

  const filteredDetailMappings = useMemo(() => {
    if (!selectedVesselForDetail || !selectedComponent || !componentVesselMappings) return [];
    
    const targetVesselCode = selectedVesselForDetail.vesselCode || selectedVesselForDetail.vesselId;
    let mappings = componentVesselMappings.filter(
      (m) => (m.vesselCode === targetVesselCode) &&
             (m.fleetEquipmentCode === selectedComponent.fleetEquipmentCode)
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

  const handleMappingCheckboxChange = (mappingIds: number[], checked: boolean) => {
    setSelectedMappingIds((prev) => {
      const newSet = new Set(prev);
      for (const id of mappingIds) {
        if (checked) {
          newSet.add(id);
        } else {
          newSet.delete(id);
        }
      }
      return newSet;
    });
  };

  const handleSelectAllMappings = (checked: boolean) => {
    if (checked) {
      const allIds = new Set<number>();
      for (const entry of filteredMappingsForDialog) {
        for (const id of entry.allMappingIds) {
          allIds.add(id);
        }
      }
      setSelectedMappingIds(allIds);
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
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        <div className="flex gap-6 h-full min-h-0">
          <div className="w-[30%] min-w-0 shrink-0" data-testid="fleet-tree-panel">
            <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
              <div className="flex-1 overflow-auto">
                <div className="bg-[#52baf3] text-white px-4 py-2 font-semibold text-sm flex items-center justify-between gap-2">
                  <span>FLEET COMPONENTS</span>
                  {onBack && (
                    <button
                      onClick={onBack}
                      className="flex items-center gap-1 text-cyan-100 text-xs transition-colors"
                      data-testid="button-back-to-dashboard"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back to Dashboard
                    </button>
                  )}
                </div>
                <div className="bg-gray-50 border-b border-gray-200 px-3 py-1.5 flex items-center gap-1.5">
                  {isEditMode ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSaveEditMode}
                        disabled={isSavingSortOrder}
                        data-testid="button-save-sort-order"
                      >
                        <Save className="h-3.5 w-3.5 mr-1" />
                        {isSavingSortOrder ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelEditMode}
                        disabled={isSavingSortOrder}
                        data-testid="button-cancel-edit-mode"
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleEnterEditMode}
                        data-testid="button-edit-tree-order"
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExpandSelected}
                        data-testid="button-expand-selected"
                      >
                        <ChevronsUpDown className="h-3.5 w-3.5 mr-1" />
                        Expand
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCollapseAll}
                        data-testid="button-collapse-all"
                      >
                        <ChevronsDownUp className="h-3.5 w-3.5 mr-1" />
                        Collapse
                      </Button>
                    </>
                  )}
                </div>
                <div>
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
                    <div className="py-1">
                      {activeTreeData.map((node) => (
                        <TreeItem
                          key={node.code}
                          node={node}
                          selectedCode={selectedNode?.code || null}
                          onSelect={setSelectedNode}
                          expandedNodes={expandedNodes}
                          onToggle={handleToggle}
                          isEditMode={isEditMode}
                          dragOverCode={dragOverCode}
                          onDragStart={handleDragStart}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                          onDragEnd={handleDragEnd}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0" data-testid="fleet-detail-panel">
        {selectedComponent ? (
          <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
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
                        <div className="overflow-x-auto">
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
                        </div>
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
                        <div className="overflow-x-auto">
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
                        </div>
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
                        <div className="overflow-x-auto">
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
                        </div>
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
          <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
            <div className="p-4 border-b-2 border-[#52baf3] flex-shrink-0">
              <div className="flex items-center justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[#52baf3] border-[#52baf3]"
                  onClick={() => setLocation("/admin/fleet-component-editor")}
                  data-testid="button-add-edit-fleet-component"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add / Edit Fleet Component
                </Button>
              </div>
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
        </div>
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
        <DialogContent className="p-0 gap-0" style={{ width: '40vw', maxWidth: '40vw', maxHeight: '85vh' }}>
          <div className="bg-[#52baf3] pl-4 pr-10 py-2.5 rounded-t-lg">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Ship className="h-3.5 w-3.5 text-white" />
                <DialogTitle className="text-xs font-semibold text-white">
                  Vessel Mapping Overview
                </DialogTitle>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveMappings}
                  disabled={selectedMappingIds.size === 0 || removeMappingsMutation.isPending}
                  className="h-6 px-2 text-[10px] bg-white/10 border-white/30 text-white hover:bg-white/20"
                  data-testid="btn-remove-mapping"
                >
                  Remove
                </Button>
                <Button
                  size="sm"
                  className="h-6 px-2 text-[10px] bg-[#5dc86f] hover:bg-[#4db85f] text-white"
                  onClick={() => {
                    setSelectedVesselsToMap(new Set());
                    setVesselMappingSearchQuery("");
                    setIsVesselMappingDialogOpen(true);
                  }}
                  data-testid="btn-vessel-mapping"
                >
                  Add Vessel
                </Button>
              </div>
            </div>
          </div>

          <ScrollArea className="h-[400px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b text-gray-500">
                  <th className="text-left py-1.5 px-2 font-medium w-10">
                    <Checkbox
                      checked={
                        filteredMappingsForDialog.length > 0 &&
                        filteredMappingsForDialog.every((entry) => entry.allMappingIds.every(id => selectedMappingIds.has(id)))
                      }
                      onCheckedChange={handleSelectAllMappings}
                      className="h-3.5 w-3.5"
                      data-testid="checkbox-select-all"
                    />
                  </th>
                  <th className="text-left py-1.5 px-2 font-medium">Vessel Code</th>
                  <th className="text-left py-1.5 px-2 font-medium">Vessel Name</th>
                </tr>
              </thead>
              <tbody>
                {filteredMappingsForDialog.length > 0 ? (
                  filteredMappingsForDialog.map((entry) => (
                    <tr key={entry.vesselCode} className="border-b last:border-0 hover:bg-blue-50/50">
                      <td className="py-1.5 px-2">
                        <Checkbox
                          checked={entry.allMappingIds.every(id => selectedMappingIds.has(id))}
                          onCheckedChange={(checked) =>
                            handleMappingCheckboxChange(entry.allMappingIds, checked as boolean)
                          }
                          className="h-3.5 w-3.5"
                          data-testid={`checkbox-mapping-${entry.vesselCode}`}
                        />
                      </td>
                      <td className="py-1.5 px-2 text-gray-600">{entry.vesselCode}</td>
                      <td 
                        className="py-1.5 px-2 cursor-pointer text-blue-600 hover:underline font-medium"
                        onClick={() => {
                          setSelectedVesselForDetail(entry.mapping);
                          setSelectedDetailMappingIds(new Set());
                          setDetailSearchQuery("");
                          setIsDetailDialogOpen(true);
                        }}
                        data-testid={`vessel-name-${entry.vesselCode}`}
                      >
                        {entry.vesselName}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-gray-400 text-xs">
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
        <DialogContent className="p-0 gap-0" style={{ width: '50vw', maxWidth: '50vw', maxHeight: '85vh' }}>
          <div className="bg-[#52baf3] pl-4 pr-10 py-2.5 rounded-t-lg">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Anchor className="h-3.5 w-3.5 text-white" />
                <DialogTitle className="text-xs font-semibold text-white">
                  Vessel Component Mapping Overview
                </DialogTitle>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-white/60" />
                  <Input
                    type="text"
                    placeholder="Search..."
                    value={detailSearchQuery}
                    onChange={(e) => setDetailSearchQuery(e.target.value)}
                    className="h-6 w-28 pl-6 pr-2 text-[10px] bg-white/10 border-white/30 text-white placeholder:text-white/50"
                    data-testid="input-detail-search"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveDetailMappings}
                  disabled={selectedDetailMappingIds.size === 0 || removeMappingsMutation.isPending}
                  className="h-6 px-2 text-[10px] bg-white/10 border-white/30 text-white hover:bg-white/20"
                  data-testid="btn-detail-remove-mapping"
                >
                  Remove
                </Button>
                <Button
                  size="sm"
                  className="h-6 px-2 text-[10px] bg-[#5dc86f] hover:bg-[#4db85f] text-white"
                  onClick={() => {
                    setSelectedComponentsToMap(new Set());
                    setComponentMappingSearchQuery("");
                    setIsComponentMappingDialogOpen(true);
                  }}
                  data-testid="btn-detail-component-mapping"
                >
                  Map Component
                </Button>
              </div>
            </div>
          </div>

          <ScrollArea className="h-[400px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b text-gray-500">
                  <th className="text-left py-1.5 px-2 font-medium w-10">
                    <Checkbox
                      checked={
                        filteredDetailMappings.length > 0 &&
                        filteredDetailMappings.every((m) => selectedDetailMappingIds.has(m.id))
                      }
                      onCheckedChange={handleSelectAllDetailMappings}
                      className="h-3.5 w-3.5"
                      data-testid="checkbox-detail-select-all"
                    />
                  </th>
                  <th className="text-left py-1.5 px-2 font-medium">Vessel Name</th>
                  <th className="text-left py-1.5 px-2 font-medium">Component Code</th>
                  <th className="text-left py-1.5 px-2 font-medium">Component Name</th>
                </tr>
              </thead>
              <tbody>
                {filteredDetailMappings.length > 0 ? (
                  filteredDetailMappings.map((mapping) => (
                    <tr key={mapping.id} className="border-b last:border-0 hover:bg-blue-50/50">
                      <td className="py-1.5 px-2">
                        <Checkbox
                          checked={selectedDetailMappingIds.has(mapping.id)}
                          onCheckedChange={(checked) =>
                            handleDetailMappingCheckboxChange(mapping.id, checked as boolean)
                          }
                          className="h-3.5 w-3.5"
                          data-testid={`checkbox-detail-row-${mapping.id}`}
                        />
                      </td>
                      <td className="py-1.5 px-2 text-gray-600">{mapping.vesselName}</td>
                      <td className="py-1.5 px-2 text-gray-600">{mapping.componentCode || mapping.fleetEquipmentCode || selectedComponent?.fleetEquipmentCode}</td>
                      <td className="py-1.5 px-2 text-gray-600">{mapping.componentName || selectedComponent?.fleetEquipmentName || "Main Engine"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-gray-400 text-xs">
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
        <DialogContent className="p-0 gap-0" style={{ width: '40vw', maxWidth: '40vw', maxHeight: '85vh' }}>
          <div className="bg-[#52baf3] pl-4 pr-10 py-2.5 rounded-t-lg">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Ship className="h-3.5 w-3.5 text-white" />
                <DialogTitle className="text-xs font-semibold text-white">
                  Vessel Mapping
                </DialogTitle>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-white/60" />
                  <Input
                    type="text"
                    placeholder="Search..."
                    value={vesselMappingSearchQuery}
                    onChange={(e) => setVesselMappingSearchQuery(e.target.value)}
                    className="h-6 w-28 pl-6 pr-2 text-[10px] bg-white/10 border-white/30 text-white placeholder:text-white/50"
                    data-testid="input-vessel-mapping-search"
                  />
                </div>
                <Button
                  size="sm"
                  className="h-6 px-3 text-[10px] bg-[#5dc86f] hover:bg-[#4db85f] text-white"
                  onClick={handleMapVessels}
                  disabled={selectedVesselsToMap.size === 0 || addMappingMutation.isPending}
                  data-testid="btn-map-vessels"
                >
                  Map
                </Button>
              </div>
            </div>
          </div>

          <ScrollArea className="h-[400px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b text-gray-500">
                  <th className="text-left py-1.5 px-2 font-medium w-10">
                    <span className="text-gray-500 text-[10px]">Select</span>
                  </th>
                  <th className="text-left py-1.5 px-2 font-medium">Vessel Code</th>
                  <th className="text-left py-1.5 px-2 font-medium">Vessel Name</th>
                </tr>
              </thead>
              <tbody>
                {unmappedVessels.length > 0 ? (
                  unmappedVessels.map((vessel) => (
                    <tr key={vessel.code || vessel.id} className="border-b last:border-0 hover:bg-blue-50/50">
                      <td className="py-1.5 px-2">
                        <Checkbox
                          checked={selectedVesselsToMap.has(vessel.code || vessel.id)}
                          onCheckedChange={(checked) =>
                            handleVesselMappingCheckboxChange(vessel.code || vessel.id, checked as boolean)
                          }
                          className="h-3.5 w-3.5"
                          data-testid={`checkbox-vessel-map-${vessel.code || vessel.id}`}
                        />
                      </td>
                      <td className="py-1.5 px-2 text-gray-600">{vessel.code || vessel.id}</td>
                      <td className="py-1.5 px-2 text-gray-600">{vessel.name}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-gray-400 text-xs">
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
        <DialogContent className="p-0 gap-0" style={{ width: '40vw', maxWidth: '40vw', maxHeight: '85vh' }}>
          <div className="bg-[#52baf3] pl-4 pr-10 py-2.5 rounded-t-lg">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Anchor className="h-3.5 w-3.5 text-white" />
                <DialogTitle className="text-xs font-semibold text-white">
                  Component Mapping
                </DialogTitle>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-white/60" />
                  <Input
                    type="text"
                    placeholder={selectedComponent?.fleetEquipmentCode || "Search..."}
                    value={componentMappingSearchQuery}
                    onChange={(e) => setComponentMappingSearchQuery(e.target.value)}
                    className="h-6 w-28 pl-6 pr-2 text-[10px] bg-white/10 border-white/30 text-white placeholder:text-white/50"
                    data-testid="input-component-mapping-search"
                  />
                </div>
                <Button
                  size="sm"
                  className="h-6 px-3 text-[10px] bg-[#5dc86f] hover:bg-[#4db85f] text-white"
                  onClick={handleMapComponents}
                  disabled={selectedComponentsToMap.size === 0 || addMappingMutation.isPending}
                  data-testid="btn-map-components"
                >
                  Map
                </Button>
              </div>
            </div>
          </div>

          <ScrollArea className="h-[400px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b text-gray-500">
                  <th className="text-left py-1.5 px-2 font-medium w-10">
                    <span className="text-gray-500 text-[10px]">Select</span>
                  </th>
                  <th className="text-left py-1.5 px-2 font-medium">Component Code</th>
                  <th className="text-left py-1.5 px-2 font-medium">Component Name</th>
                </tr>
              </thead>
              <tbody>
                {unmappedComponentsForVessel.length > 0 ? (
                  unmappedComponentsForVessel.map((component) => (
                    <tr key={component.fleetEquipmentCode} className="border-b last:border-0 hover:bg-blue-50/50">
                      <td className="py-1.5 px-2">
                        <Checkbox
                          checked={selectedComponentsToMap.has(component.fleetEquipmentCode)}
                          onCheckedChange={(checked) =>
                            handleComponentMappingCheckboxChange(component.fleetEquipmentCode, checked as boolean)
                          }
                          className="h-3.5 w-3.5"
                          data-testid={`checkbox-component-map-${component.fleetEquipmentCode}`}
                        />
                      </td>
                      <td className="py-1.5 px-2 text-gray-600">{component.fleetEquipmentCode}</td>
                      <td className="py-1.5 px-2 text-gray-600">{component.fleetEquipmentName}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-gray-400 text-xs">
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
        <DialogContent className="w-[calc(100vw-200px)] max-w-[calc(100vw-200px)] h-[calc(100vh-140px)] max-h-[calc(100vh-140px)] p-0 overflow-hidden flex flex-col" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Fleet Job Information</DialogTitle>
          <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Briefcase className="h-5 w-5 text-gray-500" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900" data-testid="title-fleet-job-info">Fleet Job Information</h1>
                <p className="text-gray-500 text-sm mt-0.5">
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
                  className="bg-[#5dc86f] hover:bg-[#4db85f] text-white whitespace-nowrap"
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
                  className="bg-[#5dc86f] hover:bg-[#4db85f] text-white whitespace-nowrap"
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
                  onClick={async () => {
                    if (!selectedComponent?.fleetEquipmentCode) {
                      toast({ title: "No equipment selected", description: "Please select a fleet equipment to export its jobs.", variant: "destructive" });
                      return;
                    }
                    try {
                      const response = await fetch(`/technical/api/fleet/jobs/export?fleetEquipmentCode=${encodeURIComponent(selectedComponent.fleetEquipmentCode)}`);
                      if (!response.ok) throw new Error('Export failed');
                      const blob = await response.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `fleet-jobs-${selectedComponent.fleetEquipmentCode}.xlsx`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      toast({ title: "Export successful", description: `Fleet jobs exported for ${selectedComponent.fleetEquipmentName || selectedComponent.fleetEquipmentCode}` });
                    } catch (error) {
                      toast({ title: "Export failed", description: "Could not export fleet jobs. Please try again.", variant: "destructive" });
                    }
                  }}
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
        <DialogContent className="p-0 gap-0" style={{ width: '40vw', maxWidth: '40vw', maxHeight: '85vh' }}>
          <div className="bg-[#52baf3] pl-4 pr-10 py-2.5 rounded-t-lg">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Ship className="h-3.5 w-3.5 text-white" />
                <DialogTitle className="text-xs font-semibold text-white">
                  Vessel Mapping
                </DialogTitle>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedJobVesselIds.size === 0}
                  className="h-6 px-2 text-[10px] bg-white/10 border-white/30 text-white hover:bg-white/20"
                  data-testid="btn-job-remove-vessel"
                >
                  Remove
                </Button>
                <Button
                  size="sm"
                  className="h-6 px-3 text-[10px] bg-[#5dc86f] hover:bg-[#4db85f] text-white"
                  disabled={selectedJobVesselIds.size === 0}
                  data-testid="btn-job-map-vessel"
                >
                  Map
                </Button>
              </div>
            </div>
          </div>
          <ScrollArea className="h-[400px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b text-gray-500">
                  <th className="text-left py-1.5 px-2 font-medium w-10">
                    <span className="text-gray-500 text-[10px]">Select</span>
                  </th>
                  <th className="text-left py-1.5 px-2 font-medium">Vessel Code</th>
                  <th className="text-left py-1.5 px-2 font-medium">Vessel Name</th>
                </tr>
              </thead>
              <tbody>
                {relatedVessels.length > 0 ? (
                  relatedVessels.map((vessel, index) => (
                    <tr key={index} className="border-b last:border-0 hover:bg-blue-50/50">
                      <td className="py-1.5 px-2">
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
                          className="h-3.5 w-3.5"
                          data-testid={`checkbox-job-vessel-${vessel.id}`}
                        />
                      </td>
                      <td className="py-1.5 px-2 text-gray-600">{vessel.id}</td>
                      <td className="py-1.5 px-2 text-gray-600">{vessel.name}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-gray-400 text-xs">
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
        <DialogContent className="w-[calc(100vw-200px)] max-w-[calc(100vw-200px)] h-[calc(100vh-140px)] max-h-[calc(100vh-140px)] p-0 overflow-hidden flex flex-col" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Job Details</DialogTitle>
          <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Briefcase className="h-5 w-5 text-gray-500" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900" data-testid="title-job-details">Job Details</h1>
                <p className="text-gray-500 text-sm mt-0.5">
                  {selectedJobForDetail?.woTitle || "Job Information"}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 bg-white text-[#0f172a] border-gray-300"
              onClick={() => {
                if (selectedJobForDetail) {
                  setJobFormData({ ...selectedJobForDetail, jobPriority: normalizeJobPriority(selectedJobForDetail.jobPriority) });
                } else {
                  setJobFormData({});
                }
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
                      <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-3 rounded-md border border-gray-200 min-h-[60px] whitespace-pre-wrap" data-testid="field-brief-work-description">
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
        <DialogContent className="w-[calc(100vw-200px)] max-w-[calc(100vw-200px)] h-[calc(100vh-140px)] max-h-[calc(100vh-140px)] p-0 overflow-hidden flex flex-col" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Edit Job Details</DialogTitle>
          <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Pencil className="h-5 w-5 text-gray-500" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900" data-testid="title-edit-job">Edit Job Details</h1>
                <p className="text-gray-500 text-sm mt-0.5">
                  {jobFormData.woTitle || selectedJobForDetail?.woTitle || "Edit job information"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="bg-white text-[#0f172a] border-gray-300"
                onClick={() => setIsEditJobDialogOpen(false)}
                data-testid="btn-cancel-edit-job"
              >
                Cancel
              </Button>
              <Button
                className="bg-[#5dc86f] hover:bg-[#4db85f] text-white"
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
                      <Select
                        value={jobFormData.maintenanceBasis || ""}
                        onValueChange={(val) => setJobFormData(prev => ({ ...prev, maintenanceBasis: val }))}
                      >
                        <SelectTrigger data-testid="input-edit-maint-basis">
                          <SelectValue placeholder="Select maintenance basis" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Calendar">Calendar</SelectItem>
                          <SelectItem value="Running Hours">Running Hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Frequency</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Value"
                          type="number"
                          value={jobFormData.intervalValue || ""}
                          onChange={(e) => setJobFormData(prev => ({ ...prev, intervalValue: e.target.value }))}
                          className="flex-1"
                          data-testid="input-edit-interval-value"
                        />
                        {jobFormData.maintenanceBasis === 'Running Hours' ? (
                          <div className="flex-1 text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="input-edit-unit">
                            Hours
                          </div>
                        ) : (
                          <Select
                            value={jobFormData.unit || ""}
                            onValueChange={(val) => setJobFormData(prev => ({ ...prev, unit: val }))}
                          >
                            <SelectTrigger className="flex-1" data-testid="input-edit-unit">
                              <SelectValue placeholder="Unit" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Months">Months</SelectItem>
                              <SelectItem value="Years">Years</SelectItem>
                              <SelectItem value="Weeks">Weeks</SelectItem>
                              <SelectItem value="Days">Days</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
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
                      <Select
                        value={jobFormData.jobPriority || ""}
                        onValueChange={(val) => setJobFormData(prev => ({ ...prev, jobPriority: val }))}
                      >
                        <SelectTrigger data-testid="input-edit-priority">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Class Related</Label>
                      <Select
                        value={jobFormData.classRelated || ""}
                        onValueChange={(val) => setJobFormData(prev => ({ ...prev, classRelated: val }))}
                      >
                        <SelectTrigger data-testid="input-edit-class-related">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
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
                      <Select
                        value={jobFormData.criticality || ""}
                        onValueChange={(val) => setJobFormData(prev => ({ ...prev, criticality: val }))}
                      >
                        <SelectTrigger data-testid="input-edit-criticality">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Is Active</Label>
                      <Select
                        value={jobFormData.isActive === true ? "Yes" : jobFormData.isActive === false ? "No" : ""}
                        onValueChange={(val) => setJobFormData(prev => ({ ...prev, isActive: val === "Yes" }))}
                      >
                        <SelectTrigger data-testid="input-edit-is-active">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
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
        <DialogContent className="w-[calc(100vw-200px)] max-w-[calc(100vw-200px)] h-[calc(100vh-140px)] max-h-[calc(100vh-140px)] p-0 overflow-hidden flex flex-col" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Add New Job Information</DialogTitle>
          <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Plus className="h-5 w-5 text-gray-500" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900" data-testid="title-add-new-job">Add New Job Information</h1>
                <p className="text-gray-500 text-sm mt-0.5">
                  {selectedComponent?.fleetEquipmentName || "Create a new job"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="bg-white text-[#0f172a] border-gray-300"
                onClick={() => {
                  setIsAddJobDialogOpen(false);
                  setNewJobFormData({});
                }}
                data-testid="btn-cancel-new-job"
              >
                Cancel
              </Button>
              <Button
                className="bg-[#5dc86f] hover:bg-[#4db85f] text-white"
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
                      <Select
                        value={newJobFormData.maintenanceBasis || ""}
                        onValueChange={(val) => setNewJobFormData(prev => ({ ...prev, maintenanceBasis: val, unit: val === 'Running Hours' ? 'Hours' : prev.unit === 'Hours' ? '' : prev.unit }))}
                      >
                        <SelectTrigger data-testid="input-new-maint-basis">
                          <SelectValue placeholder="Select maintenance basis" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Calendar">Calendar</SelectItem>
                          <SelectItem value="Running Hours">Running Hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Frequency</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Value"
                          type="number"
                          value={newJobFormData.intervalValue || ""}
                          onChange={(e) => setNewJobFormData(prev => ({ ...prev, intervalValue: e.target.value }))}
                          className="flex-1"
                          data-testid="input-new-interval-value"
                        />
                        {newJobFormData.maintenanceBasis === 'Running Hours' ? (
                          <div className="flex-1 text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="input-new-unit">
                            Hours
                          </div>
                        ) : (
                          <Select
                            value={newJobFormData.unit || ""}
                            onValueChange={(val) => setNewJobFormData(prev => ({ ...prev, unit: val }))}
                          >
                            <SelectTrigger className="flex-1" data-testid="input-new-unit">
                              <SelectValue placeholder="Unit" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Months">Months</SelectItem>
                              <SelectItem value="Years">Years</SelectItem>
                              <SelectItem value="Weeks">Weeks</SelectItem>
                              <SelectItem value="Days">Days</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
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
                      <Select
                        value={newJobFormData.jobPriority || ""}
                        onValueChange={(val) => setNewJobFormData(prev => ({ ...prev, jobPriority: val }))}
                      >
                        <SelectTrigger data-testid="input-new-priority">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Class Related</Label>
                      <Select
                        value={newJobFormData.classRelated || ""}
                        onValueChange={(val) => setNewJobFormData(prev => ({ ...prev, classRelated: val }))}
                      >
                        <SelectTrigger data-testid="input-new-class-related">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
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
                      <Select
                        value={newJobFormData.criticality || ""}
                        onValueChange={(val) => setNewJobFormData(prev => ({ ...prev, criticality: val }))}
                      >
                        <SelectTrigger data-testid="input-new-criticality">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-[#8798ad]">Is Active</Label>
                      <Select
                        value={newJobFormData.isActive === true ? "Yes" : newJobFormData.isActive === false ? "No" : ""}
                        onValueChange={(val) => setNewJobFormData(prev => ({ ...prev, isActive: val === "Yes" }))}
                      >
                        <SelectTrigger data-testid="input-new-is-active">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
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
        <DialogContent className="w-[calc(100vw-200px)] max-w-[calc(100vw-200px)] h-[calc(100vh-140px)] max-h-[calc(100vh-140px)] p-0 overflow-hidden flex flex-col" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Fleet Spares Information</DialogTitle>
          <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Anchor className="h-5 w-5 text-gray-500" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900" data-testid="title-fleet-spare-info">Fleet Spares Information</h1>
                <p className="text-gray-500 text-sm mt-0.5">
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
                  className="bg-[#5dc86f] hover:bg-[#4db85f] text-white whitespace-nowrap"
                  onClick={() => {
                    setSpareFormData({});
                    setMakerSearchText("");
                    setIsAddSpareDialogOpen(true);
                  }}
                  data-testid="btn-add-new-spare"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Spare
                </Button>
                <Button
                  className="bg-[#5dc86f] hover:bg-[#4db85f] text-white whitespace-nowrap"
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
                  onClick={async () => {
                    if (!selectedComponent?.fleetEquipmentCode) {
                      toast({ title: "No equipment selected", description: "Please select a fleet equipment to export its spares.", variant: "destructive" });
                      return;
                    }
                    try {
                      const response = await fetch(`/technical/api/fleet/spares/export?fleetEquipmentCode=${encodeURIComponent(selectedComponent.fleetEquipmentCode)}`);
                      if (!response.ok) throw new Error('Export failed');
                      const blob = await response.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `fleet-spares-${selectedComponent.fleetEquipmentCode}.xlsx`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      toast({ title: "Export successful", description: `Fleet spares exported for ${selectedComponent.fleetEquipmentName || selectedComponent.fleetEquipmentCode}` });
                    } catch (error) {
                      toast({ title: "Export failed", description: "Could not export fleet spares. Please try again.", variant: "destructive" });
                    }
                  }}
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
        <DialogContent className="p-0 gap-0" style={{ width: '40vw', maxWidth: '40vw', maxHeight: '85vh' }}>
          <div className="bg-[#52baf3] pl-4 pr-10 py-2.5 rounded-t-lg">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Ship className="h-3.5 w-3.5 text-white" />
                <DialogTitle className="text-xs font-semibold text-white">
                  Vessel Mapping
                </DialogTitle>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedSpareVesselIds.size === 0}
                  className="h-6 px-2 text-[10px] bg-white/10 border-white/30 text-white hover:bg-white/20"
                  data-testid="btn-spare-remove-vessel"
                >
                  Remove
                </Button>
                <Button
                  size="sm"
                  className="h-6 px-3 text-[10px] bg-[#5dc86f] hover:bg-[#4db85f] text-white"
                  disabled={selectedSpareVesselIds.size === 0}
                  data-testid="btn-spare-map-vessel"
                >
                  Map
                </Button>
              </div>
            </div>
          </div>
          <ScrollArea className="h-[400px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b text-gray-500">
                  <th className="text-left py-1.5 px-2 font-medium w-10">
                    <span className="text-gray-500 text-[10px]">Select</span>
                  </th>
                  <th className="text-left py-1.5 px-2 font-medium">Vessel Code</th>
                  <th className="text-left py-1.5 px-2 font-medium">Vessel Name</th>
                </tr>
              </thead>
              <tbody>
                {relatedVessels.length > 0 ? (
                  relatedVessels.map((vessel, index) => (
                    <tr key={index} className="border-b last:border-0 hover:bg-blue-50/50">
                      <td className="py-1.5 px-2">
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
                          className="h-3.5 w-3.5"
                          data-testid={`checkbox-spare-vessel-${vessel.id}`}
                        />
                      </td>
                      <td className="py-1.5 px-2 text-gray-600">{vessel.id}</td>
                      <td className="py-1.5 px-2 text-gray-600">{vessel.name}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-gray-400 text-xs">
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
        <DialogContent className="w-[calc(100vw-200px)] max-w-[calc(100vw-200px)] h-[calc(100vh-140px)] max-h-[calc(100vh-140px)] p-0 overflow-hidden flex flex-col" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Spare Details</DialogTitle>
          <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5 text-gray-500" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900" data-testid="title-spare-details">Spare Details</h1>
                <p className="text-gray-500 text-sm mt-0.5">{selectedSpareForDetail?.partName || "View spare information"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="bg-white text-[#0f172a] border-gray-300"
                onClick={() => setIsSpareDetailsDialogOpen(false)}
                data-testid="btn-back-spare-detail"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2 bg-white text-[#0f172a] border-gray-300"
                onClick={() => {
                  setSpareFormData(selectedSpareForDetail || {});
                  setMakerSearchText(selectedSpareForDetail?.maker || "");
                  setIsEditSpareDialogOpen(true);
                }}
                data-testid="btn-edit-spare"
              >
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto px-6 py-6">
            {selectedSpareForDetail && (
              <div className="max-w-5xl mx-auto space-y-6">
                <SectionBlock id="spare-detail-basic-info" number="A1" title="Basic Information" description="Core identification and classification details">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <span className="text-sm text-[#8798ad]">Part Code</span>
                      <div className="text-sm font-medium text-gray-900" data-testid="detail-part-code">{selectedSpareForDetail.partCode || '-'}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm text-[#8798ad]">Part Name</span>
                      <div className="text-sm font-medium text-gray-900" data-testid="detail-part-name">{selectedSpareForDetail.partName || '-'}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm text-[#8798ad]">Part Number</span>
                      <div className="text-sm font-medium text-gray-900" data-testid="detail-part-number">{selectedSpareForDetail.partNumber || '-'}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm text-[#8798ad]">UOM</span>
                      <div className="text-sm font-medium text-gray-900" data-testid="detail-uom">{selectedSpareForDetail.unitOfMeasurement || '-'}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm text-[#8798ad]">Equipment</span>
                      <div className="text-sm font-medium text-gray-900" data-testid="detail-equipment">{selectedSpareForDetail.fleetEquipmentName || '-'}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm text-[#8798ad]">Equipment Code</span>
                      <div className="text-sm font-medium text-gray-900" data-testid="detail-equipment-code">{selectedSpareForDetail.fleetEquipmentCode || '-'}</div>
                    </div>
                  </div>
                </SectionBlock>

                <SectionBlock id="spare-detail-status" number="A2" title="Status & Classification" description="Status flags and classification details">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <span className="text-sm text-[#8798ad]">Criticality</span>
                      <div className="text-sm font-medium text-gray-900" data-testid="detail-criticality">
                        {selectedSpareForDetail.criticality ? (
                          <Badge variant="secondary" className={`no-default-hover-elevate no-default-active-elevate ${selectedSpareForDetail.criticality === 'Yes' || selectedSpareForDetail.criticality === 'Critical' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{selectedSpareForDetail.criticality}</Badge>
                        ) : '-'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm text-[#8798ad]">Is Active</span>
                      <div className="text-sm font-medium text-gray-900" data-testid="detail-is-active">
                        <Badge variant="secondary" className={`no-default-hover-elevate no-default-active-elevate ${selectedSpareForDetail.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {selectedSpareForDetail.isActive !== false ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm text-[#8798ad]">IHM</span>
                      <div className="text-sm font-medium text-gray-900" data-testid="detail-ihm">
                        {selectedSpareForDetail.ihm ? (
                          <Badge variant="secondary" className={`no-default-hover-elevate no-default-active-elevate ${selectedSpareForDetail.ihm === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{selectedSpareForDetail.ihm}</Badge>
                        ) : '-'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm text-[#8798ad]">Evidence Type</span>
                      <div className="text-sm font-medium text-gray-900" data-testid="detail-evidence-type">{selectedSpareForDetail.evidenceType || '-'}</div>
                    </div>
                  </div>
                </SectionBlock>

                <SectionBlock id="spare-detail-technical" number="A3" title="Technical Details" description="Maker and technical specifications">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <span className="text-sm text-[#8798ad]">Maker</span>
                      <div className="text-sm font-medium text-gray-900" data-testid="detail-maker">{selectedSpareForDetail.maker || '-'}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm text-[#8798ad]">Maker Code</span>
                      <div className="text-sm font-medium text-gray-900" data-testid="detail-maker-code">{selectedSpareForDetail.makerCode || '-'}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm text-[#8798ad]">Drawing Number</span>
                      <div className="text-sm font-medium text-gray-900" data-testid="detail-drawing-number">{selectedSpareForDetail.drawingNumber || '-'}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm text-[#8798ad]">Position Number</span>
                      <div className="text-sm font-medium text-gray-900" data-testid="detail-position-number">{selectedSpareForDetail.positionNumber || '-'}</div>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <span className="text-sm text-[#8798ad]">Specification</span>
                      <div className="text-sm font-medium text-gray-900" data-testid="detail-specification">{selectedSpareForDetail.specification || '-'}</div>
                    </div>
                  </div>
                </SectionBlock>

                <SectionBlock id="spare-detail-manual" number="A4" title="Manual Reference" description="Manual and documentation references">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <span className="text-sm text-[#8798ad]">Manual Name</span>
                      <div className="text-sm font-medium text-gray-900" data-testid="detail-manual-name">{selectedSpareForDetail.manualName || '-'}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm text-[#8798ad]">Page Number</span>
                      <div className="text-sm font-medium text-gray-900" data-testid="detail-page-number">{selectedSpareForDetail.pageNumber || '-'}</div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-1">
                    <span className="text-sm text-[#8798ad]">Note</span>
                    <div className="text-sm font-medium text-gray-900" data-testid="detail-note">{selectedSpareForDetail.note || '-'}</div>
                  </div>
                </SectionBlock>

                <SectionBlock id="spare-detail-vessels" number="A5" title="Spare Mapped Vessel Details" description="Vessels linked to this spare part">
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
                </SectionBlock>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Spare Dialog */}
      <Dialog open={isEditSpareDialogOpen} onOpenChange={setIsEditSpareDialogOpen}>
        <DialogContent className="w-[calc(100vw-200px)] max-w-[calc(100vw-200px)] h-[calc(100vh-140px)] max-h-[calc(100vh-140px)] p-0 overflow-hidden flex flex-col" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Edit Spare Details</DialogTitle>
          <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Pencil className="h-5 w-5 text-gray-500" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900" data-testid="title-edit-spare">Edit Spare Details</h1>
                <p className="text-gray-500 text-sm mt-0.5">{spareFormData.partName || "Update spare information"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="bg-white text-[#0f172a] border-gray-300"
                onClick={() => setIsEditSpareDialogOpen(false)}
                data-testid="btn-cancel-edit-spare"
              >
                Cancel
              </Button>
              <Button
                className="bg-[#5dc86f] hover:bg-[#4db85f] text-white"
                onClick={() => {
                  toast({ title: "Success", description: "Spare updated successfully" });
                  setIsEditSpareDialogOpen(false);
                }}
                data-testid="btn-save-spare"
              >
                Save
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto px-6 py-6">
            <div className="max-w-5xl mx-auto space-y-6">
              <SectionBlock id="edit-spare-basic-info" number="A1" title="Basic Information" description="Core identification and classification details">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </SectionBlock>

              <SectionBlock id="edit-spare-status" number="A2" title="Status & Classification" description="Status flags and classification details">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </SectionBlock>

              <SectionBlock id="edit-spare-technical" number="A3" title="Technical Details" description="Maker and technical specifications">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="text-gray-500 text-xs font-medium mb-1 block">Maker</label>
                    <div className="relative">
                      <Input
                        placeholder="Type to search makers..."
                        value={makerSearchText}
                        onChange={(e) => handleMakerSearchChange(e.target.value)}
                        onFocus={() => { if (makerSearchText.trim()) setShowMakerSuggestions(true); }}
                        onBlur={() => setTimeout(() => setShowMakerSuggestions(false), 200)}
                        className="pr-8"
                        data-testid="input-edit-maker"
                      />
                      {makerSearchText && (
                        <button
                          type="button"
                          onClick={handleClearMaker}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          data-testid="button-clear-edit-maker"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {showMakerSuggestions && filteredMakers.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {filteredMakers.map((maker) => (
                          <div
                            key={maker.id}
                            className="px-3 py-2 text-sm cursor-pointer hover:bg-cyan-50 hover:text-cyan-700 border-b border-gray-100 last:border-b-0"
                            onMouseDown={() => handleMakerSelect(maker)}
                            data-testid={`edit-maker-suggestion-${maker.id}`}
                          >
                            <span className="font-medium">{maker.makerName}</span>
                            {maker.makerCode && (
                              <span className="text-gray-400 ml-2 text-xs">({maker.makerCode})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs font-medium mb-1 block">Maker Code</label>
                    <Input
                      placeholder="Auto-filled from maker selection"
                      value={spareFormData.makerCode || ""}
                      readOnly
                      className="bg-gray-100 text-gray-600"
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
                  <div className="col-span-1 md:col-span-2">
                    <label className="text-gray-500 text-xs font-medium mb-1 block">Specification</label>
                    <Input
                      value={spareFormData.specification || ""}
                      onChange={(e) => setSpareFormData(prev => ({ ...prev, specification: e.target.value }))}
                      data-testid="input-edit-specification"
                    />
                  </div>
                </div>
              </SectionBlock>

              <SectionBlock id="edit-spare-manual" number="A4" title="Manual Reference" description="Manual and documentation references">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <div className="col-span-1 md:col-span-2">
                    <label className="text-gray-500 text-xs font-medium mb-1 block">Note</label>
                    <Input
                      value={spareFormData.note || ""}
                      onChange={(e) => setSpareFormData(prev => ({ ...prev, note: e.target.value }))}
                      data-testid="input-edit-note"
                    />
                  </div>
                </div>
              </SectionBlock>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add New Spare Dialog */}
      <Dialog open={isAddSpareDialogOpen} onOpenChange={setIsAddSpareDialogOpen}>
        <DialogContent className="w-[calc(100vw-200px)] max-w-[calc(100vw-200px)] h-[calc(100vh-140px)] max-h-[calc(100vh-140px)] p-0 overflow-hidden flex flex-col" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Add New Spare Information</DialogTitle>
          <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Plus className="h-5 w-5 text-gray-500" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900" data-testid="title-add-spare">Add New Spare Information</h1>
                <p className="text-gray-500 text-sm mt-0.5">Create a new spare part entry</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="bg-white text-[#0f172a] border-gray-300"
                onClick={() => setIsAddSpareDialogOpen(false)}
                data-testid="btn-cancel-add-spare"
              >
                Cancel
              </Button>
              <Button
                className="bg-[#5dc86f] hover:bg-[#4db85f] text-white"
                onClick={() => {
                  toast({ title: "Success", description: "New spare added successfully" });
                  setIsAddSpareDialogOpen(false);
                }}
                data-testid="btn-save-new-spare"
              >
                Save
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto px-6 py-6">
            <div className="max-w-5xl mx-auto space-y-6">
              <SectionBlock id="add-spare-basic-info" number="A1" title="Basic Information" description="Core identification and classification details">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </SectionBlock>

              <SectionBlock id="add-spare-status" number="A2" title="Status & Classification" description="Status flags and classification details">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </SectionBlock>

              <SectionBlock id="add-spare-technical" number="A3" title="Technical Details" description="Maker and technical specifications">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="text-gray-500 text-xs font-medium mb-1 block">Maker</label>
                    <div className="relative">
                      <Input
                        placeholder="Type to search makers..."
                        value={makerSearchText}
                        onChange={(e) => handleMakerSearchChange(e.target.value)}
                        onFocus={() => { if (makerSearchText.trim()) setShowMakerSuggestions(true); }}
                        onBlur={() => setTimeout(() => setShowMakerSuggestions(false), 200)}
                        className="pr-8"
                        data-testid="input-new-maker"
                      />
                      {makerSearchText && (
                        <button
                          type="button"
                          onClick={handleClearMaker}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          data-testid="button-clear-new-maker"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {showMakerSuggestions && filteredMakers.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {filteredMakers.map((maker) => (
                          <div
                            key={maker.id}
                            className="px-3 py-2 text-sm cursor-pointer hover:bg-cyan-50 hover:text-cyan-700 border-b border-gray-100 last:border-b-0"
                            onMouseDown={() => handleMakerSelect(maker)}
                            data-testid={`new-maker-suggestion-${maker.id}`}
                          >
                            <span className="font-medium">{maker.makerName}</span>
                            {maker.makerCode && (
                              <span className="text-gray-400 ml-2 text-xs">({maker.makerCode})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs font-medium mb-1 block">Maker Code</label>
                    <Input
                      placeholder="Auto-filled from maker selection"
                      value={spareFormData.makerCode || ""}
                      readOnly
                      className="bg-gray-100 text-gray-600"
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
                  <div className="col-span-1 md:col-span-2">
                    <label className="text-gray-500 text-xs font-medium mb-1 block">Specification</label>
                    <Input
                      value={spareFormData.specification || ""}
                      onChange={(e) => setSpareFormData(prev => ({ ...prev, specification: e.target.value }))}
                      data-testid="input-new-specification"
                    />
                  </div>
                </div>
              </SectionBlock>

              <SectionBlock id="add-spare-manual" number="A4" title="Manual Reference" description="Manual and documentation references">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <div className="col-span-1 md:col-span-2">
                    <label className="text-gray-500 text-xs font-medium mb-1 block">Note</label>
                    <Input
                      value={spareFormData.note || ""}
                      onChange={(e) => setSpareFormData(prev => ({ ...prev, note: e.target.value }))}
                      data-testid="input-new-note"
                    />
                  </div>
                </div>
              </SectionBlock>
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
