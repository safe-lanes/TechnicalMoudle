import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";

import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChevronRight, ChevronDown, ChevronUp, Plus, Search, ArrowLeft, Trash2, X } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { FleetComponents, Maker } from "@shared/schema";

interface TreeNode {
  code: string;
  name: string;
  children: TreeNode[];
  data?: FleetComponents;
  isExpanded?: boolean;
}

function buildTree(components: FleetComponents[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const rootNodes: TreeNode[] = [];

  components.forEach((comp) => {
    const code = comp.fleetEquipmentCode;
    if (!code) return;

    const node: TreeNode = {
      code,
      name: comp.fleetEquipmentName || "Unknown",
      children: [],
      data: comp,
      isExpanded: false,
    };
    nodeMap.set(code, node);
  });

  components.forEach((comp) => {
    const code = comp.fleetEquipmentCode;
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
  onAddChild,
  searchQuery,
}: {
  node: TreeNode;
  level?: number;
  selectedCode: string | null;
  onSelect: (node: TreeNode) => void;
  expandedNodes: Set<string>;
  onToggle: (code: string) => void;
  onAddChild: (parentCode: string) => void;
  searchQuery: string;
}) {
  const isExpanded = expandedNodes.has(node.code);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedCode === node.code;

  const matchesSearch = searchQuery.trim() === "" ||
    node.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.name.toLowerCase().includes(searchQuery.toLowerCase());

  const hasMatchingDescendant = useMemo(() => {
    if (searchQuery.trim() === "") return true;

    const checkDescendants = (n: TreeNode): boolean => {
      if (n.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return true;
      }
      return n.children.some(checkDescendants);
    };

    return checkDescendants(node);
  }, [node, searchQuery]);

  if (!matchesSearch && !hasMatchingDescendant) return null;

  return (
    <div>
      <div
        className={`flex items-center py-2 px-2 cursor-pointer hover:bg-gray-100 group ${isSelected ? "bg-blue-100 text-blue-800" : ""
          }`}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        data-testid={`tree-item-${node.code}`}
      >
        <span
          className="mr-2 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) {
              onToggle(node.code);
            }
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )
          ) : (
            <span className="w-4 inline-block" />
          )}
        </span>
        <span
          className={`text-sm flex-1 ${level === 0 ? "font-medium" : ""}`}
          onClick={() => onSelect(node)}
        >
          {node.code}. {node.name}
        </span>
        <button
          className="invisible group-hover:visible p-1 hover:bg-gray-200 rounded"
          onClick={(e) => {
            e.stopPropagation();
            onAddChild(node.code);
          }}
          data-testid={`btn-add-child-${node.code}`}
        >
          <Plus className="h-4 w-4 text-gray-500" />
        </button>
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
            onAddChild={onAddChild}
            searchQuery={searchQuery}
          />
        ))}
    </div>
  );
}

export default function AddEditFleetComponent() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/fleet-component-editor/:id");
  const editId = params?.id ? parseInt(params.id) : null;
  const { toast } = useToast();

  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [activeEditId, setActiveEditId] = useState<number | null>(editId);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    maker: "",
    makerCode: "",
    model: "",
    modelCode: "",
    parentCode: "",
    fleetEquipmentCode: "",
    location: "",
    rating: "",
    eqptSystemDept: "",
    componentCategory: "",
    notes: "",
    fleetEquipmentName: "",
  });

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newComponentCode, setNewComponentCode] = useState("");
  const [makerSearchText, setMakerSearchText] = useState("");
  const [showMakerSuggestions, setShowMakerSuggestions] = useState(false);
  const [sectionCollapsed, setSectionCollapsed] = useState(false);

  const { data: fleetComponentsList = [], isLoading } = useQuery<FleetComponents[]>({
    queryKey: ["/technical/api/fleet-admin/fleet-components"],
  });

  const { data: makers = [] } = useQuery<Maker[]>({
    queryKey: ["/technical/api/fleet/makers"],
  });

  const { data: editingComponent } = useQuery<FleetComponents>({
    queryKey: ["/technical/api/fleet-admin/fleet-components", editId],
    queryFn: async () => {
      const res = await fetch(`/technical/api/fleet-admin/fleet-components/${editId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch fleet component');
      return res.json();
    },
    enabled: !!editId,
  });

  useEffect(() => {
    if (editingComponent && fleetComponentsList.length > 0) {
      setActiveEditId(editingComponent.id);

      setFormData({
        maker: editingComponent.makerName || "",
        makerCode: editingComponent.makerCode || "",
        model: editingComponent.model || "",
        modelCode: editingComponent.modelCode || "",
        parentCode: editingComponent.parentFleetEquipmentCode || "",
        fleetEquipmentCode: editingComponent.fleetEquipmentCode || "",
        location: editingComponent.location || "",
        rating: editingComponent.rating || "",
        eqptSystemDept: editingComponent.eqptSystemDept || "",
        componentCategory: editingComponent.componentCategory || "",
        notes: editingComponent.notes || "",
        fleetEquipmentName: editingComponent.fleetEquipmentName || "",
      });

      setMakerSearchText(editingComponent.makerName || "");
      setIsAddingNew(false);

      const matchingNode: TreeNode = {
        code: editingComponent.fleetEquipmentCode || "",
        name: editingComponent.fleetEquipmentName || "",
        children: [],
        data: editingComponent,
      };
      setSelectedNode(matchingNode);

      const code = editingComponent.fleetEquipmentCode;
      if (code) {
        const pathCodes = new Set<string>();
        const findAncestors = (targetCode: string) => {
          const comp = fleetComponentsList.find(c => c.fleetEquipmentCode === targetCode);
          if (comp?.parentFleetEquipmentCode) {
            pathCodes.add(comp.parentFleetEquipmentCode);
            findAncestors(comp.parentFleetEquipmentCode);
          }
        };
        findAncestors(code);
        setExpandedNodes(prev => {
          const newSet = new Set(Array.from(prev));
          Array.from(pathCodes).forEach(c => newSet.add(c));
          return newSet;
        });
      }
    }
  }, [editingComponent, fleetComponentsList]);

  const createFleetComponentMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      return apiRequest("POST", "/technical/api/fleet-admin/fleet-components", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-components"] });
      toast({ title: "Success", description: "Fleet component created successfully" });
      setIsAddingNew(false);
      setNewComponentCode("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create fleet component", variant: "destructive" });
    },
  });

  const updateFleetComponentMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Record<string, any> }) => {
      return apiRequest("PATCH", `/technical/api/fleet-admin/fleet-components/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-components"] });
      toast({ title: "Success", description: "Fleet component updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update fleet component", variant: "destructive" });
    },
  });

  const deleteFleetComponentMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/technical/api/fleet-admin/fleet-components/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/fleet-components"] });
      toast({ title: "Success", description: "Fleet component deleted successfully" });
      setSelectedNode(null);
      setActiveEditId(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete fleet component", variant: "destructive" });
    },
  });

  const treeData = useMemo(() => {
    if (!fleetComponentsList.length) return [];
    return buildTree(fleetComponentsList);
  }, [fleetComponentsList]);

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

  const resetForm = () => {
    setFormData({
      maker: "",
      makerCode: "",
      model: "",
      modelCode: "",
      parentCode: "",
      fleetEquipmentCode: "",
      location: "",
      rating: "",
      eqptSystemDept: "",
      componentCategory: "",
      notes: "",
      fleetEquipmentName: "",
    });
    setMakerSearchText("");
    setShowMakerSuggestions(false);
  };

  const handleNodeSelect = (node: TreeNode) => {
    setSelectedNode(node);
    setActiveEditId(node.data?.id ?? null);
    setIsAddingNew(false);
    setNewComponentCode("");

    if (node.data) {
      setMakerSearchText(node.data.makerName || "");
      setFormData({
        maker: node.data.makerName || "",
        makerCode: node.data.makerCode || "",
        model: node.data.model || "",
        modelCode: node.data.modelCode || "",
        parentCode: node.data.parentFleetEquipmentCode || "",
        fleetEquipmentCode: node.data.fleetEquipmentCode || "",
        location: node.data.location || "",
        rating: node.data.rating || "",
        eqptSystemDept: node.data.eqptSystemDept || "",
        componentCategory: node.data.componentCategory || "",
        notes: node.data.notes || "",
        fleetEquipmentName: node.data.fleetEquipmentName || "",
      });
    } else {
      resetForm();
      setFormData(prev => ({
        ...prev,
        fleetEquipmentCode: node.code,
        componentCategory: node.code.charAt(0),
      }));
    }
  };

  const handleAddChild = (parentCode: string) => {
    setIsAddingNew(true);
    setSelectedNode(null);
    setActiveEditId(null);
    setNewComponentCode(`${parentCode}.`);

    resetForm();
    setFormData(prev => ({
      ...prev,
      parentCode: parentCode,
      componentCategory: parentCode.charAt(0),
    }));

    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      newSet.add(parentCode);
      return newSet;
    });
  };

  const handleSave = () => {
    if (isAddingNew) {
      if (!newComponentCode.trim() || !formData.fleetEquipmentName.trim()) {
        toast({
          title: "Validation Error",
          description: "Equipment code and name are required",
          variant: "destructive"
        });
        return;
      }

      createFleetComponentMutation.mutate({
        fleetEquipmentCode: newComponentCode.trim(),
        fleetEquipmentName: formData.fleetEquipmentName,
        parentFleetEquipmentCode: formData.parentCode || null,
        componentCategory: formData.componentCategory || null,
        makerName: formData.maker || null,
        makerCode: formData.makerCode || null,
        model: formData.model || null,
        modelCode: formData.modelCode || null,
        location: formData.location || null,
        rating: formData.rating || null,
        eqptSystemDept: formData.eqptSystemDept || null,
        notes: formData.notes || null,
      });
    } else if (activeEditId) {
      updateFleetComponentMutation.mutate({
        id: activeEditId,
        updates: {
          fleetEquipmentName: formData.fleetEquipmentName,
          parentFleetEquipmentCode: formData.parentCode || null,
          componentCategory: formData.componentCategory || null,
          makerName: formData.maker || null,
          makerCode: formData.makerCode || null,
          model: formData.model || null,
          modelCode: formData.modelCode || null,
          location: formData.location || null,
          rating: formData.rating || null,
          eqptSystemDept: formData.eqptSystemDept || null,
          notes: formData.notes || null,
        },
      });
    } else {
      toast({
        title: "Error",
        description: "No fleet component selected for update",
        variant: "destructive"
      });
    }
  };

  const handleDelete = () => {
    const idToDelete = activeEditId ?? selectedNode?.data?.id ?? editId;
    if (idToDelete) {
      if (confirm("Are you sure you want to delete this component?")) {
        deleteFleetComponentMutation.mutate(idToDelete);
      }
    }
  };

  const filteredMakers = useMemo(() => {
    if (!makerSearchText.trim()) return [];
    return makers.filter(m =>
      m.makerName?.toLowerCase().includes(makerSearchText.toLowerCase())
    ).slice(0, 10);
  }, [makerSearchText, makers]);

  const handleMakerSearchChange = (value: string) => {
    setMakerSearchText(value);
    setShowMakerSuggestions(true);
    if (!value.trim()) {
      setFormData(prev => ({ ...prev, maker: "", makerCode: "" }));
    }
  };

  const handleMakerSelect = (maker: Maker) => {
    setMakerSearchText(maker.makerName || "");
    setFormData(prev => ({
      ...prev,
      maker: maker.makerName || "",
      makerCode: maker.makerCode || "",
    }));
    setShowMakerSuggestions(false);
  };

  const handleClearMaker = () => {
    setMakerSearchText("");
    setFormData(prev => ({ ...prev, maker: "", makerCode: "" }));
    setShowMakerSuggestions(false);
  };

  const isEditMode = !!activeEditId || !!editId || (!!selectedNode?.data);
  const displayCode = isAddingNew ? newComponentCode : (formData.fleetEquipmentCode || selectedNode?.code || "");
  const displayName = isAddingNew
    ? (formData.fleetEquipmentName || "XXX")
    : (formData.fleetEquipmentName || selectedNode?.name || "");

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Add / Edit Fleet Component</h1>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-[#16569e] text-white"
              onClick={() => handleAddChild(selectedNode?.code || formData.fleetEquipmentCode || "6")}
              data-testid="btn-add-sub-equipment"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Sub Equipment
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-gray-600 hover:bg-gray-50"
              onClick={() => setLocation("/admin/fleet-data")}
              data-testid="btn-back"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white border-b px-6 py-2 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search Components..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8"
            data-testid="input-search-components"
          />
        </div>

        <Button
          variant="outline"
          size="icon"
          className="text-red-600 hover:bg-red-50 h-8 w-8"
          onClick={handleDelete}
          disabled={!selectedNode?.data && !editId}
          data-testid="btn-delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>

        <Button
          className="bg-green-600 hover:bg-green-700 text-white h-8"
          onClick={handleSave}
          disabled={updateFleetComponentMutation.isPending || createFleetComponentMutation.isPending}
          data-testid="btn-save"
        >
          Save
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[30%] flex flex-col border-r">
          <div className="px-3 py-2 bg-sky-500">
            <span className="text-white font-semibold text-sm">FLEET COMPONENTS</span>
          </div>
          <div className="flex-1 overflow-y-auto bg-white">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-8 bg-gray-100 animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <div className="py-2">
                {treeData.map((node) => (
                  <TreeItem
                    key={node.code}
                    node={node}
                    selectedCode={selectedNode?.code || formData.fleetEquipmentCode || null}
                    onSelect={handleNodeSelect}
                    expandedNodes={expandedNodes}
                    onToggle={handleToggle}
                    onAddChild={handleAddChild}
                    searchQuery={searchQuery}
                  />
                ))}
              </div>
            )}

            {isAddingNew && (
              <div className="px-4 py-2 bg-blue-50 border-t border-blue-200">
                <Input
                  value={newComponentCode}
                  onChange={(e) => setNewComponentCode(e.target.value)}
                  placeholder="Enter new component code..."
                  className="text-sm h-8"
                  data-testid="input-new-component-code"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {(selectedNode || isAddingNew || editId) ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-4" data-testid="text-component-title">
                {displayCode} {displayName}
              </h2>

              <div className="space-y-4">
                <Card className="rounded-sm border border-gray-200 shadow-none">
                  <CardHeader
                    className="py-3 px-4 cursor-pointer hover:bg-gray-50 flex-row items-center justify-between"
                    onClick={() => setSectionCollapsed(!sectionCollapsed)}
                    data-testid="section-header-fleet-info"
                  >
                    <span className="text-sm font-medium text-[#16569e]">Fleet Component Information</span>
                    {sectionCollapsed ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronUp className="h-4 w-4 text-gray-500" />}
                  </CardHeader>
                  {!sectionCollapsed && (
                  <CardContent className="pt-4 pb-4 px-4 border-t border-gray-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    <div className="relative">
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Maker*</label>
                      <div className="relative">
                        <Input
                          value={makerSearchText}
                          onChange={(e) => handleMakerSearchChange(e.target.value)}
                          onFocus={() => { if (makerSearchText.trim()) setShowMakerSuggestions(true); }}
                          onBlur={() => setTimeout(() => setShowMakerSuggestions(false), 200)}
                          placeholder="Type to search makers..."
                          className="h-8 text-sm pr-8"
                          data-testid="input-maker-search"
                        />
                        {makerSearchText && (
                          <button
                            type="button"
                            onClick={handleClearMaker}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            data-testid="button-clear-maker"
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
                              className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 hover:text-blue-700 border-b border-gray-100 last:border-b-0"
                              onMouseDown={() => handleMakerSelect(maker)}
                              data-testid={`maker-suggestion-${maker.id}`}
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
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Maker Code</label>
                      <Input
                        value={formData.makerCode}
                        readOnly
                        placeholder="Auto-filled from maker selection"
                        className="h-8 text-sm bg-gray-100 text-gray-600"
                        data-testid="input-maker-code"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Model</label>
                      <Input
                        value={formData.model}
                        onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                        placeholder="As Per Master Data"
                        className="h-8 text-sm"
                        data-testid="input-model"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Model Code</label>
                      <Input
                        value={formData.modelCode}
                        onChange={(e) => setFormData(prev => ({ ...prev, modelCode: e.target.value }))}
                        className="h-8 text-sm"
                        data-testid="input-model-code"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Parent Code</label>
                      <Input
                        value={formData.parentCode}
                        readOnly
                        className="h-8 text-sm bg-gray-50"
                        data-testid="input-parent-code"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Fleet Equipment Code</label>
                      <Input
                        value={isAddingNew ? newComponentCode : formData.fleetEquipmentCode}
                        readOnly={!isAddingNew}
                        onChange={(e) => isAddingNew && setNewComponentCode(e.target.value)}
                        className={`h-8 text-sm ${!isAddingNew ? "bg-gray-50" : ""}`}
                        data-testid="input-fleet-equipment-code"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Location</label>
                      <Input
                        value={formData.location}
                        onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                        className="h-8 text-sm"
                        data-testid="input-location"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Rating</label>
                      <Input
                        value={formData.rating}
                        onChange={(e) => setFormData(prev => ({ ...prev, rating: e.target.value }))}
                        className="h-8 text-sm"
                        data-testid="input-rating"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Eqpt./ System Department</label>
                      <Input
                        value={formData.eqptSystemDept}
                        onChange={(e) => setFormData(prev => ({ ...prev, eqptSystemDept: e.target.value }))}
                        className="h-8 text-sm"
                        data-testid="input-dept"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Component Category</label>
                      <Input
                        value={formData.componentCategory}
                        onChange={(e) => setFormData(prev => ({ ...prev, componentCategory: e.target.value }))}
                        className="h-8 text-sm"
                        data-testid="input-category"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Notes</label>
                      <Input
                        value={formData.notes}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Notes"
                        className="h-8 text-sm bg-amber-50"
                        data-testid="input-notes"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Fleet Equipment Name*</label>
                      <Input
                        value={formData.fleetEquipmentName}
                        onChange={(e) => setFormData(prev => ({ ...prev, fleetEquipmentName: e.target.value }))}
                        className="h-8 text-sm"
                        data-testid="input-fleet-equipment-name"
                      />
                    </div>
                  </div>
                  </CardContent>
                  )}
                </Card>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <div className="h-16 w-16 mx-auto mb-4 text-gray-300 border-2 border-gray-300 rounded flex items-center justify-center">
                  <Plus className="h-8 w-8" />
                </div>
                <p className="text-lg">Select a component from the tree</p>
                <p className="text-sm">or click the + icon to add a new sub-component</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
