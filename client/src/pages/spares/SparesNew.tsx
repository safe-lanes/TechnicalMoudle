import React, { useState, useMemo, useEffect, useRef } from "react";
import { useModifyMode } from "@/hooks/useModifyMode";
import { useVessel } from "@/contexts/VesselContext";
import { useUIRole } from "@/contexts/UIRoleContext";
import { useChangeMode } from "@/contexts/ChangeModeContext";
import { useLocation } from "wouter";
import { Marker } from "@/components/Marker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronRight, ChevronLeft, ChevronDown, Edit, Edit2, Trash2, Plus, PlusCircle, Square, FileSpreadsheet, X, Minus, AlertCircle, CheckCircle, HelpCircle, MapPin, Info, Download, Settings2, Check, ChevronsUpDown, ChevronsLeft, ChevronsRight, Expand, Minimize2, RotateCcw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import * as XLSX from "xlsx";
import { ModifyStickyFooter } from "@/components/modify/ModifyStickyFooter";
// ComponentNode interface - matches the one used in Components.tsx
interface ComponentNode {
  id: string;
  code: string;
  name: string;
  parentId?: string | null;
  children?: ComponentNode[];
  [key: string]: any;
}
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { FEATURES } from '@/config/features';
import { SPARES_TEMPLATE_FIELDS } from '@shared/sparesTemplateFields';
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
  robLocationA?: number;
  robLocationB?: number;
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
  partNumber?: string;
  eventType: string;
  qtyChange: number;
  robAfter: number;
  userId: string;
  remarks?: string;
  reference?: string;
  dateLocal?: string;
  tz?: string;
  place?: string;
}

const Spares: React.FC = () => {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"inventory" | "by-location" | "history">("inventory");
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [criticalityFilter, setCriticalityFilter] = useState("");
  const [stockFilter, setStockFilter] = useState(() => {
    const savedFilter = sessionStorage.getItem('sparesStockFilter');
    if (savedFilter) {
      sessionStorage.removeItem('sparesStockFilter');
      return savedFilter;
    }
    return "";
  });
  const { vesselId, setVesselId } = useVessel();
  
  // Pagination state - Inventory
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  // Pagination state - History
  const [historyPage, setHistoryPage] = useState(1);
  const [historyItemsPerPage, setHistoryItemsPerPage] = useState(10);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [locationSearchTerm, setLocationSearchTerm] = useState("");
  const [locationPage, setLocationPage] = useState(1);
  const [locationItemsPerPage, setLocationItemsPerPage] = useState(10);
  const { data: vessels = [] } = useVessels();
  
  useEffect(() => {
    setSelectedLocationId(null);
    setLocationSearchTerm("");
    setLocationPage(1);
  }, [vesselId]);
  
  // Modify mode state - use proper hook for reactivity
  const { isModifyMode } = useModifyMode();
  const { isChangeMode } = useChangeMode();
  
  // UI Role context for role-based visibility
  const { isVessel, isHeadOfDept, isSailAdmin, isClientAdmin } = useUIRole();
  const [showModifySubmitFooter, setShowModifySubmitFooter] = useState(false);
  const [originalSpareData, setOriginalSpareData] = useState<Spare | null>(null);
  const [modifiedSpareData, setModifiedSpareData] = useState<Partial<Spare>>({});
  const [isSubmittingChangeRequest, setIsSubmittingChangeRequest] = useState(false);
  
  // Enable modify footer when in modify mode
  useEffect(() => {
    if (isModifyMode) {
      setShowModifySubmitFooter(true);
    }
  }, [isModifyMode]);
  
  // Read componentCode from URL parameters when navigating from component context
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const componentCodeFromUrl = urlParams.get('componentCode');
    
    if (componentCodeFromUrl) {
      // Set the selected component from URL parameter
      setSelectedComponentId(componentCodeFromUrl);
      
      // Auto-expand tree path to show the selected component
      // Expand all parent nodes in the hierarchy
      const parts = componentCodeFromUrl.split('.');
      const nodesToExpand = new Set<string>();
      let currentPath = '';
      for (let i = 0; i < parts.length; i++) {
        currentPath = i === 0 ? parts[i] : `${currentPath}.${parts[i]}`;
        nodesToExpand.add(currentPath);
      }
      setExpandedNodes(nodesToExpand);
    }
  }, []); // Run only on mount
  
  // Dialog states
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [isBulkDeleteMode, setIsBulkDeleteMode] = useState(false);
  const [selectedSpareIds, setSelectedSpareIds] = useState<Set<number>>(new Set());
  const [isAddSpareModalOpen, setIsAddSpareModalOpen] = useState(false);
  const [componentCodePopoverOpen, setComponentCodePopoverOpen] = useState(false);
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editLocAPopoverOpen, setEditLocAPopoverOpen] = useState(false);
  const [editLocBPopoverOpen, setEditLocBPopoverOpen] = useState(false);
  const [addLocAPopoverOpen, setAddLocAPopoverOpen] = useState(false);
  const [addLocBPopoverOpen, setAddLocBPopoverOpen] = useState(false);
  const [editLocSearchA, setEditLocSearchA] = useState('');
  const [editLocSearchB, setEditLocSearchB] = useState('');
  const [addLocSearchA, setAddLocSearchA] = useState('');
  const [addLocSearchB, setAddLocSearchB] = useState('');
  const [addMakerPopoverOpen, setAddMakerPopoverOpen] = useState(false);
  const [editMakerPopoverOpen, setEditMakerPopoverOpen] = useState(false);
  const [addMakerSearch, setAddMakerSearch] = useState('');
  const [editMakerSearch, setEditMakerSearch] = useState('');
  const [invLocAPopoverOpen, setInvLocAPopoverOpen] = useState(false);
  const [invLocBPopoverOpen, setInvLocBPopoverOpen] = useState(false);
  const [invLocSearchA, setInvLocSearchA] = useState('');
  const [invLocSearchB, setInvLocSearchB] = useState('');
  const [isConsumeReceiveModalOpen, setIsConsumeReceiveModalOpen] = useState(false);
  const [isConsumeModalOpen, setIsConsumeModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<"unique" | "distribution">("unique");
  const [selectedSpare, setSelectedSpare] = useState<Spare | null>(null);
  
  // Form states
  const [consumeForm, setConsumeForm] = useState({ qtyA: "", qtyB: "", date: "", workOrder: "", remarks: "" });
  const [receiveForm, setReceiveForm] = useState({ qtyA: "", qtyB: "", date: "", supplier: "", remarks: "" });
  const [adjustForm, setAdjustForm] = useState({ location: "A" as "A" | "B", newRob: "", date: "", place: "", remarks: "" });
  const [bulkUpdateData, setBulkUpdateData] = useState<{[key: number]: {consumedA: number, consumedB: number, receivedA: number, receivedB: number, receivedDate?: string, receivedPlace?: string, comments?: string}}>({});
  const [bulkSearchQuery, setBulkSearchQuery] = useState("");
  const [addSpareForm, setAddSpareForm] = useState({
    partCode: "",
    partName: "",
    partNumber: "",
    uom: "",
    componentId: "",
    critical: "No",
    isActive: true,
    rob: "",
    min: "",
    location: "",
    location2: "",
    maker: "",
    makerCode: "",
    drawingNumber: "",
    positionNumber: "",
    specification: "",
    manualName: "",
    pageNumber: "",
    ihm: "No",
    remarks: "",
    note: ""
  });
  
  // Comprehensive edit spare form (includes all fields from Spare Part Details)
  const [editSpareForm, setEditSpareForm] = useState({
    // Basic Information
    partCode: "",
    partName: "",
    partNumber: "",
    uom: "",
    componentId: "",
    componentCode: "",
    componentName: "",
    // Stock & Location
    rob: "",
    min: "",
    location: "",
    location2: "",
    critical: "No",
    isActive: true,
    // Technical Details
    maker: "",
    makerCode: "",
    drawingNumber: "",
    positionNumber: "",
    specification: "",
    // Manual Reference
    manualName: "",
    pageNumber: "",
    // IHM & Notes
    ihm: "No",
    remarks: "",
    note: ""
  });
  
  const { toast } = useToast();
  const [adjustingSpares, setAdjustingSpares] = useState<Set<number>>(new Set());
  const [pendingAdjustments, setPendingAdjustments] = useState<Map<number, number>>(new Map());
  const [editingLocRob, setEditingLocRob] = useState<{[key: number]: string}>({});
  
  // Location dropdown state
  const [openLocationDropdown, setOpenLocationDropdown] = useState<number | null>(null);
  const [editingLocations, setEditingLocations] = useState<{[key: number]: {locationA: string, locationB: string, nameA?: string, nameB?: string}}>({});
  
  const [originalLocationValues, setOriginalLocationValues] = useState<{[key: number]: {locationA: number, locationB: number, nameA: string, nameB: string}}>({});
  const [locationDialogSpare, setLocationDialogSpare] = useState<Spare | null>(null);
  const [creatingLocationForSpare, setCreatingLocationForSpare] = useState<Spare | null>(null);
  const [newLocationName, setNewLocationName] = useState('');
  const [isCreatingLocation, setIsCreatingLocation] = useState(false);
  const [isChangingLocation, setIsChangingLocation] = useState(false);
  const [pendingLocationChange, setPendingLocationChange] = useState<{
    spare: any;
    newLocationId: number;
    newLocationName: string;
    fromName: string;
    currentQty: number;
    slotToUpdate: 'A' | 'B';
    needsPrePatch: boolean;
  } | null>(null);
  
  const handleOpenLocationDialog = (spare: Spare) => {
    setOpenLocationDropdown(spare.id);
    setLocationDialogSpare(spare);
    const origA = spare.robLocationA ?? 0;
    const origB = spare.robLocationB ?? 0;
    const origNameA = spare.location || 'Location A';
    const origNameB = spare.location2 || 'Location B';
    setOriginalLocationValues(prev => ({
      ...prev,
      [spare.id]: { locationA: origA, locationB: origB, nameA: origNameA, nameB: origNameB }
    }));
    setEditingLocations(prev => ({
      ...prev,
      [spare.id]: {
        locationA: String(origA),
        locationB: String(origB),
        nameA: spare.location || 'Location A',
        nameB: spare.location2 || 'Location B'
      }
    }));
  };
  
  const handleSaveLocation = async (spareId: number) => {
    const locations = editingLocations[spareId];
    const original = originalLocationValues[spareId];
    if (!locations) return;

    // Find the spare to check current names
    const spare = (Array.isArray(sparesData) ? sparesData : []).find((s: Spare) => s.id === spareId);
    if (!spare) return;
    
    const newRobA = parseInt(locations.locationA) || 0;
    const newRobB = parseInt(locations.locationB) || 0;
    const origRobA = original?.locationA ?? 0;
    const origRobB = original?.locationB ?? 0;
    
    const deltaA = newRobA - origRobA;
    const deltaB = newRobB - origRobB;
    
    const errors: string[] = [];
    let successCount = 0;
    let attemptCount = 0;
    
    // Handle ROB changes via PATCH endpoint (creates ADJUSTMENT or TRANSFER events automatically)
    if (deltaA !== 0 || deltaB !== 0) {
      attemptCount++;
      try {
        const res = await fetch(`/technical/api/spares/${vesselId}/${spareId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            robLocationA: newRobA,
            robLocationB: newRobB,
            dateLocal: format(new Date(), 'yyyy-MM-dd'),
            remarks: `ROB adjustment via panel`
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          errors.push(err.error || err.message || 'Failed to update ROB');
        } else {
          successCount++;
        }
      } catch (e: any) {
        errors.push(e.message || 'Network error');
      }
    }
    
    // Save spare-specific location names if they were edited
    // Use spare-specific location names directly, NOT vessel-location-names API
    const origNameA = original?.nameA || spare.location || 'Location A';
    const origNameB = original?.nameB || spare.location2 || 'Location B';
    const nameAChanged = locations.nameA !== origNameA;
    const nameBChanged = locations.nameB !== origNameB;
    
    if (nameAChanged || nameBChanged) {
      attemptCount++;
      try {
        console.log('[Save Location] Updating spare location names:', { spareId, nameA: locations.nameA, nameB: locations.nameB });
        const res = await fetch(`/technical/api/spares/${vesselId}/${spareId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            location: locations.nameA,
            location2: locations.nameB
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error('[Save Location] PATCH failed:', errData);
          errors.push('Failed to save spare location names');
        } else {
          console.log('[Save Location] PATCH successful');
          successCount++;
        }
      } catch (e: any) {
        console.error('[Save Location] PATCH error:', e);
        errors.push(`Spare location names: ${e.message || 'Network error'}`);
      }
    }
    
    // Always invalidate cache to reflect any partial changes
    queryClient.invalidateQueries({ queryKey: ['/technical/api/inventory/spares-with-inventory', vesselId] });
    queryClient.invalidateQueries({ queryKey: ['/technical/api/spares/history', vesselId] });
    
    const hadInventoryChanges = deltaA !== 0 || deltaB !== 0;
    const hadNameChanges = nameAChanged || nameBChanged;
    
    // Use spare-specific location names for toast notifications (not vessel-level defaults)
    const spareLocNameA = spare.location || 'Location A';
    const spareLocNameB = spare.location2 || 'Location B';
    
    if (errors.length === 0 && attemptCount > 0) {
      if (hadInventoryChanges) {
        const actions = [];
        if (deltaA > 0) actions.push(`+${deltaA} to ${spareLocNameA}`);
        if (deltaA < 0) actions.push(`${deltaA} from ${spareLocNameA}`);
        if (deltaB > 0) actions.push(`+${deltaB} to ${spareLocNameB}`);
        if (deltaB < 0) actions.push(`${deltaB} from ${spareLocNameB}`);
        toast({ title: "Inventory Updated", description: actions.join(', ') });
      } else if (hadNameChanges) {
        toast({ title: "Saved", description: "Location names updated" });
      }
    } else if (errors.length === 0 && attemptCount === 0) {
      // No changes detected
      toast({ title: "No Changes", description: "No changes to save" });
    } else if (successCount > 0 && errors.length > 0) {
      // Partial success - some attempts succeeded, some failed
      toast({ title: "Partial Update", description: `Some updates failed: ${errors.join('; ')}`, variant: "default" });
    } else {
      // All attempts failed
      toast({ title: "Error", description: errors.join('; '), variant: "destructive" });
    }
  };

  const [isSavingLocRob, setIsSavingLocRob] = useState(false);

  const handleSaveAllLocRob = async () => {
    if (!selectedLocationId) {
      toast({ title: "Error", description: "No location selected.", variant: "destructive" });
      return;
    }

    const sparesToSave = (locationSpares as any[]).filter((spare: any) => {
      const editedVal = editingLocRob[spare.id];
      if (editedVal === undefined) return false;
      const currentQty = spare.locationQty ?? 0;
      const newValue = parseInt(editedVal);
      return !isNaN(newValue) && newValue >= 0 && newValue !== currentQty;
    });

    if (sparesToSave.length === 0) {
      toast({ title: "No Changes", description: "No changes to save." });
      return;
    }

    for (const spare of locationSpares as any[]) {
      const editedVal = editingLocRob[spare.id];
      if (editedVal === undefined) continue;
      if (editedVal === '' || isNaN(parseInt(editedVal))) {
        toast({ title: "Validation Error", description: `Invalid value for ${spare.partCode}. Please enter a valid number.`, variant: "destructive" });
        return;
      }
      if (parseInt(editedVal) < 0) {
        toast({ title: "Validation Error", description: `Negative value not allowed for ${spare.partCode}.`, variant: "destructive" });
        return;
      }
    }

    setIsSavingLocRob(true);
    let successCount = 0;
    const errors: string[] = [];

    const selectedLocObj = vesselLocations.find((l: any) => l.id === selectedLocationId) || allVesselLocations.find((l: any) => l.id === selectedLocationId);
    const locationName = selectedLocObj?.locationName || selectedLocObj?.name || `Location #${selectedLocationId}`;

    for (const spare of sparesToSave) {
      const newValue = parseInt(editingLocRob[spare.id]);
      const currentQty = spare.locationQty ?? 0;
      const qtyChange = newValue - currentQty;

      const eventType = qtyChange > 0 ? 'RECEIVE' : 'CONSUME';
      const referenceNote = qtyChange > 0
        ? `Received at ${locationName}: ${currentQty}→${newValue}`
        : `Consumed from ${locationName}: ${currentQty}→${newValue}`;

      try {
        const res = await fetch('/technical/api/inventory/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vesselId,
            spareId: spare.id,
            locationId: selectedLocationId,
            eventType,
            qtyChange,
            referenceType: 'MANUAL',
            referenceNote,
            userId: 'System'
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          errors.push(`${spare.partCode}: ${err.error?.message || err.error || 'Failed'}`);
        } else {
          successCount++;
        }
      } catch (e: any) {
        errors.push(`${spare.partCode}: ${e.message || 'Network error'}`);
      }
    }

    setIsSavingLocRob(false);

    if (errors.length === 0) {
      toast({ title: "Success", description: "Location ROB updated successfully." });
      setEditingLocRob({});
    } else if (successCount > 0) {
      toast({ title: "Partial Update", description: `${successCount} saved, ${errors.length} failed: ${errors.join('; ')}` });
    } else {
      toast({ title: "Error", description: errors.join('; '), variant: "destructive" });
    }

    queryClient.invalidateQueries({ queryKey: [`/technical/api/inventory/stock/full-by-location/${vesselId}/${selectedLocationId}`] });
    queryClient.invalidateQueries({ queryKey: ['/technical/api/inventory/spares-with-inventory', vesselId] });
    queryClient.invalidateQueries({ queryKey: ['/technical/api/spares/history', vesselId] });
  };

  const handleChangeSpareLocation = async (spare: any, newLocationId: number, newLocationName: string) => {
    if (!selectedLocationId || !vesselId || isChangingLocation) return;
    const currentQty = spare.locationQty ?? 0;
    if (currentQty <= 0) {
      toast({ title: "No Stock to Move", description: "This spare has no stock at the current location to transfer.", variant: "destructive" });
      return;
    }

    const selectedLoc = vesselLocations.find((l: any) => l.id === selectedLocationId) || allVesselLocations.find((l: any) => l.id === selectedLocationId);
    const fromName = selectedLoc?.locationName || 'Current Location';

    const spareLocA = (spare.location || '').toLowerCase().trim();
    const spareLocB = (spare.location2 || '').toLowerCase().trim();
    const fromNameLower = fromName.toLowerCase().trim();

    let slotToUpdate: 'A' | 'B' = 'A';
    let needsPrePatch = false;
    if (spareLocA && fromNameLower === spareLocA) {
      slotToUpdate = 'A';
    } else if (spareLocB && fromNameLower === spareLocB) {
      slotToUpdate = 'B';
    } else if (spareLocA && !spareLocB) {
      slotToUpdate = 'A';
    } else if (!spareLocA && spareLocB) {
      slotToUpdate = 'B';
    } else if (!spareLocA && !spareLocB) {
      slotToUpdate = 'A';
    } else {
      const robA = spare.robLocationA ?? 0;
      const robB = spare.robLocationB ?? 0;
      slotToUpdate = robA === 0 ? 'A' : robB === 0 ? 'B' : 'A';
      needsPrePatch = true;
    }

    setPendingLocationChange({ spare, newLocationId, newLocationName, fromName, currentQty, slotToUpdate, needsPrePatch });
  };

  const executeLocationChange = async () => {
    if (!pendingLocationChange || !selectedLocationId || !vesselId || isChangingLocation) return;
    const { spare, newLocationId, newLocationName, fromName, currentQty, slotToUpdate, needsPrePatch } = pendingLocationChange;
    setPendingLocationChange(null);
    setIsChangingLocation(true);
    const originalSlotValue = slotToUpdate === 'A' ? (spare.location || '') : (spare.location2 || '');
    try {
      if (needsPrePatch) {
        const prePatchBody: any = {};
        if (slotToUpdate === 'A') { prePatchBody.location = fromName; }
        else { prePatchBody.location2 = fromName; }
        const prePatchRes = await fetch(`/technical/api/spares/${vesselId}/${spare.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(prePatchBody),
        });
        if (!prePatchRes.ok) {
          const err = await prePatchRes.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to align spare location name before transfer');
        }
      }

      const removeRes = await fetch('/technical/api/inventory/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vesselId,
          spareId: spare.id,
          locationId: selectedLocationId,
          eventType: 'ADJUST_CORRECTION',
          qtyChange: -currentQty,
          referenceType: 'MANUAL',
          referenceNote: `Location transfer: moved ${currentQty} units to ${newLocationName}`,
          userId: 'System'
        }),
      });
      if (!removeRes.ok) {
        const err = await removeRes.json().catch(() => ({}));
        if (needsPrePatch) {
          const revertPrePatch: any = {};
          if (slotToUpdate === 'A') { revertPrePatch.location = originalSlotValue; }
          else { revertPrePatch.location2 = originalSlotValue; }
          await fetch(`/technical/api/spares/${vesselId}/${spare.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(revertPrePatch),
          }).catch(() => {});
        }
        throw new Error(err.error?.message || err.error || 'Failed to remove stock from current location');
      }

      const patchBody: any = {};
      if (slotToUpdate === 'A') {
        patchBody.location = newLocationName;
      } else {
        patchBody.location2 = newLocationName;
      }
      const patchRes = await fetch(`/technical/api/spares/${vesselId}/${spare.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      });
      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => ({}));
        try {
          await fetch('/technical/api/inventory/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vesselId, spareId: spare.id, locationId: selectedLocationId,
              eventType: 'ADJUST_CORRECTION', qtyChange: currentQty,
              referenceType: 'MANUAL',
              referenceNote: `Rollback: restored ${currentQty} units after failed location name update`,
              userId: 'System'
            }),
          });
        } catch (rollbackErr) { console.error('Rollback stock restore failed:', rollbackErr); }
        if (needsPrePatch) {
          const revertPrePatch: any = {};
          if (slotToUpdate === 'A') { revertPrePatch.location = originalSlotValue; }
          else { revertPrePatch.location2 = originalSlotValue; }
          await fetch(`/technical/api/spares/${vesselId}/${spare.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(revertPrePatch),
          }).catch(() => {});
        }
        throw new Error(err.error || 'Failed to update spare location name');
      }

      const addRes = await fetch('/technical/api/inventory/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vesselId,
          spareId: spare.id,
          locationId: newLocationId,
          eventType: 'ADJUST_CORRECTION',
          qtyChange: currentQty,
          referenceType: 'MANUAL',
          referenceNote: `Location transfer: received ${currentQty} units from ${fromName}`,
          userId: 'System'
        }),
      });
      if (!addRes.ok) {
        const err = await addRes.json().catch(() => ({}));
        const revertToFrom: any = {};
        if (slotToUpdate === 'A') { revertToFrom.location = fromName; }
        else { revertToFrom.location2 = fromName; }
        await fetch(`/technical/api/spares/${vesselId}/${spare.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(revertToFrom),
        }).catch(() => {});
        try {
          await fetch('/technical/api/inventory/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vesselId, spareId: spare.id, locationId: selectedLocationId,
              eventType: 'ADJUST_CORRECTION', qtyChange: currentQty,
              referenceType: 'MANUAL',
              referenceNote: `Rollback: restored ${currentQty} units after failed transfer to ${newLocationName}`,
              userId: 'System'
            }),
          });
        } catch (rollbackErr) { console.error('Rollback stock restore failed:', rollbackErr); }
        if (needsPrePatch) {
          const revertFinal: any = {};
          if (slotToUpdate === 'A') { revertFinal.location = originalSlotValue; }
          else { revertFinal.location2 = originalSlotValue; }
          await fetch(`/technical/api/spares/${vesselId}/${spare.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(revertFinal),
          }).catch(() => {});
        }
        throw new Error(err.error?.message || err.error || 'Failed to add stock to new location. Stock has been restored.');
      }

      toast({ title: "Location Changed", description: `Moved ${currentQty} units of ${spare.partCode} to ${newLocationName}.` });
      queryClient.invalidateQueries({ queryKey: [`/technical/api/inventory/stock/full-by-location/${vesselId}/${selectedLocationId}`] });
      queryClient.invalidateQueries({ queryKey: [`/technical/api/inventory/stock/full-by-location/${vesselId}/${newLocationId}`] });
      queryClient.invalidateQueries({ queryKey: [`/technical/api/inventory/stock/locations-with-stock/${vesselId}`] });
      queryClient.invalidateQueries({ queryKey: [`/technical/api/inventory/locations/${vesselId}`] });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/inventory/spares-with-inventory', vesselId] });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/spares/history', vesselId] });
      queryClient.invalidateQueries({ queryKey: [`/technical/api/spares/${vesselId}`] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || 'Failed to change location', variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: [`/technical/api/inventory/stock/full-by-location/${vesselId}/${selectedLocationId}`] });
      queryClient.invalidateQueries({ queryKey: [`/technical/api/inventory/stock/locations-with-stock/${vesselId}`] });
      queryClient.invalidateQueries({ queryKey: [`/technical/api/inventory/locations/${vesselId}`] });
      queryClient.invalidateQueries({ queryKey: [`/technical/api/spares/${vesselId}`] });
    } finally {
      setIsChangingLocation(false);
    }
  };

  const handleCreateNewLocation = async () => {
    if (!newLocationName.trim() || !vesselId || !creatingLocationForSpare) return;
    setIsCreatingLocation(true);
    try {
      const res = await fetch(`/technical/api/inventory/locations/${vesselId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationName: newLocationName.trim(), createdBy: 'System' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create location');
      }
      const result = await res.json();
      const newLoc = result.data;
      toast({ title: "Location Created", description: `Location "${newLocationName.trim()}" created successfully.` });
      queryClient.invalidateQueries({ queryKey: [`/technical/api/inventory/stock/locations-with-stock/${vesselId}`] });
      queryClient.invalidateQueries({ queryKey: [`/technical/api/inventory/locations/${vesselId}`] });

      if (creatingLocationForSpare && newLoc?.id) {
        await handleChangeSpareLocation(creatingLocationForSpare, newLoc.id, newLocationName.trim());
      }

      setCreatingLocationForSpare(null);
      setNewLocationName('');
    } catch (e: any) {
      toast({ title: "Error", description: e.message || 'Failed to create location', variant: "destructive" });
    } finally {
      setIsCreatingLocation(false);
    }
  };

  // Quick adjust mutation (for +/- buttons) with optimistic updates
  const adjustMutation = useMutation({
    mutationFn: async ({ spareId, qtyChange, eventType, notes }: { spareId: number, qtyChange: number, eventType: 'CONSUME' | 'RECEIVE', notes?: string }) => {
      const response = await fetch(`/technical/api/spares/${vesselId}/${spareId}/adjust`, {
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
      await queryClient.invalidateQueries({ queryKey: ['/technical/api/inventory/spares-with-inventory', vesselId] });
      await queryClient.invalidateQueries({ queryKey: ['/technical/api/spares/history', vesselId] });
      
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
      const spare = (Array.isArray(sparesData) ? sparesData : []).find((s: Spare) => s.id === spareId);
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
    // Populate comprehensive edit form with all spare fields
    // Use empty strings for missing values to preserve original state for change detection
    setEditSpareForm({
      // Basic Information
      partCode: spare.partCode || "",
      partName: spare.partName || "",
      partNumber: spare.partNumber || "",
      uom: spare.uom || "",
      componentId: spare.componentId || "",
      componentCode: spare.componentCode || "",
      componentName: spare.componentName || "",
      // Stock & Location
      rob: spare.rob?.toString() || "0",
      min: spare.min?.toString() || "0",
      location: spare.location || "",
      location2: spare.location2 || "",
      critical: spare.critical || "",
      isActive: spare.isActive ?? true,
      // Technical Details
      maker: spare.maker || "",
      makerCode: spare.makerCode || "",
      drawingNumber: spare.drawingNumber || "",
      positionNumber: spare.positionNumber || "",
      specification: spare.specification || "",
      // Manual Reference
      manualName: spare.manualName || "",
      pageNumber: spare.pageNumber || "",
      // IHM & Notes
      ihm: spare.ihm || "",
      remarks: spare.remarks || "",
      note: spare.note || ""
    });
    
    // In modify mode, store original data for change tracking
    if (isModifyMode) {
      setOriginalSpareData(spare);
      setModifiedSpareData({});
    }
    
    setIsEditModalOpen(true);
  };
  
  // Track changes in modify mode
  const trackModifyChange = (field: keyof Spare, value: any) => {
    if (isModifyMode && originalSpareData) {
      setModifiedSpareData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };
  
  // Get changed fields for modify mode
  const getSpareChangedFields = (): Array<{field: string, oldValue: any, newValue: any}> => {
    if (!originalSpareData || !selectedSpare) return [];
    
    const changes: Array<{field: string, oldValue: any, newValue: any}> = [];
    const fieldsToCheck: (keyof typeof editSpareForm)[] = [
      'partCode', 'partName', 'partNumber', 'uom', 'componentId',
      'rob', 'min', 'location', 'location2', 'critical', 'isActive',
      'maker', 'makerCode', 'drawingNumber', 'positionNumber', 'specification',
      'manualName', 'pageNumber', 'ihm', 'remarks', 'note'
    ];
    
    for (const field of fieldsToCheck) {
      // Handle isActive specially as it's a boolean
      if (field === 'isActive') {
        const originalValue = originalSpareData.isActive ?? true;
        const newValue = editSpareForm.isActive;
        if (originalValue !== newValue) {
          changes.push({
            field,
            oldValue: originalValue ? 'Yes' : 'No',
            newValue: newValue ? 'Yes' : 'No'
          });
        }
        continue;
      }
      
      // Normalize both values for comparison - treat null/undefined/'' as equivalent
      const originalRaw = originalSpareData[field as keyof Spare];
      const newRaw = editSpareForm[field];
      const originalValue = (originalRaw === null || originalRaw === undefined) ? '' : String(originalRaw);
      const newValue = (newRaw === null || newRaw === undefined) ? '' : String(newRaw);
      
      if (originalValue !== newValue) {
        changes.push({
          field,
          oldValue: originalValue,
          newValue
        });
      }
    }
    
    return changes;
  };
  
  // Handle submit change request for spares
  const handleModifySubmit = async () => {
    if (!selectedSpare || !originalSpareData) {
      toast({
        title: "No spare selected",
        description: "Please select and edit a spare to submit for approval.",
        variant: "destructive"
      });
      return;
    }
    
    const changes = getSpareChangedFields();
    
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
        category: 'spares',
        title: `Spare Change: ${originalSpareData.partCode} - ${originalSpareData.partName}`,
        reason: `Modification request for spare part ${originalSpareData.partCode}`,
        targetType: 'spare',
        targetId: String(originalSpareData.id),
        snapshotBeforeJson: originalSpareData,
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
      setOriginalSpareData(null);
      setModifiedSpareData({});
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
    setOriginalSpareData(null);
    setModifiedSpareData({});
    navigate("/pms/modify-pms");
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

  const handleDeleteSpare = (spare: Spare) => {
    setIsBulkDeleteMode(true);
    setSelectedSpareIds(new Set([spare.id]));
  };

  const toggleSpareSelection = (spareId: number) => {
    setSelectedSpareIds(prev => {
      const next = new Set(prev);
      if (next.has(spareId)) {
        next.delete(spareId);
      } else {
        next.add(spareId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const selectableOnPage = paginatedSpares.filter((s: Spare) => s.isActive !== false);
    const allOnPageSelected = selectableOnPage.length > 0 && selectableOnPage.every((s: Spare) => selectedSpareIds.has(s.id));
    if (allOnPageSelected) {
      const newSet = new Set(selectedSpareIds);
      selectableOnPage.forEach((s: Spare) => newSet.delete(s.id));
      setSelectedSpareIds(newSet);
    } else {
      const newSet = new Set(selectedSpareIds);
      selectableOnPage.forEach((s: Spare) => newSet.add(s.id));
      setSelectedSpareIds(newSet);
    }
  };

  useEffect(() => {
    setIsBulkDeleteMode(false);
    setSelectedSpareIds(new Set());
  }, [vesselId]);

  const exitBulkDeleteMode = () => {
    setIsBulkDeleteMode(false);
    setSelectedSpareIds(new Set());
  };

  const confirmBulkDeactivate = () => {
    if (selectedSpareIds.size > 0) {
      setShowDeactivateDialog(true);
    }
  };

  const executeBulkDeactivate = () => {
    if (selectedSpareIds.size > 0) {
      bulkDeactivateMutation.mutate(Array.from(selectedSpareIds));
    }
  };

  const handleReactivateSpare = (spare: Spare) => {
    reactivateSpareMutation.mutate(spare.id);
  };

  // Fetch spares data with linkedComponents for multi-component matching
  interface MakerListItem {
    id: number;
    makerCode: string;
    makerName: string;
  }

  const { data: makerListData = [] } = useQuery<MakerListItem[]>({
    queryKey: ['/technical/api/fleet/makers'],
  });

  const filteredAddMakers = useMemo(() => {
    if (!addMakerSearch.trim()) return makerListData;
    const q = addMakerSearch.toLowerCase();
    return makerListData.filter(m =>
      m.makerName?.toLowerCase().includes(q) || m.makerCode?.toLowerCase().includes(q)
    );
  }, [addMakerSearch, makerListData]);

  const filteredEditMakers = useMemo(() => {
    if (!editMakerSearch.trim()) return makerListData;
    const q = editMakerSearch.toLowerCase();
    return makerListData.filter(m =>
      m.makerName?.toLowerCase().includes(q) || m.makerCode?.toLowerCase().includes(q)
    );
  }, [editMakerSearch, makerListData]);

  const { data: sparesData = [], isLoading, refetch } = useQuery({
    queryKey: ['/technical/api/inventory/spares-with-inventory', vesselId],
    queryFn: async () => {
      const response = await fetch(`/technical/api/inventory/spares-with-inventory/${vesselId}`);
      if (!response.ok) throw new Error('Failed to fetch spares');
      const json = await response.json();
      // Extract spare data with linkedComponents for filtering
      return (json.data || []).map((item: any) => ({
        ...item.spare,
        linkedComponents: item.linkedComponents || [],
        robTotal: item.robTotal,
        stockStatus: item.stockStatus,
      }));
    }
  });

  // Fetch history data
  const { data: historyData = [] } = useQuery({
    queryKey: ['/technical/api/spares/history', vesselId],
    queryFn: async () => {
      const response = await fetch(`/technical/api/spares/history/${vesselId}`);
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json();
    },
    enabled: activeTab === 'history'
  });

  // Fetch components for tree display
  const { data: fetchedComponents = [] } = useQuery<any[]>({
    queryKey: [`/technical/api/components/${vesselId}`],
  });
  
  // Build component tree from fetched data (same logic as Components.tsx)
  const componentTree = useMemo(() => {
    console.log('[SPARES_TREE] Building tree from', fetchedComponents.length, 'components');
    
    // Create a fresh clone of fetched components to avoid mutating React Query cache
    const clonedComponents = fetchedComponents.map(comp => ({ ...comp }));
    
    // Start with the 8 hardcoded main categories (specification-compliant names)
    const mainCategories: ComponentNode[] = [
      { id: "1", code: "1", name: "Ship General", children: [] },
      { id: "2", code: "2", name: "Hull", children: [] },
      { id: "3", code: "3", name: "Equipment for Cargo", children: [] },
      { id: "4", code: "4", name: "Ship's Equipment", children: [] },
      { id: "5", code: "5", name: "Equipment for Crew & Passengers", children: [] },
      { id: "6", code: "6", name: "Machinery Main Components", children: [] },
      { id: "7", code: "7", name: "Systems for Machinery Main Components", children: [] },
      { id: "8", code: "8", name: "Ship Common Systems", children: [] }
    ];
    
    if (!clonedComponents || clonedComponents.length === 0) {
      return mainCategories;
    }
    
    // Build a map for quick lookup
    const componentMap = new Map<string, ComponentNode>();
    
    // First, add all main categories to the map
    mainCategories.forEach(cat => {
      componentMap.set(cat.code, cat);
    });
    
    // Convert fetched components to ComponentNode format and add to map
    // Skip main categories (1-8) as they're already in the map from hardcoded mainCategories
    clonedComponents.forEach((comp: any) => {
      const code = comp.componentCode || comp.id;
      if (code.match(/^[1-8]$/)) {
        return;
      }
      if (comp.isActive === false) {
        return;
      }
      // Spread comp first, then override id/code to use componentCode (not database id)
      const node: ComponentNode = {
        ...comp,
        actualId: comp.cuuid || comp.id,
        id: code,
        code: code,
        name: comp.name,
        parentId: comp.parentId,
        children: []
      };
      componentMap.set(node.code, node);
    });
    
    // Build parent-child relationships
    clonedComponents.forEach((comp: any) => {
      const code = comp.componentCode || comp.id;
      const node = componentMap.get(code);
      
      if (!node) return;
      
      let placed = false;
      
      if (comp.parentId) {
        // Has explicit parent ID - use it
        // First try parentId as componentCode
        let parent = componentMap.get(comp.parentId);
        
        // If not found, parentId might be a storage ID - search by matching componentCode
        if (!parent) {
          // Search for component whose code matches parentId OR whose original id matches parentId
          const parentComp = clonedComponents.find((c: any) => 
            c.id === comp.parentId || c.componentCode === comp.parentId
          );
          if (parentComp) {
            parent = componentMap.get(parentComp.componentCode || parentComp.id);
          }
        }
        
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(node);
          placed = true;
        }
      }
      
      if (!placed) {
        // No parent ID - determine category from code prefix
        let categoryCode = code.split('.')[0];
        
        // If the code prefix isn't a valid category (1-8), try the first character
        if (!componentMap.get(categoryCode) || !categoryCode.match(/^[1-8]$/)) {
          const firstChar = code.charAt(0);
          if (firstChar.match(/^[1-8]$/)) {
            categoryCode = firstChar;
          } else {
            // Fallback to "8 Ship Common Systems" for codes that don't match any category
            categoryCode = "8";
          }
        }
        
        const category = componentMap.get(categoryCode);
        if (category && categoryCode !== code) {
          // Only add if it's not the category itself
          if (!category.children) {
            category.children = [];
          }
          category.children.push(node);
        }
      }
    });
    
    // Sort children in ascending order by component code
    const sortChildrenAscending = (nodes: ComponentNode[]) => {
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          // Sort children by code in ascending order (handles numeric and alphanumeric codes)
          node.children.sort((a, b) => {
            const aCode = a.code || '';
            const bCode = b.code || '';
            // Try numeric comparison first
            const aNum = parseFloat(aCode);
            const bNum = parseFloat(bCode);
            if (!isNaN(aNum) && !isNaN(bNum)) {
              return aNum - bNum;
            }
            // Fall back to string comparison
            return aCode.localeCompare(bCode);
          });
          // Recursively sort descendants
          sortChildrenAscending(node.children);
        }
      });
    };
    
    sortChildrenAscending(mainCategories);
    
    console.log('[SPARES_TREE] Tree built with categories:', mainCategories.map(c => `${c.code}(${c.children?.length || 0})`).join(', '));
    
    return mainCategories;
  }, [fetchedComponents]);

  const flattenedComponents = useMemo(() => {
    const result: { id: string; code: string; name: string; fleetEquipmentCode?: string; actualId?: string }[] = [];
    const flatten = (nodes: ComponentNode[]) => {
      for (const node of nodes) {
        const hasChildren = node.children && node.children.length > 0;
        if (!hasChildren) {
          result.push({ id: node.id, code: node.code, name: node.name, fleetEquipmentCode: node.fleetEquipmentCode, actualId: node.actualId });
        }
        if (node.children) flatten(node.children);
      }
    };
    flatten(componentTree);
    return result;
  }, [componentTree]);

  // Fetch vessel location names
  const { data: locationNamesData } = useQuery({
    queryKey: [`/technical/api/vessel-location-names/${vesselId}`],
    queryFn: async () => {
      const response = await fetch(`/technical/api/vessel-location-names/${vesselId}`);
      if (!response.ok) return { locationAName: 'Location A', locationBName: 'Location B' };
      return response.json();
    },
    enabled: !!vesselId
  });
  
  const { data: vesselLocationsResponse, isLoading: isLocationsLoading } = useQuery({
    queryKey: [`/technical/api/inventory/stock/locations-with-stock/${vesselId}`],
    enabled: vesselId !== 'all' && vesselId !== '' && activeTab === 'by-location',
  });

  const vesselLocations = useMemo(() => {
    return (vesselLocationsResponse as any)?.data || [];
  }, [vesselLocationsResponse]);

  const { data: allVesselLocationsResponse } = useQuery({
    queryKey: [`/technical/api/inventory/locations/${vesselId}`],
    enabled: vesselId !== 'all' && vesselId !== '',
  });

  const allVesselLocations = useMemo(() => {
    return (allVesselLocationsResponse as any)?.data || [];
  }, [allVesselLocationsResponse]);

  const { data: locationSparesResponse, isLoading: isLocationSparesLoading } = useQuery({
    queryKey: [`/technical/api/inventory/stock/full-by-location/${vesselId}/${selectedLocationId}`],
    enabled: !!selectedLocationId && !!vesselId && vesselId !== 'all' && activeTab === 'by-location',
  });

  const locationSpares: Spare[] = useMemo(() => {
    const raw = (locationSparesResponse as any)?.data || [];
    return raw;
  }, [locationSparesResponse]);

  const filteredLocationSpares = useMemo(() => {
    let result = locationSpares;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((s: any) => 
        s.partCode?.toLowerCase().includes(term) || 
        s.partName?.toLowerCase().includes(term) || 
        s.componentName?.toLowerCase().includes(term)
      );
    }
    if (criticalityFilter && criticalityFilter !== 'All') {
      result = result.filter((s: any) => s.critical === criticalityFilter || s.criticality === criticalityFilter);
    }
    if (stockFilter && stockFilter !== 'All') {
      result = result.filter((s: any) => {
        const status = getStockStatus(s.rob, s.min);
        return status.label === stockFilter;
      });
    }
    return result;
  }, [locationSpares, searchTerm, criticalityFilter, stockFilter]);

  const locationTotalPages = Math.max(1, Math.ceil(filteredLocationSpares.length / locationItemsPerPage));
  const paginatedLocationSpares = filteredLocationSpares.slice(
    (locationPage - 1) * locationItemsPerPage,
    locationPage * locationItemsPerPage
  );

  const goToLocationPage = (page: number) => {
    const p = Math.max(1, Math.min(page, locationTotalPages));
    setLocationPage(p);
  };

  const allLocations = useMemo(() => {
    const locs = Array.isArray(vesselLocations) ? vesselLocations : [];
    if (!locationSearchTerm) return locs;
    const term = locationSearchTerm.toLowerCase();
    return locs.filter((l: any) => l.locationName?.toLowerCase().includes(term));
  }, [vesselLocations, locationSearchTerm]);

  // Get default location labels from vessel settings (only used as column headers, NOT for value binding)
  // For actual ROB location values, always use spare-specific location/location2 fields
  const sparesArray = Array.isArray(sparesData) ? sparesData : [];
  
  // Column header labels - these are generic labels, NOT the actual ROB locations
  const locationColumnLabels = {
    labelA: locationNamesData?.locationAName || 'Location A',
    labelB: locationNamesData?.locationBName || 'Location B'
  };
  
  // Helper function to get spare-specific location names (for ROB value binding)
  // This ensures each spare shows its own location names (e.g., "Bridge", "Main Deck")
  const getSpareLocationName = (spare: Spare, locationSlot: 'A' | 'B'): string => {
    if (locationSlot === 'A') {
      return spare.location || 'Location A';
    } else {
      return spare.location2 || 'Location B';
    }
  };
  
  // Legacy locationNames object for backward compatibility with existing code
  // Note: For accurate ROB display, prefer using getSpareLocationName() with specific spare
  const firstSpareWithLocations = sparesArray.find((s: Spare) => s.location || s.location2);
  const locationNames = {
    locationA: firstSpareWithLocations?.location || 'Location A',
    locationB: firstSpareWithLocations?.location2 || 'Location B'
  };

  // Consume spare mutation (location-aware)
  const consumeSpareMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number, quantity: number, location: 'A' | 'B', workOrderRef?: string, remarks?: string, userId?: string }) => {
      const response = await fetch(`/technical/api/spares/${id}/consume-from-location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || error.error || 'Failed to consume spare');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/inventory/spares-with-inventory', vesselId] });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/spares/history', vesselId] });
      if (data.warning) {
        toast({ title: "Partial Consumption", description: data.warning.message, variant: "default" });
      } else {
        toast({ title: "Success", description: "Spare consumed successfully" });
      }
      setIsConsumeModalOpen(false);
      setConsumeForm({ qtyA: "", qtyB: "", date: "", workOrder: "", remarks: "" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to consume spare",
        variant: "destructive"
      });
    }
  });

  // Receive spare mutation (location-aware)
  const receiveSpareMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number, quantity: number, location: 'A' | 'B', supplierPO?: string, remarks?: string, userId?: string, dateLocal?: string }) => {
      const response = await fetch(`/technical/api/spares/${id}/receive-to-location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || error.error || 'Failed to receive spare');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/inventory/spares-with-inventory', vesselId] });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/spares/history', vesselId] });
      toast({ title: "Success", description: "Spare received successfully" });
      setIsReceiveModalOpen(false);
      setReceiveForm({ qtyA: "", qtyB: "", date: "", supplier: "", remarks: "" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to receive spare",
        variant: "destructive"
      });
    }
  });

  // Adjust spare ROB mutation (for audit-compliant adjustments)
  const adjustSpareMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number, newRob: number, location: 'A' | 'B', remarks?: string, place?: string, dateLocal?: string, tz?: string }) => {
      const response = await apiRequest('POST', `/technical/api/spares/${vesselId}/${id}/adjustment`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/inventory/spares-with-inventory', vesselId] });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/spares/history', vesselId] });
      toast({ title: "Success", description: "Spare ROB adjusted successfully" });
      setIsAdjustModalOpen(false);
      setAdjustForm({ location: "A", newRob: "", date: format(new Date(), 'yyyy-MM-dd'), place: "", remarks: "" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to adjust spare ROB",
        variant: "destructive"
      });
    }
  });

  // Create spare mutation
  const createSpareMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', `/technical/api/spares/${vesselId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/inventory/spares-with-inventory', vesselId] });
      toast({ title: "Success", description: "Spare created successfully" });
      setIsAddSpareModalOpen(false);
      setAddSpareForm({
        partCode: "",
        partName: "",
        partNumber: "",
        uom: "",
        componentId: "",
        critical: "No",
        isActive: true,
        rob: "",
        min: "",
        location: "",
        location2: "",
        maker: "",
        makerCode: "",
        drawingNumber: "",
        positionNumber: "",
        specification: "",
        manualName: "",
        pageNumber: "",
        ihm: "No",
        remarks: "",
        note: ""
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

  // Update spare mutation
  const updateSpareMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!selectedSpare) throw new Error('No spare selected');
      return apiRequest('PATCH', `/technical/api/spares/${vesselId}/${selectedSpare.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/inventory/spares-with-inventory', vesselId] });
      toast({ title: "Success", description: "Spare updated successfully" });
      setIsEditModalOpen(false);
      setSelectedSpare(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update spare",
        variant: "destructive"
      });
    }
  });

  // Handle edit spare submit
  const handleEditSpareSubmit = () => {
    if (!selectedSpare) return;

    if (editSpareForm.maker && !makerListData.some(m => m.makerName.toLowerCase() === editSpareForm.maker.trim().toLowerCase())) {
      toast({ title: "Invalid Maker", description: "Selected maker is not in the Maker List. Please select a valid maker.", variant: "destructive" });
      return;
    }
    
    const updateData = {
      partCode: editSpareForm.partCode,
      partName: editSpareForm.partName,
      partNumber: editSpareForm.partNumber || null,
      uom: editSpareForm.uom || null,
      rob: parseInt(editSpareForm.rob) || 0,
      min: parseInt(editSpareForm.min) || 0,
      location: editSpareForm.location || null,
      location2: editSpareForm.location2 || null,
      critical: editSpareForm.critical,
      isActive: editSpareForm.isActive,
      maker: editSpareForm.maker || null,
      makerCode: editSpareForm.makerCode || null,
      drawingNumber: editSpareForm.drawingNumber || null,
      positionNumber: editSpareForm.positionNumber || null,
      specification: editSpareForm.specification || null,
      manualName: editSpareForm.manualName || null,
      pageNumber: editSpareForm.pageNumber || null,
      ihm: editSpareForm.ihm || null,
      remarks: editSpareForm.remarks || null,
      note: editSpareForm.note || null
    };
    
    updateSpareMutation.mutate(updateData);
  };

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async (data: { vesselId: string, tz: string, rows: Array<{
      componentSpareId: number,
      consumedA: number,
      consumedB: number,
      receivedA: number,
      receivedB: number,
      receivedDate?: string,
      receivedPlace?: string,
      dateLocal?: string,
      remarks?: string,
      userId: string
    }> }) => {
      const response = await fetch('/technical/api/spares/bulk-update', {
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
      queryClient.setQueryData(['/technical/api/spares', vesselId], (old: any) => {
        if (!old) return old;
        return old.map((spare: any) => {
          const result = results.find((r: any) => r.componentSpareId === spare.id && r.success);
          if (result && result.robAfter !== undefined) {
            return { ...spare, rob: result.robAfter };
          }
          return spare;
        });
      });
      
      queryClient.invalidateQueries({ queryKey: ['/technical/api/spares/history', vesselId] });
      
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

  const bulkDeactivateMutation = useMutation({
    mutationFn: async (spareIds: number[]) => {
      const results: { id: number; success: boolean; message?: string }[] = [];
      for (const spareId of spareIds) {
        try {
          const response = await fetch(`/technical/api/spares/${vesselId}/${spareId}/inactivate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!response.ok) {
            const error = await response.json();
            results.push({ id: spareId, success: false, message: error.error });
          } else {
            results.push({ id: spareId, success: true });
          }
        } catch (e: any) {
          results.push({ id: spareId, success: false, message: e.message });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/inventory/spares-with-inventory', vesselId] });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/spares/history', vesselId] });
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      setShowDeactivateDialog(false);
      if (failCount === 0) {
        toast({ title: "Success", description: `${successCount} spare(s) deactivated successfully` });
        exitBulkDeleteMode();
      } else if (successCount > 0) {
        const failedIds = new Set(results.filter(r => !r.success).map(r => r.id));
        setSelectedSpareIds(failedIds);
        toast({ title: "Partial Success", description: `${successCount} deactivated, ${failCount} failed. Failed items remain selected.`, variant: "destructive" });
      } else {
        toast({ title: "Error", description: `All ${failCount} deactivation(s) failed. Please try again.`, variant: "destructive" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to deactivate spares", variant: "destructive" });
    }
  });

  const reactivateSpareMutation = useMutation({
    mutationFn: async (spareId: number) => {
      return apiRequest('PATCH', `/technical/api/spares/${vesselId}/${spareId}`, { isActive: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/inventory/spares-with-inventory', vesselId] });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/spares/history', vesselId] });
      toast({ title: "Success", description: "Spare reactivated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to reactivate spare",
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
  const isComponentMatch = (spare: any, selectedId: string): boolean => {
    // Check primary componentCode (try both camelCase and snake_case)
    const spareCode = spare.componentCode || spare.component_code || spare.componentId || '';
    
    if (spareCode === selectedId) return true;
    if (typeof spareCode === 'string' && spareCode.startsWith(selectedId + '.')) return true;
    
    // Check linkedComponents array for multi-linked spares
    const linkedComponents = spare.linkedComponents || [];
    for (const linked of linkedComponents) {
      // API may return snake_case (component_code) or camelCase (componentCode)
      const linkedCode = linked?.componentCode || linked?.component_code;
      if (!linkedCode || typeof linkedCode !== 'string') continue;
      if (linkedCode === selectedId) return true;
      if (linkedCode.startsWith(selectedId + '.')) return true;
    }
    
    return false;
  };

  // Filter spares based on all criteria
  const filteredSpares = useMemo(() => {
    // Defensive check: ensure sparesData is an array
    if (!sparesData || !Array.isArray(sparesData)) return [];
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

    if (isVessel || isHeadOfDept) {
      filtered = filtered.filter((spare: Spare) => spare.isActive !== false);
    }

    filtered = filtered.sort((a: Spare, b: Spare) => {
      const aInactive = a.isActive === false ? 1 : 0;
      const bInactive = b.isActive === false ? 1 : 0;
      if (aInactive !== bInactive) return aInactive - bInactive;
      return (a.partCode || '').localeCompare(b.partCode || '', undefined, { numeric: true });
    });

    return filtered;
  }, [sparesData, selectedComponentId, searchTerm, criticalityFilter, stockFilter, isVessel, isHeadOfDept]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredSpares.length / itemsPerPage);
  const paginatedSpares = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSpares.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSpares, currentPage, itemsPerPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, criticalityFilter, stockFilter, selectedComponentId]);

  // Clamp currentPage when totalPages shrinks (e.g., after deletion)
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    } else if (totalPages === 0 && filteredSpares.length === 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage, filteredSpares.length]);

  const collectAllNodeIds = (nodes: ComponentNode[]): string[] => {
    const ids: string[] = [];
    const traverse = (nodeList: ComponentNode[]) => {
      for (const node of nodeList) {
        if (node.children && node.children.length > 0) {
          ids.push(node.id);
          traverse(node.children);
        }
      }
    };
    traverse(nodes);
    return ids;
  };

  const expandAllNodes = () => {
    const allIds = collectAllNodeIds(componentTree);
    setExpandedNodes(new Set(allIds));
  };

  const collapseAllNodes = () => {
    setExpandedNodes(new Set());
  };

  // History pagination calculations
  const historyTotalPages = Math.ceil(historyData.length / historyItemsPerPage);
  const paginatedHistory = useMemo(() => {
    const startIndex = (historyPage - 1) * historyItemsPerPage;
    return historyData.slice(startIndex, startIndex + historyItemsPerPage);
  }, [historyData, historyPage, historyItemsPerPage]);

  useEffect(() => {
    setHistoryPage(1);
  }, [vesselId, historyItemsPerPage]);

  useEffect(() => {
    if (historyTotalPages > 0 && historyPage > historyTotalPages) {
      setHistoryPage(historyTotalPages);
    } else if (historyTotalPages === 0 && historyData.length === 0) {
      setHistoryPage(1);
    }
  }, [historyTotalPages, historyPage, historyData.length]);

  const goToInventoryPage = (page: number) => {
    const p = Math.max(1, Math.min(page, totalPages || 1));
    setCurrentPage(p);
  };

  const goToHistoryPage = (page: number) => {
    const p = Math.max(1, Math.min(page, historyTotalPages || 1));
    setHistoryPage(p);
  };

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

  const mapSpareToTemplateRow = (spare: Spare, componentCode?: string, componentName?: string) => {
    const row: Record<string, any> = {};
    for (const field of SPARES_TEMPLATE_FIELDS) {
      if (field.key === 'reserved') {
        row[field.header] = '';
        continue;
      }
      switch (field.key) {
        case 'partCode': row[field.header] = spare.partCode || ''; break;
        case 'fleetEquipmentCode': row[field.header] = (spare as any).fleetEquipmentCode || ''; break;
        case 'fleetEquipmentName': row[field.header] = ''; break;
        case 'componentCode': row[field.header] = componentCode || spare.componentCode || ''; break;
        case 'componentName': row[field.header] = componentName || spare.componentName || ''; break;
        case 'partName': row[field.header] = spare.partName || ''; break;
        case 'partNumber': row[field.header] = spare.partNumber || ''; break;
        case 'uom': row[field.header] = spare.uom || ''; break;
        case 'drawingNumber': row[field.header] = spare.drawingNumber || ''; break;
        case 'positionNumber': row[field.header] = spare.positionNumber || ''; break;
        case 'note': row[field.header] = spare.note || ''; break;
        case 'specification': row[field.header] = spare.specification || ''; break;
        case 'maker': row[field.header] = spare.maker || ''; break;
        case 'makerCode': row[field.header] = spare.makerCode || ''; break;
        case 'manualName': row[field.header] = spare.manualName || ''; break;
        case 'pageNumber': row[field.header] = spare.pageNumber || ''; break;
        case 'criticality': row[field.header] = spare.critical || spare.criticality || ''; break;
        case 'totalRob': row[field.header] = spare.rob ?? 0; break;
        case 'locationA': row[field.header] = spare.location || ''; break;
        case 'locationARob': row[field.header] = spare.robLocationA ?? 0; break;
        case 'locationB': row[field.header] = spare.location2 || ''; break;
        case 'locationBRob': row[field.header] = spare.robLocationB ?? 0; break;
        case 'minimumStock': row[field.header] = spare.min ?? 0; break;
        case 'isActive': row[field.header] = spare.isActive === false ? 'No' : 'Yes'; break;
        case 'ihm': row[field.header] = spare.ihm || ''; break;
        case 'evidenceType': row[field.header] = (spare as any).evidenceType || ''; break;
        default: row[field.header] = ''; break;
      }
    }
    return row;
  };

  const exportSparesToExcel = () => {
    if (activeTab === 'history') {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
      const filename = `spares_history_${vesselId}_${timestamp}.xlsx`;
      
      const data = historyData.map((history: SpareHistory) => {
        let dateDisplay = '-';
        try {
          const isDateOnly = history.dateLocal && /^\d{4}-\d{2}-\d{2}$/.test(history.dateLocal.trim());
          if (history.dateLocal) {
            const dateStr = isDateOnly ? `${history.dateLocal.trim()}T00:00:00` : history.dateLocal;
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              dateDisplay = format(date, 'dd-MMM-yyyy');
            }
          } else if (history.timestampUTC) {
            const date = new Date(history.timestampUTC);
            if (!isNaN(date.getTime())) {
              dateDisplay = format(date, 'dd-MMM-yyyy');
            }
          }
        } catch {
          dateDisplay = '-';
        }
        
        return {
          'Date': dateDisplay,
          'Part Code': history.partCode,
          'Part Name': history.partName,
          'Component': history.componentName,
          'Part Number': history.partNumber || '-',
          'Event': history.eventType,
          'Qty Change': history.qtyChange,
          'ROB After': history.robAfter,
          'Reference': history.reference || '-'
        };
      });
      
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Spares History');
      XLSX.writeFile(wb, filename);
      
      toast({ 
        title: "Export Successful", 
        description: `Exported ${data.length} history records to ${filename}` 
      });
    } else {
      setExportType("unique");
      setIsExportModalOpen(true);
    }
  };

  const handleExportDownload = () => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);

    if (exportType === "unique") {
      const filename = `spares_master_${vesselId}_${timestamp}.xlsx`;
      const seenPartCodes = new Set<string>();
      const rows: Record<string, any>[] = [];

      for (const spare of filteredSpares) {
        if (seenPartCodes.has(spare.partCode)) continue;
        seenPartCodes.add(spare.partCode);
        rows.push(mapSpareToTemplateRow(spare));
      }

      const headers = SPARES_TEMPLATE_FIELDS.map(f => f.header);
      const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
      const colWidths = SPARES_TEMPLATE_FIELDS.map(f => ({ wch: f.width }));
      ws['!cols'] = colWidths;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Unique Spare Master');
      XLSX.writeFile(wb, filename);

      toast({
        title: "Export Successful",
        description: `Exported ${rows.length} unique spare master entries to ${filename}`
      });
    } else {
      const filename = `spares_distribution_${vesselId}_${timestamp}.xlsx`;
      const rows: Record<string, any>[] = [];

      for (const spare of filteredSpares) {
        const linked = (spare as any).linkedComponents as Array<{ componentId: string; componentCode: string; componentName: string }> | undefined;
        if (linked && linked.length > 0) {
          for (const comp of linked) {
            rows.push(mapSpareToTemplateRow(spare, comp.componentCode, comp.componentName));
          }
        } else {
          rows.push(mapSpareToTemplateRow(spare));
        }
      }

      const headers = SPARES_TEMPLATE_FIELDS.map(f => f.header);
      const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
      const colWidths = SPARES_TEMPLATE_FIELDS.map(f => ({ wch: f.width }));
      ws['!cols'] = colWidths;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Component-Spare Distribution');
      XLSX.writeFile(wb, filename);

      toast({
        title: "Export Successful",
        description: `Exported ${rows.length} component-spare distribution entries to ${filename}`
      });
    }

    setIsExportModalOpen(false);
  };

  // Open consume modal
  const openConsumeModal = (spare: Spare) => {
    setSelectedSpare(spare);
    setConsumeForm({ 
      qtyA: "", 
      qtyB: "",
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
      qtyA: "",
      qtyB: "", 
      date: format(new Date(), 'yyyy-MM-dd'), 
      supplier: "", 
      remarks: ""
    });
    setIsReceiveModalOpen(true);
  };

  // Open adjustment modal (for audit-compliant ROB adjustments)
  const openAdjustModal = (spare: Spare) => {
    setSelectedSpare(spare);
    setAdjustForm({
      location: "A",
      newRob: String(spare.robLocationA ?? 0),
      date: format(new Date(), 'yyyy-MM-dd'),
      place: "",
      remarks: ""
    });
    setIsAdjustModalOpen(true);
  };

  // Handle adjustment submit
  const handleAdjustSubmit = async () => {
    if (!selectedSpare || !adjustForm.date) {
      toast({ title: "Error", description: "Please fill in the date", variant: "destructive" });
      return;
    }
    
    const newRob = parseInt(adjustForm.newRob);
    if (isNaN(newRob) || newRob < 0) {
      toast({ title: "Error", description: "Please enter a valid non-negative ROB value", variant: "destructive" });
      return;
    }
    
    const currentRob = adjustForm.location === 'A' 
      ? (selectedSpare.robLocationA ?? 0) 
      : (selectedSpare.robLocationB ?? 0);
    
    if (newRob === currentRob) {
      toast({ title: "No Change", description: "The new ROB is the same as the current value", variant: "default" });
      return;
    }
    
    adjustSpareMutation.mutate({
      id: selectedSpare.id,
      newRob,
      location: adjustForm.location,
      remarks: adjustForm.remarks || undefined,
      place: adjustForm.place || undefined,
      dateLocal: adjustForm.date,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  };

  // Handle consume submit - processes both locations with proper error tracking
  const handleConsumeSubmit = async () => {
    if (!selectedSpare || !consumeForm.date) {
      toast({ title: "Error", description: "Please fill in the date", variant: "destructive" });
      return;
    }
    
    const qtyA = parseInt(consumeForm.qtyA) || 0;
    const qtyB = parseInt(consumeForm.qtyB) || 0;
    
    if (qtyA <= 0 && qtyB <= 0) {
      toast({ title: "Error", description: "Please enter quantity for at least one location", variant: "destructive" });
      return;
    }
    
    // Check stock at each location (use spare-specific location names)
    const selSpareLocA = selectedSpare.location || 'Location A';
    const selSpareLocB = selectedSpare.location2 || 'Location B';
    
    if (qtyA > (selectedSpare.robLocationA ?? 0)) {
      toast({ title: "Error", description: `Insufficient stock at ${selSpareLocA}. Available: ${selectedSpare.robLocationA ?? 0}`, variant: "destructive" });
      return;
    }
    if (qtyB > (selectedSpare.robLocationB ?? 0)) {
      toast({ title: "Error", description: `Insufficient stock at ${selSpareLocB}. Available: ${selectedSpare.robLocationB ?? 0}`, variant: "destructive" });
      return;
    }
    
    const errors: string[] = [];
    const warnings: string[] = [];
    let successCount = 0;
    let attemptCount = 0;
    
    // Consume from Location A if qty > 0
    if (qtyA > 0) {
      attemptCount++;
      try {
        const resA = await fetch(`/technical/api/spares/${selectedSpare.id}/consume-from-location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'A',
            quantity: qtyA,
            dateLocal: consumeForm.date,
            workOrderRef: consumeForm.workOrder || undefined,
            remarks: consumeForm.remarks || undefined,
            userId: 'user'
          }),
        });
        if (!resA.ok) {
          const err = await resA.json();
          errors.push(`${selSpareLocA}: ${err.message || 'Failed'}`);
        } else {
          successCount++;
          const data = await resA.json();
          if (data.warning) {
            warnings.push(data.warning.message || data.warning);
          }
        }
      } catch (e: any) {
        errors.push(`${selSpareLocA}: ${e.message || 'Network error'}`);
      }
    }
    
    // Consume from Location B if qty > 0
    if (qtyB > 0) {
      attemptCount++;
      try {
        const resB = await fetch(`/technical/api/spares/${selectedSpare.id}/consume-from-location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'B',
            quantity: qtyB,
            dateLocal: consumeForm.date,
            workOrderRef: consumeForm.workOrder || undefined,
            remarks: consumeForm.remarks || undefined,
            userId: 'user'
          }),
        });
        if (!resB.ok) {
          const err = await resB.json();
          errors.push(`${selSpareLocB}: ${err.message || 'Failed'}`);
        } else {
          successCount++;
          const data = await resB.json();
          if (data.warning) {
            warnings.push(data.warning.message || data.warning);
          }
        }
      } catch (e: any) {
        errors.push(`${selSpareLocB}: ${e.message || 'Network error'}`);
      }
    }
    
    // Always invalidate cache to reflect any partial changes
    queryClient.invalidateQueries({ queryKey: ['/technical/api/inventory/spares-with-inventory', vesselId] });
    queryClient.invalidateQueries({ queryKey: ['/technical/api/spares/history', vesselId] });
    
    if (errors.length === 0 && attemptCount > 0) {
      if (warnings.length > 0) {
        toast({ title: "Consumed with Warning", description: warnings.join('; '), variant: "default" });
      } else {
        toast({ title: "Success", description: `Consumed ${qtyA + qtyB} units` });
      }
      setIsConsumeModalOpen(false);
      setConsumeForm({ qtyA: "", qtyB: "", date: "", workOrder: "", remarks: "" });
    } else if (successCount > 0 && errors.length > 0) {
      // Partial success - some attempts succeeded, some failed
      toast({ title: "Partial Success", description: `Some operations failed: ${errors.join('; ')}`, variant: "default" });
      setIsConsumeModalOpen(false);
      setConsumeForm({ qtyA: "", qtyB: "", date: "", workOrder: "", remarks: "" });
    } else {
      // All attempts failed - keep modal open for retry
      toast({ title: "Error", description: errors.join('; '), variant: "destructive" });
    }
  };

  // Handle receive submit - processes both locations with proper error tracking
  const handleReceiveSubmit = async () => {
    if (!selectedSpare || !receiveForm.date) {
      toast({ title: "Error", description: "Please fill in the date", variant: "destructive" });
      return;
    }
    
    const qtyA = parseInt(receiveForm.qtyA) || 0;
    const qtyB = parseInt(receiveForm.qtyB) || 0;
    
    if (qtyA <= 0 && qtyB <= 0) {
      toast({ title: "Error", description: "Please enter quantity for at least one location", variant: "destructive" });
      return;
    }
    
    // Use spare-specific location names for error messages
    const recSpareLocA = selectedSpare.location || 'Location A';
    const recSpareLocB = selectedSpare.location2 || 'Location B';
    
    const errors: string[] = [];
    const warnings: string[] = [];
    let successCount = 0;
    let attemptCount = 0;
    
    // Receive to Location A if qty > 0
    if (qtyA > 0) {
      attemptCount++;
      try {
        const resA = await fetch(`/technical/api/spares/${selectedSpare.id}/receive-to-location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'A',
            quantity: qtyA,
            dateLocal: receiveForm.date,
            supplierPO: receiveForm.supplier || undefined,
            remarks: receiveForm.remarks || undefined,
            userId: 'user'
          }),
        });
        if (!resA.ok) {
          const err = await resA.json();
          errors.push(`${recSpareLocA}: ${err.message || 'Failed'}`);
        } else {
          successCount++;
          const data = await resA.json();
          if (data.warning) {
            warnings.push(data.warning.message || data.warning);
          }
        }
      } catch (e: any) {
        errors.push(`${recSpareLocA}: ${e.message || 'Network error'}`);
      }
    }
    
    // Receive to Location B if qty > 0
    if (qtyB > 0) {
      attemptCount++;
      try {
        const resB = await fetch(`/technical/api/spares/${selectedSpare.id}/receive-to-location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'B',
            quantity: qtyB,
            dateLocal: receiveForm.date,
            supplierPO: receiveForm.supplier || undefined,
            remarks: receiveForm.remarks || undefined,
            userId: 'user'
          }),
        });
        if (!resB.ok) {
          const err = await resB.json();
          errors.push(`${recSpareLocB}: ${err.message || 'Failed'}`);
        } else {
          successCount++;
          const data = await resB.json();
          if (data.warning) {
            warnings.push(data.warning.message || data.warning);
          }
        }
      } catch (e: any) {
        errors.push(`${recSpareLocB}: ${e.message || 'Network error'}`);
      }
    }
    
    // Always invalidate cache to reflect any partial changes
    queryClient.invalidateQueries({ queryKey: ['/technical/api/inventory/spares-with-inventory', vesselId] });
    queryClient.invalidateQueries({ queryKey: ['/technical/api/spares/history', vesselId] });
    
    if (errors.length === 0 && attemptCount > 0) {
      if (warnings.length > 0) {
        toast({ title: "Received with Warning", description: warnings.join('; '), variant: "default" });
      } else {
        toast({ title: "Success", description: `Received ${qtyA + qtyB} units` });
      }
      setIsReceiveModalOpen(false);
      setReceiveForm({ qtyA: "", qtyB: "", date: "", supplier: "", remarks: "" });
    } else if (successCount > 0 && errors.length > 0) {
      // Partial success - some attempts succeeded, some failed
      toast({ title: "Partial Success", description: `Some operations failed: ${errors.join('; ')}`, variant: "default" });
      setIsReceiveModalOpen(false);
      setReceiveForm({ qtyA: "", qtyB: "", date: "", supplier: "", remarks: "" });
    } else {
      // All attempts failed - keep modal open for retry
      toast({ title: "Error", description: errors.join('; '), variant: "destructive" });
    }
  };

  // Handle bulk update - navigate to full-screen page
  const openBulkUpdateModal = () => {
    if (filteredSpares.length === 0) {
      toast({ title: "Info", description: "No spares to update. Please adjust filters.", variant: "default" });
      return;
    }
    navigate("/spares/bulk-update");
  };

  // Filter spares for bulk update modal based on search
  const bulkModalFilteredSpares = filteredSpares.filter((spare: Spare) => {
    if (!bulkSearchQuery.trim()) return true;
    const query = bulkSearchQuery.toLowerCase();
    return (
      spare.partCode?.toLowerCase().includes(query) ||
      spare.partName?.toLowerCase().includes(query) ||
      spare.componentCode?.toLowerCase().includes(query) ||
      spare.componentName?.toLowerCase().includes(query) ||
      spare.partNumber?.toLowerCase().includes(query)
    );
  });

  // Handle bulk update input changes
  const handleBulkUpdateChange = (spareId: number, field: 'consumedA' | 'consumedB' | 'receivedA' | 'receivedB' | 'receivedDate' | 'receivedPlace' | 'comments', value: string | number) => {
    if (field === 'consumedA' || field === 'consumedB' || field === 'receivedA' || field === 'receivedB') {
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

    if (addSpareForm.maker && !makerListData.some(m => m.makerName.toLowerCase() === addSpareForm.maker.trim().toLowerCase())) {
      toast({ title: "Invalid Maker", description: "Selected maker is not in the Maker List. Please select a valid maker.", variant: "destructive" });
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
      partNumber: addSpareForm.partNumber || undefined,
      uom: addSpareForm.uom || undefined,
      componentId: component?.actualId || addSpareForm.componentId,
      componentCode: component?.code || undefined,
      componentName: component?.name || "Unknown",
      fleetEquipmentCode: component?.fleetEquipmentCode || undefined,
      critical: addSpareForm.critical,
      isActive: addSpareForm.isActive,
      rob,
      min,
      location: addSpareForm.location || undefined,
      location2: addSpareForm.location2 || undefined,
      maker: addSpareForm.maker || undefined,
      makerCode: addSpareForm.makerCode || undefined,
      drawingNumber: addSpareForm.drawingNumber || undefined,
      positionNumber: addSpareForm.positionNumber || undefined,
      specification: addSpareForm.specification || undefined,
      manualName: addSpareForm.manualName || undefined,
      pageNumber: addSpareForm.pageNumber || undefined,
      ihm: addSpareForm.ihm || undefined,
      remarks: addSpareForm.remarks || undefined,
      note: addSpareForm.note || undefined,
      vesselId
    });
  };

  // Save bulk updates
  const saveBulkUpdates = () => {
    // Validate all rows first
    const sparesArrayLocal = Array.isArray(sparesData) ? sparesData : [];
    const hasErrors = Object.entries(bulkUpdateData).some(([id, data]) => {
      const spare = sparesArrayLocal.find((s: Spare) => s.id === parseInt(id));
      if (!spare) return false;
      
      const totalConsumed = (data.consumedA || 0) + (data.consumedB || 0);
      const totalReceived = (data.receivedA || 0) + (data.receivedB || 0);
      
      // Check per-location stock
      if ((data.consumedA || 0) > (spare.robLocationA ?? 0)) return true;
      if ((data.consumedB || 0) > (spare.robLocationB ?? 0)) return true;
      
      // Check if received date is required when receiving
      if (totalReceived > 0 && !data.receivedDate) return true;
      
      return false;
    });
    
    if (hasErrors) {
      toast({ title: "Validation Error", description: "Please fix validation errors before saving", variant: "destructive" });
      return;
    }
    
    const rows = Object.entries(bulkUpdateData)
      .filter(([_, data]) => (data.consumedA || 0) > 0 || (data.consumedB || 0) > 0 || (data.receivedA || 0) > 0 || (data.receivedB || 0) > 0)
      .map(([id, data]) => ({
        componentSpareId: parseInt(id),
        consumedA: data.consumedA || 0,
        consumedB: data.consumedB || 0,
        receivedA: data.receivedA || 0,
        receivedB: data.receivedB || 0,
        receivedDate: data.receivedDate || undefined,
        receivedPlace: data.receivedPlace || undefined,
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
            onClick={() => {
              selectComponent(node.id);
              if (hasChildren) {
                toggleNode(node.id);
              }
            }}
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
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header - Fixed */}
      <div className="flex-shrink-0 space-y-6 mb-4">
        <div className="flex items-center justify-between relative">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-800" data-testid={activeTab === 'inventory' ? "E1" : activeTab === 'by-location' ? "E-LOC-1" : "E3.1"}>
            {activeTab === 'inventory' ? <Marker id="E1" /> : activeTab === 'by-location' ? <Marker id="E-LOC-1" /> : <Marker id="E3.1" />}
            {activeTab === 'inventory' ? 'Spares Inventory' : activeTab === 'by-location' ? 'Spares By Location' : 'Spares - History of Transactions'}
          </h1>
          {isModifyMode && (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full border border-blue-300">
              Modify Mode
            </span>
          )}
        </div>
        
        {/* Navigation Tabs - Center aligned */}
        <div className="absolute left-1/2 -translate-x-1/2 bg-gray-100 rounded-md p-1 flex items-center gap-1">
          <button 
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'inventory' ? 'bg-[#52baf3] text-white' : 'text-gray-700 hover:bg-gray-200'}`}
            onClick={() => setActiveTab('inventory')}
            data-testid="E2"
          >
            <Marker id="E2" />
            Inventory
          </button>
          <button 
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'by-location' ? 'bg-[#52baf3] text-white' : 'text-gray-700 hover:bg-gray-200'}`}
            onClick={() => setActiveTab('by-location')}
            data-testid="tab-by-location"
          >
            Location
          </button>
          <button 
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-[#52baf3] text-white' : 'text-gray-700 hover:bg-gray-200'}`}
            onClick={() => setActiveTab('history')}
            data-testid={activeTab === 'history' ? "E3.3" : "E3"}
          >
            {activeTab === 'history' ? <Marker id="E3.3" /> : <Marker id="E3" />}
            History
          </button>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2 items-center">
          <Button 
            variant="outline" 
            size="sm"
            className="text-xs text-[#8798ad] border-[#e1e8ed]"
            onClick={exportSparesToExcel}
            data-testid="E9"
          >
            <Marker id="E9" />
            <Download className="h-3.5 w-3.5 mr-1" />
            Export
          </Button>
          {isBulkDeleteMode ? (
            <>
              <Button
                size="sm"
                variant="destructive"
                onClick={confirmBulkDeactivate}
                disabled={selectedSpareIds.size === 0 || bulkDeactivateMutation.isPending}
                data-testid="button-bulk-delete-confirm"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete{selectedSpareIds.size > 0 ? ` (${selectedSpareIds.size})` : ''}
              </Button>
              <Button size="sm" variant="outline" onClick={exitBulkDeleteMode} data-testid="button-bulk-delete-cancel">
                Cancel
              </Button>
            </>
          ) : (
            <>
              {(isSailAdmin || isClientAdmin || isChangeMode) && (
                <Button size="sm" className="bg-[#5dc86f] hover:bg-[#4db85f] text-white" onClick={() => setIsAddSpareModalOpen(true)} data-testid="E10">
                  <Marker id="E10" />
                  + Add Spare
                </Button>
              )}
              <Button size="sm" className="bg-[#5dc86f] hover:bg-[#4db85f] text-white" onClick={openBulkUpdateModal} data-testid="E11">
                <Marker id="E11" />
                Bulk Update Spares
              </Button>
            </>
          )}
        </div>
      </div>
      {/* Search and Filters */}
      <div className="flex gap-3 items-center mb-4">
        {/* Vessel selector - visible for Sail Admin, Client Admin, or in change mode */}
        {(isSailAdmin || isClientAdmin || isChangeMode) && (
          <div className="relative" data-testid="E4">
            <Marker id="E4" />
            <Select value={vesselId === 'all' ? '' : vesselId} onValueChange={setVesselId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Choose vessel" />
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
        )}

        <div className="relative w-80" data-testid="E5">
          <Marker id="E5" />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search parts or components..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="relative" data-testid="E6">
          <Marker id="E6" />
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
        </div>

        <div className="relative" data-testid="E7">
          <Marker id="E7" />
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
        </div>

        <Button 
          variant="outline"
          onClick={clearFilters}
          className="text-gray-600"
          data-testid="E8"
        >
          <Marker id="E8" />
          Clear
        </Button>
        {activeTab === 'by-location' && (
          <Button
            onClick={handleSaveAllLocRob}
            disabled={isSavingLocRob || Object.keys(editingLocRob).length === 0}
            className="bg-[#52baf3] hover:bg-[#3da8e0] text-white"
            data-testid="button-save-all-loc-rob"
          >
            {isSavingLocRob ? 'Saving...' : 'Save'}
          </Button>
        )}
      </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto flex gap-4 min-h-0">
        {/* Left Panel - Component Tree (only shown in inventory tab) */}
        {activeTab === 'inventory' && (
          <div className="w-80 bg-white border border-gray-200 rounded-lg flex flex-col" data-testid="E12">
            <div className="flex-shrink-0 text-white px-4 py-2 font-semibold bg-[#52baf3] flex items-center justify-between rounded-t-lg">
              <div className="flex items-center gap-2">
                <Marker id="E12" />
                COMPONENT SEARCH
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={expandAllNodes}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs rounded hover:bg-white/20 transition-colors"
                  data-testid="button-expand-all-spares"
                >
                  <Expand className="h-3 w-3" />
                  Expand
                </button>
                <button
                  onClick={collapseAllNodes}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs rounded hover:bg-white/20 transition-colors"
                  data-testid="button-collapse-all-spares"
                >
                  <Minimize2 className="h-3 w-3" />
                  Collapse
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {renderComponentTree(componentTree)}
            </div>
          </div>
        )}
        {activeTab === 'by-location' && (
          <div className="w-80 bg-white border border-gray-200 rounded-lg overflow-hidden" data-testid="location-search-panel">
            <div className="text-white px-4 py-2 font-semibold bg-[#52baf3]">
              LOCATION SEARCH
            </div>
            <div className="p-2 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search locations..."
                  value={locationSearchTerm}
                  onChange={(e) => setLocationSearchTerm(e.target.value)}
                  className="pl-10 h-8 text-sm"
                  data-testid="input-location-search"
                />
              </div>
            </div>
            <div className="overflow-y-auto h-[calc(100%-80px)]">
              {isLocationsLoading ? (
                <div className="p-4 text-center text-gray-500 text-sm">Loading locations...</div>
              ) : allLocations.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  {vesselId === 'all' || !vesselId ? 'Select a vessel first' : 'No locations found'}
                </div>
              ) : (
                allLocations.map((loc: any) => {
                  const locId = loc.id;
                  const locName = loc.locationName || 'Unknown';
                  return (
                    <button
                      key={locId}
                      onClick={() => { setSelectedLocationId(locId); setLocationPage(1); }}
                      className={`w-full text-left px-4 py-2.5 text-sm border-b border-gray-100 transition-colors ${
                        selectedLocationId === locId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      data-testid={`location-item-${locId}`}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{locName}</div>
                        </div>
                        {loc.sparesCount > 0 && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            {loc.sparesCount}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Right Panel - Table */}
        <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
          {activeTab === 'inventory' && (
            <>
              {/* Inventory Table with Horizontal Scroll */}
              <div className="overflow-x-auto flex-1 flex flex-col">
                {/* Inventory Table Header */}
                <div className="px-4 py-3 border-b border-gray-200 bg-[#52baf3] min-w-max">
                  <div className="grid text-sm font-semibold text-[#ffffff] min-w-max" style={{ gridTemplateColumns: isBulkDeleteMode ? (FEATURES.IHM ? '40px 110px 180px 220px 120px 80px 60px 60px 80px 100px 40px' : '40px 110px 180px 220px 120px 80px 60px 60px 80px 100px') : (FEATURES.IHM ? '110px 180px 220px 120px 80px 60px 60px 80px 100px 40px 130px' : '110px 180px 220px 120px 80px 60px 60px 80px 100px 130px'), minWidth: 'max-content', gap: '12px' }}>
                  {isBulkDeleteMode && (
                    <div className="px-2 flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={(() => { const selectableOnPage = paginatedSpares.filter((s: Spare) => s.isActive !== false); return selectableOnPage.length > 0 && selectableOnPage.every((s: Spare) => selectedSpareIds.has(s.id)); })()}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-white accent-white cursor-pointer"
                        data-testid="checkbox-select-all"
                      />
                    </div>
                  )}
                  <div className="px-2 text-[#ffffff]" data-testid="E13"><Marker id="E13" />Part Code</div>
                  <div className="px-2" data-testid="E14"><Marker id="E14" />Part Name</div>
                  <div className="px-2" data-testid="E15"><Marker id="E15" />Component</div>
                  <div className="px-2" data-testid="E16"><Marker id="E16" />Part Number</div>
                  <div className="px-2" data-testid="E17"><Marker id="E17" />Criticality</div>
                  <div className="px-2 text-center" data-testid="E18"><Marker id="E18" />ROB</div>
                  <div className="px-2 text-center" data-testid="E19"><Marker id="E19" />Min</div>
                  <div className="px-2 text-center" data-testid="E20"><Marker id="E20" />Stock</div>
                  <div className="px-2" data-testid="E21"><Marker id="E21" />Location</div>
                  {FEATURES.IHM && <div className="px-2 text-center" data-testid="E22"><Marker id="E22" />IHM</div>}
                  {!isBulkDeleteMode && <div className="px-2 text-center" data-testid="E23"><Marker id="E23" />Actions</div>}
                </div>
              </div>

              {/* Inventory Table Body */}
              <div className="flex flex-col">
                {isLoading ? (
                  <div className="p-8 text-center text-gray-500">Loading...</div>
                ) : filteredSpares.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No spares found. Try adjusting your filters.
                  </div>
                ) : (
                  paginatedSpares.map((spare: Spare, rowIndex: number) => {
                    const stockStatus = getStockStatus(spare.rob, spare.min);
                    const robA = spare.robLocationA ?? 0;
                    const robB = spare.robLocationB ?? 0;
                    const locationDisplay = `${robA} / ${robB}`;
                    const isFirstRow = rowIndex === 0;
                    const isInactive = spare.isActive === false;
                    return (
                    <div key={spare.id} className={`px-4 py-3 border-b border-gray-100 ${isInactive ? 'opacity-50 bg-gray-50' : 'hover:bg-gray-50'} ${isBulkDeleteMode && selectedSpareIds.has(spare.id) ? 'bg-red-50' : ''}`}>
                      <div className="grid text-sm items-center min-w-max" style={{ gridTemplateColumns: isBulkDeleteMode ? (FEATURES.IHM ? '40px 110px 180px 220px 120px 80px 60px 60px 80px 100px 40px' : '40px 110px 180px 220px 120px 80px 60px 60px 80px 100px') : (FEATURES.IHM ? '110px 180px 220px 120px 80px 60px 60px 80px 100px 40px 130px' : '110px 180px 220px 120px 80px 60px 60px 80px 100px 130px'), minWidth: 'max-content', gap: '12px' }}>
                        {isBulkDeleteMode && (
                          <div className="px-2 flex items-center justify-center">
                            {!isInactive ? (
                              <input
                                type="checkbox"
                                checked={selectedSpareIds.has(spare.id)}
                                onChange={() => toggleSpareSelection(spare.id)}
                                className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                                data-testid={`checkbox-spare-${spare.id}`}
                              />
                            ) : (
                              <span className="h-4 w-4" />
                            )}
                          </div>
                        )}
                        <div className={`px-2 ${isInactive ? 'text-gray-400' : 'text-gray-900'}`} data-testid={isFirstRow ? "E24" : undefined}>{isFirstRow && <Marker id="E24" />}{spare.partCode}{isInactive && <span className="ml-1 text-xs text-gray-400">(Inactive)</span>}</div>
                        <div className="px-2 text-gray-700" data-testid={isFirstRow ? "E25" : undefined}>{isFirstRow && <Marker id="E25" />}{spare.partName}</div>
                        <div className="px-2 text-gray-700" data-testid={isFirstRow ? "E26" : undefined}>{isFirstRow && <Marker id="E26" />}{spare.componentName}</div>
                        <div className="px-2 text-blue-600 font-medium" data-testid={isFirstRow ? "E27" : undefined}>{isFirstRow && <Marker id="E27" />}{spare.partNumber || '-'}</div>
                        <div className="px-2" data-testid={isFirstRow ? "E28" : undefined}>
                          {isFirstRow && <Marker id="E28" />}
                          <span className={`px-2 py-1 rounded text-xs ${
                            spare.critical === 'Critical' || spare.critical === 'Yes' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {spare.critical}
                          </span>
                        </div>
                        <div className="px-2 text-center" data-testid={isFirstRow ? "E29" : undefined}>{isFirstRow && <Marker id="E29" />}{spare.rob}</div>
                        <div className="px-2 text-center" data-testid={isFirstRow ? "E30" : undefined}>{isFirstRow && <Marker id="E30" />}{spare.min}</div>
                        <div className="px-2 text-center" data-testid={isFirstRow ? "E31" : undefined}>
                          {isFirstRow && <Marker id="E31" />}
                          <span className={`px-2 py-1 rounded text-xs ${stockStatus.color}`}>
                            {stockStatus.label}
                          </span>
                        </div>
                        {/* Location Dropdown */}
                        <div className="px-2 relative" data-testid={isFirstRow ? "E32" : undefined}>
                          {isFirstRow && <Marker id="E32" />}
                          <button
                            onClick={() => handleOpenLocationDialog(spare)}
                            className="flex items-center gap-1 text-gray-700 hover:text-blue-600 cursor-pointer w-full text-left"
                            data-testid={`button-location-${spare.id}`}
                          >
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate text-sm">{locationDisplay}</span>
                            <ChevronDown className="h-3 w-3 flex-shrink-0" />
                          </button>
                          
                        </div>
                        {FEATURES.IHM && (
                          <div className="px-2 flex justify-center" data-testid={isFirstRow ? "E33" : undefined}>
                            {isFirstRow && <Marker id="E33" />}
                            {/* IHM status from spare.ihm field: Yes=Red (hazardous), No=Green (compliant), Empty=Gray (unknown) */}
                            {spare.ihm?.toLowerCase() === 'yes' ? (
                              <span title="IHM Present - Hazardous Materials"><AlertCircle className="h-4 w-4 text-red-500" /></span>
                            ) : spare.ihm?.toLowerCase() === 'no' ? (
                              <span title="No IHM - Compliant"><CheckCircle className="h-4 w-4 text-green-500" /></span>
                            ) : (
                              <span title="IHM Status Unknown"><HelpCircle className="h-4 w-4 text-gray-400" /></span>
                            )}
                          </div>
                        )}
                        {!isBulkDeleteMode && (
                        <div className="px-2 flex gap-0.5 justify-center">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => openInfoModal(spare)}
                            title="View Details"
                            data-testid={isFirstRow ? "E34" : `button-info-${spare.id}`}
                          >
                            {isFirstRow && <Marker id="E34" />}
                            <Info className="h-4 w-4 text-blue-600" />
                          </Button>
                          {(isSailAdmin || isClientAdmin || isHeadOfDept || isChangeMode) && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => openEditModal(spare)}
                              title="Edit"
                              data-testid={isFirstRow ? "E35" : `button-edit-${spare.id}`}
                            >
                              {isFirstRow && <Marker id="E35" />}
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => openAdjustModal(spare)}
                            title="Adjust ROB"
                            data-testid={`button-adjust-${spare.id}`}
                          >
                            <Settings2 className="h-4 w-4 text-orange-500" />
                          </Button>
                          {(isSailAdmin || isClientAdmin || isChangeMode) && !isInactive && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleDeleteSpare(spare)}
                              title="Deactivate"
                              data-testid={isFirstRow ? "E36" : `button-delete-${spare.id}`}
                            >
                              {isFirstRow && <Marker id="E36" />}
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                          {(isSailAdmin || isClientAdmin) && isInactive && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleReactivateSpare(spare)}
                              title="Reactivate"
                              disabled={reactivateSpareMutation.isPending}
                              data-testid={`button-reactivate-${spare.id}`}
                            >
                              <RotateCcw className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                        </div>
                        )}
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
              
              {/* Pagination Footer */}
              {filteredSpares.length > 0 && (
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between" data-testid="inventory-pagination-footer">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>Show</span>
                    <Select value={String(itemsPerPage)} onValueChange={(val) => { setItemsPerPage(Number(val)); setCurrentPage(1); }}>
                      <SelectTrigger className="w-20 h-8" data-testid="select-inventory-items-per-page">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span>items per page</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600" data-testid="inventory-pagination-info">
                    <span>
                      Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredSpares.length)} of {filteredSpares.length} spares
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => goToInventoryPage(1)} disabled={currentPage === 1} className="h-8 w-8 p-0" data-testid="pagination-first">
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => goToInventoryPage(currentPage - 1)} disabled={currentPage === 1} className="h-8 w-8 p-0" data-testid="pagination-prev">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1 px-2">
                      <span className="text-sm text-gray-600">Page</span>
                      <Input
                        type="number"
                        min={1}
                        max={totalPages || 1}
                        value={currentPage}
                        onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) goToInventoryPage(v); }}
                        className="w-14 h-8 text-center"
                        data-testid="input-inventory-page-number"
                      />
                      <span className="text-sm text-gray-600">of {totalPages || 1}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => goToInventoryPage(currentPage + 1)} disabled={currentPage >= totalPages} className="h-8 w-8 p-0" data-testid="pagination-next">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => goToInventoryPage(totalPages)} disabled={currentPage >= totalPages} className="h-8 w-8 p-0" data-testid="pagination-last">
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              </div>
            </>
          )}
          {activeTab === 'by-location' && (
            <>
              <div className="overflow-x-auto flex-1 flex flex-col">
                <div className="px-4 py-3 border-b border-gray-200 bg-[#52baf3] min-w-max">
                  <div className="grid text-sm font-semibold text-[#ffffff] min-w-max" style={{ gridTemplateColumns: FEATURES.IHM ? '110px 180px 220px 120px 80px 60px 60px 80px 160px 100px 40px' : '110px 180px 220px 120px 80px 60px 60px 80px 160px 100px', minWidth: 'max-content', gap: '12px' }}>
                    <div className="px-2 text-[#ffffff]" data-testid="loc-col-part-code">Part Code</div>
                    <div className="px-2" data-testid="loc-col-part-name">Part Name</div>
                    <div className="px-2" data-testid="loc-col-component">Component</div>
                    <div className="px-2" data-testid="loc-col-part-number">Part Number</div>
                    <div className="px-2" data-testid="loc-col-criticality">Criticality</div>
                    <div className="px-2 text-center" data-testid="loc-col-rob">ROB</div>
                    <div className="px-2 text-center" data-testid="loc-col-min">Min</div>
                    <div className="px-2 text-center" data-testid="loc-col-stock">Stock</div>
                    <div className="px-2" data-testid="loc-col-location">Location</div>
                    <div className="px-2 text-center" data-testid="loc-col-loc-rob">Loc ROB</div>
                    {FEATURES.IHM && <div className="px-2 text-center" data-testid="loc-col-ihm">IHM</div>}
                  </div>
                </div>
                <div className="flex flex-col">
                  {!selectedLocationId ? (
                    <div className="p-8 text-center text-gray-500">Select a location from the left panel to view spares.</div>
                  ) : isLocationSparesLoading ? (
                    <div className="p-8 text-center text-gray-500">Loading...</div>
                  ) : filteredLocationSpares.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No spares found at this location.</div>
                  ) : (
                    paginatedLocationSpares.map((spare: any, rowIndex: number) => {
                      const stockStatus = getStockStatus(spare.rob, spare.min);
                      const selectedLoc = allLocations.find((l: any) => l.id === selectedLocationId);
                      const selectedLocName = selectedLoc?.locationName || 'Unknown';
                      const locRobValue = editingLocRob[spare.id] ?? String(spare.locationQty ?? 0);
                      return (
                        <div key={spare.id} className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
                          <div className="grid text-sm items-center min-w-max" style={{ gridTemplateColumns: FEATURES.IHM ? '110px 180px 220px 120px 80px 60px 60px 80px 160px 100px 40px' : '110px 180px 220px 120px 80px 60px 60px 80px 160px 100px', minWidth: 'max-content', gap: '12px' }}>
                            <div className="px-2 text-gray-900">{spare.partCode}</div>
                            <div className="px-2 text-gray-700">{spare.partName}</div>
                            <div className="px-2 text-gray-700">{spare.componentName || '-'}</div>
                            <div className="px-2 text-blue-600 font-medium">{spare.partNumber || '-'}</div>
                            <div className="px-2">
                              <span className={`px-2 py-1 rounded text-xs ${
                                spare.critical === 'Critical' || spare.critical === 'Yes' 
                                  ? 'bg-red-100 text-red-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {spare.critical || 'No'}
                              </span>
                            </div>
                            <div className="px-2 text-center">{spare.rob}</div>
                            <div className="px-2 text-center">{spare.min}</div>
                            <div className="px-2 text-center">
                              <span className={`px-2 py-1 rounded text-xs ${stockStatus.color}`}>
                                {stockStatus.label}
                              </span>
                            </div>
                            <div className="px-2">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    className={`flex items-center gap-1 text-gray-700 hover:text-blue-600 cursor-pointer w-full text-left border border-gray-200 rounded-md px-2 py-1 ${isChangingLocation ? 'opacity-50 pointer-events-none' : ''}`}
                                    disabled={isChangingLocation}
                                    data-testid={`button-change-location-${spare.id}`}
                                  >
                                    <MapPin className="h-3 w-3 flex-shrink-0 text-gray-500" />
                                    <span className="truncate text-xs flex-1">{selectedLocName}</span>
                                    <ChevronsUpDown className="h-3 w-3 flex-shrink-0 text-gray-400" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-0" align="start">
                                  <Command>
                                    <CommandInput placeholder="Search locations..." data-testid={`input-search-location-${spare.id}`} />
                                    <CommandList className="max-h-none">
                                      <CommandEmpty>No locations found.</CommandEmpty>
                                      <div className="max-h-[144px] overflow-y-auto">
                                        <CommandGroup heading="Locations">
                                          {allVesselLocations.map((loc: any) => (
                                            <CommandItem
                                              key={loc.id}
                                              value={loc.locationName}
                                              onSelect={() => {
                                                if (loc.id !== selectedLocationId) {
                                                  handleChangeSpareLocation(spare, loc.id, loc.locationName);
                                                }
                                              }}
                                              data-testid={`option-location-${loc.id}-${spare.id}`}
                                            >
                                              <MapPin className="h-3 w-3 mr-2 flex-shrink-0" />
                                              <span className="truncate">{loc.locationName}</span>
                                              {loc.id === selectedLocationId && <Check className="h-3 w-3 ml-auto text-blue-600" />}
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </div>
                                      <CommandGroup className="border-t" forceMount>
                                        <CommandItem
                                          onSelect={() => setCreatingLocationForSpare(spare)}
                                          data-testid={`button-create-location-${spare.id}`}
                                          forceMount
                                        >
                                          <Plus className="h-3 w-3 mr-2 text-green-600" />
                                          <span className="text-green-600 font-medium">Create New Location</span>
                                        </CommandItem>
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>
                            <div className="px-2">
                              <Input
                                type="number"
                                min="0"
                                value={locRobValue}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || (/^\d+$/.test(val) && parseInt(val) >= 0)) {
                                    setEditingLocRob(prev => ({ ...prev, [spare.id]: val }));
                                  }
                                }}
                                className="h-7 text-sm text-center w-full"
                                placeholder="0"
                                data-testid={`input-loc-rob-${spare.id}`}
                              />
                            </div>
                            {FEATURES.IHM && (
                              <div className="px-2 flex justify-center">
                                {spare.ihm?.toLowerCase() === 'yes' ? (
                                  <span title="IHM Present - Hazardous Materials"><AlertCircle className="h-4 w-4 text-red-500" /></span>
                                ) : spare.ihm?.toLowerCase() === 'no' ? (
                                  <span title="No IHM - Compliant"><CheckCircle className="h-4 w-4 text-green-500" /></span>
                                ) : (
                                  <span title="IHM Status Unknown"><HelpCircle className="h-4 w-4 text-gray-400" /></span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {filteredLocationSpares.length > 0 && (
                  <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between" data-testid="location-pagination-footer">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>Show</span>
                      <Select value={String(locationItemsPerPage)} onValueChange={(val) => { setLocationItemsPerPage(Number(val)); setLocationPage(1); }}>
                        <SelectTrigger className="w-20 h-8" data-testid="select-location-items-per-page">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                      <span>items per page</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600" data-testid="location-pagination-info">
                      <span>
                        Showing {((locationPage - 1) * locationItemsPerPage) + 1} - {Math.min(locationPage * locationItemsPerPage, filteredLocationSpares.length)} of {filteredLocationSpares.length} spares
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => goToLocationPage(1)} disabled={locationPage === 1} className="h-8 w-8 p-0" data-testid="location-pagination-first">
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => goToLocationPage(locationPage - 1)} disabled={locationPage === 1} className="h-8 w-8 p-0" data-testid="location-pagination-prev">
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
                          data-testid="input-location-page-number"
                        />
                        <span className="text-sm text-gray-600">of {locationTotalPages || 1}</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => goToLocationPage(locationPage + 1)} disabled={locationPage >= locationTotalPages} className="h-8 w-8 p-0" data-testid="location-pagination-next">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => goToLocationPage(locationTotalPages)} disabled={locationPage >= locationTotalPages} className="h-8 w-8 p-0" data-testid="location-pagination-last">
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          {activeTab === 'history' && (
            <>
              {/* History Table Header */}
              <div className="bg-[#52baf3] px-4 py-3">
                <div className="grid grid-cols-9 gap-4 text-sm font-medium text-white">
                  <div>Date</div>
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
              <div className="overflow-y-auto flex-1">
                {historyData.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No history records found.
                  </div>
                ) : (
                  paginatedHistory.map((history: SpareHistory) => (
                    <div key={history.id} className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
                      <div className="grid grid-cols-9 gap-4 text-sm items-center">
                        <div className="text-gray-900">
                          {(() => {
                            try {
                              const isDateOnly = history.dateLocal && /^\d{4}-\d{2}-\d{2}$/.test(history.dateLocal.trim());
                              if (history.dateLocal) {
                                const dateStr = isDateOnly ? `${history.dateLocal.trim()}T00:00:00` : history.dateLocal;
                                const date = new Date(dateStr);
                                if (!isNaN(date.getTime())) {
                                  return format(date, 'dd-MMM-yyyy');
                                }
                              }
                              if (history.timestampUTC) {
                                const date = new Date(history.timestampUTC);
                                if (!isNaN(date.getTime())) {
                                  return format(date, 'dd-MMM-yyyy');
                                }
                              }
                              return '-';
                            } catch {
                              return '-';
                            }
                          })()}
                        </div>
                        <div className="text-gray-700">{history.partCode}</div>
                        <div className="text-gray-700">{history.partName}</div>
                        <div className="text-gray-700">{history.componentName}</div>
                        <div className="text-blue-600 font-medium">{history.partNumber || '-'}</div>
                        <div>
                          <span className={`px-2 py-1 rounded text-xs ${
                            history.eventType === 'CONSUME' 
                              ? 'bg-red-100 text-red-800' 
                              : history.eventType === 'RECEIVE'
                              ? 'bg-green-100 text-green-800'
                              : history.eventType === 'ADJUST'
                              ? 'bg-orange-100 text-orange-800'
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

              {/* History Pagination Footer */}
              {historyData.length > 0 && (
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between" data-testid="history-pagination-footer">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>Show</span>
                    <Select value={String(historyItemsPerPage)} onValueChange={(val) => { setHistoryItemsPerPage(Number(val)); setHistoryPage(1); }}>
                      <SelectTrigger className="w-20 h-8" data-testid="select-history-items-per-page">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span>items per page</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600" data-testid="history-pagination-info">
                    <span>
                      Showing {((historyPage - 1) * historyItemsPerPage) + 1} - {Math.min(historyPage * historyItemsPerPage, historyData.length)} of {historyData.length} transactions
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => goToHistoryPage(1)} disabled={historyPage === 1} className="h-8 w-8 p-0" data-testid="history-pagination-first">
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => goToHistoryPage(historyPage - 1)} disabled={historyPage === 1} className="h-8 w-8 p-0" data-testid="history-pagination-prev">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1 px-2">
                      <span className="text-sm text-gray-600">Page</span>
                      <Input
                        type="number"
                        min={1}
                        max={historyTotalPages || 1}
                        value={historyPage}
                        onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) goToHistoryPage(v); }}
                        className="w-14 h-8 text-center"
                        data-testid="input-history-page-number"
                      />
                      <span className="text-sm text-gray-600">of {historyTotalPages || 1}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => goToHistoryPage(historyPage + 1)} disabled={historyPage >= historyTotalPages} className="h-8 w-8 p-0" data-testid="history-pagination-next">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => goToHistoryPage(historyTotalPages)} disabled={historyPage >= historyTotalPages} className="h-8 w-8 p-0" data-testid="history-pagination-last">
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {/* Bulk Update Modal */}
      <Dialog open={isBulkUpdateModalOpen} onOpenChange={setIsBulkUpdateModalOpen}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Update Spares</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-gray-500">
                Updating {filteredSpares.length} spare(s) {bulkSearchQuery && `(showing ${bulkModalFilteredSpares.length} filtered)`}
              </div>
              {/* Smart Search Bar */}
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Search by part code, name, component..."
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
            
            {/* Common fields for all spares */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <Label htmlFor="bulk-received-date">Received Date (Apply to all)</Label>
                <Input
                  id="bulk-received-date"
                  type="date"
                  data-testid="input-bulk-received-date"
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
                  data-testid="input-bulk-received-place"
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

            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium">Part Code</th>
                      <th className="px-3 py-2 text-left text-xs font-medium">Part Name</th>
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
                    {bulkModalFilteredSpares.map((spare: Spare) => {
                      const consumedA = bulkUpdateData[spare.id]?.consumedA || 0;
                      const consumedB = bulkUpdateData[spare.id]?.consumedB || 0;
                      const receivedA = bulkUpdateData[spare.id]?.receivedA || 0;
                      const receivedB = bulkUpdateData[spare.id]?.receivedB || 0;
                      const robA = spare.robLocationA ?? 0;
                      const robB = spare.robLocationB ?? 0;
                      const newRobA = robA - consumedA + receivedA;
                      const newRobB = robB - consumedB + receivedB;
                      const newROB = newRobA + newRobB;
                      const hasInsufficientStockA = consumedA > robA;
                      const hasInsufficientStockB = consumedB > robB;
                      const totalReceived = receivedA + receivedB;
                      const needsReceivedDate = totalReceived > 0 && !bulkUpdateData[spare.id]?.receivedDate;
                      const hasError = hasInsufficientStockA || hasInsufficientStockB || needsReceivedDate;
                      
                      // Get spare-specific location names - use actual ROB locations stored on the spare
                      // Do NOT fall back to vessel-location-names API (those are generic column labels)
                      const spareLocA = spare.location || 'Location A';
                      const spareLocB = spare.location2 || 'Location B';
                      
                      return (
                        <tr key={spare.id} className={`border-t ${hasError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                          <td className="px-3 py-2 text-sm">{spare.partCode}</td>
                          <td className="px-3 py-2 text-sm max-w-[150px] truncate" title={spare.partName}>{spare.partName}</td>
                          {/* ROB cells with location names */}
                          <td className="px-2 py-2 text-center">
                            <div className="text-[9px] text-gray-500 truncate max-w-[60px]" title={spareLocA}>{spareLocA}</div>
                            <div className="text-xs text-gray-600 font-medium">{robA}</div>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <div className="text-[9px] text-gray-500 truncate max-w-[60px]" title={spareLocB}>{spareLocB}</div>
                            <div className="text-xs text-gray-600 font-medium">{robB}</div>
                          </td>
                          {/* Consumed cells with location names */}
                          <td className="px-1 py-2 border-l">
                            <div className="text-[9px] text-gray-500 truncate max-w-[56px] text-center" title={spareLocA}>{spareLocA}</div>
                            <Input
                              type="number"
                              min="0"
                              max={robA}
                              value={bulkUpdateData[spare.id]?.consumedA || ""}
                              onChange={(e) => handleBulkUpdateChange(spare.id, 'consumedA', e.target.value)}
                              className={`w-14 h-7 text-sm text-center ${hasInsufficientStockA ? 'border-red-500' : ''}`}
                              data-testid={`input-consume-a-${spare.id}`}
                            />
                          </td>
                          <td className="px-1 py-2">
                            <div className="text-[9px] text-gray-500 truncate max-w-[56px] text-center" title={spareLocB}>{spareLocB}</div>
                            <Input
                              type="number"
                              min="0"
                              max={robB}
                              value={bulkUpdateData[spare.id]?.consumedB || ""}
                              onChange={(e) => handleBulkUpdateChange(spare.id, 'consumedB', e.target.value)}
                              className={`w-14 h-7 text-sm text-center ${hasInsufficientStockB ? 'border-red-500' : ''}`}
                              data-testid={`input-consume-b-${spare.id}`}
                            />
                          </td>
                          {/* Received cells with location names */}
                          <td className="px-1 py-2 border-l">
                            <div className="text-[9px] text-gray-500 truncate max-w-[56px] text-center" title={spareLocA}>{spareLocA}</div>
                            <Input
                              type="number"
                              min="0"
                              value={bulkUpdateData[spare.id]?.receivedA || ""}
                              onChange={(e) => handleBulkUpdateChange(spare.id, 'receivedA', e.target.value)}
                              className="w-14 h-7 text-sm text-center"
                              data-testid={`input-receive-a-${spare.id}`}
                            />
                          </td>
                          <td className="px-1 py-2">
                            <div className="text-[9px] text-gray-500 truncate max-w-[56px] text-center" title={spareLocB}>{spareLocB}</div>
                            <Input
                              type="number"
                              min="0"
                              value={bulkUpdateData[spare.id]?.receivedB || ""}
                              onChange={(e) => handleBulkUpdateChange(spare.id, 'receivedB', e.target.value)}
                              className="w-14 h-7 text-sm text-center"
                              data-testid={`input-receive-b-${spare.id}`}
                            />
                          </td>
                          <td className="px-2 py-2 text-center border-l">
                            <div className={`text-sm font-medium ${hasError ? 'text-red-600' : ''}`}>
                              {newROB}
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
              {bulkModalFilteredSpares.length === 0 && bulkSearchQuery && (
                <div className="p-8 text-center text-gray-500">
                  No spares found matching "{bulkSearchQuery}"
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkUpdateModalOpen(false)} data-testid="button-bulk-cancel">
              Cancel
            </Button>
            <Button 
              onClick={saveBulkUpdates}
              data-testid="button-bulk-save"
              disabled={bulkUpdateMutation.isPending || (() => {
                // Check for validation errors
                const sparesArrayInline = Array.isArray(sparesData) ? sparesData : [];
                return Object.entries(bulkUpdateData).some(([id, data]) => {
                  const spare = sparesArrayInline.find((s: Spare) => s.id === parseInt(id));
                  if (!spare) return false;
                  // Check per-location stock
                  if ((data.consumedA || 0) > (spare.robLocationA ?? 0)) return true;
                  if ((data.consumedB || 0) > (spare.robLocationB ?? 0)) return true;
                  // Check received date requirement
                  const totalReceived = (data.receivedA || 0) + (data.receivedB || 0);
                  if (totalReceived > 0 && !data.receivedDate) return true;
                  return false;
                });
              })()}
            >
              {bulkUpdateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add Spare Modal - Comprehensive form matching Edit Spare Part layout */}
      <Dialog open={isAddSpareModalOpen} onOpenChange={setIsAddSpareModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#52baf3]">
              <PlusCircle className="h-5 w-5" />
              Add New Spare
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Basic Information Section */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="add-part-code">Part Code *</Label>
                  <Input
                    id="add-part-code"
                    value={addSpareForm.partCode}
                    onChange={(e) => setAddSpareForm({...addSpareForm, partCode: e.target.value})}
                    placeholder="e.g., MV0001-00006"
                    data-testid="input-add-part-code"
                  />
                </div>
                <div>
                  <Label htmlFor="add-part-name">Part Name *</Label>
                  <Input
                    id="add-part-name"
                    value={addSpareForm.partName}
                    onChange={(e) => setAddSpareForm({...addSpareForm, partName: e.target.value})}
                    placeholder="e.g., Volute Casing"
                    data-testid="input-add-part-name"
                  />
                </div>
                <div>
                  <Label htmlFor="add-part-number">Part Number</Label>
                  <Input
                    id="add-part-number"
                    value={addSpareForm.partNumber}
                    onChange={(e) => setAddSpareForm({...addSpareForm, partNumber: e.target.value})}
                    placeholder="e.g., Fig. CM-35001/1"
                    data-testid="input-add-part-number"
                  />
                </div>
                <div>
                  <Label htmlFor="add-uom">UOM (Unit of Measure)</Label>
                  <Input
                    id="add-uom"
                    value={addSpareForm.uom}
                    onChange={(e) => setAddSpareForm({...addSpareForm, uom: e.target.value})}
                    placeholder="e.g., PCS"
                    data-testid="input-add-uom"
                  />
                </div>
              </div>

              <div className="mt-4">
                <Label className="text-sm font-medium mb-1 block">Linked Component *</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="add-component-code" className="text-xs text-muted-foreground">Component Code</Label>
                    <Popover open={componentCodePopoverOpen} onOpenChange={setComponentCodePopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={componentCodePopoverOpen}
                          className="w-full justify-between font-normal"
                          data-testid="select-add-component-code"
                        >
                          {addSpareForm.componentId
                            ? flattenedComponents.find(c => c.id === addSpareForm.componentId)?.code || "Select code"
                            : "Search & select code"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[350px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Type to search component code..." data-testid="input-search-component-code" />
                          <CommandList>
                            <CommandEmpty>No component found.</CommandEmpty>
                            <CommandGroup className="max-h-[250px] overflow-y-auto">
                              {flattenedComponents.map((comp) => (
                                <CommandItem
                                  key={comp.id}
                                  value={`${comp.code} ${comp.name}`}
                                  onSelect={() => {
                                    setAddSpareForm({...addSpareForm, componentId: comp.id});
                                    setComponentCodePopoverOpen(false);
                                  }}
                                  data-testid={`component-option-${comp.code}`}
                                >
                                  <Check className={`mr-2 h-4 w-4 ${addSpareForm.componentId === comp.id ? "opacity-100" : "opacity-0"}`} />
                                  <span className="font-medium mr-2">{comp.code}</span>
                                  <span className="text-muted-foreground text-xs truncate">{comp.name}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label htmlFor="add-component-name" className="text-xs text-muted-foreground">Component Name</Label>
                    <Input
                      id="add-component-name"
                      value={addSpareForm.componentId ? (flattenedComponents.find(c => c.id === addSpareForm.componentId)?.name || '') : ''}
                      readOnly
                      className="bg-gray-100"
                      placeholder="Auto-filled from code"
                      data-testid="input-add-component-name"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Stock & Location Section */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Stock & Location</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="add-rob">ROB (Total)</Label>
                  <Input
                    id="add-rob"
                    type="number"
                    min="0"
                    value={addSpareForm.rob}
                    onChange={(e) => setAddSpareForm({...addSpareForm, rob: e.target.value})}
                    placeholder="0"
                    data-testid="input-add-rob"
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
                    data-testid="input-add-min"
                  />
                </div>
                <div>
                  <Label>Location A</Label>
                  <Popover open={addLocAPopoverOpen} onOpenChange={setAddLocAPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={addLocAPopoverOpen}
                        className="w-full justify-between font-normal"
                        data-testid="input-add-location-a"
                      >
                        {addSpareForm.location || "Select location..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search locations..." value={addLocSearchA} onValueChange={setAddLocSearchA} />
                        <CommandList className="max-h-none">
                          <CommandEmpty>No locations found.</CommandEmpty>
                          <div className="max-h-[144px] overflow-y-auto">
                            <CommandGroup heading="Locations">
                              <CommandItem
                                value="none"
                                onSelect={() => {
                                  setAddSpareForm({...addSpareForm, location: ''});
                                  setAddLocAPopoverOpen(false);
                                  setAddLocSearchA('');
                                }}
                              >
                                <span className="text-muted-foreground">None</span>
                                {!addSpareForm.location && (
                                  <Check className="ml-auto h-4 w-4 flex-shrink-0 text-green-600" />
                                )}
                              </CommandItem>
                              {allVesselLocations.map((loc: any) => (
                                <CommandItem
                                  key={loc.id}
                                  value={loc.locationName}
                                  onSelect={() => {
                                    setAddSpareForm({...addSpareForm, location: loc.locationName});
                                    setAddLocAPopoverOpen(false);
                                    setAddLocSearchA('');
                                  }}
                                >
                                  <MapPin className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                  <span className="truncate flex-1">{loc.locationName}</span>
                                  {addSpareForm.location === loc.locationName && (
                                    <Check className="ml-2 h-4 w-4 flex-shrink-0 text-green-600" />
                                  )}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </div>
                          <CommandGroup className="border-t" forceMount>
                            <CommandItem
                              onSelect={async () => {
                                const name = addLocSearchA.trim();
                                if (!name) return;
                                try {
                                  const res = await fetch(`/technical/api/inventory/locations/${vesselId}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ locationName: name, createdBy: 'System' }),
                                  });
                                  if (res.ok) {
                                    queryClient.invalidateQueries({ queryKey: [`/technical/api/inventory/locations/${vesselId}`] });
                                    setAddSpareForm({...addSpareForm, location: name});
                                    toast({ title: "Location Created", description: `"${name}" created.` });
                                  } else {
                                    toast({ title: "Failed to create location", description: "Please try again.", variant: "destructive" });
                                  }
                                } catch {
                                  toast({ title: "Failed to create location", description: "Network error. Please try again.", variant: "destructive" });
                                }
                                setAddLocAPopoverOpen(false);
                                setAddLocSearchA('');
                              }}
                              data-testid="button-add-create-location-a"
                              forceMount
                            >
                              <Plus className="mr-2 h-4 w-4 text-green-600" />
                              <span className="text-green-600 font-medium">Create New Location</span>
                            </CommandItem>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Location B</Label>
                  <Popover open={addLocBPopoverOpen} onOpenChange={setAddLocBPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={addLocBPopoverOpen}
                        className="w-full justify-between font-normal"
                        data-testid="input-add-location-b"
                      >
                        {addSpareForm.location2 || "Select location..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search locations..." value={addLocSearchB} onValueChange={setAddLocSearchB} />
                        <CommandList className="max-h-none">
                          <CommandEmpty>No locations found.</CommandEmpty>
                          <div className="max-h-[144px] overflow-y-auto">
                            <CommandGroup heading="Locations">
                              <CommandItem
                                value="none"
                                onSelect={() => {
                                  setAddSpareForm({...addSpareForm, location2: ''});
                                  setAddLocBPopoverOpen(false);
                                  setAddLocSearchB('');
                                }}
                              >
                                <span className="text-muted-foreground">None</span>
                                {!addSpareForm.location2 && (
                                  <Check className="ml-auto h-4 w-4 flex-shrink-0 text-green-600" />
                                )}
                              </CommandItem>
                              {allVesselLocations.map((loc: any) => (
                                <CommandItem
                                  key={loc.id}
                                  value={loc.locationName}
                                  onSelect={() => {
                                    setAddSpareForm({...addSpareForm, location2: loc.locationName});
                                    setAddLocBPopoverOpen(false);
                                    setAddLocSearchB('');
                                  }}
                                >
                                  <MapPin className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                  <span className="truncate flex-1">{loc.locationName}</span>
                                  {addSpareForm.location2 === loc.locationName && (
                                    <Check className="ml-2 h-4 w-4 flex-shrink-0 text-green-600" />
                                  )}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </div>
                          <CommandGroup className="border-t" forceMount>
                            <CommandItem
                              onSelect={async () => {
                                const name = addLocSearchB.trim();
                                if (!name) return;
                                try {
                                  const res = await fetch(`/technical/api/inventory/locations/${vesselId}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ locationName: name, createdBy: 'System' }),
                                  });
                                  if (res.ok) {
                                    queryClient.invalidateQueries({ queryKey: [`/technical/api/inventory/locations/${vesselId}`] });
                                    setAddSpareForm({...addSpareForm, location2: name});
                                    toast({ title: "Location Created", description: `"${name}" created.` });
                                  } else {
                                    toast({ title: "Failed to create location", description: "Please try again.", variant: "destructive" });
                                  }
                                } catch {
                                  toast({ title: "Failed to create location", description: "Network error. Please try again.", variant: "destructive" });
                                }
                                setAddLocBPopoverOpen(false);
                                setAddLocSearchB('');
                              }}
                              data-testid="button-add-create-location-b"
                              forceMount
                            >
                              <Plus className="mr-2 h-4 w-4 text-green-600" />
                              <span className="text-green-600 font-medium">Create New Location</span>
                            </CommandItem>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="add-critical">Criticality</Label>
                  <Select 
                    value={addSpareForm.critical} 
                    onValueChange={(value) => setAddSpareForm({...addSpareForm, critical: value})}
                  >
                    <SelectTrigger id="add-critical" data-testid="select-add-critical">
                      <SelectValue placeholder="Select criticality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                      <SelectItem value="Critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="add-is-active">Is Active</Label>
                  <Select 
                    value={addSpareForm.isActive ? "Yes" : "No"} 
                    onValueChange={(value) => setAddSpareForm({...addSpareForm, isActive: value === "Yes"})}
                  >
                    <SelectTrigger id="add-is-active" data-testid="select-add-is-active">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Technical Details Section */}
            <div className="bg-green-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Technical Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="add-maker">Maker</Label>
                  <Popover open={addMakerPopoverOpen} onOpenChange={setAddMakerPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={addMakerPopoverOpen}
                        className="w-full justify-between font-normal h-10"
                        data-testid="input-add-maker"
                      >
                        {addSpareForm.maker || "Select maker..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search makers..."
                          value={addMakerSearch}
                          onValueChange={setAddMakerSearch}
                          data-testid="input-add-maker-search"
                        />
                        <CommandList>
                          <CommandEmpty>No makers found.</CommandEmpty>
                          <CommandGroup>
                            {addSpareForm.maker && (
                              <CommandItem
                                value="__clear__"
                                onSelect={() => {
                                  setAddSpareForm({...addSpareForm, maker: "", makerCode: ""});
                                  setAddMakerSearch('');
                                  setAddMakerPopoverOpen(false);
                                }}
                                data-testid="add-maker-clear"
                              >
                                <X className="mr-2 h-4 w-4" />
                                Clear selection
                              </CommandItem>
                            )}
                            {filteredAddMakers.slice(0, 50).map((m) => (
                              <CommandItem
                                key={m.id}
                                value={m.makerName}
                                onSelect={() => {
                                  setAddSpareForm({...addSpareForm, maker: m.makerName, makerCode: m.makerCode});
                                  setAddMakerSearch('');
                                  setAddMakerPopoverOpen(false);
                                }}
                                data-testid={`add-maker-option-${m.id}`}
                              >
                                <Check className={`mr-2 h-4 w-4 ${addSpareForm.maker === m.makerName ? "opacity-100" : "opacity-0"}`} />
                                <span>{m.makerName}</span>
                                <span className="ml-auto text-xs text-muted-foreground">{m.makerCode}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="add-maker-code">Maker Code</Label>
                  <Input
                    id="add-maker-code"
                    value={addSpareForm.makerCode}
                    readOnly
                    className="bg-gray-100"
                    placeholder="Auto-filled from maker selection"
                    data-testid="input-add-maker-code"
                  />
                </div>
                <div>
                  <Label htmlFor="add-drawing-number">Drawing Number</Label>
                  <Input
                    id="add-drawing-number"
                    value={addSpareForm.drawingNumber}
                    onChange={(e) => setAddSpareForm({...addSpareForm, drawingNumber: e.target.value})}
                    placeholder="e.g., FIG. 11"
                    data-testid="input-add-drawing-number"
                  />
                </div>
                <div>
                  <Label htmlFor="add-position-number">Position Number</Label>
                  <Input
                    id="add-position-number"
                    value={addSpareForm.positionNumber}
                    onChange={(e) => setAddSpareForm({...addSpareForm, positionNumber: e.target.value})}
                    placeholder="e.g., 6"
                    data-testid="input-add-position-number"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="add-specification">Specification</Label>
                  <Input
                    id="add-specification"
                    value={addSpareForm.specification}
                    onChange={(e) => setAddSpareForm({...addSpareForm, specification: e.target.value})}
                    placeholder="Enter specification details"
                    data-testid="input-add-specification"
                  />
                </div>
              </div>
            </div>

            {/* Manual Reference Section */}
            <div className="bg-yellow-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Manual Reference</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="add-manual-name">Manual Name</Label>
                  <Input
                    id="add-manual-name"
                    value={addSpareForm.manualName}
                    onChange={(e) => setAddSpareForm({...addSpareForm, manualName: e.target.value})}
                    placeholder="e.g., Manual Name-0006"
                    data-testid="input-add-manual-name"
                  />
                </div>
                <div>
                  <Label htmlFor="add-page-number">Page Number</Label>
                  <Input
                    id="add-page-number"
                    value={addSpareForm.pageNumber}
                    onChange={(e) => setAddSpareForm({...addSpareForm, pageNumber: e.target.value})}
                    placeholder="e.g., 6"
                    data-testid="input-add-page-number"
                  />
                </div>
              </div>
            </div>

            {/* IHM & Notes Section */}
            <div className="bg-purple-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">IHM & Notes</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="add-ihm">IHM (Inventory of Hazardous Materials)</Label>
                  <Select 
                    value={addSpareForm.ihm || "No"} 
                    onValueChange={(value) => setAddSpareForm({...addSpareForm, ihm: value})}
                  >
                    <SelectTrigger id="add-ihm" data-testid="select-add-ihm">
                      <SelectValue placeholder="Select IHM status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="add-evidence-type">Evidence Type</Label>
                  <Input
                    id="add-evidence-type"
                    value={addSpareForm.remarks}
                    onChange={(e) => setAddSpareForm({...addSpareForm, remarks: e.target.value})}
                    placeholder="e.g., 22"
                    data-testid="input-add-evidence-type"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="add-note">Note</Label>
                  <Input
                    id="add-note"
                    value={addSpareForm.note}
                    onChange={(e) => setAddSpareForm({...addSpareForm, note: e.target.value})}
                    placeholder="e.g., Sample-XX-YY-0006"
                    data-testid="input-add-note"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsAddSpareModalOpen(false)} data-testid="button-cancel-add">
              Cancel
            </Button>
            <Button 
              onClick={handleAddSpareSubmit} 
              disabled={createSpareMutation.isPending}
              className="bg-[#52baf3] hover:bg-[#40a8e0]"
              data-testid="button-create-spare"
            >
              {createSpareMutation.isPending ? "Creating..." : "Create Spare"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Spare Modal - Comprehensive form matching Spare Part Details */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#52baf3]">
              <Edit2 className="h-5 w-5" />
              Edit Spare Part
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Basic Information Section */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-part-code">Part Code *</Label>
                  <Input
                    id="edit-part-code"
                    value={editSpareForm.partCode}
                    onChange={(e) => setEditSpareForm({...editSpareForm, partCode: e.target.value})}
                    placeholder="e.g., MV0001-00006"
                    data-testid="input-edit-part-code"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-part-name">Part Name *</Label>
                  <Input
                    id="edit-part-name"
                    value={editSpareForm.partName}
                    onChange={(e) => setEditSpareForm({...editSpareForm, partName: e.target.value})}
                    placeholder="e.g., Exciter Rotor"
                    data-testid="input-edit-part-name"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-part-number">Part Number</Label>
                  <Input
                    id="edit-part-number"
                    value={editSpareForm.partNumber}
                    onChange={(e) => setEditSpareForm({...editSpareForm, partNumber: e.target.value})}
                    placeholder="e.g., Fig. 11\3"
                    data-testid="input-edit-part-number"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-uom">UOM (Unit of Measure)</Label>
                  <Input
                    id="edit-uom"
                    value={editSpareForm.uom}
                    onChange={(e) => setEditSpareForm({...editSpareForm, uom: e.target.value})}
                    placeholder="e.g., PCS"
                    data-testid="input-edit-uom"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-component-name">Component</Label>
                  <Input
                    id="edit-component-name"
                    value={editSpareForm.componentName}
                    readOnly
                    className="bg-gray-100"
                    data-testid="input-edit-component-name"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-component-code">Component Code</Label>
                  <Input
                    id="edit-component-code"
                    value={editSpareForm.componentCode}
                    readOnly
                    className="bg-gray-100"
                    data-testid="input-edit-component-code"
                  />
                </div>
              </div>
            </div>

            {/* Stock & Location Section */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Stock & Location</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-rob">ROB (Total)</Label>
                  <Input
                    id="edit-rob"
                    type="number"
                    min="0"
                    value={editSpareForm.rob}
                    onChange={(e) => setEditSpareForm({...editSpareForm, rob: e.target.value})}
                    placeholder="0"
                    data-testid="input-edit-rob"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-min">Minimum Stock</Label>
                  <Input
                    id="edit-min"
                    type="number"
                    min="0"
                    value={editSpareForm.min}
                    onChange={(e) => setEditSpareForm({...editSpareForm, min: e.target.value})}
                    placeholder="0"
                    data-testid="input-edit-min"
                  />
                </div>
                <div>
                  <Label>Location A</Label>
                  <Popover open={editLocAPopoverOpen} onOpenChange={setEditLocAPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={editLocAPopoverOpen}
                        className="w-full justify-between font-normal"
                        data-testid="input-edit-location-a"
                      >
                        {editSpareForm.location || "Select location..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search locations..." value={editLocSearchA} onValueChange={setEditLocSearchA} />
                        <CommandList className="max-h-none">
                          <CommandEmpty>No locations found.</CommandEmpty>
                          <div className="max-h-[144px] overflow-y-auto">
                            <CommandGroup heading="Locations">
                              <CommandItem
                                value="none"
                                onSelect={() => {
                                  setEditSpareForm({...editSpareForm, location: ''});
                                  setEditLocAPopoverOpen(false);
                                  setEditLocSearchA('');
                                }}
                              >
                                <span className="text-muted-foreground">None</span>
                                {!editSpareForm.location && (
                                  <Check className="ml-auto h-4 w-4 flex-shrink-0 text-green-600" />
                                )}
                              </CommandItem>
                              {allVesselLocations.map((loc: any) => (
                                <CommandItem
                                  key={loc.id}
                                  value={loc.locationName}
                                  onSelect={() => {
                                    setEditSpareForm({...editSpareForm, location: loc.locationName});
                                    setEditLocAPopoverOpen(false);
                                    setEditLocSearchA('');
                                  }}
                                >
                                  <MapPin className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                  <span className="truncate flex-1">{loc.locationName}</span>
                                  {editSpareForm.location === loc.locationName && (
                                    <Check className="ml-2 h-4 w-4 flex-shrink-0 text-green-600" />
                                  )}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </div>
                          <CommandGroup className="border-t" forceMount>
                            <CommandItem
                              onSelect={async () => {
                                const name = editLocSearchA.trim();
                                if (!name) return;
                                try {
                                  const res = await fetch(`/technical/api/inventory/locations/${vesselId}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ locationName: name, createdBy: 'System' }),
                                  });
                                  if (res.ok) {
                                    queryClient.invalidateQueries({ queryKey: [`/technical/api/inventory/locations/${vesselId}`] });
                                    setEditSpareForm({...editSpareForm, location: name});
                                    toast({ title: "Location Created", description: `"${name}" created.` });
                                  } else {
                                    toast({ title: "Failed to create location", description: "Please try again.", variant: "destructive" });
                                  }
                                } catch {
                                  toast({ title: "Failed to create location", description: "Network error. Please try again.", variant: "destructive" });
                                }
                                setEditLocAPopoverOpen(false);
                                setEditLocSearchA('');
                              }}
                              data-testid="button-edit-create-location-a"
                              forceMount
                            >
                              <Plus className="mr-2 h-4 w-4 text-green-600" />
                              <span className="text-green-600 font-medium">Create New Location</span>
                            </CommandItem>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Location B</Label>
                  <Popover open={editLocBPopoverOpen} onOpenChange={setEditLocBPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={editLocBPopoverOpen}
                        className="w-full justify-between font-normal"
                        data-testid="input-edit-location-b"
                      >
                        {editSpareForm.location2 || "Select location..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search locations..." value={editLocSearchB} onValueChange={setEditLocSearchB} />
                        <CommandList className="max-h-none">
                          <CommandEmpty>No locations found.</CommandEmpty>
                          <div className="max-h-[144px] overflow-y-auto">
                            <CommandGroup heading="Locations">
                              <CommandItem
                                value="none"
                                onSelect={() => {
                                  setEditSpareForm({...editSpareForm, location2: ''});
                                  setEditLocBPopoverOpen(false);
                                  setEditLocSearchB('');
                                }}
                              >
                                <span className="text-muted-foreground">None</span>
                                {!editSpareForm.location2 && (
                                  <Check className="ml-auto h-4 w-4 flex-shrink-0 text-green-600" />
                                )}
                              </CommandItem>
                              {allVesselLocations.map((loc: any) => (
                                <CommandItem
                                  key={loc.id}
                                  value={loc.locationName}
                                  onSelect={() => {
                                    setEditSpareForm({...editSpareForm, location2: loc.locationName});
                                    setEditLocBPopoverOpen(false);
                                    setEditLocSearchB('');
                                  }}
                                >
                                  <MapPin className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                  <span className="truncate flex-1">{loc.locationName}</span>
                                  {editSpareForm.location2 === loc.locationName && (
                                    <Check className="ml-2 h-4 w-4 flex-shrink-0 text-green-600" />
                                  )}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </div>
                          <CommandGroup className="border-t" forceMount>
                            <CommandItem
                              onSelect={async () => {
                                const name = editLocSearchB.trim();
                                if (!name) return;
                                try {
                                  const res = await fetch(`/technical/api/inventory/locations/${vesselId}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ locationName: name, createdBy: 'System' }),
                                  });
                                  if (res.ok) {
                                    queryClient.invalidateQueries({ queryKey: [`/technical/api/inventory/locations/${vesselId}`] });
                                    setEditSpareForm({...editSpareForm, location2: name});
                                    toast({ title: "Location Created", description: `"${name}" created.` });
                                  } else {
                                    toast({ title: "Failed to create location", description: "Please try again.", variant: "destructive" });
                                  }
                                } catch {
                                  toast({ title: "Failed to create location", description: "Network error. Please try again.", variant: "destructive" });
                                }
                                setEditLocBPopoverOpen(false);
                                setEditLocSearchB('');
                              }}
                              data-testid="button-edit-create-location-b"
                              forceMount
                            >
                              <Plus className="mr-2 h-4 w-4 text-green-600" />
                              <span className="text-green-600 font-medium">Create New Location</span>
                            </CommandItem>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="edit-critical">Criticality</Label>
                  <Select 
                    value={editSpareForm.critical || "No"} 
                    onValueChange={(value) => setEditSpareForm({...editSpareForm, critical: value})}
                  >
                    <SelectTrigger id="edit-critical" data-testid="select-edit-critical">
                      <SelectValue placeholder="Select criticality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                      <SelectItem value="Critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-is-active">Is Active</Label>
                  <Select 
                    value={editSpareForm.isActive ? "Yes" : "No"} 
                    onValueChange={(value) => setEditSpareForm({...editSpareForm, isActive: value === "Yes"})}
                  >
                    <SelectTrigger id="edit-is-active" data-testid="select-edit-is-active">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Technical Details Section */}
            <div className="bg-green-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Technical Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-maker">Maker</Label>
                  <Popover open={editMakerPopoverOpen} onOpenChange={setEditMakerPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={editMakerPopoverOpen}
                        className="w-full justify-between font-normal h-10"
                        data-testid="input-edit-maker"
                      >
                        {editSpareForm.maker || "Select maker..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search makers..."
                          value={editMakerSearch}
                          onValueChange={setEditMakerSearch}
                          data-testid="input-edit-maker-search"
                        />
                        <CommandList>
                          <CommandEmpty>No makers found.</CommandEmpty>
                          <CommandGroup>
                            {editSpareForm.maker && (
                              <CommandItem
                                value="__clear__"
                                onSelect={() => {
                                  setEditSpareForm({...editSpareForm, maker: "", makerCode: ""});
                                  setEditMakerSearch('');
                                  setEditMakerPopoverOpen(false);
                                }}
                                data-testid="edit-maker-clear"
                              >
                                <X className="mr-2 h-4 w-4" />
                                Clear selection
                              </CommandItem>
                            )}
                            {filteredEditMakers.slice(0, 50).map((m) => (
                              <CommandItem
                                key={m.id}
                                value={m.makerName}
                                onSelect={() => {
                                  setEditSpareForm({...editSpareForm, maker: m.makerName, makerCode: m.makerCode});
                                  setEditMakerSearch('');
                                  setEditMakerPopoverOpen(false);
                                }}
                                data-testid={`edit-maker-option-${m.id}`}
                              >
                                <Check className={`mr-2 h-4 w-4 ${editSpareForm.maker === m.makerName ? "opacity-100" : "opacity-0"}`} />
                                <span>{m.makerName}</span>
                                <span className="ml-auto text-xs text-muted-foreground">{m.makerCode}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="edit-maker-code">Maker Code</Label>
                  <Input
                    id="edit-maker-code"
                    value={editSpareForm.makerCode}
                    readOnly
                    className="bg-gray-100"
                    placeholder="Auto-filled from maker selection"
                    data-testid="input-edit-maker-code"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-drawing-number">Drawing Number</Label>
                  <Input
                    id="edit-drawing-number"
                    value={editSpareForm.drawingNumber}
                    onChange={(e) => setEditSpareForm({...editSpareForm, drawingNumber: e.target.value})}
                    placeholder="e.g., FIG. 11"
                    data-testid="input-edit-drawing-number"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-position-number">Position Number</Label>
                  <Input
                    id="edit-position-number"
                    value={editSpareForm.positionNumber}
                    onChange={(e) => setEditSpareForm({...editSpareForm, positionNumber: e.target.value})}
                    placeholder="e.g., 6"
                    data-testid="input-edit-position-number"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="edit-specification">Specification</Label>
                  <Input
                    id="edit-specification"
                    value={editSpareForm.specification}
                    onChange={(e) => setEditSpareForm({...editSpareForm, specification: e.target.value})}
                    placeholder="Enter specification details"
                    data-testid="input-edit-specification"
                  />
                </div>
              </div>
            </div>

            {/* Manual Reference Section */}
            <div className="bg-yellow-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Manual Reference</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-manual-name">Manual Name</Label>
                  <Input
                    id="edit-manual-name"
                    value={editSpareForm.manualName}
                    onChange={(e) => setEditSpareForm({...editSpareForm, manualName: e.target.value})}
                    placeholder="e.g., Manual Name-0006"
                    data-testid="input-edit-manual-name"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-page-number">Page Number</Label>
                  <Input
                    id="edit-page-number"
                    value={editSpareForm.pageNumber}
                    onChange={(e) => setEditSpareForm({...editSpareForm, pageNumber: e.target.value})}
                    placeholder="e.g., 6"
                    data-testid="input-edit-page-number"
                  />
                </div>
              </div>
            </div>

            {/* IHM & Notes Section */}
            <div className="bg-purple-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">IHM & Notes</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-ihm">IHM (Inventory of Hazardous Materials)</Label>
                  <Select 
                    value={editSpareForm.ihm || "No"} 
                    onValueChange={(value) => setEditSpareForm({...editSpareForm, ihm: value})}
                  >
                    <SelectTrigger id="edit-ihm" data-testid="select-edit-ihm">
                      <SelectValue placeholder="Select IHM status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-evidence-type">Evidence Type</Label>
                  <Input
                    id="edit-evidence-type"
                    value={editSpareForm.remarks}
                    onChange={(e) => setEditSpareForm({...editSpareForm, remarks: e.target.value})}
                    placeholder="e.g., 22"
                    data-testid="input-edit-evidence-type"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="edit-note">Note</Label>
                  <Input
                    id="edit-note"
                    value={editSpareForm.note}
                    onChange={(e) => setEditSpareForm({...editSpareForm, note: e.target.value})}
                    placeholder="e.g., Sample-XX-YY-0006"
                    data-testid="input-edit-note"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} data-testid="button-cancel-edit">
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
              <Button 
                onClick={handleEditSpareSubmit}
                disabled={updateSpareMutation?.isPending}
                className="bg-[#52baf3] hover:bg-[#40a8e0]"
                data-testid="button-save-edit"
              >
                {updateSpareMutation?.isPending ? "Saving..." : "Save Changes"}
              </Button>
            )}
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
                      qtyA: "", 
                      qtyB: "",
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
                      qtyA: "",
                      qtyB: "", 
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
            <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
              <div className="text-xs font-medium text-gray-500">Quantity to Consume by Location</div>
              <div>
                <Label htmlFor="consume-qty-a">{selectedSpare?.location || 'Location A'} (Available: {selectedSpare?.robLocationA ?? 0})</Label>
                <Input
                  id="consume-qty-a"
                  data-testid="input-consume-qty-a"
                  type="number"
                  min="0"
                  max={selectedSpare?.robLocationA ?? 0}
                  value={consumeForm.qtyA || ''}
                  onChange={(e) => setConsumeForm({...consumeForm, qtyA: e.target.value})}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="consume-qty-b">{selectedSpare?.location2 || 'Location B'} (Available: {selectedSpare?.robLocationB ?? 0})</Label>
                <Input
                  id="consume-qty-b"
                  data-testid="input-consume-qty-b"
                  type="number"
                  min="0"
                  max={selectedSpare?.robLocationB ?? 0}
                  value={consumeForm.qtyB || ''}
                  onChange={(e) => setConsumeForm({...consumeForm, qtyB: e.target.value})}
                  placeholder="0"
                />
              </div>
              <div className="text-xs text-gray-500 text-center border-t pt-2">
                Total to Consume: {(parseInt(consumeForm.qtyA || '0') || 0) + (parseInt(consumeForm.qtyB || '0') || 0)}
              </div>
            </div>
            <div>
              <Label htmlFor="consume-date">Date *</Label>
              <Input
                id="consume-date"
                data-testid="input-consume-date"
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
                data-testid="input-consume-workorder"
                value={consumeForm.workOrder}
                onChange={(e) => setConsumeForm({...consumeForm, workOrder: e.target.value})}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="consume-remarks">Remarks</Label>
              <Input
                id="consume-remarks"
                data-testid="input-consume-remarks"
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
            <Button data-testid="button-consume-save" onClick={handleConsumeSubmit} disabled={consumeSpareMutation.isPending}>
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
            <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
              <div className="text-xs font-medium text-gray-500">Quantity to Receive by Location</div>
              <div>
                <Label htmlFor="receive-qty-a">{selectedSpare?.location || 'Location A'} (Current: {selectedSpare?.robLocationA ?? 0})</Label>
                <Input
                  id="receive-qty-a"
                  data-testid="input-receive-qty-a"
                  type="number"
                  min="0"
                  value={receiveForm.qtyA || ''}
                  onChange={(e) => setReceiveForm({...receiveForm, qtyA: e.target.value})}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="receive-qty-b">{selectedSpare?.location2 || 'Location B'} (Current: {selectedSpare?.robLocationB ?? 0})</Label>
                <Input
                  id="receive-qty-b"
                  data-testid="input-receive-qty-b"
                  type="number"
                  min="0"
                  value={receiveForm.qtyB || ''}
                  onChange={(e) => setReceiveForm({...receiveForm, qtyB: e.target.value})}
                  placeholder="0"
                />
              </div>
              <div className="text-xs text-gray-500 text-center border-t pt-2">
                Total to Receive: {(parseInt(receiveForm.qtyA || '0') || 0) + (parseInt(receiveForm.qtyB || '0') || 0)}
              </div>
            </div>
            <div>
              <Label htmlFor="receive-date">Date *</Label>
              <Input
                id="receive-date"
                data-testid="input-receive-date"
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
                data-testid="input-receive-supplier"
                value={receiveForm.supplier}
                onChange={(e) => setReceiveForm({...receiveForm, supplier: e.target.value})}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="receive-remarks">Remarks</Label>
              <Input
                id="receive-remarks"
                data-testid="input-receive-remarks"
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
            <Button data-testid="button-receive-save" onClick={handleReceiveSubmit} disabled={receiveSpareMutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjustment Modal - For audit-compliant ROB adjustments */}
      <Dialog open={isAdjustModalOpen} onOpenChange={setIsAdjustModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-orange-500" />
              Adjust Spare ROB
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Part: {selectedSpare?.partCode} - {selectedSpare?.partName}</Label>
              <p className="text-sm text-gray-500">Current Total ROB: {selectedSpare?.rob}</p>
            </div>
            <div className="border rounded-lg p-3 space-y-3 bg-orange-50">
              <div className="text-xs font-medium text-gray-500">Adjustment Details</div>
              <div>
                <Label htmlFor="adjust-location">Location *</Label>
                <Select 
                  value={adjustForm.location} 
                  onValueChange={(value: "A" | "B") => {
                    setAdjustForm({
                      ...adjustForm, 
                      location: value,
                      newRob: String(value === 'A' ? (selectedSpare?.robLocationA ?? 0) : (selectedSpare?.robLocationB ?? 0))
                    });
                  }}
                >
                  <SelectTrigger data-testid="select-adjust-location">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">{selectedSpare?.location || 'Location A'} (Current: {selectedSpare?.robLocationA ?? 0})</SelectItem>
                    <SelectItem value="B">{selectedSpare?.location2 || 'Location B'} (Current: {selectedSpare?.robLocationB ?? 0})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="adjust-new-rob">New ROB *</Label>
                <Input
                  id="adjust-new-rob"
                  data-testid="input-adjust-new-rob"
                  type="number"
                  min="0"
                  value={adjustForm.newRob}
                  onChange={(e) => setAdjustForm({...adjustForm, newRob: e.target.value})}
                  placeholder="Enter new ROB value"
                />
                {selectedSpare && (() => {
                  const currentRob = adjustForm.location === 'A' 
                    ? (selectedSpare.robLocationA ?? 0) 
                    : (selectedSpare.robLocationB ?? 0);
                  const newRob = parseInt(adjustForm.newRob) || 0;
                  const diff = newRob - currentRob;
                  if (diff !== 0) {
                    return (
                      <p className={`text-xs mt-1 ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        Change: {diff > 0 ? '+' : ''}{diff}
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
            <div>
              <Label htmlFor="adjust-date">Date *</Label>
              <Input
                id="adjust-date"
                data-testid="input-adjust-date"
                type="date"
                value={adjustForm.date}
                onChange={(e) => setAdjustForm({...adjustForm, date: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="adjust-place">Place</Label>
              <Input
                id="adjust-place"
                data-testid="input-adjust-place"
                value={adjustForm.place}
                onChange={(e) => setAdjustForm({...adjustForm, place: e.target.value})}
                placeholder="Optional - e.g., Singapore Port"
              />
            </div>
            <div>
              <Label htmlFor="adjust-remarks">Remarks *</Label>
              <Input
                id="adjust-remarks"
                data-testid="input-adjust-remarks"
                value={adjustForm.remarks}
                onChange={(e) => setAdjustForm({...adjustForm, remarks: e.target.value})}
                placeholder="Reason for adjustment (required for audit)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdjustModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              data-testid="button-adjust-save" 
              onClick={handleAdjustSubmit} 
              disabled={adjustSpareMutation.isPending || !adjustForm.remarks}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {adjustSpareMutation.isPending ? "Saving..." : "Save Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create New Location Dialog */}
      <Dialog 
        open={creatingLocationForSpare !== null} 
        onOpenChange={(open) => { 
          if (!open) { 
            setCreatingLocationForSpare(null); 
            setNewLocationName(''); 
          } 
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="bg-green-500 rounded-md p-1.5">
                <Plus className="h-4 w-4 text-white" />
              </div>
              <DialogTitle className="text-base">Create New Location</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            {creatingLocationForSpare && (
              <div className="text-xs text-gray-500">
                Creating a new location for spare: <span className="font-medium text-gray-700">{creatingLocationForSpare.partCode}</span>
              </div>
            )}
            <div>
              <Label htmlFor="new-location-name" className="text-sm">Location Name</Label>
              <Input
                id="new-location-name"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                placeholder="Enter location name..."
                className="mt-1"
                data-testid="input-new-location-name"
                onKeyDown={(e) => { if (e.key === 'Enter' && newLocationName.trim()) handleCreateNewLocation(); }}
              />
            </div>
            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => { setCreatingLocationForSpare(null); setNewLocationName(''); }}
                data-testid="button-cancel-create-location"
              >
                Cancel
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleCreateNewLocation}
                disabled={!newLocationName.trim() || isCreatingLocation}
                data-testid="button-confirm-create-location"
              >
                {isCreatingLocation ? 'Creating...' : 'Create & Assign'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Location Change Confirmation Dialog */}
      <Dialog
        open={pendingLocationChange !== null}
        onOpenChange={(open) => {
          if (!open) setPendingLocationChange(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="bg-blue-500 rounded-md p-1.5">
                <MapPin className="h-4 w-4 text-white" />
              </div>
              <DialogTitle className="text-base">Confirm Location Change</DialogTitle>
            </div>
          </DialogHeader>
          {pendingLocationChange && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to move stock to a different location?
              </p>
              <div className="bg-muted/50 rounded-md p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Part Code:</span>
                  <span className="font-medium">{pendingLocationChange.spare.partCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quantity:</span>
                  <span className="font-medium">{pendingLocationChange.currentQty} units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">From:</span>
                  <span className="font-medium">{pendingLocationChange.fromName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">To:</span>
                  <span className="font-medium text-blue-600">{pendingLocationChange.newLocationName}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPendingLocationChange(null)}
              data-testid="button-cancel-location-change"
            >
              Cancel
            </Button>
            <Button
              className="bg-blue-600 text-white"
              onClick={executeLocationChange}
              disabled={isChangingLocation}
              data-testid="button-confirm-location-change"
            >
              {isChangingLocation ? 'Moving...' : 'Confirm Move'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inventory Transaction Dialog */}
      <Dialog 
        open={locationDialogSpare !== null} 
        onOpenChange={(open) => { 
          if (!open) { 
            setLocationDialogSpare(null); 
            setOpenLocationDropdown(null);
            setInvLocAPopoverOpen(false);
            setInvLocBPopoverOpen(false);
            setInvLocSearchA('');
            setInvLocSearchB('');
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
          {locationDialogSpare && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-md p-3 space-y-1">
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">Part Name:</span>
                  <span className="text-xs font-medium" data-testid="text-dialog-partname">{locationDialogSpare.partName}</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">Part Code:</span>
                  <span className="text-xs font-medium" data-testid="text-dialog-partcode">{locationDialogSpare.partCode}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="border border-gray-200 rounded-md p-3">
                  <Label className="text-xs font-semibold text-blue-600 mb-1 block" data-testid="label-dialog-location-a">Location A</Label>
                  <Popover open={invLocAPopoverOpen} onOpenChange={setInvLocAPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={invLocAPopoverOpen}
                        className="w-full justify-between font-normal mb-2"
                        data-testid="button-pick-location-a"
                      >
                        <span className="truncate">{editingLocations[locationDialogSpare.id]?.nameA ?? locationDialogSpare.location ?? 'Select location...'}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search locations..." value={invLocSearchA} onValueChange={setInvLocSearchA} data-testid="input-location-search-a" />
                        <CommandList className="max-h-none">
                          <CommandEmpty>No locations found.</CommandEmpty>
                          <div className="max-h-[144px] overflow-y-auto">
                            <CommandGroup heading="Locations" data-testid="list-locations-a">
                              <CommandItem
                                value="none"
                                onSelect={() => {
                                  setEditingLocations(prev => ({
                                    ...prev,
                                    [locationDialogSpare.id]: { ...prev[locationDialogSpare.id], nameA: '' }
                                  }));
                                  setInvLocAPopoverOpen(false);
                                  setInvLocSearchA('');
                                }}
                              >
                                <span className="text-muted-foreground">None</span>
                                {!(editingLocations[locationDialogSpare.id]?.nameA ?? locationDialogSpare.location) && (
                                  <Check className="ml-auto h-4 w-4 flex-shrink-0 text-green-600" />
                                )}
                              </CommandItem>
                              {allVesselLocations.map((loc: any) => (
                                <CommandItem
                                  key={loc.id}
                                  value={loc.locationName}
                                  data-testid={`item-location-a-${loc.id}`}
                                  onSelect={() => {
                                    setEditingLocations(prev => ({
                                      ...prev,
                                      [locationDialogSpare.id]: { ...prev[locationDialogSpare.id], nameA: loc.locationName }
                                    }));
                                    setInvLocAPopoverOpen(false);
                                    setInvLocSearchA('');
                                  }}
                                >
                                  <MapPin className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                  <span className="truncate flex-1">{loc.locationName}</span>
                                  {(editingLocations[locationDialogSpare.id]?.nameA ?? locationDialogSpare.location) === loc.locationName && (
                                    <Check className="ml-2 h-4 w-4 flex-shrink-0 text-green-600" />
                                  )}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </div>
                          <CommandGroup className="border-t" forceMount>
                            <CommandItem
                              onSelect={async () => {
                                const name = invLocSearchA.trim();
                                if (!name) return;
                                try {
                                  const res = await fetch(`/technical/api/inventory/locations/${vesselId}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ locationName: name, createdBy: 'System' }),
                                  });
                                  if (res.ok) {
                                    queryClient.invalidateQueries({ queryKey: [`/technical/api/inventory/locations/${vesselId}`] });
                                    setEditingLocations(prev => ({
                                      ...prev,
                                      [locationDialogSpare.id]: { ...prev[locationDialogSpare.id], nameA: name }
                                    }));
                                    toast({ title: "Location Created", description: `"${name}" created.` });
                                  } else {
                                    toast({ title: "Failed to create location", description: "Please try again.", variant: "destructive" });
                                  }
                                } catch {
                                  toast({ title: "Failed to create location", description: "Network error. Please try again.", variant: "destructive" });
                                }
                                setInvLocAPopoverOpen(false);
                                setInvLocSearchA('');
                              }}
                              data-testid="button-create-new-location-a"
                              forceMount
                            >
                              <Plus className="mr-2 h-4 w-4 text-green-600" />
                              <span className="text-green-600 font-medium">Create New Location</span>
                            </CommandItem>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-gray-500 whitespace-nowrap">ROB:</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editingLocations[locationDialogSpare.id]?.locationA || '0'}
                      onChange={(e) => setEditingLocations(prev => ({
                        ...prev,
                        [locationDialogSpare.id]: { ...prev[locationDialogSpare.id], locationA: e.target.value }
                      }))}
                      className="h-8 text-sm w-24"
                      placeholder="0"
                      data-testid={`input-dialog-locationA-${locationDialogSpare.id}`}
                    />
                  </div>
                </div>

                <div className="border border-gray-200 rounded-md p-3">
                  <Label className="text-xs font-semibold text-blue-600 mb-1 block" data-testid="label-dialog-location-b">Location B</Label>
                  <Popover open={invLocBPopoverOpen} onOpenChange={setInvLocBPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={invLocBPopoverOpen}
                        className="w-full justify-between font-normal mb-2"
                        data-testid="button-pick-location-b"
                      >
                        <span className="truncate">{editingLocations[locationDialogSpare.id]?.nameB ?? locationDialogSpare.location2 ?? 'Select location...'}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search locations..." value={invLocSearchB} onValueChange={setInvLocSearchB} data-testid="input-location-search-b" />
                        <CommandList className="max-h-none">
                          <CommandEmpty>No locations found.</CommandEmpty>
                          <div className="max-h-[144px] overflow-y-auto">
                            <CommandGroup heading="Locations" data-testid="list-locations-b">
                              <CommandItem
                                value="none"
                                onSelect={() => {
                                  setEditingLocations(prev => ({
                                    ...prev,
                                    [locationDialogSpare.id]: { ...prev[locationDialogSpare.id], nameB: '' }
                                  }));
                                  setInvLocBPopoverOpen(false);
                                  setInvLocSearchB('');
                                }}
                              >
                                <span className="text-muted-foreground">None</span>
                                {!(editingLocations[locationDialogSpare.id]?.nameB ?? locationDialogSpare.location2) && (
                                  <Check className="ml-auto h-4 w-4 flex-shrink-0 text-green-600" />
                                )}
                              </CommandItem>
                              {allVesselLocations.map((loc: any) => (
                                <CommandItem
                                  key={loc.id}
                                  value={loc.locationName}
                                  data-testid={`item-location-b-${loc.id}`}
                                  onSelect={() => {
                                    setEditingLocations(prev => ({
                                      ...prev,
                                      [locationDialogSpare.id]: { ...prev[locationDialogSpare.id], nameB: loc.locationName }
                                    }));
                                    setInvLocBPopoverOpen(false);
                                    setInvLocSearchB('');
                                  }}
                                >
                                  <MapPin className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                  <span className="truncate flex-1">{loc.locationName}</span>
                                  {(editingLocations[locationDialogSpare.id]?.nameB ?? locationDialogSpare.location2) === loc.locationName && (
                                    <Check className="ml-2 h-4 w-4 flex-shrink-0 text-green-600" />
                                  )}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </div>
                          <CommandGroup className="border-t" forceMount>
                            <CommandItem
                              onSelect={async () => {
                                const name = invLocSearchB.trim();
                                if (!name) return;
                                try {
                                  const res = await fetch(`/technical/api/inventory/locations/${vesselId}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ locationName: name, createdBy: 'System' }),
                                  });
                                  if (res.ok) {
                                    queryClient.invalidateQueries({ queryKey: [`/technical/api/inventory/locations/${vesselId}`] });
                                    setEditingLocations(prev => ({
                                      ...prev,
                                      [locationDialogSpare.id]: { ...prev[locationDialogSpare.id], nameB: name }
                                    }));
                                    toast({ title: "Location Created", description: `"${name}" created.` });
                                  } else {
                                    toast({ title: "Failed to create location", description: "Please try again.", variant: "destructive" });
                                  }
                                } catch {
                                  toast({ title: "Failed to create location", description: "Network error. Please try again.", variant: "destructive" });
                                }
                                setInvLocBPopoverOpen(false);
                                setInvLocSearchB('');
                              }}
                              data-testid="button-create-new-location-b"
                              forceMount
                            >
                              <Plus className="mr-2 h-4 w-4 text-green-600" />
                              <span className="text-green-600 font-medium">Create New Location</span>
                            </CommandItem>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-gray-500 whitespace-nowrap">ROB:</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editingLocations[locationDialogSpare.id]?.locationB || '0'}
                      onChange={(e) => setEditingLocations(prev => ({
                        ...prev,
                        [locationDialogSpare.id]: { ...prev[locationDialogSpare.id], locationB: e.target.value }
                      }))}
                      className="h-8 text-sm w-24"
                      placeholder="0"
                      data-testid={`input-dialog-locationB-${locationDialogSpare.id}`}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-md p-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Total ROB</span>
                <span className="text-lg font-bold text-gray-800" data-testid="text-dialog-total-rob">
                  {(parseInt(editingLocations[locationDialogSpare.id]?.locationA) || 0) + (parseInt(editingLocations[locationDialogSpare.id]?.locationB) || 0)}
                </span>
              </div>

              <DialogFooter className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setLocationDialogSpare(null);
                    setOpenLocationDropdown(null);
                  }}
                  data-testid="button-dialog-cancel"
                >
                  Cancel
                </Button>
                <Button
                  className="bg-[#52baf3] hover:bg-[#3da8e0] text-white"
                  onClick={() => {
                    handleSaveLocation(locationDialogSpare.id);
                    setLocationDialogSpare(null);
                    setOpenLocationDropdown(null);
                  }}
                  data-testid="button-dialog-save"
                >
                  Save
                </Button>
              </DialogFooter>
            </div>
          )}
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
      
      {/* Export Type Selection Modal */}
      <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Export Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <label className="flex items-center gap-3 p-3 rounded-md border cursor-pointer hover-elevate" data-testid="radio-unique-spare-master">
              <input
                type="radio"
                name="exportType"
                value="unique"
                checked={exportType === "unique"}
                onChange={() => setExportType("unique")}
                className="h-4 w-4 text-blue-600"
              />
              <div>
                <div className="font-medium text-sm">Unique Spare Master Entries</div>
                <div className="text-xs text-muted-foreground">One row per unique Part Code, no duplicates</div>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-md border cursor-pointer hover-elevate" data-testid="radio-component-spare-distribution">
              <input
                type="radio"
                name="exportType"
                value="distribution"
                checked={exportType === "distribution"}
                onChange={() => setExportType("distribution")}
                className="h-4 w-4 text-blue-600"
              />
              <div>
                <div className="font-medium text-sm">Component-Spare Distribution Entries</div>
                <div className="text-xs text-muted-foreground">Expanded rows per component-spare mapping</div>
              </div>
            </label>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsExportModalOpen(false)} data-testid="button-cancel-export">
              Cancel
            </Button>
            <Button onClick={handleExportDownload} data-testid="button-download-export">
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Spare Confirmation Dialog */}
      <Dialog open={showDeactivateDialog} onOpenChange={(open) => { setShowDeactivateDialog(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Deactivate Spare{selectedSpareIds.size > 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              {selectedSpareIds.size === 1 ? (
                <>
                  Are you sure you want to deactivate the selected spare?
                  The spare will be marked as inactive and hidden from Vessel and Head of Department views.
                  This action can be reversed by reactivating the spare.
                </>
              ) : (
                <>
                  Are you sure you want to deactivate <strong>{selectedSpareIds.size}</strong> selected spares?
                  They will be marked as inactive and hidden from Vessel and Head of Department views.
                  This action can be reversed by reactivating the spares.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowDeactivateDialog(false); }} data-testid="button-cancel-deactivate">
              Cancel
            </Button>
            <Button variant="destructive" onClick={executeBulkDeactivate} disabled={bulkDeactivateMutation.isPending} data-testid="button-confirm-deactivate">
              {bulkDeactivateMutation.isPending ? 'Deactivating...' : `Deactivate${selectedSpareIds.size > 1 ? ` (${selectedSpareIds.size})` : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modify Mode Footer */}
      <ModifyStickyFooter
        isVisible={isModifyMode && showModifySubmitFooter}
        hasChanges={originalSpareData !== null && getSpareChangedFields().length > 0}
        changedFieldsCount={getSpareChangedFields().length}
        onCancel={handleCancelModify}
        onSubmitChangeRequest={handleModifySubmit}
        isSubmitting={isSubmittingChangeRequest}
      />
    </div>
  );
};

export default Spares;