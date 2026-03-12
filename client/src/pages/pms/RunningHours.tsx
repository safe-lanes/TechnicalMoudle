import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Search, FileSpreadsheet, Calendar, Users, Settings, Pencil, AlertTriangle, Download, Clock, History, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useModifyMode } from "@/hooks/useModifyMode";
import { ModifyFieldWrapper } from "@/components/modify/ModifyFieldWrapper";
import { ModifyStickyFooter } from "@/components/modify/ModifyStickyFooter";
import { useLocation } from "wouter";
import { formatProfessionalDateTime } from "@/lib/dateUtils";
import { useVessel } from "@/contexts/VesselContext";
import { useUIRole } from "@/contexts/UIRoleContext";
import { useAuth } from "@/contexts/AuthContext";
import { Marker } from "@/components/Marker";
import ZeroRHConfirmationDialog from "@/components/ZeroRHConfirmationDialog";
import MeterReplacedConfirmationDialog from "@/components/MeterReplacedConfirmationDialog";
import { RENEWAL_ACTION_TYPES } from "@shared/schema";

interface ChildRHData {
  id: string;
  componentCode: string;
  name: string;
  currentCumulativeRH: string;
  rhCounterType?: string;
  lastUpdated: string;
}

interface RunningHoursData {
  id: string;
  component: string;
  componentCode?: string;
  sfiCode?: string;
  componentCategory: string;
  runningHours: string;
  lastUpdated: string;
  utilizationRate?: number | null;
  periodRunningHours?: number | null;
  inheritedCount?: number;
  meterReplacedLastRh?: string | null;
  meterReplacedDate?: string | null;
  currentMeterRH?: string;
  lastUpdatedBy?: string | null;
  rhAtPeriodStart?: number | null;
  periodStartDate?: string | null;
  maxPossibleHours?: number | null;
  periodDays?: number | null;
  dataQualityWarning?: string | null;
  averageDailyHours?: number | null;
  currentCumulativeRHRaw?: number | null;
}

const periodLabels: Record<string, string> = {
  weekly: 'Weekly (Last 7 days)',
  monthly: 'Monthly (Last 30 days)',
  quarterly: 'Quarterly (Last 90 days)',
  yearly: 'Yearly (Last 365 days)'
};

const periodShortLabels: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly'
};

const periodTotalHours: Record<string, number> = {
  weekly: 168,
  monthly: 720,
  quarterly: 2160,
  yearly: 8760
};

const periodNoun: Record<string, string> = {
  weekly: 'week',
  monthly: 'month',
  quarterly: 'quarter',
  yearly: 'year'
};

const RunningHours = () => {
  const [, navigate] = useLocation();
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [utilizationPeriod, setUtilizationPeriod] = useState<string>("monthly");
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<RunningHoursData | null>(null);
  
  // Modify mode integration  
  const { isModifyMode, targetId, fieldChanges } = useModifyMode();
  const [updateMode, setUpdateMode] = useState<"setTotal" | "addDelta">("setTotal");
  const [meterReplaced, setMeterReplaced] = useState(false);
  const [updateForm, setUpdateForm] = useState({
    oldValue: "",
    newValue: "",
    dateUpdated: "",
    comments: "",
    oldMeterFinal: "",
    newMeterStart: "0"
  });
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [bulkUpdateMode, setBulkUpdateMode] = useState<"setTotal" | "addDelta">("setTotal");
  const [bulkUpdateData, setBulkUpdateData] = useState<{[key: string]: {
    value: string;
    meterReplaced: boolean;
    oldMeterFinal: string;
    newMeterStart: string;
  }}>({});
  const [bulkUpdateErrors, setBulkUpdateErrors] = useState<{[key: string]: string}>({});
  const [bulkUpdateGlobal, setBulkUpdateGlobal] = useState({
    dateUpdated: new Date().toISOString().split('T')[0],
    comments: ""
  });
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  
  // History view state
  const [activeTab, setActiveTab] = useState<"main" | "history">("main");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyItemsPerPage, setHistoryItemsPerPage] = useState(10);
  const [historySortOrder, setHistorySortOrder] = useState<"asc" | "desc">("desc");
  const [historySearch, setHistorySearch] = useState("");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [historyComponentFilter, setHistoryComponentFilter] = useState("");
  
  // Child RH popup state
  const [isChildRHOpen, setIsChildRHOpen] = useState(false);
  const [selectedParentForChildRH, setSelectedParentForChildRH] = useState<RunningHoursData | null>(null);
  
  // Child RH edit state
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editingChildRH, setEditingChildRH] = useState<string>("");
  const [editingChildComments, setEditingChildComments] = useState<string>("");
  
  // Zero RH Renewal Confirmation Dialog state
  const [isZeroRHDialogOpen, setIsZeroRHDialogOpen] = useState(false);
  const [pendingZeroRHUpdate, setPendingZeroRHUpdate] = useState<{
    componentId: string;
    componentName: string;
    componentCode: string;
    previousRH: number;
    dateUpdated: string;
    dateLocal: string;
    comments: string;
  } | null>(null);
  
  // Meter Replaced Confirmation Dialog state
  const [isMeterReplacedDialogOpen, setIsMeterReplacedDialogOpen] = useState(false);
  const [meterReplacedConfirmation, setMeterReplacedConfirmation] = useState<{
    renewalActionType: typeof RENEWAL_ACTION_TYPES[number];
    renewalReason: string;
    renewalReference?: string;
    renewalEvidenceUrls?: string[];
  } | null>(null);
  
  const { toast } = useToast();
  const { vesselId } = useVessel(); // Get vessel ID from context
  const { isSailAdmin } = useUIRole(); // Get role for visibility control
  
  // Fetch children RH data when popup is open
  const { data: childrenRHData, isLoading: isLoadingChildren } = useQuery<{
    parent: { componentCode: string; name: string; currentCumulativeRH: string };
    children: ChildRHData[];
  }>({
    queryKey: ['/technical/api/running-hours/children', selectedParentForChildRH?.componentCode, vesselId],
    queryFn: async () => {
      const response = await fetch(`/technical/api/running-hours/children/${selectedParentForChildRH?.componentCode}?vesselId=${vesselId}`);
      if (!response.ok) throw new Error('Failed to fetch children RH');
      return response.json();
    },
    enabled: isChildRHOpen && !!selectedParentForChildRH?.componentCode
  });
  
  const openChildRHPopup = (item: RunningHoursData) => {
    setSelectedParentForChildRH(item);
    setIsChildRHOpen(true);
  };
  
  // Fetch parent components with RH-based child jobs
  const { data: rawRunningHoursData = [], isLoading: isLoadingParents, refetch } = useQuery<any[]>({
    queryKey: ['/technical/api/running-hours/parents', vesselId, utilizationPeriod],
    queryFn: async () => {
      const response = await fetch(`/technical/api/running-hours/parents?vesselId=${vesselId}&period=${utilizationPeriod}`);
      if (!response.ok) throw new Error('Failed to fetch running hour parents');
      return response.json();
    },
    enabled: true
  });

  // Map API data to display format
  const runningHoursData: RunningHoursData[] = Array.isArray(rawRunningHoursData) ? rawRunningHoursData.map((parent: any) => ({
    id: parent.id,
    component: parent.name || '',
    componentCode: parent.componentCode || '',
    sfiCode: parent.sfiCode || '',
    componentCategory: parent.category || '',
    runningHours: `${parseFloat(parent.currentCumulativeRH || '0').toLocaleString()} hrs`,
    lastUpdated: formatProfessionalDateTime(parent.latestUpdate || parent.lastUpdated),
    utilizationRate: parent.utilizationRate ?? 0,
    periodRunningHours: parent.periodRunningHours ?? 0,
    inheritedCount: parent.inheritedCount || 0,
    meterReplacedLastRh: parent.meterReplacedLastRh || null,
    meterReplacedDate: parent.meterReplacedDate || null,
    currentMeterRH: parent.currentMeterRH || '0',
    lastUpdatedBy: parent.lastUpdatedBy || null,
    rhAtPeriodStart: parent.rhAtPeriodStart ?? null,
    periodStartDate: parent.periodStartDate ?? null,
    maxPossibleHours: parent.maxPossibleHours ?? null,
    periodDays: parent.periodDays ?? null,
    dataQualityWarning: parent.dataQualityWarning ?? null,
    averageDailyHours: parent.averageDailyHours ?? null,
    currentCumulativeRHRaw: parseFloat(parent.currentCumulativeRH || '0')
  })) : [];

  const filteredRunningHoursData = runningHoursData.filter(item =>
    !searchTerm || item.component.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Fetch running hours history
  const { data: historyResult, isLoading: isLoadingHistory } = useQuery<{
    data: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: ['/technical/api/running-hours/history', vesselId, historyPage, historyItemsPerPage, historySortOrder, historySearch, historyDateFrom, historyDateTo, historyComponentFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        vesselId: vesselId || '',
        page: String(historyPage),
        pageSize: String(historyItemsPerPage),
        sortOrder: historySortOrder,
      });
      if (historySearch) params.set('search', historySearch);
      if (historyDateFrom) params.set('dateFrom', historyDateFrom);
      if (historyDateTo) params.set('dateTo', historyDateTo);
      if (historyComponentFilter) params.set('componentId', historyComponentFilter);
      const response = await fetch(`/technical/api/running-hours/history?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json();
    },
    enabled: activeTab === 'history'
  });

  useEffect(() => {
    setHistoryPage(1);
  }, [historyItemsPerPage, historySearch, historyDateFrom, historyDateTo, historyComponentFilter, vesselId]);

  const goToHistoryPage = (page: number) => {
    const totalPages = historyResult?.totalPages || 1;
    const p = Math.max(1, Math.min(page, totalPages));
    setHistoryPage(p);
  };

  const exportHistoryToCSV = () => {
    const params = new URLSearchParams({
      vesselId: vesselId || '',
      sortOrder: historySortOrder,
    });
    if (historySearch) params.set('search', historySearch);
    if (historyDateFrom) params.set('dateFrom', historyDateFrom);
    if (historyDateTo) params.set('dateTo', historyDateTo);
    if (historyComponentFilter) params.set('componentId', historyComponentFilter);
    window.open(`/technical/api/running-hours/history/export?${params.toString()}`, '_blank');
  };

  const clearHistoryFilters = () => {
    setHistorySearch("");
    setHistoryDateFrom("");
    setHistoryDateTo("");
    setHistoryComponentFilter("");
    setHistoryPage(1);
  };

  const formatHistoryDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
        date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return '-'; }
  };

  const getSourceBadgeStyle = (source: string) => {
    switch (source?.toLowerCase()) {
      case 'manual': return 'bg-blue-100 text-blue-800';
      case 'cascade': return 'bg-purple-100 text-purple-800';
      case 'bulk_import': return 'bg-orange-100 text-orange-800';
      case 'work_order': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Cascade update mutation
  const cascadeUpdateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/technical/api/running-hours/cascade', data);
    },
    onSuccess: () => {
      // Invalidate all related queries with refetchType 'all' to force refetch even inactive queries
      queryClient.invalidateQueries({ queryKey: ['/technical/api/running-hours/parents'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/rh-config'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/components'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/rh-config/master-components'], refetchType: 'all' });
      toast({ title: "Success", description: "Running hours updated successfully" });
      setIsUpdateDialogOpen(false);
      handleCancelUpdate();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update running hours",
        variant: "destructive"
      });
    }
  });

  // Mutation for bulk update - calls cascade endpoint for each component
  const bulkUpdateRunningHours = useMutation({
    mutationFn: async (updates: any[]) => {
      const promises = updates.map(update => 
        apiRequest('POST', '/technical/api/running-hours/cascade', {
          parentComponentId: update.componentId,
          mode: update.mode,
          value: update.value,
          dateUpdated: update.dateUpdated,
          comments: update.comments || '',
          userId: currentUser?.fullName || currentUser?.username || 'system',
          meterReplaced: update.meterReplaced,
          oldMeterFinal: update.oldMeterFinal,
          newMeterStart: update.newMeterStart
        })
      );
      return await Promise.all(promises);
    },
    onSuccess: () => {
      // Invalidate all related queries with refetchType 'all' to force refetch even inactive queries
      queryClient.invalidateQueries({ queryKey: ['/technical/api/running-hours/parents'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/rh-config'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/components'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/rh-config/master-components'], refetchType: 'all' });
      toast({
        title: "Success",
        description: "Bulk update completed successfully",
      });
      setIsBulkUpdateOpen(false);
      setBulkUpdateData({});
      setBulkUpdateErrors({});
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to perform bulk update",
        variant: "destructive",
      });
    },
  });

  // Mutation for updating individual child component RH
  const updateChildRHMutation = useMutation({
    mutationFn: async (data: { componentId: string; newRHValue: number; comments?: string }) => {
      return await apiRequest('PUT', `/technical/api/running-hours/child/${data.componentId}`, {
        newRHValue: data.newRHValue,
        comments: data.comments || '',
        userId: currentUser?.fullName || currentUser?.username || 'system'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/running-hours/children'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/components'], refetchType: 'all' });
      toast({ title: "Success", description: "Child running hours updated successfully" });
      setEditingChildId(null);
      setEditingChildRH("");
      setEditingChildComments("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update child running hours",
        variant: "destructive"
      });
    }
  });

  // Start editing a child component
  const startEditingChild = (child: ChildRHData) => {
    setEditingChildId(child.id);
    setEditingChildRH(child.currentCumulativeRH || "0");
    setEditingChildComments("");
  };

  // Cancel editing
  const cancelEditingChild = () => {
    setEditingChildId(null);
    setEditingChildRH("");
    setEditingChildComments("");
  };

  // Save child RH edit
  const saveChildRHEdit = () => {
    if (!editingChildId) return;
    
    const newValue = parseFloat(editingChildRH.replace(/,/g, ''));
    if (isNaN(newValue) || newValue < 0) {
      toast({
        title: "Error",
        description: "Please enter a valid positive number for running hours",
        variant: "destructive"
      });
      return;
    }
    
    // Note: RH = 0 validation popup does NOT apply to inherited components
    // Inherited components can be edited freely including setting to 0
    // The zero RH renewal confirmation is only for MASTER components
    
    updateChildRHMutation.mutate({
      componentId: editingChildId,
      newRHValue: newValue,
      comments: editingChildComments
    });
  };

  const clearFilters = () => {
    setSearchTerm("");
  };

  // Export to CSV function
  const exportToCSV = () => {
    // Prepare CSV headers
    const headers = [
      "Vessel",
      "Component",
      "Component Code",
      "Component Category",
      "Running Hours (cumulative)",
      "Last Updated (local)",
      `Utilization Rate % (${periodShortLabels[utilizationPeriod] || 'Monthly'})`,
      `Period Running Hours (${periodShortLabels[utilizationPeriod] || 'Monthly'})`,
      "Last Updated By",
      "Notes"
    ];

    const rows = filteredRunningHoursData.map(item => [
      vesselId,
      item.component,
      item.componentCode || "",
      item.componentCategory,
      item.runningHours.replace(" hrs", ""),
      item.lastUpdated,
      `${(item.utilizationRate ?? 0).toFixed(1)}%`,
      `${(item.periodRunningHours ?? 0)}`,
      item.lastUpdatedBy || "",
      ""
    ]);

    // Convert to CSV format
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const now = new Date();
    const filename = `running-hours_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.csv`;
    
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    
    toast({
      title: "Export Complete",
      description: `Exported ${filteredRunningHoursData.length} records to ${filename}`,
    });
  };

  const openUpdateDialog = (component: RunningHoursData) => {
    setSelectedComponent(component);
    
    // Check if component has had meter replacement
    const hasMeterReplacement = component.meterReplacedLastRh && parseFloat(component.meterReplacedLastRh) > 0;
    
    // For components with meter replacement, show the current meter reading (not the total)
    // Old value = current meter reading on the NEW meter
    const oldValueToShow = hasMeterReplacement 
      ? (component.currentMeterRH || '0')
      : component.runningHours.replace(" hrs", "").replace(/,/g, "");
    
    setUpdateForm({
      oldValue: oldValueToShow,
      newValue: "",
      dateUpdated: "",
      comments: "",
      oldMeterFinal: "",
      newMeterStart: "0"
    });
    setUpdateMode("setTotal");
    setMeterReplaced(false);
    setIsUpdateDialogOpen(true);
  };

  const handleUpdateFormChange = (field: string, value: string) => {
    setUpdateForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveUpdate = () => {
    if (!selectedComponent) return;
    
    if (individualValidationError) return;
    
    // Validate date is provided
    if (!updateForm.dateUpdated || updateForm.dateUpdated.trim() === "") {
      toast({
        title: "Error",
        description: "Date is required. Please select a date.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate date not in future
    const selectedDate = new Date(updateForm.dateUpdated);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    if (selectedDate > today) {
      toast({
        title: "Error",
        description: "Date cannot be in the future",
        variant: "destructive",
      });
      return;
    }
    
    // Validate meter replacement confirmation when meter replaced checkbox is checked
    if (meterReplaced && !meterReplacedConfirmation) {
      toast({
        title: "Error",
        description: "Meter replacement confirmation is required. Please complete the confirmation dialog.",
        variant: "destructive",
      });
      setIsMeterReplacedDialogOpen(true);
      return;
    }
    
    // Validate mandatory fields for meter replacement (per requirements)
    if (meterReplaced) {
      if (!updateForm.oldMeterFinal || updateForm.oldMeterFinal.trim() === "") {
        toast({
          title: "Error",
          description: "Old Meter Final reading is required for meter replacement.",
          variant: "destructive",
        });
        return;
      }
      // Date is already validated above, but it's also mandatory for meter replacement
    }
    
    // Format date in vessel local time
    const dateLocal = selectedDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) + ' ' + selectedDate.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const newValue = parseFloat(updateForm.newValue);
    const previousRH = parseFloat(updateForm.oldValue.replace(/,/g, ''));
    
    // Check if user is trying to set RH to 0 - require confirmation
    if (updateMode === 'setTotal' && newValue === 0) {
      setPendingZeroRHUpdate({
        componentId: selectedComponent.id,
        componentName: selectedComponent.component,
        componentCode: selectedComponent.componentCode || '',
        previousRH: previousRH,
        dateUpdated: updateForm.dateUpdated,
        dateLocal: dateLocal,
        comments: updateForm.comments,
      });
      setIsZeroRHDialogOpen(true);
      return;
    }
    
    cascadeUpdateMutation.mutate({
      parentComponentId: selectedComponent.id,
      mode: updateMode,
      value: newValue,
      dateUpdated: dateLocal,
      comments: updateForm.comments,
      userId: currentUser?.fullName || currentUser?.username || 'system',
      meterReplaced,
      oldMeterFinal: meterReplaced ? updateForm.oldMeterFinal : undefined,
      newMeterStart: meterReplaced ? updateForm.newMeterStart : undefined,
      renewalActionType: meterReplaced && meterReplacedConfirmation ? meterReplacedConfirmation.renewalActionType : undefined,
      renewalReason: meterReplaced && meterReplacedConfirmation ? meterReplacedConfirmation.renewalReason : undefined,
      renewalReference: meterReplaced && meterReplacedConfirmation ? meterReplacedConfirmation.renewalReference : undefined,
      renewalEvidenceUrls: meterReplaced && meterReplacedConfirmation ? meterReplacedConfirmation.renewalEvidenceUrls : undefined,
    });
  };
  
  // Handle confirmation from Zero RH Dialog
  const handleZeroRHConfirm = (renewalData: {
    renewalActionType: typeof RENEWAL_ACTION_TYPES[number];
    renewalReason: string;
    renewalReference?: string;
    renewalEvidenceUrls?: string[];
  }) => {
    if (!pendingZeroRHUpdate) return;
    
    cascadeUpdateMutation.mutate({
      parentComponentId: pendingZeroRHUpdate.componentId,
      mode: 'setTotal',
      value: 0,
      dateUpdated: pendingZeroRHUpdate.dateLocal,
      comments: pendingZeroRHUpdate.comments,
      userId: currentUser?.fullName || currentUser?.username || 'system',
      meterReplaced: true,
      isRenewalReset: true,
      renewalActionType: renewalData.renewalActionType,
      renewalReason: renewalData.renewalReason,
      renewalReference: renewalData.renewalReference,
      renewalEvidenceUrls: renewalData.renewalEvidenceUrls,
    });
    
    setPendingZeroRHUpdate(null);
  };
  
  // Handle cancel from Zero RH Dialog - restore input
  const handleZeroRHCancel = () => {
    setIsZeroRHDialogOpen(false);
    setPendingZeroRHUpdate(null);
    // Keep the dialog open so user can change the value
  };

  const handleCancelUpdate = () => {
    setIsUpdateDialogOpen(false);
    setSelectedComponent(null);
    setUpdateForm({
      oldValue: "",
      newValue: "",
      dateUpdated: "",
      comments: "",
      oldMeterFinal: "",
      newMeterStart: "0"
    });
    setUpdateMode("setTotal");
    setMeterReplaced(false);
    setMeterReplacedConfirmation(null);
  };
  
  // Handler for meter replaced checkbox - opens confirmation dialog immediately
  const handleMeterReplacedChange = (checked: boolean) => {
    if (checked) {
      setIsMeterReplacedDialogOpen(true);
    } else {
      setMeterReplaced(false);
      setMeterReplacedConfirmation(null);
    }
  };
  
  // Handler for meter replacement confirmation dialog confirm
  const handleMeterReplacedConfirm = (data: {
    renewalActionType: typeof RENEWAL_ACTION_TYPES[number];
    renewalReason: string;
    renewalReference?: string;
    renewalEvidenceUrls?: string[];
  }) => {
    setMeterReplacedConfirmation(data);
    setMeterReplaced(true);
    setIsMeterReplacedDialogOpen(false);
  };
  
  // Handler for meter replacement confirmation dialog cancel
  const handleMeterReplacedCancel = () => {
    setIsMeterReplacedDialogOpen(false);
    setMeterReplaced(false);
    setMeterReplacedConfirmation(null);
  };

  const openBulkUpdate = () => {
    setBulkUpdateData({});
    setBulkUpdateErrors({});
    setBulkUpdateMode("setTotal");
    setBulkUpdateGlobal({
      dateUpdated: new Date().toISOString().split('T')[0],
      comments: ""
    });
    setIsBulkUpdateOpen(true);
  };

  const isBulkUpdateDirty = (() => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (bulkUpdateGlobal.comments.trim() !== "") return true;
    if (bulkUpdateGlobal.dateUpdated !== todayStr) return true;
    for (const key of Object.keys(bulkUpdateData)) {
      const row = bulkUpdateData[key];
      if (row.value && row.value.trim() !== "") return true;
      if (row.meterReplaced) return true;
    }
    return false;
  })();

  const handleBulkUpdateClose = () => {
    if (isBulkUpdateDirty) {
      setShowDiscardConfirm(true);
    } else {
      setIsBulkUpdateOpen(false);
    }
  };

  const handleDiscardChanges = () => {
    setShowDiscardConfirm(false);
    setIsBulkUpdateOpen(false);
    setBulkUpdateData({});
    setBulkUpdateErrors({});
    setBulkUpdateMode("setTotal");
    setBulkUpdateGlobal({
      dateUpdated: new Date().toISOString().split('T')[0],
      comments: ""
    });
  };

  const handleKeepEditing = () => {
    setShowDiscardConfirm(false);
  };

  const handleBulkUpdateChange = (componentId: string, field: string, value: any) => {
    if (field === 'meterReplaced' && value === true) {
      const component = runningHoursData.find(c => c.id === componentId);
      const hasPriorReplacement = component?.meterReplacedLastRh && parseFloat(component.meterReplacedLastRh) > 0;
      const currentRH = component 
        ? (hasPriorReplacement 
            ? (component.currentMeterRH || '0')
            : component.runningHours.replace(" hrs", "").replace(/,/g, ""))
        : "";
      setBulkUpdateData(prev => ({
        ...prev,
        [componentId]: {
          ...prev[componentId],
          meterReplaced: true,
          oldMeterFinal: currentRH,
          newMeterStart: prev[componentId]?.newMeterStart || "0"
        }
      }));
    } else if (field === 'meterReplaced' && value === false) {
      setBulkUpdateData(prev => ({
        ...prev,
        [componentId]: {
          ...prev[componentId],
          meterReplaced: false,
          oldMeterFinal: "",
          newMeterStart: "0"
        }
      }));
    } else {
      setBulkUpdateData(prev => ({
        ...prev,
        [componentId]: {
          ...prev[componentId],
          [field]: value
        }
      }));
    }
    if (bulkUpdateErrors[componentId] && field === 'value') {
      setBulkUpdateErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[componentId];
        return newErrors;
      });
    }
  };

  const getIndividualValidationError = (): string | null => {
    if (!updateForm.newValue || updateForm.newValue.trim() === "") return null;
    const newVal = parseFloat(updateForm.newValue);
    if (isNaN(newVal)) return null;
    if (updateMode === "setTotal") {
      if (!meterReplaced) {
        const currentRH = parseFloat(updateForm.oldValue.replace(/,/g, ''));
        if (!isNaN(currentRH) && newVal < currentRH) {
          return `New value cannot be less than current running hours (${currentRH.toLocaleString()} hrs). Use 'Meter Replaced' if the meter was reset.`;
        }
      }
    } else if (updateMode === "addDelta") {
      if (newVal <= 0) {
        return "Delta value must be a positive number. Running hours can only increase.";
      }
    }
    return null;
  };

  const getBulkRowValidationError = (componentId: string): string | null => {
    const updateData = bulkUpdateData[componentId];
    if (!updateData || !updateData.value || updateData.value.trim() === "") return null;
    const inputValue = parseFloat(updateData.value.replace(/,/g, ''));
    if (isNaN(inputValue)) return null;
    if (bulkUpdateMode === "setTotal") {
      if (!updateData.meterReplaced) {
        const component = runningHoursData.find(c => c.id === componentId);
        if (component) {
          const currentRH = parseFloat(component.runningHours.replace(" hrs", "").replace(/,/g, ""));
          if (!isNaN(currentRH) && inputValue < currentRH) {
            return `New value cannot be less than current running hours (${currentRH.toLocaleString()} hrs). Use 'Meter Replaced' if the meter was reset.`;
          }
        }
      }
    } else if (bulkUpdateMode === "addDelta") {
      if (inputValue <= 0) {
        return "Delta value must be a positive number. Running hours can only increase.";
      }
    }
    return null;
  };

  const individualValidationError = getIndividualValidationError();

  const hasBulkValidationErrors = runningHoursData.some(item => getBulkRowValidationError(item.id) !== null);

  const handleBulkSave = () => {
    if (hasBulkValidationErrors) return;
    
    const errors: {[key: string]: string} = {};
    const updates = [];
    
    // Validate global date
    if (!bulkUpdateGlobal.dateUpdated) {
      toast({
        title: "Date Required",
        description: "Please select the date when running hours were updated",
        variant: "destructive"
      });
      return;
    }
    
    // Parse user-selected date and format it
    const selectedDate = new Date(bulkUpdateGlobal.dateUpdated);
    selectedDate.setHours(23, 59, 59, 999);
    
    const dateLocal = selectedDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) + ' ' + selectedDate.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    // Process each component with updates
    for (const component of runningHoursData) {
      const updateData = bulkUpdateData[component.id];
      if (!updateData || !updateData.value || updateData.value.trim() === "") continue;
      
      // Validate numeric input
      const inputValue = parseFloat(updateData.value.replace(/,/g, ''));
      if (isNaN(inputValue)) {
        errors[component.id] = "Please enter a valid number";
        continue;
      }
      
      // Block zero values in bulk update - must use individual update with renewal confirmation
      if (bulkUpdateMode === 'setTotal' && inputValue === 0) {
        errors[component.id] = "Cannot set RH to 0 in bulk update. Use individual update for renewal/replacement.";
        continue;
      }
      
      if (bulkUpdateMode === 'setTotal' && !updateData.meterReplaced) {
        const currentRH = parseFloat(component.runningHours.replace(" hrs", "").replace(/,/g, ""));
        if (!isNaN(currentRH) && inputValue < currentRH) {
          errors[component.id] = `New value cannot be less than current running hours (${currentRH.toLocaleString()} hrs).`;
          continue;
        }
      }
      
      if (bulkUpdateMode === 'addDelta' && inputValue <= 0) {
        errors[component.id] = "Delta value must be a positive number.";
        continue;
      }
      
      updates.push({
        componentId: component.id,
        mode: bulkUpdateMode,
        value: inputValue,
        dateUpdated: dateLocal,
        comments: bulkUpdateGlobal.comments,
        meterReplaced: updateData.meterReplaced || false,
        oldMeterFinal: updateData.meterReplaced ? updateData.oldMeterFinal : undefined,
        newMeterStart: updateData.meterReplaced ? updateData.newMeterStart : undefined
      });
    }
    
    if (Object.keys(errors).length > 0) {
      setBulkUpdateErrors(errors);
      return;
    }
    
    if (updates.length === 0) {
      toast({
        title: "No changes",
        description: "No values were entered for update",
      });
      return;
    }
    
    bulkUpdateRunningHours.mutate(updates);
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header - Fixed */}
      <div className="flex-shrink-0 space-y-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900" data-testid="D1"><Marker id="D1" />Running Hours</h1>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1" data-testid="rh-tab-switcher">
              <button
                onClick={() => setActiveTab("main")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'main' ? 'bg-[#52baf3] text-white' : 'text-gray-700 hover:bg-gray-200'}`}
                data-testid="tab-main"
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'history' ? 'bg-[#52baf3] text-white' : 'text-gray-700 hover:bg-gray-200'}`}
                data-testid="tab-history"
              >
                <History className="h-3.5 w-3.5" />
                History
              </button>
            </div>
          </div>
          {activeTab === 'main' && (
            <Button 
              className="bg-[#5dc86f] hover:bg-[#4db85f] text-white"
              onClick={openBulkUpdate}
              data-testid="D5"
            >
              <Marker id="D5" /><span className="mr-2">+</span>
              Bulk Update RH
            </Button>
          )}
        </div>

        {/* Search and Export Row - Main Tab */}
        {activeTab === 'main' && (
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md" data-testid="D2">
              <Marker id="D2" />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search Component"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex items-center gap-2" data-testid="utilization-period-selector">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600 whitespace-nowrap">Utilization Period:</span>
              <Select value={utilizationPeriod} onValueChange={setUtilizationPeriod}>
                <SelectTrigger className="w-[220px] h-9" data-testid="select-utilization-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly" data-testid="period-weekly">Weekly (Last 7 days)</SelectItem>
                  <SelectItem value="monthly" data-testid="period-monthly">Monthly (Last 30 days)</SelectItem>
                  <SelectItem value="quarterly" data-testid="period-quarterly">Quarterly (Last 90 days)</SelectItem>
                  <SelectItem value="yearly" data-testid="period-yearly">Yearly (Last 365 days)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" size="sm" className="text-xs text-[#8798ad] border-[#e1e8ed]" onClick={exportToCSV} data-testid="D3">
              <Marker id="D3" /><Download className="h-3.5 w-3.5 mr-1" />
              Export
            </Button>

            <Button variant="outline" onClick={clearFilters} className="flex items-center gap-2" data-testid="D4">
              <Marker id="D4" />Clear
            </Button>
          </div>
        )}

        {/* Search and Filter Row - History Tab */}
        {activeTab === 'history' && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs" data-testid="history-search-wrapper">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by component, user, source..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="pl-10 h-9"
                data-testid="input-history-search"
              />
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <Input
                type="date"
                value={historyDateFrom}
                onChange={(e) => setHistoryDateFrom(e.target.value)}
                className="h-9 w-[140px] text-sm"
                placeholder="From"
                data-testid="input-history-date-from"
              />
              <span className="text-gray-400 text-sm">to</span>
              <Input
                type="date"
                value={historyDateTo}
                onChange={(e) => setHistoryDateTo(e.target.value)}
                className="h-9 w-[140px] text-sm"
                placeholder="To"
                data-testid="input-history-date-to"
              />
            </div>

            <Select value={historyComponentFilter || "all"} onValueChange={(val) => setHistoryComponentFilter(val === "all" ? "" : val)}>
              <SelectTrigger className="w-[200px] h-9" data-testid="select-history-component">
                <SelectValue placeholder="All Components" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Components</SelectItem>
                {runningHoursData.map(item => (
                  <SelectItem key={item.id} value={item.id}>{item.component}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" className="text-xs text-[#8798ad] border-[#e1e8ed] h-9" onClick={exportHistoryToCSV} data-testid="button-export-history">
              <Download className="h-3.5 w-3.5 mr-1" />
              Export CSV
            </Button>

            <Button variant="outline" size="sm" onClick={clearHistoryFilters} className="h-9" data-testid="button-clear-history-filters">
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-lg border border-gray-200">
          {/* History Table Header */}
          <div className="bg-[#52baf3] text-white px-4 py-3 flex-shrink-0">
            <div className="grid grid-cols-7 gap-4 text-sm font-medium">
              <div
                className="flex items-center gap-1 cursor-pointer select-none"
                onClick={() => setHistorySortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                data-testid="header-sort-date"
              >
                Date/Time
                <ArrowUpDown className="h-3.5 w-3.5" />
              </div>
              <div>Component Code</div>
              <div className="text-right">Previous RH</div>
              <div className="text-right">New RH</div>
              <div className="text-right">Change</div>
              <div>Updated By</div>
              <div>Source</div>
            </div>
          </div>

          {/* History Table Body */}
          <div className="overflow-y-auto flex-1">
            {isLoadingHistory ? (
              <div className="p-8 text-center text-gray-500">Loading history...</div>
            ) : !historyResult?.data?.length ? (
              <div className="p-8 text-center text-gray-500">
                No history records found.
                {(historySearch || historyDateFrom || historyDateTo || historyComponentFilter) && (
                  <span> <button onClick={clearHistoryFilters} className="text-blue-600 underline" data-testid="link-clear-history-filters">Clear filters</button></span>
                )}
              </div>
            ) : (
              historyResult.data.map((row: any) => (
                <div key={row.id} className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50" data-testid={`history-row-${row.id}`}>
                  <div className="grid grid-cols-7 gap-4 text-sm items-center">
                    <div className="text-gray-900" data-testid={`history-date-${row.id}`}>
                      {formatHistoryDate(row.updatedAt)}
                    </div>
                    <div className="text-gray-700" data-testid={`history-component-${row.id}`}>
                      {row.componentCode}
                    </div>
                    <div className="text-right text-gray-700" data-testid={`history-prev-rh-${row.id}`}>
                      {parseFloat(row.previousRh || '0').toLocaleString()} hrs
                    </div>
                    <div className="text-right text-gray-900 font-medium" data-testid={`history-new-rh-${row.id}`}>
                      {parseFloat(row.newRh || '0').toLocaleString()} hrs
                    </div>
                    <div className={`text-right font-semibold ${parseFloat(row.deltaRh || '0') < 0 ? 'text-red-600' : parseFloat(row.deltaRh || '0') > 0 ? 'text-green-600' : 'text-gray-400'}`}
                      data-testid={`history-delta-${row.id}`}
                    >
                      {parseFloat(row.deltaRh || '0') > 0 ? '+' : ''}{parseFloat(row.deltaRh || '0').toLocaleString()} hrs
                    </div>
                    <div className="text-gray-700 truncate" title={row.updatedBy} data-testid={`history-user-${row.id}`}>
                      {row.updatedBy || '-'}
                    </div>
                    <div data-testid={`history-source-${row.id}`}>
                      <span className={`px-2 py-1 rounded text-xs ${getSourceBadgeStyle(row.updateSource)}`}>
                        {(row.updateSource || '').toUpperCase()}
                      </span>
                      {row.notes && (
                        <span className="ml-2 text-gray-400 text-xs" title={row.notes}>
                          ({row.notes.length > 20 ? row.notes.slice(0, 20) + '...' : row.notes})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* History Pagination Footer */}
          {historyResult && historyResult.total > 0 && (
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-shrink-0" data-testid="history-pagination-footer">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Show</span>
                <Select value={String(historyItemsPerPage)} onValueChange={(val) => { setHistoryItemsPerPage(Number(val)); setHistoryPage(1); }}>
                  <SelectTrigger className="w-20 h-8" data-testid="select-history-items-per-page">
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
              <div className="flex items-center gap-2 text-sm text-gray-600" data-testid="history-pagination-info">
                <span>
                  Showing {((historyResult.page - 1) * historyResult.pageSize) + 1} - {Math.min(historyResult.page * historyResult.pageSize, historyResult.total)} of {historyResult.total} records
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => goToHistoryPage(1)} disabled={historyResult.page === 1} className="h-8 w-8 p-0" data-testid="history-pagination-first">
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => goToHistoryPage(historyResult.page - 1)} disabled={historyResult.page === 1} className="h-8 w-8 p-0" data-testid="history-pagination-prev">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1 px-2">
                  <span className="text-sm text-gray-600">Page</span>
                  <Input
                    type="number"
                    min={1}
                    max={historyResult.totalPages || 1}
                    value={historyPage}
                    onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) goToHistoryPage(v); }}
                    className="w-14 h-8 text-center"
                    data-testid="input-history-page-number"
                  />
                  <span className="text-sm text-gray-600">of {historyResult.totalPages || 1}</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => goToHistoryPage(historyResult.page + 1)} disabled={historyResult.page >= historyResult.totalPages} className="h-8 w-8 p-0" data-testid="history-pagination-next">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => goToHistoryPage(historyResult.totalPages)} disabled={historyResult.page >= historyResult.totalPages} className="h-8 w-8 p-0" data-testid="history-pagination-last">
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Table - Scrollable */}
      {activeTab === 'main' && (<>
      <div className="flex-1 overflow-y-auto bg-white rounded-lg border border-gray-200">
        {/* Table Header */}
        <div className="bg-[#52baf3] text-white px-4 py-3">
          <div className="grid grid-cols-10 gap-4 text-sm font-medium">
            <div data-testid="D6"><Marker id="D6" />Component Name</div>
            <div data-testid="D7"><Marker id="D7" />Component Code</div>
            <div data-testid="D8"><Marker id="D8" />Component Category</div>
            <div data-testid="D9"><Marker id="D9" />Running Hours</div>
            <div data-testid="D10"><Marker id="D10" />Last Updated</div>
            <div data-testid="D11"><Marker id="D11" />Utilization Rate ({periodShortLabels[utilizationPeriod] || 'Monthly'})</div>
            <div data-testid="D22">Inherited RH</div>
            <div data-testid="D12"><Marker id="D12" />Update RH</div>
            <div data-testid="D24">Last Updated By</div>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-gray-200">
          {isLoadingParents ? (
            <div className="px-4 py-8 text-center text-gray-500">
              Loading running hours data...
            </div>
          ) : (() => {
            if (filteredRunningHoursData.length === 0 && searchTerm) {
              return (
                <div className="px-4 py-8 text-center text-gray-500">
                  No results found. <button onClick={clearFilters} className="text-blue-600 underline">Reset</button>
                </div>
              );
            }
            
            if (filteredRunningHoursData.length === 0) {
              return (
                <div className="px-4 py-8 text-center text-gray-500">
                  No running hours data available
                </div>
              );
            }
            
            return filteredRunningHoursData.map((item, index) => (
              <div key={item.id} className="px-4 py-3 hover:bg-gray-50">
              <div className="grid grid-cols-10 gap-4 text-sm items-center">
                <div className="text-gray-900" data-testid={index === 0 ? "D13" : undefined}>{index === 0 && <Marker id="D13" />}{item.component}</div>
                <div data-testid={index === 0 ? "D14" : undefined}>
                  {index === 0 && <Marker id="D14" />}
                  {item.sfiCode && item.componentCode ? (
                    <button
                      type="button"
                      onClick={() => {
                        sessionStorage.setItem('targetComponentCode', item.componentCode!);
                        navigate('/pms/components');
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 rounded"
                      data-testid={`link-sfi-code-${item.id}`}
                    >
                      {item.sfiCode}
                    </button>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </div>
                <div className="text-gray-700" data-testid={index === 0 ? "D15" : undefined}>{index === 0 && <Marker id="D15" />}{item.componentCategory}</div>
                <div className="text-gray-900 font-medium" data-testid={index === 0 ? "D16" : undefined}>{index === 0 && <Marker id="D16" />}{item.runningHours}</div>
                <div className="text-gray-700" data-testid={index === 0 ? "D17" : undefined}>{index === 0 && <Marker id="D17" />}{item.lastUpdated}</div>
                <div
                  className="flex items-center gap-1"
                  data-testid={index === 0 ? "D18" : undefined}
                >
                  {index === 0 && <Marker id="D18" />}
                  <span
                    className={`font-medium ${
                      (item.utilizationRate ?? 0) === 0 ? 'text-gray-400' :
                      (item.utilizationRate ?? 0) <= 50 ? 'text-green-600' :
                      (item.utilizationRate ?? 0) <= 75 ? 'text-yellow-600' :
                      (item.utilizationRate ?? 0) <= 90 ? 'text-orange-500' :
                      'text-red-600'
                    }`}
                    title={(() => {
                      const rate = item.utilizationRate ?? 0;
                      const periodStart = item.periodStartDate ? new Date(item.periodStartDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                      const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                      const days = item.periodDays ?? 0;
                      const currentRH = item.currentCumulativeRHRaw?.toLocaleString() ?? '0';
                      const rhStart = item.rhAtPeriodStart?.toLocaleString() ?? '0';
                      const rhAccum = item.periodRunningHours ?? 0;
                      const maxHrs = item.maxPossibleHours ?? 0;
                      const avgDaily = item.averageDailyHours ?? 0;
                      const pLabel = periodShortLabels[utilizationPeriod] || 'Monthly';
                      let tooltip = `${pLabel} Utilization: ${rate.toFixed(1)}%\n\nCalculation Details:\n━━━━━━━━━━━━━━━━━━━━━━\nPeriod: ${periodStart} to ${today} (${days} days)\nCurrent RH: ${currentRH} hrs\nRH at Period Start: ${rhStart} hrs\nRH Accumulated: ${rhAccum} hrs\nMaximum Possible: ${maxHrs.toLocaleString()} hrs (${days} days × 24 hrs/day)\n\nFormula: (${rhAccum} / ${maxHrs.toLocaleString()}) × 100 = ${rate.toFixed(1)}%`;
                      if (avgDaily > 0) {
                        tooltip += `\n\nInterpretation: This machinery ran on average ${avgDaily} hours per day over the last ${days} days.`;
                      }
                      if (item.dataQualityWarning) {
                        const warnings: Record<string, string> = {
                          'no_baseline': '⚠️ No audit data before period start — used oldest available entry as baseline.',
                          'no_audit_history': '⚠️ No audit history found — used 0 as baseline.',
                          'meter_reset': '⚠️ Meter reset detected — RH decreased during this period.',
                          'capped_100': '⚠️ Calculated rate exceeded 100% — capped at 100.0%.'
                        };
                        tooltip += `\n\n${warnings[item.dataQualityWarning] || '⚠️ Data quality issue detected.'}`;
                      }
                      return tooltip;
                    })()}
                  >
                    {((item.utilizationRate ?? 0)).toFixed(1)}%
                  </span>
                  {item.dataQualityWarning && (
                    <AlertTriangle
                      className="h-3.5 w-3.5 text-amber-500 flex-shrink-0"
                      title={
                        ({
                          'no_baseline': 'No audit data before period start — used oldest available entry as baseline.',
                          'no_audit_history': 'No audit history found — used 0 as baseline.',
                          'meter_reset': 'Meter reset detected — RH decreased during this period.',
                          'capped_100': 'Calculated rate exceeded 100% — capped at 100.0%.'
                        } as Record<string, string>)[item.dataQualityWarning] || 'Data quality issue detected.'
                      }
                      data-testid={`warning-utilization-${item.id}`}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {item.inheritedCount && item.inheritedCount > 0 ? (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                      onClick={() => openChildRHPopup(item)}
                      title="View Inherited Components"
                      data-testid={index === 0 ? "D23" : `button-inherited-rh-${item.id}`}
                    >
                      <Users className="h-4 w-4 mr-1" />
                      <span className="text-xs font-medium">{item.inheritedCount}</span>
                    </Button>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={() => openUpdateDialog(item)}
                    title="Update Running Hours"
                    data-testid={index === 0 ? "D19" : `button-update-rh-${item.id}`}
                  >
                    {index === 0 && <Marker id="D19" />}<Settings className="h-4 w-4 text-gray-600" />
                  </Button>
                </div>
                <div className="text-gray-700 truncate" title={item.lastUpdatedBy || ''} data-testid={`text-last-updated-by-${item.id}`}>
                  {item.lastUpdatedBy || <span className="text-gray-400">—</span>}
                </div>
              </div>
            </div>
            ));
          })()}
        </div>
      </div>

      {/* Component count footer */}
      <div className="flex justify-start px-4 py-2 text-sm text-gray-400" data-testid="D21">
        <Marker id="D21" />
        {searchTerm
          ? `Showing ${filteredRunningHoursData.length} of ${runningHoursData.length} components`
          : `Showing ${runningHoursData.length} components`}
      </div>
      </>)}

      {/* Update Running Hours Dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#52baf3] border-b border-[#52baf3] pb-2">
              Update Running Hours - {selectedComponent?.component}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Meter Replacement History Info - shown if component has had meter replaced */}
            {selectedComponent?.meterReplacedLastRh && parseFloat(selectedComponent.meterReplacedLastRh) > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 font-medium mb-2">Meter Replacement History</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Previous Total (before replacement):</span>
                    <span className="ml-2 font-medium">{parseFloat(selectedComponent.meterReplacedLastRh).toLocaleString()} hrs</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Current Meter Reading:</span>
                    <span className="ml-2 font-medium">{parseFloat(selectedComponent.currentMeterRH || '0').toLocaleString()} hrs</span>
                  </div>
                </div>
                <div className="mt-1 text-xs text-blue-600">
                  Total Running Hours = {parseFloat(selectedComponent.meterReplacedLastRh).toLocaleString()} + {parseFloat(selectedComponent.currentMeterRH || '0').toLocaleString()} = {(parseFloat(selectedComponent.meterReplacedLastRh) + parseFloat(selectedComponent.currentMeterRH || '0')).toLocaleString()} hrs
                </div>
              </div>
            )}

            {/* Mode Toggle */}
            <div>
              <Label className="text-sm text-gray-600">Mode</Label>
              <RadioGroup value={updateMode} onValueChange={(value: any) => setUpdateMode(value)} className="mt-2">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="setTotal" id="setTotal" />
                    <Label htmlFor="setTotal">Set Total</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="addDelta" id="addDelta" />
                    <Label htmlFor="addDelta">Add Delta</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-600">
                  {selectedComponent?.meterReplacedLastRh && parseFloat(selectedComponent.meterReplacedLastRh) > 0 
                    ? "Current Meter Reading" 
                    : "Old Value"}
                </Label>
                <Input 
                  value={updateForm.oldValue}
                  readOnly
                  className="mt-1 bg-gray-100"
                  data-testid="input-old-value"
                />
              </div>
              <div>
                <Label className="text-sm text-gray-600">
                  {updateMode === "addDelta" ? "Delta Value" : "New Value"}
                </Label>
                <Input 
                  type="number"
                  value={updateForm.newValue}
                  onChange={(e) => handleUpdateFormChange('newValue', e.target.value)}
                  className={`mt-1 ${individualValidationError ? 'border-red-500' : ''}`}
                  placeholder={updateMode === "addDelta" ? "100" : "20000"}
                  data-testid="input-new-value"
                />
                {individualValidationError && (
                  <p className="text-red-500 text-xs mt-1" data-testid="text-validation-error">{individualValidationError}</p>
                )}
              </div>
            </div>
            
            <div>
              <Label className="text-sm text-gray-600">Date Updated</Label>
              <Input 
                type="date"
                value={updateForm.dateUpdated}
                onChange={(e) => handleUpdateFormChange('dateUpdated', e.target.value)}
                className="mt-1"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Meter Replaced Checkbox - Sail Admin only */}
            {isSailAdmin && (
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="meterReplaced"
                  checked={meterReplaced}
                  onCheckedChange={(checked) => handleMeterReplacedChange(checked as boolean)}
                  data-testid="checkbox-meter-replaced"
                />
                <Label htmlFor="meterReplaced" className="text-sm">Meter replaced?</Label>
                {meterReplaced && meterReplacedConfirmation && (
                  <span className="text-xs text-green-600 ml-2">
                    ({meterReplacedConfirmation.renewalActionType})
                  </span>
                )}
              </div>
            )}

            {/* Meter Replacement Fields - Sail Admin only */}
            {isSailAdmin && meterReplaced && (
              <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded">
                <div>
                  <Label className="text-sm text-gray-600">Old Meter Final *</Label>
                  <Input 
                    type="number"
                    value={updateForm.oldMeterFinal}
                    onChange={(e) => handleUpdateFormChange('oldMeterFinal', e.target.value)}
                    className="mt-1"
                    placeholder="Final reading"
                    required
                  />
                </div>
                <div>
                  <Label className="text-sm text-gray-600">New Meter Start *</Label>
                  <Input 
                    type="number"
                    value={updateForm.newMeterStart}
                    onChange={(e) => handleUpdateFormChange('newMeterStart', e.target.value)}
                    className="mt-1"
                    placeholder="0"
                  />
                </div>
              </div>
            )}

            <div>
              <Label className="text-sm text-gray-600">Comments</Label>
              <Textarea 
                value={updateForm.comments}
                onChange={(e) => handleUpdateFormChange('comments', e.target.value)}
                className="mt-1 resize-none"
                rows={3}
                placeholder={meterReplaced ? "Reason for meter replacement" : "Comments"}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleCancelUpdate}>
              Cancel
            </Button>
            <Button 
              className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white" 
              onClick={handleSaveUpdate}
              disabled={!!individualValidationError}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Update Dialog */}
      <Dialog open={isBulkUpdateOpen} onOpenChange={(open) => { if (!open) handleBulkUpdateClose(); }}>
        <DialogContent className="w-[90vw] max-w-none h-[90vh] flex flex-col" onEscapeKeyDown={(e) => { if (showDiscardConfirm) e.preventDefault(); }}>
          <DialogHeader className="pb-4 space-y-3">
            <DialogTitle className="text-[#52baf3] text-xl">
              Bulk Update Running Hours
            </DialogTitle>
            {/* Mode Toggle for Bulk Update */}
            <div className="flex items-center space-x-4">
              <Label className="text-sm text-gray-600">Mode:</Label>
              <RadioGroup value={bulkUpdateMode} onValueChange={(value: any) => setBulkUpdateMode(value)} className="flex flex-row space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="setTotal" id="bulkSetTotal" />
                  <Label htmlFor="bulkSetTotal">Set Total</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="addDelta" id="bulkAddDelta" />
                  <Label htmlFor="bulkAddDelta">Add Delta</Label>
                </div>
              </RadioGroup>
            </div>
            
            {/* Global Date and Comments - applies to all updates */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
              <div>
                <Label className="text-sm text-gray-700 font-medium">Date Updated <span className="text-red-500">*</span></Label>
                <Input 
                  type="date"
                  value={bulkUpdateGlobal.dateUpdated}
                  onChange={(e) => setBulkUpdateGlobal(prev => ({ ...prev, dateUpdated: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                  className="mt-1"
                  data-testid="input-bulk-date"
                />
                <p className="text-xs text-gray-500 mt-1">When were the running hours readings taken?</p>
              </div>
              <div>
                <Label className="text-sm text-gray-700 font-medium">Comments</Label>
                <Input 
                  type="text"
                  value={bulkUpdateGlobal.comments}
                  onChange={(e) => setBulkUpdateGlobal(prev => ({ ...prev, comments: e.target.value }))}
                  placeholder="e.g., Monthly update, After dry dock"
                  className="mt-1"
                  data-testid="input-bulk-comments"
                />
                <p className="text-xs text-gray-500 mt-1">Optional notes about this update</p>
              </div>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            <div className="bg-white rounded-lg border border-gray-200">
              {/* Table Header */}
              <div className="bg-[#52baf3] text-white px-4 py-3">
                <div className="grid grid-cols-6 gap-4 text-sm font-medium">
                  <div>Component Name</div>
                  <div>Component Code</div>
                  <div>Previous Running Hours</div>
                  <div>{bulkUpdateMode === "addDelta" ? "Delta Hours" : "Present Running Hours"}</div>
                  <div>Meter Replaced?</div>
                  <div>Status</div>
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-200">
                {runningHoursData.map((item) => {
                  const updateData = bulkUpdateData[item.id] || { value: "", meterReplaced: false };
                  const bulkRowError = getBulkRowValidationError(item.id);
                  return (
                    <div key={item.id} className="px-4 py-3">
                      <div className="grid grid-cols-6 gap-4 text-sm items-center">
                        <div className="text-gray-900 font-medium">{item.component}</div>
                        <div className="text-gray-700">{item.sfiCode || item.componentCode || "—"}</div>
                        <div className="text-gray-700">{item.runningHours}</div>
                        <div className="space-y-1">
                          <Input 
                            type="number"
                            value={updateData.value || ""}
                            onChange={(e) => handleBulkUpdateChange(item.id, 'value', e.target.value)}
                            placeholder={bulkUpdateMode === "addDelta" ? "Enter delta" : "Enter new value"}
                            className={`w-full ${bulkRowError ? 'border-red-500' : ''}`}
                          />
                          {bulkRowError && (
                            <div className="text-red-500 text-xs" data-testid={`text-bulk-validation-error-${item.id}`}>
                              {bulkRowError}
                            </div>
                          )}
                          {bulkUpdateErrors[item.id] && (
                            <div className="text-red-500 text-xs">
                              {bulkUpdateErrors[item.id]}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-center">
                          <Checkbox 
                            checked={updateData.meterReplaced || false}
                            onCheckedChange={(checked) => handleBulkUpdateChange(item.id, 'meterReplaced', checked)}
                          />
                        </div>
                        <div className="text-gray-500">
                          {updateData.value && updateData.value.trim() !== "" ? "Ready to update" : "No change"}
                        </div>
                      </div>
                      {/* Meter replacement fields if checkbox is checked */}
                      {updateData.meterReplaced && (
                        <div className="grid grid-cols-2 gap-4 mt-2 pl-10 pr-4">
                          <div>
                            <Label className="text-xs text-gray-600">Old Meter Final</Label>
                            <Input 
                              type="number"
                              value={updateData.oldMeterFinal || ""}
                              onChange={(e) => handleBulkUpdateChange(item.id, 'oldMeterFinal', e.target.value)}
                              placeholder="Final reading"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">New Meter Start</Label>
                            <Input 
                              type="number"
                              value={updateData.newMeterStart || ""}
                              onChange={(e) => handleBulkUpdateChange(item.id, 'newMeterStart', e.target.value)}
                              placeholder="0"
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleBulkUpdateClose} data-testid="button-bulk-cancel">
              Cancel
            </Button>
            <Button 
              className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white" 
              onClick={handleBulkSave}
              disabled={hasBulkValidationErrors}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Confirmation Dialog */}
      <Dialog open={showDiscardConfirm} onOpenChange={(open) => { if (!open) handleKeepEditing(); }}>
        <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <div className="flex flex-col items-center text-center space-y-4 py-2">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-lg font-semibold" data-testid="text-unsaved-title">Unsaved Changes</DialogTitle>
              <p className="text-sm text-gray-600" data-testid="text-unsaved-message">
                You have unsaved running hour entries. If you close now, all entered values will be lost. Do you want to discard your changes?
              </p>
            </DialogHeader>
            <div className="flex gap-3 w-full pt-2">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDiscardChanges}
                data-testid="button-discard-changes"
              >
                Discard Changes
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleKeepEditing}
                data-testid="button-keep-editing"
              >
                Keep Editing
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Child RH Popup - View and edit children's running hours */}
      <Dialog open={isChildRHOpen} onOpenChange={(open) => {
        if (!open) {
          cancelEditingChild();
        }
        setIsChildRHOpen(open);
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-[#52baf3] border-b border-[#52baf3] pb-2">
              Inherited Components — {selectedParentForChildRH?.component}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {isLoadingChildren ? (
              <div className="text-center text-gray-500 py-8">Loading inherited components...</div>
            ) : childrenRHData?.children && childrenRHData.children.length > 0 ? (
              <div className="space-y-2">
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Inherited Running Hours:</strong> These components inherit running hours from the master component. 
                    Click the pencil icon to edit individual component running hours.
                  </p>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 grid grid-cols-[1fr_auto_100px_120px_60px] gap-4 text-sm font-medium text-gray-700">
                    <div>Component Name</div>
                    <div>Component Code</div>
                    <div className="text-right">Running Hours</div>
                    <div>Last Updated</div>
                    <div className="text-center">Edit</div>
                  </div>
                  <div className="divide-y max-h-[400px] overflow-y-auto">
                    {childrenRHData.children.map((child) => (
                      <div key={child.id} className="px-4 py-3 hover:bg-gray-50">
                        {editingChildId === child.id ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-[1fr_auto_100px_120px_60px] gap-4 text-sm items-center">
                              <div className="text-gray-900 font-medium">{child.name}</div>
                              <div className="text-gray-600">{child.componentCode}</div>
                              <div>
                                <Input 
                                  type="number"
                                  value={editingChildRH}
                                  onChange={(e) => setEditingChildRH(e.target.value)}
                                  className="h-8 text-sm text-right"
                                  placeholder="0"
                                  data-testid={`input-edit-child-rh-${child.id}`}
                                />
                              </div>
                              <div className="text-gray-600 text-xs">
                                {child.lastUpdated !== '-' ? formatProfessionalDateTime(child.lastUpdated) : '-'}
                              </div>
                              <div className="flex gap-1 justify-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-green-600 hover:text-green-800 hover:bg-green-50"
                                  onClick={saveChildRHEdit}
                                  disabled={updateChildRHMutation.isPending}
                                  title="Save"
                                  data-testid={`button-save-child-rh-${child.id}`}
                                >
                                  {updateChildRHMutation.isPending ? "..." : "✓"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                                  onClick={cancelEditingChild}
                                  title="Cancel"
                                  data-testid={`button-cancel-child-rh-${child.id}`}
                                >
                                  ✕
                                </Button>
                              </div>
                            </div>
                            <div className="pl-0">
                              <Input 
                                type="text"
                                value={editingChildComments}
                                onChange={(e) => setEditingChildComments(e.target.value)}
                                className="h-8 text-sm"
                                placeholder="Comments (optional)"
                                data-testid={`input-edit-child-comments-${child.id}`}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-[1fr_auto_100px_120px_60px] gap-4 text-sm items-center">
                            <div className="text-gray-900">{child.name}</div>
                            <div className="text-gray-600">{child.componentCode}</div>
                            <div className="text-right font-medium text-gray-900">
                              {parseFloat(child.currentCumulativeRH || '0').toLocaleString()} hrs
                            </div>
                            <div className="text-gray-600 text-xs">
                              {child.lastUpdated !== '-' ? formatProfessionalDateTime(child.lastUpdated) : '-'}
                            </div>
                            <div className="flex justify-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                                onClick={() => startEditingChild(child)}
                                title="Edit Running Hours"
                                data-testid={`button-edit-child-rh-${child.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No inherited components found for this master component.
              </div>
            )}
          </div>
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => {
              cancelEditingChild();
              setIsChildRHOpen(false);
            }}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Zero RH Renewal Confirmation Dialog */}
      {pendingZeroRHUpdate && (
        <ZeroRHConfirmationDialog
          isOpen={isZeroRHDialogOpen}
          onClose={handleZeroRHCancel}
          componentName={pendingZeroRHUpdate.componentName}
          componentCode={pendingZeroRHUpdate.componentCode}
          previousRH={pendingZeroRHUpdate.previousRH}
          entryDate={pendingZeroRHUpdate.dateLocal}
          onConfirm={handleZeroRHConfirm}
        />
      )}

      {/* Meter Replaced Confirmation Dialog */}
      {selectedComponent && (
        <MeterReplacedConfirmationDialog
          isOpen={isMeterReplacedDialogOpen}
          onClose={handleMeterReplacedCancel}
          componentName={selectedComponent.component}
          componentCode={selectedComponent.componentCode || ''}
          currentRH={parseFloat(selectedComponent.runningHours.replace(" hrs", "").replace(/,/g, ""))}
          onConfirm={handleMeterReplacedConfirm}
        />
      )}

      {/* Modify Mode Sticky Footer */}
      {isModifyMode && (
        <ModifyStickyFooter
          isVisible={true}
          hasChanges={Object.keys(fieldChanges).length > 0}
          changedFieldsCount={Object.keys(fieldChanges).length}
          onCancel={() => { window.location.href = '/pms/modify'; }}
          onSubmitChangeRequest={() => {
            // Submit change request logic will be implemented
            console.log('Submitting changes:', fieldChanges);
          }}
        />
      )}
    </div>
  );
};

export default RunningHours;