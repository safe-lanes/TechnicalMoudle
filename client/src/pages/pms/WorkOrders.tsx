import React, { useState, useEffect, useMemo } from "react";
import { Search, Plus, Pen, Timer, AlertTriangle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye, Lock, Download, FileText, Loader2, Calendar, ChevronDown } from "lucide-react";
import WOAgGridTable from "@/components/WOAgGridTable";
import type { ColDef, RowClickedEvent } from 'ag-grid-community';
import WorkOrderPlanner from "./WorkOrderPlanner";
import { useLocation } from "wouter";
import { useVessel } from "@/contexts/VesselContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PeriodFilter, PeriodFilterValue } from "@/components/filters/PeriodFilter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PostponeWorkOrderDialog from "@/components/PostponeWorkOrderDialog";
import OverdueReasonDialog from "@/components/OverdueReasonDialog";
import UnplannedWorkOrderForm from "@/components/UnplannedWorkOrderForm";
import { useModifyMode } from "@/hooks/useModifyMode";
import { ModifyFieldWrapper } from "@/components/modify/ModifyFieldWrapper";
import { ModifyStickyFooter } from "@/components/modify/ModifyStickyFooter";
import { WorkOrder, InsertWorkOrder, WorkOrderWithLeadTime } from "@shared/schema";
import { ComputedWorkOrderStatus } from "@shared/workOrders/status";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";
import { formatProfessionalDate, calculateLeadTimeStatus } from "@/lib/dateUtils";
import { Marker } from "@/components/Marker";
import { useUIRole } from "@/contexts/UIRoleContext";
import * as XLSX from "xlsx";
import { pdfReportGenerator } from "@/lib/pdfReportGenerator";
import { format } from "date-fns";
import { POSTPONEMENT_REASONS } from "@shared/postponementReasons";

// Extend WorkOrderWithLeadTime to include computed status and RH data from backend
type WorkOrderWithHydratedData = WorkOrderWithLeadTime & {
  computedStatus?: ComputedWorkOrderStatus;
  dueRH?: number | null;
  currentRH?: number | null;
  postponementReason?: string | null;
  postponementRemarks?: string | null;
  postponementEndDate?: string | null;
  postponementAuthorizedBy?: string | null;
  plannedDate?: string | null;
  componentCritical?: boolean;
};

// Using WorkOrder type from shared schema
// The WorkOrder interface is now imported from @shared/schema

// Helper function to generate template code
const generateTemplateCode = (componentCode: string, taskType: string, basis: string, frequency: string, unit?: string) => {
  const taskCodes: Record<string, string> = {
    "Inspection": "INS",
    "Overhaul": "OH",
    "Service": "SRV",
    "Testing": "TST"
  };
  
  let freqTag = "";
  if (basis === "Calendar" && frequency && unit) {
    const unitCode = unit[0].toUpperCase();
    freqTag = `${unitCode}${frequency}`;
  } else if (basis === "Running Hours" && frequency) {
    freqTag = `RH${frequency}`;
  }
  
  const taskCode = taskCodes[taskType] || "";
  return `WO-${componentCode}-${taskCode}${freqTag}`.toUpperCase();
};

type WOSortField =
  | "component" | "workOrderNo" | "jobTitle" | "assignedTo" | "dueDate"
  | "status" | "dateCompleted" | "plannedDate" | "postponeUntil"
  | "postponementReason" | "daysLate" | "approvalTier";
type WOSortDir = "asc" | "desc";

function compareWorkOrders(a: WorkOrderWithHydratedData, b: WorkOrderWithHydratedData, field: WOSortField, dir: WOSortDir, activeTab = ""): number {
  let cmp = 0;
  switch (field) {
    case "component": cmp = (a.component || "").localeCompare(b.component || ""); break;
    case "workOrderNo": {
      const getWoNo = (wo: WorkOrderWithHydratedData) =>
        (activeTab === "Pending Approval" || activeTab === "Completed") && wo.executionId
          ? wo.executionId
          : wo.workOrderNo || wo.templateCode || "";
      cmp = getWoNo(a).localeCompare(getWoNo(b));
      break;
    }
    case "jobTitle": cmp = (a.jobTitle || "").localeCompare(b.jobTitle || ""); break;
    case "assignedTo": cmp = (a.assignedTo || "").localeCompare(b.assignedTo || ""); break;
    case "dueDate": {
      const useSubmitted = activeTab === "Pending Approval" || activeTab === "Completed";
      const aVal = useSubmitted ? (a.submittedDate || "") : (a.dueDate || "");
      const bVal = useSubmitted ? (b.submittedDate || "") : (b.dueDate || "");
      cmp = aVal.localeCompare(bVal);
      break;
    }
    case "status": {
      const STATUS_ORDER: Record<string, number> = {
        "Overdue": 0, "Due": 1, "Due (Grace P)": 2, "Active": 3,
        "Pending Approval": 4, "Postponed": 5, "Draft": 6, "Completed": 7,
      };
      const aS = a.computedStatus || a.status || "";
      const bS = b.computedStatus || b.status || "";
      cmp = (STATUS_ORDER[aS] ?? 99) - (STATUS_ORDER[bS] ?? 99);
      break;
    }
    case "dateCompleted":
      cmp = (a.dateCompleted || "9999").localeCompare(b.dateCompleted || "9999");
      break;
    case "plannedDate":
      cmp = (a.plannedDate || "9999").localeCompare(b.plannedDate || "9999");
      break;
    case "postponeUntil":
      cmp = (a.postponementEndDate || "9999").localeCompare(b.postponementEndDate || "9999");
      break;
    case "postponementReason":
      cmp = (a.postponementReason || "").localeCompare(b.postponementReason || "");
      break;
    case "daysLate":
      cmp = (a.daysLate || 0) - (b.daysLate || 0);
      break;
    case "approvalTier":
      cmp = (a.approvalTier || "").localeCompare(b.approvalTier || "");
      break;
  }
  return dir === "desc" ? -cmp : cmp;
}

const AG_FIELD_TO_SORT_FIELD: Record<string, WOSortField> = {
  component: "component",
  workOrderNo: "workOrderNo",
  jobTitle: "jobTitle",
  assignedTo: "assignedTo",
  dueDate: "dueDate",
  status: "status",
  dateCompleted: "dateCompleted",
  plannedDate: "plannedDate",
  postponementEndDate: "postponeUntil",
  postponementReason: "postponementReason",
  daysLate: "daysLate",
  approvalTier: "approvalTier",
};

const WorkOrders: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterValue | null>(null);
  const [selectedRank, setSelectedRank] = useState("");
  const [criticalitySelections, setCriticalitySelections] = useState<Set<string>>(new Set());
  const [criticalityPopoverOpen, setCriticalityPopoverOpen] = useState(false);
  const [selectedPostponementReason, setSelectedPostponementReason] = useState("");
  const VALID_TABS = new Set(["Planned", "Due", "Overdue", "Postponed", "Unplanned", "Pending Approval", "Completed"]);
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = sessionStorage.getItem('workOrdersActiveTab');
    if (savedTab) {
      sessionStorage.removeItem('workOrdersActiveTab');
      // Handle legacy "Active" tab name - map to "Planned"
      const resolved = savedTab === "Active" ? "Planned" : savedTab;
      return VALID_TABS.has(resolved) ? resolved : "Planned";
    }
    return "Planned";
  });
  const [showPlanner, setShowPlanner] = useState(false);
  const [postponeDialogOpen, setPostponeDialogOpen] = useState(false);
  const [overdueReasonDialogOpen, setOverdueReasonDialogOpen] = useState(false);
  const [overdueReasonWorkOrder, setOverdueReasonWorkOrder] = useState<WorkOrderWithHydratedData | null>(null);
  const [unplannedWorkOrderFormOpen, setUnplannedWorkOrderFormOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [woSortField, setWoSortField] = useState<WOSortField | null>(null);
  const [woSortDir, setWoSortDir] = useState<WOSortDir>("asc");

  // Modify mode integration  
  const { isModifyMode, targetId, fieldChanges } = useModifyMode();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { vesselId, setVesselId } = useVessel();
  const { isSailAdmin, isClientAdmin, isVessel, isHeadOfDept } = useUIRole();
  const { data: vessels = [] } = useVessels();
  
  // Fetch work orders using React Query (includes computedStatus and lead time from backend)
  const { data: workOrdersList = [], isLoading, error } = useQuery<WorkOrderWithHydratedData[]>({
    queryKey: ['/technical/api/work-orders', vesselId],
    queryFn: async () => {
      const response = await fetch(`/technical/api/work-orders?vesselId=${vesselId}`);
      if (!response.ok) throw new Error('Failed to fetch work orders');
      return await response.json() as WorkOrderWithHydratedData[];
    },
    enabled: !!vesselId, // Only fetch when vesselId is available
  });

  const { data: allVesselJobs = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/jobs', vesselId],
    queryFn: async () => {
      const response = await fetch(`/technical/api/jobs?vesselId=${vesselId}`);
      if (!response.ok) throw new Error('Failed to fetch jobs');
      return await response.json();
    },
    enabled: !!vesselId,
  });

  const { data: postponementReasonMasterList } = useQuery<{ listValue: string; displayOrder: number; isActive: boolean }[]>({
    queryKey: ['/technical/api/fleet/master-lists', 'postponementReason'],
    queryFn: async () => {
      const r = await fetch('/technical/api/fleet/master-lists?listType=postponementReason');
      if (!r.ok) throw new Error(`Failed to fetch postponement reasons: ${r.status}`);
      const json = await r.json();
      return Array.isArray(json) ? json : [];
    },
  });

  const dbActivePostponementReasons: string[] =
    postponementReasonMasterList && postponementReasonMasterList.length > 0
      ? postponementReasonMasterList
          .filter((i) => i.isActive)
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((i) => i.listValue)
      : [];

  const filterPostponementReasons: string[] = [
    ...(dbActivePostponementReasons.length > 0 ? dbActivePostponementReasons : [...POSTPONEMENT_REASONS]),
    "Other Reason",
  ];

  // Create work order mutation
  const createWorkOrderMutation = useMutation({
    mutationFn: async (data: InsertWorkOrder) => {
      const response = await apiRequest('POST', '/technical/api/work-orders', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/work-orders', vesselId] });
      toast({ title: "Success", description: "Work order created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create work order" });
    }
  });
  
  // Update work order mutation
  const updateWorkOrderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertWorkOrder> }) => {
      const response = await apiRequest('PATCH', `/technical/api/work-orders/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/work-orders', vesselId] });
      toast({ title: "Success", description: "Work order updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update work order" });
    }
  });
  
  // Delete work order mutation
  const deleteWorkOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/technical/api/work-orders/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/work-orders', vesselId] });
      toast({ title: "Success", description: "Work order deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete work order" });
    }
  });

  // Handle preview mode from "View Changes" button
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const previewChanges = urlParams.get('previewChanges');
    const changeRequestId = urlParams.get('changeRequestId');
    const targetType = urlParams.get('targetType');
    const previewTargetId = urlParams.get('targetId');
    
    // Auto-navigate to work order page if navigating from "View Changes"
    if (previewChanges === '1' && targetType === 'workOrder' && previewTargetId) {
      const targetWorkOrder = safeWorkOrdersList.find(wo => wo.id === previewTargetId);
      if (targetWorkOrder) {
        setLocation(`/pms/work-order/${targetWorkOrder.id}`);
      }
    }
  }, [location, workOrdersList, setLocation]);

  const safeWorkOrdersList = (workOrdersList || []).filter(wo => wo !== null && wo !== undefined);
  
  const FINALIZED_STATUSES = new Set(['completed', 'approved', 'closed', 'cancelled', 'canceled']);
  const isStoredCompleted = (wo: any) => wo.status && FINALIZED_STATUSES.has(wo.status.toLowerCase().trim());
  const getEffectiveStatus = (wo: any) => {
    if (isStoredCompleted(wo)) return 'Completed';
    // Unplanned Draft WOs are excluded from all tabs until resumed and submitted
    if (wo.status === 'Draft' && wo.workOrderType === 'Unplanned') return 'Draft';
    return wo.computedStatus || wo.status || 'Active';
  };

  const tabs = [
    { id: "Planned", label: "Scheduled", count: safeWorkOrdersList.filter(wo => {
      if (wo.isExecution) return false;
      const effectiveStatus = getEffectiveStatus(wo);
      return effectiveStatus === "Active";
    }).length },
    { id: "Due", label: "Due", count: safeWorkOrdersList.filter(wo => {
      const isRejectedExecution = wo.isExecution && wo.status === 'Rejected';
      if (wo.isExecution && !isRejectedExecution) return false;
      const effectiveStatus = getEffectiveStatus(wo);
      return effectiveStatus === "Due" || effectiveStatus === "Due (Grace P)";
    }).length },
    { id: "Overdue", label: "Overdue", count: safeWorkOrdersList.filter(wo => {
      const isRejectedExecution = wo.isExecution && wo.status === 'Rejected';
      if (wo.isExecution && !isRejectedExecution) return false;
      const effectiveStatus = getEffectiveStatus(wo);
      return effectiveStatus === "Overdue";
    }).length },
    { id: "Postponed", label: "Postponed", count: safeWorkOrdersList.filter(wo => {
      if (wo.isExecution) return false;
      return getEffectiveStatus(wo) === "Postponed";
    }).length },
    { id: "Unplanned", label: "Unplanned", count: safeWorkOrdersList.filter(wo => {
      return wo.status === 'Draft' && wo.workOrderType === 'Unplanned';
    }).length },
    { id: "Pending Approval", label: "Pending Approval", count: safeWorkOrdersList.filter(wo => getEffectiveStatus(wo) === "Pending Approval").length },
    { id: "Completed", label: "Completed", count: safeWorkOrdersList.filter(wo => getEffectiveStatus(wo) === "Completed").length }
  ];

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "approved":
        return "bg-green-100 text-green-800";
      case "due":
        return "bg-yellow-100 text-yellow-800";
      case "due soon":
        return "bg-amber-100 text-amber-800";
      case "due (grace p)":
      case "grace p":
        return "bg-orange-100 text-orange-800";
      case "overdue":
        return "bg-red-100 text-red-800";
      case "planned":
        return "bg-sky-100 text-sky-800";
      case "postponed":
        return "bg-blue-100 text-blue-800";
      case "pending approval":
        return "bg-purple-100 text-purple-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "draft":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filteredWorkOrders = safeWorkOrdersList.filter(wo => {
    const effectiveStatus = getEffectiveStatus(wo);
    
    if (activeTab === "Planned") {
      if (wo.isExecution) return false;
      if (wo.status === 'Draft' && wo.workOrderType === 'Unplanned') return false;
      if (effectiveStatus !== "Active") return false;
    } else if (activeTab === "Due") {
      const isRejectedExecution = wo.isExecution && wo.status === 'Rejected';
      if (wo.isExecution && !isRejectedExecution) return false;
      if (effectiveStatus !== "Due" && effectiveStatus !== "Due (Grace P)") return false;
    } else if (activeTab === "Overdue") {
      const isRejectedExecution = wo.isExecution && wo.status === 'Rejected';
      if (wo.isExecution && !isRejectedExecution) return false;
      if (effectiveStatus !== "Overdue") return false;
    } else if (activeTab === "Completed") {
      if (effectiveStatus !== "Completed") return false;
    } else if (activeTab === "Pending Approval") {
      if (effectiveStatus !== "Pending Approval") return false;
    } else if (activeTab === "Postponed") {
      if (wo.isExecution) return false;
      if (effectiveStatus !== "Postponed") return false;
    } else if (activeTab === "Unplanned") {
      if (wo.status !== 'Draft' || wo.workOrderType !== 'Unplanned') return false;
    }
    
    if (searchTerm && !wo.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !wo.workOrderNo.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !(wo.templateCode && wo.templateCode.toLowerCase().includes(searchTerm.toLowerCase())) &&
        !(wo.executionId && wo.executionId.toLowerCase().includes(searchTerm.toLowerCase()))) {
      return false;
    }
    
    if (periodFilter) {
      const isRhBased = wo.maintenanceBasis === "Running Hours";

      if (isRhBased) {
        const rhTarget = wo.dueRH ?? (wo.nextDueReading != null ? Number(wo.nextDueReading) : null);
        const rhCurrent = wo.currentRH ?? (wo.currentReading != null ? Number(wo.currentReading) : null);
        if (rhTarget == null || isNaN(rhTarget) || rhCurrent == null || isNaN(rhCurrent)) {
          return false;
        }
        const rhRemaining = rhTarget - rhCurrent;
        let periodDays = 0;
        if (periodFilter.mode === 'year-only' && periodFilter.year) {
          const isLeap = (periodFilter.year % 4 === 0 && periodFilter.year % 100 !== 0) || periodFilter.year % 400 === 0;
          periodDays = isLeap ? 366 : 365;
        } else if (periodFilter.mode === 'year-quarter' && periodFilter.year && periodFilter.quarter) {
          const qStart = new Date(periodFilter.year, (periodFilter.quarter - 1) * 3, 1);
          const qEnd = new Date(periodFilter.year, periodFilter.quarter * 3, 0);
          periodDays = Math.round((qEnd.getTime() - qStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        } else if (periodFilter.mode === 'year-months' && periodFilter.year && periodFilter.months && periodFilter.months.length > 0) {
          let totalDays = 0;
          for (const m of periodFilter.months) {
            const lastDay = new Date(periodFilter.year, m, 0).getDate();
            totalDays += lastDay;
          }
          periodDays = totalDays;
        } else if (periodFilter.mode === 'date-range' && periodFilter.dateFrom && periodFilter.dateTo) {
          const from = new Date(periodFilter.dateFrom);
          from.setHours(0, 0, 0, 0);
          const to = new Date(periodFilter.dateTo);
          to.setHours(0, 0, 0, 0);
          periodDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        }
        const periodHours = periodDays * 24;
        if (rhRemaining > periodHours) return false;
      } else {
        const woDueDate = wo.dueDate ? new Date(wo.dueDate) : null;
        if (!woDueDate || isNaN(woDueDate.getTime())) {
          return false;
        }
        if (periodFilter.mode === 'year-only' && periodFilter.year) {
          if (woDueDate.getFullYear() !== periodFilter.year) return false;
        } else if (periodFilter.mode === 'year-quarter' && periodFilter.year && periodFilter.quarter) {
          if (woDueDate.getFullYear() !== periodFilter.year) return false;
          const woMonth = woDueDate.getMonth() + 1;
          const qStart = (periodFilter.quarter - 1) * 3 + 1;
          const qEnd = qStart + 2;
          if (woMonth < qStart || woMonth > qEnd) return false;
        } else if (periodFilter.mode === 'year-months' && periodFilter.year && periodFilter.months && periodFilter.months.length > 0) {
          if (woDueDate.getFullYear() !== periodFilter.year) return false;
          const woMonth = woDueDate.getMonth() + 1;
          if (!periodFilter.months.includes(woMonth)) return false;
        } else if (periodFilter.mode === 'date-range' && periodFilter.dateFrom && periodFilter.dateTo) {
          const from = new Date(periodFilter.dateFrom);
          from.setHours(0, 0, 0, 0);
          const to = new Date(periodFilter.dateTo);
          to.setHours(23, 59, 59, 999);
          const woTime = woDueDate.getTime();
          if (woTime < from.getTime() || woTime > to.getTime()) return false;
        }
      }
    }
    
    // Rank filter: match against assignedTo field
    if (selectedRank && selectedRank !== "all") {
      if (wo.assignedTo?.trim() !== selectedRank) {
        return false;
      }
    }
    
    if (criticalitySelections.size > 0) {
      const woCriticality = wo.criticality?.toLowerCase();
      const isCompCritical = wo.componentCritical === true;
      let matchesAny = false;
      if (criticalitySelections.has("critical") && woCriticality === "yes") matchesAny = true;
      if (criticalitySelections.has("non-critical") && woCriticality !== "yes") matchesAny = true;
      if (criticalitySelections.has("critical-component") && isCompCritical) matchesAny = true;
      if (!matchesAny) return false;
    }

    // Postponement reason filter: only applies to Postponed work orders
    if (selectedPostponementReason && selectedPostponementReason !== "all") {
      if (wo.postponementReason !== selectedPostponementReason) {
        return false;
      }
    }
    
    return true;
  });

  const woColumnDefs: ColDef[] = useMemo(() => {
    const cols: ColDef[] = [
      {
        headerName: 'Component',
        field: 'component',
        minWidth: 160,
        flex: 1,
        cellRenderer: (params: any) => {
          const wo = params.data;
          if (!wo) return null;
          const isRejectedWO = wo.wasRejected === true;
          return (
            <div className="flex items-center gap-1 min-w-0 overflow-hidden w-full">
              <span className={`truncate ${isRejectedWO ? 'text-red-600' : ''}`}>{wo.component}</span>
              {isRejectedWO && activeTab === "Due" && (
                <span className="ml-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded shrink-0">Previously Rejected</span>
              )}
            </div>
          );
        },
      },
      {
        headerName: 'Work Order No',
        field: 'workOrderNo',
        minWidth: 150,
        flex: 1,
        cellRenderer: (params: any) => {
          const wo = params.data;
          if (!wo) return null;
          const isRejectedWO = wo.wasRejected === true;
          const displayValue = (activeTab === "Pending Approval" || activeTab === "Completed") && wo.executionId
            ? wo.executionId
            : wo.workOrderNo || wo.templateCode;
          return (
            <span className={isRejectedWO ? 'text-red-600' : 'text-blue-600'}>{displayValue}</span>
          );
        },
      },
    ];

    if (activeTab === "Pending Approval") {
      cols.push({
        headerName: 'WO Template Code',
        field: 'templateCode',
        minWidth: 150,
        flex: 1,
      });
    }

    cols.push(
      {
        headerName: 'Job Title',
        field: 'jobTitle',
        minWidth: 220,
        flex: 2,
        cellRenderer: (params: any) => {
          const wo = params.data;
          if (!wo) return null;
          const isRejectedWO = wo.wasRejected === true;
          return (
            <div className={`flex items-center gap-1 min-w-0 overflow-hidden w-full ${isRejectedWO ? 'text-red-600' : ''}`}>
              <span className="truncate">{wo.jobTitle}</span>
              {wo.maintenanceBasis === "Running Hours" && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap shrink-0" data-testid={`badge-rh-${wo.id}`}>
                  RH
                </span>
              )}
            </div>
          );
        },
        tooltipValueGetter: (params: any) => params.data?.jobTitle || '',
      },
      {
        headerName: 'Assigned to',
        field: 'assignedTo',
        minWidth: 140,
        flex: 1,
      },
      {
        headerName: activeTab === "Pending Approval" || activeTab === "Completed" ? "Submitted Date" : activeTab === "Unplanned" ? "Created Date" : "Due Date",
        field: 'dueDate',
        minWidth: 160,
        flex: 1,
        cellRenderer: (params: any) => {
          const wo = params.data;
          if (!wo) return null;
          if (activeTab === "Pending Approval" || activeTab === "Completed") {
            return <span>{wo.submittedDate ? formatProfessionalDate(wo.submittedDate) : '—'}</span>;
          }
          if (activeTab === "Unplanned") {
            return <span>{wo.dueDate ? formatProfessionalDate(wo.dueDate) : wo.submittedDate ? formatProfessionalDate(wo.submittedDate) : '—'}</span>;
          }
          if (wo.maintenanceBasis === "Running Hours") {
            const rhTarget = wo.dueRH ?? (wo.nextDueReading != null ? Number(wo.nextDueReading) : null);
            const rhCurrent = wo.currentRH ?? (wo.currentReading != null ? Number(wo.currentReading) : null);
            const hasTarget = rhTarget != null && !isNaN(rhTarget);
            const hasCurrent = rhCurrent != null && !isNaN(rhCurrent);
            return (
              <div className="relative group">
                <span className="text-gray-900 font-medium" data-testid={`text-rh-due-${wo.id}`}>
                  {hasTarget ? `${rhTarget.toLocaleString()} RH` : '—'}
                </span>
                {hasTarget && (
                  <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[9999]">
                    <div className="flex flex-col gap-1">
                      <span>Next Due RH: {rhTarget.toLocaleString()}</span>
                      <span>Current RH: {hasCurrent ? rhCurrent.toLocaleString() : '—'}</span>
                      {hasCurrent ? (
                        <span className={rhTarget - rhCurrent <= 0 ? 'text-red-300 font-semibold' : 'text-green-300'}>
                          Remaining RH: {(rhTarget - rhCurrent).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-400">Remaining RH: —</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          }
          return (
            <div className="flex items-center gap-2">
              <span>{wo.dueDate ? formatProfessionalDate(wo.dueDate) : '—'}</span>
              {wo.dueDate && wo.leadTimeValue && wo.leadTimeUnit && (() => {
                const leadTimeStatus = calculateLeadTimeStatus(wo.dueDate, wo.leadTimeValue, wo.leadTimeUnit);
                if (leadTimeStatus.isInLeadTimePeriod) {
                  return (
                    <div className="relative group">
                      <AlertTriangle
                        className={`h-4 w-4 ${
                          leadTimeStatus.daysUntilDue !== null && leadTimeStatus.daysUntilDue <= 3 ? 'text-red-600' :
                          leadTimeStatus.daysUntilDue !== null && leadTimeStatus.daysUntilDue <= 7 ? 'text-orange-500' :
                          'text-yellow-500'
                        }`}
                        data-testid={`icon-lead-time-warning-${wo.id}`}
                      />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[9999]">
                        {leadTimeStatus.daysUntilDue} day{leadTimeStatus.daysUntilDue !== 1 ? 's' : ''} until due
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          );
        },
        comparator: (valueA: any, valueB: any, nodeA: any, nodeB: any) => {
          const woA = nodeA?.data;
          const woB = nodeB?.data;
          if (!woA || !woB) return 0;
          const useSubmitted = activeTab === "Pending Approval" || activeTab === "Completed";
          const aVal = useSubmitted ? (woA.submittedDate || "") : (woA.dueDate || "");
          const bVal = useSubmitted ? (woB.submittedDate || "") : (woB.dueDate || "");
          return aVal.localeCompare(bVal);
        },
      }
    );

    if (activeTab === "Planned") {
      cols.push({
        headerName: 'Planned Date',
        field: 'plannedDate',
        minWidth: 130,
        flex: 1,
        valueFormatter: (params: any) => params.value ? formatProfessionalDate(params.value) : '—',
      });
    }

    if (activeTab === "Postponed") {
      cols.push(
        {
          headerName: 'Postpone Until',
          field: 'postponementEndDate',
          minWidth: 130,
          flex: 1,
          valueFormatter: (params: any) => params.value ? formatProfessionalDate(params.value) : '—',
        },
        {
          headerName: 'Postponement Reason',
          field: 'postponementReason',
          minWidth: 200,
          flex: 1,
          valueFormatter: (params: any) => params.value || '—',
        }
      );
    }

    if (activeTab === "Pending Approval") {
      cols.push(
        {
          headerName: 'Days Late',
          field: 'daysLate',
          minWidth: 110,
          flex: 0,
          cellRenderer: (params: any) => {
            const daysLate = params.value;
            if (daysLate == null || daysLate === 0) return <span className="text-green-600 text-xs font-medium">On Time</span>;
            if (daysLate >= 1 && daysLate <= 6) return <span className="text-yellow-600 text-xs font-medium">{daysLate} days late</span>;
            if (daysLate >= 7 && daysLate <= 14) return <span className="text-orange-600 text-xs font-medium">{daysLate} days late</span>;
            return <span className="text-red-600 text-xs font-bold">{daysLate} days late <AlertTriangle className="inline h-3 w-3" /></span>;
          },
        },
        {
          headerName: 'Approval Tier',
          field: 'approvalTier',
          minWidth: 130,
          flex: 0,
          cellRenderer: (params: any) => {
            const tier = params.value;
            const wo = params.data;
            const approverLabel = wo?.approver || 'HOD';
            if (tier === "superintendent_locked") return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"><Lock className="inline h-3 w-3 mr-0.5" /> Locked</span>;
            if (tier === "superintendent_notification") return <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">Supt. Notified</span>;
            if (tier === "ce_with_justification") return <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">{approverLabel} + Remarks</span>;
            return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Standard</span>;
          },
        }
      );
    }

    cols.push({
      headerName: 'Status',
      field: 'status',
      minWidth: 170,
      flex: 1,
      cellRenderer: (params: any) => {
        const wo = params.data;
        if (!wo) return null;
        if (wo.status === 'Rejected') {
          return (
            <div className="flex flex-row items-center gap-1 overflow-hidden w-full min-w-0">
              <span className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${getStatusBadgeColor('rejected')}`}>Rejected</span>
              <span className={`px-2 py-0.5 rounded text-xs shrink-0 ${getStatusBadgeColor(wo.computedStatus || 'Active')}`}>
                {wo.computedStatus === 'Due (Grace P)' ? 'Grace P' : (wo.computedStatus || 'Active')}
              </span>
            </div>
          );
        }
        return (
          <div className="flex flex-row items-center gap-1 overflow-hidden w-full min-w-0">
            <span className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${getStatusBadgeColor(getEffectiveStatus(wo))}`}>
              {getEffectiveStatus(wo) === 'Due (Grace P)' ? 'Grace P' : getEffectiveStatus(wo)}
            </span>
            {(wo.missedCycles ?? 0) >= 1 && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500 text-white" data-testid={`badge-skipped-cycles-${wo.id}`}>
                ⚠ {wo.missedCycles} Cycle{(wo.missedCycles ?? 0) > 1 ? 's' : ''} Skipped
              </span>
            )}
            {activeTab === "Overdue" && getEffectiveStatus(wo) === "Overdue" && (
              wo.overdueReason ? (
                <button
                  onClick={(e) => { e.stopPropagation(); setOverdueReasonWorkOrder(wo); setOverdueReasonDialogOpen(true); }}
                  className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200 text-left"
                  title={`Reason: ${wo.overdueReason}`}
                  data-testid={`badge-overdue-reason-set-${wo.id}`}
                >
                  ✓ Reason set
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setOverdueReasonWorkOrder(wo); setOverdueReasonDialogOpen(true); }}
                  className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 border border-dashed border-gray-400 text-left"
                  data-testid={`button-set-overdue-reason-${wo.id}`}
                >
                  + Set Reason
                </button>
              )
            )}
          </div>
        );
      },
      comparator: (valueA: any, valueB: any, nodeA: any, nodeB: any) => {
        const STATUS_ORDER: Record<string, number> = {
          "Overdue": 0, "Due": 1, "Due (Grace P)": 2, "Active": 3,
          "Pending Approval": 4, "Postponed": 5, "Draft": 6, "Completed": 7,
        };
        const aS = nodeA?.data?.computedStatus || nodeA?.data?.status || "";
        const bS = nodeB?.data?.computedStatus || nodeB?.data?.status || "";
        return (STATUS_ORDER[aS] ?? 99) - (STATUS_ORDER[bS] ?? 99);
      },
    });

    if (activeTab === "Completed") {
      cols.push(
        {
          headerName: 'Approval Tier',
          field: 'approvalTier',
          minWidth: 130,
          flex: 0,
          cellRenderer: (params: any) => {
            const tier = params.value;
            if (tier === "superintendent_locked") return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"><Lock className="inline h-3 w-3 mr-0.5" /> Locked</span>;
            if (tier === "superintendent_notification") return <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">Supt. Notified</span>;
            if (tier === "ce_with_justification") { const woApprover = params.data?.approver || 'HOD'; return <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">{woApprover} + Remarks</span>; }
            return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Standard</span>;
          },
        },
        {
          headerName: 'Date Completed',
          field: 'dateCompleted',
          minWidth: 140,
          flex: 1,
          valueFormatter: (params: any) => formatProfessionalDate(params.value),
        }
      );
    }

    cols.push({
      headerName: 'Actions',
      field: 'id',
      minWidth: 110,
      flex: 0,
      sortable: false,
      resizable: false,
      cellRenderer: (params: any) => {
        const wo = params.data;
        if (!wo) return null;
        return (
          <div className="flex items-center justify-center gap-2">
            {activeTab === "Pending Approval" && wo.approvalTier === "superintendent_locked" ? (
              <div className="relative group" data-testid={`locked-action-${wo.id}`}>
                <Lock className="h-4 w-4 text-gray-400" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[9999]">
                  Locked — Awaiting Superintendent acknowledgment
                </div>
              </div>
            ) : (
              <>
                {getEffectiveStatus(wo) !== "Completed" && (
                  <>
                    <button
                      className="p-1 hover:bg-gray-200 rounded"
                      onClick={(e) => { e.stopPropagation(); handlePencilClick(wo); }}
                      title="Edit Template"
                      data-testid={`button-edit-wo-${wo.id}`}
                    >
                      <Pen className="h-4 w-4 text-gray-600" />
                    </button>
                    {!isVessel && getEffectiveStatus(wo) !== "Pending Approval" && (
                      <button
                        className="p-1 hover:bg-gray-200 rounded"
                        onClick={(e) => { e.stopPropagation(); handleTimerClick(wo); }}
                        title="Postpone Work Order"
                        data-testid={`button-postpone-wo-${wo.id}`}
                      >
                        <Timer className="h-4 w-4 text-gray-600" />
                      </button>
                    )}
                  </>
                )}
                {getEffectiveStatus(wo) === "Completed" && (
                  <button
                    className="p-1 hover:bg-gray-200 rounded"
                    onClick={(e) => { e.stopPropagation(); handleWorkOrderClick(wo); }}
                    title="View Work Order"
                    data-testid={`button-view-wo-${wo.id}`}
                  >
                    <Eye className="h-4 w-4 text-gray-600" />
                  </button>
                )}
              </>
            )}
          </div>
        );
      },
    });

    return cols;
  }, [activeTab, isVessel]);

  const sortedWorkOrders = useMemo(
    () => woSortField
      ? [...filteredWorkOrders].sort((a, b) => compareWorkOrders(a, b, woSortField, woSortDir, activeTab))
      : filteredWorkOrders,
    [filteredWorkOrders, woSortField, woSortDir, activeTab]
  );

  const handleWoSortChanged = (field: string | null, direction: 'asc' | 'desc') => {
    if (!field) {
      setWoSortField(null);
      setWoSortDir("asc");
    } else {
      const mapped = AG_FIELD_TO_SORT_FIELD[field];
      if (mapped) {
        setWoSortField(mapped);
        setWoSortDir(direction);
      }
    }
  };

  // Pagination calculations
  const totalItems = filteredWorkOrders.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  // Reset to page 1 when filters or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, periodFilter, selectedRank, criticalitySelections, selectedPostponementReason, vesselId, woSortField, woSortDir]);

  useEffect(() => {
    setWoSortField(null);
    setWoSortDir("asc");
  }, [activeTab]);
  
  // Clamp current page when total pages shrinks (e.g., after deletion or filter change)
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);
  
  // Extract unique ranks (assigned_to values) from work orders for dynamic filter
  const uniqueRanks = useMemo(() => {
    const ranks = safeWorkOrdersList
      .map(wo => wo.assignedTo?.trim())
      .filter((rank): rank is string => !!rank && rank.length > 0);
    const uniqueSet = Array.from(new Set(ranks));
    return uniqueSet.sort((a, b) => a.localeCompare(b));
  }, [safeWorkOrdersList]);

  // Get paginated work orders (from sorted list)
  const paginatedWorkOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedWorkOrders.slice(startIndex, endIndex);
  }, [sortedWorkOrders, currentPage, itemsPerPage]);
  
  // Pagination handlers
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };
  
  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const handlePostponeClick = (workOrder: WorkOrder) => {
    setSelectedWorkOrder(workOrder);
    setPostponeDialogOpen(true);
  };

  const handleWorkOrderClick = (workOrder: WorkOrder) => {
    // Navigate to work order detail page (full-screen)
    setLocation(`/pms/work-order/${workOrder.id}`);
  };

  const handlePencilClick = (workOrder: WorkOrder) => {
    setLocation(`/pms/work-order/${workOrder.id}`);
  };

  const handleTimerClick = (workOrder: WorkOrder) => {
    setSelectedWorkOrder(workOrder);
    setPostponeDialogOpen(true);
  };

  const handleApprove = (workOrderId: string, approverRemarks?: string) => {
    const workOrder = safeWorkOrdersList.find(wo => wo.executionId === workOrderId || wo.id === workOrderId);
    if (!workOrder) return;
    
    // Use the actual completion date from the work order (user-entered date when work was completed)
    // Priority: completionDateTime > dateCompleted > undefined (let backend handle validation)
    // Keep full ISO timestamp - do not trim to date-only to preserve time information
    const actualCompletionDate = workOrder.completionDateTime || workOrder.dateCompleted || undefined;
    
    // Calculate next due date/reading based on actual completion date
    let nextDueDate = undefined;
    let nextDueReading = undefined;
    
    if (workOrder.maintenanceBasis === "Calendar" && actualCompletionDate) {
      const completionDate = new Date(actualCompletionDate);
      // Validate date is parseable before calculating next due
      if (!isNaN(completionDate.getTime())) {
        const freq = parseInt(workOrder.frequencyValue || "0");
        if (workOrder.frequencyUnit === "Days") {
          completionDate.setDate(completionDate.getDate() + freq);
        } else if (workOrder.frequencyUnit === "Weeks") {
          completionDate.setDate(completionDate.getDate() + (freq * 7));
        } else if (workOrder.frequencyUnit === "Months") {
          completionDate.setMonth(completionDate.getMonth() + freq);
        } else if (workOrder.frequencyUnit === "Years") {
          completionDate.setFullYear(completionDate.getFullYear() + freq);
        }
        nextDueDate = completionDate.toISOString().split('T')[0];
      }
    } else if (workOrder.maintenanceBasis === "Running Hours" && workOrder.currentReading) {
      nextDueReading = (parseInt(workOrder.currentReading) + parseInt(workOrder.frequencyValue || "0")).toString();
    }
    
    const updateData: Record<string, any> = {
      status: "Approved",
      approver: "Current User", // Replace with actual user
      approverRemarks,
      approvalDate: new Date().toISOString(),
      nextDueDate,
      nextDueReading
    };
    
    // Only set dateCompleted if we have an actual completion date from the work order
    if (actualCompletionDate) {
      updateData.dateCompleted = actualCompletionDate;
    }
    
    updateWorkOrderMutation.mutate({ id: workOrder.id, data: updateData });
  };

  const handleReject = (workOrderId: string, rejectionComments: string) => {
    const workOrder = safeWorkOrdersList.find(wo => wo.executionId === workOrderId || wo.id === workOrderId);
    if (!workOrder) return;
    
    const updateData = {
      status: "Rejected",
      approver: "Current User", // Replace with actual user
      approverRemarks: rejectionComments,
      rejectionDate: new Date().toISOString()
    };
    
    updateWorkOrderMutation.mutate({ id: workOrder.id, data: updateData });
  };

  const handlePostponeConfirm = (workOrderId: string, postponeData: any) => {
    const updateData = {
      status: "Postponed",
      dueDate: postponeData.nextDueDate,
      postponementEndDate: postponeData.postponementEndDate,
      postponementReason: postponeData.reason,
      postponementRemarks: postponeData.postponementRemarks,
      postponementAuthorizedBy: postponeData.authorizedBy
    };
    
    updateWorkOrderMutation.mutate({ id: workOrderId, data: updateData });
  };

  const handleAddWorkOrderClick = () => {
    setLocation('/pms/work-order/new/general');
  };

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportingType, setExportingType] = useState<string | null>(null);

  const vesselName = useMemo(() => {
    if (!vesselId) return 'All Vessels';
    const vessel = vessels.find(v => v.id === vesselId);
    return vessel?.name || vesselId;
  }, [vesselId, vessels]);

  const exportWorkOrdersExcel = () => {
    setExportingType('wo-excel');
    try {
      const now = new Date();
      const timestamp = format(now, 'yyyyMMdd_HHmm');
      const exportList = (activeTab === "Postponed" || activeTab === "Unplanned") ? filteredWorkOrders : safeWorkOrdersList;
      const isPostponedExport = activeTab === "Postponed";

      type BaseExcelRow = {
        'S.No': number; 'Component': string; 'Work Order No': string; 'Job Title': string;
        'Assigned To': string; 'Due Date': string; 'Status': string; 'Criticality': string;
        'Maintenance Basis': string; 'Frequency': string; 'Postponement Reason': string; 'Postponement Remarks': string;
      };
      type PostponedExcelRow = BaseExcelRow & { 'Postpone Until': string; 'Authorized By': string };

      const rows = exportList.map((wo, idx): BaseExcelRow | PostponedExcelRow => {
        const dueDateStr = wo.maintenanceBasis === 'Running Hours'
          ? (() => { const rh = wo.dueRH ?? (wo.nextDueReading != null ? Number(wo.nextDueReading) : null); return rh != null && !isNaN(rh) ? `${rh.toLocaleString()} RH` : '-'; })()
          : (wo.dueDate ? formatProfessionalDate(wo.dueDate) : '-');
        const base: BaseExcelRow = {
          'S.No': idx + 1,
          'Component': wo.component || '-',
          'Work Order No': wo.workOrderNo || wo.templateCode || '-',
          'Job Title': wo.jobTitle || '-',
          'Assigned To': wo.assignedTo || '-',
          'Due Date': dueDateStr,
          'Status': getEffectiveStatus(wo),
          'Criticality': wo.criticality || '-',
          'Maintenance Basis': wo.maintenanceBasis || '-',
          'Frequency': wo.frequencyValue ? `${wo.frequencyValue} ${wo.frequencyUnit || ''}`.trim() : '-',
          'Postponement Reason': wo.postponementReason || '-',
          'Postponement Remarks': wo.postponementRemarks || '-',
        };
        if (isPostponedExport) {
          return {
            ...base,
            'Postpone Until': wo.postponementEndDate ? formatProfessionalDate(wo.postponementEndDate) : '-',
            'Authorized By': wo.postponementAuthorizedBy || '-',
          } satisfies PostponedExcelRow;
        }
        return base;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = isPostponedExport
        ? [{ wch: 6 }, { wch: 30 }, { wch: 35 }, { wch: 40 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 50 }, { wch: 40 }, { wch: 18 }, { wch: 25 }]
        : [{ wch: 6 }, { wch: 30 }, { wch: 35 }, { wch: 40 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 50 }, { wch: 40 }];
      const wb = XLSX.utils.book_new();
      const sheetName = isPostponedExport ? 'Postponed Work Orders' : 'All Work Orders';
      const fileName = isPostponedExport
        ? `${vesselName}_Postponed_Work_Orders_${timestamp}.xlsx`
        : `${vesselName}_All_Work_Orders_${timestamp}.xlsx`;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, fileName);

      toast({ title: "Export Complete", description: `Exported ${rows.length} work orders to Excel` });
    } catch (err) {
      toast({ title: "Export Failed", description: "Failed to export work orders to Excel" });
    }
    setExportingType(null);
  };

  const exportWorkOrdersPdf = () => {
    setExportingType('wo-pdf');
    try {
      const isPostponedExport = activeTab === "Postponed";
      const exportList = (isPostponedExport || activeTab === "Unplanned") ? filteredWorkOrders : safeWorkOrdersList;

      const columns = isPostponedExport
        ? [
            { header: 'S.No', field: 'sNo', width: 10 },
            { header: 'Component', field: 'component', width: 35 },
            { header: 'Work Order No', field: 'workOrderNo', width: 40 },
            { header: 'Job Title', field: 'jobTitle', width: 45 },
            { header: 'Assigned To', field: 'assignedTo', width: 22 },
            { header: 'Due Date', field: 'dueDate', width: 20 },
            { header: 'Postpone Until', field: 'postponeUntil', width: 20 },
            { header: 'Postponement Reason', field: 'postponementReason', width: 45 },
            { header: 'Postponement Remarks', field: 'postponementRemarks', width: 45 },
            { header: 'Authorized By', field: 'authorizedBy', width: 25 },
            { header: 'Status', field: 'status', width: 16 },
          ]
        : [
            { header: 'S.No', field: 'sNo', width: 10 },
            { header: 'Component', field: 'component', width: 35 },
            { header: 'Work Order No', field: 'workOrderNo', width: 40 },
            { header: 'Job Title', field: 'jobTitle', width: 45 },
            { header: 'Assigned To', field: 'assignedTo', width: 22 },
            { header: 'Due Date', field: 'dueDate', width: 20 },
            { header: 'Status', field: 'status', width: 16 },
            { header: 'Criticality', field: 'criticality', width: 14 },
            { header: 'Postponement Reason', field: 'postponementReason', width: 45 },
            { header: 'Postponement Remarks', field: 'postponementRemarks', width: 45 },
          ];

      type BasePdfRow = {
        sNo: number; component: string; workOrderNo: string; jobTitle: string;
        assignedTo: string; dueDate: string; status: string; criticality: string;
        postponementReason: string; postponementRemarks: string;
      };
      type PostponedPdfRow = BasePdfRow & { postponeUntil: string; authorizedBy: string };

      const data = exportList.map((wo, idx): BasePdfRow | PostponedPdfRow => {
        const dueDateStr = wo.maintenanceBasis === 'Running Hours'
          ? (() => { const rh = wo.dueRH ?? (wo.nextDueReading != null ? Number(wo.nextDueReading) : null); return rh != null && !isNaN(rh) ? `${rh.toLocaleString()} RH` : '-'; })()
          : (wo.dueDate ? formatProfessionalDate(wo.dueDate) : '-');
        const base: BasePdfRow = {
          sNo: idx + 1,
          component: wo.component || '-',
          workOrderNo: wo.workOrderNo || wo.templateCode || '-',
          jobTitle: wo.jobTitle || '-',
          assignedTo: wo.assignedTo || '-',
          dueDate: dueDateStr,
          status: getEffectiveStatus(wo),
          criticality: wo.criticality || '-',
          postponementReason: wo.postponementReason || '-',
          postponementRemarks: wo.postponementRemarks || '-',
        };
        if (isPostponedExport) {
          return {
            ...base,
            postponeUntil: wo.postponementEndDate ? formatProfessionalDate(wo.postponementEndDate) : '-',
            authorizedBy: wo.postponementAuthorizedBy || '-',
          } satisfies PostponedPdfRow;
        }
        return base;
      });

      const reportTitle = isPostponedExport ? 'Postponed Work Orders' : 'All Work Orders';
      const reportSubtitle = isPostponedExport ? 'Work orders currently postponed' : 'Complete work order listing';

      pdfReportGenerator.generateReport(
        { title: reportTitle, subtitle: reportSubtitle, vessel: vesselName, orientation: 'landscape' },
        columns,
        data
      );

      toast({ title: "Export Complete", description: `Exported ${data.length} work orders to PDF` });
    } catch (err) {
      toast({ title: "Export Failed", description: "Failed to export work orders to PDF" });
    }
    setExportingType(null);
  };

  const exportComponentJobsExcel = () => {
    if (!allVesselJobs || allVesselJobs.length === 0) {
      toast({ title: "No Data", description: "No component jobs available to export.", variant: "destructive" });
      return;
    }
    setExportingType('cj-excel');
    try {
      const now = new Date();
      const timestamp = format(now, 'yyyyMMdd_HHmm');
      const vessel = vessels.find(v => v.id === vesselId);
      const vCode = (vessel as any)?.vesselCode || (vessel as any)?.code || '';

      const rows = allVesselJobs.map((job: any) => {
        let sparePartsStr = '';
        if (Array.isArray(job.requiredSpareParts) && job.requiredSpareParts.length > 0) {
          sparePartsStr = job.requiredSpareParts
            .map((sp: any) => {
              const code = sp.partCode || sp.spareCode || sp.code || '';
              const qty = sp.quantity || sp.qty || 1;
              return code ? `${code}:${qty}` : '';
            })
            .filter(Boolean)
            .join(', ');
        }

        return {
          'Fleet Equipment Code': job.fleetEquipmentCode || '',
          'Component Code': job.componentCode || '',
          'Component Name': job.componentName || '',
          'Job Code': job.jobNo || '',
          'Job Title': job.jobTitle || '',
          'Job Description': job.jobDescription || job.briefWorkDescription || '',
          'Department': job.department || '',
          'Responsible Rank': job.assignedTo || '',
          'Schedule Type': job.maintenanceBasis || job.frequencyType || '',
          'Calendar Interval': job.frequencyValue || '',
          'Interval Unit': job.frequencyUnit || '',
          'RH Interval': job.intervalRunningHour != null ? String(job.intervalRunningHour) : (job.maintenanceBasis === 'Running Hours' ? (job.frequencyValue || '') : ''),
          'Last Done Date': job.lastDoneDate || '',
          'Last Done RH': job.lastDoneRH || '',
          'Critical Yes/No': job.criticality === 'Yes' || job.criticality === true ? 'Yes' : (job.criticality === 'No' || job.criticality === false ? 'No' : (job.criticality || '')),
          'Estimated Hours': job.estimatedManHours != null ? String(job.estimatedManHours) : '',
          'Spare Parts Required': sparePartsStr,
          'IS Active': job.isActive === true ? 'Yes' : (job.isActive === false ? 'No' : (job.isActive || '')),
          'Vessel Code': vCode,
          'Maker Code': '',
          'Class Survey Code': '',
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 20 }, { wch: 18 }, { wch: 30 }, { wch: 15 }, { wch: 40 },
        { wch: 50 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 18 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 15 },
        { wch: 18 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Vessel_Job');
      XLSX.writeFile(wb, `${vesselName}_Component_Jobs_${timestamp}.xlsx`);

      toast({ title: "Export Complete", description: `Exported ${rows.length} component jobs to Excel` });
    } catch (err) {
      toast({ title: "Export Failed", description: "Failed to export component jobs to Excel" });
    }
    setExportingType(null);
  };

  if (showPlanner) {
    return (
      <WorkOrderPlanner
        onBack={() => setShowPlanner(false)}
        vesselId={vesselId || ""}
        vesselName={vesselName || ""}
      />
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header with Status Tabs */}
      <div className="flex items-center justify-between relative">
        <h1 className="text-2xl font-bold text-gray-900" data-testid="C1">
          <Marker id="C1" />Work Orders (W.O)
        </h1>
        
        {/* Status Tabs - Center aligned */}
        <div className="absolute left-1/2 -translate-x-1/2 bg-gray-100 rounded-md p-1 flex items-center gap-0.5">
          {tabs.map((tab, index) => {
            const markerId = index === 0 ? "C4" : index === 1 ? "C5" : index === 2 ? "C6" : index === 3 ? "C33" : index === 4 ? "C98" : index === 5 ? "C7" : "C8";
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-[#52baf3] text-white"
                    : "text-gray-700 hover:bg-gray-200"
                }`}
                data-testid={markerId}
              >
                <Marker id={markerId} />
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
            onClick={() => setShowPlanner(true)}
            data-testid="button-planner-view"
          >
            <Calendar className="h-4 w-4" />
            Planner
          </Button>
          {isSailAdmin && (
          <Button 
            variant="outline" 
            size="sm"
            className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
            onClick={() => setExportDialogOpen(true)}
            data-testid="button-export-wo"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          )}
          {isSailAdmin && (
          <Button 
            size="sm" 
            className="bg-[#5dc86f] hover:bg-[#4db85f] text-white hidden"
            onClick={handleAddWorkOrderClick}
            data-testid="C2"
          >
            <Marker id="C2" />
            <Plus className="h-4 w-4 mr-1" />
            Add W.O
          </Button>
          )}
          <Button 
            size="sm" 
            className="bg-[#5dc86f] hover:bg-[#4db85f] text-white"
            onClick={() => setLocation('/pms/work-order/unplanned/new')}
            data-testid="C3"
          >
            <Marker id="C3" />
            <Plus className="h-4 w-4 mr-1" />
            Unplanned W.O
          </Button>
        </div>
      </div>

      {/* Filters - Single Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {(isSailAdmin || isClientAdmin) && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Vessel:</span>
            <Select value={vesselId === 'all' ? '' : vesselId} onValueChange={setVesselId}>
              <SelectTrigger className="w-[200px]" data-testid="C15">
                <Marker id="C15" />
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

        <div className="relative w-72" data-testid="C10">
          <Marker id="C10" />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search work orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div data-testid="C11">
          <Marker id="C11" />
          <PeriodFilter
            value={periodFilter}
            onChange={setPeriodFilter}
            className="w-40"
          />
        </div>

        <Select value={selectedRank} onValueChange={setSelectedRank}>
          <SelectTrigger className="w-40" data-testid="C12">
            <Marker id="C12" />
            <SelectValue placeholder="All Ranks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ranks</SelectItem>
            {uniqueRanks.map((rank) => (
              <SelectItem key={rank} value={rank}>
                {rank}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover open={criticalityPopoverOpen} onOpenChange={setCriticalityPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-44 justify-between text-sm font-normal text-gray-600"
              data-testid="C14"
            >
              <Marker id="C14" />
              <span className="truncate">
                {(() => {
                  if (criticalitySelections.size === 0 || criticalitySelections.size === 3) return "Criticality";
                  const labels: string[] = [];
                  if (criticalitySelections.has("critical")) labels.push("Critical");
                  if (criticalitySelections.has("non-critical")) labels.push("Non-Critical");
                  if (criticalitySelections.has("critical-component")) labels.push("Critical Component WO");
                  return labels.join(", ");
                })()}
              </span>
              <ChevronDown className="h-3.5 w-3.5 ml-1 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1" align="start">
            <div className="space-y-0.5">
              {(() => {
                const INDIVIDUAL_OPTIONS = ["critical", "non-critical", "critical-component"];
                const OPTIONS = [
                  { value: "all", label: "All" },
                  { value: "critical", label: "Critical" },
                  { value: "non-critical", label: "Non-Critical" },
                  { value: "critical-component", label: "Critical Component WO" },
                ];
                return OPTIONS.map((opt) => {
                const isAll = opt.value === "all";
                const isChecked = isAll
                  ? criticalitySelections.size === 3
                  : criticalitySelections.has(opt.value);
                const handleToggle = () => {
                  setCriticalitySelections((prev) => {
                    const next = new Set(prev);
                    if (isAll) {
                      if (prev.size === 3) {
                        next.clear();
                      } else {
                        INDIVIDUAL_OPTIONS.forEach((v) => next.add(v));
                      }
                    } else {
                      if (next.has(opt.value)) {
                        next.delete(opt.value);
                      } else {
                        next.add(opt.value);
                      }
                    }
                    return next;
                  });
                };
                return (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded-sm text-sm text-gray-700 hover:bg-accent hover:text-accent-foreground transition-colors"
                    data-testid={`criticality-${opt.value}`}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={handleToggle}
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              });
              })()}
            </div>
          </PopoverContent>
        </Popover>


        <Button
          variant="outline"
          className="text-gray-600"
          onClick={() => {
            setSearchTerm("");
            setPeriodFilter(null);
            setSelectedRank("");
            setCriticalitySelections(new Set());
            setSelectedPostponementReason("");
          }}
          data-testid="button-clear-filters"
        >
          Clear
        </Button>
      </div>

      {/* Pending Approval Summary Stat Bar */}
      {activeTab === "Pending Approval" && (() => {
        const lockedCount = filteredWorkOrders.filter(wo => wo.approvalTier === "superintendent_locked").length;
        const notifiedCount = filteredWorkOrders.filter(wo => wo.approvalTier === "superintendent_notification").length;
        const ceRemarksCount = filteredWorkOrders.filter(wo => wo.approvalTier === "ce_with_justification").length;
        const standardCount = filteredWorkOrders.filter(wo => !wo.approvalTier || wo.approvalTier === "standard").length;
        const statCards = [
          { icon: Lock, label: "Locked (Supt. Required)", count: lockedCount, bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-800 dark:text-red-300", testId: "stat-locked" },
          { icon: AlertTriangle, label: "Supt. Notified", count: notifiedCount, bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-800 dark:text-orange-300", testId: "stat-supt-notified" },
          { icon: Pen, label: "HOD Remarks Required", count: ceRemarksCount, bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-800 dark:text-yellow-300", testId: "stat-ce-remarks" },
          { icon: Eye, label: "Standard Approval", count: standardCount, bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-800 dark:text-green-300", testId: "stat-standard" },
        ];
        return (
          <div className="grid grid-cols-4 gap-3" data-testid="pending-approval-stat-bar">
            {statCards.map((card) => (
              <div
                key={card.testId}
                className={`flex items-center gap-3 rounded-md px-4 py-3 ${card.count === 0 ? "bg-gray-100 dark:bg-gray-800 opacity-60" : card.bg}`}
                data-testid={card.testId}
              >
                <card.icon className={`h-5 w-5 ${card.count === 0 ? "text-gray-400" : card.text}`} />
                <div>
                  <div className={`text-xl font-bold ${card.count === 0 ? "text-gray-400" : card.text}`} data-testid={`${card.testId}-count`}>{card.count}</div>
                  <div className={`text-xs ${card.count === 0 ? "text-gray-400" : card.text}`}>{card.label}</div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Work Orders Table - AG Grid */}
      <div className="flex-1 overflow-hidden">
        <WOAgGridTable
          columnDefs={woColumnDefs}
          rowData={paginatedWorkOrders}
          height="100%"
          onRowClicked={(event: RowClickedEvent) => {
            if (event.data) handleWorkOrderClick(event.data);
          }}
          onSortChanged={handleWoSortChanged}
          getRowClass={(params: any) => {
            const isRejected = params.data?.wasRejected === true;
            if (isRejected) return 'wo-rejected-row';
            return undefined;
          }}
          noRowsMessage={
            activeTab === "Postponed"
              ? "No postponed work orders found for the selected filters."
              : "No work orders found for the selected filters."
          }
          testId="work-orders-grid"
        />
      </div>

      {/* Pagination Footer */}
      <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between" data-testid="pagination-footer">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Show</span>
          <Select value={String(itemsPerPage)} onValueChange={handleItemsPerPageChange}>
            <SelectTrigger className="w-20 h-8" data-testid="select-items-per-page">
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
        
        <div className="flex items-center gap-2 text-sm text-gray-600" data-testid="pagination-info">
          <span>
            Showing {totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} work orders
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(1)}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0"
            data-testid="button-first-page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0"
            data-testid="button-prev-page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-1 px-2">
            <span className="text-sm text-gray-600">Page</span>
            <Input
              type="number"
              min={1}
              max={totalPages || 1}
              value={currentPage}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value)) goToPage(value);
              }}
              className="w-14 h-8 text-center"
              data-testid="input-page-number"
            />
            <span className="text-sm text-gray-600">of {totalPages || 1}</span>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="h-8 w-8 p-0"
            data-testid="button-next-page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(totalPages)}
            disabled={currentPage >= totalPages}
            className="h-8 w-8 p-0"
            data-testid="button-last-page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Postpone Work Order Dialog */}
      <PostponeWorkOrderDialog
        isOpen={postponeDialogOpen}
        onClose={() => setPostponeDialogOpen(false)}
        workOrder={selectedWorkOrder}
        onConfirm={handlePostponeConfirm}
      />

      {/* Overdue Reason Dialog */}
      <OverdueReasonDialog
        workOrder={overdueReasonWorkOrder}
        open={overdueReasonDialogOpen}
        onClose={() => {
          setOverdueReasonDialogOpen(false);
          setOverdueReasonWorkOrder(null);
        }}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['/technical/api/work-orders', vesselId] });
        }}
      />

      {/* Unplanned Work Order Form */}
      <UnplannedWorkOrderForm
        isOpen={unplannedWorkOrderFormOpen}
        onClose={() => setUnplannedWorkOrderFormOpen(false)}
        vesselId={vesselId}
        onSubmit={async (formData) => {
          console.log('[API_UNPLANNED_WO] Submitting unplanned WO:', formData);
          try {
            await createWorkOrderMutation.mutateAsync(formData);
            setUnplannedWorkOrderFormOpen(false);
          } catch (error) {
            console.error('[API_UNPLANNED_WO] Error:', error);
            throw error;
          }
        }}
      />

      {isSailAdmin && (
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-export-wo">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Export Work Orders</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="border rounded-lg p-4 space-y-3" data-testid="export-section-component-jobs">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#1E5A8E]" />
                <span className="font-medium text-gray-900">Export Component Jobs</span>
              </div>
              <p className="text-sm text-gray-500">All jobs linked to components for this vessel in import sheet format</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportComponentJobsExcel}
                  disabled={!!exportingType || allVesselJobs.length === 0}
                  data-testid="button-export-cj-excel"
                >
                  {exportingType === 'cj-excel' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                  Excel
                </Button>
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-3" data-testid="export-section-all-wo">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#1E5A8E]" />
                <span className="font-medium text-gray-900">
                  {activeTab === "Postponed" ? "Export Postponed Work Orders" : "Export All Work Orders"}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {activeTab === "Postponed"
                  ? "Postponed work orders with postponement details, end dates, and authorization"
                  : "Complete listing of all work orders with status, due dates, and assignments"}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportWorkOrdersExcel}
                  disabled={!!exportingType}
                  data-testid="button-export-wo-excel"
                >
                  {exportingType === 'wo-excel' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportWorkOrdersPdf}
                  disabled={!!exportingType}
                  data-testid="button-export-wo-pdf"
                >
                  {exportingType === 'wo-pdf' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
                  PDF
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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

export default WorkOrders;