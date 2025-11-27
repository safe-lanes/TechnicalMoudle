import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronRight, ChevronDown, Edit, Clock, Trash2, Plus, FileSpreadsheet, X, MessageSquare, Calendar, Minus } from "lucide-react";
import { ComponentNode, componentTree } from "@/data/componentTree";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useVessel } from "@/contexts/VesselContext";
import { VESSELS } from "@/lib/vessels";
import type { Spare } from "@shared/schema";

// Component tree is now imported from shared data

const sparesDataOld = [
  {
    id: 1,
    partCode: "SP-ME-001",
    partName: "Fuel Injector",
    component: "Main Engine #1 (Wartsila 8L46F)",
    critical: "Yes",
    rob: 2,
    min: 1,
    stock: "OK",
    location: "Store Room A",
    componentId: "6.01.001"
  },
  {
    id: 2,
    partCode: "SP-ME-002",
    partName: "Cylinder Head Gasket",
    component: "Main Engine #1 (Wartsila 8L46F)",
    critical: "No",
    rob: 2,
    min: 1,
    stock: "",
    location: "Store Room B",
    componentId: "6.01.001"
  },
  {
    id: 3,
    partCode: "SP-ME-003",
    partName: "Piston Ring Set",
    component: "Main Engine #1 (Wartsila 8L46F)",
    critical: "No",
    rob: 3,
    min: 1,
    stock: "",
    location: "Store Room B",
    componentId: "6.01.001"
  },
  {
    id: 4,
    partCode: "SP-ME-004",
    partName: "Main Bearing",
    component: "Main Engine Cooling System",
    critical: "No",
    rob: 4,
    min: 2,
    stock: "",
    location: "Store Room C",
    componentId: "6"
  },
  {
    id: 5,
    partCode: "SP-COOL-001",
    partName: "Cooling Pump Seal",
    component: "Main Engine Cooling System",
    critical: "Critical",
    rob: 4,
    min: 2,
    stock: "",
    location: "Store Room D",
    componentId: "6"
  },
  {
    id: 6,
    partCode: "SP-ME-001",
    partName: "Fuel Injector",
    component: "Main Engine #1 (Wartsila 8L46F)",
    critical: "No",
    rob: 1,
    min: 2,
    stock: "Low",
    location: "Store Room A",
    componentId: "6.01.001"
  },
  {
    id: 7,
    partCode: "SP-ME-002",
    partName: "Cylinder Head Gasket",
    component: "Main Engine #1 (Wartsila 8L46F)",
    critical: "No",
    rob: 2,
    min: 1,
    stock: "",
    location: "Store Room B",
    componentId: "6.01.001"
  },
  {
    id: 8,
    partCode: "SP-ME-003",
    partName: "Piston Ring Set",
    component: "Main Engine #1 (Wartsila 8L46F)",
    critical: "No",
    rob: 2,
    min: 1,
    stock: "",
    location: "Store Room B",
    componentId: "6.01.001"
  },
  {
    id: 9,
    partCode: "SP-ME-004",
    partName: "Main Bearing",
    component: "Main Engine #1 (Wartsila 8L46F)",
    critical: "No",
    rob: 3,
    min: 1,
    stock: "",
    location: "Store Room C",
    componentId: "6.01.001"
  },
  {
    id: 10,
    partCode: "SP-COOL-001",
    partName: "Cooling Pump Seal",
    component: "Main Engine Cooling System",
    critical: "No",
    rob: 4,
    min: 2,
    stock: "",
    location: "Store Room D",
    componentId: "6"
  },
  {
    id: 11,
    partCode: "SP-ME-001",
    partName: "Fuel Injector",
    component: "Main Engine #1 (Wartsila 8L46F)",
    critical: "Critical",
    rob: 6,
    min: 2,
    stock: "",
    location: "Store Room A",
    componentId: "6.01.001"
  },
  {
    id: 12,
    partCode: "SP-ME-002",
    partName: "Cylinder Head Gasket",
    component: "Main Engine #1 (Wartsila 8L46F)",
    critical: "No",
    rob: 2,
    min: 10,
    stock: "Low",
    location: "Store Room B",
    componentId: "6.01.001"
  },
  // Sample data for 601.002 ME cylinder covers w/ valves
  {
    id: 13,
    partCode: "SP-CC-001",
    partName: "Cylinder Cover Assembly",
    component: "ME cylinder covers w/ valves",
    critical: "Critical",
    rob: 2,
    min: 1,
    stock: "OK",
    location: "Store Room A",
    componentId: "6.1.1.2"
  },
  {
    id: 14,
    partCode: "SP-CC-002",
    partName: "Inlet Valve",
    component: "ME cylinder covers w/ valves",
    critical: "Critical",
    rob: 4,
    min: 2,
    stock: "OK",
    location: "Store Room A",
    componentId: "6.1.1.2"
  },
  {
    id: 15,
    partCode: "SP-CC-003",
    partName: "Exhaust Valve",
    component: "ME cylinder covers w/ valves",
    critical: "Critical",
    rob: 4,
    min: 2,
    stock: "OK",
    location: "Store Room A",
    componentId: "6.1.1.2"
  },
  {
    id: 16,
    partCode: "SP-CC-004",
    partName: "Valve Spring",
    component: "ME cylinder covers w/ valves",
    critical: "No",
    rob: 8,
    min: 4,
    stock: "OK",
    location: "Store Room B",
    componentId: "6.1.1.2"
  },
  {
    id: 17,
    partCode: "SP-CC-005",
    partName: "Valve Guide",
    component: "ME cylinder covers w/ valves",
    critical: "No",
    rob: 6,
    min: 2,
    stock: "OK",
    location: "Store Room B",
    componentId: "6.1.1.2"
  },
  {
    id: 18,
    partCode: "SP-CC-006",
    partName: "Valve Seat Ring",
    component: "ME cylinder covers w/ valves",
    critical: "Critical",
    rob: 3,
    min: 2,
    stock: "OK",
    location: "Store Room A",
    componentId: "6.1.1.2"
  },
  {
    id: 19,
    partCode: "SP-CC-007",
    partName: "Cover Gasket Set",
    component: "ME cylinder covers w/ valves",
    critical: "No",
    rob: 1,
    min: 2,
    stock: "Low",
    location: "Store Room C",
    componentId: "6.1.1.2"
  },
  {
    id: 20,
    partCode: "SP-CC-008",
    partName: "Valve Spindle",
    component: "ME cylinder covers w/ valves",
    critical: "Critical",
    rob: 2,
    min: 1,
    stock: "OK",
    location: "Store Room A",
    componentId: "6.1.1.2"
  },
  {
    id: 21,
    partCode: "SP-CC-009",
    partName: "Cooling Water Nozzle",
    component: "ME cylinder covers w/ valves",
    critical: "No",
    rob: 5,
    min: 2,
    stock: "OK",
    location: "Store Room B",
    componentId: "6.1.1.2"
  },
  {
    id: 22,
    partCode: "SP-CC-010",
    partName: "Cover Bolt Set",
    component: "ME cylinder covers w/ valves",
    critical: "No",
    rob: 3,
    min: 1,
    stock: "OK",
    location: "Store Room C",
    componentId: "6.1.1.2"
  }
];

const historyData = [
  {
    id: 1,
    date: "02-Jun-2025",
    partName: "Fuel Injector",
    type: "Consumed",
    qty: 1,
    reference: "WO-2025-03",
    comment: "Used for Main Engine Overhaul"
  },
  {
    id: 2,
    date: "09-Jun-2025",
    partName: "Cylinder Head Gasket",
    type: "Received",
    qty: 2,
    reference: "WO-2025-17",
    comment: "Delivery from Singapore"
  },
  {
    id: 3,
    date: "16-Jun-2025",
    partName: "Piston Ring Set",
    type: "Consumed",
    qty: 2,
    reference: "WO-2025-34",
    comment: "Routine Maintenance"
  },
  {
    id: 4,
    date: "23-Jun-2025",
    partName: "Main Bearing",
    type: "Consumed",
    qty: 3,
    reference: "WO-2025-19",
    comment: "Main Engine Cylinder #3 repair"
  },
  {
    id: 5,
    date: "30-Jun-2025",
    partName: "Cooling Pump Seal",
    type: "Consumed",
    qty: 4,
    reference: "WO-2025-03",
    comment: "Routine Maintenance"
  },
  {
    id: 6,
    date: "02-Jun-2025",
    partName: "Fuel Injector",
    type: "Consumed",
    qty: 6,
    reference: "WO-2025-17",
    comment: "Routine Maintenance"
  },
  {
    id: 7,
    date: "09-Jun-2025",
    partName: "Cylinder Head Gasket",
    type: "Consumed",
    qty: 2,
    reference: "WO-2025-34",
    comment: "Routine Maintenance"
  }
];

const Spares: React.FC = () => {
  const { toast } = useToast();
  const { vesselId, setVesselId } = useVessel();
  
  const [activeTab, setActiveTab] = useState<"inventory" | "history">("inventory");
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(["6", "6.1", "6.1.1"]));
  const [searchTerm, setSearchTerm] = useState("");
  const [criticalityFilter, setCriticalityFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [isAddSpareModalOpen, setIsAddSpareModalOpen] = useState(false);
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [bulkUpdateData, setBulkUpdateData] = useState<{[key: number]: {consumed: number, received: number}}>({});
  const [placeReceived, setPlaceReceived] = useState("");
  const [dateReceived, setDateReceived] = useState("");
  const [adjustingSpares, setAdjustingSpares] = useState<Set<number>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  
  // Fetch spares from API
  const { data: sparesData = [], isLoading: sparesLoading } = useQuery<Spare[]>({
    queryKey: ['/api/spares', vesselId],
  });
  
  // Adjust spare quantity mutation
  const adjustMutation = useMutation({
    mutationFn: async ({ spareId, qtyChange, eventType, notes }: {
      spareId: number;
      qtyChange: number;
      eventType: 'CONSUME' | 'RECEIVE' | 'ADJUST';
      notes?: string;
    }) => {
      return apiRequest('POST', `/api/spares/${vesselId}/${spareId}/adjust`, {
        qtyChange,
        eventType,
        notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/spares', vesselId] });
      toast({
        title: "Success",
        description: "Spare quantity updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update spare quantity",
        variant: "destructive",
      });
    },
  });
  
  const handleAdjustQuantity = async (spareId: number, qtyChange: number, eventType: 'CONSUME' | 'RECEIVE') => {
    setAdjustingSpares(prev => new Set(prev).add(spareId));
    try {
      await adjustMutation.mutateAsync({
        spareId,
        qtyChange,
        eventType,
        notes: 'Manual adjustment',
      });
    } finally {
      setAdjustingSpares(prev => {
        const next = new Set(prev);
        next.delete(spareId);
        return next;
      });
    }
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  // Select component from tree
  const selectComponent = (componentId: string) => {
    setSelectedComponentId(componentId);
  };

  // Calculate stock status
  const getStockStatus = (rob: number, min: number): string => {
    if (rob === min) return "Minimum";
    if (rob < min) return "Low";
    if (rob > min) return "OK";
    return "";
  };

  // Filter spares based on all criteria
  const filteredSpares = useMemo(() => {
    let filtered = sparesData;

    // Filter by selected component
    if (selectedComponentId) {
      filtered = filtered.filter(spare => spare.componentId === selectedComponentId);
    }

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(spare => 
        spare.partCode.toLowerCase().includes(search) ||
        spare.partName.toLowerCase().includes(search) ||
        (spare.componentName || '').toLowerCase().includes(search)
      );
    }

    // Filter by criticality
    if (criticalityFilter && criticalityFilter !== "All") {
      if (criticalityFilter === "Critical") {
        filtered = filtered.filter(spare => spare.critical === "Critical" || spare.critical === "Yes");
      } else if (criticalityFilter === "Non-Critical") {
        filtered = filtered.filter(spare => spare.critical !== "Critical" && spare.critical !== "Yes");
      }
    }

    // Filter by stock status
    if (stockFilter && stockFilter !== "All") {
      filtered = filtered.filter(spare => {
        const stockStatus = getStockStatus(spare.rob, spare.min);
        return stockStatus === stockFilter;
      });
    }

    return filtered;
  }, [sparesData, selectedComponentId, searchTerm, criticalityFilter, stockFilter]);

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setCriticalityFilter("");
    setStockFilter("");
    setSelectedComponentId(null);
  };

  // Handle bulk update modal
  const openBulkUpdateModal = () => {
    if (!selectedComponentId) {
      alert("Please select a component from the search or component tree first.");
      return;
    }
    setIsBulkUpdateModalOpen(true);
    // Initialize bulk update data
    const initialData: {[key: number]: {consumed: number, received: number}} = {};
    filteredSpares.forEach(spare => {
      initialData[spare.id] = { consumed: 0, received: 0 };
    });
    setBulkUpdateData(initialData);
  };

  // Handle bulk update input changes
  const handleBulkUpdateChange = (spareId: number, field: 'consumed' | 'received', value: string) => {
    const numValue = parseInt(value) || 0;
    setBulkUpdateData(prev => ({
      ...prev,
      [spareId]: {
        ...prev[spareId],
        [field]: numValue
      }
    }));
  };

  // Save bulk updates - persist to backend
  const saveBulkUpdates = async () => {
    setIsBulkUpdating(true);
    
    try {
      // Collect items to consume
      const itemsToConsume = Object.entries(bulkUpdateData)
        .filter(([_, data]) => data.consumed > 0)
        .map(([spareId, data]) => ({
          spareId: parseInt(spareId),
          quantity: data.consumed,
          notes: `Bulk consumption on ${dateReceived || new Date().toISOString().split('T')[0]}`
        }));
      
      // Collect items to receive
      const itemsToReceive = Object.entries(bulkUpdateData)
        .filter(([_, data]) => data.received > 0)
        .map(([spareId, data]) => ({
          spareId: parseInt(spareId),
          quantity: data.received,
          notes: `Bulk receipt at ${placeReceived || 'Unknown location'} on ${dateReceived || new Date().toISOString().split('T')[0]}`
        }));
      
      // Execute consume operations
      if (itemsToConsume.length > 0) {
        await apiRequest('POST', `/api/spares/${vesselId}/batch-consume`, {
          items: itemsToConsume,
          consumedBy: 'System'
        });
      }
      
      // Execute receive operations
      if (itemsToReceive.length > 0) {
        await apiRequest('POST', `/api/spares/${vesselId}/batch-receive`, {
          items: itemsToReceive,
          receivedBy: 'System',
          purchaseOrderRef: `BULK-${new Date().toISOString().split('T')[0]}`
        });
      }
      
      // Invalidate cache to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/spares', vesselId] });
      
      toast({
        title: "Success",
        description: `Bulk update completed: ${itemsToConsume.length} consumed, ${itemsToReceive.length} received`,
      });
      
      setIsBulkUpdateModalOpen(false);
      setBulkUpdateData({});
      setPlaceReceived("");
      setDateReceived("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save bulk updates",
        variant: "destructive",
      });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const renderComponentTree = (nodes: ComponentNode[], level: number = 0) => {
    return nodes.map((node) => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes.has(node.id);
      const isSelected = selectedComponentId === node.id;

      return (
        <div key={node.id}>
          <div
            className={`flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 ${
              isSelected ? "bg-[#52baf3] text-white" : ""
            }`}
            style={{ paddingLeft: `${level * 20 + 12}px` }}
            onClick={() => selectComponent(node.id)}
          >
            <button
              className="mr-2 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                if (hasChildren) {
                  toggleNode(node.id);
                }
              }}
            >
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className={`h-4 w-4 ${isSelected ? "text-white" : "text-gray-600"}`} />
                ) : (
                  <ChevronRight className={`h-4 w-4 ${isSelected ? "text-white" : "text-gray-600"}`} />
                )
              ) : (
                <ChevronRight className={`h-4 w-4 ${isSelected ? "text-white" : "text-gray-400"}`} />
              )}
            </button>
            <span className={`text-sm ${isSelected ? "text-white" : "text-gray-700"}`}>
              {node.code}. {node.name}
            </span>
          </div>
          {hasChildren && isExpanded && (
            <div>{renderComponentTree(node.children!, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="h-full p-6 bg-[#fafafa]">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-gray-800 mb-4">
          {activeTab === 'inventory' ? 'Spares Inventory' : 'Spares - History of Transactions'}
        </h1>
        
        {/* Navigation Tabs with Buttons */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex">
            <button 
              className={`px-4 py-2 rounded-l ${activeTab === 'inventory' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}
              onClick={() => setActiveTab('inventory')}
            >
              Inventory
            </button>
            <button 
              className={`px-4 py-2 rounded-r ${activeTab === 'history' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}
              onClick={() => setActiveTab('history')}
            >
              History
            </button>
          </div>
          <div className="flex gap-2">
            <Button className="bg-[#52baf3] hover:bg-[#40a8e0] text-white" onClick={() => setIsAddSpareModalOpen(true)}>+ Add Spare</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={openBulkUpdateModal}>🔄 Bulk Update Spares</Button>
          </div>
        </div>
      </div>

      {/* Search and Filters - Single Row Layout */}
      <div className="flex gap-3 items-center mb-4">
        <Select value={vesselId} onValueChange={setVesselId}>
          <SelectTrigger className="w-40" data-testid="select-vessel">
            <SelectValue placeholder="Select Vessel" />
          </SelectTrigger>
          <SelectContent>
            {VESSELS.map(vessel => (
              <SelectItem key={vessel.id} value={vessel.id}>
                {vessel.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search parts or components.."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={criticalityFilter} onValueChange={setCriticalityFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Criticality" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="Critical">Critical</SelectItem>
            <SelectItem value="Non-Critical">Non-Critical</SelectItem>
          </SelectContent>
        </Select>

        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Stock" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="Minimum">Minimum</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="OK">OK</SelectItem>
          </SelectContent>
        </Select>

        <Button className="bg-green-600 hover:bg-green-700 text-white p-2">
          <FileSpreadsheet className="h-4 w-4" />
        </Button>

        <Button variant="outline" onClick={clearFilters}>
          Clear
        </Button>
      </div>

      {activeTab === 'inventory' ? (
        <div className="flex gap-6 h-[calc(100vh-200px)]">
          {/* Left Panel - Component Tree */}
          <div className="w-[30%]">
            <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
              <div className="flex-1 overflow-auto">
                <div className="bg-[#52baf3] text-white px-4 py-2 font-semibold text-sm">
                  COMPONENTS
                </div>
                <div>
                  {renderComponentTree(componentTree)}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Spares Table */}
          <div className="w-[70%]">
            {/* Spares Table */}
            <div className="bg-white rounded-lg shadow-sm border">
              {/* Table Header */}
              <div className="bg-[#52baf3] text-white px-4 py-3 rounded-t-lg">
                <div className="grid grid-cols-10 gap-4 text-sm font-medium">
                  <div>Part Code</div>
                  <div>Part Name</div>
                  <div>Component</div>
                  <div>Critical</div>
                  <div>ROB</div>
                  <div>Min</div>
                  <div>Stock</div>
                  <div>Location A</div>
                  <div>Location B</div>
                  <div>Actions</div>
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-200">
                {sparesLoading ? (
                  <div className="px-4 py-8 text-center text-gray-500">
                    Loading spares...
                  </div>
                ) : filteredSpares.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500">
                    No spares found
                  </div>
                ) : (
                  filteredSpares.map((spare) => {
                    const stockStatus = getStockStatus(spare.rob, spare.min);
                    const isCritical = spare.critical === "Critical" || spare.critical === "Yes";
                    const isAdjusting = adjustingSpares.has(spare.id);
                    
                    return (
                      <div key={spare.id} className="px-4 py-3">
                        <div className="grid grid-cols-10 gap-4 text-sm items-center">
                          <div className="text-gray-900">{spare.partCode}</div>
                          <div className="text-gray-900">{spare.partName}</div>
                          <div className="text-gray-700">{spare.componentName || '-'}</div>
                          <div>
                            {isCritical && (
                              <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                                Critical
                              </span>
                            )}
                          </div>
                          <div className="text-gray-700">{spare.rob}</div>
                          <div className="text-gray-700">{spare.min}</div>
                          <div>
                            {stockStatus === "Low" && (
                              <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                                Low
                              </span>
                            )}
                            {stockStatus === "Minimum" && (
                              <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                                Min
                              </span>
                            )}
                            {stockStatus === "OK" && (
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                OK
                              </span>
                            )}
                          </div>
                          <div className="text-gray-700">{spare.location || '-'}</div>
                          <div className="text-gray-700">{spare.location2 || '-'}</div>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => handleAdjustQuantity(spare.id, -1, 'CONSUME')}
                              disabled={isAdjusting || spare.rob <= 0}
                              data-testid={`button-decrease-${spare.id}`}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => handleAdjustQuantity(spare.id, 1, 'RECEIVE')}
                              disabled={isAdjusting}
                              data-testid={`button-increase-${spare.id}`}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // History View
        <div className="flex gap-6 h-[calc(100vh-200px)]">
          {/* Left Panel - Component Tree */}
          <div className="w-[30%]">
            <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
              <div className="flex-1 overflow-auto">
                <div className="bg-[#52baf3] text-white px-4 py-2 font-semibold text-sm">
                  COMPONENTS
                </div>
                <div>
                  {renderComponentTree(componentTree)}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - History Table */}
          <div className="w-[70%]">
            {/* History Table */}
            <div className="bg-white rounded-lg shadow-sm border">
              {/* Table Header */}
              <div className="bg-[#52baf3] text-white px-4 py-3 rounded-t-lg">
                <div className="grid grid-cols-6 gap-4 text-sm font-medium">
                  <div>Date</div>
                  <div>Part Name</div>
                  <div>Type</div>
                  <div>Qty</div>
                  <div>Reference</div>
                  <div>Comment</div>
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-200">
                {historyData.map((entry) => (
                  <div key={entry.id} className="px-4 py-3">
                    <div className="grid grid-cols-6 gap-4 text-sm items-center">
                      <div className="text-gray-900">{entry.date}</div>
                      <div className="text-gray-900">{entry.partName}</div>
                      <div>
                        <span className={`px-2 py-1 rounded text-xs ${
                          entry.type === 'Consumed' 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {entry.type}
                        </span>
                      </div>
                      <div className="text-gray-700">{entry.qty}</div>
                      <div className="text-gray-700">{entry.reference}</div>
                      <div className="text-gray-700">{entry.comment}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Spares Modal */}
      {isAddSpareModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-[95%] max-w-7xl max-h-[90vh] overflow-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold text-gray-800">Add Spares</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsAddSpareModalOpen(false)}
                className="h-8 w-8 p-0 ml-[90px] mr-[90px]"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {/* Add Spare Button */}
              <div className="flex justify-end mb-4">
                <Button className="bg-[#52baf3] hover:bg-[#40a8e0] text-white text-sm">
                  + Add Spare
                </Button>
              </div>

              {/* Table Headers */}
              <div className="grid grid-cols-12 gap-3 bg-gray-50 p-3 rounded-t text-sm font-medium text-gray-600 border">
                <div className="col-span-2">Part Code</div>
                <div className="col-span-2">Part Name</div>
                <div className="col-span-3">Linked Component</div>
                <div className="col-span-1">Qty</div>
                <div className="col-span-1">Min Qty</div>
                <div className="col-span-1">Critical</div>
                <div className="col-span-2">Location</div>
              </div>

              {/* Form Rows */}
              <div className="border border-t-0 rounded-b">
                {/* Row 1 */}
                <div className="grid grid-cols-12 gap-3 p-3 border-b bg-white items-center">
                  <div className="col-span-2">
                    <Input placeholder="SP-ME-001" className="text-sm" />
                  </div>
                  <div className="col-span-2">
                    <Input placeholder="Fuel Injector" className="text-sm" />
                  </div>
                  <div className="col-span-3">
                    <Select>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Search Component" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="component1">Main Engine #1</SelectItem>
                        <SelectItem value="component2">Main Engine #2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input placeholder="1" className="text-sm" />
                  <Input placeholder="1" className="text-sm" />
                  <Select>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Y" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Y">Y</SelectItem>
                      <SelectItem value="N">N</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="col-span-2 flex items-center gap-2">
                    <Input placeholder="Store Room A" className="text-sm flex-1" />
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Row 2 - Empty */}
                <div className="grid grid-cols-12 gap-3 p-3 border-b bg-white items-center">
                  <div className="col-span-2">
                    <Input className="text-sm" />
                  </div>
                  <div className="col-span-2">
                    <Input className="text-sm" />
                  </div>
                  <div className="col-span-3">
                    <Select>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Search Component" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="component1">Main Engine #1</SelectItem>
                        <SelectItem value="component2">Main Engine #2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input className="text-sm" />
                  <Input className="text-sm" />
                  <Select>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Y" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Y">Y</SelectItem>
                      <SelectItem value="N">N</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="col-span-2 flex items-center gap-2">
                    <Input className="text-sm flex-1" />
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Row 3 - Empty */}
                <div className="grid grid-cols-12 gap-3 p-3 bg-white items-center">
                  <div className="col-span-2">
                    <Input className="text-sm" />
                  </div>
                  <div className="col-span-2">
                    <Input className="text-sm" />
                  </div>
                  <div className="col-span-3">
                    <Select>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Search Component" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="component1">Main Engine #1</SelectItem>
                        <SelectItem value="component2">Main Engine #2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input className="text-sm" />
                  <Input className="text-sm" />
                  <Select>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Y" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Y">Y</SelectItem>
                      <SelectItem value="N">N</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="col-span-2 flex items-center gap-2">
                    <Input className="text-sm flex-1" />
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <Button 
                variant="outline" 
                onClick={() => setIsAddSpareModalOpen(false)}
              >
                Cancel
              </Button>
              <Button className="bg-[#52baf3] hover:bg-[#40a8e0] text-white">
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Update Spares Modal */}
      {isBulkUpdateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-[95%] max-w-7xl max-h-[90vh] overflow-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold text-gray-800">Bulk Update Spares</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsBulkUpdateModalOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {/* Place Received and Date Fields */}
              <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded border">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Place Received</label>
                  <Input 
                    placeholder="Enter place received" 
                    value={placeReceived}
                    onChange={(e) => setPlaceReceived(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                  <div className="relative">
                    <Input 
                      type="date" 
                      value={dateReceived}
                      onChange={(e) => setDateReceived(e.target.value)}
                      className="text-sm pr-10"
                    />
                    <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Table Headers */}
              <div className="grid grid-cols-8 gap-3 bg-gray-50 p-3 rounded-t text-sm font-medium text-gray-600 border">
                <div>Part Code</div>
                <div>Part Name</div>
                <div>Component</div>
                <div>ROB</div>
                <div>Consumed</div>
                <div>Received</div>
                <div>New ROB</div>
                <div>Comments</div>
              </div>

              {/* Table Body */}
              <div className="border border-t-0 rounded-b max-h-[400px] overflow-y-auto">
                {filteredSpares.map((spare) => {
                  const consumed = bulkUpdateData[spare.id]?.consumed || 0;
                  const received = bulkUpdateData[spare.id]?.received || 0;
                  const newRob = spare.rob - consumed + received;
                  
                  return (
                    <div key={spare.id} className="grid grid-cols-8 gap-3 p-3 border-b bg-white items-center">
                      <div className="text-gray-900 text-sm">{spare.partCode}</div>
                      <div className="text-gray-900 text-sm">{spare.partName}</div>
                      <div className="text-gray-700 text-sm">{spare.componentName || '-'}</div>
                      <div className="text-gray-700 text-sm">{spare.rob}</div>
                      <div>
                        <Input 
                          type="number" 
                          min="0" 
                          className="text-sm h-8" 
                          placeholder="0"
                          value={consumed || ''}
                          onChange={(e) => handleBulkUpdateChange(spare.id, 'consumed', e.target.value)}
                        />
                      </div>
                      <div>
                        <Input 
                          type="number" 
                          min="0" 
                          className="text-sm h-8" 
                          placeholder="0"
                          value={received || ''}
                          onChange={(e) => handleBulkUpdateChange(spare.id, 'received', e.target.value)}
                        />
                      </div>
                      <div className={`text-sm font-medium ${newRob < spare.min ? 'text-red-600' : 'text-gray-900'}`}>
                        {newRob}
                      </div>
                      <div className="flex justify-center">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            const comment = prompt(`Add comment for ${spare.partName}:`);
                            if (comment) {
                              console.log(`Comment for ${spare.partName}: ${comment}`);
                            }
                          }}
                        >
                          <MessageSquare className="h-4 w-4 text-gray-500" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <Button 
                variant="outline" 
                onClick={() => setIsBulkUpdateModalOpen(false)}
                disabled={isBulkUpdating}
              >
                Cancel
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={saveBulkUpdates}
                disabled={isBulkUpdating}
                data-testid="button-save-bulk-updates"
              >
                {isBulkUpdating ? "Saving..." : "Save Updates"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Spares;