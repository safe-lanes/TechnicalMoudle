import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, ChevronDown, Plus, Search, ArrowLeft, Trash2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MasterData, Maker } from "@shared/schema";

interface TreeNode {
  code: string;
  name: string;
  children: TreeNode[];
  data?: MasterData;
  isExpanded?: boolean;
}

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

function buildTree(components: MasterData[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const rootNodes: TreeNode[] = [];

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

  const sortedComponents = [...components].sort((a, b) => 
    (a.fleetEquipmentCode || "").localeCompare(b.fleetEquipmentCode || "")
  );

  sortedComponents.forEach((comp) => {
    const code = comp.fleetEquipmentCode;
    if (!code) return;

    const parts = code.split(".");
    let currentParentNode = nodeMap.get(parts[0]);
    
    if (!currentParentNode) return;

    for (let i = 1; i < parts.length; i++) {
      const partialCode = parts.slice(0, i + 1).join(".");
      let childNode = nodeMap.get(partialCode);
      
      if (!childNode) {
        const isLeaf = i === parts.length - 1;
        childNode = {
          code: partialCode,
          name: isLeaf ? (comp.equipmentName || "Unknown") : partialCode,
          children: [],
          data: isLeaf ? comp : undefined,
          isExpanded: false,
        };
        nodeMap.set(partialCode, childNode);
        currentParentNode.children.push(childNode);
      } else if (i === parts.length - 1 && !childNode.data) {
        childNode.name = comp.equipmentName || childNode.name;
        childNode.data = comp;
      }
      
      currentParentNode = childNode;
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
        className={`flex items-center py-2 px-2 cursor-pointer hover:bg-gray-100 group ${
          isSelected ? "bg-blue-100 text-blue-800" : ""
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
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
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity"
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
  const { toast } = useToast();
  
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(["6"]));
  const [searchQuery, setSearchQuery] = useState("");
  const [criticalityFilter, setCriticalityFilter] = useState("all");
  const [selectedVessel, setSelectedVessel] = useState("all");
  
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

  const { data: masterDataResponse, isLoading } = useQuery<{
    items: MasterData[];
    total: number;
  }>({
    queryKey: ["/technical/api/fleet-admin/master-data?limit=1000"],
  });

  const { data: vessels = [] } = useQuery<{ id: string; code?: string; name: string }[]>({
    queryKey: ["/technical/api/vessels"],
  });

  const { data: makers = [] } = useQuery<Maker[]>({
    queryKey: ["/technical/api/fleet/makers"],
  });

  const updateMasterDataMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<MasterData> }) => {
      return apiRequest("PATCH", `/technical/api/fleet-admin/master-data/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/master-data?limit=1000"] });
      toast({ title: "Success", description: "Component saved successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save component", variant: "destructive" });
    },
  });

  const createMasterDataMutation = useMutation({
    mutationFn: async (data: Partial<MasterData>) => {
      return apiRequest("POST", "/technical/api/fleet-admin/master-data", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/master-data?limit=1000"] });
      toast({ title: "Success", description: "Component created successfully" });
      setIsAddingNew(false);
      setNewComponentCode("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create component", variant: "destructive" });
    },
  });

  const deleteMasterDataMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/technical/api/fleet-admin/master-data/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin/master-data?limit=1000"] });
      toast({ title: "Success", description: "Component deleted successfully" });
      setSelectedNode(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete component", variant: "destructive" });
    },
  });

  const treeData = useMemo(() => {
    if (!masterDataResponse?.items) return [];
    return buildTree(masterDataResponse.items);
  }, [masterDataResponse?.items]);

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
  };

  const handleNodeSelect = (node: TreeNode) => {
    setSelectedNode(node);
    setIsAddingNew(false);
    setNewComponentCode("");
    
    if (node.data) {
      const parentCode = node.code.includes(".") 
        ? node.code.split(".").slice(0, -1).join(".") 
        : "";
      
      setFormData({
        maker: node.data.makerName || "",
        makerCode: node.data.makerCode || "",
        model: node.data.model || "",
        modelCode: node.data.modelCode || "",
        parentCode: parentCode,
        fleetEquipmentCode: node.data.fleetEquipmentCode || "",
        location: "",
        rating: "",
        eqptSystemDept: "",
        componentCategory: node.data.sfiCode?.substring(0, 1) || "",
        notes: "",
        fleetEquipmentName: node.data.equipmentName || "",
      });
    } else {
      resetForm();
      setFormData(prev => ({
        ...prev,
        fleetEquipmentCode: node.code,
        parentCode: node.code.includes(".") 
          ? node.code.split(".").slice(0, -1).join(".") 
          : "",
      }));
    }
  };

  const handleAddChild = (parentCode: string) => {
    setIsAddingNew(true);
    setSelectedNode(null);
    setNewComponentCode(`${parentCode}.`);
    
    resetForm();
    setFormData(prev => ({
      ...prev,
      parentCode: parentCode,
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
      
      createMasterDataMutation.mutate({
        fleetEquipmentCode: newComponentCode.trim(),
        equipmentName: formData.fleetEquipmentName,
        makerName: formData.maker,
        makerCode: formData.makerCode,
        model: formData.model,
        modelCode: formData.modelCode,
        sfiCode: formData.componentCategory,
      });
    } else if (selectedNode?.data) {
      updateMasterDataMutation.mutate({
        id: selectedNode.data.id,
        updates: {
          equipmentName: formData.fleetEquipmentName,
          makerName: formData.maker,
          makerCode: formData.makerCode,
          model: formData.model,
          modelCode: formData.modelCode,
          sfiCode: formData.componentCategory,
        },
      });
    }
  };

  const handleDelete = () => {
    if (selectedNode?.data) {
      if (confirm("Are you sure you want to delete this component?")) {
        deleteMasterDataMutation.mutate(selectedNode.data.id);
      }
    }
  };

  const handleMakerChange = (makerName: string) => {
    setFormData(prev => ({ ...prev, maker: makerName }));
    const selectedMaker = makers.find(m => m.makerName === makerName);
    if (selectedMaker) {
      setFormData(prev => ({ ...prev, makerCode: selectedMaker.makerCode || "" }));
    }
  };

  const displayCode = isAddingNew ? newComponentCode : (selectedNode?.code || "");
  const displayName = isAddingNew 
    ? (formData.fleetEquipmentName || "XXX") 
    : (selectedNode?.name || "");

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-800">Add / Edit Fleet Component</h1>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="border-cyan-600 text-cyan-600 hover:bg-cyan-50"
              onClick={() => handleAddChild(selectedNode?.code || "6")}
              data-testid="btn-add-sub-equipment"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Sub Equipment
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/admin/master-data")}
              data-testid="btn-back"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-4 mt-4">
          <Select value={selectedVessel} onValueChange={setSelectedVessel}>
            <SelectTrigger className="w-40" data-testid="select-vessel">
              <SelectValue placeholder="Vessel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vessels</SelectItem>
              {vessels.map((vessel) => (
                <SelectItem key={vessel.id} value={vessel.id}>
                  {vessel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search Components.."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-components"
            />
          </div>
          
          <Select value={criticalityFilter} onValueChange={setCriticalityFilter}>
            <SelectTrigger className="w-36" data-testid="select-criticality">
              <SelectValue placeholder="Criticality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="non-critical">Non-Critical</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="icon"
            className="text-red-600 hover:bg-red-50"
            onClick={handleDelete}
            disabled={!selectedNode?.data}
            data-testid="btn-delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          
          <Button
            className="bg-cyan-600 hover:bg-cyan-700"
            onClick={handleSave}
            disabled={updateMasterDataMutation.isPending || createMasterDataMutation.isPending}
            data-testid="btn-save"
          >
            Save
          </Button>
        </div>
      </div>
      
      <div className="flex h-[calc(100vh-140px)]">
        <div className="w-96 bg-white border-r flex flex-col">
          <div className="bg-cyan-600 text-white px-4 py-3 font-semibold flex items-center">
            <ChevronDown className="h-4 w-4 mr-2" />
            COMPONENTS
          </div>
          <ScrollArea className="flex-1">
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
                    selectedCode={selectedNode?.code || null}
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
                  className="text-sm"
                  data-testid="input-new-component-code"
                />
              </div>
            )}
          </ScrollArea>
        </div>
        
        <div className="flex-1 overflow-auto p-6">
          {(selectedNode || isAddingNew) ? (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-600 mb-4">
                {displayCode} {displayName}
              </h2>
              
              <div className="border-t pt-4">
                <h3 className="text-cyan-600 font-medium mb-4">Fleet Component Information</h3>
                
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="text-blue-600 text-xs font-medium mb-1 block">Maker*</label>
                    <Select value={formData.maker} onValueChange={handleMakerChange}>
                      <SelectTrigger className="text-sm" data-testid="select-maker">
                        <SelectValue placeholder="Auto Update as per Maker Code" />
                      </SelectTrigger>
                      <SelectContent>
                        {makers.map((maker) => (
                          <SelectItem key={maker.id} value={maker.makerName}>
                            {maker.makerName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-blue-600 text-xs font-medium mb-1 block">Maker Code</label>
                    <Input
                      value={formData.makerCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, makerCode: e.target.value }))}
                      placeholder="As Per the Maker List"
                      className="text-sm"
                      data-testid="input-maker-code"
                    />
                  </div>
                  
                  <div>
                    <label className="text-blue-600 text-xs font-medium mb-1 block">Model</label>
                    <Input
                      value={formData.model}
                      onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                      placeholder="As Per Master Data"
                      className="text-sm"
                      data-testid="input-model"
                    />
                  </div>
                  
                  <div>
                    <label className="text-blue-600 text-xs font-medium mb-1 block">Model Code</label>
                    <Input
                      value={formData.modelCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, modelCode: e.target.value }))}
                      className="text-sm"
                      data-testid="input-model-code"
                    />
                  </div>
                  
                  <div>
                    <label className="text-blue-600 text-xs font-medium mb-1 block">Parent Code</label>
                    <Input
                      value={formData.parentCode}
                      readOnly
                      className="text-sm bg-gray-50"
                      data-testid="input-parent-code"
                    />
                  </div>
                  
                  <div>
                    <label className="text-blue-600 text-xs font-medium mb-1 block">Fleet Equipment Code</label>
                    <Input
                      value={isAddingNew ? newComponentCode : formData.fleetEquipmentCode}
                      readOnly={!isAddingNew}
                      onChange={(e) => isAddingNew && setNewComponentCode(e.target.value)}
                      className={`text-sm ${!isAddingNew ? "bg-gray-50" : ""}`}
                      data-testid="input-fleet-equipment-code"
                    />
                  </div>
                  
                  <div>
                    <label className="text-blue-600 text-xs font-medium mb-1 block">Location</label>
                    <Input
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      className="text-sm"
                      data-testid="input-location"
                    />
                  </div>
                  
                  <div>
                    <label className="text-blue-600 text-xs font-medium mb-1 block">Rating</label>
                    <Input
                      value={formData.rating}
                      onChange={(e) => setFormData(prev => ({ ...prev, rating: e.target.value }))}
                      className="text-sm"
                      data-testid="input-rating"
                    />
                  </div>
                  
                  <div>
                    <label className="text-blue-600 text-xs font-medium mb-1 block">Eqpt./ System Department</label>
                    <Input
                      value={formData.eqptSystemDept}
                      onChange={(e) => setFormData(prev => ({ ...prev, eqptSystemDept: e.target.value }))}
                      className="text-sm"
                      data-testid="input-dept"
                    />
                  </div>
                  
                  <div>
                    <label className="text-blue-600 text-xs font-medium mb-1 block">Component Category</label>
                    <Input
                      value={formData.componentCategory}
                      onChange={(e) => setFormData(prev => ({ ...prev, componentCategory: e.target.value }))}
                      className="text-sm"
                      data-testid="input-category"
                    />
                  </div>
                  
                  <div>
                    <label className="text-blue-600 text-xs font-medium mb-1 block">Notes</label>
                    <Input
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Notes"
                      className="text-sm bg-amber-50"
                      data-testid="input-notes"
                    />
                  </div>
                  
                  <div>
                    <label className="text-blue-600 text-xs font-medium mb-1 block">Fleet Equipment Name</label>
                    <Input
                      value={formData.fleetEquipmentName}
                      onChange={(e) => setFormData(prev => ({ ...prev, fleetEquipmentName: e.target.value }))}
                      className="text-sm"
                      data-testid="input-fleet-equipment-name"
                    />
                  </div>
                </div>
              </div>
            </div>
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
