import React, { useState, useEffect } from "react";
import { Search, Plus, Pen, Timer } from "lucide-react";
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
import { WorkOrder, InsertWorkOrder } from "@shared/schema";
import { ComputedWorkOrderStatus } from "@shared/workOrders/status";
import { useToast } from "@/hooks/use-toast";
import { VESSELS } from "@/lib/vessels";
import { formatProfessionalDate } from "@/lib/dateUtils";

// Extend WorkOrder type to include computedStatus from backend
type WorkOrderWithComputedStatus = WorkOrder & {
  computedStatus?: ComputedWorkOrderStatus;
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
  const [selectedComponent, setSelectedComponent] = useState("");
  const [selectedCriticality, setSelectedCriticality] = useState("");
  const [activeTab, setActiveTab] = useState("All W.O");
  const [postponeDialogOpen, setPostponeDialogOpen] = useState(false);
  const [unplannedWorkOrderFormOpen, setUnplannedWorkOrderFormOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  
  // Modify mode integration  
  const { isModifyMode, targetId, fieldChanges } = useModifyMode();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { vesselId, setVesselId } = useVessel();
  
  // Fetch work orders using React Query (includes computedStatus from backend)
  const { data: workOrdersList = [], isLoading, error } = useQuery<WorkOrderWithComputedStatus[]>({
    queryKey: ['/api/work-orders', vesselId],
    queryFn: async () => {
      const response = await fetch(`/api/work-orders?vesselId=${vesselId}`);
      if (!response.ok) throw new Error('Failed to fetch work orders');
      return await response.json() as WorkOrderWithComputedStatus[];
    },
    enabled: !!vesselId, // Only fetch when vesselId is available
  });
  
  // Create work order mutation
  const createWorkOrderMutation = useMutation({
    mutationFn: async (data: InsertWorkOrder) => {
      const response = await apiRequest('POST', '/api/work-orders', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-orders', vesselId] });
      toast({ title: "Success", description: "Work order created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create work order" });
    }
  });
  
  // Update work order mutation
  const updateWorkOrderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertWorkOrder> }) => {
      const response = await apiRequest('PATCH', `/api/work-orders/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-orders', vesselId] });
      toast({ title: "Success", description: "Work order updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update work order" });
    }
  });
  
  // Delete work order mutation
  const deleteWorkOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/work-orders/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-orders', vesselId] });
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
  const tabs = [
    { id: "All W.O", label: "All W.O", count: safeWorkOrdersList.filter(wo => !wo.isExecution).length },
    { id: "Due", label: "Due", count: safeWorkOrdersList.filter(wo => !wo.isExecution && (wo.computedStatus === "Due" || wo.computedStatus === "Due (Grace P)")).length },
    { id: "Pending Approval", label: "Pending Approval", count: safeWorkOrdersList.filter(wo => wo.computedStatus === "Pending Approval").length },
    { id: "Overdue", label: "Overdue", count: safeWorkOrdersList.filter(wo => !wo.isExecution && wo.computedStatus === "Overdue").length },
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
      case "due (grace p)":
        return "bg-orange-100 text-orange-800";
      case "overdue":
        return "bg-red-100 text-red-800";
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
    
    if (activeTab === "All W.O") {
      // Show templates and rejected executions
      if (wo.isExecution && effectiveStatus !== "Rejected") return false;
    } else if (activeTab === "Due") {
      if (wo.isExecution) return false;
      if (effectiveStatus !== "Due" && effectiveStatus !== "Due (Grace P)") return false;
    } else if (activeTab === "Overdue") {
      if (wo.isExecution) return false;
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
    
    return true;
  });

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
      dueDate: postponeData.nextDueDate
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
          <h1 className="text-xl font-semibold text-gray-900">Work Orders (W.O)</h1>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white"
              onClick={handleAddWorkOrderClick}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add W.O
            </Button>
            <Button 
              size="sm" 
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => setUnplannedWorkOrderFormOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Unplanned W.O
            </Button>
          </div>
        </div>
        
        {/* Status Tabs */}
        <div className="flex items-center gap-1 px-4 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-[#52baf3] text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 p-4 bg-gray-50 border-b border-gray-200">
        <Select value={vesselId} onValueChange={setVesselId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select Vessel" />
          </SelectTrigger>
          <SelectContent>
            {VESSELS.map(vessel => (
              <SelectItem key={vessel.id} value={vessel.id}>
                {vessel.id} - {vessel.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search Work Orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-24">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="annual">Annual</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedRank} onValueChange={setSelectedRank}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="All Ranks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="chief">Chief Engineer</SelectItem>
            <SelectItem value="2nd">2nd Engineer</SelectItem>
            <SelectItem value="3rd">3rd Engineer</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedComponent} onValueChange={setSelectedComponent}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Component" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="engine">Main Engine</SelectItem>
            <SelectItem value="generator">Diesel Generator</SelectItem>
            <SelectItem value="pump">Pumps</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedCriticality} onValueChange={setSelectedCriticality}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Criticality" />
          </SelectTrigger>
          <SelectContent>
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
              <th className="text-left py-3 px-4 font-medium">Component</th>
              <th className="text-left py-3 px-4 font-medium">
                {activeTab === "Pending Approval" || activeTab === "Completed" ? "WO Execution ID" : "Work Order No"}
              </th>
              {activeTab === "Pending Approval" && (
                <th className="text-left py-3 px-4 font-medium">WO Template Code</th>
              )}
              <th className="text-left py-3 px-4 font-medium">Job Title</th>
              <th className="text-left py-3 px-4 font-medium">Assigned to</th>
              <th className="text-left py-3 px-4 font-medium">
                {activeTab === "Pending Approval" || activeTab === "Completed" ? "Submitted Date" : "Due Date"}
              </th>
              <th className="text-left py-3 px-4 font-medium">Status</th>
              {activeTab !== "Pending Approval" && (
                <th className="text-left py-3 px-4 font-medium">Date Completed</th>
              )}
              <th className="text-center py-3 px-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredWorkOrders.map((workOrder, index) => (
              <tr 
                key={workOrder.id} 
                className={`${index % 2 === 0 ? "bg-gray-50" : "bg-white"} cursor-pointer hover:bg-gray-100`}
                onClick={() => handleWorkOrderClick(workOrder)}
              >
                <td className="py-3 px-4 text-gray-900">{workOrder.component}</td>
                <td className="py-3 px-4 text-blue-600 hover:text-blue-800">
                  {(activeTab === "Pending Approval" || activeTab === "Completed") && workOrder.executionId 
                    ? workOrder.executionId 
                    : workOrder.templateCode || workOrder.workOrderNo}
                </td>
                {activeTab === "Pending Approval" && (
                  <td className="py-3 px-4 text-gray-900">{workOrder.templateCode}</td>
                )}
                <td className="py-3 px-4 text-gray-900">{workOrder.jobTitle}</td>
                <td className="py-3 px-4 text-gray-900">{workOrder.assignedTo}</td>
                <td className="py-3 px-4 text-gray-900">
                  {(activeTab === "Pending Approval" || activeTab === "Completed") && workOrder.submittedDate 
                    ? formatProfessionalDate(workOrder.submittedDate)
                    : formatProfessionalDate(workOrder.dueDate)}
                </td>
                <td className="py-3 px-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(workOrder.computedStatus || workOrder.status || 'Active')}`}>
                    {workOrder.computedStatus || workOrder.status || 'Active'}
                  </span>
                </td>
                {activeTab !== "Pending Approval" && (
                  <td className="py-3 px-4 text-gray-900">{formatProfessionalDate(workOrder.dateCompleted)}</td>
                )}
                <td className="py-3 px-4">
                  <div className="flex items-center justify-center gap-2">
                    <button 
                      className="p-1 hover:bg-gray-200 rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePencilClick(workOrder);
                      }}
                      title="Edit Template"
                    >
                      <Pen className="h-4 w-4 text-gray-600" />
                    </button>
                    <button 
                      className="p-1 hover:bg-gray-200 rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTimerClick(workOrder);
                      }}
                      title="Postpone Work Order"
                    >
                      <Timer className="h-4 w-4 text-gray-600" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            </tbody>
          </table>
      </div>

      {/* Footer */}
      <div className="p-4 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
        Page 0 of 0
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