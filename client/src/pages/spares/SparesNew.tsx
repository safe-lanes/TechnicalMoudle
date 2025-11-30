import React, { useState, useMemo, useEffect, useRef } from "react";
import { useVessel } from "@/contexts/VesselContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronRight, ChevronDown, Edit, Edit2, Trash2, Plus, PlusCircle, Square, FileSpreadsheet, X, Minus, AlertCircle, CheckCircle, HelpCircle, MapPin, Info } from "lucide-react";
import { ComponentNode, componentTree } from "@/data/componentTree";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { FEATURES, IHM_PRESENCE, IHM_EVIDENCE_TYPES } from '@/config/features';
import { useVessels } from "@/hooks/useVessels";

interface Spare {
  id: number;
  partCode: string;
  partName: string;
  componentId: string;
  componentCode?: string;
  componentName: string;
  componentSpareCode?: string;
  critical: string;
  rob: number;
  min: number;
  max?: number;
  location?: string;
  location2?: string;
  vesselId: string;
  stockStatus?: string;
  partNumber?: string;
  uom?: string;
  drawingNumber?: string;
  positionNumber?: string;
  note?: string;
  specification?: string;
  maker?: string;
  makerCode?: string;
  manualName?: string;
  pageNumber?: string;
  isActive?: boolean;
  ihm?: string;
  remarks?: string;
  criticality?: string;
}

interface SpareHistory {
  id: number;
  timestampUTC: string;
  vesselId: string;
  spareId: number;
  partCode: string;
  partName: string;
  componentId: string;
  componentCode?: string;
  componentName: string;
  componentSpareCode?: string;
  eventType: string;
  qtyChange: number;
  robAfter: number;
  userId: string;
  remarks?: string;
  reference?: string;
}

const Spares: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"inventory" | "history">("inventory");
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(["6", "6.1", "6.1.1"]));
  const [searchTerm, setSearchTerm] = useState("");
  const [criticalityFilter, setCriticalityFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const { vesselId, setVesselId } = useVessel();
  const { data: vessels = [] } = useVessels();
  
  // Dialog states
  const [isAddSpareModalOpen, setIsAddSpareModalOpen] = useState(false);
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConsumeReceiveModalOpen, setIsConsumeReceiveModalOpen] = useState(false);
  const [isConsumeModalOpen, setIsConsumeModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [selectedSpare, setSelectedSpare] = useState<Spare | null>(null);
  
  // Form states
  const [consumeForm, setConsumeForm] = useState({ quantity: "", date: "", workOrder: "", remarks: "" });
  const [receiveForm, setReceiveForm] = useState({ quantity: "", date: "", supplier: "", remarks: "" });
  const [bulkUpdateData, setBulkUpdateData] = useState<{[key: number]: {consumed: number, received: number, receivedDate?: string, receivedPlace?: string}}>({});
  const [addSpareForm, setAddSpareForm] = useState({
    partCode: "",
    partName: "",
    componentId: "",
    critical: "No",
    rob: "",
    min: "",
    location: "",
    // IHM fields
    ihmPresence: "Unknown" as typeof IHM_PRESENCE[number],
    ihmEvidenceType: "None" as typeof IHM_EVIDENCE_TYPES[number]
  });
  
  const { toast } = useToast();
  const [adjustingSpares, setAdjustingSpares] = useState<Set<number>>(new Set());
  const [pendingAdjustments, setPendingAdjustments] = useState<Map<number, number>>(new Map());
  
  // Location dropdown state
  const [openLocationDropdown, setOpenLocationDropdown] = useState<number | null>(null);
  const [editingLocations, setEditingLocations] = useState<{[key: number]: {locationA: string, locationB: string}}>({});
  const locationDropdownRef = useRef<HTMLDivElement>(null);
  
  // Click outside handler for location dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(event.target as Node)) {
        // Save the locations before closing
        if (openLocationDropdown !== null && editingLocations[openLocationDropdown]) {
          handleSaveLocation(openLocationDropdown);
        }
        setOpenLocationDropdown(null);
      }
    };
    
    if (openLocationDropdown !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openLocationDropdown, editingLocations]);
  
  const handleOpenLocationDropdown = (spare: Spare) => {
    setOpenLocationDropdown(spare.id);
    setEditingLocations(prev => ({
      ...prev,
      [spare.id]: {
        locationA: spare.location || '',
        locationB: spare.location2 || ''
      }
    }));
  };
  
  const handleSaveLocation = async (spareId: number) => {
    const locations = editingLocations[spareId];
    if (!locations) return;
    
    try {
      await fetch(`/api/spares/${vesselId}/${spareId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          location: locations.locationA,
          location2: locations.locationB 
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/spares', vesselId] });
    } catch (error) {
      console.error('Failed to save location:', error);
    }
  };

  // Quick adjust mutation (for +/- buttons) with optimistic updates
  const adjustMutation = useMutation({
    mutationFn: async ({ spareId, qtyChange, eventType, notes }: { spareId: number, qtyChange: number, eventType: 'CONSUME' | 'RECEIVE', notes?: string }) => {
      const response = await fetch(`/api/spares/${vesselId}/${spareId}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qtyChange, eventType, notes: notes || 'Manual adjustment' }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to adjust quantity');
      }
      return response.json();
    },
    onMutate: async ({ spareId, qtyChange }) => {
      // Track pending adjustment optimistically
      setPendingAdjustments(prev => {
        const next = new Map(prev);
        next.set(spareId, (next.get(spareId) || 0) + qtyChange);
        return next;
      });
      
      // Return rollback function
      return { spareId, qtyChange };
    },
    onError: (error: any, variables, context) => {
      // Rollback optimistic update on error
      if (context) {
        setPendingAdjustments(prev => {
          const next = new Map(prev);
          const currentDelta = next.get(context.spareId) || 0;
          const newDelta = currentDelta - context.qtyChange;
          if (newDelta === 0) {
            next.delete(context.spareId);
          } else {
            next.set(context.spareId, newDelta);
          }
          return next;
        });
      }
      
      toast({ 
        title: "Error", 
        description: error.message || "Failed to adjust quantity",
        variant: "destructive"
      });
    },
    onSettled: async (data, error, variables) => {
      // Wait for queries to refetch before clearing pending state
      await queryClient.invalidateQueries({ queryKey: ['/api/spares', vesselId] });
      await queryClient.invalidateQueries({ queryKey: ['/api/spares/history', vesselId] });
      
      // Clear pending adjustment and loading state
      setPendingAdjustments(prev => {
        const next = new Map(prev);
        next.delete(variables.spareId);
        return next;
      });
      setAdjustingSpares(prev => {
        const next = new Set(prev);
        next.delete(variables.spareId);
        return next;
      });
      
      if (!error) {
        toast({ title: "Success", description: "Quantity adjusted successfully" });
      }
    }
  });

  const handleQuickAdjust = async (spareId: number, qtyChange: number, eventType: 'CONSUME' | 'RECEIVE') => {
    // Validate stock availability using effective ROB (actual + pending adjustments)
    if (eventType === 'CONSUME') {
      const spare = sparesData.find((s: Spare) => s.id === spareId);
      const pendingDelta = pendingAdjustments.get(spareId) || 0;
      const effectiveRob = (spare?.rob || 0) + pendingDelta;
      
      if (!spare || effectiveRob + qtyChange < 0) {
        toast({
          title: "Insufficient Stock",
          description: `Cannot consume ${Math.abs(qtyChange)} units. Only ${effectiveRob} units available.`,
          variant: "destructive"
        });
        return;
      }
    }
    
    setAdjustingSpares(prev => new Set(prev).add(spareId));
    await adjustMutation.mutateAsync({ spareId, qtyChange, eventType });
  };

  // Open edit modal
  const openEditModal = (spare: Spare) => {
    setSelectedSpare(spare);
    setAddSpareForm({
      partCode: spare.partCode,
      partName: spare.partName,
      componentId: spare.componentId,
      critical: spare.critical,
      rob: spare.rob.toString(),
      min: spare.min.toString(),
      location: spare.location || "",
      ihmPresence: "Unknown" as typeof IHM_PRESENCE[number],
      ihmEvidenceType: "None" as typeof IHM_EVIDENCE_TYPES[number]
    });
    setIsEditModalOpen(true);
  };

  // Open consume/receive modal
  const openConsumeReceiveModal = (spare: Spare) => {
    setSelectedSpare(spare);
    setIsConsumeReceiveModalOpen(true);
  };

  // Open info modal
  const openInfoModal = (spare: Spare) => {
    setSelectedSpare(spare);
    setIsInfoModalOpen(true);
  };

  // Handle delete spare
  const handleDeleteSpare = (spareId: number) => {
    if (confirm("Are you sure you want to delete this spare? This action cannot be undone.")) {
      deleteSpareMutation.mutate(spareId);
    }
  };

  // Fetch spares data
  const { data: sparesData = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/spares', vesselId],
    queryFn: async () => {
      const response = await fetch(`/api/spares/${vesselId}`);
      if (!response.ok) throw new Error('Failed to fetch spares');
      return response.json();
    }
  });

  // Fetch history data
  const { data: historyData = [] } = useQuery({
    queryKey: ['/api/spares/history', vesselId],
    queryFn: async () => {
      const response = await fetch(`/api/spares/history/${vesselId}`);
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json();
    },
    enabled: activeTab === 'history'
  });

  // Consume spare mutation
  const consumeSpareMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number, qty: number, dateLocal: string, tz?: string, place?: string, remarks?: string, userId?: string, vesselId: string }) => {
      const response = await fetch(`/api/spares/${id}/consume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to consume spare');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/spares', vesselId] });
      queryClient.invalidateQueries({ queryKey: ['/api/spares/history', vesselId] });
      toast({ title: "Success", description: "Spare consumed successfully" });
      setIsConsumeModalOpen(false);
      setConsumeForm({ quantity: "", date: "", workOrder: "", remarks: "" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to consume spare",
        variant: "destructive"
      });
    }
  });

  // Receive spare mutation
  const receiveSpareMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number, qty: number, dateLocal: string, tz?: string, place?: string, supplierPO?: string, remarks?: string, userId?: string, vesselId: string }) => {
      const response = await fetch(`/api/spares/${id}/receive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to receive spare');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/spares', vesselId] });
      queryClient.invalidateQueries({ queryKey: ['/api/spares/history', vesselId] });
      toast({ title: "Success", description: "Spare received successfully" });
      setIsReceiveModalOpen(false);
      setReceiveForm({ quantity: "", date: "", supplier: "", remarks: "" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to receive spare",
        variant: "destructive"
      });
    }
  });

  // Create spare mutation
  const createSpareMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/spares', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/spares', vesselId] });
      toast({ title: "Success", description: "Spare created successfully" });
      setIsAddSpareModalOpen(false);
      setAddSpareForm({
        partCode: "",
        partName: "",
        componentId: "",
        critical: "No",
        rob: "",
        min: "",
        location: ""
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create spare",
        variant: "destructive"
      });
    }
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async (data: { vesselId: string, tz: string, rows: Array<{
      componentSpareId: number,
      consumed: number,
      received: number,
      receivedDate?: string,
      receivedPlace?: string,
      dateLocal?: string,
      remarks?: string,
      userId: string
    }> }) => {
      const response = await fetch('/api/spares/bulk-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to perform bulk update');
      }
      
      return response.json();
    },
    onSuccess: (results) => {
      // Update the spares data with new ROB values
      queryClient.setQueryData(['/api/spares', vesselId], (old: any) => {
        if (!old) return old;
        return old.map((spare: any) => {
          const result = results.find((r: any) => r.componentSpareId === spare.id && r.success);
          if (result && result.robAfter !== undefined) {
            return { ...spare, rob: result.robAfter };
          }
          return spare;
        });
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/spares/history', vesselId] });
      
      // Count successes, failures, and skipped
      const succeeded = results.filter((r: any) => r.success).length;
      const failed = results.filter((r: any) => !r.success && r.message).length;
      const skipped = results.filter((r: any) => !r.success && !r.message).length;
      
      toast({ 
        title: "Bulk Update Complete", 
        description: `Updated: ${succeeded}, Skipped: ${skipped}, Failed: ${failed}` 
      });
      setIsBulkUpdateModalOpen(false);
      setBulkUpdateData({});
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to perform bulk update",
        variant: "destructive"
      });
    }
  });

  // Delete spare mutation
  const deleteSpareMutation = useMutation({
    mutationFn: async (spareId: number) => {
      const response = await fetch(`/api/spares/${vesselId}/${spareId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete spare');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/spares', vesselId] });
      queryClient.invalidateQueries({ queryKey: ['/api/spares/history', vesselId] });
      toast({ title: "Success", description: "Spare deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete spare",
        variant: "destructive"
      });
    }
  });

  // Helper function to compute stock status based on ROB vs Min/Max
  const getStockStatus = (rob: number, min: number): { label: string; color: string } => {
    if (rob < min) {
      return { label: 'Low', color: 'bg-red-100 text-red-800' }; // RED
    } else if (rob === min) {
      return { label: 'At Min', color: 'bg-orange-100 text-orange-800' }; // ORANGE
    } else {
      return { label: 'OK', color: 'bg-green-100 text-green-800' }; // GREEN
    }
  };

  // Helper function to check if a component matches selection (including children)
  const isComponentMatch = (spare: Spare, selectedId: string): boolean => {
    if (spare.componentId === selectedId) return true;
    // Check if spare's componentId starts with selected (hierarchical match)
    return spare.componentId.startsWith(selectedId + '.');
  };

  // Filter spares based on all criteria
  const filteredSpares = useMemo(() => {
    let filtered = sparesData;

    // Filter by selected component (including children)
    if (selectedComponentId) {
      filtered = filtered.filter((spare: Spare) => isComponentMatch(spare, selectedComponentId));
    }

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((spare: Spare) => 
        spare.partCode.toLowerCase().includes(search) ||
        spare.partName.toLowerCase().includes(search) ||
        spare.componentName.toLowerCase().includes(search) ||
        spare.componentCode?.toLowerCase().includes(search) ||
        spare.location?.toLowerCase().includes(search)
      );
    }

    // Filter by criticality
    if (criticalityFilter && criticalityFilter !== "All") {
      if (criticalityFilter === "Critical") {
        filtered = filtered.filter((spare: Spare) => spare.critical === "Critical" || spare.critical === "Yes");
      } else if (criticalityFilter === "Non-critical") {
        filtered = filtered.filter((spare: Spare) => spare.critical !== "Critical" && spare.critical !== "Yes");
      }
    }

    // Filter by stock status (using computed status)
    if (stockFilter && stockFilter !== "All") {
      filtered = filtered.filter((spare: Spare) => {
        const status = getStockStatus(spare.rob, spare.min);
        return status.label === stockFilter;
      });
    }

    return filtered;
  }, [sparesData, selectedComponentId, searchTerm, criticalityFilter, stockFilter]);

  // Toggle node expansion
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

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setCriticalityFilter("");
    setStockFilter("");
    setSelectedComponentId(null);
  };

  // Open consume modal
  const openConsumeModal = (spare: Spare) => {
    setSelectedSpare(spare);
    setConsumeForm({ 
      quantity: "", 
      date: format(new Date(), 'yyyy-MM-dd'), 
      workOrder: "", 
      remarks: "" 
    });
    setIsConsumeModalOpen(true);
  };

  // Open receive modal
  const openReceiveModal = (spare: Spare) => {
    setSelectedSpare(spare);
    setReceiveForm({ 
      quantity: "", 
      date: format(new Date(), 'yyyy-MM-dd'), 
      supplier: "", 
      remarks: "" 
    });
    setIsReceiveModalOpen(true);
  };

  // Handle consume submit
  const handleConsumeSubmit = () => {
    if (!selectedSpare || !consumeForm.quantity || !consumeForm.date) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    
    const quantity = parseInt(consumeForm.quantity);
    if (quantity <= 0) {
      toast({ title: "Error", description: "Quantity must be greater than 0", variant: "destructive" });
      return;
    }
    
    if (quantity > selectedSpare.rob) {
      toast({ title: "Error", description: "Insufficient stock", variant: "destructive" });
      return;
    }
    
    consumeSpareMutation.mutate({
      id: selectedSpare.id,
      qty: quantity,
      dateLocal: consumeForm.date,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      place: consumeForm.workOrder || undefined,
      remarks: consumeForm.remarks || undefined,
      userId: 'user',
      vesselId
    });
  };

  // Handle receive submit
  const handleReceiveSubmit = () => {
    if (!selectedSpare || !receiveForm.quantity || !receiveForm.date) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    
    const quantity = parseInt(receiveForm.quantity);
    if (quantity <= 0) {
      toast({ title: "Error", description: "Quantity must be greater than 0", variant: "destructive" });
      return;
    }
    
    receiveSpareMutation.mutate({
      id: selectedSpare.id,
      qty: quantity,
      dateLocal: receiveForm.date,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      supplierPO: receiveForm.supplier || undefined,
      remarks: receiveForm.remarks || undefined,
      userId: 'user',
      vesselId
    });
  };

  // Handle bulk update modal
  const openBulkUpdateModal = () => {
    if (filteredSpares.length === 0) {
      toast({ title: "Info", description: "No spares to update. Please adjust filters.", variant: "default" });
      return;
    }
    setIsBulkUpdateModalOpen(true);
    // Initialize bulk update data
    const initialData: {[key: number]: {consumed: number, received: number, receivedDate?: string, receivedPlace?: string, comments?: string}} = {};
    filteredSpares.forEach((spare: Spare) => {
      initialData[spare.id] = { consumed: 0, received: 0 };
    });
    setBulkUpdateData(initialData);
  };

  // Handle bulk update input changes
  const handleBulkUpdateChange = (spareId: number, field: 'consumed' | 'received' | 'receivedDate' | 'receivedPlace' | 'comments', value: string | number) => {
    if (field === 'consumed' || field === 'received') {
      const numValue = parseInt(value as string) || 0;
      setBulkUpdateData(prev => ({
        ...prev,
        [spareId]: {
          ...prev[spareId],
          [field]: numValue
        }
      }));
    } else {
      setBulkUpdateData(prev => ({
        ...prev,
        [spareId]: {
          ...prev[spareId],
          [field]: value as string
        }
      }));
    }
  };

  // Handle add spare submit
  const handleAddSpareSubmit = () => {
    if (!addSpareForm.partCode || !addSpareForm.partName || !addSpareForm.componentId) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    
    const rob = parseInt(addSpareForm.rob) || 0;
    const min = parseInt(addSpareForm.min) || 0;
    
    // Find the component for getting the name
    const findComponent = (nodes: ComponentNode[]): ComponentNode | null => {
      for (const node of nodes) {
        if (node.id === addSpareForm.componentId) return node;
        if (node.children) {
          const found = findComponent(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    const component = findComponent(componentTree);
    
    createSpareMutation.mutate({
      partCode: addSpareForm.partCode,
      partName: addSpareForm.partName,
      componentId: addSpareForm.componentId,
      componentCode: component?.code || undefined,
      componentName: component?.name || "Unknown",
      critical: addSpareForm.critical,
      rob,
      min,
      location: addSpareForm.location || undefined,
      vesselId
    });
  };

  // Save bulk updates
  const saveBulkUpdates = () => {
    // Validate all rows first
    const hasErrors = Object.entries(bulkUpdateData).some(([id, data]) => {
      const spare = sparesData.find((s: Spare) => s.id === parseInt(id));
      if (!spare) return false;
      
      const newROB = spare.rob - (data.consumed || 0) + (data.received || 0);
      if (newROB < 0) return true;
      
      // Check if received date is required when receiving
      if (data.received > 0 && !data.receivedDate) return true;
      
      return false;
    });
    
    if (hasErrors) {
      toast({ title: "Validation Error", description: "Please fix validation errors before saving", variant: "destructive" });
      return;
    }
    
    const rows = Object.entries(bulkUpdateData)
      .filter(([_, data]) => data.consumed > 0 || data.received > 0)
      .map(([id, data]) => ({
        componentSpareId: parseInt(id),
        consumed: data.consumed || 0,
        received: data.received || 0,
        receivedDate: data.received > 0 ? data.receivedDate : undefined,
        receivedPlace: data.receivedPlace || undefined,
        dateLocal: data.consumed > 0 ? new Date().toISOString().split('T')[0] : undefined,
        remarks: data.comments || undefined,
        userId: 'user'
      }));
    
    if (rows.length === 0) {
      toast({ title: "Info", description: "No changes to save", variant: "default" });
      return;
    }
    
    bulkUpdateMutation.mutate({ 
      vesselId,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      rows 
    });
  };

  // Render component tree
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
                <span className="w-4" />
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
            <Button className="bg-[#52baf3] hover:bg-[#40a8e0] text-white" onClick={() => setIsAddSpareModalOpen(true)}>
              + Add Spare
            </Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={openBulkUpdateModal}>
              🔄 Bulk Update Spares
            </Button>
          </div>
        </div>
      </div>
      {/* Search and Filters */}
      <div className="flex gap-3 items-center mb-4">
        <Select value={vesselId} onValueChange={setVesselId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select Vessel" />
          </SelectTrigger>
          <SelectContent>
            {vessels.map(vessel => (
              <SelectItem key={vessel.id} value={vessel.id}>
                {vessel.id} - {vessel.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search parts or components..."
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
            <SelectItem value="Non-critical">Non-critical</SelectItem>
          </SelectContent>
        </Select>

        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Stock" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="OK">OK</SelectItem>
            <SelectItem value="At Min">At Min</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Button 
          variant="outline"
          onClick={clearFilters}
          className="text-gray-600"
        >
          Clear
        </Button>
      </div>
      {/* Main Content */}
      <div className="flex gap-4 h-[calc(100%-180px)]">
        {/* Left Panel - Component Tree */}
        <div className="w-80 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="text-white px-4 py-2 font-semibold bg-[#52baf3]">
            COMPONENT SEARCH
          </div>
          <div className="overflow-y-auto h-[calc(100%-40px)]">
            {renderComponentTree(componentTree)}
          </div>
        </div>

        {/* Right Panel - Table */}
        <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden">
          {activeTab === 'inventory' ? (
            <>
              {/* Inventory Table Header */}
              <div className="px-4 py-3 border-b border-gray-200 bg-[#52baf3]">
                <div className={`grid ${FEATURES.IHM ? 'grid-cols-11' : 'grid-cols-10'} gap-4 text-sm font-semibold text-[#ffffff]`}>
                  <div className="text-[#ffffff]">Part Code</div>
                  <div>Part Name</div>
                  <div>Component</div>
                  <div>Part Number</div>
                  <div>Criticality</div>
                  <div className="text-center">ROB</div>
                  <div className="text-center">Min</div>
                  <div className="text-center">Stock</div>
                  <div>Location</div>
                  {FEATURES.IHM && <div className="text-center">IHM</div>}
                  <div className="text-center">Actions</div>
                </div>
              </div>

              {/* Inventory Table Body */}
              <div className="overflow-y-auto h-[calc(100%-48px)]">
                {isLoading ? (
                  <div className="p-8 text-center text-gray-500">Loading...</div>
                ) : filteredSpares.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No spares found. Try adjusting your filters.
                  </div>
                ) : (
                  filteredSpares.map((spare: Spare) => {
                    const stockStatus = getStockStatus(spare.rob, spare.min);
                    const isDropdownOpen = openLocationDropdown === spare.id;
                    const locationDisplay = spare.location || spare.location2 
                      ? `${spare.location || '-'} / ${spare.location2 || '-'}`
                      : '-';
                    return (
                    <div key={spare.id} className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
                      <div className={`grid ${FEATURES.IHM ? 'grid-cols-11' : 'grid-cols-10'} gap-4 text-sm items-center`}>
                        <div className="text-gray-900">{spare.partCode}</div>
                        <div className="text-gray-700">{spare.partName}</div>
                        <div className="text-gray-700">{spare.componentName}</div>
                        <div className="text-blue-600 font-medium">{spare.componentSpareCode || '-'}</div>
                        <div>
                          <span className={`px-2 py-1 rounded text-xs ${
                            spare.critical === 'Critical' || spare.critical === 'Yes' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {spare.critical}
                          </span>
                        </div>
                        <div className="text-center">{spare.rob}</div>
                        <div className="text-center">{spare.min}</div>
                        <div className="text-center">
                          <span className={`px-2 py-1 rounded text-xs ${stockStatus.color}`}>
                            {stockStatus.label}
                          </span>
                        </div>
                        {/* Location Dropdown */}
                        <div className="relative">
                          <button
                            onClick={() => handleOpenLocationDropdown(spare)}
                            className="flex items-center gap-1 text-gray-700 hover:text-blue-600 cursor-pointer w-full text-left"
                            data-testid={`button-location-${spare.id}`}
                          >
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate text-sm">{locationDisplay}</span>
                            <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {isDropdownOpen && (
                            <div 
                              ref={locationDropdownRef}
                              className="absolute z-50 mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-48"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Location A</label>
                                  <Input
                                    type="text"
                                    value={editingLocations[spare.id]?.locationA || ''}
                                    onChange={(e) => setEditingLocations(prev => ({
                                      ...prev,
                                      [spare.id]: { ...prev[spare.id], locationA: e.target.value }
                                    }))}
                                    className="h-8 text-sm"
                                    placeholder="Enter location A"
                                    data-testid={`input-locationA-${spare.id}`}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Location B</label>
                                  <Input
                                    type="text"
                                    value={editingLocations[spare.id]?.locationB || ''}
                                    onChange={(e) => setEditingLocations(prev => ({
                                      ...prev,
                                      [spare.id]: { ...prev[spare.id], locationB: e.target.value }
                                    }))}
                                    className="h-8 text-sm"
                                    placeholder="Enter location B"
                                    data-testid={`input-locationB-${spare.id}`}
                                  />
                                </div>
                                <Button
                                  size="sm"
                                  className="w-full h-7 text-xs"
                                  onClick={() => {
                                    handleSaveLocation(spare.id);
                                    setOpenLocationDropdown(null);
                                  }}
                                  data-testid={`button-save-location-${spare.id}`}
                                >
                                  Save
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                        {FEATURES.IHM && (
                          <div className="flex justify-center">
                            {/* Mock IHM status - in real implementation, would come from API */}
                            {spare.partCode === 'SP-ME-001' ? (
                              <AlertCircle className="h-4 w-4 text-red-500" title="IHM Present" />
                            ) : spare.partCode === 'SP-ME-002' ? (
                              <CheckCircle className="h-4 w-4 text-green-500" title="IHM Not Present" />
                            ) : (
                              <HelpCircle className="h-4 w-4 text-gray-400" title="IHM Unknown" />
                            )}
                          </div>
                        )}
                        <div className="flex gap-1 justify-center">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => openInfoModal(spare)}
                            title="View Details"
                            data-testid={`button-info-${spare.id}`}
                          >
                            <Info className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => openEditModal(spare)}
                            title="Edit"
                            data-testid={`button-edit-${spare.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => openConsumeReceiveModal(spare)}
                            title="Consume/Receive"
                            data-testid={`button-plus-${spare.id}`}
                          >
                            <PlusCircle className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleDeleteSpare(spare.id)}
                            title="Delete"
                            data-testid={`button-delete-${spare.id}`}
                          >
                            <Square className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <>
              {/* History Table Header */}
              <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                <div className="grid grid-cols-9 gap-4 text-sm font-semibold text-gray-700">
                  <div>Date/Time</div>
                  <div>Part Code</div>
                  <div>Part Name</div>
                  <div>Component</div>
                  <div>Part Number</div>
                  <div>Event</div>
                  <div className="text-center">Qty Change</div>
                  <div className="text-center">ROB After</div>
                  <div>Reference</div>
                </div>
              </div>

              {/* History Table Body */}
              <div className="overflow-y-auto h-[calc(100%-48px)]">
                {historyData.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No history records found.
                  </div>
                ) : (
                  historyData.map((history: SpareHistory) => (
                    <div key={history.id} className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
                      <div className="grid grid-cols-9 gap-4 text-sm items-center">
                        <div className="text-gray-900">
                          {format(new Date(history.timestampUTC), 'dd-MMM-yyyy HH:mm')}
                        </div>
                        <div className="text-gray-700">{history.partCode}</div>
                        <div className="text-gray-700">{history.partName}</div>
                        <div className="text-gray-700">{history.componentName}</div>
                        <div className="text-blue-600 font-medium">{history.componentSpareCode || '-'}</div>
                        <div>
                          <span className={`px-2 py-1 rounded text-xs ${
                            history.eventType === 'CONSUME' 
                              ? 'bg-orange-100 text-orange-800' 
                              : history.eventType === 'RECEIVE'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {history.eventType}
                          </span>
                        </div>
                        <div className={`text-center font-semibold ${
                          history.qtyChange < 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {history.qtyChange > 0 ? '+' : ''}{history.qtyChange}
                        </div>
                        <div className="text-center">{history.robAfter}</div>
                        <div className="text-gray-700">{history.reference || '-'}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {/* Consume Modal */}
      <Dialog open={isConsumeModalOpen} onOpenChange={setIsConsumeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Consume Spare</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Part: {selectedSpare?.partCode} - {selectedSpare?.partName}</Label>
              <p className="text-sm text-gray-500">Current ROB: {selectedSpare?.rob}</p>
            </div>
            <div>
              <Label htmlFor="consume-quantity">Quantity *</Label>
              <Input
                id="consume-quantity"
                type="number"
                min="1"
                max={selectedSpare?.rob}
                value={consumeForm.quantity}
                onChange={(e) => setConsumeForm({...consumeForm, quantity: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="consume-date">Date *</Label>
              <Input
                id="consume-date"
                type="date"
                value={consumeForm.date}
                onChange={(e) => setConsumeForm({...consumeForm, date: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="consume-wo">Work Order</Label>
              <Input
                id="consume-wo"
                value={consumeForm.workOrder}
                onChange={(e) => setConsumeForm({...consumeForm, workOrder: e.target.value})}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="consume-remarks">Remarks</Label>
              <Input
                id="consume-remarks"
                value={consumeForm.remarks}
                onChange={(e) => setConsumeForm({...consumeForm, remarks: e.target.value})}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConsumeModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConsumeSubmit} disabled={consumeSpareMutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Receive Modal */}
      <Dialog open={isReceiveModalOpen} onOpenChange={setIsReceiveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive Spare</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Part: {selectedSpare?.partCode} - {selectedSpare?.partName}</Label>
              <p className="text-sm text-gray-500">Current ROB: {selectedSpare?.rob}</p>
            </div>
            <div>
              <Label htmlFor="receive-quantity">Quantity *</Label>
              <Input
                id="receive-quantity"
                type="number"
                min="1"
                value={receiveForm.quantity}
                onChange={(e) => setReceiveForm({...receiveForm, quantity: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="receive-date">Date *</Label>
              <Input
                id="receive-date"
                type="date"
                value={receiveForm.date}
                onChange={(e) => setReceiveForm({...receiveForm, date: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="receive-supplier">Supplier/PO</Label>
              <Input
                id="receive-supplier"
                value={receiveForm.supplier}
                onChange={(e) => setReceiveForm({...receiveForm, supplier: e.target.value})}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="receive-remarks">Remarks</Label>
              <Input
                id="receive-remarks"
                value={receiveForm.remarks}
                onChange={(e) => setReceiveForm({...receiveForm, remarks: e.target.value})}
                placeholder="Optional"
              />
            </div>
            
            {/* IHM Warning - only show if feature is enabled and status is unknown */}
            {FEATURES.IHM && selectedSpare && (
              <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-800">IHM Status Check Required</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      This spare part has unknown IHM status or missing evidence. 
                      Please verify hazardous materials presence and upload evidence documents if applicable.
                    </p>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="mt-2 text-xs"
                      onClick={() => {
                        // In real implementation, open IHM evidence upload modal
                        toast({ 
                          title: "IHM Evidence Upload", 
                          description: "IHM evidence upload functionality would open here" 
                        });
                      }}
                    >
                      Upload IHM Evidence
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReceiveModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReceiveSubmit} disabled={receiveSpareMutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Bulk Update Modal */}
      <Dialog open={isBulkUpdateModalOpen} onOpenChange={setIsBulkUpdateModalOpen}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Update Spares</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-gray-500">
              Updating {filteredSpares.length} spare(s)
            </div>
            
            {/* Common fields for all spares */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <Label htmlFor="bulk-received-date">Received Date (Apply to all)</Label>
                <Input
                  id="bulk-received-date"
                  type="date"
                  onChange={(e) => {
                    const date = e.target.value;
                    setBulkUpdateData(prev => {
                      const updated = { ...prev };
                      Object.keys(updated).forEach(id => {
                        updated[Number(id)] = { ...updated[Number(id)], receivedDate: date };
                      });
                      return updated;
                    });
                  }}
                />
              </div>
              <div>
                <Label htmlFor="bulk-received-place">Received Place (Apply to all)</Label>
                <Input
                  id="bulk-received-place"
                  type="text"
                  placeholder="e.g., Singapore Port"
                  onChange={(e) => {
                    const place = e.target.value;
                    setBulkUpdateData(prev => {
                      const updated = { ...prev };
                      Object.keys(updated).forEach(id => {
                        updated[Number(id)] = { ...updated[Number(id)], receivedPlace: place };
                      });
                      return updated;
                    });
                  }}
                />
              </div>
              <div>
                <Label htmlFor="bulk-comments">Comments (Apply to all)</Label>
                <Input
                  id="bulk-comments"
                  type="text"
                  placeholder="Enter comments"
                  onChange={(e) => {
                    const comments = e.target.value;
                    setBulkUpdateData(prev => {
                      const updated = { ...prev };
                      Object.keys(updated).forEach(id => {
                        updated[Number(id)] = { ...updated[Number(id)], comments: comments };
                      });
                      return updated;
                    });
                  }}
                />
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium">Part Code</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Part Name</th>
                    <th className="px-4 py-2 text-center text-sm font-medium">ROB</th>
                    <th className="px-4 py-2 text-center text-sm font-medium">Consumed</th>
                    <th className="px-4 py-2 text-center text-sm font-medium">Received</th>
                    <th className="px-4 py-2 text-center text-sm font-medium">New ROB</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSpares.map((spare: Spare) => {
                    const consumed = bulkUpdateData[spare.id]?.consumed || 0;
                    const received = bulkUpdateData[spare.id]?.received || 0;
                    const newROB = spare.rob - consumed + received;
                    const hasInsufficientStock = newROB < 0;
                    const needsReceivedDate = received > 0 && !bulkUpdateData[spare.id]?.receivedDate;
                    const hasError = hasInsufficientStock || needsReceivedDate;
                    
                    return (
                      <tr key={spare.id} className={`border-t ${hasError ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-2 text-sm">{spare.partCode}</td>
                        <td className="px-4 py-2 text-sm">{spare.partName}</td>
                        <td className="px-4 py-2 text-center text-sm">{spare.rob}</td>
                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            min="0"
                            max={spare.rob}
                            value={bulkUpdateData[spare.id]?.consumed || ""}
                            onChange={(e) => handleBulkUpdateChange(spare.id, 'consumed', e.target.value)}
                            className={`w-20 mx-auto ${hasInsufficientStock ? 'border-red-500' : ''}`}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            min="0"
                            value={bulkUpdateData[spare.id]?.received || ""}
                            onChange={(e) => handleBulkUpdateChange(spare.id, 'received', e.target.value)}
                            className="w-20 mx-auto"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className={`text-sm font-medium ${hasInsufficientStock ? 'text-red-600' : ''}`}>
                            {newROB}
                            {hasInsufficientStock && (
                              <div className="text-xs text-red-600">Insufficient stock</div>
                            )}
                            {needsReceivedDate && (
                              <div className="text-xs text-red-600">Date required</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkUpdateModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={saveBulkUpdates} 
              disabled={bulkUpdateMutation.isPending || (() => {
                // Check for validation errors
                return Object.entries(bulkUpdateData).some(([id, data]) => {
                  const spare = filteredSpares.find((s: Spare) => s.id === parseInt(id));
                  if (!spare) return false;
                  const newROB = spare.rob - (data.consumed || 0) + (data.received || 0);
                  if (newROB < 0) return true;
                  if (data.received > 0 && !data.receivedDate) return true;
                  return false;
                });
              })()}
            >
              {bulkUpdateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add Spare Modal */}
      <Dialog open={isAddSpareModalOpen} onOpenChange={setIsAddSpareModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Spare</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="add-part-code">Part Code *</Label>
                <Input
                  id="add-part-code"
                  value={addSpareForm.partCode}
                  onChange={(e) => setAddSpareForm({...addSpareForm, partCode: e.target.value})}
                  placeholder="e.g., SP-ME-001"
                  required
                />
              </div>
              <div>
                <Label htmlFor="add-part-name">Part Name *</Label>
                <Input
                  id="add-part-name"
                  value={addSpareForm.partName}
                  onChange={(e) => setAddSpareForm({...addSpareForm, partName: e.target.value})}
                  placeholder="e.g., Fuel Injector"
                  required
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="add-component">Linked Component *</Label>
              <Select value={addSpareForm.componentId} onValueChange={(value) => setAddSpareForm({...addSpareForm, componentId: value})}>
                <SelectTrigger id="add-component">
                  <SelectValue placeholder="Select a component" />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const renderOptions = (nodes: ComponentNode[], level = 0): React.ReactNode[] => {
                      return nodes.flatMap(node => {
                        const options: React.ReactNode[] = [
                          <SelectItem key={node.id} value={node.id}>
                            {'  '.repeat(level)}{node.name}
                          </SelectItem>
                        ];
                        if (node.children) {
                          options.push(...renderOptions(node.children, level + 1));
                        }
                        return options;
                      });
                    };
                    return renderOptions(componentTree);
                  })()}
                </SelectContent>
              </Select>
              {addSpareForm.componentId && (() => {
                const findComponent = (nodes: ComponentNode[]): ComponentNode | null => {
                  for (const node of nodes) {
                    if (node.id === addSpareForm.componentId) return node;
                    if (node.children) {
                      const found = findComponent(node.children);
                      if (found) return found;
                    }
                  }
                  return null;
                };
                const component = findComponent(componentTree);
                const spareCode = component ? `SP-${component.code}-XXX` : '';
                return spareCode ? (
                  <p className="text-sm text-blue-600 mt-1">
                    Component Spare Code will be: {spareCode}
                  </p>
                ) : null;
              })()}
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="add-critical">Critical</Label>
                <Select value={addSpareForm.critical} onValueChange={(value) => setAddSpareForm({...addSpareForm, critical: value})}>
                  <SelectTrigger id="add-critical">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="add-rob">ROB (Remain on Board)</Label>
                <Input
                  id="add-rob"
                  type="number"
                  min="0"
                  value={addSpareForm.rob}
                  onChange={(e) => setAddSpareForm({...addSpareForm, rob: e.target.value})}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="add-min">Minimum Stock</Label>
                <Input
                  id="add-min"
                  type="number"
                  min="0"
                  value={addSpareForm.min}
                  onChange={(e) => setAddSpareForm({...addSpareForm, min: e.target.value})}
                  placeholder="0"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="add-location">Location</Label>
              <Input
                id="add-location"
                value={addSpareForm.location}
                onChange={(e) => setAddSpareForm({...addSpareForm, location: e.target.value})}
                placeholder="e.g., Store Room A"
              />
            </div>
            
            {/* IHM Section - only show if feature is enabled */}
            {FEATURES.IHM && (
              <div className="border border-gray-200 rounded-lg p-4 bg-blue-50/30">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-500" />
                  IHM (Inventory of Hazardous Materials)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="add-ihm-presence">IHM Presence</Label>
                    <Select 
                      value={addSpareForm.ihmPresence} 
                      onValueChange={(value: typeof IHM_PRESENCE[number]) => 
                        setAddSpareForm({...addSpareForm, ihmPresence: value})
                      }
                    >
                      <SelectTrigger id="add-ihm-presence">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IHM_PRESENCE.map(presence => (
                          <SelectItem key={presence} value={presence}>
                            {presence}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="add-ihm-evidence">Evidence Type</Label>
                    <Select 
                      value={addSpareForm.ihmEvidenceType} 
                      onValueChange={(value: typeof IHM_EVIDENCE_TYPES[number]) => 
                        setAddSpareForm({...addSpareForm, ihmEvidenceType: value})
                      }
                    >
                      <SelectTrigger id="add-ihm-evidence">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IHM_EVIDENCE_TYPES.map(type => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddSpareModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSpareSubmit} disabled={createSpareMutation.isPending}>
              Create Spare
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Spare Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Spare</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-part-code">Part Code *</Label>
                <Input
                  id="edit-part-code"
                  value={addSpareForm.partCode}
                  onChange={(e) => setAddSpareForm({...addSpareForm, partCode: e.target.value})}
                  placeholder="e.g., SP-ME-001"
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-part-name">Part Name *</Label>
                <Input
                  id="edit-part-name"
                  value={addSpareForm.partName}
                  onChange={(e) => setAddSpareForm({...addSpareForm, partName: e.target.value})}
                  placeholder="e.g., Fuel Injector"
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="edit-critical">Critical</Label>
                <Select value={addSpareForm.critical} onValueChange={(value) => setAddSpareForm({...addSpareForm, critical: value})}>
                  <SelectTrigger id="edit-critical">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-rob">ROB (Remain on Board)</Label>
                <Input
                  id="edit-rob"
                  type="number"
                  min="0"
                  value={addSpareForm.rob}
                  onChange={(e) => setAddSpareForm({...addSpareForm, rob: e.target.value})}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="edit-min">Minimum Stock</Label>
                <Input
                  id="edit-min"
                  type="number"
                  min="0"
                  value={addSpareForm.min}
                  onChange={(e) => setAddSpareForm({...addSpareForm, min: e.target.value})}
                  placeholder="0"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                value={addSpareForm.location}
                onChange={(e) => setAddSpareForm({...addSpareForm, location: e.target.value})}
                placeholder="e.g., Store Room A"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              // TODO: Implement update mutation
              toast({ title: "Info", description: "Edit functionality to be implemented" });
              setIsEditModalOpen(false);
            }}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Consume/Receive Modal */}
      <Dialog open={isConsumeReceiveModalOpen} onOpenChange={setIsConsumeReceiveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Consume or Receive Spare</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Part: {selectedSpare?.partCode} - {selectedSpare?.partName}</Label>
              <p className="text-sm text-gray-500">Current ROB: {selectedSpare?.rob}</p>
            </div>
            <div className="flex gap-4">
              <Button
                onClick={() => {
                  setIsConsumeReceiveModalOpen(false);
                  if (selectedSpare) {
                    setConsumeForm({ 
                      quantity: "", 
                      date: format(new Date(), 'yyyy-MM-dd'), 
                      workOrder: "", 
                      remarks: "" 
                    });
                    setIsConsumeModalOpen(true);
                  }
                }}
                variant="destructive"
                className="flex-1"
              >
                <Minus className="h-4 w-4 mr-2" />
                Consume
              </Button>
              <Button
                onClick={() => {
                  setIsConsumeReceiveModalOpen(false);
                  if (selectedSpare) {
                    setReceiveForm({ 
                      quantity: "", 
                      date: format(new Date(), 'yyyy-MM-dd'), 
                      supplier: "", 
                      remarks: "" 
                    });
                    setIsReceiveModalOpen(true);
                  }
                }}
                variant="default"
                className="flex-1"
              >
                <Plus className="h-4 w-4 mr-2" />
                Receive
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConsumeReceiveModalOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Consume Modal */}
      <Dialog open={isConsumeModalOpen} onOpenChange={setIsConsumeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Consume Spare</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Part: {selectedSpare?.partCode} - {selectedSpare?.partName}</Label>
              <p className="text-sm text-gray-500">Current ROB: {selectedSpare?.rob}</p>
            </div>
            <div>
              <Label htmlFor="consume-quantity">Quantity *</Label>
              <Input
                id="consume-quantity"
                type="number"
                min="1"
                max={selectedSpare?.rob}
                value={consumeForm.quantity}
                onChange={(e) => setConsumeForm({...consumeForm, quantity: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="consume-date">Date *</Label>
              <Input
                id="consume-date"
                type="date"
                value={consumeForm.date}
                onChange={(e) => setConsumeForm({...consumeForm, date: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="consume-work-order">Work Order/Reference</Label>
              <Input
                id="consume-work-order"
                value={consumeForm.workOrder}
                onChange={(e) => setConsumeForm({...consumeForm, workOrder: e.target.value})}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="consume-remarks">Remarks</Label>
              <Input
                id="consume-remarks"
                value={consumeForm.remarks}
                onChange={(e) => setConsumeForm({...consumeForm, remarks: e.target.value})}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConsumeModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConsumeSubmit} disabled={consumeSpareMutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Modal */}
      <Dialog open={isReceiveModalOpen} onOpenChange={setIsReceiveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive Spare</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Part: {selectedSpare?.partCode} - {selectedSpare?.partName}</Label>
              <p className="text-sm text-gray-500">Current ROB: {selectedSpare?.rob}</p>
            </div>
            <div>
              <Label htmlFor="receive-quantity">Quantity *</Label>
              <Input
                id="receive-quantity"
                type="number"
                min="1"
                value={receiveForm.quantity}
                onChange={(e) => setReceiveForm({...receiveForm, quantity: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="receive-date">Date *</Label>
              <Input
                id="receive-date"
                type="date"
                value={receiveForm.date}
                onChange={(e) => setReceiveForm({...receiveForm, date: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="receive-supplier">Supplier/PO</Label>
              <Input
                id="receive-supplier"
                value={receiveForm.supplier}
                onChange={(e) => setReceiveForm({...receiveForm, supplier: e.target.value})}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="receive-remarks">Remarks</Label>
              <Input
                id="receive-remarks"
                value={receiveForm.remarks}
                onChange={(e) => setReceiveForm({...receiveForm, remarks: e.target.value})}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReceiveModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReceiveSubmit} disabled={receiveSpareMutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Spare Info Modal - Displays additional information not shown in the table */}
      <Dialog open={isInfoModalOpen} onOpenChange={setIsInfoModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600" />
              Spare Part Details
            </DialogTitle>
          </DialogHeader>
          {selectedSpare && (
            <div className="space-y-6">
              {/* Basic Info Section */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Part Code:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpare.partCode}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Part Name:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpare.partName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Part Number:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpare.partNumber || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">UOM:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpare.uom || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Component:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpare.componentName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Component Code:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpare.componentCode || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Stock & Location Section */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Stock & Location</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">ROB (Total):</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpare.rob}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Minimum Stock:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpare.min}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Location A:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpare.location || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Location B:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpare.location2 || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Criticality:</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                      selectedSpare.critical === 'Yes' || selectedSpare.critical === 'Critical'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {selectedSpare.critical}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Is Active:</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                      selectedSpare.isActive !== false
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedSpare.isActive !== false ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Technical Details Section */}
              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Technical Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Maker:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpare.maker || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Maker Code:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpare.makerCode || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Drawing Number:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpare.drawingNumber || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Position Number:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpare.positionNumber || '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Specification:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpare.specification || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Manual Reference Section */}
              <div className="bg-yellow-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Manual Reference</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Manual Name:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpare.manualName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Page Number:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpare.pageNumber || '-'}</span>
                  </div>
                </div>
              </div>

              {/* IHM & Notes Section */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">IHM & Notes</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">IHM:</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                      selectedSpare.ihm === 'Yes'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {selectedSpare.ihm || 'No'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Evidence Type:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpare.remarks || '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Note:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedSpare.note || '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInfoModalOpen(false)} data-testid="button-close-info">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Spares;