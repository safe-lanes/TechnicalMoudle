import React, { useState, useMemo, useEffect, useRef } from "react";
import { useModifyMode } from "@/hooks/useModifyMode";
import { useVessel } from "@/contexts/VesselContext";
import { Marker } from "@/components/Marker";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Edit2, Clock, Trash2, FileSpreadsheet, X, MessageSquare, Calendar, PlusCircle, MinusCircle, Download, AlertCircle, CheckCircle, HelpCircle, MapPin, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import * as XLSX from "xlsx";
import { FEATURES } from "@/config/features";
import { useVessels } from "@/hooks/useVessels";
import { ModifyStickyFooter } from "@/components/modify/ModifyStickyFooter";
import { format } from "date-fns";

// Helper function to get marker prefix based on active tab
const getMarkerPrefix = (tab: "stores" | "lubes" | "chemicals" | "others") => {
  switch (tab) {
    case "stores": return "F.S";
    case "lubes": return "F.L";
    case "chemicals": return "F.C";
    case "others": return "F.O";
    default: return "F.S";
  }
};

// Helper function to create marker ID based on tab and suffix
const getMarkerId = (tab: "stores" | "lubes" | "chemicals" | "others", suffix: string) => {
  return `${getMarkerPrefix(tab)}.${suffix}`;
};

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
  const [, navigate] = useLocation();
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
  const [bulkUpdateData, setBulkUpdateData] = useState<{[key: number]: {consumed: number, received: number, consumedLocationA?: number, consumedLocationB?: number, receivedLocationA?: number, receivedLocationB?: number, receivedDate?: string, receivedPlace?: string, comments?: string}}>({});
  const [bulkSearchQuery, setBulkSearchQuery] = useState("");
  const [placeReceived, setPlaceReceived] = useState("");
  const [dateReceived, setDateReceived] = useState("");
  const [items, setItems] = useState<StoreItem[]>([]);
  
  // Modify mode state - use proper hook for reactivity
  const { isModifyMode } = useModifyMode();
  const [showModifySubmitFooter, setShowModifySubmitFooter] = useState(false);
  const [originalStoreData, setOriginalStoreData] = useState<StoreItem | null>(null);
  const [isSubmittingChangeRequest, setIsSubmittingChangeRequest] = useState(false);
  
  // Enable modify footer when in modify mode
  useEffect(() => {
    if (isModifyMode) {
      setShowModifySubmitFooter(true);
    }
  }, [isModifyMode]);
  
  // Location dropdown state
  const [openLocationDropdown, setOpenLocationDropdown] = useState<number | null>(null);
  const [editingLocations, setEditingLocations] = useState<{[key: number]: {locationA: string, locationB: string, nameA?: string, nameB?: string}}>({});
  const locationDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch stores items from API - uses default TanStack Query fetcher
  // The query key includes the full URL with query parameters
  const { data: storesData = [], isLoading: storesLoading } = useQuery<StoresApiItem[]>({
    queryKey: vesselId ? [`/technical/api/stores/${vesselId}?itemType=${activeTab}`] : ['stores-disabled'],
    enabled: !!vesselId,
  });
  
  // Fetch vessel location names
  const { data: locationNamesData } = useQuery({
    queryKey: [`/technical/api/vessel-location-names/${vesselId}`],
    queryFn: async () => {
      const response = await fetch(`/technical/api/vessel-location-names/${vesselId}`);
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
    queryKey: vesselId ? [`/technical/api/stores/${vesselId}/history`, activeTab] : ['history-disabled'],
    queryFn: async () => {
      const response = await fetch(`/technical/api/stores/${vesselId}/history?itemType=${activeTab}`);
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json();
    },
    enabled: !!vesselId && viewMode === 'history',
  });

  // Map history API data to StoresHistoryItem format
  // Uses storesLedger schema fields: itemId, eventType, timestampUTC, qtyChangeBase, robAfterBase, userId, remarks, ref, itemName, partCode
  
  // Helper to format date consistently - show time only if present in source
  const formatHistoryDate = (dateLocal: string | undefined, timestampUTC: string | undefined): string => {
    try {
      // Check if dateLocal is a date-only string (YYYY-MM-DD format)
      const isDateOnly = dateLocal && /^\d{4}-\d{2}-\d{2}$/.test(dateLocal.trim());
      
      if (dateLocal) {
        // For date-only strings, append T00:00:00 to treat as local time and avoid timezone drift
        const dateStr = isDateOnly ? `${dateLocal.trim()}T00:00:00` : dateLocal;
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          // Only show time if original data includes time component
          return isDateOnly ? format(date, 'dd-MMM-yyyy') : format(date, 'dd-MMM-yyyy HH:mm');
        }
      }
      if (timestampUTC) {
        const date = new Date(timestampUTC);
        if (!isNaN(date.getTime())) {
          return format(date, 'dd-MMM-yyyy HH:mm');
        }
      }
      return '-';
    } catch {
      return '-';
    }
  };
  
  const historyItems: StoresHistoryItem[] = useMemo(() => {
    if (!historyData || historyData.length === 0) return [];
    
    return historyData.map((entry: any) => {
      return {
        id: entry.id,
        dateLocal: formatHistoryDate(entry.dateLocal, entry.timestampUTC),
        eventType: entry.eventType?.toUpperCase() || 'UNKNOWN',
        itemName: entry.itemName || `Item #${entry.itemId}`,
        partCode: entry.partCode || '',
        uom: entry.uom || '',
        qtyChange: Number(entry.qtyChangeBase) || 0,
        robAfter: Number(entry.robAfterBase) || 0,
        place: entry.place || '',
        userId: entry.userId || 'System',
        remarks: entry.remarks || '',
        ref: entry.ref || '',
      };
    }).sort((a: StoresHistoryItem, b: StoresHistoryItem) => b.id - a.id);
  }, [historyData]);

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
    
    const newRobA = parseInt(locations.locationA) || 0;
    const newRobB = parseInt(locations.locationB) || 0;
    
    // Get original values from items
    const originalItem = items.find(i => i.id === itemId);
    if (!originalItem) return;
    
    const oldRobA = originalItem.robLocationA ?? 0;
    const oldRobB = originalItem.robLocationB ?? 0;
    
    // Check if ROB changed
    const robChanged = newRobA !== oldRobA || newRobB !== oldRobB;
    
    // If no ROB change, just save location names
    if (!robChanged) {
      if (locations.nameA || locations.nameB) {
        try {
          await fetch(`/technical/api/vessel-location-names/${vesselId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              locationAName: locations.nameA || locationNames.locationA || 'Location A',
              locationBName: locations.nameB || locationNames.locationB || 'Location B'
            }),
          });
          queryClient.invalidateQueries({ queryKey: [`/technical/api/vessel-location-names/${vesselId}`] });
        } catch (error) {
          console.error('Failed to save location names:', error);
        }
      }
      return;
    }
    
    try {
      // Use PATCH endpoint which routes location changes through ledger-aware transferStoresItemLocation
      await apiRequest('PATCH', `/technical/api/stores/${vesselId}/${itemId}`, {
        robLocationA: newRobA,
        robLocationB: newRobB
      });
      
      // Save location names to vessel settings if they were edited
      if (locations.nameA || locations.nameB) {
        await fetch(`/technical/api/vessel-location-names/${vesselId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            locationAName: locations.nameA || locationNames.locationA || 'Location A',
            locationBName: locations.nameB || locationNames.locationB || 'Location B'
          }),
        });
        queryClient.invalidateQueries({ queryKey: [`/technical/api/vessel-location-names/${vesselId}`] });
      }
      
      queryClient.invalidateQueries({ queryKey: [`/technical/api/stores/${vesselId}?itemType=${activeTab}`] });
      queryClient.invalidateQueries({ queryKey: [`/technical/api/stores/${vesselId}/history`, activeTab] });
      
      // Calculate delta for toast message
      const deltaA = newRobA - oldRobA;
      const deltaB = newRobB - oldRobB;
      const locAName = locations.nameA || locationNames.locationA || 'Location A';
      const locBName = locations.nameB || locationNames.locationB || 'Location B';
      
      let description = '';
      if (deltaA !== 0 && deltaB !== 0) {
        description = `${deltaA > 0 ? '+' : ''}${deltaA} ${locAName}, ${deltaB > 0 ? '+' : ''}${deltaB} ${locBName}`;
      } else if (deltaA !== 0) {
        description = `${deltaA > 0 ? '+' : ''}${deltaA} ${locAName}`;
      } else if (deltaB !== 0) {
        description = `${deltaB > 0 ? '+' : ''}${deltaB} ${locBName}`;
      }
      
      toast({ title: "Inventory Updated", description });
    } catch (error: any) {
      console.error('Failed to save location:', error);
      toast({ title: "Error", description: error.message || "Failed to update inventory", variant: "destructive" });
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
  
  // Combined consume/receive selection modal (matches Spares workflow)
  const [isConsumeReceiveModalOpen, setIsConsumeReceiveModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);
  
  // Receive modal state
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receivingItem, setReceivingItem] = useState<StoreItem | null>(null);
  const [isConsumeModalOpen, setIsConsumeModalOpen] = useState(false);
  const [consumingItem, setConsumingItem] = useState<StoreItem | null>(null);
  const [consumeForm, setConsumeForm] = useState({
    quantity: "",
    location: "A" as "A" | "B",
    dateLocal: new Date().toISOString().split('T')[0],
    workOrder: "",
    remarks: ""
  });
  const [receiveForm, setReceiveForm] = useState({
    quantity: "",
    location: "A" as "A" | "B",
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
    queryClient.invalidateQueries({ queryKey: [`/technical/api/stores/${vesselId}/history`, activeTab] });
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

  // Filter items for bulk update modal search
  const bulkModalFilteredItems = useMemo(() => {
    if (!bulkSearchQuery.trim()) return filteredItems;
    const query = bulkSearchQuery.toLowerCase();
    return filteredItems.filter(item => 
      item.itemCode.toLowerCase().includes(query) ||
      item.itemName.toLowerCase().includes(query) ||
      item.storesCategory.toLowerCase().includes(query)
    );
  }, [filteredItems, bulkSearchQuery]);

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

  const handleBulkUpdateChange = (itemId: number, field: 'consumed' | 'received' | 'consumedLocationA' | 'consumedLocationB' | 'receivedLocationA' | 'receivedLocationB' | 'receivedDate' | 'receivedPlace' | 'comments', value: string) => {
    if (field === 'consumed' || field === 'received' || field === 'consumedLocationA' || field === 'consumedLocationB' || field === 'receivedLocationA' || field === 'receivedLocationB') {
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

  // Handle bulk update - navigate to full-screen page
  const openBulkUpdateModal = () => {
    navigate(`/stores/bulk-update?tab=${activeTab}`);
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
    
    // In modify mode, store original data for change tracking
    if (isModifyMode) {
      setOriginalStoreData(item);
    }
    
    setIsEditModalOpen(true);
  };
  
  // Get changed fields for modify mode
  const getStoreChangedFields = (): Array<{field: string, oldValue: any, newValue: any}> => {
    if (!originalStoreData || !editingItem) return [];
    
    const changes: Array<{field: string, oldValue: any, newValue: any}> = [];
    const uom = editForm.uom === "Other" ? editForm.customUom : editForm.uom;
    
    const fieldsToCheck = [
      { key: 'itemName', original: originalStoreData.itemName, current: editForm.itemName },
      { key: 'uom', original: originalStoreData.uom, current: uom },
      { key: 'min', original: String(originalStoreData.min), current: String(editForm.min) },
      { key: 'location', original: originalStoreData.location, current: editForm.location },
      { key: 'notes', original: originalStoreData.notes || '', current: editForm.notes }
    ];
    
    for (const field of fieldsToCheck) {
      if (String(field.original || '') !== String(field.current || '')) {
        changes.push({
          field: field.key,
          oldValue: field.original || '',
          newValue: field.current || ''
        });
      }
    }
    
    return changes;
  };
  
  // Handle submit change request for stores
  const handleModifySubmit = async () => {
    if (!editingItem || !originalStoreData) {
      toast({
        title: "No store item selected",
        description: "Please select and edit a store item to submit for approval.",
        variant: "destructive"
      });
      return;
    }
    
    const changes = getStoreChangedFields();
    
    if (changes.length === 0) {
      toast({
        title: "No changes detected",
        description: "Please make some changes before submitting for approval.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmittingChangeRequest(true);
    
    try {
      await apiRequest('POST', '/technical/api/change-requests', {
        vesselId: vesselId || 'V001',
        category: 'stores',
        title: `Store Change: ${originalStoreData.itemCode} - ${originalStoreData.itemName}`,
        reason: `Modification request for store item ${originalStoreData.itemCode}`,
        targetType: 'store',
        targetId: String(originalStoreData.id),
        snapshotBeforeJson: originalStoreData,
        proposedChangesJson: changes,
        status: 'submitted',
        requestedByUserId: 'Current User'
      });
      
      queryClient.invalidateQueries({ queryKey: ['/technical/api/change-requests'] });
      
      toast({
        title: "Change request submitted",
        description: "Your modification request has been submitted for approval."
      });
      
      // Close edit modal and navigate back
      setIsEditModalOpen(false);
      setOriginalStoreData(null);
      navigate("/pms/modify-pms");
    } catch (error) {
      console.error('Error submitting change request:', error);
      toast({
        title: "Error",
        description: "Failed to submit change request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmittingChangeRequest(false);
    }
  };
  
  // Cancel modify mode
  const handleCancelModify = () => {
    setShowModifySubmitFooter(false);
    setOriginalStoreData(null);
    navigate("/pms/modify-pms");
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
  
  // Open combined consume/receive selection modal (matches Spares workflow)
  const openConsumeReceiveModal = (item: StoreItem) => {
    setSelectedItem(item);
    setIsConsumeReceiveModalOpen(true);
  };
  
  // Handle Receive
  const openReceiveModal = (item: StoreItem) => {
    setReceivingItem(item);
    setReceiveForm({
      quantity: "",
      location: "A",
      dateLocal: new Date().toISOString().split('T')[0],
      place: "",
      supplierPO: "",
      remarks: ""
    });
    setIsReceiveModalOpen(true);
  };
  
  const saveReceive = async () => {
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
    
    try {
      await apiRequest('POST', `/technical/api/stores/${vesselId}/batch-receive`, {
        items: [{
          itemId: receivingItem.id,
          quantity: quantity,
          location: receiveForm.location,
          notes: receiveForm.remarks || undefined,
          place: receiveForm.place || undefined,
          dateLocal: receiveForm.dateLocal
        }],
        purchaseOrderRef: receiveForm.supplierPO || undefined
      });
      
      queryClient.invalidateQueries({ queryKey: [`/technical/api/stores/${vesselId}?itemType=${activeTab}`] });
      queryClient.invalidateQueries({ queryKey: [`/technical/api/stores/${vesselId}/history`, activeTab] });
      setIsReceiveModalOpen(false);
      const locationName = receiveForm.location === "A" ? locationNames.locationA : locationNames.locationB;
      toast({ title: "Inventory Updated", description: `+${quantity} to ${locationName}` });
    } catch (error: any) {
      console.error('Failed to receive item:', error);
      toast({ title: "Error", description: error.message || "Failed to receive item", variant: "destructive" });
    }
  };
  
  // Handle Consume
  const openConsumeModal = (item: StoreItem) => {
    setConsumingItem(item);
    setConsumeForm({
      quantity: "",
      location: "A",
      dateLocal: new Date().toISOString().split('T')[0],
      workOrder: "",
      remarks: ""
    });
    setIsConsumeModalOpen(true);
  };
  
  // Helper to get stock at selected location
  const getLocationStock = (item: StoreItem | null, location: "A" | "B"): number => {
    if (!item) return 0;
    return location === "A" ? (item.robLocationA ?? 0) : (item.robLocationB ?? 0);
  };
  
  const saveConsume = async () => {
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
    
    // Validate per-location stock
    const locationStock = getLocationStock(consumingItem, consumeForm.location);
    const locationName = consumeForm.location === "A" ? locationNames.locationA : locationNames.locationB;
    if (quantity > locationStock) {
      toast({ title: "Error", description: `Insufficient stock at ${locationName}. Available: ${locationStock}`, variant: "destructive" });
      return;
    }
    
    try {
      await apiRequest('POST', `/technical/api/stores/${vesselId}/batch-consume`, {
        items: [{
          itemId: consumingItem.id,
          quantity: quantity,
          location: consumeForm.location,
          notes: `${consumeForm.workOrder ? `WO: ${consumeForm.workOrder}. ` : ''}${consumeForm.remarks || ''}`.trim() || undefined,
          dateLocal: consumeForm.dateLocal
        }]
      });
      
      queryClient.invalidateQueries({ queryKey: [`/technical/api/stores/${vesselId}?itemType=${activeTab}`] });
      queryClient.invalidateQueries({ queryKey: [`/technical/api/stores/${vesselId}/history`, activeTab] });
      setIsConsumeModalOpen(false);
      const locationName = consumeForm.location === "A" ? locationNames.locationA : locationNames.locationB;
      toast({ title: "Inventory Updated", description: `-${quantity} from ${locationName}` });
    } catch (error: any) {
      console.error('Failed to consume item:', error);
      toast({ title: "Error", description: error.message || "Failed to consume item", variant: "destructive" });
    }
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
  
  // Handle Delete (using apiRequest for consistency with Spares pattern)
  const handleDelete = async (item: StoreItem) => {
    if (confirm(`Delete ${item.itemName}? This action cannot be undone.`)) {
      try {
        await apiRequest('DELETE', `/technical/api/stores/item/${item.id}`);
        
        queryClient.invalidateQueries({ queryKey: [`/technical/api/stores/${vesselId}?itemType=${activeTab}`] });
        queryClient.invalidateQueries({ queryKey: [`/technical/api/stores/${vesselId}/history`, activeTab] });
        toast({ title: "Success", description: "Item deleted" });
      } catch (error) {
        console.error('Failed to delete item:', error);
        toast({ title: "Error", description: "Failed to delete item", variant: "destructive" });
      }
    }
  };

  return (
    <div className="flex-1 p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-800" data-testid={viewMode === "inventory" ? getMarkerId(activeTab, "33") : getMarkerId(activeTab, "2.1")}>
            {viewMode === "inventory" && <Marker id={getMarkerId(activeTab, "33")} />}
            {viewMode === "history" && <Marker id={getMarkerId(activeTab, "2.1")} />}
            {activeTab === "stores" ? "Stores Inventory" : 
             activeTab === "lubes" ? "Lubes Inventory" :
             activeTab === "chemicals" ? "Chemicals Inventory" : "Others Inventory"}
          </h1>
          {isModifyMode && (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full border border-blue-300">
              Modify Mode
            </span>
          )}
        </div>
        <Button 
          className="bg-[#52baf3] hover:bg-[#40a8e0] text-white" 
          onClick={openBulkUpdateModal}
          data-testid={viewMode === "inventory" ? getMarkerId(activeTab, "3") : getMarkerId(activeTab, "2.6")}
        >
          {viewMode === "inventory" && <Marker id={getMarkerId(activeTab, "3")} />}
          {viewMode === "history" && <Marker id={getMarkerId(activeTab, "2.6")} />}
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
          data-testid={viewMode === "inventory" ? "F.S" : getMarkerId(activeTab, "2.2")}
        >
          {viewMode === "inventory" && <Marker id="F.S" />}
          {viewMode === "history" && <Marker id={getMarkerId(activeTab, "2.2")} />}
          Stores
        </button>
        <button
          onClick={() => setActiveTab("lubes")}
          className={`px-6 py-2 rounded-t text-sm font-medium ${
            activeTab === "lubes"
              ? "bg-[#52baf3] text-white"
              : "bg-gray-200 text-gray-600 hover:bg-gray-300"
          }`}
          data-testid={viewMode === "inventory" ? "F.L" : getMarkerId(activeTab, "2.3")}
        >
          {viewMode === "inventory" && <Marker id="F.L" />}
          {viewMode === "history" && <Marker id={getMarkerId(activeTab, "2.3")} />}
          Lubes
        </button>
        <button
          onClick={() => setActiveTab("chemicals")}
          className={`px-6 py-2 rounded-t text-sm font-medium ${
            activeTab === "chemicals"
              ? "bg-[#52baf3] text-white"
              : "bg-gray-200 text-gray-600 hover:bg-gray-300"
          }`}
          data-testid={viewMode === "inventory" ? "F.C" : getMarkerId(activeTab, "2.4")}
        >
          {viewMode === "inventory" && <Marker id="F.C" />}
          {viewMode === "history" && <Marker id={getMarkerId(activeTab, "2.4")} />}
          Chemicals
        </button>
        <button
          onClick={() => setActiveTab("others")}
          className={`px-6 py-2 rounded-t text-sm font-medium ${
            activeTab === "others"
              ? "bg-[#52baf3] text-white"
              : "bg-gray-200 text-gray-600 hover:bg-gray-300"
          }`}
          data-testid={viewMode === "inventory" ? "F.O" : getMarkerId(activeTab, "2.5")}
        >
          {viewMode === "inventory" && <Marker id="F.O" />}
          {viewMode === "history" && <Marker id={getMarkerId(activeTab, "2.5")} />}
          Others
        </button>
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={viewMode === "inventory" ? "default" : "outline"}
          onClick={() => setViewMode("inventory")}
          className="text-sm"
          data-testid={viewMode === "inventory" ? getMarkerId(activeTab, "1") : getMarkerId(activeTab, "2.7")}
        >
          {viewMode === "inventory" && <Marker id={getMarkerId(activeTab, "1")} />}
          {viewMode === "history" && <Marker id={getMarkerId(activeTab, "2.7")} />}
          Inventory
        </Button>
        <Button
          variant={viewMode === "history" ? "default" : "outline"}
          onClick={() => setViewMode("history")}
          className="text-sm"
          data-testid={viewMode === "inventory" ? getMarkerId(activeTab, "2") : getMarkerId(activeTab, "2.8")}
        >
          {viewMode === "inventory" && <Marker id={getMarkerId(activeTab, "2")} />}
          {viewMode === "history" && <Marker id={getMarkerId(activeTab, "2.8")} />}
          History
        </Button>
      </div>

      {/* Filters - Show different filters based on view mode */}
      {viewMode === "inventory" ? (
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <Select value={vesselId} onValueChange={setVesselId}>
            <SelectTrigger className="text-sm" data-testid={getMarkerId(activeTab, "4")}>
              <Marker id={getMarkerId(activeTab, "4")} />
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
        <div className="flex-1 relative">
          <Marker id={getMarkerId(activeTab, "5")} />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 text-sm"
            data-testid={getMarkerId(activeTab, "5")}
          />
        </div>
        <div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40 text-sm" data-testid={getMarkerId(activeTab, "6")}>
              <Marker id={getMarkerId(activeTab, "6")} />
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
            <SelectTrigger className="w-32 text-sm" data-testid={getMarkerId(activeTab, "7")}>
              <Marker id={getMarkerId(activeTab, "7")} />
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
          data-testid={getMarkerId(activeTab, "8")}
        >
          <Marker id={getMarkerId(activeTab, "8")} />
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
          data-testid={getMarkerId(activeTab, "9")}
        >
          <Marker id={getMarkerId(activeTab, "9")} />
          Clear
        </Button>
      </div>
      ) : (
      /* History Filters */
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Marker id={getMarkerId(activeTab, "2.9")} />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search history..."
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            className="pl-10 text-sm"
            data-testid={getMarkerId(activeTab, "2.9")}
          />
        </div>
        <div>
          <Select value={historyEventFilter} onValueChange={setHistoryEventFilter}>
            <SelectTrigger className="w-40 text-sm" data-testid={getMarkerId(activeTab, "2.10")}>
              <Marker id={getMarkerId(activeTab, "2.10")} />
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
          <div className="relative">
            <Marker id={getMarkerId(activeTab, "2.11")} />
            <Input
              type="date"
              value={historyDateFrom}
              onChange={(e) => setHistoryDateFrom(e.target.value)}
              className="text-sm"
              placeholder="From"
              data-testid={getMarkerId(activeTab, "2.11")}
            />
          </div>
          <span className="text-gray-500">to</span>
          <div className="relative">
            <Marker id={getMarkerId(activeTab, "2.12")} />
            <Input
              type="date"
              value={historyDateTo}
              onChange={(e) => setHistoryDateTo(e.target.value)}
              className="text-sm"
              placeholder="To"
              data-testid={getMarkerId(activeTab, "2.12")}
            />
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-blue-600"
          onClick={exportHistoryToExcel}
          data-testid={getMarkerId(activeTab, "2.13")}
        >
          <Marker id={getMarkerId(activeTab, "2.13")} />
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
            <div data-testid={getMarkerId(activeTab, "10")}>
              <Marker id={getMarkerId(activeTab, "10")} />
              {activeTab === "lubes" ? "Lube Grade" : 
               activeTab === "chemicals" ? "Chem Code" : "Item Code"}
            </div>
            <div data-testid={getMarkerId(activeTab, "11")}>
              <Marker id={getMarkerId(activeTab, "11")} />
              {activeTab === "lubes" ? "Lube Type" : 
               activeTab === "chemicals" ? "Chemical Name" : "Item Name"}
            </div>
            <div data-testid={getMarkerId(activeTab, "12")}>
              <Marker id={getMarkerId(activeTab, "12")} />
              {activeTab === "lubes" ? "Application" : 
               activeTab === "chemicals" ? "Application Area" : "Stores Category"}
            </div>
            <div data-testid={getMarkerId(activeTab, "13")}><Marker id={getMarkerId(activeTab, "13")} />UOM</div>
            <div data-testid={getMarkerId(activeTab, "14")}>
              <Marker id={getMarkerId(activeTab, "14")} />
              {activeTab === "lubes" || activeTab === "chemicals" ? "ROB" : "ROB"}
            </div>
            <div data-testid={getMarkerId(activeTab, "15")}><Marker id={getMarkerId(activeTab, "15")} />Min</div>
            <div data-testid={getMarkerId(activeTab, "16")}><Marker id={getMarkerId(activeTab, "16")} />Stock</div>
            <div data-testid={getMarkerId(activeTab, "17")}><Marker id={getMarkerId(activeTab, "17")} />Location</div>
            {FEATURES.IHM && <div className="text-center" data-testid={getMarkerId(activeTab, "18")}><Marker id={getMarkerId(activeTab, "18")} />IHM</div>}
            <div className="text-right pr-2" data-testid={getMarkerId(activeTab, "19")}><Marker id={getMarkerId(activeTab, "19")} />Actions</div>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-gray-200">
          {filteredItems.map((item, index) => (
            <div key={item.id} className="hover:bg-gray-50">
              <div className="grid gap-4 items-center text-sm py-3 px-4" style={{gridTemplateColumns: FEATURES.IHM ? '2fr 2fr 2fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr 0.6fr 1fr' : '2fr 2fr 2fr 0.8fr 0.8fr 0.8fr 0.8fr 1.5fr 1fr'}}>
                <div className="font-medium text-gray-900 truncate" data-testid={index === 0 ? getMarkerId(activeTab, "20") : undefined}>
                  {index === 0 && <Marker id={getMarkerId(activeTab, "20")} />}
                  {item.itemCode}
                </div>
                <div className="text-gray-700 truncate" data-testid={index === 0 ? getMarkerId(activeTab, "21") : undefined}>
                  {index === 0 && <Marker id={getMarkerId(activeTab, "21")} />}
                  {item.itemName}
                </div>
                <div className="text-gray-600 truncate" data-testid={index === 0 ? getMarkerId(activeTab, "22") : undefined}>
                  {index === 0 && <Marker id={getMarkerId(activeTab, "22")} />}
                  {item.storesCategory}
                </div>
                <div className="text-gray-700 text-center" data-testid={index === 0 ? getMarkerId(activeTab, "23") : undefined}>
                  {index === 0 && <Marker id={getMarkerId(activeTab, "23")} />}
                  {item.uom || "-"}
                </div>
                <div className="text-gray-700 text-center" data-testid={index === 0 ? getMarkerId(activeTab, "24") : undefined}>
                  {index === 0 && <Marker id={getMarkerId(activeTab, "24")} />}
                  {item.rob}
                </div>
                <div className="text-gray-700 text-center" data-testid={index === 0 ? getMarkerId(activeTab, "25") : undefined}>
                  {index === 0 && <Marker id={getMarkerId(activeTab, "25")} />}
                  {item.min}
                </div>
                <div className="text-center" data-testid={index === 0 ? getMarkerId(activeTab, "26") : undefined}>
                  {index === 0 && <Marker id={getMarkerId(activeTab, "26")} />}
                  <span className={`px-2 py-0.5 rounded text-xs font-medium inline-block ${getStockColor(item.stock)}`}>
                    {item.stock}
                  </span>
                </div>
                {/* Location Dropdown - matches Spares format "@ X / Y" */}
                <div className="relative" data-testid={index === 0 ? getMarkerId(activeTab, "27") : undefined}>
                  {index === 0 && <Marker id={getMarkerId(activeTab, "27")} />}
                  {(() => {
                    const robA = item.robLocationA ?? 0;
                    const robB = item.robLocationB ?? 0;
                    const locationDisplay = `@ ${robA} / ${robB}`;
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
                                <div className="text-[10px] font-semibold text-blue-600 mb-1" data-testid="label-dropdown-location-a">Location A</div>
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
                                <div className="text-[10px] font-semibold text-blue-600 mb-1" data-testid="label-dropdown-location-b">Location B</div>
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
                  <div className="flex justify-center" data-testid={index === 0 ? getMarkerId(activeTab, "28") : undefined}>
                    {index === 0 && <Marker id={getMarkerId(activeTab, "28")} />}
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
                    data-testid={index === 0 ? getMarkerId(activeTab, "29") : `button-edit-${item.id}`}
                  >
                    {index === 0 && <Marker id={getMarkerId(activeTab, "29")} />}
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0 hover:bg-gray-100"
                    onClick={() => openConsumeReceiveModal(item)}
                    aria-label="Consume/Receive"
                    title="Consume/Receive"
                    data-testid={index === 0 ? getMarkerId(activeTab, "30") : `button-consume-receive-${item.id}`}
                  >
                    {index === 0 && <Marker id={getMarkerId(activeTab, "30")} />}
                    <PlusCircle className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0 hover:bg-gray-100"
                    onClick={() => handleDelete(item)}
                    aria-label="Delete Item"
                    title="Delete"
                    data-testid={index === 0 ? getMarkerId(activeTab, "31") : `button-delete-${item.id}`}
                  >
                    {index === 0 && <Marker id={getMarkerId(activeTab, "31")} />}
                    <Trash2 className="h-4 w-4 text-red-500" />
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
            <div className="col-span-2" data-testid={getMarkerId(activeTab, "2.14")}><Marker id={getMarkerId(activeTab, "2.14")} />Date/Time</div>
            <div className="col-span-1" data-testid={getMarkerId(activeTab, "2.15")}><Marker id={getMarkerId(activeTab, "2.15")} />Event</div>
            <div className="col-span-2" data-testid={getMarkerId(activeTab, "2.16")}><Marker id={getMarkerId(activeTab, "2.16")} />Item Name</div>
            <div className="col-span-1" data-testid={getMarkerId(activeTab, "2.17")}><Marker id={getMarkerId(activeTab, "2.17")} />Part Code</div>
            <div className="col-span-1" data-testid={getMarkerId(activeTab, "2.18")}><Marker id={getMarkerId(activeTab, "2.18")} />UOM</div>
            <div className="col-span-1" data-testid={getMarkerId(activeTab, "2.19")}><Marker id={getMarkerId(activeTab, "2.19")} />Qty Change</div>
            <div className="col-span-1" data-testid={getMarkerId(activeTab, "2.20")}><Marker id={getMarkerId(activeTab, "2.20")} />ROB After</div>
            <div className="col-span-1" data-testid={getMarkerId(activeTab, "2.21")}><Marker id={getMarkerId(activeTab, "2.21")} />Place</div>
            <div className="col-span-1" data-testid={getMarkerId(activeTab, "2.22")}><Marker id={getMarkerId(activeTab, "2.22")} />User</div>
            <div className="col-span-1" data-testid={getMarkerId(activeTab, "2.23")}><Marker id={getMarkerId(activeTab, "2.23")} />Remarks</div>
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
                      item.eventType === 'INITIAL' ? 'bg-blue-100 text-blue-800' :
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
            {isModifyMode ? (
              <Button 
                onClick={handleModifySubmit}
                disabled={isSubmittingChangeRequest}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-save-for-approval"
              >
                {isSubmittingChangeRequest ? "Submitting..." : "Save for Approval"}
              </Button>
            ) : (
              <Button onClick={saveEditItem}>Save Changes</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Combined Consume/Receive Selection Modal (matches Spares workflow) */}
      <Dialog open={isConsumeReceiveModalOpen} onOpenChange={setIsConsumeReceiveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Consume or Receive Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Item: {selectedItem?.itemCode} - {selectedItem?.itemName}</Label>
              <p className="text-sm text-gray-500">Current ROB: {selectedItem?.rob}</p>
            </div>
            <div className="flex gap-4">
              <Button
                onClick={() => {
                  setIsConsumeReceiveModalOpen(false);
                  if (selectedItem) {
                    openConsumeModal(selectedItem);
                  }
                }}
                variant="destructive"
                className="flex-1"
                disabled={!selectedItem || selectedItem.rob === 0}
                title={selectedItem?.rob === 0 ? "No stock available to consume" : "Consume item"}
              >
                <MinusCircle className="h-4 w-4 mr-2" />
                Consume
              </Button>
              <Button
                onClick={() => {
                  setIsConsumeReceiveModalOpen(false);
                  if (selectedItem) {
                    openReceiveModal(selectedItem);
                  }
                }}
                variant="default"
                className="flex-1"
              >
                <PlusCircle className="h-4 w-4 mr-2" />
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

      {/* Receive Item Modal */}
      <Dialog open={isReceiveModalOpen} onOpenChange={setIsReceiveModalOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receive {receivingItem?.itemName}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="receive-location">Receive to Location</Label>
              <Select 
                value={receiveForm.location} 
                onValueChange={(val) => setReceiveForm({...receiveForm, location: val as "A" | "B"})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">{locationNames.locationA} (Current: {receivingItem?.robLocationA ?? 0})</SelectItem>
                  <SelectItem value="B">{locationNames.locationB} (Current: {receivingItem?.robLocationB ?? 0})</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
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
              <Label htmlFor="consume-location">Consume from Location</Label>
              <Select 
                value={consumeForm.location} 
                onValueChange={(val) => setConsumeForm({...consumeForm, location: val as "A" | "B"})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">{locationNames.locationA} (Available: {consumingItem?.robLocationA ?? 0})</SelectItem>
                  <SelectItem value="B">{locationNames.locationB} (Available: {consumingItem?.robLocationB ?? 0})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="consume-quantity">
                Quantity to Consume ({consumingItem?.uom || 'units'})
              </Label>
              <Input
                id="consume-quantity"
                type="number"
                min="1"
                max={getLocationStock(consumingItem, consumeForm.location)}
                value={consumeForm.quantity}
                onChange={(e) => setConsumeForm({...consumeForm, quantity: e.target.value})}
                placeholder={`Max: ${getLocationStock(consumingItem, consumeForm.location)}`}
              />
              {consumeForm.quantity && parseInt(consumeForm.quantity) > getLocationStock(consumingItem, consumeForm.location) && (
                <p className="text-xs text-red-600">Cannot consume more than available stock at selected location ({getLocationStock(consumingItem, consumeForm.location)} available)</p>
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
              disabled={!consumeForm.quantity || parseInt(consumeForm.quantity) > getLocationStock(consumingItem, consumeForm.location)}
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
              {/* Search bar and item count */}
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="text-sm text-gray-500">
                  Updating {filteredItems.length} item(s) {bulkSearchQuery && `(showing ${bulkModalFilteredItems.length} filtered)`}
                </div>
                <div className="flex-1 max-w-md">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      type="text"
                      placeholder="Search by item code, name, category..."
                      value={bulkSearchQuery}
                      onChange={(e) => setBulkSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="input-bulk-search"
                    />
                    {bulkSearchQuery && (
                      <button 
                        onClick={() => setBulkSearchQuery("")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Received Date, Received Place, and Comments Fields - matches Spares order */}
              <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <Label htmlFor="bulk-received-date">Received Date (Apply to all)</Label>
                  <Input 
                    id="bulk-received-date"
                    type="date" 
                    value={dateReceived}
                    onChange={(e) => setDateReceived(e.target.value)}
                    data-testid="input-bulk-received-date"
                  />
                </div>
                <div>
                  <Label htmlFor="bulk-received-place">Received Place (Apply to all)</Label>
                  <Input 
                    id="bulk-received-place"
                    placeholder="e.g., Singapore Port" 
                    value={placeReceived}
                    onChange={(e) => setPlaceReceived(e.target.value)}
                    data-testid="input-bulk-received-place"
                  />
                </div>
                <div>
                  <Label htmlFor="bulk-comments">Comments (Apply to all)</Label>
                  <Input 
                    id="bulk-comments"
                    placeholder="Enter comments" 
                    data-testid="input-bulk-comments"
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

              {/* Table - matches Spares structure exactly */}
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium">
                          {activeTab === "lubes" ? "Lube Grade" : 
                           activeTab === "chemicals" ? "Chem Code" : "Item Code"}
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium">
                          {activeTab === "lubes" ? "Lube Type" : 
                           activeTab === "chemicals" ? "Chemical Name" : "Item Name"}
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-medium" colSpan={2}>
                          <div className="text-center">ROB</div>
                          <div className="flex justify-center gap-4 text-[10px] mt-1">
                            <span className="font-semibold text-blue-600" data-testid="label-rob-location-a">Location A</span>
                            <span className="font-semibold text-blue-600" data-testid="label-rob-location-b">Location B</span>
                          </div>
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-medium border-l" colSpan={2}>
                          <div className="text-center text-orange-600">Consumed</div>
                          <div className="flex justify-center gap-4 text-[10px] mt-1">
                            <span className="font-semibold text-blue-600" data-testid="label-consumed-location-a">Location A</span>
                            <span className="font-semibold text-blue-600" data-testid="label-consumed-location-b">Location B</span>
                          </div>
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-medium border-l" colSpan={2}>
                          <div className="text-center text-green-600">Received</div>
                          <div className="flex justify-center gap-4 text-[10px] mt-1">
                            <span className="font-semibold text-blue-600" data-testid="label-received-location-a">Location A</span>
                            <span className="font-semibold text-blue-600" data-testid="label-received-location-b">Location B</span>
                          </div>
                        </th>
                        <th className="px-2 py-2 text-center text-xs font-medium border-l">New ROB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkModalFilteredItems.map((item) => {
                        const consumedA = bulkUpdateData[item.id]?.consumedLocationA || 0;
                        const consumedB = bulkUpdateData[item.id]?.consumedLocationB || 0;
                        const receivedA = bulkUpdateData[item.id]?.receivedLocationA || 0;
                        const receivedB = bulkUpdateData[item.id]?.receivedLocationB || 0;
                        const robA = item.robLocationA ?? 0;
                        const robB = item.robLocationB ?? 0;
                        const newRobA = robA - consumedA + receivedA;
                        const newRobB = robB - consumedB + receivedB;
                        const newRob = newRobA + newRobB;
                        const hasInsufficientStockA = consumedA > robA;
                        const hasInsufficientStockB = consumedB > robB;
                        const totalReceived = receivedA + receivedB;
                        const needsReceivedDate = totalReceived > 0 && !dateReceived;
                        const hasError = hasInsufficientStockA || hasInsufficientStockB || needsReceivedDate;
                        
                        // Get item-specific location names with fallbacks
                        const itemLocA = locationNames.locationA || 'Location A';
                        const itemLocB = locationNames.locationB || 'Location B';
                        
                        return (
                          <tr key={item.id} className={`border-t ${hasError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                            <td className="px-3 py-2 text-sm">{item.itemCode}</td>
                            <td className="px-3 py-2 text-sm max-w-[150px] truncate" title={item.itemName}>{item.itemName}</td>
                            {/* ROB cells with location names */}
                            <td className="px-2 py-2 text-center">
                              <div className="text-[9px] text-gray-500 truncate max-w-[60px]" title={itemLocA}>{itemLocA}</div>
                              <div className="text-xs text-gray-600 font-medium">{robA}</div>
                            </td>
                            <td className="px-2 py-2 text-center">
                              <div className="text-[9px] text-gray-500 truncate max-w-[60px]" title={itemLocB}>{itemLocB}</div>
                              <div className="text-xs text-gray-600 font-medium">{robB}</div>
                            </td>
                            {/* Consumed cells with location names */}
                            <td className="px-1 py-2 border-l">
                              <div className="text-[9px] text-gray-500 truncate max-w-[56px] text-center" title={itemLocA}>{itemLocA}</div>
                              <Input 
                                type="number" 
                                min="0" 
                                max={robA}
                                value={bulkUpdateData[item.id]?.consumedLocationA || ""}
                                onChange={(e) => handleBulkUpdateChange(item.id, 'consumedLocationA', e.target.value)}
                                className={`w-14 h-7 text-sm text-center ${hasInsufficientStockA ? 'border-red-500' : ''}`}
                                data-testid={`input-consume-a-${item.id}`}
                              />
                            </td>
                            <td className="px-1 py-2">
                              <div className="text-[9px] text-gray-500 truncate max-w-[56px] text-center" title={itemLocB}>{itemLocB}</div>
                              <Input 
                                type="number" 
                                min="0" 
                                max={robB}
                                value={bulkUpdateData[item.id]?.consumedLocationB || ""}
                                onChange={(e) => handleBulkUpdateChange(item.id, 'consumedLocationB', e.target.value)}
                                className={`w-14 h-7 text-sm text-center ${hasInsufficientStockB ? 'border-red-500' : ''}`}
                                data-testid={`input-consume-b-${item.id}`}
                              />
                            </td>
                            {/* Received cells with location names */}
                            <td className="px-1 py-2 border-l">
                              <div className="text-[9px] text-gray-500 truncate max-w-[56px] text-center" title={itemLocA}>{itemLocA}</div>
                              <Input 
                                type="number" 
                                min="0" 
                                value={bulkUpdateData[item.id]?.receivedLocationA || ""}
                                onChange={(e) => handleBulkUpdateChange(item.id, 'receivedLocationA', e.target.value)}
                                className="w-14 h-7 text-sm text-center"
                                data-testid={`input-receive-a-${item.id}`}
                              />
                            </td>
                            <td className="px-1 py-2">
                              <div className="text-[9px] text-gray-500 truncate max-w-[56px] text-center" title={itemLocB}>{itemLocB}</div>
                              <Input 
                                type="number" 
                                min="0" 
                                value={bulkUpdateData[item.id]?.receivedLocationB || ""}
                                onChange={(e) => handleBulkUpdateChange(item.id, 'receivedLocationB', e.target.value)}
                                className="w-14 h-7 text-sm text-center"
                                data-testid={`input-receive-b-${item.id}`}
                              />
                            </td>
                            <td className="px-2 py-2 text-center border-l">
                              <div className={`text-sm font-medium ${hasError ? 'text-red-600' : ''}`}>
                                {newRob}
                                {(hasInsufficientStockA || hasInsufficientStockB) && (
                                  <div className="text-[10px] text-red-600">Insufficient</div>
                                )}
                                {needsReceivedDate && (
                                  <div className="text-[10px] text-red-600">Date required</div>
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
      
      {/* Modify Mode Footer */}
      <ModifyStickyFooter
        isVisible={isModifyMode && showModifySubmitFooter}
        hasChanges={originalStoreData !== null && getStoreChangedFields().length > 0}
        changedFieldsCount={getStoreChangedFields().length}
        onCancel={handleCancelModify}
        onSubmitChangeRequest={handleModifySubmit}
        isSubmitting={isSubmittingChangeRequest}
      />
    </div>
  );
};

export default Stores;