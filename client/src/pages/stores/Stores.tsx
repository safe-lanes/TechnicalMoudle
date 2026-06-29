import React, { useState, useMemo, useEffect } from "react";
import { useModifyMode } from "@/hooks/useModifyMode";
import { useVessel } from "@/contexts/VesselContext";
import { useUIRole } from "@/contexts/UIRoleContext";
import { useChangeMode } from "@/contexts/ChangeModeContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Marker } from "@/components/Marker";
import { LocationSearchDropdown } from "@/components/LocationSearchDropdown";
import WOAgGridTable from "@/components/WOAgGridTable";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Search, Edit2, Clock, Trash2, FileSpreadsheet, X, MessageSquare, Calendar, PlusCircle, MinusCircle, Download, AlertCircle, CheckCircle, HelpCircle, MapPin, ChevronDown, ChevronsUpDown, Plus, Check, RotateCcw, Info, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, invalidateByUrlPrefix } from "@/lib/queryClient";
import * as XLSX from "xlsx";
import { FEATURES } from "@/config/features";
import { useVessels } from "@/hooks/useVessels";
import { ModifyStickyFooter } from "@/components/modify/ModifyStickyFooter";
import { format } from "date-fns";
import { PeriodFilter, PeriodFilterValue, periodFilterToDateRange } from "@/components/filters/PeriodFilter";

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
  max?: number;
  stock: string;
  location: string;
  category: "stores" | "lubes" | "chemicals" | "others";
  notes?: string;
  isArchived?: boolean;
  robLocationA?: number;
  robLocationB?: number;
  locationAName?: string;
  locationBName?: string;
  impaCode?: string;
  specification?: string;
  unitCost?: number;
  supplier?: string;
  lastOrderDate?: string;
  leadTime?: string;
  ihmPresence?: typeof IHM_PRESENCE[number];
  ihmEvidenceType?: typeof IHM_EVIDENCE_TYPES[number];
  ihmDetails?: string;
  expiryDate?: string;
  batchNumber?: string;
  lotNumber?: string;
  hazardClassification?: string;
  manufactureDate?: string;
  sdsReference?: string;
  sdsLastUpdated?: string;
  shelfLifeMonths?: number;
  unNumber?: string;
  flashPoint?: string;
  storageTempMin?: string;
  storageTempMax?: string;
  disposalInstructions?: string;
  ppeRequirements?: string;
  emergencyContact?: string;
  remarks?: string;
  isActive?: boolean;
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

interface StoresApiItem {
  id: number;
  itemCode: string;
  itemName: string;
  impaCode?: string;
  category?: string;
  specification?: string;
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
  unitCost?: number;
  supplier?: string;
  lastOrderDate?: string;
  leadTime?: string;
  itemType?: string;
  vesselId?: string;
  notes?: string;
  remarks?: string;
  isArchived?: boolean;
  ihmPresence?: string;
  ihmEvidenceType?: string;
  ihmDetails?: string;
  expiryDate?: string;
  batchNumber?: string;
  lotNumber?: string;
  hazardClassification?: string;
  manufactureDate?: string;
  sdsReference?: string;
  sdsLastUpdated?: string;
  shelfLifeMonths?: number;
  unNumber?: string;
  flashPoint?: string;
  storageTempMin?: string;
  storageTempMax?: string;
  disposalInstructions?: string;
  ppeRequirements?: string;
  emergencyContact?: string;
  isActive?: boolean;
}

const Stores: React.FC = () => {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { vesselId, setVesselId, isMyVessels, assignedVesselIds, pickerVessels, myVesselsEmpty } = useVessel();
  // 'my' aggregates across the assigned mini-fleet via the 'all' read path with a
  // vesselIds allow-list. The URL carries everything so the default fetcher + cache
  // invalidation patterns stay unchanged.
  const storesScopeReady = !!vesselId && (!isMyVessels || assignedVesselIds.length > 0);
  const { isVessel, isHeadOfDept, isSailAdmin, isClientAdmin } = useUIRole();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const canCreateStore = canCreate("pms-stores");
  const canEditStore = canEdit("pms-stores");
  const canDeleteStore = canDelete("pms-stores");
  const { isChangeMode } = useChangeMode();
  const { data: vessels = [] } = useVessels();
  const [activeTab, setActiveTab] = useState<"stores" | "lubes" | "chemicals" | "others">(() => {
    const savedTab = sessionStorage.getItem('storesActiveTab');
    if (savedTab && ['stores', 'lubes', 'chemicals', 'others'].includes(savedTab)) {
      sessionStorage.removeItem('storesActiveTab');
      return savedTab as "stores" | "lubes" | "chemicals" | "others";
    }
    return "stores";
  });
  const storesInventoryUrl = isMyVessels
    ? `/technical/api/stores/all?itemType=${activeTab}&vesselIds=${assignedVesselIds.join(',')}`
    : `/technical/api/stores/${vesselId}?itemType=${activeTab}`;
  const storesHistoryUrl = isMyVessels
    ? `/technical/api/stores/all/history?itemType=${activeTab}&vesselIds=${assignedVesselIds.join(',')}`
    : `/technical/api/stores/${vesselId}/history?itemType=${activeTab}`;
  const [viewMode, setViewMode] = useState<"inventory" | "location" | "history">("inventory");
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
  const [isDeleteSelectionMode, setIsDeleteSelectionMode] = useState(false);
  const [selectedStoreIds, setSelectedStoreIds] = useState<Set<number>>(new Set());
  
  
  // Enable modify footer when in modify mode
  useEffect(() => {
    if (isModifyMode) {
      setShowModifySubmitFooter(true);
    }
  }, [isModifyMode]);
  
  // Location dialog state
  const [locationDialogItem, setLocationDialogItem] = useState<StoreItem | null>(null);
  const [editingLocations, setEditingLocations] = useState<{[key: number]: {locationA: string, locationB: string, nameA?: string, nameB?: string}}>({});

  // Location tab state
  const [selectedLocationName, setSelectedLocationName] = useState<string | null>(null);
  const [locationTabSearch, setLocationTabSearch] = useState("");
  const [editingLocRobValues, setEditingLocRobValues] = useState<Record<string, string>>({});
  const [isChangingStoreLocation, setIsChangingStoreLocation] = useState(false);

  const getItemLocationSide = (item: StoreItem, locName: string): "A" | "B" | null => {
    if ((item.locationAName || '') === locName && (item.robLocationA ?? 0) > 0) return 'A';
    if ((item.locationBName || '') === locName && (item.robLocationB ?? 0) > 0) return 'B';
    return null;
  };

  useEffect(() => {
    setSelectedLocationName(null);
    setLocationTabSearch("");
    setIsDeleteSelectionMode(false);
    setSelectedStoreIds(new Set());
  }, [vesselId, activeTab]);

  useEffect(() => {
    if (viewMode !== 'inventory') {
      setIsDeleteSelectionMode(false);
      setSelectedStoreIds(new Set());
    }
    if (viewMode !== 'history') {
      setHistoryPeriodFilter(null);
    }
  }, [viewMode]);

  useEffect(() => {
    setHistoryPeriodFilter(null);
  }, [activeTab]);

  // Fetch stores items from API - uses default TanStack Query fetcher
  // The query key includes the full URL with query parameters
  const { data: storesData = [], isLoading: storesLoading } = useQuery<StoresApiItem[]>({
    queryKey: storesScopeReady ? [storesInventoryUrl] : ['stores-disabled'],
    enabled: storesScopeReady,
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

  const { data: allVesselLocationsResponse } = useQuery({
    queryKey: [`/technical/api/inventory/locations/${vesselId}`],
    enabled: vesselId !== 'all' && vesselId !== 'my' && vesselId !== '' && viewMode === 'location',
  });

  const allVesselLocations = useMemo(() => {
    return (allVesselLocationsResponse as any)?.data || [];
  }, [allVesselLocationsResponse]);

  const handleChangeStoreLocation = async (item: StoreItem, newLocName: string) => {
    if (!vesselId || !selectedLocationName || isChangingStoreLocation || !canEditStore) return;
    const side = getItemLocationSide(item, selectedLocationName);
    if (!side) return;
    setIsChangingStoreLocation(true);
    try {
      const fieldKey = side === 'A' ? 'locationA' : 'locationB';
      await fetch(`/technical/api/stores/${vesselId}/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fieldKey]: newLocName }),
      });
      invalidateByUrlPrefix('/technical/api/stores');
      toast({ title: "Location Updated", description: `Location changed to "${newLocName}"` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || 'Failed to update location', variant: "destructive" });
    } finally {
      setIsChangingStoreLocation(false);
    }
  };

  const [isSavingLocRob, setIsSavingLocRob] = useState(false);
  const handleSaveAllLocRob = async () => {
    const entries = Object.entries(editingLocRobValues);
    if (entries.length === 0) {
      toast({ title: "No Changes", description: "No pending location ROB changes to save." });
      return;
    }
    setIsSavingLocRob(true);
    try {
      for (const [key, val] of entries) {
        const [itemIdStr, side] = key.split('-');
        const itemId = Number(itemIdStr);
        const newVal = Number(val);
        const item = items.find(i => i.id === itemId);
        if (!item || isNaN(newVal) || newVal < 0) continue;
        const currentVal = side === 'A' ? (item.robLocationA ?? 0) : (item.robLocationB ?? 0);
        if (newVal === currentVal) continue;
        const fieldKey = side === 'A' ? 'robLocationA' : 'robLocationB';
        await fetch(`/technical/api/stores/${vesselId}/${itemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [fieldKey]: newVal }),
        });
      }
      invalidateByUrlPrefix('/technical/api/stores');
      setEditingLocRobValues({});
      toast({ title: "Saved", description: `Location ROB values saved successfully.` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save some location ROB changes.", variant: "destructive" });
    } finally {
      setIsSavingLocRob(false);
    }
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
          locationAName: item.locationA || '',
          locationBName: item.locationB || '',
          impaCode: item.impaCode || '',
          specification: item.specification || '',
          max: Number(item.max ?? 0) || 0,
          unitCost: Number(item.unitCost ?? 0) || 0,
          supplier: item.supplier || '',
          lastOrderDate: item.lastOrderDate || '',
          leadTime: item.leadTime || '',
          ihmPresence: (item.ihmPresence as typeof IHM_PRESENCE[number]) || 'Unknown',
          ihmEvidenceType: (item.ihmEvidenceType as typeof IHM_EVIDENCE_TYPES[number]) || 'None',
          ihmDetails: item.ihmDetails || '',
          expiryDate: item.expiryDate || '',
          batchNumber: item.batchNumber || '',
          lotNumber: item.lotNumber || '',
          hazardClassification: item.hazardClassification || '',
          manufactureDate: item.manufactureDate || '',
          sdsReference: item.sdsReference || '',
          sdsLastUpdated: item.sdsLastUpdated || '',
          shelfLifeMonths: item.shelfLifeMonths || 0,
          unNumber: item.unNumber || '',
          flashPoint: item.flashPoint || '',
          storageTempMin: item.storageTempMin || '',
          storageTempMax: item.storageTempMax || '',
          disposalInstructions: item.disposalInstructions || '',
          ppeRequirements: item.ppeRequirements || '',
          emergencyContact: item.emergencyContact || '',
          remarks: item.remarks || '',
          isActive: item.isActive !== false,
        };
      });
      setItems(mappedItems);
    } else {
      setItems([]);
    }
  }, [storesData, activeTab]);
  
  // Fetch stores history from API
  const { data: historyData = [], isLoading: historyLoading } = useQuery<any[]>({
    queryKey: storesScopeReady ? [`/technical/api/stores/${vesselId}/history`, activeTab, isMyVessels ? assignedVesselIds.join(',') : ''] : ['history-disabled'],
    queryFn: async () => {
      const response = await fetch(storesHistoryUrl);
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json();
    },
    enabled: storesScopeReady && viewMode === 'history',
  });

  // Map history API data to StoresHistoryItem format
  // Uses storesLedger schema fields: itemId, eventType, timestampUTC, qtyChangeBase, robAfterBase, userId, remarks, ref, itemName, partCode
  
  // Helper to format date consistently - always show only date, no time
  const formatHistoryDate = (dateLocal: string | undefined, timestampUTC: string | undefined): string => {
    try {
      // Check if dateLocal is a date-only string (YYYY-MM-DD format)
      const isDateOnly = dateLocal && /^\d{4}-\d{2}-\d{2}$/.test(dateLocal.trim());
      
      if (dateLocal) {
        // For date-only strings, append T00:00:00 to treat as local time and avoid timezone drift
        const dateStr = isDateOnly ? `${dateLocal.trim()}T00:00:00` : dateLocal;
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return format(date, 'dd-MMM-yyyy');
        }
      }
      if (timestampUTC) {
        const date = new Date(timestampUTC);
        if (!isNaN(date.getTime())) {
          return format(date, 'dd-MMM-yyyy');
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
  const [historyPeriodFilter, setHistoryPeriodFilter] = useState<PeriodFilterValue | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [historyEventFilter, setHistoryEventFilter] = useState("all");

  // Pagination state
  const [locationPage, setLocationPage] = useState(1);
  const [locationItemsPerPage, setLocationItemsPerPage] = useState(10);
  
  const handleOpenLocationDialog = (item: StoreItem) => {
    setLocationDialogItem(item);
    setEditingLocations(prev => ({
      ...prev,
      [item.id]: {
        locationA: String(item.robLocationA ?? 0),
        locationB: String(item.robLocationB ?? 0),
        nameA: item.locationAName || locationNames.locationA || 'Location A',
        nameB: item.locationBName || locationNames.locationB || 'Location B'
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
      
      invalidateByUrlPrefix('/technical/api/stores');
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
  
  // View modal state (read-only item details)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<StoreItem | null>(null);

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null);
  const [editForm, setEditForm] = useState({
    itemCode: "",
    impaCode: "",
    itemName: "",
    category: "",
    specification: "",
    uom: "",
    customUom: "",
    rob: 0,
    min: 0,
    max: 0,
    robLocationA: 0,
    robLocationB: 0,
    locationA: "",
    locationB: "",
    unitCost: 0,
    supplier: "",
    lastOrderDate: "",
    leadTime: "",
    location: "",
    notes: "",
    remarks: "",
    ihmPresence: 'Unknown' as 'Unknown' | 'Present' | 'Not Present',
    ihmEvidenceType: 'None' as 'None' | 'MD' | 'SDoC' | 'Test',
    ihmDetails: "",
    expiryDate: "",
    batchNumber: "",
    lotNumber: "",
    hazardClassification: "",
    sdsReference: "",
    sdsLastUpdated: "",
    manufactureDate: "",
    shelfLifeMonths: 0,
    unNumber: "",
    flashPoint: "",
    storageTempMin: "",
    storageTempMax: "",
    disposalInstructions: "",
    ppeRequirements: "",
    emergencyContact: "",
  });
  
  // Add Store modal state
  const [isAddStoreModalOpen, setIsAddStoreModalOpen] = useState(false);
  const [isAddingStore, setIsAddingStore] = useState(false);
  const [addStoreForm, setAddStoreForm] = useState({
    itemCode: "",
    itemName: "",
    impaCode: "",
    category: "",
    specification: "",
    uom: "",
    customUom: "",
    rob: 0,
    robLocationA: 0,
    robLocationB: 0,
    locationA: "",
    locationB: "",
    min: 0,
    max: 0,
    unitCost: 0,
    supplier: "",
    lastOrderDate: "",
    leadTime: "",
    ihm: false,
    ihmDetails: "",
    ihmPresence: "Unknown" as "Unknown" | "Present" | "Not Present",
    ihmEvidenceType: "None" as "None" | "MD" | "SDoC" | "Test",
    remarks: "",
    manufactureDate: "",
    expiryDate: "",
    batchNumber: "",
    lotNumber: "",
    shelfLifeMonths: 0,
    sdsReference: "",
    sdsLastUpdated: "",
    hazardClassification: "",
    unNumber: "",
    flashPoint: "",
    storageTempMin: "",
    storageTempMax: "",
    disposalInstructions: "",
    ppeRequirements: "",
    emergencyContact: "",
  });
  
  const [expiryAutoWarning, setExpiryAutoWarning] = useState<string>("");

  const calculateExpiryFromManufacture = (mfgDate: string, shelfMonths: number): string => {
    if (!mfgDate || !shelfMonths || shelfMonths <= 0) return "";
    const d = new Date(mfgDate);
    if (isNaN(d.getTime())) return "";
    d.setMonth(d.getMonth() + shelfMonths);
    return d.toISOString().split('T')[0];
  };

  const handleAddManufactureDateChange = (value: string) => {
    const updated = { ...addStoreForm, manufactureDate: value };
    if (value && addStoreForm.shelfLifeMonths > 0) {
      const calc = calculateExpiryFromManufacture(value, addStoreForm.shelfLifeMonths);
      if (calc) {
        updated.expiryDate = calc;
        setExpiryAutoWarning("");
      }
    }
    setAddStoreForm(updated);
  };

  const handleAddShelfLifeChange = (value: number) => {
    const updated = { ...addStoreForm, shelfLifeMonths: value };
    if (addStoreForm.manufactureDate && value > 0) {
      const calc = calculateExpiryFromManufacture(addStoreForm.manufactureDate, value);
      if (calc) {
        updated.expiryDate = calc;
        setExpiryAutoWarning("");
      }
    }
    setAddStoreForm(updated);
  };

  const handleAddExpiryDateManualChange = (value: string) => {
    const updated = { ...addStoreForm, expiryDate: value };
    if (value && addStoreForm.manufactureDate && addStoreForm.shelfLifeMonths > 0) {
      const calc = calculateExpiryFromManufacture(addStoreForm.manufactureDate, addStoreForm.shelfLifeMonths);
      if (calc && value !== calc) {
        setExpiryAutoWarning(`Auto-calculated expiry would be ${calc}. You've entered a different date.`);
      } else {
        setExpiryAutoWarning("");
      }
    } else {
      setExpiryAutoWarning("");
    }
    setAddStoreForm(updated);
  };

  const handleEditManufactureDateChange = (value: string) => {
    const updated = { ...editForm, manufactureDate: value };
    const shelfLife = editForm.shelfLifeMonths || 0;
    if (value && shelfLife > 0) {
      const calc = calculateExpiryFromManufacture(value, shelfLife);
      if (calc) {
        updated.expiryDate = calc;
        setExpiryAutoWarning("");
      }
    }
    setEditForm(updated);
  };

  const handleEditShelfLifeChange = (value: number) => {
    const updated = { ...editForm, shelfLifeMonths: value };
    if (editForm.manufactureDate && value > 0) {
      const calc = calculateExpiryFromManufacture(editForm.manufactureDate, value);
      if (calc) {
        updated.expiryDate = calc;
        setExpiryAutoWarning("");
      }
    }
    setEditForm(updated);
  };

  // Store category options
  const STORE_CATEGORY_OPTIONS = [
    "General Stores",
    "Electrical",
    "Mechanical",
    "Safety",
    "Deck",
    "Engine",
    "Galley",
    "Consumables",
    "Other"
  ];
  
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
    const filtered = updatedItems.filter(item => {
      if (item.isArchived) return false;
      if ((isVessel || isHeadOfDept) && item.isActive === false) return false;
      const matchesTab = item.category === activeTab;
      const matchesSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.itemCode.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !categoryFilter || categoryFilter === "all" || item.storesCategory.includes(categoryFilter);
      const matchesStock = !stockFilter || stockFilter === "all" || item.stock.toLowerCase() === stockFilter.toLowerCase();
      
      return matchesTab && matchesSearch && matchesCategory && matchesStock;
    });
    filtered.sort((a, b) => {
      const aInactive = a.isActive === false ? 1 : 0;
      const bInactive = b.isActive === false ? 1 : 0;
      if (aInactive !== bInactive) return aInactive - bInactive;
      return (a.itemCode || '').localeCompare(b.itemCode || '', undefined, { numeric: true });
    });
    return filtered;
  }, [activeTab, searchTerm, categoryFilter, stockFilter, items, isVessel, isHeadOfDept]);

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
    if (stock === "Low") return "bg-red-100 text-red-800";
    if (stock === "At Min") return "bg-orange-100 text-orange-800";
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
    // Helper to parse DD-Mon-YYYY format (e.g., "27-Jan-2026") to Date object
    const parseHistoryDate = (dateStr: string): Date | null => {
      if (!dateStr) return null;
      const months: Record<string, number> = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      const parts = dateStr.split('-');
      if (parts.length !== 3) return null;
      const day = parseInt(parts[0], 10);
      const month = months[parts[1]];
      const year = parseInt(parts[2], 10);
      if (isNaN(day) || month === undefined || isNaN(year)) return null;
      return new Date(year, month, day);
    };

    // Parse date picker values (YYYY-MM-DD format)
    const historyDateRange = periodFilterToDateRange(historyPeriodFilter);
    const fromDate = historyDateRange ? historyDateRange.from : null;
    const toDate = historyDateRange ? historyDateRange.to : null;

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
      
      // Filter by date range
      if (fromDate || toDate) {
        const itemDate = parseHistoryDate(item.dateLocal);
        if (!itemDate) return true; // Keep items with unparseable dates
        
        if (fromDate && itemDate < fromDate) return false;
        if (toDate && itemDate > toDate) return false;
      }
      
      return true;
    });
  }, [historyItems, historySearch, historyEventFilter, historyPeriodFilter]);

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
  
  // Handle View Item Details (read-only)
  const openViewModal = (item: StoreItem) => {
    setViewingItem(item);
    setIsViewModalOpen(true);
  };

  // Handle Edit Item
  const openEditModal = (item: StoreItem) => {
    setEditingItem(item);
    const isCustomUom = !UOM_OPTIONS.includes(item.uom || "");
    setEditForm({
      itemCode: item.itemCode || '',
      impaCode: item.impaCode || '',
      itemName: item.itemName,
      category: item.storesCategory || '',
      specification: item.specification || '',
      uom: isCustomUom ? "Other" : (item.uom || ""),
      customUom: isCustomUom ? (item.uom || "") : "",
      rob: item.rob || 0,
      min: item.min,
      max: item.max || 0,
      robLocationA: item.robLocationA || 0,
      robLocationB: item.robLocationB || 0,
      locationA: item.locationAName || '',
      locationB: item.locationBName || '',
      unitCost: item.unitCost || 0,
      supplier: item.supplier || '',
      lastOrderDate: item.lastOrderDate || '',
      leadTime: item.leadTime || '',
      location: item.location,
      notes: item.notes || "",
      remarks: item.remarks || '',
      ihmPresence: item.ihmPresence || 'Unknown',
      ihmEvidenceType: item.ihmEvidenceType || 'None',
      ihmDetails: item.ihmDetails || '',
      expiryDate: item.expiryDate || '',
      batchNumber: item.batchNumber || '',
      lotNumber: item.lotNumber || '',
      hazardClassification: item.hazardClassification || '',
      sdsReference: item.sdsReference || '',
      sdsLastUpdated: item.sdsLastUpdated || '',
      manufactureDate: item.manufactureDate || '',
      shelfLifeMonths: item.shelfLifeMonths || 0,
      unNumber: item.unNumber || '',
      flashPoint: item.flashPoint || '',
      storageTempMin: item.storageTempMin || '',
      storageTempMax: item.storageTempMax || '',
      disposalInstructions: item.disposalInstructions || '',
      ppeRequirements: item.ppeRequirements || '',
      emergencyContact: item.emergencyContact || '',
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
      { key: 'impaCode', original: originalStoreData.impaCode || '', current: editForm.impaCode },
      { key: 'category', original: originalStoreData.storesCategory || '', current: editForm.category },
      { key: 'specification', original: originalStoreData.specification || '', current: editForm.specification },
      { key: 'uom', original: originalStoreData.uom, current: uom },
      { key: 'min', original: String(originalStoreData.min), current: String(editForm.min) },
      { key: 'max', original: String(originalStoreData.max || 0), current: String(editForm.max) },
      { key: 'locationA', original: originalStoreData.locationAName || '', current: editForm.locationA },
      { key: 'locationB', original: originalStoreData.locationBName || '', current: editForm.locationB },
      { key: 'unitCost', original: String(originalStoreData.unitCost || 0), current: String(editForm.unitCost) },
      { key: 'supplier', original: originalStoreData.supplier || '', current: editForm.supplier },
      { key: 'lastOrderDate', original: originalStoreData.lastOrderDate || '', current: editForm.lastOrderDate },
      { key: 'leadTime', original: originalStoreData.leadTime || '', current: editForm.leadTime },
      { key: 'remarks', original: originalStoreData.remarks || '', current: editForm.remarks },
      { key: 'ihmPresence', original: originalStoreData.ihmPresence || 'Unknown', current: editForm.ihmPresence },
      { key: 'ihmEvidenceType', original: originalStoreData.ihmEvidenceType || 'None', current: editForm.ihmEvidenceType },
      { key: 'ihmDetails', original: originalStoreData.ihmDetails || '', current: editForm.ihmDetails },
      { key: 'expiryDate', original: originalStoreData.expiryDate || '', current: editForm.expiryDate },
      { key: 'batchNumber', original: originalStoreData.batchNumber || '', current: editForm.batchNumber },
      { key: 'lotNumber', original: originalStoreData.lotNumber || '', current: editForm.lotNumber },
      { key: 'hazardClassification', original: originalStoreData.hazardClassification || '', current: editForm.hazardClassification },
      { key: 'manufactureDate', original: originalStoreData.manufactureDate || '', current: editForm.manufactureDate },
      { key: 'sdsReference', original: originalStoreData.sdsReference || '', current: editForm.sdsReference },
      { key: 'sdsLastUpdated', original: originalStoreData.sdsLastUpdated || '', current: editForm.sdsLastUpdated },
      { key: 'shelfLifeMonths', original: String(originalStoreData.shelfLifeMonths || 0), current: String(editForm.shelfLifeMonths) },
      { key: 'unNumber', original: originalStoreData.unNumber || '', current: editForm.unNumber },
      { key: 'flashPoint', original: originalStoreData.flashPoint || '', current: editForm.flashPoint },
      { key: 'storageTempMin', original: originalStoreData.storageTempMin || '', current: editForm.storageTempMin },
      { key: 'storageTempMax', original: originalStoreData.storageTempMax || '', current: editForm.storageTempMax },
      { key: 'disposalInstructions', original: originalStoreData.disposalInstructions || '', current: editForm.disposalInstructions },
      { key: 'ppeRequirements', original: originalStoreData.ppeRequirements || '', current: editForm.ppeRequirements },
      { key: 'emergencyContact', original: originalStoreData.emergencyContact || '', current: editForm.emergencyContact },
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
  
  // Open Add Store modal
  const openAddStoreModal = () => {
    setAddStoreForm({
      itemCode: "",
      itemName: "",
      impaCode: "",
      category: "",
      specification: "",
      uom: "",
      customUom: "",
      rob: 0,
      robLocationA: 0,
      robLocationB: 0,
      locationA: "",
      locationB: "",
      min: 0,
      max: 0,
      unitCost: 0,
      supplier: "",
      lastOrderDate: "",
      leadTime: "",
      ihm: false,
      ihmDetails: "",
      ihmPresence: "Unknown",
      ihmEvidenceType: "None",
      remarks: "",
      manufactureDate: "",
      expiryDate: "",
      batchNumber: "",
      lotNumber: "",
      shelfLifeMonths: 0,
      sdsReference: "",
      sdsLastUpdated: "",
      hazardClassification: "",
      unNumber: "",
      flashPoint: "",
      storageTempMin: "",
      storageTempMax: "",
      disposalInstructions: "",
      ppeRequirements: "",
      emergencyContact: "",
    });
    setIsAddStoreModalOpen(true);
  };
  
  // Save new store item
  const saveAddStore = async () => {
    if (!vesselId) {
      toast({ title: "Error", description: "Please select a vessel first", variant: "destructive" });
      return;
    }
    
    if (!addStoreForm.itemCode.trim()) {
      toast({ title: "Validation Error", description: "Item Code is required", variant: "destructive" });
      return;
    }
    
    if (!addStoreForm.itemName.trim()) {
      toast({ title: "Validation Error", description: "Item Name is required", variant: "destructive" });
      return;
    }
    
    setIsAddingStore(true);
    
    try {
      const uom = addStoreForm.uom === "Other" ? addStoreForm.customUom : addStoreForm.uom;
      
      // Build payload matching storesItems schema
      const payload = {
        vesselId,
        itemType: activeTab, // stores | lubes | chemicals | others
        itemCode: addStoreForm.itemCode.trim(),
        itemName: addStoreForm.itemName.trim(),
        impaCode: addStoreForm.impaCode.trim() || null,
        category: addStoreForm.category || null,
        specification: addStoreForm.specification.trim() || null,
        uom: uom || null,
        rob: addStoreForm.rob,
        robLocationA: addStoreForm.robLocationA,
        robLocationB: addStoreForm.robLocationB,
        locationA: addStoreForm.locationA.trim() || null,
        locationB: addStoreForm.locationB.trim() || null,
        min: addStoreForm.min,
        max: addStoreForm.max || null,
        unitCost: addStoreForm.unitCost || null,
        supplier: addStoreForm.supplier.trim() || null,
        lastOrderDate: addStoreForm.lastOrderDate || null,
        leadTime: addStoreForm.leadTime.trim() || null,
        ihm: addStoreForm.ihm,
        ihmDetails: addStoreForm.ihmDetails.trim() || null,
        ihmPresence: addStoreForm.ihmPresence,
        ihmEvidenceType: addStoreForm.ihmEvidenceType,
        remarks: addStoreForm.remarks.trim() || null,
        isActive: true,
        manufactureDate: activeTab === 'chemicals' ? (addStoreForm.manufactureDate || null) : null,
        expiryDate: activeTab === 'chemicals' ? (addStoreForm.expiryDate || null) : null,
        batchNumber: activeTab === 'chemicals' ? (addStoreForm.batchNumber.trim() || null) : null,
        lotNumber: activeTab === 'chemicals' ? (addStoreForm.lotNumber.trim() || null) : null,
        shelfLifeMonths: activeTab === 'chemicals' ? (addStoreForm.shelfLifeMonths || null) : null,
        sdsReference: activeTab === 'chemicals' ? (addStoreForm.sdsReference.trim() || null) : null,
        sdsLastUpdated: activeTab === 'chemicals' ? (addStoreForm.sdsLastUpdated || null) : null,
        hazardClassification: activeTab === 'chemicals' ? (addStoreForm.hazardClassification || null) : null,
        unNumber: activeTab === 'chemicals' ? (addStoreForm.unNumber.trim() || null) : null,
        flashPoint: activeTab === 'chemicals' ? (addStoreForm.flashPoint.trim() || null) : null,
        storageTempMin: activeTab === 'chemicals' ? (addStoreForm.storageTempMin || null) : null,
        storageTempMax: activeTab === 'chemicals' ? (addStoreForm.storageTempMax || null) : null,
        disposalInstructions: activeTab === 'chemicals' ? (addStoreForm.disposalInstructions.trim() || null) : null,
        ppeRequirements: activeTab === 'chemicals' ? (addStoreForm.ppeRequirements.trim() || null) : null,
        emergencyContact: activeTab === 'chemicals' ? (addStoreForm.emergencyContact.trim() || null) : null,
      };
      
      await apiRequest('POST', `/technical/api/stores/${vesselId}/create`, payload);
      
      // Invalidate queries to refetch updated data (both inventory and history since ledger entry may be created)
      invalidateByUrlPrefix('/technical/api/stores');
      queryClient.invalidateQueries({ queryKey: [`/technical/api/stores/${vesselId}/history`, activeTab] });
      
      setIsAddStoreModalOpen(false);
      toast({ title: "Success", description: `Store item "${addStoreForm.itemName}" added successfully` });
    } catch (error: any) {
      console.error('Error adding store item:', error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to add store item", 
        variant: "destructive" 
      });
    } finally {
      setIsAddingStore(false);
    }
  };
  
  const saveEditItem = async () => {
    if (!editingItem) return;
    
    const uom = editForm.uom === "Other" ? editForm.customUom : editForm.uom;
    
    try {
      // Build update payload for API
      const updatePayload: Record<string, any> = {
        impaCode: editForm.impaCode.trim() || null,
        itemName: editForm.itemName,
        category: editForm.category || null,
        specification: editForm.specification.trim() || null,
        uom: uom,
        min: editForm.min,
        max: editForm.max || null,
        locationA: editForm.locationA.trim() || null,
        locationB: editForm.locationB.trim() || null,
        unitCost: editForm.unitCost || null,
        supplier: editForm.supplier.trim() || null,
        lastOrderDate: editForm.lastOrderDate || null,
        leadTime: editForm.leadTime.trim() || null,
        remarks: editForm.remarks.trim() || null,
        ihmPresence: editForm.ihmPresence || 'Unknown',
        ihmEvidenceType: editForm.ihmEvidenceType || 'None',
        ihmDetails: editForm.ihmDetails.trim() || null,
        expiryDate: activeTab === 'chemicals' ? (editForm.expiryDate || null) : undefined,
        batchNumber: activeTab === 'chemicals' ? (editForm.batchNumber || null) : undefined,
        lotNumber: activeTab === 'chemicals' ? (editForm.lotNumber || null) : undefined,
        hazardClassification: activeTab === 'chemicals' ? (editForm.hazardClassification || null) : undefined,
        sdsReference: activeTab === 'chemicals' ? (editForm.sdsReference || null) : undefined,
        sdsLastUpdated: activeTab === 'chemicals' ? (editForm.sdsLastUpdated || null) : undefined,
        manufactureDate: activeTab === 'chemicals' ? (editForm.manufactureDate || null) : undefined,
        shelfLifeMonths: activeTab === 'chemicals' ? (editForm.shelfLifeMonths || null) : undefined,
        unNumber: activeTab === 'chemicals' ? (editForm.unNumber || null) : undefined,
        flashPoint: activeTab === 'chemicals' ? (editForm.flashPoint || null) : undefined,
        storageTempMin: activeTab === 'chemicals' ? (editForm.storageTempMin || null) : undefined,
        storageTempMax: activeTab === 'chemicals' ? (editForm.storageTempMax || null) : undefined,
        disposalInstructions: activeTab === 'chemicals' ? (editForm.disposalInstructions || null) : undefined,
        ppeRequirements: activeTab === 'chemicals' ? (editForm.ppeRequirements || null) : undefined,
        emergencyContact: activeTab === 'chemicals' ? (editForm.emergencyContact || null) : undefined,
      };
      
      // Call API to persist changes
      await apiRequest('PATCH', `/technical/api/stores/${vesselId}/${editingItem.id}`, updatePayload);
      
      invalidateByUrlPrefix('/technical/api/stores');
      queryClient.invalidateQueries({ queryKey: [`/technical/api/stores/${vesselId}/history`, activeTab] });
      
      // Update local state optimistically
      const updatedItems = items.map(item => {
        if (item.id === editingItem.id) {
          const updatedItem = {
            ...item,
            impaCode: editForm.impaCode,
            itemName: editForm.itemName,
            storesCategory: editForm.category,
            specification: editForm.specification,
            uom: uom,
            min: editForm.min,
            max: editForm.max,
            locationAName: editForm.locationA,
            locationBName: editForm.locationB,
            location: editForm.locationA,
            unitCost: editForm.unitCost,
            supplier: editForm.supplier,
            lastOrderDate: editForm.lastOrderDate,
            leadTime: editForm.leadTime,
            remarks: editForm.remarks,
            notes: editForm.remarks,
            ihmPresence: editForm.ihmPresence,
            ihmEvidenceType: editForm.ihmEvidenceType,
            ihmDetails: editForm.ihmDetails,
            expiryDate: editForm.expiryDate,
            batchNumber: editForm.batchNumber,
            lotNumber: editForm.lotNumber,
            hazardClassification: editForm.hazardClassification,
            manufactureDate: editForm.manufactureDate,
            sdsReference: editForm.sdsReference,
            sdsLastUpdated: editForm.sdsLastUpdated,
            shelfLifeMonths: editForm.shelfLifeMonths,
            unNumber: editForm.unNumber,
            flashPoint: editForm.flashPoint,
            storageTempMin: editForm.storageTempMin,
            storageTempMax: editForm.storageTempMax,
            disposalInstructions: editForm.disposalInstructions,
            ppeRequirements: editForm.ppeRequirements,
            emergencyContact: editForm.emergencyContact,
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
    } catch (error: any) {
      console.error('Error saving stores item:', error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to save item changes", 
        variant: "destructive" 
      });
    }
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
      
      invalidateByUrlPrefix('/technical/api/stores');
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
      
      invalidateByUrlPrefix('/technical/api/stores');
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
  
  const enterDeleteSelectionMode = (preselectedId?: number) => {
    setIsDeleteSelectionMode(true);
    setSelectedStoreIds(preselectedId ? new Set([preselectedId]) : new Set());
  };

  const exitDeleteSelectionMode = () => {
    setIsDeleteSelectionMode(false);
    setSelectedStoreIds(new Set());
  };

  const toggleStoreSelection = (storeId: number) => {
    setSelectedStoreIds(prev => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allSelected = filteredItems.length > 0 && filteredItems.every((item: StoreItem) => selectedStoreIds.has(item.id));
    if (allSelected) {
      setSelectedStoreIds(new Set());
    } else {
      setSelectedStoreIds(new Set(filteredItems.map((item: StoreItem) => item.id)));
    }
  };

  const [isDeletingSelected, setIsDeletingSelected] = useState(false);

  const executeDeleteSelected = async () => {
    const visibleIds = new Set(filteredItems.map((item: StoreItem) => item.id));
    const idsToDelete = Array.from(selectedStoreIds).filter(id => visibleIds.has(id));
    if (idsToDelete.length === 0) {
      toast({ title: "No items selected", description: "Please select at least one item to delete.", variant: "destructive" });
      return;
    }
    setIsDeletingSelected(true);
    let successCount = 0;
    let failCount = 0;
    const failedIds = new Set<number>();
    for (const storeId of idsToDelete) {
      try {
        const response = await fetch(`/technical/api/stores/${vesselId}/${storeId}/inactivate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          successCount++;
        } else {
          failCount++;
          failedIds.add(storeId);
        }
      } catch {
        failCount++;
        failedIds.add(storeId);
      }
    }
    invalidateByUrlPrefix('/technical/api/stores');
    queryClient.invalidateQueries({ queryKey: [`/technical/api/stores/${vesselId}/history`, activeTab] });
    setIsDeletingSelected(false);
    if (failCount === 0) {
      exitDeleteSelectionMode();
      toast({ title: "Success", description: `${successCount} item(s) deleted successfully.` });
    } else {
      setSelectedStoreIds(failedIds);
      toast({ title: "Partial failure", description: `${successCount} succeeded, ${failCount} failed. Failed items remain selected.`, variant: "destructive" });
    }
  };

  // ============================================================
  // AG Grid: helper for inventory row class
  // ============================================================
  const inventoryGetRowClass = (params: any): string | undefined => {
    const item = params.data as StoreItem | undefined;
    if (!item) return undefined;
    const classes: string[] = [];
    if (item.isActive === false) classes.push('spare-row-inactive');
    if (isDeleteSelectionMode && selectedStoreIds.has(item.id)) classes.push('spare-row-bulk-selected');
    return classes.length > 0 ? classes.join(' ') : undefined;
  };

  // ============================================================
  // AG Grid: Inventory column definitions
  // ============================================================
  const inventoryColumnDefs: ColDef[] = useMemo(() => {
    const cols: ColDef[] = [];

    if (isDeleteSelectionMode) {
      cols.push({
        headerName: '',
        colId: 'bulkSelect',
        width: 50,
        minWidth: 50,
        maxWidth: 50,
        sortable: false,
        filter: false,
        suppressMovable: true,
        pinned: 'left',
        headerComponent: () => (
          <input
            type="checkbox"
            checked={filteredItems.length > 0 && filteredItems.every((i: StoreItem) => selectedStoreIds.has(i.id))}
            onChange={toggleSelectAll}
            className="h-4 w-4 rounded border-white cursor-pointer accent-white"
            data-testid="checkbox-select-all"
          />
        ),
        cellRenderer: (params: ICellRendererParams) => {
          const item = params.data as StoreItem;
          return (
            <input
              type="checkbox"
              checked={selectedStoreIds.has(item.id)}
              onChange={() => toggleStoreSelection(item.id)}
              className="h-4 w-4 rounded border-gray-300 cursor-pointer"
              data-testid={`checkbox-store-${item.id}`}
            />
          );
        },
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      });
    }

    cols.push(
      {
        field: 'itemCode',
        headerName: activeTab === 'lubes' ? 'Lube Grade' : activeTab === 'chemicals' ? 'Chem Code' : 'Item Code',
        flex: 1.4,
        minWidth: 130,
        tooltipField: 'itemCode',
        filter: 'agSetColumnFilter',
        cellRenderer: (params: ICellRendererParams) => {
          const item = params.data as StoreItem;
          return (
            <span className="font-medium text-gray-900 truncate" data-testid={params.node.rowIndex === 0 ? getMarkerId(activeTab, '20') : undefined}>
              {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '10')} />}
              {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '20')} />}
              {item.itemCode}
            </span>
          );
        },
      },
      {
        field: 'itemName',
        headerName: activeTab === 'lubes' ? 'Lube Type' : activeTab === 'chemicals' ? 'Chemical Name' : 'Item Name',
        flex: 1.6,
        minWidth: 160,
        tooltipField: 'itemName',
        filter: 'agSetColumnFilter',
        cellRenderer: (params: ICellRendererParams) => {
          const item = params.data as StoreItem;
          return (
            <span className="text-gray-700 truncate" data-testid={params.node.rowIndex === 0 ? getMarkerId(activeTab, '21') : undefined}>
              {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '11')} />}
              {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '21')} />}
              {item.itemName}
            </span>
          );
        },
      },
      {
        field: 'storesCategory',
        headerName: activeTab === 'lubes' ? 'Application' : activeTab === 'chemicals' ? 'Application Area' : 'Stores Category',
        flex: 1.4,
        minWidth: 130,
        tooltipField: 'storesCategory',
        filter: 'agSetColumnFilter',
        cellRenderer: (params: ICellRendererParams) => {
          const item = params.data as StoreItem;
          return (
            <span className="text-gray-600 truncate" data-testid={params.node.rowIndex === 0 ? getMarkerId(activeTab, '22') : undefined}>
              {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '12')} />}
              {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '22')} />}
              {item.storesCategory}
            </span>
          );
        },
      },
      {
        field: 'uom',
        headerName: 'UOM',
        flex: 0.6,
        minWidth: 70,
        filter: 'agSetColumnFilter',
        cellRenderer: (params: ICellRendererParams) => {
          const item = params.data as StoreItem;
          return (
            <span className="text-gray-700" data-testid={params.node.rowIndex === 0 ? getMarkerId(activeTab, '23') : undefined}>
              {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '13')} />}
              {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '23')} />}
              {item.uom || '-'}
            </span>
          );
        },
      },
      {
        field: 'rob',
        headerName: 'ROB',
        flex: 0.6,
        minWidth: 70,
        filter: 'agNumberColumnFilter',
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
        cellRenderer: (params: ICellRendererParams) => {
          const item = params.data as StoreItem;
          return (
            <span data-testid={params.node.rowIndex === 0 ? getMarkerId(activeTab, '24') : undefined}>
              {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '14')} />}
              {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '24')} />}
              {item.rob}
            </span>
          );
        },
      },
      {
        field: 'min',
        headerName: 'Min',
        flex: 0.6,
        minWidth: 70,
        filter: 'agNumberColumnFilter',
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
        cellRenderer: (params: ICellRendererParams) => {
          const item = params.data as StoreItem;
          return (
            <span data-testid={params.node.rowIndex === 0 ? getMarkerId(activeTab, '25') : undefined}>
              {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '15')} />}
              {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '25')} />}
              {item.min}
            </span>
          );
        },
      },
      {
        field: 'stock',
        headerName: 'Stock',
        flex: 0.7,
        minWidth: 80,
        filter: 'agSetColumnFilter',
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
        cellRenderer: (params: ICellRendererParams) => {
          const item = params.data as StoreItem;
          return (
            <span data-testid={params.node.rowIndex === 0 ? getMarkerId(activeTab, '26') : undefined}>
              {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '16')} />}
              {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '26')} />}
              <span className={`px-2 py-1 rounded text-xs ${getStockColor(item.stock)}`}>
                {item.stock}
              </span>
            </span>
          );
        },
      },
      {
        headerName: 'Location',
        colId: 'location',
        flex: 1.1,
        minWidth: 130,
        sortable: false,
        filter: 'agSetColumnFilter',
        valueGetter: (params: any) => {
          const item = params.data as StoreItem;
          if (!item) return '';
          return `@ ${item.robLocationA ?? 0} / ${item.robLocationB ?? 0}`;
        },
        cellRenderer: (params: ICellRendererParams) => {
          const item = params.data as StoreItem;
          return (
            <span data-testid={params.node.rowIndex === 0 ? getMarkerId(activeTab, '27') : undefined}>
              {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '17')} />}
              {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '27')} />}
              <button
                onClick={() => handleOpenLocationDialog(item)}
                className="flex items-center gap-1 text-gray-700 hover:text-blue-600 cursor-pointer w-full text-left"
                data-testid={`button-location-${item.id}`}
              >
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate text-sm">@ {item.robLocationA ?? 0} / {item.robLocationB ?? 0}</span>
                <ChevronDown className="h-3 w-3 flex-shrink-0" />
              </button>
            </span>
          );
        },
      },
    );

    if (activeTab === 'chemicals') {
      cols.push(
        {
          field: 'expiryDate',
          headerName: 'Expiry',
          flex: 0.8,
          minWidth: 90,
          filter: 'agSetColumnFilter',
          cellRenderer: (params: ICellRendererParams) => {
            const item = params.data as StoreItem;
            if (!item.expiryDate) return <span className="text-xs">-</span>;
            const d = new Date(item.expiryDate);
            const today = new Date();
            const days = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const colorClass =
              days < 0 ? 'text-red-600 font-semibold' :
              days <= 30 ? 'text-orange-600 font-semibold' :
              days <= 90 ? 'text-yellow-600' :
              'text-green-600';
            return <span className={`text-xs ${colorClass}`}>{item.expiryDate}</span>;
          },
        },
        {
          field: 'batchNumber',
          headerName: 'Batch #',
          flex: 0.8,
          minWidth: 90,
          filter: 'agSetColumnFilter',
          cellRenderer: (params: ICellRendererParams) => {
            const item = params.data as StoreItem;
            return <span className="text-xs truncate">{item.batchNumber || '-'}</span>;
          },
        },
        {
          field: 'hazardClassification',
          headerName: 'Hazard',
          flex: 0.8,
          minWidth: 100,
          filter: 'agSetColumnFilter',
          cellRenderer: (params: ICellRendererParams) => {
            const item = params.data as StoreItem;
            if (!item.hazardClassification || item.hazardClassification === 'None') return <span>-</span>;
            const colorClass =
              item.hazardClassification === 'Flammable' ? 'border-red-300 text-red-700 bg-red-50' :
              item.hazardClassification === 'Toxic' ? 'border-purple-300 text-purple-700 bg-purple-50' :
              item.hazardClassification === 'Corrosive' ? 'border-yellow-300 text-yellow-700 bg-yellow-50' :
              item.hazardClassification === 'Oxidizer' ? 'border-blue-300 text-blue-700 bg-blue-50' :
              item.hazardClassification === 'Compressed Gas' ? 'border-cyan-300 text-cyan-700 bg-cyan-50' :
              'border-gray-300 text-gray-700 bg-gray-50';
            return (
              <Badge variant="outline" className={`text-xs ${colorClass}`}>
                {item.hazardClassification}
              </Badge>
            );
          },
        },
      );
    }

    if (FEATURES.IHM) {
      cols.push({
        field: 'ihmPresence',
        headerName: 'IHM',
        flex: 0.5,
        minWidth: 60,
        sortable: false,
        filter: false,
        cellRenderer: (params: ICellRendererParams) => {
          const item = params.data as StoreItem;
          const icon = item.ihmPresence === 'Present' ? (
            <div title="IHM Present"><AlertCircle className="h-4 w-4 text-red-500" /></div>
          ) : item.ihmPresence === 'Not Present' ? (
            <div title="IHM Not Present"><CheckCircle className="h-4 w-4 text-green-500" /></div>
          ) : (
            <div title="IHM Unknown"><HelpCircle className="h-4 w-4 text-gray-400" /></div>
          );
          return (
            <span className="flex justify-center" data-testid={params.node.rowIndex === 0 ? getMarkerId(activeTab, '28') : undefined}>
              {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '18')} />}
              {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '28')} />}
              {icon}
            </span>
          );
        },
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      });
    }

    if (!isDeleteSelectionMode) {
      cols.push({
        headerName: 'Actions',
        colId: 'actions',
        flex: 1,
        minWidth: 130,
        sortable: false,
        filter: false,
        cellRenderer: (params: ICellRendererParams) => {
          const item = params.data as StoreItem;
          return (
            <div className="flex gap-1 items-center justify-end pr-2 whitespace-nowrap w-full">
              {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '19')} />}
              {item.isActive === false ? (
                !isVessel && canEditStore && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 p-1 hover:bg-green-50 text-green-600"
                    onClick={async () => {
                      try {
                        await apiRequest('PUT', `/technical/api/stores/item/${item.id}`, { isActive: true });
                        invalidateByUrlPrefix('/technical/api/stores');
                        toast({ title: "Success", description: "Item restored" });
                      } catch (error) {
                        toast({ title: "Error", description: "Failed to restore item", variant: "destructive" });
                      }
                    }}
                    aria-label="Restore Item"
                    title="Restore"
                    data-testid={`button-restore-${item.id}`}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    <span className="text-xs">Restore</span>
                  </Button>
                )
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 hover:bg-gray-100"
                    onClick={() => openViewModal(item)}
                    aria-label="View Details"
                    title="View Details"
                    data-testid={params.node.rowIndex === 0 ? getMarkerId(activeTab, '30') : `button-info-${item.id}`}
                  >
                    {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '30')} />}
                    <Info className="h-4 w-4 text-blue-600" />
                  </Button>
                  {((!isVessel && !isHeadOfDept) || isModifyMode) && canEditStore && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-gray-100"
                      onClick={() => openEditModal(item)}
                      aria-label="Edit Item"
                      title="Edit"
                      data-testid={params.node.rowIndex === 0 ? getMarkerId(activeTab, '29') : `button-edit-${item.id}`}
                    >
                      {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '29')} />}
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                  {!isVessel && canDeleteStore && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-gray-100"
                      onClick={() => enterDeleteSelectionMode(item.id)}
                      aria-label="Delete Item"
                      title="Delete"
                      data-testid={params.node.rowIndex === 0 ? getMarkerId(activeTab, '31') : `button-delete-${item.id}`}
                    >
                      {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '31')} />}
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </>
              )}
            </div>
          );
        },
      });
    }

    return cols;
  }, [activeTab, isDeleteSelectionMode, selectedStoreIds, filteredItems, isVessel, isHeadOfDept, isModifyMode, canEditStore, canDeleteStore, vesselId]);

  // ============================================================
  // AG Grid: Location-tab items + column definitions
  // ============================================================
  const locationItems = useMemo(() => {
    if (!selectedLocationName) return [] as Array<StoreItem & { _side: 'A' | 'B'; _locRob: number; _locName: string; _editKey: string }>;
    return filteredItems
      .filter(item => getItemLocationSide(item, selectedLocationName) !== null)
      .map(item => {
        const side = getItemLocationSide(item, selectedLocationName)! as 'A' | 'B';
        const locRob = side === 'A' ? (item.robLocationA ?? 0) : (item.robLocationB ?? 0);
        const locName = side === 'A' ? (item.locationAName || '') : (item.locationBName || '');
        return { ...item, _side: side, _locRob: locRob, _locName: locName, _editKey: `${item.id}-${side}` };
      });
  }, [filteredItems, selectedLocationName]);

  // ============================================================
  // Pagination calculations
  // ============================================================
  const locationTotalPages = Math.max(1, Math.ceil(locationItems.length / locationItemsPerPage));
  const paginatedLocationItems = useMemo(() => {
    const start = (locationPage - 1) * locationItemsPerPage;
    return locationItems.slice(start, start + locationItemsPerPage);
  }, [locationItems, locationPage, locationItemsPerPage]);
  const goToLocationPage = (page: number) => {
    setLocationPage(Math.max(1, Math.min(page, locationTotalPages)));
  };

  // Reset pages when filters/dataset change
  useEffect(() => { setLocationPage(1); }, [selectedLocationName, vesselId, locationItemsPerPage]);

  // Clamp pages when totalPages shrinks
  useEffect(() => {
    if (locationPage > locationTotalPages) setLocationPage(locationTotalPages);
  }, [locationTotalPages, locationPage]);

  const locationColumnDefs: ColDef[] = useMemo(() => {
    const cols: ColDef[] = [
      {
        field: 'itemCode',
        headerName: 'Item Code',
        flex: 1,
        minWidth: 110,
        filter: 'agTextColumnFilter',
        headerComponent: () => <span data-testid="stores-loc-col-item-code">Item Code</span>,
        cellRenderer: (params: ICellRendererParams) => <span className="text-gray-900">{params.value}</span>,
      },
      {
        field: 'itemName',
        headerName: 'Item Name',
        flex: 1.6,
        minWidth: 180,
        tooltipField: 'itemName',
        filter: 'agTextColumnFilter',
        headerComponent: () => <span data-testid="stores-loc-col-item-name">Item Name</span>,
        cellRenderer: (params: ICellRendererParams) => <span className="text-gray-700 truncate">{params.value}</span>,
      },
      {
        field: 'storesCategory',
        headerName: 'Stores Category',
        flex: 1.2,
        minWidth: 140,
        filter: 'agTextColumnFilter',
        headerComponent: () => <span data-testid="stores-loc-col-category">Stores Category</span>,
        cellRenderer: (params: ICellRendererParams) => <span className="text-gray-700 truncate">{params.value}</span>,
      },
      {
        field: 'uom',
        headerName: 'UOM',
        flex: 0.6,
        minWidth: 70,
        filter: 'agTextColumnFilter',
        headerComponent: () => <span data-testid="stores-loc-col-uom">UOM</span>,
        cellRenderer: (params: ICellRendererParams) => <span className="text-gray-500">{params.value || '-'}</span>,
      },
      {
        field: 'rob',
        headerName: 'ROB',
        flex: 0.6,
        minWidth: 70,
        filter: 'agNumberColumnFilter',
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
        headerComponent: () => <span data-testid="stores-loc-col-rob">ROB</span>,
      },
      {
        field: 'min',
        headerName: 'Min',
        flex: 0.6,
        minWidth: 70,
        filter: 'agNumberColumnFilter',
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
        headerComponent: () => <span data-testid="stores-loc-col-min">Min</span>,
      },
      {
        field: 'stock',
        headerName: 'Stock',
        flex: 0.7,
        minWidth: 80,
        filter: 'agTextColumnFilter',
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
        headerComponent: () => <span data-testid="stores-loc-col-stock">Stock</span>,
        cellRenderer: (params: ICellRendererParams) => {
          const item = params.data as StoreItem;
          return (
            <span className={`px-2 py-1 rounded text-xs ${getStockColor(item.stock)}`}>
              {item.stock}
            </span>
          );
        },
      },
      {
        headerName: 'Location',
        colId: 'locationChange',
        flex: 1.4,
        minWidth: 160,
        sortable: false,
        filter: false,
        headerComponent: () => <span data-testid="stores-loc-col-location">Location</span>,
        cellRenderer: (params: ICellRendererParams) => {
          const item = params.data as StoreItem & { _locName: string };
          const locName = item._locName;
          const inactive = item.isActive === false;
          return (
            <LocationSearchDropdown
              vesselId={vesselId}
              value={locName}
              onChange={(name) => { if (name && name !== locName) handleChangeStoreLocation(item, name); }}
              disabled={isChangingStoreLocation || !canEditStore || inactive}
              triggerClassName="h-7 px-2 text-xs"
              data-testid={`store-location-${item.id}`}
            />
          );
        },
      },
      {
        headerName: 'Loc ROB',
        colId: 'locRob',
        flex: 0.8,
        minWidth: 90,
        filter: 'agNumberColumnFilter',
        headerComponent: () => <span data-testid="stores-loc-col-loc-rob">Loc ROB</span>,
        cellRenderer: (params: ICellRendererParams) => {
          const item = params.data as StoreItem & { _side: 'A' | 'B'; _locRob: number; _editKey: string };
          const editingLocRobVal = editingLocRobValues[item._editKey];
          return (
            <input
              type="number"
              min="0"
              className="w-full text-center border border-gray-200 rounded-md px-2 py-1 text-sm outline-none focus:border-blue-400"
              value={editingLocRobVal !== undefined ? editingLocRobVal : item._locRob}
              onChange={(e) => setEditingLocRobValues(prev => ({ ...prev, [item._editKey]: e.target.value }))}
              onBlur={() => {
                const newVal = editingLocRobVal !== undefined ? Number(editingLocRobVal) : item._locRob;
                if (canEditStore && editingLocRobVal !== undefined && newVal !== item._locRob && !isNaN(newVal) && newVal >= 0) {
                  const fieldKey = item._side === 'A' ? 'robLocationA' : 'robLocationB';
                  fetch(`/technical/api/stores/${vesselId}/${item.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [fieldKey]: newVal }),
                  }).then(() => {
                    invalidateByUrlPrefix('/technical/api/stores');
                  });
                }
                setEditingLocRobValues(prev => { const n = { ...prev }; delete n[item._editKey]; return n; });
              }}
              disabled={!canEditStore || item.isActive === false}
              data-testid={`input-loc-rob-${item.id}`}
            />
          );
        },
      },
    ];

    if (FEATURES.IHM) {
      cols.push({
        headerName: 'IHM',
        colId: 'ihm',
        width: 60,
        minWidth: 60,
        sortable: false,
        filter: false,
        headerComponent: () => <span data-testid="stores-loc-col-ihm">IHM</span>,
        cellRenderer: (params: ICellRendererParams) => {
          const item = params.data as StoreItem;
          if (item.ihmPresence === 'Present') return <div title="IHM Present"><AlertCircle className="h-4 w-4 text-red-500" /></div>;
          if (item.ihmPresence === 'Not Present') return <div title="IHM Not Present"><CheckCircle className="h-4 w-4 text-green-500" /></div>;
          return <div title="IHM Unknown"><HelpCircle className="h-4 w-4 text-gray-400" /></div>;
        },
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      });
    }

    return cols;
  }, [activeTab, vesselId, allVesselLocations, isChangingStoreLocation, canEditStore, editingLocRobValues]);

  const locationGetRowClass = (params: any): string | undefined => {
    const item = params.data as StoreItem | undefined;
    if (item?.isActive === false) return 'spare-row-inactive';
    return undefined;
  };

  // ============================================================
  // AG Grid: History column definitions
  // ============================================================
  const historyColumnDefs: ColDef[] = useMemo(() => [
    {
      field: 'dateLocal',
      headerName: 'Date',
      flex: 1.2,
      minWidth: 130,
      filter: 'agSetColumnFilter',
      cellRenderer: (params: ICellRendererParams) => (
        <span className="text-gray-700">
          {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '2.14')} />}
          {params.value}
        </span>
      ),
    },
    {
      field: 'eventType',
      headerName: 'Event',
      flex: 0.8,
      minWidth: 100,
      filter: 'agSetColumnFilter',
      cellRenderer: (params: ICellRendererParams) => {
        const item = params.data as StoresHistoryItem;
        const colorClass =
          item.eventType === 'RECEIVE' ? 'bg-green-100 text-green-800' :
          item.eventType === 'CONSUME' ? 'bg-orange-100 text-orange-800' :
          item.eventType === 'INITIAL' ? 'bg-blue-100 text-blue-800' :
          'bg-gray-100 text-gray-800';
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium ${colorClass}`}>
            {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '2.15')} />}
            {item.eventType}
          </span>
        );
      },
    },
    {
      field: 'itemName',
      headerName: 'Item Name',
      flex: 1.8,
      minWidth: 160,
      tooltipField: 'itemName',
      filter: 'agSetColumnFilter',
      cellRenderer: (params: ICellRendererParams) => (
        <span className="text-gray-700 truncate">
          {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '2.16')} />}
          {params.value}
        </span>
      ),
    },
    {
      field: 'partCode',
      headerName: 'Part Code',
      flex: 0.9,
      minWidth: 100,
      filter: 'agSetColumnFilter',
      cellRenderer: (params: ICellRendererParams) => (
        <span className="text-gray-600">
          {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '2.17')} />}
          {params.value}
        </span>
      ),
    },
    {
      field: 'uom',
      headerName: 'UOM',
      flex: 0.6,
      minWidth: 70,
      filter: 'agSetColumnFilter',
      cellRenderer: (params: ICellRendererParams) => (
        <span className="text-gray-600">
          {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '2.18')} />}
          {params.value || '-'}
        </span>
      ),
    },
    {
      field: 'qtyChange',
      headerName: 'Qty Change',
      flex: 0.8,
      minWidth: 90,
      filter: 'agNumberColumnFilter',
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      cellRenderer: (params: ICellRendererParams) => {
        const item = params.data as StoresHistoryItem;
        return (
          <span className={`font-semibold ${item.qtyChange < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '2.19')} />}
            {item.qtyChange > 0 ? '+' : ''}{item.qtyChange}
          </span>
        );
      },
    },
    {
      field: 'robAfter',
      headerName: 'ROB After',
      flex: 0.8,
      minWidth: 90,
      filter: 'agNumberColumnFilter',
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      cellRenderer: (params: ICellRendererParams) => (
        <span className="text-gray-700">
          {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '2.20')} />}
          {params.value}
        </span>
      ),
    },
    {
      field: 'place',
      headerName: 'Place',
      flex: 0.9,
      minWidth: 100,
      filter: 'agSetColumnFilter',
      cellRenderer: (params: ICellRendererParams) => (
        <span className="text-gray-600">
          {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '2.21')} />}
          {params.value || '-'}
        </span>
      ),
    },
    {
      field: 'userId',
      headerName: 'User',
      flex: 0.9,
      minWidth: 100,
      filter: 'agSetColumnFilter',
      cellRenderer: (params: ICellRendererParams) => (
        <span className="text-gray-600">
          {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '2.22')} />}
          {params.value}
        </span>
      ),
    },
    {
      headerName: 'Remarks',
      colId: 'remarks',
      flex: 1.2,
      minWidth: 130,
      filter: 'agSetColumnFilter',
      cellRenderer: (params: ICellRendererParams) => {
        const item = params.data as StoresHistoryItem;
        const text = item.remarks || item.ref || '-';
        return (
          <span className="text-gray-600 truncate" title={item.remarks || item.ref}>
            {params.node.rowIndex === 0 && <Marker id={getMarkerId(activeTab, '2.23')} />}
            {text}
          </span>
        );
      },
    },
  ], [activeTab]);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header - Fixed */}
      <div className="flex-shrink-0 space-y-4 pb-4">
        {/* Header with centered module tabs */}
        <div className="flex items-center justify-between relative">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-800" data-testid={viewMode === "inventory" ? getMarkerId(activeTab, "33") : viewMode === "location" ? getMarkerId(activeTab, "loc.1") : getMarkerId(activeTab, "2.1")}>
            {viewMode === "inventory" && <Marker id={getMarkerId(activeTab, "33")} />}
            {viewMode === "location" && <Marker id={getMarkerId(activeTab, "loc.1")} />}
            {viewMode === "history" && <Marker id={getMarkerId(activeTab, "2.1")} />}
            {viewMode === "location" ? "Stores By Location" :
             activeTab === "stores" ? "Stores Inventory" : 
             activeTab === "lubes" ? "Lubes Inventory" :
             activeTab === "chemicals" ? "Chemicals Inventory" : "Others Inventory"}
          </h1>
          {isModifyMode && (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full border border-blue-300">
              Modify Mode
            </span>
          )}
        </div>
        
        {/* Module Tabs - Center aligned with pill styling */}
        <div className="absolute left-1/2 -translate-x-1/2 bg-gray-100 rounded-md p-1 flex items-center gap-1">
          <button
            onClick={() => setActiveTab("stores")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === "stores"
                ? "bg-[#52baf3] text-white"
                : "text-gray-700 hover:bg-gray-200"
            }`}
            data-testid={viewMode === "inventory" ? "F.S" : getMarkerId(activeTab, "2.2")}
          >
            {viewMode === "inventory" && <Marker id="F.S" />}
            {viewMode === "history" && <Marker id={getMarkerId(activeTab, "2.2")} />}
            Stores
          </button>
          <button
            onClick={() => setActiveTab("lubes")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === "lubes"
                ? "bg-[#52baf3] text-white"
                : "text-gray-700 hover:bg-gray-200"
            }`}
            data-testid={viewMode === "inventory" ? "F.L" : getMarkerId(activeTab, "2.3")}
          >
            {viewMode === "inventory" && <Marker id="F.L" />}
            {viewMode === "history" && <Marker id={getMarkerId(activeTab, "2.3")} />}
            Lubes
          </button>
          <button
            onClick={() => setActiveTab("chemicals")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === "chemicals"
                ? "bg-[#52baf3] text-white"
                : "text-gray-700 hover:bg-gray-200"
            }`}
            data-testid={viewMode === "inventory" ? "F.C" : getMarkerId(activeTab, "2.4")}
          >
            {viewMode === "inventory" && <Marker id="F.C" />}
            {viewMode === "history" && <Marker id={getMarkerId(activeTab, "2.4")} />}
            Chemicals
          </button>
          <button
            onClick={() => setActiveTab("others")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === "others"
                ? "bg-[#52baf3] text-white"
                : "text-gray-700 hover:bg-gray-200"
            }`}
            data-testid={viewMode === "inventory" ? "F.O" : getMarkerId(activeTab, "2.5")}
          >
            {viewMode === "inventory" && <Marker id="F.O" />}
            {viewMode === "history" && <Marker id={getMarkerId(activeTab, "2.5")} />}
            Others
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          {isDeleteSelectionMode ? (
            <>
              <span className="text-sm text-gray-600 mr-2" data-testid="text-selected-count">
                {selectedStoreIds.size} item(s) selected
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
                onClick={viewMode === "history" ? exportHistoryToExcel : exportInventoryToExcel}
                data-testid={viewMode === "inventory" ? getMarkerId(activeTab, "8") : viewMode === "history" ? getMarkerId(activeTab, "2.13") : "stores-loc-export"}
              >
                {viewMode === "inventory" && <Marker id={getMarkerId(activeTab, "8")} />}
                {viewMode === "history" && <Marker id={getMarkerId(activeTab, "2.13")} />}
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={executeDeleteSelected}
                disabled={selectedStoreIds.size === 0 || isDeletingSelected}
                data-testid="button-delete-selected"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {isDeletingSelected ? "Deleting..." : "Delete"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exitDeleteSelectionMode}
                data-testid="button-cancel-delete-selection"
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
                onClick={viewMode === "history" ? exportHistoryToExcel : exportInventoryToExcel}
                data-testid={viewMode === "inventory" ? getMarkerId(activeTab, "8") : viewMode === "history" ? getMarkerId(activeTab, "2.13") : "stores-loc-export"}
              >
                {viewMode === "inventory" && <Marker id={getMarkerId(activeTab, "8")} />}
                {viewMode === "history" && <Marker id={getMarkerId(activeTab, "2.13")} />}
                <Download className="h-4 w-4" />
                Export
              </Button>
              {canCreateStore && (
              <Button 
                className="bg-[#5dc86f] hover:bg-[#4db85f] text-white" 
                size="sm"
                onClick={openAddStoreModal}
                data-testid={viewMode === "inventory" ? getMarkerId(activeTab, "3a") : getMarkerId(activeTab, "2.6a")}
              >
                {viewMode === "inventory" && <Marker id={getMarkerId(activeTab, "3a")} />}
                {viewMode === "history" && <Marker id={getMarkerId(activeTab, "2.6a")} />}
                <Plus className="h-4 w-4 mr-1" /> Add Store
              </Button>
              )}
              {canEditStore && (
              <Button 
                className="bg-[#5dc86f] hover:bg-[#4db85f] text-white" 
                size="sm"
                onClick={openBulkUpdateModal}
                data-testid={viewMode === "inventory" ? getMarkerId(activeTab, "3") : getMarkerId(activeTab, "2.6")}
              >
                {viewMode === "inventory" && <Marker id={getMarkerId(activeTab, "3")} />}
                {viewMode === "history" && <Marker id={getMarkerId(activeTab, "2.6")} />}
                <Plus className="h-4 w-4 mr-1" /> Bulk Update {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* View Mode Tabs - Center aligned */}
      <div className="flex justify-center">
        <div className="bg-gray-100 rounded-md p-1 flex items-center gap-1">
          <button
            onClick={() => setViewMode("inventory")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === "inventory"
                ? "bg-[#52baf3] text-white"
                : "text-gray-700 hover:bg-gray-200"
            }`}
            data-testid={viewMode === "inventory" ? getMarkerId(activeTab, "1") : getMarkerId(activeTab, "2.7")}
          >
            {viewMode === "inventory" && <Marker id={getMarkerId(activeTab, "1")} />}
            {viewMode === "history" && <Marker id={getMarkerId(activeTab, "2.7")} />}
            Inventory
          </button>
          <button
            onClick={() => setViewMode("location")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === "location"
                ? "bg-[#52baf3] text-white"
                : "text-gray-700 hover:bg-gray-200"
            }`}
            data-testid="tab-stores-by-location"
          >
            Location
          </button>
          <button
            onClick={() => setViewMode("history")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === "history"
                ? "bg-[#52baf3] text-white"
                : "text-gray-700 hover:bg-gray-200"
            }`}
            data-testid={viewMode === "inventory" ? getMarkerId(activeTab, "2") : getMarkerId(activeTab, "2.8")}
          >
            {viewMode === "inventory" && <Marker id={getMarkerId(activeTab, "2")} />}
            {viewMode === "history" && <Marker id={getMarkerId(activeTab, "2.8")} />}
            History
          </button>
        </div>
      </div>

      {/* Filters - Show different filters based on view mode */}
      {viewMode === "location" ? (
      <div className="flex gap-3 items-center">
        {(isSailAdmin || isClientAdmin || isChangeMode) && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Vessel:</span>
            <Select value={(vesselId === 'all' || vesselId === 'my') ? '' : vesselId} onValueChange={setVesselId}>
              <SelectTrigger className="w-[200px]" data-testid="stores-loc-vessel-selector">
                <SelectValue placeholder="Choose vessel" />
              </SelectTrigger>
              <SelectContent>
                {myVesselsEmpty ? (
                  <div className="px-2 py-1.5 text-sm text-gray-500" data-testid="select-no-assigned-vessels">
                    No assigned vessels
                  </div>
                ) : (
                  pickerVessels.map(vessel => (
                    <SelectItem key={vessel.id} value={vessel.id}>
                      {vessel.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="stores-loc-search"
          />
        </div>
        <div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40" data-testid="stores-loc-category-filter">
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
            <SelectTrigger className="w-32" data-testid="stores-loc-stock-filter">
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
          variant="outline" 
          size="sm" 
          className="text-gray-600"
          onClick={() => {
            setSearchTerm("");
            setCategoryFilter("all");
            setStockFilter("all");
          }}
          data-testid="stores-loc-clear"
        >
          Clear
        </Button>
        <Button 
          size="sm" 
          className="bg-[#52baf3] hover:bg-[#3da8e0] text-white"
          onClick={handleSaveAllLocRob}
          disabled={isSavingLocRob || !canEditStore}
          data-testid="stores-loc-save"
        >
          {isSavingLocRob ? 'Saving...' : 'Save'}
        </Button>
      </div>
      ) : viewMode === "inventory" ? (
      <div className="flex gap-3 items-center">
        {/* Vessel selector - visible for Sail Admin, Client Admin, or in change mode */}
        {(isSailAdmin || isClientAdmin || isChangeMode) && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Vessel:</span>
            <Select value={(vesselId === 'all' || vesselId === 'my') ? '' : vesselId} onValueChange={setVesselId}>
              <SelectTrigger className="w-[200px]" data-testid={getMarkerId(activeTab, "4")}>
                <Marker id={getMarkerId(activeTab, "4")} />
                <SelectValue placeholder="Choose vessel" />
              </SelectTrigger>
              <SelectContent>
                {myVesselsEmpty ? (
                  <div className="px-2 py-1.5 text-sm text-gray-500" data-testid="select-no-assigned-vessels">
                    No assigned vessels
                  </div>
                ) : (
                  pickerVessels.map(vessel => (
                    <SelectItem key={vessel.id} value={vessel.id}>
                      {vessel.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="relative w-80">
          <Marker id={getMarkerId(activeTab, "5")} />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid={getMarkerId(activeTab, "5")}
          />
        </div>
        <div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40" data-testid={getMarkerId(activeTab, "6")}>
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
            <SelectTrigger className="w-32" data-testid={getMarkerId(activeTab, "7")}>
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
          variant="outline" 
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
      <div className="flex gap-3">
        <div className="relative w-80">
          <Marker id={getMarkerId(activeTab, "2.9")} />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search history..."
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            className="pl-10"
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
        <div className="relative">
          <Marker id={getMarkerId(activeTab, "2.11")} />
          <PeriodFilter
            value={historyPeriodFilter}
            onChange={setHistoryPeriodFilter}
            className="min-w-[180px]"
          />
        </div>
        <Button
          variant="outline"
          className="text-gray-600"
          onClick={() => {
            setHistorySearch("");
            setHistoryEventFilter("all");
            setHistoryPeriodFilter(null);
          }}
          data-testid="button-clear-history-filters"
        >
          Clear
        </Button>
      </div>
      )}
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* Table */}
        {viewMode === "inventory" ? (
          <div className="bg-white rounded-lg shadow overflow-hidden h-full flex flex-col">
            <div className="flex-1 min-h-[400px]">
              <WOAgGridTable
                columnDefs={inventoryColumnDefs}
                rowData={filteredItems}
                getRowClass={inventoryGetRowClass}
                noRowsMessage="No items found. Try adjusting your filters."
                testId="stores-inventory-grid"
                pagination={true}
                paginationPageSize={25}
              />
            </div>
          </div>
      ) : viewMode === "location" ? (
      /* Location View - Left Panel + Right Table */
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left Panel - Location Search */}
        <div className="w-60 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col" data-testid="stores-location-search-panel">
          <div className="text-white px-4 py-2 font-semibold bg-[#52baf3]">
            LOCATION SEARCH
          </div>
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search locations..."
                value={locationTabSearch}
                onChange={(e) => setLocationTabSearch(e.target.value)}
                className="pl-10 h-8 text-sm"
                data-testid="input-stores-location-search"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {(() => {
              const locationMap = new Map<string, number>();
              filteredItems.forEach(item => {
                const locA = item.locationAName || '';
                const locB = item.locationBName || '';
                if (locA && (item.robLocationA ?? 0) > 0) {
                  locationMap.set(locA, (locationMap.get(locA) || 0) + 1);
                }
                if (locB && (item.robLocationB ?? 0) > 0) {
                  locationMap.set(locB, (locationMap.get(locB) || 0) + 1);
                }
              });
              const locations = Array.from(locationMap.entries())
                .map(([name, count]) => ({ name, count }))
                .filter(l => {
                  if (!locationTabSearch) return true;
                  return l.name.toLowerCase().includes(locationTabSearch.toLowerCase());
                })
                .sort((a, b) => a.name.localeCompare(b.name));
              if (locations.length === 0) {
                return <div className="p-4 text-center text-gray-500 text-sm">No locations found</div>;
              }
              return locations.map((loc) => (
                <button
                  key={loc.name}
                  onClick={() => setSelectedLocationName(loc.name)}
                  className={`w-full text-left px-4 py-2.5 text-sm border-b border-gray-100 transition-colors ${
                    selectedLocationName === loc.name ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  data-testid={`stores-location-item-${loc.name}`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{loc.name}</div>
                    </div>
                    {loc.count > 0 && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        {loc.count}
                      </span>
                    )}
                  </div>
                </button>
              ));
            })()}
          </div>
        </div>

        {/* Right Panel - Items Table (AG Grid) */}
          <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
            {!selectedLocationName ? (
              <div className="p-8 text-center text-gray-500">Select a location from the left panel to view stores items.</div>
            ) : storesLoading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : (
              <>
                <div className="flex-1 min-h-[400px]">
                  <WOAgGridTable
                    columnDefs={locationColumnDefs}
                    rowData={paginatedLocationItems}
                    getRowClass={locationGetRowClass}
                    noRowsMessage="No items found at this location."
                    testId="stores-by-location-grid"
                  />
                </div>
                {locationItems.length > 0 && (
                  <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between" data-testid="stores-location-pagination-footer">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>Show</span>
                      <Select value={String(locationItemsPerPage)} onValueChange={(val) => { setLocationItemsPerPage(Number(val)); setLocationPage(1); }}>
                        <SelectTrigger className="w-20 h-8" data-testid="select-stores-location-items-per-page">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                      <span>items per page</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600" data-testid="stores-location-pagination-info">
                      <span>
                        Showing {((locationPage - 1) * locationItemsPerPage) + 1} - {Math.min(locationPage * locationItemsPerPage, locationItems.length)} of {locationItems.length} items
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => goToLocationPage(1)} disabled={locationPage === 1} className="h-8 w-8 p-0" data-testid="stores-location-pagination-first">
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => goToLocationPage(locationPage - 1)} disabled={locationPage === 1} className="h-8 w-8 p-0" data-testid="stores-location-pagination-prev">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center gap-1 px-2">
                        <span className="text-sm text-gray-600">Page</span>
                        <Input
                          type="number"
                          min={1}
                          max={locationTotalPages || 1}
                          value={locationPage}
                          onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) goToLocationPage(v); }}
                          className="w-14 h-8 text-center"
                          data-testid="input-stores-location-page-number"
                        />
                        <span className="text-sm text-gray-600">of {locationTotalPages || 1}</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => goToLocationPage(locationPage + 1)} disabled={locationPage >= locationTotalPages} className="h-8 w-8 p-0" data-testid="stores-location-pagination-next">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => goToLocationPage(locationTotalPages)} disabled={locationPage >= locationTotalPages} className="h-8 w-8 p-0" data-testid="stores-location-pagination-last">
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
      </div>
      ) : (
        /* History Table (AG Grid) */
        <div className="bg-white rounded-lg shadow overflow-hidden h-full flex flex-col">
          <div className="flex-1 min-h-[400px]">
            <WOAgGridTable
              columnDefs={historyColumnDefs}
              rowData={filteredHistoryItems}
              noRowsMessage="No history entries found. Actions like Receive, Consume, and Archive will appear here."
              testId="stores-history-grid"
              pagination={true}
              paginationPageSize={25}
            />
          </div>
        </div>
        )}

      {/* Edit Item Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="editItemCode">Item Code</Label>
                <Input
                  id="editItemCode"
                  value={editForm.itemCode}
                  disabled
                  className="bg-gray-100"
                  data-testid="input-edit-item-code"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editImpaCode">IMPA Code</Label>
                <Input
                  id="editImpaCode"
                  value={editForm.impaCode}
                  onChange={(e) => setEditForm({...editForm, impaCode: e.target.value})}
                  placeholder="e.g., 123456"
                  data-testid="input-edit-impa-code"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="editItemName">Item Name <span className="text-red-500">*</span></Label>
              <Input
                id="editItemName"
                value={editForm.itemName}
                onChange={(e) => setEditForm({...editForm, itemName: e.target.value})}
                data-testid="input-edit-item-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="editCategory">Stores Category</Label>
                <Select
                  value={editForm.category}
                  onValueChange={(value) => setEditForm({...editForm, category: value})}
                >
                  <SelectTrigger data-testid="select-edit-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {STORE_CATEGORY_OPTIONS.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editUom">Unit of Measure</Label>
                <Select
                  value={editForm.uom}
                  onValueChange={(value) => setEditForm({...editForm, uom: value})}
                >
                  <SelectTrigger data-testid="select-edit-uom">
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
                    data-testid="input-edit-custom-uom"
                  />
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="editSpecification">Specification</Label>
              <Input
                id="editSpecification"
                value={editForm.specification}
                onChange={(e) => setEditForm({...editForm, specification: e.target.value})}
                placeholder="Technical specs (size, dimensions, material)"
                data-testid="input-edit-specification"
              />
            </div>

            <div className="border-t pt-4">
              <Label className="text-base font-semibold text-gray-700 mb-2 block">Stock Levels</Label>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="editRob">ROB (Total)</Label>
                  <Input
                    id="editRob"
                    type="number"
                    value={editForm.rob}
                    disabled
                    className="bg-gray-100"
                    data-testid="input-edit-rob"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="editMin">Min Stock</Label>
                  <Input
                    id="editMin"
                    type="number"
                    min="0"
                    value={editForm.min}
                    onChange={(e) => setEditForm({...editForm, min: parseFloat(e.target.value) || 0})}
                    data-testid="input-edit-min"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="editMax">Max Stock</Label>
                  <Input
                    id="editMax"
                    type="number"
                    min="0"
                    value={editForm.max}
                    onChange={(e) => setEditForm({...editForm, max: parseFloat(e.target.value) || 0})}
                    data-testid="input-edit-max"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <Label className="text-base font-semibold text-gray-700 mb-2 block">Location Details</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Location A Name</Label>
                  <LocationSearchDropdown
                    vesselId={vesselId}
                    value={editForm.locationA}
                    onChange={(val) => setEditForm({...editForm, locationA: val})}
                    placeholder="Select location..."
                    data-testid="dropdown-edit-location-a"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="editRobLocationA">ROB at Location A</Label>
                  <Input
                    id="editRobLocationA"
                    type="number"
                    value={editForm.robLocationA}
                    disabled
                    className="bg-gray-100"
                    data-testid="input-edit-rob-location-a"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Location B Name</Label>
                  <LocationSearchDropdown
                    vesselId={vesselId}
                    value={editForm.locationB}
                    onChange={(val) => setEditForm({...editForm, locationB: val})}
                    placeholder="Select location..."
                    data-testid="dropdown-edit-location-b"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="editRobLocationB">ROB at Location B</Label>
                  <Input
                    id="editRobLocationB"
                    type="number"
                    value={editForm.robLocationB}
                    disabled
                    className="bg-gray-100"
                    data-testid="input-edit-rob-location-b"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <Label className="text-base font-semibold text-gray-700 mb-2 block">Supplier & Costing</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="editSupplier">Supplier</Label>
                  <Input
                    id="editSupplier"
                    value={editForm.supplier}
                    onChange={(e) => setEditForm({...editForm, supplier: e.target.value})}
                    placeholder="Supplier name"
                    data-testid="input-edit-supplier"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="editUnitCost">Unit Cost</Label>
                  <Input
                    id="editUnitCost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.unitCost}
                    onChange={(e) => setEditForm({...editForm, unitCost: parseFloat(e.target.value) || 0})}
                    data-testid="input-edit-unit-cost"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="editLastOrderDate">Last Order Date</Label>
                  <Input
                    id="editLastOrderDate"
                    type="date"
                    value={editForm.lastOrderDate}
                    onChange={(e) => setEditForm({...editForm, lastOrderDate: e.target.value})}
                    data-testid="input-edit-last-order-date"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="editLeadTime">Lead Time</Label>
                  <Input
                    id="editLeadTime"
                    value={editForm.leadTime}
                    onChange={(e) => setEditForm({...editForm, leadTime: e.target.value})}
                    placeholder="e.g., 2 weeks"
                    data-testid="input-edit-lead-time"
                  />
                </div>
              </div>
            </div>

            {FEATURES.IHM && (
              <div className="border-t pt-4">
                <Label className="text-base font-semibold text-gray-700 mb-2 block">IHM (Inventory of Hazardous Materials)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="editIhmPresence">IHM Presence</Label>
                    <Select
                      value={editForm.ihmPresence || "Unknown"}
                      onValueChange={(value) => setEditForm({...editForm, ihmPresence: value as typeof IHM_PRESENCE[number]})}
                    >
                      <SelectTrigger data-testid="select-edit-ihm-presence">
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
                    <Label htmlFor="editIhmEvidenceType">IHM Evidence Type</Label>
                    <Select
                      value={editForm.ihmEvidenceType || "None"}
                      onValueChange={(value) => setEditForm({...editForm, ihmEvidenceType: value as typeof IHM_EVIDENCE_TYPES[number]})}
                    >
                      <SelectTrigger data-testid="select-edit-ihm-evidence">
                        <SelectValue placeholder="Select evidence type" />
                      </SelectTrigger>
                      <SelectContent>
                        {IHM_EVIDENCE_TYPES.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2 mt-4">
                  <Label htmlFor="editIhmDetails">IHM Details</Label>
                  <Textarea
                    id="editIhmDetails"
                    value={editForm.ihmDetails}
                    onChange={(e) => setEditForm({...editForm, ihmDetails: e.target.value})}
                    placeholder="IHM related information"
                    rows={2}
                    data-testid="textarea-edit-ihm-details"
                  />
                </div>
              </div>
            )}

            {activeTab === "chemicals" && (
              <div className="border-t pt-4">
                <Label className="text-base font-semibold text-gray-700 mb-2 block">Expiry & Date Information</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="editManufactureDate">Manufacture Date</Label>
                    <Input
                      id="editManufactureDate"
                      type="date"
                      value={editForm.manufactureDate}
                      onChange={(e) => handleEditManufactureDateChange(e.target.value)}
                      data-testid="input-edit-manufacture-date"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="editExpiryDate">Expiry Date</Label>
                    <Input
                      id="editExpiryDate"
                      type="date"
                      value={editForm.expiryDate}
                      onChange={(e) => {
                        setEditForm({...editForm, expiryDate: e.target.value});
                        const shelfLife = editForm.shelfLifeMonths || 0;
                        if (e.target.value && editForm.manufactureDate && shelfLife > 0) {
                          const calc = calculateExpiryFromManufacture(editForm.manufactureDate, shelfLife);
                          if (calc && e.target.value !== calc) {
                            setExpiryAutoWarning(`Auto-calculated expiry would be ${calc}. You've entered a different date.`);
                          } else {
                            setExpiryAutoWarning("");
                          }
                        } else {
                          setExpiryAutoWarning("");
                        }
                      }}
                      data-testid="input-edit-expiry-date"
                    />
                    {expiryAutoWarning && (
                      <p className="text-xs text-amber-600 mt-1">{expiryAutoWarning}</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="editBatchNumber">Batch Number</Label>
                    <Input
                      id="editBatchNumber"
                      value={editForm.batchNumber}
                      onChange={(e) => setEditForm({...editForm, batchNumber: e.target.value})}
                      placeholder="e.g., BT-2025-001"
                      data-testid="input-edit-batch-number"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="editLotNumber">Lot Number</Label>
                    <Input
                      id="editLotNumber"
                      value={editForm.lotNumber}
                      onChange={(e) => setEditForm({...editForm, lotNumber: e.target.value})}
                      placeholder="e.g., LOT-001"
                      data-testid="input-edit-lot-number"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="editShelfLife">Shelf Life (months)</Label>
                    <Input
                      id="editShelfLife"
                      type="number"
                      min="0"
                      value={editForm.shelfLifeMonths || ""}
                      onChange={(e) => handleEditShelfLifeChange(parseInt(e.target.value) || 0)}
                      placeholder="e.g., 24"
                      data-testid="input-edit-shelf-life"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "chemicals" && (
              <div className="border-t pt-4">
                <Label className="text-base font-semibold text-gray-700 mb-2 block">Safety Data Sheet (SDS)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="editSdsReference">SDS Reference Number</Label>
                    <Input
                      id="editSdsReference"
                      value={editForm.sdsReference}
                      onChange={(e) => setEditForm({...editForm, sdsReference: e.target.value})}
                      placeholder="e.g., SDS-2025-001"
                      data-testid="input-edit-sds-reference"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="editSdsLastUpdated">SDS Last Updated</Label>
                    <Input
                      id="editSdsLastUpdated"
                      type="date"
                      value={editForm.sdsLastUpdated}
                      onChange={(e) => setEditForm({...editForm, sdsLastUpdated: e.target.value})}
                      data-testid="input-edit-sds-last-updated"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="editHazardClass">Hazard Classification</Label>
                    <Select
                      value={editForm.hazardClassification}
                      onValueChange={(value) => setEditForm({...editForm, hazardClassification: value})}
                    >
                      <SelectTrigger data-testid="select-edit-hazard-class">
                        <SelectValue placeholder="Select hazard class" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="None">None</SelectItem>
                        <SelectItem value="Flammable">Flammable</SelectItem>
                        <SelectItem value="Toxic">Toxic</SelectItem>
                        <SelectItem value="Corrosive">Corrosive</SelectItem>
                        <SelectItem value="Oxidizer">Oxidizer</SelectItem>
                        <SelectItem value="Compressed Gas">Compressed Gas</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="editUnNumber">UN Number</Label>
                    <Input
                      id="editUnNumber"
                      value={editForm.unNumber}
                      onChange={(e) => setEditForm({...editForm, unNumber: e.target.value})}
                      placeholder="e.g., UN1234"
                      data-testid="input-edit-un-number"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="editFlashPoint">Flash Point</Label>
                    <Input
                      id="editFlashPoint"
                      value={editForm.flashPoint}
                      onChange={(e) => setEditForm({...editForm, flashPoint: e.target.value})}
                      placeholder="e.g., 23°C"
                      data-testid="input-edit-flash-point"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "chemicals" && (
              <div className="border-t pt-4">
                <Label className="text-base font-semibold text-gray-700 mb-2 block">Storage & Safety</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="editStorageTempMin">Min Storage Temp (°C)</Label>
                    <Input
                      id="editStorageTempMin"
                      type="number"
                      step="0.1"
                      value={editForm.storageTempMin}
                      onChange={(e) => setEditForm({...editForm, storageTempMin: e.target.value})}
                      placeholder="e.g., 5"
                      data-testid="input-edit-temp-min"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="editStorageTempMax">Max Storage Temp (°C)</Label>
                    <Input
                      id="editStorageTempMax"
                      type="number"
                      step="0.1"
                      value={editForm.storageTempMax}
                      onChange={(e) => setEditForm({...editForm, storageTempMax: e.target.value})}
                      placeholder="e.g., 25"
                      data-testid="input-edit-temp-max"
                    />
                  </div>
                </div>
                <div className="grid gap-2 mt-4">
                  <Label htmlFor="editPpeRequirements">PPE Requirements</Label>
                  <Textarea
                    id="editPpeRequirements"
                    value={editForm.ppeRequirements}
                    onChange={(e) => setEditForm({...editForm, ppeRequirements: e.target.value})}
                    placeholder="e.g., Safety goggles, chemical-resistant gloves, apron"
                    rows={2}
                    data-testid="textarea-edit-ppe"
                  />
                </div>
                <div className="grid gap-2 mt-4">
                  <Label htmlFor="editDisposalInstructions">Disposal Instructions</Label>
                  <Textarea
                    id="editDisposalInstructions"
                    value={editForm.disposalInstructions}
                    onChange={(e) => setEditForm({...editForm, disposalInstructions: e.target.value})}
                    placeholder="Disposal instructions per MARPOL/local regulations"
                    rows={2}
                    data-testid="textarea-edit-disposal"
                  />
                </div>
                <div className="grid gap-2 mt-4">
                  <Label htmlFor="editEmergencyContact">Emergency Contact</Label>
                  <Input
                    id="editEmergencyContact"
                    value={editForm.emergencyContact}
                    onChange={(e) => setEditForm({...editForm, emergencyContact: e.target.value})}
                    placeholder="Emergency contact information"
                    data-testid="input-edit-emergency-contact"
                  />
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <div className="grid gap-2">
                <Label htmlFor="editRemarks">Remarks</Label>
                <Textarea
                  id="editRemarks"
                  value={editForm.remarks}
                  onChange={(e) => setEditForm({...editForm, remarks: e.target.value})}
                  placeholder="Additional notes"
                  rows={2}
                  data-testid="textarea-edit-remarks"
                />
              </div>
            </div>
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
              <Button onClick={saveEditItem} disabled={!canEditStore} data-testid="button-edit-save">Save Changes</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Item Details Modal (Read-Only) - Structured layout matching Spares Details */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600" />
              Item Details
            </DialogTitle>
          </DialogHeader>
          {viewingItem && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div data-testid="text-view-item-code">
                    <span className="text-gray-500">Item Code:</span>
                    <span className="ml-2 font-medium text-gray-900">{viewingItem.itemCode || '-'}</span>
                  </div>
                  <div data-testid="text-view-impa-code">
                    <span className="text-gray-500">IMPA Code:</span>
                    <span className="ml-2 font-medium text-gray-900">{viewingItem.impaCode || '-'}</span>
                  </div>
                  <div className="col-span-2" data-testid="text-view-item-name">
                    <span className="text-gray-500">Item Name:</span>
                    <span className="ml-2 font-medium text-gray-900">{viewingItem.itemName || '-'}</span>
                  </div>
                  <div data-testid="text-view-category">
                    <span className="text-gray-500">Stores Category:</span>
                    <span className="ml-2 font-medium text-gray-900">{viewingItem.storesCategory || '-'}</span>
                  </div>
                  <div data-testid="text-view-uom">
                    <span className="text-gray-500">Unit of Measure:</span>
                    <span className="ml-2 font-medium text-gray-900">{viewingItem.uom || '-'}</span>
                  </div>
                  <div className="col-span-2" data-testid="text-view-specification">
                    <span className="text-gray-500">Specification:</span>
                    <span className="ml-2 font-medium text-gray-900">{viewingItem.specification || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Stock Levels</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div data-testid="text-view-rob">
                    <span className="text-gray-500">ROB (Total):</span>
                    <span className="ml-2 font-medium text-gray-900">{viewingItem.rob ?? 0}</span>
                  </div>
                  <div data-testid="text-view-min">
                    <span className="text-gray-500">Min Stock:</span>
                    <span className="ml-2 font-medium text-gray-900">{viewingItem.min ?? 0}</span>
                  </div>
                  <div data-testid="text-view-max">
                    <span className="text-gray-500">Max Stock:</span>
                    <span className="ml-2 font-medium text-gray-900">{viewingItem.max ?? 0}</span>
                  </div>
                  <div data-testid="text-view-stock-status">
                    <span className="text-gray-500">Stock Status:</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                      (viewingItem.rob ?? 0) >= (viewingItem.min ?? 0)
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {(viewingItem.rob ?? 0) >= (viewingItem.min ?? 0) ? 'OK' : 'Low'}
                    </span>
                  </div>
                  <div data-testid="text-view-is-active">
                    <span className="text-gray-500">Is Active:</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                      viewingItem.isActive !== false
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {viewingItem.isActive !== false ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Location Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div data-testid="text-view-location-a">
                    <span className="text-gray-500">Location A Name:</span>
                    <span className="ml-2 font-medium text-gray-900">{viewingItem.locationAName || '-'}</span>
                  </div>
                  <div data-testid="text-view-rob-location-a">
                    <span className="text-gray-500">ROB at Location A:</span>
                    <span className="ml-2 font-medium text-gray-900">{viewingItem.robLocationA ?? 0}</span>
                  </div>
                  <div data-testid="text-view-location-b">
                    <span className="text-gray-500">Location B Name:</span>
                    <span className="ml-2 font-medium text-gray-900">{viewingItem.locationBName || '-'}</span>
                  </div>
                  <div data-testid="text-view-rob-location-b">
                    <span className="text-gray-500">ROB at Location B:</span>
                    <span className="ml-2 font-medium text-gray-900">{viewingItem.robLocationB ?? 0}</span>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Supplier & Costing</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div data-testid="text-view-supplier">
                    <span className="text-gray-500">Supplier:</span>
                    <span className="ml-2 font-medium text-gray-900">{viewingItem.supplier || '-'}</span>
                  </div>
                  <div data-testid="text-view-unit-cost">
                    <span className="text-gray-500">Unit Cost:</span>
                    <span className="ml-2 font-medium text-gray-900">{viewingItem.unitCost ?? 0}</span>
                  </div>
                  <div data-testid="text-view-last-order-date">
                    <span className="text-gray-500">Last Order Date:</span>
                    <span className="ml-2 font-medium text-gray-900">{viewingItem.lastOrderDate || '-'}</span>
                  </div>
                  <div data-testid="text-view-lead-time">
                    <span className="text-gray-500">Lead Time:</span>
                    <span className="ml-2 font-medium text-gray-900">{viewingItem.leadTime || '-'}</span>
                  </div>
                </div>
              </div>

              {FEATURES.IHM && (
                <div className="bg-purple-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">IHM (Inventory of Hazardous Materials)</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div data-testid="text-view-ihm-presence">
                      <span className="text-gray-500">IHM Presence:</span>
                      <span className="ml-2 font-medium text-gray-900">{viewingItem.ihmPresence || 'Unknown'}</span>
                    </div>
                    <div data-testid="text-view-ihm-evidence">
                      <span className="text-gray-500">IHM Evidence Type:</span>
                      <span className="ml-2 font-medium text-gray-900">{viewingItem.ihmEvidenceType || 'None'}</span>
                    </div>
                    <div className="col-span-2" data-testid="text-view-ihm-details">
                      <span className="text-gray-500">IHM Details:</span>
                      <span className="ml-2 font-medium text-gray-900">{viewingItem.ihmDetails || '-'}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "chemicals" && (
                <div className="bg-orange-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Expiry & Date Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div data-testid="text-view-manufacture-date">
                      <span className="text-gray-500">Manufacture Date:</span>
                      <span className="ml-2 font-medium text-gray-900">{viewingItem.manufactureDate || '-'}</span>
                    </div>
                    <div data-testid="text-view-expiry-date">
                      <span className="text-gray-500">Expiry Date:</span>
                      <span className="ml-2 font-medium text-gray-900">{viewingItem.expiryDate || '-'}</span>
                    </div>
                    <div data-testid="text-view-batch-number">
                      <span className="text-gray-500">Batch Number:</span>
                      <span className="ml-2 font-medium text-gray-900">{viewingItem.batchNumber || '-'}</span>
                    </div>
                    <div data-testid="text-view-lot-number">
                      <span className="text-gray-500">Lot Number:</span>
                      <span className="ml-2 font-medium text-gray-900">{viewingItem.lotNumber || '-'}</span>
                    </div>
                    <div data-testid="text-view-shelf-life">
                      <span className="text-gray-500">Shelf Life (months):</span>
                      <span className="ml-2 font-medium text-gray-900">{viewingItem.shelfLifeMonths || '-'}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "chemicals" && (
                <div className="bg-red-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Safety Data Sheet (SDS)</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div data-testid="text-view-sds-reference">
                      <span className="text-gray-500">SDS Reference Number:</span>
                      <span className="ml-2 font-medium text-gray-900">{viewingItem.sdsReference || '-'}</span>
                    </div>
                    <div data-testid="text-view-sds-last-updated">
                      <span className="text-gray-500">SDS Last Updated:</span>
                      <span className="ml-2 font-medium text-gray-900">{viewingItem.sdsLastUpdated || '-'}</span>
                    </div>
                    <div data-testid="text-view-hazard-class">
                      <span className="text-gray-500">Hazard Classification:</span>
                      <span className="ml-2 font-medium text-gray-900">{viewingItem.hazardClassification || '-'}</span>
                    </div>
                    <div data-testid="text-view-un-number">
                      <span className="text-gray-500">UN Number:</span>
                      <span className="ml-2 font-medium text-gray-900">{viewingItem.unNumber || '-'}</span>
                    </div>
                    <div data-testid="text-view-flash-point">
                      <span className="text-gray-500">Flash Point:</span>
                      <span className="ml-2 font-medium text-gray-900">{viewingItem.flashPoint || '-'}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "chemicals" && (
                <div className="bg-teal-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Storage & Safety</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div data-testid="text-view-temp-min">
                      <span className="text-gray-500">Min Storage Temp (°C):</span>
                      <span className="ml-2 font-medium text-gray-900">{viewingItem.storageTempMin || '-'}</span>
                    </div>
                    <div data-testid="text-view-temp-max">
                      <span className="text-gray-500">Max Storage Temp (°C):</span>
                      <span className="ml-2 font-medium text-gray-900">{viewingItem.storageTempMax || '-'}</span>
                    </div>
                    <div className="col-span-2" data-testid="text-view-ppe">
                      <span className="text-gray-500">PPE Requirements:</span>
                      <span className="ml-2 font-medium text-gray-900">{viewingItem.ppeRequirements || '-'}</span>
                    </div>
                    <div className="col-span-2" data-testid="text-view-disposal">
                      <span className="text-gray-500">Disposal Instructions:</span>
                      <span className="ml-2 font-medium text-gray-900">{viewingItem.disposalInstructions || '-'}</span>
                    </div>
                    <div data-testid="text-view-emergency-contact">
                      <span className="text-gray-500">Emergency Contact:</span>
                      <span className="ml-2 font-medium text-gray-900">{viewingItem.emergencyContact || '-'}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Remarks</h3>
                <div className="text-sm" data-testid="text-view-remarks">
                  <span className="text-gray-500">Remarks:</span>
                  <span className="ml-2 font-medium text-gray-900">{viewingItem.remarks || '-'}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewModalOpen(false)} data-testid="button-view-close">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Store Modal */}
      <Dialog open={isAddStoreModalOpen} onOpenChange={setIsAddStoreModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Store Item</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Required Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="addItemCode">Item Code <span className="text-red-500">*</span></Label>
                <Input
                  id="addItemCode"
                  value={addStoreForm.itemCode}
                  onChange={(e) => setAddStoreForm({...addStoreForm, itemCode: e.target.value})}
                  placeholder="e.g., IT-0001"
                  data-testid="input-add-store-item-code"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="addImpaCode">IMPA Code</Label>
                <Input
                  id="addImpaCode"
                  value={addStoreForm.impaCode}
                  onChange={(e) => setAddStoreForm({...addStoreForm, impaCode: e.target.value})}
                  placeholder="e.g., 123456"
                  data-testid="input-add-store-impa-code"
                />
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="addItemName">Item Name <span className="text-red-500">*</span></Label>
              <Input
                id="addItemName"
                value={addStoreForm.itemName}
                onChange={(e) => setAddStoreForm({...addStoreForm, itemName: e.target.value})}
                placeholder="Enter item name"
                data-testid="input-add-store-item-name"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="addCategory">Stores Category</Label>
                <Select 
                  value={addStoreForm.category} 
                  onValueChange={(value) => setAddStoreForm({...addStoreForm, category: value})}
                >
                  <SelectTrigger data-testid="select-add-store-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {STORE_CATEGORY_OPTIONS.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="addUom">Unit of Measure</Label>
                <Select 
                  value={addStoreForm.uom} 
                  onValueChange={(value) => setAddStoreForm({...addStoreForm, uom: value})}
                >
                  <SelectTrigger data-testid="select-add-store-uom">
                    <SelectValue placeholder="Select UOM" />
                  </SelectTrigger>
                  <SelectContent>
                    {UOM_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {addStoreForm.uom === "Other" && (
                  <Input
                    placeholder="Enter custom UOM"
                    value={addStoreForm.customUom}
                    onChange={(e) => setAddStoreForm({...addStoreForm, customUom: e.target.value})}
                    data-testid="input-add-store-custom-uom"
                  />
                )}
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="addSpecification">Specification</Label>
              <Input
                id="addSpecification"
                value={addStoreForm.specification}
                onChange={(e) => setAddStoreForm({...addStoreForm, specification: e.target.value})}
                placeholder="Technical specs (size, dimensions, material)"
                data-testid="input-add-store-specification"
              />
            </div>
            
            {/* Stock Levels */}
            <div className="border-t pt-4">
              <Label className="text-base font-semibold text-gray-700 mb-2 block">Stock Levels</Label>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="addRob">ROB (Total)</Label>
                  <Input
                    id="addRob"
                    type="number"
                    min="0"
                    value={addStoreForm.rob}
                    onChange={(e) => setAddStoreForm({...addStoreForm, rob: parseFloat(e.target.value) || 0})}
                    data-testid="input-add-store-rob"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="addMin">Min Stock</Label>
                  <Input
                    id="addMin"
                    type="number"
                    min="0"
                    value={addStoreForm.min}
                    onChange={(e) => setAddStoreForm({...addStoreForm, min: parseFloat(e.target.value) || 0})}
                    data-testid="input-add-store-min"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="addMax">Max Stock</Label>
                  <Input
                    id="addMax"
                    type="number"
                    min="0"
                    value={addStoreForm.max}
                    onChange={(e) => setAddStoreForm({...addStoreForm, max: parseFloat(e.target.value) || 0})}
                    data-testid="input-add-store-max"
                  />
                </div>
              </div>
            </div>
            
            {/* Locations */}
            <div className="border-t pt-4">
              <Label className="text-base font-semibold text-gray-700 mb-2 block">Location Details</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Location A Name</Label>
                  <LocationSearchDropdown
                    vesselId={vesselId}
                    value={addStoreForm.locationA}
                    onChange={(val) => setAddStoreForm({...addStoreForm, locationA: val})}
                    placeholder="Select location..."
                    data-testid="dropdown-add-store-location-a"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="addRobLocationA">ROB at Location A</Label>
                  <Input
                    id="addRobLocationA"
                    type="number"
                    min="0"
                    value={addStoreForm.robLocationA}
                    onChange={(e) => setAddStoreForm({...addStoreForm, robLocationA: parseFloat(e.target.value) || 0})}
                    data-testid="input-add-store-rob-location-a"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Location B Name</Label>
                  <LocationSearchDropdown
                    vesselId={vesselId}
                    value={addStoreForm.locationB}
                    onChange={(val) => setAddStoreForm({...addStoreForm, locationB: val})}
                    placeholder="Select location..."
                    data-testid="dropdown-add-store-location-b"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="addRobLocationB">ROB at Location B</Label>
                  <Input
                    id="addRobLocationB"
                    type="number"
                    min="0"
                    value={addStoreForm.robLocationB}
                    onChange={(e) => setAddStoreForm({...addStoreForm, robLocationB: parseFloat(e.target.value) || 0})}
                    data-testid="input-add-store-rob-location-b"
                  />
                </div>
              </div>
            </div>
            
            {/* Supplier & Costing */}
            <div className="border-t pt-4">
              <Label className="text-base font-semibold text-gray-700 mb-2 block">Supplier & Costing</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="addSupplier">Supplier</Label>
                  <Input
                    id="addSupplier"
                    value={addStoreForm.supplier}
                    onChange={(e) => setAddStoreForm({...addStoreForm, supplier: e.target.value})}
                    placeholder="Supplier name"
                    data-testid="input-add-store-supplier"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="addUnitCost">Unit Cost</Label>
                  <Input
                    id="addUnitCost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={addStoreForm.unitCost}
                    onChange={(e) => setAddStoreForm({...addStoreForm, unitCost: parseFloat(e.target.value) || 0})}
                    data-testid="input-add-store-unit-cost"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="addLastOrderDate">Last Order Date</Label>
                  <Input
                    id="addLastOrderDate"
                    type="date"
                    value={addStoreForm.lastOrderDate}
                    onChange={(e) => setAddStoreForm({...addStoreForm, lastOrderDate: e.target.value})}
                    data-testid="input-add-store-last-order-date"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="addLeadTime">Lead Time</Label>
                  <Input
                    id="addLeadTime"
                    value={addStoreForm.leadTime}
                    onChange={(e) => setAddStoreForm({...addStoreForm, leadTime: e.target.value})}
                    placeholder="e.g., 2 weeks"
                    data-testid="input-add-store-lead-time"
                  />
                </div>
              </div>
            </div>
            
            {/* IHM Fields */}
            {FEATURES.IHM && (
              <div className="border-t pt-4">
                <Label className="text-base font-semibold text-gray-700 mb-2 block">IHM (Inventory of Hazardous Materials)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="addIhmPresence">IHM Presence</Label>
                    <Select 
                      value={addStoreForm.ihmPresence} 
                      onValueChange={(value) => setAddStoreForm({...addStoreForm, ihmPresence: value as typeof IHM_PRESENCE[number]})}
                    >
                      <SelectTrigger data-testid="select-add-store-ihm-presence">
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
                    <Label htmlFor="addIhmEvidenceType">IHM Evidence Type</Label>
                    <Select 
                      value={addStoreForm.ihmEvidenceType} 
                      onValueChange={(value) => setAddStoreForm({...addStoreForm, ihmEvidenceType: value as typeof IHM_EVIDENCE_TYPES[number]})}
                    >
                      <SelectTrigger data-testid="select-add-store-ihm-evidence">
                        <SelectValue placeholder="Select evidence type" />
                      </SelectTrigger>
                      <SelectContent>
                        {IHM_EVIDENCE_TYPES.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2 mt-4">
                  <Label htmlFor="addIhmDetails">IHM Details</Label>
                  <Textarea
                    id="addIhmDetails"
                    value={addStoreForm.ihmDetails}
                    onChange={(e) => setAddStoreForm({...addStoreForm, ihmDetails: e.target.value})}
                    placeholder="IHM related information"
                    rows={2}
                    data-testid="textarea-add-store-ihm-details"
                  />
                </div>
              </div>
            )}
            
            {activeTab === "chemicals" && (
              <div className="border-t pt-4">
                <Label className="text-base font-semibold text-gray-700 mb-2 block">Expiry & Date Information</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="addManufactureDate">Manufacture Date</Label>
                    <Input
                      id="addManufactureDate"
                      type="date"
                      value={addStoreForm.manufactureDate}
                      onChange={(e) => handleAddManufactureDateChange(e.target.value)}
                      data-testid="input-add-store-manufacture-date"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="addExpiryDate">Expiry Date</Label>
                    <Input
                      id="addExpiryDate"
                      type="date"
                      value={addStoreForm.expiryDate}
                      onChange={(e) => handleAddExpiryDateManualChange(e.target.value)}
                      data-testid="input-add-store-expiry-date"
                    />
                    {expiryAutoWarning && (
                      <p className="text-xs text-amber-600 mt-1">{expiryAutoWarning}</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="addBatchNumber">Batch Number</Label>
                    <Input
                      id="addBatchNumber"
                      value={addStoreForm.batchNumber}
                      onChange={(e) => setAddStoreForm({...addStoreForm, batchNumber: e.target.value})}
                      placeholder="e.g., BT-2025-001"
                      data-testid="input-add-store-batch-number"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="addLotNumber">Lot Number</Label>
                    <Input
                      id="addLotNumber"
                      value={addStoreForm.lotNumber}
                      onChange={(e) => setAddStoreForm({...addStoreForm, lotNumber: e.target.value})}
                      placeholder="e.g., LOT-001"
                      data-testid="input-add-store-lot-number"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="addShelfLife">Shelf Life (months)</Label>
                    <Input
                      id="addShelfLife"
                      type="number"
                      min="0"
                      value={addStoreForm.shelfLifeMonths || ""}
                      onChange={(e) => handleAddShelfLifeChange(parseInt(e.target.value) || 0)}
                      placeholder="e.g., 24"
                      data-testid="input-add-store-shelf-life"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "chemicals" && (
              <div className="border-t pt-4">
                <Label className="text-base font-semibold text-gray-700 mb-2 block">Safety Data Sheet (SDS)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="addSdsReference">SDS Reference Number</Label>
                    <Input
                      id="addSdsReference"
                      value={addStoreForm.sdsReference}
                      onChange={(e) => setAddStoreForm({...addStoreForm, sdsReference: e.target.value})}
                      placeholder="e.g., SDS-2025-001"
                      data-testid="input-add-store-sds-reference"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="addSdsLastUpdated">SDS Last Updated</Label>
                    <Input
                      id="addSdsLastUpdated"
                      type="date"
                      value={addStoreForm.sdsLastUpdated}
                      onChange={(e) => setAddStoreForm({...addStoreForm, sdsLastUpdated: e.target.value})}
                      data-testid="input-add-store-sds-last-updated"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="addHazardClass">Hazard Classification</Label>
                    <Select
                      value={addStoreForm.hazardClassification}
                      onValueChange={(value) => setAddStoreForm({...addStoreForm, hazardClassification: value})}
                    >
                      <SelectTrigger data-testid="select-add-store-hazard-class">
                        <SelectValue placeholder="Select hazard class" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="None">None</SelectItem>
                        <SelectItem value="Flammable">Flammable</SelectItem>
                        <SelectItem value="Toxic">Toxic</SelectItem>
                        <SelectItem value="Corrosive">Corrosive</SelectItem>
                        <SelectItem value="Oxidizer">Oxidizer</SelectItem>
                        <SelectItem value="Compressed Gas">Compressed Gas</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="addUnNumber">UN Number</Label>
                    <Input
                      id="addUnNumber"
                      value={addStoreForm.unNumber}
                      onChange={(e) => setAddStoreForm({...addStoreForm, unNumber: e.target.value})}
                      placeholder="e.g., UN1234"
                      data-testid="input-add-store-un-number"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="addFlashPoint">Flash Point</Label>
                    <Input
                      id="addFlashPoint"
                      value={addStoreForm.flashPoint}
                      onChange={(e) => setAddStoreForm({...addStoreForm, flashPoint: e.target.value})}
                      placeholder="e.g., 23°C"
                      data-testid="input-add-store-flash-point"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "chemicals" && (
              <div className="border-t pt-4">
                <Label className="text-base font-semibold text-gray-700 mb-2 block">Storage & Safety</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="addStorageTempMin">Min Storage Temp (°C)</Label>
                    <Input
                      id="addStorageTempMin"
                      type="number"
                      step="0.1"
                      value={addStoreForm.storageTempMin}
                      onChange={(e) => setAddStoreForm({...addStoreForm, storageTempMin: e.target.value})}
                      placeholder="e.g., 5"
                      data-testid="input-add-store-temp-min"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="addStorageTempMax">Max Storage Temp (°C)</Label>
                    <Input
                      id="addStorageTempMax"
                      type="number"
                      step="0.1"
                      value={addStoreForm.storageTempMax}
                      onChange={(e) => setAddStoreForm({...addStoreForm, storageTempMax: e.target.value})}
                      placeholder="e.g., 25"
                      data-testid="input-add-store-temp-max"
                    />
                  </div>
                </div>
                <div className="grid gap-2 mt-4">
                  <Label htmlFor="addPpeRequirements">PPE Requirements</Label>
                  <Textarea
                    id="addPpeRequirements"
                    value={addStoreForm.ppeRequirements}
                    onChange={(e) => setAddStoreForm({...addStoreForm, ppeRequirements: e.target.value})}
                    placeholder="e.g., Safety goggles, chemical-resistant gloves, apron"
                    rows={2}
                    data-testid="textarea-add-store-ppe"
                  />
                </div>
                <div className="grid gap-2 mt-4">
                  <Label htmlFor="addDisposalInstructions">Disposal Instructions</Label>
                  <Textarea
                    id="addDisposalInstructions"
                    value={addStoreForm.disposalInstructions}
                    onChange={(e) => setAddStoreForm({...addStoreForm, disposalInstructions: e.target.value})}
                    placeholder="Disposal instructions per MARPOL/local regulations"
                    rows={2}
                    data-testid="textarea-add-store-disposal"
                  />
                </div>
                <div className="grid gap-2 mt-4">
                  <Label htmlFor="addEmergencyContact">Emergency Contact</Label>
                  <Input
                    id="addEmergencyContact"
                    value={addStoreForm.emergencyContact}
                    onChange={(e) => setAddStoreForm({...addStoreForm, emergencyContact: e.target.value})}
                    placeholder="Emergency contact information"
                    data-testid="input-add-store-emergency-contact"
                  />
                </div>
              </div>
            )}

            {/* Remarks */}
            <div className="border-t pt-4">
              <div className="grid gap-2">
                <Label htmlFor="addRemarks">Remarks</Label>
                <Textarea
                  id="addRemarks"
                  value={addStoreForm.remarks}
                  onChange={(e) => setAddStoreForm({...addStoreForm, remarks: e.target.value})}
                  placeholder="Additional notes"
                  rows={2}
                  data-testid="textarea-add-store-remarks"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddStoreModalOpen(false)} data-testid="button-add-store-cancel">
              Cancel
            </Button>
            <Button 
              onClick={saveAddStore} 
              disabled={isAddingStore || !canCreateStore}
              className="bg-[#5dc86f] hover:bg-[#4db85f] text-white"
              data-testid="button-add-store-save"
            >
              {isAddingStore ? "Saving..." : "Save Store Item"}
            </Button>
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
                disabled={!canEditStore || !selectedItem || selectedItem.rob === 0}
                title={!canEditStore ? "No permission to consume" : selectedItem?.rob === 0 ? "No stock available to consume" : "Consume item"}
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
                disabled={!canEditStore}
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
            <Button onClick={saveReceive} disabled={!canEditStore}>Receive</Button>
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
              disabled={!canEditStore || !consumeForm.quantity || parseInt(consumeForm.quantity) > getLocationStock(consumingItem, consumeForm.location)}
            >
              Consume
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inventory Transaction Dialog */}
      <Dialog 
        open={locationDialogItem !== null} 
        onOpenChange={(open) => { 
          if (!open) { 
            setLocationDialogItem(null);
          } 
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="bg-[#52baf3] rounded-md p-1.5">
                <MapPin className="h-4 w-4 text-white" />
              </div>
              <DialogTitle className="text-base">Inventory Transaction</DialogTitle>
            </div>
          </DialogHeader>
          {locationDialogItem && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-md p-3 space-y-1">
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">Item Name:</span>
                  <span className="text-xs font-medium" data-testid="text-dialog-itemname">{locationDialogItem.itemName}</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">Item Code:</span>
                  <span className="text-xs font-medium" data-testid="text-dialog-itemcode">{locationDialogItem.itemCode}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="border border-gray-200 rounded-md p-3">
                  <Label className="text-xs font-semibold text-blue-600 mb-1 block" data-testid="label-dialog-location-a">Location A</Label>
                  <LocationSearchDropdown
                    vesselId={vesselId}
                    value={editingLocations[locationDialogItem.id]?.nameA ?? locationNames.locationA ?? ''}
                    onChange={(name) => setEditingLocations(prev => ({
                      ...prev,
                      [locationDialogItem.id]: { ...prev[locationDialogItem.id], nameA: name }
                    }))}
                    allowClear
                    allowCreate={canEditStore}
                    triggerClassName="mb-2"
                    data-testid="dialog-location-a"
                  />
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-gray-500 whitespace-nowrap">ROB:</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editingLocations[locationDialogItem.id]?.locationA || '0'}
                      onChange={(e) => setEditingLocations(prev => ({
                        ...prev,
                        [locationDialogItem.id]: { ...prev[locationDialogItem.id], locationA: e.target.value }
                      }))}
                      className="h-8 text-sm w-24"
                      placeholder="0"
                      data-testid={`input-dialog-locationA-${locationDialogItem.id}`}
                    />
                  </div>
                </div>

                <div className="border border-gray-200 rounded-md p-3">
                  <Label className="text-xs font-semibold text-blue-600 mb-1 block" data-testid="label-dialog-location-b">Location B</Label>
                  <LocationSearchDropdown
                    vesselId={vesselId}
                    value={editingLocations[locationDialogItem.id]?.nameB ?? locationNames.locationB ?? ''}
                    onChange={(name) => setEditingLocations(prev => ({
                      ...prev,
                      [locationDialogItem.id]: { ...prev[locationDialogItem.id], nameB: name }
                    }))}
                    allowClear
                    allowCreate={canEditStore}
                    triggerClassName="mb-2"
                    data-testid="dialog-location-b"
                  />
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-gray-500 whitespace-nowrap">ROB:</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editingLocations[locationDialogItem.id]?.locationB || '0'}
                      onChange={(e) => setEditingLocations(prev => ({
                        ...prev,
                        [locationDialogItem.id]: { ...prev[locationDialogItem.id], locationB: e.target.value }
                      }))}
                      className="h-8 text-sm w-24"
                      placeholder="0"
                      data-testid={`input-dialog-locationB-${locationDialogItem.id}`}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-md p-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Total ROB</span>
                <span className="text-lg font-bold text-gray-800" data-testid="text-dialog-total-rob">
                  {(parseInt(editingLocations[locationDialogItem.id]?.locationA) || 0) + (parseInt(editingLocations[locationDialogItem.id]?.locationB) || 0)}
                </span>
              </div>

              <DialogFooter className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setLocationDialogItem(null)}
                  data-testid="button-dialog-cancel"
                >
                  Cancel
                </Button>
                <Button
                  className="bg-[#52baf3] text-white"
                  onClick={() => {
                    handleSaveLocation(locationDialogItem.id);
                    setLocationDialogItem(null);
                  }}
                  disabled={!canEditStore}
                  data-testid="button-dialog-save"
                >
                  Save
                </Button>
              </DialogFooter>
            </div>
          )}
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
                        
                        // Get item-specific location names from item data, fall back to vessel-level names
                        const itemLocA = item.locationAName || locationNames.locationA || 'Location A';
                        const itemLocB = item.locationBName || locationNames.locationB || 'Location B';
                        
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
      </div>
      
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