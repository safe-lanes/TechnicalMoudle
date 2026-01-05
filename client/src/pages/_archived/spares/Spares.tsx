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
import { useVessels } from "@/hooks/useVessels";
import { useMarkers } from "@/contexts/MarkerContext";
import { Marker } from "@/components/Marker";
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
  const { data: vessels = [] } = useVessels();
  const { showMarkers } = useMarkers();
  
  const [activeTab, setActiveTab] = useState<"inventory" | "history">("inventory");
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [criticalityFilter, setCriticalityFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [isAddSpareModalOpen, setIsAddSpareModalOpen] = useState(false);
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [bulkUpdateData, setBulkUpdateData] = useState<{[key: number]: {consumed: number, received: number}}>({});
  const [placeReceived, setPlaceReceived] = useState("");
  const [dateReceived, setDateReceived] = useState("");
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  
  // Consume/Receive dialog state
  const [consumeDialogOpen, setConsumeDialogOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [selectedSpareForTransaction, setSelectedSpareForTransaction] = useState<Spare | null>(null);
  const [transactionQty, setTransactionQty] = useState<number>(1);
  const [transactionLocationId, setTransactionLocationId] = useState<string>("");
  const [transactionNotes, setTransactionNotes] = useState<string>("");
  const [workOrderRef, setWorkOrderRef] = useState<string>("");
  
  // Fetch spares from API with inventory data (uses spareComponentLinks for many-to-many support)
  const { data: sparesWithInventoryResponse, isLoading: sparesLoading } = useQuery<{success: boolean; data: any[]}>({
    queryKey: [`/technical/api/inventory/spares-with-inventory/${vesselId}`],
    enabled: !!vesselId,
  });
  const sparesData = useMemo(() => {
    const inventoryData = sparesWithInventoryResponse?.data || [];
    return inventoryData.map((item: any) => ({
      ...item.spare,
      robTotal: item.robTotal,
      stockStatus: item.stockStatus,
      locations: item.locations || [],
      linkedComponents: item.linkedComponents || [],
    }));
  }, [sparesWithInventoryResponse]);
  
  // Fetch inventory transactions for history tab
  const { data: inventoryTransactionsResponse, isLoading: transactionsLoading } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: [`/technical/api/inventory/transactions/${vesselId}`],
    enabled: activeTab === 'history' && !!vesselId,
  });
  const inventoryTransactions = inventoryTransactionsResponse?.data || [];

  // Fetch vessel locations for consume/receive dialogs
  const { data: locationsResponse } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: [`/technical/api/inventory/locations/${vesselId}`],
    enabled: !!vesselId,
  });
  const vesselLocations = locationsResponse?.data || [];
  
  // Inventory transaction mutation (uses proper location-based tracking)
  const inventoryTransactionMutation = useMutation({
    mutationFn: async (data: {
      spareId: number;
      locationId: number;
      eventType: 'RECEIVE' | 'CONSUME' | 'ADJUST_OPENING_BALANCE' | 'ADJUST_CORRECTION';
      qtyChange: number;
      referenceType: 'WORK_ORDER' | 'MANUAL' | 'EXCEL_IMPORT';
      referenceId?: string;
      referenceNote?: string;
    }) => {
      return apiRequest('POST', '/technical/api/inventory/transactions', {
        vesselId,
        ...data,
        userId: 'system', // Will be replaced with actual user when auth is implemented
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/technical/api/inventory/spares-with-inventory/${vesselId}`] });
      queryClient.invalidateQueries({ queryKey: [`/technical/api/inventory/transactions/${vesselId}`] });
      queryClient.invalidateQueries({ queryKey: [`/technical/api/inventory/locations/${vesselId}`] });
      setConsumeDialogOpen(false);
      setReceiveDialogOpen(false);
      setSelectedSpareForTransaction(null);
      setTransactionQty(1);
      setTransactionLocationId("");
      setTransactionNotes("");
      setWorkOrderRef("");
      toast({
        title: "Success",
        description: "Inventory transaction completed successfully",
      });
    },
    onError: (error: any) => {
      const errorMessage = error.message?.includes('INSUFFICIENT_STOCK')
        ? "Not enough stock at selected location"
        : error.message || "Failed to complete transaction";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Open consume dialog
  const openConsumeDialog = (spare: Spare) => {
    setSelectedSpareForTransaction(spare);
    setTransactionQty(1);
    setTransactionLocationId("");
    setTransactionNotes("");
    setWorkOrderRef("");
    setConsumeDialogOpen(true);
  };

  // Open receive dialog
  const openReceiveDialog = (spare: Spare) => {
    setSelectedSpareForTransaction(spare);
    setTransactionQty(1);
    setTransactionLocationId("");
    setTransactionNotes("");
    setReceiveDialogOpen(true);
  };

  // Handle consume transaction - WORK_ORDER reference is REQUIRED per design
  const handleConsumeSubmit = () => {
    if (!selectedSpareForTransaction || !transactionLocationId || transactionQty <= 0) {
      toast({
        title: "Error",
        description: "Please select a location and enter a valid quantity",
        variant: "destructive",
      });
      return;
    }
    if (!workOrderRef.trim()) {
      toast({
        title: "Work Order Required",
        description: "A work order reference is required for all consumption events to maintain audit trail",
        variant: "destructive",
      });
      return;
    }
    inventoryTransactionMutation.mutate({
      spareId: selectedSpareForTransaction.id,
      locationId: parseInt(transactionLocationId),
      eventType: 'CONSUME',
      qtyChange: -Math.abs(transactionQty), // Consume is always negative
      referenceType: 'WORK_ORDER', // Always WORK_ORDER for CONSUME
      referenceId: workOrderRef.trim(),
      referenceNote: transactionNotes || `Consumed for WO: ${workOrderRef.trim()}`,
    });
  };

  // Handle receive transaction
  const handleReceiveSubmit = () => {
    if (!selectedSpareForTransaction || !transactionLocationId || transactionQty <= 0) {
      toast({
        title: "Error",
        description: "Please select a location and enter a valid quantity",
        variant: "destructive",
      });
      return;
    }
    inventoryTransactionMutation.mutate({
      spareId: selectedSpareForTransaction.id,
      locationId: parseInt(transactionLocationId),
      eventType: 'RECEIVE',
      qtyChange: Math.abs(transactionQty), // Receive is always positive
      referenceType: 'MANUAL',
      referenceNote: transactionNotes || 'Manual receipt',
    });
  };
  
  // Legacy handleAdjustQuantity removed - now using location-based dialogs for proper tracking

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

    // Filter by selected component - uses linkedComponents for many-to-many support
    if (selectedComponentId) {
      filtered = filtered.filter(spare => {
        // Check linked components (many-to-many via spareComponentLinks)
        const linkedComponents = spare.linkedComponents || [];
        const isLinked = linkedComponents.some((lc: any) => 
          lc.componentCode === selectedComponentId || 
          lc.componentCode?.startsWith(selectedComponentId + '.')
        );
        // Fallback to legacy componentCode/componentId if no links
        if (!isLinked && linkedComponents.length === 0) {
          const spareCode = spare.componentCode || spare.componentId;
          return spareCode === selectedComponentId || spareCode?.startsWith(selectedComponentId + '.');
        }
        return isLinked;
      });
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
        await apiRequest('POST', `/technical/api/spares/${vesselId}/batch-consume`, {
          items: itemsToConsume,
          consumedBy: 'System'
        });
      }
      
      // Execute receive operations
      if (itemsToReceive.length > 0) {
        await apiRequest('POST', `/technical/api/spares/${vesselId}/batch-receive`, {
          items: itemsToReceive,
          receivedBy: 'System',
          purchaseOrderRef: `BULK-${new Date().toISOString().split('T')[0]}`
        });
      }
      
      // Invalidate cache to refresh data
      queryClient.invalidateQueries({ queryKey: [`/technical/api/inventory/spares-with-inventory/${vesselId}`] });
      
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

  const renderComponentTree = (nodes: ComponentNode[], level: number = 0, parentIndex: number = 0) => {
    return nodes.map((node, index) => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes.has(node.id);
      const isSelected = selectedComponentId === node.id;
      const isTopLevel = level === 0;
      const treeItemIndex = isTopLevel ? index + 1 : 0;

      return (
        <div key={node.id}>
          <div
            className={`flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 ${
              isSelected ? "bg-[#52baf3] text-white" : ""
            }`}
            style={{ paddingLeft: `${level * 20 + 12}px` }}
            onClick={() => {
              selectComponent(node.id);
              if (hasChildren) {
                toggleNode(node.id);
              }
            }}
            data-testid={isTopLevel && treeItemIndex <= 8 ? `E12.${treeItemIndex}` : undefined}
          >
            {isTopLevel && treeItemIndex <= 8 && <Marker id={`E12.${treeItemIndex}`} />}
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
            <div>{renderComponentTree(node.children!, level + 1, index)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="h-full p-6 bg-[#fafafa]">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-gray-800 mb-4" data-testid={activeTab === 'inventory' ? "E1" : "E3.1"}>
          {activeTab === 'inventory' ? <Marker id="E1" /> : <Marker id="E3.1" />}
          {activeTab === 'inventory' ? 'Spares Inventory' : 'Spares - History of Transactions'}
        </h1>
        
        {/* Navigation Tabs with Buttons */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex">
            <button 
              className={`px-4 py-2 rounded-l ${activeTab === 'inventory' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}
              onClick={() => setActiveTab('inventory')}
              data-testid="E2"
            >
              <Marker id="E2" />
              Inventory
            </button>
            <button 
              className={`px-4 py-2 rounded-r ${activeTab === 'history' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}
              onClick={() => setActiveTab('history')}
              data-testid={activeTab === 'history' ? "E3.3" : "E3"}
            >
              {activeTab === 'history' ? <Marker id="E3.3" /> : <Marker id="E3" />}
              History
            </button>
          </div>
          <div className="flex gap-2">
            <Button className="bg-[#52baf3] hover:bg-[#40a8e0] text-white" onClick={() => setIsAddSpareModalOpen(true)} data-testid={activeTab === 'inventory' ? "E10" : "E3.9"}>
              {activeTab === 'inventory' ? <Marker id="E10" /> : <Marker id="E3.9" />}
              + Add Spare
            </Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={openBulkUpdateModal} data-testid={activeTab === 'inventory' ? "E11" : "E3.10"}>
              {activeTab === 'inventory' ? <Marker id="E11" /> : <Marker id="E3.10" />}
              🔄 Bulk Update Spares
            </Button>
          </div>
        </div>
      </div>

      {/* Search and Filters - Single Row Layout */}
      <div className="flex gap-3 items-center mb-4">
        <div className="relative" data-testid={activeTab === 'inventory' ? "E4" : "E3.2"}>
          {activeTab === 'inventory' ? <Marker id="E4" /> : <Marker id="E3.2" />}
          <Select value={vesselId} onValueChange={setVesselId}>
            <SelectTrigger className="w-40" data-testid="select-vessel">
              <SelectValue placeholder="Select Vessel" />
            </SelectTrigger>
            <SelectContent>
              {vessels.map(vessel => (
                <SelectItem key={vessel.id} value={vessel.id}>
                  {vessel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative w-80" data-testid={activeTab === 'inventory' ? "E5" : "E3.4"}>
          {activeTab === 'inventory' ? <Marker id="E5" /> : <Marker id="E3.4" />}
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search parts or components.."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="relative" data-testid={activeTab === 'inventory' ? "E6" : "E3.5"}>
          {activeTab === 'inventory' ? <Marker id="E6" /> : <Marker id="E3.5" />}
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
        </div>

        <div className="relative" data-testid={activeTab === 'inventory' ? "E7" : "E3.6"}>
          {activeTab === 'inventory' ? <Marker id="E7" /> : <Marker id="E3.6" />}
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
        </div>

        <Button className="bg-green-600 hover:bg-green-700 text-white p-2" data-testid={activeTab === 'inventory' ? "E9" : "E3.8"}>
          {activeTab === 'inventory' ? <Marker id="E9" /> : <Marker id="E3.8" />}
          <FileSpreadsheet className="h-4 w-4" />
        </Button>

        <Button variant="outline" onClick={clearFilters} data-testid={activeTab === 'inventory' ? "E8" : "E3.7"}>
          {activeTab === 'inventory' ? <Marker id="E8" /> : <Marker id="E3.7" />}
          Clear
        </Button>
      </div>

      {activeTab === 'inventory' ? (
        <div className="flex gap-6 h-[calc(100vh-200px)]">
          {/* Left Panel - Component Tree */}
          <div className="w-[30%]">
            <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
              <div className="flex-1 overflow-auto">
                <div className="bg-[#52baf3] text-white px-4 py-2 font-semibold text-sm" data-testid="E12">
                  <Marker id="E12" />
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
                  <div data-testid="E13"><Marker id="E13" />Part Code</div>
                  <div data-testid="E14"><Marker id="E14" />Part Name</div>
                  <div data-testid="E15"><Marker id="E15" />Component Name</div>
                  <div data-testid="E17"><Marker id="E17" />Criticality</div>
                  <div data-testid="E18"><Marker id="E18" />ROB</div>
                  <div data-testid="E19"><Marker id="E19" />Min</div>
                  <div data-testid="E20"><Marker id="E20" />Stock</div>
                  <div data-testid="E21"><Marker id="E21" />Location A</div>
                  <div data-testid="E22"><Marker id="E22" />Location B</div>
                  <div data-testid="E23"><Marker id="E23" />Actions</div>
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
                  filteredSpares.map((spare, rowIndex) => {
                    const stockStatus = getStockStatus(spare.rob, spare.min);
                    const isCritical = spare.critical === "Critical" || spare.critical === "Yes";
                    const isFirstRow = rowIndex === 0;
                    
                    return (
                      <div key={spare.id} className="px-4 py-3" data-testid={isFirstRow ? "E24-row" : undefined}>
                        <div className="grid grid-cols-10 gap-4 text-sm items-center">
                          <div className="text-gray-900" data-testid={isFirstRow ? "E24" : undefined}>
                            {isFirstRow && <Marker id="E24" />}
                            {spare.partCode}
                          </div>
                          <div className="text-gray-900" data-testid={isFirstRow ? "E25" : undefined}>
                            {isFirstRow && <Marker id="E25" />}
                            {spare.partName}
                          </div>
                          <div className="text-gray-700" data-testid={isFirstRow ? "E26" : undefined}>
                            {isFirstRow && <Marker id="E26" />}
                            {spare.linkedComponents && spare.linkedComponents.length > 1 ? (
                              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">
                                Multi-linked ({spare.linkedComponents.length})
                              </span>
                            ) : spare.linkedComponents && spare.linkedComponents.length === 1 ? (
                              spare.linkedComponents[0].componentName || spare.linkedComponents[0].componentCode
                            ) : (
                              spare.componentName || '-'
                            )}
                          </div>
                          <div data-testid={isFirstRow ? "E28" : undefined}>
                            {isFirstRow && <Marker id="E28" />}
                            {isCritical && (
                              <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                                Critical
                              </span>
                            )}
                          </div>
                          <div className="text-gray-700 font-medium" data-testid={isFirstRow ? "E29" : undefined}>
                            {isFirstRow && <Marker id="E29" />}
                            {spare.robTotal !== undefined ? spare.robTotal : spare.rob}
                          </div>
                          <div className="text-gray-700" data-testid={isFirstRow ? "E30" : undefined}>
                            {isFirstRow && <Marker id="E30" />}
                            {spare.min}
                          </div>
                          <div data-testid={isFirstRow ? "E31" : undefined}>
                            {isFirstRow && <Marker id="E31" />}
                            {spare.stockStatus === "At Min" || stockStatus === "Low" ? (
                              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                                {spare.stockStatus === "At Min" ? "At Min" : "Low"}
                              </span>
                            ) : stockStatus === "Minimum" ? (
                              <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                                Min
                              </span>
                            ) : (
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                OK
                              </span>
                            )}
                          </div>
                          <div className="text-gray-700" data-testid={isFirstRow ? "E32" : undefined}>
                            {isFirstRow && <Marker id="E32" />}
                            {spare.locations && spare.locations.length > 0 ? (
                              <span title={spare.locations[0]?.locationName}>
                                {spare.locations[0]?.locationName?.substring(0, 6) || 'Loc A'}: {spare.locations[0]?.qty || 0}
                              </span>
                            ) : (
                              spare.location ? `${spare.location}: ${spare.robLocationA || 0}` : '-'
                            )}
                          </div>
                          <div className="text-gray-700" data-testid={isFirstRow ? "E33" : undefined}>
                            {isFirstRow && <Marker id="E33" />}
                            {spare.locations && spare.locations.length > 1 ? (
                              <span title={spare.locations[1]?.locationName}>
                                {spare.locations[1]?.locationName?.substring(0, 6) || 'Loc B'}: {spare.locations[1]?.qty || 0}
                              </span>
                            ) : spare.location2 ? (
                              `${spare.location2}: ${spare.robLocationB || 0}`
                            ) : '-'}
                          </div>
                          <div className="flex gap-1" data-testid={isFirstRow ? "E35" : undefined}>
                            {isFirstRow && <Marker id="E35" />}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 hover:bg-red-50"
                              onClick={() => openConsumeDialog(spare)}
                              disabled={spare.rob <= 0}
                              data-testid={`button-consume-${spare.id}`}
                              title="Consume from location"
                            >
                              <Minus className="h-4 w-4 text-red-600" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 hover:bg-green-50"
                              onClick={() => openReceiveDialog(spare)}
                              data-testid={isFirstRow ? "E36" : `button-receive-${spare.id}`}
                              title="Receive to location"
                            >
                              {isFirstRow && <Marker id="E36" />}
                              <Plus className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={isFirstRow ? "E34" : undefined}>
                              {isFirstRow && <Marker id="E34" />}
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
        // History View - Inventory Transactions
        <div className="flex gap-6 h-[calc(100vh-200px)]">
          {/* Left Panel - Component Tree */}
          <div className="w-[30%]">
            <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
              <div className="flex-1 overflow-auto">
                <div className="bg-[#52baf3] text-white px-4 py-2 font-semibold text-sm" data-testid="E3.11">
                  <Marker id="E3.11" />
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
              {/* Table Header - Extended columns per requirements */}
              <div className="bg-[#52baf3] text-white px-4 py-3 rounded-t-lg">
                <div className="grid grid-cols-9 gap-2 text-xs font-medium">
                  <div data-testid="E3.12"><Marker id="E3.12" />Date/Time</div>
                  <div data-testid="E3.13"><Marker id="E3.13" />Part Code</div>
                  <div data-testid="E3.14"><Marker id="E3.14" />Part Name</div>
                  <div data-testid="E3.15"><Marker id="E3.15" />Component</div>
                  <div data-testid="E3.16"><Marker id="E3.16" />Part Number</div>
                  <div data-testid="E3.17"><Marker id="E3.17" />Event</div>
                  <div className="text-center" data-testid="E3.17b"><Marker id="E3.17b" />Qty Change</div>
                  <div className="text-right" data-testid="E3.18"><Marker id="E3.18" />ROB After</div>
                  <div data-testid="E3.19"><Marker id="E3.19" />Reference</div>
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-200 max-h-[calc(100vh-350px)] overflow-auto">
                {transactionsLoading ? (
                  <div className="px-4 py-8 text-center text-gray-500">
                    <div className="animate-spin h-5 w-5 border-2 border-[#52baf3] border-t-transparent rounded-full mx-auto mb-2"></div>
                    Loading transactions...
                  </div>
                ) : inventoryTransactions.length > 0 ? (
                  inventoryTransactions.map((txn: any, txnIndex: number) => {
                    const isFirstTxn = txnIndex === 0;
                    return (
                      <div key={txn.id} className="px-4 py-3 hover:bg-gray-50" data-testid={`row-transaction-${txn.id}`}>
                        <div className="grid grid-cols-9 gap-2 text-xs items-center">
                          <div className="text-gray-900" data-testid={isFirstTxn ? "E3.20" : undefined}>
                            {isFirstTxn && <Marker id="E3.20" />}
                            {new Date(txn.txnDatetime).toLocaleString('en-GB', { 
                              day: '2-digit', 
                              month: 'short', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                          <div className="text-gray-900 font-medium" data-testid={isFirstTxn ? "E3.21" : undefined}>
                            {isFirstTxn && <Marker id="E3.21" />}
                            {txn.spare?.partCode || '-'}
                          </div>
                          <div className="text-gray-700" data-testid={isFirstTxn ? "E3.22" : undefined}>
                            {isFirstTxn && <Marker id="E3.22" />}
                            {txn.spare?.partName || '-'}
                          </div>
                          <div className="text-gray-700 truncate" data-testid={isFirstTxn ? "E3.23" : undefined}>
                            {isFirstTxn && <Marker id="E3.23" />}
                            {txn.spare?.linkedComponents && txn.spare.linkedComponents.length > 1 ? (
                              <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-medium">
                                Multi-linked
                              </span>
                            ) : txn.spare?.linkedComponents && txn.spare.linkedComponents.length === 1 ? (
                              txn.spare.linkedComponents[0].componentName || txn.spare.linkedComponents[0].componentCode
                            ) : (
                              txn.spare?.componentName || txn.locationName || '-'
                            )}
                          </div>
                          <div className="text-gray-700" data-testid={isFirstTxn ? "E3.24" : undefined}>
                            {isFirstTxn && <Marker id="E3.24" />}
                            {txn.spare?.partNumber || '-'}
                          </div>
                          <div data-testid={isFirstTxn ? "E3.25" : undefined}>
                            {isFirstTxn && <Marker id="E3.25" />}
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              txn.eventType === 'CONSUME' 
                                ? 'bg-red-100 text-red-800' 
                                : txn.eventType === 'RECEIVE'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {txn.eventType}
                            </span>
                          </div>
                          <div className={`text-center font-medium ${txn.qtyChange < 0 ? 'text-red-600' : 'text-green-600'}`} data-testid={isFirstTxn ? "E3.26" : undefined}>
                            {isFirstTxn && <Marker id="E3.26" />}
                            {txn.qtyChange > 0 ? '+' : ''}{txn.qtyChange}
                          </div>
                          <div className="text-right text-gray-900 font-medium" data-testid={isFirstTxn ? "E3.27" : undefined}>
                            {isFirstTxn && <Marker id="E3.27" />}
                            {txn.robTotalAfter}
                          </div>
                          <div className="text-gray-700 truncate" title={txn.referenceNote} data-testid={isFirstTxn ? "E3.28" : undefined}>
                            {isFirstTxn && <Marker id="E3.28" />}
                            {txn.referenceType === 'WORK_ORDER' ? (
                              <span className="text-blue-600">{txn.referenceNote || `WO-${txn.referenceId}`}</span>
                            ) : txn.referenceType === 'PO' ? (
                              <span className="text-purple-600">{txn.referenceNote || `PO-${txn.referenceId}`}</span>
                            ) : (
                              txn.referenceNote || '-'
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  // Show sample data when no real transactions
                  historyData.map((entry) => (
                    <div key={entry.id} className="px-4 py-3">
                      <div className="grid grid-cols-9 gap-2 text-xs items-center">
                        <div className="text-gray-900">{entry.date}</div>
                        <div className="text-gray-900">{entry.partName}</div>
                        <div>
                          <span className={`px-2 py-1 rounded text-xs ${
                            entry.type === 'Consumed' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {entry.type === 'Consumed' ? 'CONSUME' : 'RECEIVE'}
                          </span>
                        </div>
                        <div className={`text-center font-medium ${entry.type === 'Consumed' ? 'text-red-600' : 'text-green-600'}`}>
                          {entry.type === 'Consumed' ? '-' : '+'}{entry.qty}
                        </div>
                        <div className="text-gray-700">-</div>
                        <div className="text-right text-gray-600">-</div>
                        <div className="text-right text-gray-900">-</div>
                        <div className="text-gray-700">{entry.reference}</div>
                        <div className="text-gray-500">{entry.comment}</div>
                      </div>
                    </div>
                  ))
                )}
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
              <h2 className="text-xl font-semibold text-gray-800" data-testid="E10.1">
                <Marker id="E10.1" />
                Add Spares
              </h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsAddSpareModalOpen(false)}
                className="h-8 w-8 p-0 ml-[90px] mr-[90px]"
                data-testid="E10.6"
              >
                <Marker id="E10.6" />
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {/* Add Spare Button */}
              <div className="flex justify-end mb-4">
                <Button className="bg-[#52baf3] hover:bg-[#40a8e0] text-white text-sm" data-testid="E10.23">
                  <Marker id="E10.23" />
                  + Add Spare
                </Button>
              </div>

              {/* Table Headers - Labels for form fields */}
              <div className="grid grid-cols-12 gap-3 bg-gray-50 p-3 rounded-t text-sm font-medium text-gray-600 border">
                <div className="col-span-2" data-testid="E10.2"><Marker id="E10.2" />Part Code *</div>
                <div className="col-span-2" data-testid="E10.4"><Marker id="E10.4" />Part Name *</div>
                <div className="col-span-3" data-testid="E10.7"><Marker id="E10.7" />Linked Component *</div>
                <div className="col-span-1" data-testid="E10.11"><Marker id="E10.11" />ROB</div>
                <div className="col-span-1" data-testid="E10.13"><Marker id="E10.13" />Min Stock</div>
                <div className="col-span-1" data-testid="E10.9"><Marker id="E10.9" />Critical</div>
                <div className="col-span-2" data-testid="E10.15"><Marker id="E10.15" />Location</div>
              </div>

              {/* Form Rows */}
              <div className="border border-t-0 rounded-b">
                {/* Row 1 - First row with field markers */}
                <div className="grid grid-cols-12 gap-3 p-3 border-b bg-white items-center">
                  <div className="col-span-2 relative">
                    <Marker id="E10.3" />
                    <Input placeholder="e.g., SP-ME-001" className="text-sm" data-testid="E10.3" />
                  </div>
                  <div className="col-span-2 relative">
                    <Marker id="E10.5" />
                    <Input placeholder="e.g., Fuel Injector" className="text-sm" data-testid="E10.5" />
                  </div>
                  <div className="col-span-3 relative">
                    <Marker id="E10.8" />
                    <Select>
                      <SelectTrigger className="text-sm" data-testid="E10.8">
                        <SelectValue placeholder="Select a component" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="component1">Main Engine #1</SelectItem>
                        <SelectItem value="component2">Main Engine #2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="relative">
                    <Marker id="E10.12" />
                    <Input placeholder="0" className="text-sm" data-testid="E10.12" />
                  </div>
                  <div className="relative">
                    <Marker id="E10.14" />
                    <Input placeholder="0" className="text-sm" data-testid="E10.14" />
                  </div>
                  <div className="relative">
                    <Marker id="E10.10" />
                    <Select>
                      <SelectTrigger className="text-sm" data-testid="E10.10">
                        <SelectValue placeholder="No" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Y">Yes</SelectItem>
                        <SelectItem value="N">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 flex items-center gap-2 relative">
                    <Marker id="E10.16" />
                    <Input placeholder="e.g., Store Room A" className="text-sm flex-1" data-testid="E10.16" />
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
                data-testid="E10.22"
              >
                <Marker id="E10.22" />
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

      {/* Consume Dialog */}
      <Dialog open={consumeDialogOpen} onOpenChange={setConsumeDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="E.21.1">
          <Marker id="E.21.1" />
          <DialogHeader data-testid="E.21.2">
            <Marker id="E.21.2" />
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Minus className="h-5 w-5" />
              Consume Stock
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedSpareForTransaction && (
              <div className="bg-gray-50 p-3 rounded-lg space-y-1" data-testid="E.21.7">
                <Marker id="E.21.7" />
                <div className="text-sm font-medium text-gray-700">{selectedSpareForTransaction.partName}</div>
                <div className="text-xs text-gray-500">Part #: {selectedSpareForTransaction.partCode}</div>
                <div className="text-xs text-gray-500">Current ROB: {selectedSpareForTransaction.rob}</div>
              </div>
            )}
            
            <div className="space-y-2" data-testid="E.21.3">
              <Marker id="E.21.3" />
              <Label htmlFor="consume-location">Location *</Label>
              <Select value={transactionLocationId} onValueChange={setTransactionLocationId}>
                <SelectTrigger data-testid="select-consume-location">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {vesselLocations.length > 0 ? (
                    vesselLocations.map((loc: any) => (
                      <SelectItem key={loc.id} value={loc.id.toString()}>
                        {loc.locationName}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>No locations found</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2" data-testid="E.21.4">
              <Marker id="E.21.4" />
              <Label htmlFor="consume-qty">Quantity *</Label>
              <Input
                id="consume-qty"
                type="number"
                min="1"
                value={transactionQty}
                onChange={(e) => setTransactionQty(parseInt(e.target.value) || 0)}
                data-testid="input-consume-qty"
              />
            </div>

            <div className="space-y-2" data-testid="E.21.5">
              <Marker id="E.21.5" />
              <Label htmlFor="work-order-ref">Work Order Reference *</Label>
              <Input
                id="work-order-ref"
                placeholder="e.g., WO-2024-001"
                value={workOrderRef}
                onChange={(e) => setWorkOrderRef(e.target.value)}
                data-testid="input-work-order-ref"
                className={!workOrderRef.trim() ? "border-red-300" : ""}
              />
              <p className="text-xs text-red-500 font-medium">Required for audit trail compliance</p>
            </div>

            <div className="space-y-2" data-testid="E.21.6">
              <Marker id="E.21.6" />
              <Label htmlFor="consume-notes">Notes</Label>
              <Input
                id="consume-notes"
                placeholder="Optional notes"
                value={transactionNotes}
                onChange={(e) => setTransactionNotes(e.target.value)}
                data-testid="input-consume-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConsumeDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleConsumeSubmit}
              disabled={inventoryTransactionMutation.isPending || !transactionLocationId || transactionQty <= 0 || !workOrderRef.trim()}
              data-testid="E.21.8"
            >
              <Marker id="E.21.8" />
              {inventoryTransactionMutation.isPending ? "Processing..." : "Consume"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Dialog */}
      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-green-600 flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Receive Stock
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedSpareForTransaction && (
              <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                <div className="text-sm font-medium text-gray-700">{selectedSpareForTransaction.partName}</div>
                <div className="text-xs text-gray-500">Part #: {selectedSpareForTransaction.partCode}</div>
                <div className="text-xs text-gray-500">Current ROB: {selectedSpareForTransaction.rob}</div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="receive-location">Location *</Label>
              <Select value={transactionLocationId} onValueChange={setTransactionLocationId}>
                <SelectTrigger data-testid="select-receive-location">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {vesselLocations.length > 0 ? (
                    vesselLocations.map((loc: any) => (
                      <SelectItem key={loc.id} value={loc.id.toString()}>
                        {loc.locationName}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>No locations found</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="receive-qty">Quantity *</Label>
              <Input
                id="receive-qty"
                type="number"
                min="1"
                value={transactionQty}
                onChange={(e) => setTransactionQty(parseInt(e.target.value) || 0)}
                data-testid="input-receive-qty"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="receive-notes">Notes</Label>
              <Input
                id="receive-notes"
                placeholder="e.g., PO-2024-001 shipment received"
                value={transactionNotes}
                onChange={(e) => setTransactionNotes(e.target.value)}
                data-testid="input-receive-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleReceiveSubmit}
              disabled={inventoryTransactionMutation.isPending || !transactionLocationId || transactionQty <= 0}
              data-testid="button-confirm-receive"
            >
              {inventoryTransactionMutation.isPending ? "Processing..." : "Receive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Spares;