import React, { useState, useMemo, useEffect, useRef } from "react";
import { useVessel } from "@/contexts/VesselContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Edit, Clock, Trash2, FileSpreadsheet, X, MessageSquare, Calendar, Plus, Minus, Archive, Download, AlertCircle, CheckCircle, HelpCircle, MapPin, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import * as XLSX from "xlsx";
import { FEATURES } from "@/config/features";
import { useVessels } from "@/hooks/useVessels";

// IHM constants
const IHM_PRESENCE = ["Unknown", "Present", "Not Present"] as const;
const IHM_EVIDENCE_TYPES = ["None", "MD", "SDoC", "Test"] as const;

interface StoreItem {
  id: number;
  itemCode: string;
  itemName: string;
  storesCategory: string;
  uom?: string;
  rob: number;
  min: number;
  stock: string;
  location: string;
  category: "stores" | "lubes" | "chemicals" | "others";
  notes?: string;
  isArchived?: boolean;
  robLocationA?: number;
  robLocationB?: number;
  // IHM fields
  ihmPresence?: typeof IHM_PRESENCE[number];
  ihmEvidenceType?: typeof IHM_EVIDENCE_TYPES[number];
}

interface StoresHistoryItem {
  id: number;
  dateLocal: string;
  eventType: string;
  itemName: string;
  partCode: string;
  uom?: string;
  qtyChange: number;
  robAfter: number;
  place?: string;
  userId: string;
  remarks?: string;
  ref?: string;
}

// UOM options
const UOM_OPTIONS = [
  "pcs", "set", "box", "pkt",
  "kg", "g",
  "ltr", "ml",
  "m", "cm",
  "roll", "drum", "can", "bottle", "jar", "tube", "pair", "kit",
  "Other"
];

// API response type for stores items
interface StoresApiItem {
  id: number;
  itemCode: string;
  itemName: string;
  impaCode?: string;
  category?: string;
  uom?: string;
  totalRob?: number;
  rob?: number;
  locationA?: string;
  locationARob?: number;
  robLocationA?: number;
  locationB?: string;
  locationBRob?: number;
  robLocationB?: number;
  min?: number;
  max?: number;
  itemType?: string;
  vesselId?: string;
  notes?: string;
  isArchived?: boolean;
  ihmPresence?: string;
  ihmEvidenceType?: string;
}

const Stores: React.FC = () => {
  const { toast } = useToast();
  const { vesselId, setVesselId } = useVessel();
  const { data: vessels = [] } = useVessels();
  const [activeTab, setActiveTab] = useState<"stores" | "lubes" | "chemicals" | "others">(() => {
    const savedTab = sessionStorage.getItem('storesActiveTab');
    if (savedTab && ['stores', 'lubes', 'chemicals', 'others'].includes(savedTab)) {
      sessionStorage.removeItem('storesActiveTab');
      return savedTab as "stores" | "lubes" | "chemicals" | "others";
    }
    return "stores";
  });
  const [viewMode, setViewMode] = useState<"inventory" | "history">("inventory");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [bulkUpdateData, setBulkUpdateData] = useState<{[key: number]: {consumed: number, received: number, receivedDate?: string, receivedPlace?: string, comments?: string}}>({});
  const [placeReceived, setPlaceReceived] = useState("");
  const [dateReceived, setDateReceived] = useState("");
  const [items, setItems] = useState<StoreItem[]>([]);
  
  // Location dropdown state
  const [openLocationDropdown, setOpenLocationDropdown] = useState<number | null>(null);
  const [editingLocations, setEditingLocations] = useState<{[key: number]: {locationA: string, locationB: string, nameA?: string, nameB?: string}}>({});
  const locationDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch stores items from API - uses default TanStack Query fetcher
  // The query key includes the full URL with query parameters
  const { data: storesData = [], isLoading: storesLoading } = useQuery<StoresApiItem[]>({
    queryKey: vesselId ? [`/api/stores/${vesselId}?itemType=${activeTab}`] : ['stores-disabled'],
    enabled: !!vesselId,
  });
  
  // Fetch vessel location names
  const { data: locationNamesData } = useQuery({
    queryKey: [`/api/vessel-location-names/${vesselId}`],
    queryFn: async () => {
      const response = await fetch(`/api/vessel-location-names/${vesselId}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!vesselId,
  });
  
  const locationNames = {
    locationA: locationNamesData?.locationAName || 'Location A',
    locationB: locationNamesData?.locationBName || 'Location B'
  };

  // Map API data to StoreItem format and update items state
  useEffect(() => {
    if (storesData && storesData.length > 0) {
      const mappedItems: StoreItem[] = storesData.map((item: any) => {
        // Parse numeric values from strings (API may return strings)
        const locationARob = Number(item.locationARob ?? item.robLocationA ?? 0) || 0;
        const locationBRob = Number(item.locationBRob ?? item.robLocationB ?? 0) || 0;
        const totalRob = Number(item.totalRob ?? item.rob ?? 0) || 0;
        const rob = totalRob || (locationARob + locationBRob);
        const min = Number(item.min ?? 0) || 0;
        
        return {
          id: item.id,
          itemCode: item.itemCode || '',
          itemName: item.itemName || '',
          storesCategory: item.category || '',
          uom: item.uom || '',
          rob: rob,
          min: min,
          stock: '', // Will be calculated by updateItemsStock
          location: item.locationA || '',
          category: (item.itemType as "stores" | "lubes" | "chemicals" | "others") || activeTab,
          notes: item.notes || '',
          isArchived: item.isArchived || false,
          robLocationA: locationARob,
          robLocationB: locationBRob,
          ihmPresence: (item.ihmPresence as typeof IHM_PRESENCE[number]) || 'Unknown',
          ihmEvidenceType: (item.ihmEvidenceType as typeof IHM_EVIDENCE_TYPES[number]) || 'None',
        };
      });
      setItems(mappedItems);
    } else {
      setItems([]);
    }
  }, [storesData, activeTab]);
  
  // Fetch stores history from API
  const { data: historyData = [], isLoading: historyLoading } = useQuery<any[]>({
    queryKey: vesselId ? [`/api/stores/${vesselId}/history`, activeTab] : ['history-disabled'],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${vesselId}/history?itemType=${activeTab}`);
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json();
    },
    enabled: !!vesselId && viewMode === 'history',
  });

  // Map history API data to StoresHistoryItem format
  const historyItems: StoresHistoryItem[] = useMemo(() => {
    if (!historyData || historyData.length === 0) return [];
    
    return historyData.map((entry: any) => {
      const storeItem = storesData.find((item: any) => item.id === entry.storesItemId);
      return {
        id: entry.id,
        dateLocal: entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '',
        eventType: entry.transactionType === 'issue' ? 'Consume' : 
                   entry.transactionType === 'receive' ? 'Receive' : 
                   entry.transactionType || 'Unknown',
        itemName: storeItem?.itemName || `Item #${entry.storesItemId}`,
        partCode: storeItem?.itemCode || '',
        uom: storeItem?.uom || '',
        qtyChange: entry.transactionType === 'issue' ? -Number(entry.quantity) : Number(entry.quantity),
        robAfter: Number(entry.robAfter) || 0,
        place: entry.place || '',
        userId: entry.createdBy || 'System',
        remarks: entry.reason || '',
        ref: entry.purchaseOrderRef || '',
      };
    }).sort((a: StoresHistoryItem, b: StoresHistoryItem) => b.id - a.id);
  }, [historyData, storesData]);

  // History filters
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyEventFilter, setHistoryEventFilter] = useState("all");
  
  // Click outside handler for location dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(event.target as Node)) {
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
  
  const handleOpenLocationDropdown = (item: StoreItem) => {
    setOpenLocationDropdown(item.id);
    setEditingLocations(prev => ({
      ...prev,
      [item.id]: {
        locationA: String(item.robLocationA ?? 0),
        locationB: String(item.robLocationB ?? 0)
      }
    }));
  };
  
  const handleSaveLocation = async (itemId: number) => {
    const locations = editingLocations[itemId];
    if (!locations) return;
    
    const robA = parseInt(locations.locationA) || 0;
    const robB = parseInt(locations.locationB) || 0;
    
    try {
      // Save ROB quantities to store item
      await fetch(`/api/stores/${vesselId}/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          robLocationA: robA,
          robLocationB: robB,
          rob: robA + robB
        }),
      });
      
      // Save location names to vessel settings if they were edited
      if (locations.nameA || locations.nameB) {
        await fetch(`/api/vessel-location-names/${vesselId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            locationAName: locations.nameA || locationNames.locationA || 'Location A',
            locationBName: locations.nameB || locationNames.locationB || 'Location B'
          }),
        });
        queryClient.invalidateQueries({ queryKey: [`/api/vessel-location-names/${vesselId}`] });
      }
      
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${vesselId}?itemType=${activeTab}`] });
      toast({ title: "Saved", description: "Location settings updated" });
    } catch (error) {
      console.error('Failed to save location:', error);
      toast({ title: "Error", description: "Failed to save location settings", variant: "destructive" });
    }
  };
  
  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null);
  const [editForm, setEditForm] = useState({
    itemName: "",
    uom: "",
    customUom: "",
    min: 0,
    location: "",
    notes: "",
    ihmPresence: 'Unknown' as 'Unknown' | 'Present' | 'Not Present',
    ihmEvidenceType: 'None' as 'None' | 'MD' | 'SDoC' | 'Test'
  });
  
  // Receive modal state
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receivingItem, setReceivingItem] = useState<StoreItem | null>(null);
  const [isConsumeModalOpen, setIsConsumeModalOpen] = useState(false);
  const [consumingItem, setConsumingItem] = useState<StoreItem | null>(null);
  const [consumeForm, setConsumeForm] = useState({
    quantity: "",
    dateLocal: new Date().toISOString().split('T')[0],
    workOrder: "",
    remarks: ""
  });
  const [receiveForm, setReceiveForm] = useState({
    quantity: "",
    dateLocal: new Date().toISOString().split('T')[0],
    place: "",
    supplierPO: "",
    remarks: ""
  });

  // Add to history function
  // Note: History entries are now created by the backend API and fetched via useQuery
  // This helper function can be kept for reference but the actual history is persisted server-side
  const addToHistory = (
    item: StoreItem,
    eventType: string,
    qtyChange: number,
    robAfter: number,
    place?: string,
    ref?: string,
    remarks?: string
  ) => {
    // History is now managed by the backend via /api/stores/:vesselId/batch-consume and /api/stores/:vesselId/batch-receive
    // After a consume/receive action, invalidate the history query to refresh the data
    queryClient.invalidateQueries({ queryKey: [`/api/stores/${vesselId}/history`, activeTab] });
  };

  // Calculate stock status based on ROB and Min
  const calculateStockStatus = (rob: number, min: number): string => {
    if (min === null || min === 0) return "N/A";
    if (rob >= min) return "OK";
    return "Low";
  };
  
  // Update stock status for all items
  const updateItemsStock = (itemList: StoreItem[]): StoreItem[] => {
    return itemList.map(item => ({
      ...item,
      stock: calculateStockStatus(item.rob, item.min)
    }));
  };

  const filteredItems = useMemo(() => {
    const updatedItems = updateItemsStock(items);
    return updatedItems.filter(item => {
      if (item.isArchived) return false; // Hide archived items
      const matchesTab = item.category === activeTab;
      const matchesSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.itemCode.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !categoryFilter || categoryFilter === "all" || item.storesCategory.includes(categoryFilter);
      const matchesStock = !stockFilter || stockFilter === "all" || item.stock.toLowerCase() === stockFilter.toLowerCase();
      
      return matchesTab && matchesSearch && matchesCategory && matchesStock;
    });
  }, [activeTab, searchTerm, categoryFilter, stockFilter, items]);

  const getStockColor = (stock: string) => {
    if (stock === "Low") return "bg-yellow-100 text-yellow-800";
    if (stock === "OK") return "bg-green-100 text-green-800";
    if (stock === "N/A") return "bg-gray-100 text-gray-800";
    return "";
  };
  
  // Export to Excel functions
  const exportInventoryToExcel = () => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
    const filename = `stores_${activeTab}_inventory_${timestamp}.xlsx`;
    
    const data = filteredItems.map(item => ({
      'Item Name': item.itemName,
      'Part Code': item.itemCode,
      'UOM': item.uom || '-',
      'ROB': item.rob,
      'Min': item.min,
      'Stock': item.stock,
      'Location': item.location,
      'Category': item.storesCategory
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, filename);
    
    toast({ title: "Export Successful", description: `Exported ${data.length} items to ${filename}` });
  };
  
  const exportHistoryToExcel = () => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
    const filename = `stores_${activeTab}_history_${timestamp}.xlsx`;
    
    const data = filteredHistoryItems.map(item => ({
      'Date': item.dateLocal,
      'Event': item.eventType,
      'Item Name': item.itemName,
      'Part Code': item.partCode,
      'UOM': item.uom || '-',
      'Qty Change': item.qtyChange > 0 ? `+${item.qtyChange}` : item.qtyChange.toString(),
      'ROB After': item.robAfter,
      'Place': item.place || '-',
      'User': item.userId,
      'Remarks/Ref': item.remarks || item.ref || '-'
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'History');
    XLSX.writeFile(wb, filename);
    
    toast({ title: "Export Successful", description: `Exported ${data.length} entries to ${filename}` });
  };
  
  // Filter history items
  const filteredHistoryItems = useMemo(() => {
    return historyItems.filter(item => {
      // Filter by search
      if (historySearch && !item.itemName.toLowerCase().includes(historySearch.toLowerCase()) &&
          !item.partCode.toLowerCase().includes(historySearch.toLowerCase())) {
        return false;
      }
      
      // Filter by event type
      if (historyEventFilter !== "all" && item.eventType !== historyEventFilter) {
        return false;
      }
      
      // Filter by date range (would need proper date parsing for production)
      // For now, we'll skip date filtering as it requires proper date handling
      
      return true;
    });
  }, [historyItems, historySearch, historyEventFilter, historyDateFrom, historyDateTo]);

  const handleBulkUpdateChange = (itemId: number, field: 'consumed' | 'received' | 'receivedDate' | 'receivedPlace' | 'comments', value: string) => {
    if (field === 'consumed' || field === 'received') {
      const numValue = parseInt(value) || 0;
      setBulkUpdateData(prev => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          [field]: numValue
        }
      }));
    } else {
      setBulkUpdateData(prev => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          [field]: value
        }
      }));
    }
  };

  const openBulkUpdateModal = () => {
    setIsBulkUpdateModalOpen(true);
    const initialData: typeof bulkUpdateData = {};
    filteredItems.forEach(item => {
      initialData[item.id] = {
        consumed: 0,
        received: 0,
        receivedDate: dateReceived,
        receivedPlace: placeReceived,
        comments: ""
      };
    });
    setBulkUpdateData(initialData);
    setPlaceReceived("");
    setDateReceived(new Date().toISOString().split('T')[0]);
  };

  const saveBulkUpdates = () => {
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    
    const updatedItems = items.map(item => {
      const updateData = bulkUpdateData[item.id];
      if (!updateData) return item;
      
      const consumed = updateData.consumed || 0;
      const received = updateData.received || 0;
      
      if (consumed === 0 && received === 0) {
        skippedCount++;
        return item;
      }
      
      const newRob = item.rob - consumed + received;
      
      // Validate
      if (newRob < 0) {
        failedCount++;
        return item;
      }
      
      if (received > 0 && !dateReceived) {
        failedCount++;
        return item;
      }
      
      // Add history entries
      if (consumed > 0) {
        addToHistory(
          item,
          'CONSUME',
          -consumed,
          newRob,
          '',
          '',
          updateData.comments
        );
      }
      
      if (received > 0) {
        addToHistory(
          item,
          'RECEIVE',
          received,
          newRob,
          placeReceived,
          '',
          updateData.comments
        );
      }
      
      updatedCount++;
      return {
        ...item,
        rob: newRob
      };
    });
    
    setItems(updatedItems);
    setIsBulkUpdateModalOpen(false);
    toast({
      title: "Bulk Update Complete",
      description: `Updated: ${updatedCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`,
    });
  };
  
  // Handle Edit Item
  const openEditModal = (item: StoreItem) => {
    setEditingItem(item);
    const isCustomUom = !UOM_OPTIONS.includes(item.uom || "");
    setEditForm({
      itemName: item.itemName,
      uom: isCustomUom ? "Other" : (item.uom || ""),
      customUom: isCustomUom ? (item.uom || "") : "",
      min: item.min,
      location: item.location,
      notes: item.notes || "",
      ihmPresence: 'Unknown',
      ihmEvidenceType: 'None'
    });
    setIsEditModalOpen(true);
  };
  
  const saveEditItem = () => {
    if (!editingItem) return;
    
    const uom = editForm.uom === "Other" ? editForm.customUom : editForm.uom;
    
    const updatedItems = items.map(item => {
      if (item.id === editingItem.id) {
        const updatedItem = {
          ...item,
          itemName: editForm.itemName,
          uom: uom,
          min: editForm.min,
          location: editForm.location,
          notes: editForm.notes
        };
        
        // Recalculate stock status
        const newStock = calculateStockStatus(item.rob, editForm.min);
        
        // Add to history if min changed
        if (item.min !== editForm.min) {
          addToHistory(
            updatedItem,
            'EDIT',
            0,
            item.rob,
            '',
            '',
            `Min changed from ${item.min} to ${editForm.min}`
          );
        }
        
        return { ...updatedItem, stock: newStock };
      }
      return item;
    });
    
    setItems(updatedItems);
    setIsEditModalOpen(false);
    toast({ title: "Success", description: "Item updated successfully" });
  };
  
  // Handle Receive
  const openReceiveModal = (item: StoreItem) => {
    setReceivingItem(item);
    setReceiveForm({
      quantity: "",
      dateLocal: new Date().toISOString().split('T')[0],
      place: "",
      supplierPO: "",
      remarks: ""
    });
    setIsReceiveModalOpen(true);
  };
  
  const saveReceive = () => {
    if (!receivingItem) return;
    
    const quantity = parseInt(receiveForm.quantity);
    if (!quantity || quantity < 1) {
      toast({ title: "Error", description: "Quantity must be at least 1", variant: "destructive" });
      return;
    }
    
    if (!receiveForm.dateLocal) {
      toast({ title: "Error", description: "Date is required", variant: "destructive" });
      return;
    }
    
    const newRob = receivingItem.rob + quantity;
    
    const updatedItems = items.map(item => {
      if (item.id === receivingItem.id) {
        return {
          ...item,
          rob: newRob
        };
      }
      return item;
    });
    
    // Add to history
    addToHistory(
      receivingItem,
      'RECEIVE',
      quantity,
      newRob,
      receiveForm.place,
      receiveForm.supplierPO,
      receiveForm.remarks
    );
    
    setItems(updatedItems);
    setIsReceiveModalOpen(false);
    toast({ title: "Success", description: `Received ${quantity} ${receivingItem.uom || 'units'}` });
  };
  
  // Handle Consume
  const openConsumeModal = (item: StoreItem) => {
    setConsumingItem(item);
    setConsumeForm({
      quantity: "",
      dateLocal: new Date().toISOString().split('T')[0],
      workOrder: "",
      remarks: ""
    });
    setIsConsumeModalOpen(true);
  };
  
  const saveConsume = () => {
    if (!consumingItem) return;
    
    const quantity = parseInt(consumeForm.quantity);
    if (!quantity || quantity < 1) {
      toast({ title: "Error", description: "Quantity must be at least 1", variant: "destructive" });
      return;
    }
    
    if (!consumeForm.dateLocal) {
      toast({ title: "Error", description: "Date is required", variant: "destructive" });
      return;
    }
    
    if (quantity > consumingItem.rob) {
      toast({ title: "Error", description: "Insufficient stock. Cannot consume more than available ROB", variant: "destructive" });
      return;
    }
    
    const newRob = consumingItem.rob - quantity;
    const newStock = calculateStockStatus(newRob, consumingItem.min);
    
    const updatedItems = items.map(item => {
      if (item.id === consumingItem.id) {
        return {
          ...item,
          rob: newRob,
          stock: newStock
        };
      }
      return item;
    });
    
    // Add to history
    addToHistory(
      consumingItem,
      'CONSUME',
      -quantity,
      newRob,
      '',
      consumeForm.workOrder,
      consumeForm.remarks
    );
    
    setItems(updatedItems);
    setIsConsumeModalOpen(false);
    toast({ title: "Success", description: `Consumed ${quantity} ${consumingItem.uom || 'units'}` });
  };
  
  // Handle Archive
  const handleArchive = (item: StoreItem) => {
    const confirmMessage = item.rob > 0 
      ? `This item has stock on hand (ROB = ${item.rob}). Archive anyway?`
      : `Archive ${item.itemName}?`;
    
    if (confirm(confirmMessage)) {
      const updatedItems = items.map(i => 
        i.id === item.id ? { ...i, isArchived: true } : i
      );
      
      // Add to history
      addToHistory(
        item,
        'ARCHIVE',
        0,
        item.rob,
        '',
        '',
        'Item archived'
      );
      
      setItems(updatedItems);
      toast({ title: "Success", description: "Item archived" });
    }
  };

  return (
    <div className="flex-1 p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {activeTab === "stores" ? "Stores Inventory" : 
           activeTab === "lubes" ? "Lubes Inventory" :
           activeTab === "chemicals" ? "Chemicals Inventory" : "Others Inventory"}
        </h1>
        <Button className="bg-[#52baf3] hover:bg-[#40a8e0] text-white" onClick={openBulkUpdateModal}>
          + Bulk Update {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        <button
          onClick={() => setActiveTab("stores")}
          className={`px-6 py-2 rounded-t text-sm font-medium ${
            activeTab === "stores"
              ? "bg-[#52baf3] text-white"
              : "bg-gray-200 text-gray-600 hover:bg-gray-300"
          }`}
        >
          Stores
        </button>
        <button
          onClick={() => setActiveTab("lubes")}
          className={`px-6 py-2 rounded-t text-sm font-medium ${
            activeTab === "lubes"
              ? "bg-[#52baf3] text-white"
              : "bg-gray-200 text-gray-600 hover:bg-gray-300"
          }`}
        >
          Lubes
        </button>
        <button
          onClick={() => setActiveTab("chemicals")}
          className={`px-6 py-2 rounded-t text-sm font-medium ${
            activeTab === "chemicals"
              ? "bg-[#52baf3] text-white"
              : "bg-gray-200 text-gray-600 hover:bg-gray-300"
          }`}
        >
          Chemicals
        </button>
        <button
          onClick={() => setActiveTab("others")}
          className={`px-6 py-2 rounded-t text-sm font-medium ${
            activeTab === "others"
              ? "bg-[#52baf3] text-white"
              : "bg-gray-200 text-gray-600 hover:bg-gray-300"
          }`}
        >
          Others
        </button>
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={viewMode === "inventory" ? "default" : "outline"}
          onClick={() => setViewMode("inventory")}
          className="text-sm"
        >
          Inventory
        </Button>
        <Button
          variant={viewMode === "history" ? "default" : "outline"}
          onClick={() => setViewMode("history")}
          className="text-sm"
        >
          History
        </Button>
      </div>

      {/* Filters - Show different filters based on view mode */}
      {viewMode === "inventory" ? (
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <Select value={vesselId} onValueChange={setVesselId}>
            <SelectTrigger className="text-sm">
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
        </div>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 text-sm"
          />
        </div>
        <div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40 text-sm">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Engine">Engine Stores</SelectItem>
              <SelectItem value="General">General Tools</SelectItem>
              <SelectItem value="PPE">PPE / All Sections</SelectItem>
              <SelectItem value="Machinery">General Machinery</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-32 text-sm">
              <SelectValue placeholder="Stock" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="OK">OK</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-blue-600"
          onClick={exportInventoryToExcel}
        >
          <FileSpreadsheet className="h-4 w-4 mr-1" />
          Export
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-gray-600"
          onClick={() => {
            setSearchTerm("");
            setCategoryFilter("all");
            setStockFilter("all");
          }}
        >
          Clear
        </Button>
      </div>
      ) : (
      /* History Filters */
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search history..."
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            className="pl-10 text-sm"
          />
        </div>
        <div>
          <Select value={historyEventFilter} onValueChange={setHistoryEventFilter}>
            <SelectTrigger className="w-40 text-sm">
              <SelectValue placeholder="All Events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="RECEIVE">Receive</SelectItem>
              <SelectItem value="CONSUME">Consume</SelectItem>
              <SelectItem value="ARCHIVE">Archive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={historyDateFrom}
            onChange={(e) => setHistoryDateFrom(e.target.value)}
            className="text-sm"
            placeholder="From"
          />
          <span className="text-gray-500">to</span>
          <Input
            type="date"
            value={historyDateTo}
            onChange={(e) => setHistoryDateTo(e.target.value)}
            className="text-sm"
            placeholder="To"
          />
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-blue-600"
          onClick={exportHistoryToExcel}
        >
          <FileSpreadsheet className="h-4 w-4 mr-1" />
          Export
        </Button>
      </div>
      )}

      {/* Table */}
      {viewMode === "inventory" ? (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Table Header */}
        <div className="bg-[#52baf3] text-white p-4">
          <div className="grid gap-4 items-center text-sm font-medium" style={{gridTemplateColumns: FEATURES.IHM ? '2fr 2fr 2fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr 0.6fr 1fr' : '2fr 2fr 2fr 0.8fr 0.8fr 0.8fr 0.8fr 1.5fr 1fr'}}>
            <div>
              {activeTab === "lubes" ? "Lube Grade" : 
               activeTab === "chemicals" ? "Chem Code" : "Item Code"}
            </div>
            <div>
              {activeTab === "lubes" ? "Lube Type" : 
               activeTab === "chemicals" ? "Chemical Name" : "Item Name"}
            </div>
            <div>
              {activeTab === "lubes" ? "Application" : 
               activeTab === "chemicals" ? "Application Area" : "Stores Category"}
            </div>
            <div>UOM</div>
            <div>
              {activeTab === "lubes" || activeTab === "chemicals" ? "ROB" : "ROB"}
            </div>
            <div>Min</div>
            <div>Stock</div>
            <div>Location</div>
            {FEATURES.IHM && <div className="text-center">IHM</div>}
            <div className="text-right pr-2">Actions</div>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-gray-200">
          {filteredItems.map((item) => (
            <div key={item.id} className="hover:bg-gray-50">
              <div className="grid gap-4 items-center text-sm py-3 px-4" style={{gridTemplateColumns: FEATURES.IHM ? '2fr 2fr 2fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr 0.6fr 1fr' : '2fr 2fr 2fr 0.8fr 0.8fr 0.8fr 0.8fr 1.5fr 1fr'}}>
                <div className="font-medium text-gray-900 truncate">
                  {item.itemCode}
                </div>
                <div className="text-gray-700 truncate">
                  {item.itemName}
                </div>
                <div className="text-gray-600 truncate">
                  {item.storesCategory}
                </div>
                <div className="text-gray-700 text-center">
                  {item.uom || "-"}
                </div>
                <div className="text-gray-700 text-center">
                  {item.rob}
                </div>
                <div className="text-gray-700 text-center">
                  {item.min}
                </div>
                <div className="text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium inline-block ${getStockColor(item.stock)}`}>
                    {item.stock}
                  </span>
                </div>
                {/* Location Dropdown */}
                <div className="relative">
                  {(() => {
                    const robA = item.robLocationA ?? 0;
                    const robB = item.robLocationB ?? 0;
                    const locationDisplay = `${robA + robB}...`;
                    const isDropdownOpen = openLocationDropdown === item.id;
                    
                    return (
                      <>
                        <button
                          onClick={() => handleOpenLocationDropdown(item)}
                          className="flex items-center gap-1 text-gray-700 hover:text-blue-600 cursor-pointer w-full text-left"
                          data-testid={`button-location-${item.id}`}
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
                              <div className="text-xs font-medium text-gray-500 mb-2">ROB by Location</div>
                              <div>
                                <Input
                                  type="text"
                                  value={editingLocations[item.id]?.nameA || locationNames.locationA || 'Location A'}
                                  onChange={(e) => setEditingLocations(prev => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], nameA: e.target.value }
                                  }))}
                                  className="h-6 text-xs font-medium text-gray-600 mb-1 border-dashed"
                                  placeholder="Location A name"
                                  data-testid={`input-nameA-${item.id}`}
                                />
                                <Input
                                  type="number"
                                  min="0"
                                  value={editingLocations[item.id]?.locationA || '0'}
                                  onChange={(e) => setEditingLocations(prev => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], locationA: e.target.value }
                                  }))}
                                  className="h-8 text-sm"
                                  placeholder="0"
                                  data-testid={`input-locationA-${item.id}`}
                                />
                              </div>
                              <div>
                                <Input
                                  type="text"
                                  value={editingLocations[item.id]?.nameB || locationNames.locationB || 'Location B'}
                                  onChange={(e) => setEditingLocations(prev => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], nameB: e.target.value }
                                  }))}
                                  className="h-6 text-xs font-medium text-gray-600 mb-1 border-dashed"
                                  placeholder="Location B name"
                                  data-testid={`input-nameB-${item.id}`}
                                />
                                <Input
                                  type="number"
                                  min="0"
                                  value={editingLocations[item.id]?.locationB || '0'}
                                  onChange={(e) => setEditingLocations(prev => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], locationB: e.target.value }
                                  }))}
                                  className="h-8 text-sm"
                                  placeholder="0"
                                  data-testid={`input-locationB-${item.id}`}
                                />
                              </div>
                              <div className="text-xs text-gray-500 text-center border-t pt-2">
                                Total ROB: {(parseInt(editingLocations[item.id]?.locationA) || 0) + (parseInt(editingLocations[item.id]?.locationB) || 0)}
                              </div>
                              <Button
                                size="sm"
                                className="w-full h-7 text-xs"
                                onClick={() => {
                                  handleSaveLocation(item.id);
                                  setOpenLocationDropdown(null);
                                }}
                                data-testid={`button-save-location-${item.id}`}
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                {FEATURES.IHM && (
                  <div className="flex justify-center">
                    {/* Mock IHM status - in real implementation, would come from API */}
                    {item.itemCode === 'ST-TOOL-001' ? (
                      <div title="IHM Present">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      </div>
                    ) : item.itemCode === 'ST-CONS-001' ? (
                      <div title="IHM Not Present">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </div>
                    ) : (
                      <div title="IHM Unknown">
                        <HelpCircle className="h-4 w-4 text-gray-400" />
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-1 justify-end pr-2 whitespace-nowrap">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0 hover:bg-gray-100"
                    onClick={() => openEditModal(item)}
                    aria-label="Edit Item"
                    title="Edit"
                  >
                    <Edit className="h-3.5 w-3.5 text-gray-500" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0 hover:bg-gray-100"
                    onClick={() => openConsumeModal(item)}
                    aria-label="Consume Item"
                    title="Consume"
                  >
                    <Minus className="h-3.5 w-3.5 text-gray-500" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0 hover:bg-gray-100"
                    onClick={() => openReceiveModal(item)}
                    aria-label="Receive Item"
                    title="Receive"
                  >
                    <Plus className="h-3.5 w-3.5 text-gray-500" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0 hover:bg-gray-100"
                    onClick={() => handleArchive(item)}
                    aria-label="Archive Item"
                    title="Archive"
                  >
                    <Archive className="h-3.5 w-3.5 text-gray-400" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      ) : (
      /* History Table */
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-[#52baf3] text-white p-4">
          <div className="grid grid-cols-12 gap-4 items-center text-sm font-medium">
            <div className="col-span-2">Date/Time</div>
            <div className="col-span-1">Event</div>
            <div className="col-span-2">Item Name</div>
            <div className="col-span-1">Part Code</div>
            <div className="col-span-1">UOM</div>
            <div className="col-span-1">Qty Change</div>
            <div className="col-span-1">ROB After</div>
            <div className="col-span-1">Place</div>
            <div className="col-span-1">User</div>
            <div className="col-span-1">Remarks</div>
          </div>
        </div>
        
        <div className="divide-y divide-gray-200">
          {filteredHistoryItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No history entries found. Actions like Receive, Consume, and Archive will appear here.
            </div>
          ) : (
            filteredHistoryItems.map((item) => (
              <div key={item.id} className="p-4 hover:bg-gray-50">
                <div className="grid grid-cols-12 gap-4 items-center text-sm">
                  <div className="col-span-2 text-gray-700">{item.dateLocal}</div>
                  <div className="col-span-1">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      item.eventType === 'RECEIVE' ? 'bg-green-100 text-green-800' :
                      item.eventType === 'CONSUME' ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {item.eventType}
                    </span>
                  </div>
                  <div className="col-span-2 text-gray-700">{item.itemName}</div>
                  <div className="col-span-1 text-gray-600">{item.partCode}</div>
                  <div className="col-span-1 text-gray-600">{item.uom || '-'}</div>
                  <div className="col-span-1">
                    <span className={item.qtyChange > 0 ? 'text-green-600' : 'text-orange-600'}>
                      {item.qtyChange > 0 ? '+' : ''}{item.qtyChange}
                    </span>
                  </div>
                  <div className="col-span-1 text-gray-700">{item.robAfter}</div>
                  <div className="col-span-1 text-gray-600">{item.place || '-'}</div>
                  <div className="col-span-1 text-gray-600">{item.userId}</div>
                  <div className="col-span-1 text-gray-600 truncate" title={item.remarks || item.ref}>
                    {item.remarks || item.ref || '-'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      )}

      {/* Edit Item Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="itemName">Item Name</Label>
              <Input
                id="itemName"
                value={editForm.itemName}
                onChange={(e) => setEditForm({...editForm, itemName: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="uom">Unit of Measure</Label>
              <Select 
                value={editForm.uom} 
                onValueChange={(value) => setEditForm({...editForm, uom: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select UOM" />
                </SelectTrigger>
                <SelectContent>
                  {UOM_OPTIONS.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editForm.uom === "Other" && (
                <Input
                  placeholder="Enter custom UOM"
                  value={editForm.customUom}
                  onChange={(e) => setEditForm({...editForm, customUom: e.target.value})}
                />
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="min">Minimum Stock</Label>
              <Input
                id="min"
                type="number"
                min="0"
                value={editForm.min}
                onChange={(e) => setEditForm({...editForm, min: parseInt(e.target.value) || 0})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={editForm.location}
                onChange={(e) => setEditForm({...editForm, location: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={editForm.notes}
                onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                rows={3}
              />
            </div>
            
            {/* IHM Fields */}
            {FEATURES.IHM && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="ihmPresence">IHM Presence</Label>
                  <Select 
                    value={editForm.ihmPresence || "Unknown"} 
                    onValueChange={(value) => setEditForm({...editForm, ihmPresence: value as typeof IHM_PRESENCE[number]})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select IHM presence" />
                    </SelectTrigger>
                    <SelectContent>
                      {IHM_PRESENCE.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ihmEvidenceType">IHM Evidence Type</Label>
                  <Select 
                    value={editForm.ihmEvidenceType || "None"} 
                    onValueChange={(value) => setEditForm({...editForm, ihmEvidenceType: value as typeof IHM_EVIDENCE_TYPES[number]})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select evidence type" />
                    </SelectTrigger>
                    <SelectContent>
                      {IHM_EVIDENCE_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEditItem}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Item Modal */}
      <Dialog open={isReceiveModalOpen} onOpenChange={setIsReceiveModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Receive {receivingItem?.itemName}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="quantity">
                Quantity to Receive ({receivingItem?.uom || 'units'})
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={receiveForm.quantity}
                onChange={(e) => setReceiveForm({...receiveForm, quantity: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dateLocal">Date Received</Label>
              <Input
                id="dateLocal"
                type="date"
                value={receiveForm.dateLocal}
                onChange={(e) => setReceiveForm({...receiveForm, dateLocal: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="place">Place/Port</Label>
              <Input
                id="place"
                value={receiveForm.place}
                onChange={(e) => setReceiveForm({...receiveForm, place: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplierPO">Supplier/PO#</Label>
              <Input
                id="supplierPO"
                value={receiveForm.supplierPO}
                onChange={(e) => setReceiveForm({...receiveForm, supplierPO: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                value={receiveForm.remarks}
                onChange={(e) => setReceiveForm({...receiveForm, remarks: e.target.value})}
                rows={3}
              />
            </div>
            
            {/* IHM Warning - only show if feature is enabled and status is unknown */}
            {FEATURES.IHM && receivingItem && (
              <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-800">IHM Status Check Required</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      This item has unknown IHM status or missing evidence. 
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
            <Button onClick={saveReceive}>Receive</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Consume Item Modal */}
      <Dialog open={isConsumeModalOpen} onOpenChange={setIsConsumeModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Consume {consumingItem?.itemName}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="bg-gray-50 p-3 rounded">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Current ROB:</span>
                <span className="font-medium">{consumingItem?.rob} {consumingItem?.uom || 'units'}</span>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="consume-quantity">
                Quantity to Consume ({consumingItem?.uom || 'units'})
              </Label>
              <Input
                id="consume-quantity"
                type="number"
                min="1"
                max={consumingItem?.rob}
                value={consumeForm.quantity}
                onChange={(e) => setConsumeForm({...consumeForm, quantity: e.target.value})}
                placeholder={`Max: ${consumingItem?.rob}`}
              />
              {consumeForm.quantity && parseInt(consumeForm.quantity) > (consumingItem?.rob || 0) && (
                <p className="text-xs text-red-600">Cannot consume more than available stock</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="consume-date">Date Consumed</Label>
              <Input
                id="consume-date"
                type="date"
                value={consumeForm.dateLocal}
                onChange={(e) => setConsumeForm({...consumeForm, dateLocal: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="consume-workOrder">Work Order / Reference</Label>
              <Input
                id="consume-workOrder"
                value={consumeForm.workOrder}
                onChange={(e) => setConsumeForm({...consumeForm, workOrder: e.target.value})}
                placeholder="e.g., WO-2024-001"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="consume-remarks">Remarks</Label>
              <Textarea
                id="consume-remarks"
                value={consumeForm.remarks}
                onChange={(e) => setConsumeForm({...consumeForm, remarks: e.target.value})}
                rows={3}
                placeholder="Additional notes or reason for consumption"
              />
            </div>
            {consumeForm.quantity && consumingItem && (
              <div className="bg-blue-50 p-3 rounded">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-700">ROB After Consumption:</span>
                  <span className={`font-medium ${
                    (consumingItem.rob - parseInt(consumeForm.quantity)) < consumingItem.min 
                      ? 'text-red-600' 
                      : 'text-blue-700'
                  }`}>
                    {consumingItem.rob - parseInt(consumeForm.quantity)} {consumingItem.uom || 'units'}
                    {(consumingItem.rob - parseInt(consumeForm.quantity)) < consumingItem.min && 
                      <span className="text-xs ml-2">(Below minimum)</span>
                    }
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConsumeModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={saveConsume}
              disabled={!consumeForm.quantity || parseInt(consumeForm.quantity) > (consumingItem?.rob || 0)}
            >
              Consume
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Update Stores Modal */}
      {isBulkUpdateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-[95%] max-w-7xl max-h-[90vh] overflow-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold text-gray-800">Bulk Update {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
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
              <div className="grid grid-cols-9 gap-3 bg-gray-50 p-3 rounded-t text-sm font-medium text-gray-600 border">
                <div>
                  {activeTab === "lubes" ? "Lube Grade" : 
                   activeTab === "chemicals" ? "Chem Code" : "Item Code"}
                </div>
                <div>
                  {activeTab === "lubes" ? "Lube Type" : 
                   activeTab === "chemicals" ? "Chemical Name" : "Item Name"}
                </div>
                <div>
                  {activeTab === "lubes" ? "Application" : 
                   activeTab === "chemicals" ? "Application Area" : "Category"}
                </div>
                <div>UOM</div>
                <div>ROB</div>
                <div>Consumed</div>
                <div>Received</div>
                <div>New ROB</div>
                <div>Comments</div>
              </div>

              {/* Table Body */}
              <div className="border border-t-0 rounded-b max-h-[400px] overflow-y-auto">
                {filteredItems.map((item) => {
                  const consumed = bulkUpdateData[item.id]?.consumed || 0;
                  const received = bulkUpdateData[item.id]?.received || 0;
                  const newRob = item.rob - consumed + received;
                  const hasError = newRob < 0 || (received > 0 && !bulkUpdateData[item.id]?.receivedDate);
                  
                  return (
                    <div key={item.id} className={`grid grid-cols-9 gap-3 p-3 border-b ${hasError ? 'bg-red-50' : 'bg-white'} items-center`}>
                      <div className="text-gray-900 text-sm">{item.itemCode}</div>
                      <div className="text-gray-900 text-sm">{item.itemName}</div>
                      <div className="text-gray-700 text-sm">{item.storesCategory}</div>
                      <div className="text-gray-700 text-sm">{item.uom || "-"}</div>
                      <div className="text-gray-700 text-sm">{item.rob}</div>
                      <div>
                        <Input 
                          type="number" 
                          min="0" 
                          max={item.rob}
                          className={`text-sm h-8 ${newRob < 0 ? 'border-red-500' : ''}`}
                          placeholder="0"
                          value={consumed || ''}
                          onChange={(e) => handleBulkUpdateChange(item.id, 'consumed', e.target.value)}
                        />
                      </div>
                      <div>
                        <Input 
                          type="number" 
                          min="0" 
                          className="text-sm h-8" 
                          placeholder="0"
                          value={received || ''}
                          onChange={(e) => handleBulkUpdateChange(item.id, 'received', e.target.value)}
                        />
                      </div>
                      <div className={`text-sm font-medium ${newRob < 0 ? 'text-red-600' : newRob < item.min ? 'text-yellow-600' : 'text-gray-900'}`}>
                        {newRob}
                        {newRob < 0 && <div className="text-xs">Insufficient stock</div>}
                      </div>
                      <div>
                        <Input
                          type="text"
                          className="text-sm h-8"
                          placeholder="Comments"
                          value={bulkUpdateData[item.id]?.comments || ''}
                          onChange={(e) => handleBulkUpdateChange(item.id, 'comments', e.target.value)}
                        />
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
              >
                Cancel
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={saveBulkUpdates}
              >
                Save Updates
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stores;