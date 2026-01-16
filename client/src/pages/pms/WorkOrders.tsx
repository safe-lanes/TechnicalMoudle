import React, { useState, useEffect, useMemo } from "react";
import { Search, Plus, Pen, Timer, AlertTriangle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye } from "lucide-react";
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
  
  // Use computedStatus for tab counts (automatic status calculation)
  // Planned tab shows work orders with Active status (not yet in warning window) + Postponed items
  // Due tab shows only items within warning window (≤30 days / ≤720 RH) but NOT past due
  // Overdue tab shows both Grace P (within tolerance) and Overdue (breach) items
  const tabs = [
    { id: "Planned", label: "Planned", count: safeWorkOrdersList.filter(wo => {
      if (wo.isExecution) return false;
      const effectiveStatus = wo.computedStatus || wo.status || 'Active';
      return effectiveStatus === "Active" || effectiveStatus === "Postponed";
    }).length },
    { id: "Due", label: "Due", count: safeWorkOrdersList.filter(wo => {
      // Allow rejected executions (they need rework), but exclude other executions
      const isRejectedExecution = wo.isExecution && wo.status === 'Rejected';
      if (wo.isExecution && !isRejectedExecution) return false;
      const effectiveStatus = wo.computedStatus || wo.status || 'Active';
      // Due tab: items within warning window + Grace P (past due but within tolerance)
      return effectiveStatus === "Due" || effectiveStatus === "Due (Grace P)";
    }).length },
    { id: "Overdue", label: "Overdue", count: safeWorkOrdersList.filter(wo => {
      // Allow rejected executions (they need rework), but exclude other executions
      const isRejectedExecution = wo.isExecution && wo.status === 'Rejected';
      if (wo.isExecution && !isRejectedExecution) return false;
      const effectiveStatus = wo.computedStatus || wo.status || 'Active';
      // Overdue tab: only breach items (past tolerance/grace period)
      return effectiveStatus === "Overdue";
    }).length },
    { id: "Pending Approval", label: "Pending Approval", count: safeWorkOrdersList.filter(wo => wo.computedStatus === "Pending Approval").length },
    { id: "Completed", label: "Completed", count: safeWorkOrdersList.filter(wo => wo.computedStatus === "Completed").length }
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

  // Filter work orders using computedStatus (automatic real-time status)
  const filteredWorkOrders = safeWorkOrdersList.filter(wo => {
    // Ensure computedStatus is always defined (defensive check)
    const effectiveStatus = wo.computedStatus || wo.status || 'Active';
    
    if (activeTab === "Planned") {
      // Planned tab: Show templates with Active status + Postponed items
      // Note: Rejected work orders now appear in Due/Overdue/Active tabs based on their computed due date status
      if (wo.isExecution) return false;
      // Only show Active and Postponed statuses in Planned tab
      if (effectiveStatus !== "Active" && effectiveStatus !== "Postponed") return false;
    } else if (activeTab === "Due") {
      // Allow rejected executions (they need rework), but exclude other executions
      const isRejectedExecution = wo.isExecution && wo.status === 'Rejected';
      if (wo.isExecution && !isRejectedExecution) return false;
      // Due tab: items within warning window + Grace P (past due but within tolerance)
      if (effectiveStatus !== "Due" && effectiveStatus !== "Due (Grace P)") return false;
    } else if (activeTab === "Overdue") {
      // Allow rejected executions (they need rework), but exclude other executions
      const isRejectedExecution = wo.isExecution && wo.status === 'Rejected';
      if (wo.isExecution && !isRejectedExecution) return false;
      // Overdue tab: only breach items (past tolerance/grace period)
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
    
    // Calculate next due date/reading
    let nextDueDate = undefined;
    let nextDueReading = undefined;
    
    if (workOrder.maintenanceBasis === "Calendar") {
      const completionDate = new Date();
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
    } else if (workOrder.maintenanceBasis === "Running Hours" && workOrder.currentReading) {
      nextDueReading = (parseInt(workOrder.currentReading) + parseInt(workOrder.frequencyValue || "0")).toString();
    }
    
    const updateData = {
      status: "Approved",
      dateCompleted: new Date().toISOString().split('T')[0],
      approver: "Current User", // Replace with actual user
      approverRemarks,
      approvalDate: new Date().toISOString(),
      nextDueDate,
      nextDueReading
    };
    
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
    // Navigate to new work order page (full-screen)
    // Note: We'll need to update the route to handle creating new work orders without a component
    setLocation('/pms/work-order/new/general');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with Status Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-xl font-semibold text-gray-900" data-testid="C1">
            <Marker id="C1" />Work Orders (W.O)
          </h1>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white"
              onClick={handleAddWorkOrderClick}
              data-testid="C2"
            >
              <Marker id="C2" />
              <Plus className="h-4 w-4 mr-1" />
              Add W.O
            </Button>
            <Button 
              size="sm" 
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => setUnplannedWorkOrderFormOpen(true)}
              data-testid="C3"
            >
              <Marker id="C3" />
              <Plus className="h-4 w-4 mr-1" />
              Unplanned W.O
            </Button>
          </div>
        </div>
        
        {/* Status Tabs */}
        <div className="flex items-center gap-1 px-4 pb-2">
          {tabs.map((tab, index) => {
            const markerId = index === 0 ? "C4" : index === 1 ? "C5" : index === 2 ? "C6" : index === 3 ? "C7" : "C8";
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-[#52baf3] text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300"
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
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 p-4 bg-gray-50 border-b border-gray-200">
        <Select value={vesselId} onValueChange={setVesselId}>
          <SelectTrigger className="w-48" data-testid="C15">
            <Marker id="C15" />
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

        <div className="relative flex-1 max-w-sm" data-testid="C10">
          <Marker id="C10" />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search Work Orders..."
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
      </div>

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
              <th className="text-left py-3 px-4 font-medium" data-testid="C21"><Marker id="C21" />Status</th>
              {activeTab !== "Pending Approval" && (
                <th className="text-left py-3 px-4 font-medium" data-testid="C22"><Marker id="C22" />Date Completed</th>
              )}
              <th className="text-center py-3 px-4 font-medium" data-testid="C23"><Marker id="C23" />Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedWorkOrders.map((workOrder, index) => (
              <tr 
                key={workOrder.id} 
                className={`${index % 2 === 0 ? "bg-gray-50" : "bg-white"} cursor-pointer hover:bg-gray-100`}
                onClick={() => handleWorkOrderClick(workOrder)}
              >
                <td className="py-3 px-4 text-gray-900" data-testid={index === 0 ? "C24" : undefined}>
                  {index === 0 && <Marker id="C24" />}
                  {workOrder.component}
                </td>
                <td className="py-3 px-4 text-blue-600 hover:text-blue-800" data-testid={index === 0 ? "C25" : undefined}>
                  {index === 0 && <Marker id="C25" />}
                  {(activeTab === "Pending Approval" || activeTab === "Completed") && workOrder.executionId 
                    ? workOrder.executionId 
                    : workOrder.workOrderNo || workOrder.templateCode}
                </td>
                {activeTab === "Pending Approval" && (
                  <td className="py-3 px-4 text-gray-900">{workOrder.templateCode}</td>
                )}
                <td className="py-3 px-4 text-gray-900" data-testid={index === 0 ? "C26" : undefined}>
                  {index === 0 && <Marker id="C26" />}
                  {workOrder.jobTitle}
                </td>
                <td className="py-3 px-4 text-gray-900" data-testid={index === 0 ? "C27" : undefined}>
                  {index === 0 && <Marker id="C27" />}
                  {workOrder.assignedTo}
                </td>
                <td className="py-3 px-4" data-testid={index === 0 ? "C28" : undefined}>
                  {index === 0 && <Marker id="C28" />}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900">
                      {(activeTab === "Pending Approval" || activeTab === "Completed")
                        ? (workOrder.submittedDate 
                            ? formatProfessionalDate(workOrder.submittedDate)
                            : '—')
                        : workOrder.dueDate 
                          ? formatProfessionalDate(workOrder.dueDate)
                          : '—'}
                    </span>
                    {activeTab !== "Pending Approval" && activeTab !== "Completed" && workOrder.dueDate && workOrder.leadTimeValue && workOrder.leadTimeUnit && (() => {
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
                  </div>
                </td>
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
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(workOrder.computedStatus || workOrder.status || 'Active')}`}>
                      {/* Display "Grace P" instead of "Due (Grace P)" for cleaner badge label */}
                      {(workOrder.computedStatus || workOrder.status || 'Active') === 'Due (Grace P)' 
                        ? 'Grace P' 
                        : (workOrder.computedStatus || workOrder.status || 'Active')}
                    </span>
                  )}
                </td>
                {activeTab !== "Pending Approval" && (
                  <td className="py-3 px-4 text-gray-900" data-testid={index === 0 ? "C30" : undefined}>
                    {index === 0 && <Marker id="C30" />}
                    {formatProfessionalDate(workOrder.dateCompleted)}
                  </td>
                )}
                <td className="py-3 px-4">
                  <div className="flex items-center justify-center gap-2">
                    {/* Hide Edit and Postpone buttons for Completed work orders (immutable records) */}
                    {(workOrder.computedStatus || workOrder.status) !== "Completed" && (
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
                      </>
                    )}
                    {/* View button - always available (clicking the row also opens view) */}
                    {(workOrder.computedStatus || workOrder.status) === "Completed" && (
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
                  </div>
                </td>
              </tr>
            ))}
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