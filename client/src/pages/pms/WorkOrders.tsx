import React, { useState, useEffect, useMemo } from "react";
import { Search, Plus, Pen, Timer, AlertTriangle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye, Lock, Download, FileText, Loader2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PostponeWorkOrderDialog from "@/components/PostponeWorkOrderDialog";
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

// Extend WorkOrderWithLeadTime to include computed status and RH data from backend
type WorkOrderWithHydratedData = WorkOrderWithLeadTime & {
  computedStatus?: ComputedWorkOrderStatus;
  dueRH?: number | null;
  currentRH?: number | null;
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

// Sample data moved to seed data in storage - now fetched from API

const WorkOrders: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedRank, setSelectedRank] = useState("");
  const [selectedCriticality, setSelectedCriticality] = useState("");
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = sessionStorage.getItem('workOrdersActiveTab');
    if (savedTab) {
      sessionStorage.removeItem('workOrdersActiveTab');
      // Handle legacy "Active" tab name - map to "Planned"
      return savedTab === "Active" ? "Planned" : savedTab;
    }
    return "Planned";
  });
  const [postponeDialogOpen, setPostponeDialogOpen] = useState(false);
  const [unplannedWorkOrderFormOpen, setUnplannedWorkOrderFormOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
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
    return wo.computedStatus || wo.status || 'Active';
  };

  const tabs = [
    { id: "Planned", label: "Planned", count: safeWorkOrdersList.filter(wo => {
      if (wo.isExecution) return false;
      const effectiveStatus = getEffectiveStatus(wo);
      return effectiveStatus === "Active" || effectiveStatus === "Postponed";
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
      if (effectiveStatus !== "Active" && effectiveStatus !== "Postponed") return false;
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
    }
    
    if (searchTerm && !wo.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !wo.workOrderNo.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !(wo.templateCode && wo.templateCode.toLowerCase().includes(searchTerm.toLowerCase())) &&
        !(wo.executionId && wo.executionId.toLowerCase().includes(searchTerm.toLowerCase()))) {
      return false;
    }
    
    // RH-based filter: "Due in next X hours" (when period is set to rh-250, rh-500, or rh-1000)
    if (selectedPeriod && selectedPeriod.startsWith("rh-")) {
      // When RH filter is selected, exclude non-RH work orders
      if (wo.maintenanceBasis !== "Running Hours") {
        return false;
      }
      
      const rhThreshold = parseInt(selectedPeriod.replace("rh-", ""));
      // Exclude RH work orders with missing RH data
      if (wo.dueRH == null || wo.currentRH == null) {
        return false;
      }
      
      if (!isNaN(rhThreshold)) {
        const rhRemaining = wo.dueRH - wo.currentRH;
        // Show work orders where remaining RH is positive (not yet due) and within threshold
        if (rhRemaining < 0 || rhRemaining > rhThreshold) {
          return false;
        }
      }
    }
    
    // Rank filter: match against assignedTo field
    if (selectedRank && selectedRank !== "all") {
      if (wo.assignedTo?.trim() !== selectedRank) {
        return false;
      }
    }
    
    // Criticality filter: match against criticality field
    if (selectedCriticality && selectedCriticality !== "all") {
      const woCriticality = wo.criticality?.toLowerCase();
      if (selectedCriticality === "critical") {
        // "critical" matches "Yes" criticality
        if (woCriticality !== "yes") {
          return false;
        }
      } else if (selectedCriticality === "non-critical") {
        // "non-critical" matches "No" criticality or empty/null
        if (woCriticality === "yes") {
          return false;
        }
      }
    }
    
    return true;
  });

  // Pagination calculations
  const totalItems = filteredWorkOrders.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, selectedPeriod, selectedRank, selectedCriticality, vesselId]);
  
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

  // Get paginated work orders
  const paginatedWorkOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredWorkOrders.slice(startIndex, endIndex);
  }, [filteredWorkOrders, currentPage, itemsPerPage]);
  
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
    // Navigate to work order detail page (full-screen)
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
      const rows = safeWorkOrdersList.map((wo, idx) => ({
        'S.No': idx + 1,
        'Component': wo.component || '-',
        'Work Order No': wo.workOrderNo || wo.templateCode || '-',
        'Job Title': wo.jobTitle || '-',
        'Assigned To': wo.assignedTo || '-',
        'Due Date': wo.maintenanceBasis === 'Running Hours'
          ? (() => { const rh = wo.dueRH ?? (wo.nextDueReading != null ? Number(wo.nextDueReading) : null); return rh != null && !isNaN(rh) ? `${rh.toLocaleString()} RH` : '-'; })()
          : (wo.dueDate ? formatProfessionalDate(wo.dueDate) : '-'),
        'Status': getEffectiveStatus(wo),
        'Criticality': wo.criticality || '-',
        'Maintenance Basis': wo.maintenanceBasis || '-',
        'Frequency': wo.frequencyValue ? `${wo.frequencyValue} ${wo.frequencyUnit || ''}`.trim() : '-',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 6 }, { wch: 30 }, { wch: 35 }, { wch: 40 }, { wch: 18 },
        { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'All Work Orders');
      XLSX.writeFile(wb, `${vesselName}_All_Work_Orders_${timestamp}.xlsx`);

      toast({ title: "Export Complete", description: `Exported ${rows.length} work orders to Excel` });
    } catch (err) {
      toast({ title: "Export Failed", description: "Failed to export work orders to Excel" });
    }
    setExportingType(null);
  };

  const exportWorkOrdersPdf = () => {
    setExportingType('wo-pdf');
    try {
      const columns = [
        { header: 'S.No', field: 'sNo', width: 10 },
        { header: 'Component', field: 'component', width: 40 },
        { header: 'Work Order No', field: 'workOrderNo', width: 45 },
        { header: 'Job Title', field: 'jobTitle', width: 50 },
        { header: 'Assigned To', field: 'assignedTo', width: 25 },
        { header: 'Due Date', field: 'dueDate', width: 22 },
        { header: 'Status', field: 'status', width: 18 },
        { header: 'Criticality', field: 'criticality', width: 16 },
      ];

      const data = safeWorkOrdersList.map((wo, idx) => ({
        sNo: idx + 1,
        component: wo.component || '-',
        workOrderNo: wo.workOrderNo || wo.templateCode || '-',
        jobTitle: wo.jobTitle || '-',
        assignedTo: wo.assignedTo || '-',
        dueDate: wo.maintenanceBasis === 'Running Hours'
          ? (() => { const rh = wo.dueRH ?? (wo.nextDueReading != null ? Number(wo.nextDueReading) : null); return rh != null && !isNaN(rh) ? `${rh.toLocaleString()} RH` : '-'; })()
          : (wo.dueDate ? formatProfessionalDate(wo.dueDate) : '-'),
        status: getEffectiveStatus(wo),
        criticality: wo.criticality || '-',
      }));

      const statusCounts = safeWorkOrdersList.reduce((acc, wo) => {
        const s = getEffectiveStatus(wo);
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const summary = [
        { label: 'Total Work Orders', value: safeWorkOrdersList.length },
        { label: 'Planned', value: statusCounts['Active'] || 0 },
        { label: 'Due', value: (statusCounts['Due'] || 0) + (statusCounts['Due (Grace P)'] || 0) },
        { label: 'Overdue', value: statusCounts['Overdue'] || 0 },
        { label: 'Completed', value: statusCounts['Completed'] || 0 },
      ];

      pdfReportGenerator.generateReport(
        { title: 'All Work Orders', subtitle: 'Complete work order listing', vessel: vesselName, orientation: 'landscape' },
        columns,
        data,
        summary
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

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header with Status Tabs */}
      <div className="flex items-center justify-between relative">
        <h1 className="text-2xl font-bold text-gray-900" data-testid="C1">
          <Marker id="C1" />Work Orders (W.O)
        </h1>
        
        {/* Status Tabs - Center aligned */}
        <div className="absolute left-1/2 -translate-x-1/2 bg-gray-100 rounded-md p-1 flex items-center gap-1">
          {tabs.map((tab, index) => {
            const markerId = index === 0 ? "C4" : index === 1 ? "C5" : index === 2 ? "C6" : index === 3 ? "C7" : "C8";
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
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
          {isSailAdmin && (
          <Button 
            variant="outline" 
            size="sm"
            className="text-xs text-[#8798ad] border-[#e1e8ed]"
            onClick={() => setExportDialogOpen(true)}
            data-testid="button-export-wo"
          >
            <Download className="h-3.5 w-3.5 mr-1" />
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
            onClick={() => setUnplannedWorkOrderFormOpen(true)}
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

        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-36" data-testid="C11">
            <Marker id="C11" />
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="annual">Annual</SelectItem>
            <SelectItem value="rh-250">Due in 250 hrs</SelectItem>
            <SelectItem value="rh-500">Due in 500 hrs</SelectItem>
            <SelectItem value="rh-1000">Due in 1000 hrs</SelectItem>
          </SelectContent>
        </Select>

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

        <Select value={selectedCriticality} onValueChange={setSelectedCriticality}>
          <SelectTrigger className="w-32" data-testid="C14">
            <Marker id="C14" />
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
          className="text-gray-600"
          onClick={() => {
            setSearchTerm("");
            setSelectedPeriod("");
            setSelectedRank("");
            setSelectedCriticality("");
          }}
          data-testid="button-clear-filters"
        >
          Clear
        </Button>
      </div>

      {/* Pending Approval Summary Stat Bar */}
      {activeTab === "Pending Approval" && (() => {
        const lockedCount = filteredWorkOrders.filter(wo => (wo as any).approvalTier === "superintendent_locked").length;
        const notifiedCount = filteredWorkOrders.filter(wo => (wo as any).approvalTier === "superintendent_notification").length;
        const ceRemarksCount = filteredWorkOrders.filter(wo => (wo as any).approvalTier === "ce_with_justification").length;
        const standardCount = filteredWorkOrders.filter(wo => !(wo as any).approvalTier || (wo as any).approvalTier === "standard").length;
        const statCards = [
          { icon: Lock, label: "Locked (Supt. Required)", count: lockedCount, bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-800 dark:text-red-300", testId: "stat-locked" },
          { icon: AlertTriangle, label: "Supt. Notified", count: notifiedCount, bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-800 dark:text-orange-300", testId: "stat-supt-notified" },
          { icon: Pen, label: "CE Remarks Required", count: ceRemarksCount, bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-800 dark:text-yellow-300", testId: "stat-ce-remarks" },
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

      {/* Work Orders Table */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#52baf3] text-white sticky top-0">
            <tr>
              <th className="text-left py-3 px-4 font-medium" data-testid="C16"><Marker id="C16" />Component</th>
              <th className="text-left py-3 px-4 font-medium" data-testid="C17"><Marker id="C17" />Work Order No</th>
              {activeTab === "Pending Approval" && (
                <th className="text-left py-3 px-4 font-medium">WO Template Code</th>
              )}
              <th className="text-left py-3 px-4 font-medium" data-testid="C18"><Marker id="C18" />Job Title</th>
              <th className="text-left py-3 px-4 font-medium" data-testid="C19"><Marker id="C19" />Assigned to</th>
              <th className="text-left py-3 px-4 font-medium" data-testid="C20">
                <Marker id="C20" />
                {activeTab === "Pending Approval" || activeTab === "Completed" ? "Submitted Date" : "Due Date"}
              </th>
              {activeTab === "Pending Approval" && (
                <th className="text-left py-3 px-4 font-medium" data-testid="th-days-late">Days Late</th>
              )}
              {activeTab === "Pending Approval" && (
                <th className="text-left py-3 px-4 font-medium" data-testid="th-approval-tier">Approval Tier</th>
              )}
              <th className="text-left py-3 px-4 font-medium" data-testid="C21"><Marker id="C21" />Status</th>
              {activeTab === "Completed" && (
                <th className="text-left py-3 px-4 font-medium" data-testid="th-completed-approval-tier">Approval Tier</th>
              )}
              {activeTab === "Completed" && (
                <th className="text-left py-3 px-4 font-medium" data-testid="C22"><Marker id="C22" />Date Completed</th>
              )}
              <th className="text-center py-3 px-4 font-medium" data-testid="C23"><Marker id="C23" />Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedWorkOrders.map((workOrder, index) => {
              const isRejectedWO = workOrder.wasRejected === true;
              const textColorClass = isRejectedWO ? 'text-red-600' : 'text-gray-900';
              
              return (
              <tr 
                key={workOrder.id} 
                className={`${index % 2 === 0 ? "bg-gray-50" : "bg-white"} ${isRejectedWO ? "bg-red-50" : ""} cursor-pointer hover:bg-gray-100`}
                onClick={() => handleWorkOrderClick(workOrder)}
                data-testid={`row-work-order-${workOrder.id}`}
              >
                <td className={`py-3 px-4 ${textColorClass}`} data-testid={index === 0 ? "C24" : undefined}>
                  {index === 0 && <Marker id="C24" />}
                  {workOrder.component}
                  {isRejectedWO && activeTab === "Due" && (
                    <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">Previously Rejected</span>
                  )}
                </td>
                <td className={`py-3 px-4 ${isRejectedWO ? 'text-red-600 hover:text-red-800' : 'text-blue-600 hover:text-blue-800'}`} data-testid={index === 0 ? "C25" : undefined}>
                  {index === 0 && <Marker id="C25" />}
                  {(activeTab === "Pending Approval" || activeTab === "Completed") && workOrder.executionId 
                    ? workOrder.executionId 
                    : workOrder.workOrderNo || workOrder.templateCode}
                </td>
                {activeTab === "Pending Approval" && (
                  <td className={`py-3 px-4 ${textColorClass}`}>{workOrder.templateCode}</td>
                )}
                <td className={`py-3 px-4 ${textColorClass}`} data-testid={index === 0 ? "C26" : undefined}>
                  {index === 0 && <Marker id="C26" />}
                  <div className="flex items-center gap-1.5">
                    <span>{workOrder.jobTitle}</span>
                    {workOrder.maintenanceBasis === "Running Hours" && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap" data-testid={`badge-rh-${workOrder.id}`}>
                        RH
                      </span>
                    )}
                  </div>
                </td>
                <td className={`py-3 px-4 ${textColorClass}`} data-testid={index === 0 ? "C27" : undefined}>
                  {index === 0 && <Marker id="C27" />}
                  {workOrder.assignedTo}
                </td>
                <td className="py-3 px-4" data-testid={index === 0 ? "C28" : undefined}>
                  {index === 0 && <Marker id="C28" />}
                  <div className="flex items-center gap-2">
                    {(activeTab === "Pending Approval" || activeTab === "Completed")
                      ? (
                        <span className="text-gray-900">
                          {workOrder.submittedDate 
                            ? formatProfessionalDate(workOrder.submittedDate)
                            : '—'}
                        </span>
                      )
                      : workOrder.maintenanceBasis === "Running Hours"
                        ? (() => {
                          const rhTarget = workOrder.dueRH ?? (workOrder.nextDueReading != null ? Number(workOrder.nextDueReading) : null);
                          const rhCurrent = workOrder.currentRH ?? (workOrder.currentReading != null ? Number(workOrder.currentReading) : null);
                          const hasTarget = rhTarget != null && !isNaN(rhTarget);
                          const hasCurrent = rhCurrent != null && !isNaN(rhCurrent);
                          return (
                          <div className="relative group">
                            <span className="text-gray-900 font-medium" data-testid={`text-rh-due-${workOrder.id}`}>
                              {hasTarget ? `${rhTarget.toLocaleString()} RH` : '—'}
                            </span>
                            {hasTarget && (
                              <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
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
                        })()
                        : (
                          <>
                            <span className="text-gray-900">
                              {workOrder.dueDate 
                                ? formatProfessionalDate(workOrder.dueDate)
                                : '—'}
                            </span>
                            {workOrder.dueDate && workOrder.leadTimeValue && workOrder.leadTimeUnit && (() => {
                              const leadTimeStatus = calculateLeadTimeStatus(
                                workOrder.dueDate,
                                workOrder.leadTimeValue,
                                workOrder.leadTimeUnit
                              );
                              
                              if (leadTimeStatus.isInLeadTimePeriod) {
                                return (
                                  <div className="relative group">
                                    <AlertTriangle 
                                      className={`h-4 w-4 ${
                                        leadTimeStatus.daysUntilDue !== null && leadTimeStatus.daysUntilDue <= 3 ? 'text-red-600' : 
                                        leadTimeStatus.daysUntilDue !== null && leadTimeStatus.daysUntilDue <= 7 ? 'text-orange-500' : 
                                        'text-yellow-500'
                                      }`}
                                      data-testid={`icon-lead-time-warning-${workOrder.id}`}
                                    />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                      {leadTimeStatus.daysUntilDue} day{leadTimeStatus.daysUntilDue !== 1 ? 's' : ''} until due
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </>
                        )
                    }
                  </div>
                </td>
                {activeTab === "Pending Approval" && (
                  <td className="py-3 px-4" data-testid={`cell-days-late-${workOrder.id}`}>
                    {(() => {
                      const daysLate = (workOrder as any).daysLate;
                      if (daysLate == null || daysLate === 0) return <span className="text-green-600 text-xs font-medium">On Time</span>;
                      if (daysLate >= 1 && daysLate <= 6) return <span className="text-yellow-600 text-xs font-medium">{daysLate} days late</span>;
                      if (daysLate >= 7 && daysLate <= 14) return <span className="text-orange-600 text-xs font-medium">{daysLate} days late</span>;
                      return <span className="text-red-600 text-xs font-bold">{daysLate} days late <AlertTriangle className="inline h-3 w-3" /></span>;
                    })()}
                  </td>
                )}
                {activeTab === "Pending Approval" && (
                  <td className="py-3 px-4" data-testid={`cell-approval-tier-${workOrder.id}`}>
                    {(() => {
                      const tier = (workOrder as any).approvalTier;
                      if (tier === "superintendent_locked") return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"><Lock className="inline h-3 w-3 mr-0.5" /> Locked</span>;
                      if (tier === "superintendent_notification") return <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">Supt. Notified</span>;
                      if (tier === "ce_with_justification") return <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">CE + Remarks</span>;
                      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Standard</span>;
                    })()}
                  </td>
                )}
                <td className="py-3 px-4" data-testid={index === 0 ? "C29" : undefined}>
                  {index === 0 && <Marker id="C29" />}
                  {/* PRIORITY: Show workflow status badges (Rejected, Pending Approval) over computed status */}
                  {/* This ensures rejected WOs display "Rejected" badge prominently */}
                  {workOrder.status === 'Rejected' ? (
                    <div className="flex flex-col gap-1">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor('rejected')}`}>
                        Rejected
                      </span>
                      {/* Show due date status as secondary indicator */}
                      <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadgeColor(workOrder.computedStatus || 'Active')}`}>
                        {workOrder.computedStatus === 'Due (Grace P)' ? 'Grace P' : (workOrder.computedStatus || 'Active')}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(getEffectiveStatus(workOrder))}`}>
                        {getEffectiveStatus(workOrder) === 'Due (Grace P)' 
                          ? 'Grace P' 
                          : getEffectiveStatus(workOrder)}
                      </span>
                      {(workOrder as any).missedCycles >= 1 && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500 text-white" data-testid={`badge-skipped-cycles-${workOrder.id}`}>
                          ⚠ {(workOrder as any).missedCycles} Cycle{(workOrder as any).missedCycles > 1 ? 's' : ''} Skipped
                        </span>
                      )}
                    </div>
                  )}
                </td>
                {activeTab === "Completed" && (
                  <td className="py-3 px-4" data-testid={`cell-completed-approval-tier-${workOrder.id}`}>
                    {(() => {
                      const tier = (workOrder as any).approvalTier;
                      if (tier === "superintendent_locked") return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"><Lock className="inline h-3 w-3 mr-0.5" /> Locked</span>;
                      if (tier === "superintendent_notification") return <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">Supt. Notified</span>;
                      if (tier === "ce_with_justification") return <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">CE + Remarks</span>;
                      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Standard</span>;
                    })()}
                  </td>
                )}
                {activeTab === "Completed" && (
                  <td className="py-3 px-4 text-gray-900" data-testid={index === 0 ? "C30" : undefined}>
                    {index === 0 && <Marker id="C30" />}
                    {formatProfessionalDate(workOrder.dateCompleted)}
                  </td>
                )}
                <td className="py-3 px-4">
                  <div className="flex items-center justify-center gap-2">
                    {activeTab === "Pending Approval" && (workOrder as any).approvalTier === "superintendent_locked" ? (
                      <div className="relative group" data-testid={`locked-action-${workOrder.id}`}>
                        <Lock className="h-4 w-4 text-gray-400" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          Locked — Awaiting Superintendent acknowledgment
                        </div>
                      </div>
                    ) : (
                      <>
                        {getEffectiveStatus(workOrder) !== "Completed" && (
                          <>
                            <button 
                              className="p-1 hover:bg-gray-200 rounded"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePencilClick(workOrder);
                              }}
                              title="Edit Template"
                              data-testid={index === 0 ? "C31" : `button-edit-wo-${workOrder.id}`}
                            >
                              {index === 0 && <Marker id="C31" />}
                              <Pen className="h-4 w-4 text-gray-600" />
                            </button>
                            {!isVessel && getEffectiveStatus(workOrder) !== "Pending Approval" && (
                              <button 
                                className="p-1 hover:bg-gray-200 rounded"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTimerClick(workOrder);
                                }}
                                title="Postpone Work Order"
                                data-testid={index === 0 ? "C32" : `button-postpone-wo-${workOrder.id}`}
                              >
                                {index === 0 && <Marker id="C32" />}
                                <Timer className="h-4 w-4 text-gray-600" />
                              </button>
                            )}
                          </>
                        )}
                        {getEffectiveStatus(workOrder) === "Completed" && (
                          <button 
                            className="p-1 hover:bg-gray-200 rounded"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleWorkOrderClick(workOrder);
                            }}
                            title="View Work Order"
                            data-testid={`button-view-wo-${workOrder.id}`}
                          >
                            <Eye className="h-4 w-4 text-gray-600" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
            </tbody>
          </table>
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
                <span className="font-medium text-gray-900">Export All Work Orders</span>
              </div>
              <p className="text-sm text-gray-500">Complete listing of all work orders with status, due dates, and assignments</p>
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