import React, { useState, useEffect } from "react";
import { Search, Plus, Pen, Timer } from "lucide-react";
import { useLocation } from "wouter";
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
import WorkOrderForm from "@/components/WorkOrderForm";
import UnplannedWorkOrderForm from "@/components/UnplannedWorkOrderForm";
import { useModifyMode } from "@/hooks/useModifyMode";
import { ModifyFieldWrapper } from "@/components/modify/ModifyFieldWrapper";
import { ModifyStickyFooter } from "@/components/modify/ModifyStickyFooter";
import { WorkOrder, InsertWorkOrder } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

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
  const [selectedVessel, setSelectedVessel] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedRank, setSelectedRank] = useState("");
  const [selectedComponent, setSelectedComponent] = useState("");
  const [selectedCriticality, setSelectedCriticality] = useState("");
  const [activeTab, setActiveTab] = useState("All W.O");
  const [postponeDialogOpen, setPostponeDialogOpen] = useState(false);
  const [workOrderFormOpen, setWorkOrderFormOpen] = useState(false);
  const [unplannedWorkOrderFormOpen, setUnplannedWorkOrderFormOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  
  // Modify mode integration  
  const { isModifyMode, targetId, fieldChanges } = useModifyMode();
  const [location] = useLocation();
  const { toast } = useToast();
  
  // Fetch work orders using React Query
  const vesselId = "V001"; // Default vessel ID
  const { data: workOrdersList = [], isLoading, error } = useQuery<WorkOrder[]>({
    queryKey: ['/api/work-orders', vesselId],
    enabled: true, // Always fetch on mount
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
    
    // Auto-open work order form if navigating from "View Changes"
    if (previewChanges === '1' && targetType === 'workOrder' && previewTargetId) {
      const targetWorkOrder = workOrdersList.find(wo => wo.id === previewTargetId);
      if (targetWorkOrder) {
        setSelectedWorkOrder(targetWorkOrder);
        setWorkOrderFormOpen(true);
      }
    }
  }, [location, workOrdersList]);

  const handleWorkOrderSubmit = (workOrderId: string, formData?: any) => {
    if (formData?.type === 'execution') {
      // Generate execution ID
      const year = new Date().getFullYear();
      const templateCode = formData.data.templateCode || formData.data.woTemplateCode;
      
      // Find existing executions for this template to get the next sequence number
      const existingExecutions = workOrdersList.filter(wo => 
        wo.isExecution && wo.templateId === workOrderId && 
        wo.executionId?.startsWith(`${year}-${templateCode}`)
      );
      const sequence = String(existingExecutions.length + 1).padStart(2, '0');
      const executionId = `${year}-${templateCode}-${sequence}`;
      
      // Create new execution record
      const executionData: InsertWorkOrder = {
        vesselId: vesselId,
        component: formData.data.component,
        componentCode: formData.data.componentCode,
        workOrderNo: executionId,
        templateCode: templateCode,
        executionId: executionId,
        jobTitle: formData.data.woTitle || formData.data.jobTitle,
        assignedTo: formData.data.assignedTo,
        dueDate: formData.data.dueDate || "",
        status: "Pending Approval",
        submittedDate: new Date().toISOString().split('T')[0],
        formData: formData.data,
        isExecution: true,
        templateId: workOrderId
      };
      
      createWorkOrderMutation.mutate(executionData, {
        onSuccess: () => {
          setActiveTab("Pending Approval");
        }
      });
    } else if (formData?.type === 'template') {
      // Update template
      const updateData = {
        ...formData.data,
        templateCode: formData.data.woTemplateCode || formData.data.templateCode
      };
      
      updateWorkOrderMutation.mutate({ id: workOrderId, data: updateData });
    } else if (formData?.type === 'new') {
      // Create new work order
      const newWorkOrderData: InsertWorkOrder = {
        vesselId: vesselId,
        ...formData.data,
        templateCode: formData.data.woTemplateCode || formData.data.templateCode || generateTemplateCode(
          formData.data.componentCode || "",
          formData.data.taskType || "",
          formData.data.maintenanceBasis || "Calendar",
          formData.data.frequencyValue || "",
          formData.data.frequencyUnit
        )
      };
      
      createWorkOrderMutation.mutate(newWorkOrderData);
    }
  };

  const tabs = [
    { id: "All W.O", label: "All W.O", count: workOrdersList.filter(wo => !wo.isExecution).length },
    { id: "Due", label: "Due", count: workOrdersList.filter(wo => !wo.isExecution && (wo.status === "Due" || wo.status.includes("Grace"))).length },
    { id: "Pending Approval", label: "Pending Approval", count: workOrdersList.filter(wo => wo.isExecution && wo.status === "Pending Approval").length },
    { id: "Overdue", label: "Overdue", count: workOrdersList.filter(wo => !wo.isExecution && wo.status === "Overdue").length },
    { id: "Completed", label: "Completed", count: workOrdersList.filter(wo => (!wo.isExecution && wo.status === "Completed") || (wo.isExecution && wo.status === "Approved")).length }
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

  const filteredWorkOrders = workOrdersList.filter(wo => {
    if (activeTab === "All W.O") {
      // Show templates and rejected executions
      if (wo.isExecution && wo.status !== "Rejected") return false;
    } else if (activeTab === "Due") {
      if (wo.isExecution) return false;
      if (wo.status !== "Due" && !wo.status.includes("Grace")) return false;
    } else if (activeTab === "Overdue") {
      if (wo.isExecution) return false;
      if (wo.status !== "Overdue") return false;
    } else if (activeTab === "Completed") {
      // Show both completed templates and approved executions
      if (!wo.isExecution && wo.status !== "Completed") return false;
      if (wo.isExecution && wo.status !== "Approved") return false;
    } else if (activeTab === "Pending Approval") {
      // Show only execution records with Pending Approval status
      if (!wo.isExecution || wo.status !== "Pending Approval") return false;
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
    setSelectedWorkOrder(workOrder);
    
    // If in modify mode, activate modify mode for this specific work order
    if (isModifyMode) {
      // The modify mode is already active via URL params
      // Just open the form and it will detect modify mode automatically
      setWorkOrderFormOpen(true);
    } else {
      setWorkOrderFormOpen(true);
    }
  };

  const handlePencilClick = (workOrder: WorkOrder) => {
    setSelectedWorkOrder(workOrder);
    setWorkOrderFormOpen(true);
  };

  const handleTimerClick = (workOrder: WorkOrder) => {
    setSelectedWorkOrder(workOrder);
    setPostponeDialogOpen(true);
  };

  const handleApprove = (workOrderId: string, approverRemarks?: string) => {
    const workOrder = workOrdersList.find(wo => wo.executionId === workOrderId || wo.id === workOrderId);
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
    
    updateWorkOrderMutation.mutate({ id: workOrderId, data: updateData });
  };

  const handleReject = (workOrderId: string, rejectionComments: string) => {
    const updateData = {
      status: "Rejected",
      approver: "Current User", // Replace with actual user
      approverRemarks: rejectionComments,
      rejectionDate: new Date().toISOString()
    };
    
    updateWorkOrderMutation.mutate({ id: workOrderId, data: updateData });
  };

  const handlePostponeConfirm = (workOrderId: string, postponeData: any) => {
    const updateData = {
      status: "Postponed",
      dueDate: postponeData.nextDueDate
    };
    
    updateWorkOrderMutation.mutate({ id: workOrderId, data: updateData });
  };

  const handleAddWorkOrderClick = () => {
    // Create a temporary work order object for the form
    const newWorkOrder = {
      id: `new-${Date.now()}`,
      component: "",
      componentCode: "",
      workOrderNo: "",
      templateCode: "",
      jobTitle: "",
      assignedTo: "",
      dueDate: "",
      status: "Draft",
      vesselId: vesselId
    } as WorkOrder;
    setSelectedWorkOrder(newWorkOrder);
    setWorkOrderFormOpen(true);
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
        <Select value={selectedVessel} onValueChange={setSelectedVessel}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Vessel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vessel1">Vessel 1</SelectItem>
            <SelectItem value="vessel2">Vessel 2</SelectItem>
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
                {activeTab === "Pending Approval" ? "WO Execution ID" : "Work Order No"}
              </th>
              {activeTab === "Pending Approval" && (
                <th className="text-left py-3 px-4 font-medium">WO Template Code</th>
              )}
              <th className="text-left py-3 px-4 font-medium">Job Title</th>
              <th className="text-left py-3 px-4 font-medium">Assigned to</th>
              <th className="text-left py-3 px-4 font-medium">
                {activeTab === "Pending Approval" ? "Submitted Date" : "Due Date"}
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
                  {activeTab === "Pending Approval" && workOrder.executionId 
                    ? workOrder.executionId 
                    : workOrder.templateCode || workOrder.workOrderNo}
                </td>
                {activeTab === "Pending Approval" && (
                  <td className="py-3 px-4 text-gray-900">{workOrder.templateCode}</td>
                )}
                <td className="py-3 px-4 text-gray-900">{workOrder.jobTitle}</td>
                <td className="py-3 px-4 text-gray-900">{workOrder.assignedTo}</td>
                <td className="py-3 px-4 text-gray-900">
                  {activeTab === "Pending Approval" && workOrder.submittedDate 
                    ? workOrder.submittedDate 
                    : workOrder.dueDate}
                </td>
                <td className="py-3 px-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(workOrder.status)}`}>
                    {workOrder.status}
                  </span>
                </td>
                {activeTab !== "Pending Approval" && (
                  <td className="py-3 px-4 text-gray-900">{workOrder.dateCompleted || ""}</td>
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

      {/* Work Order Form */}
      <WorkOrderForm
        isOpen={workOrderFormOpen}
        onClose={() => setWorkOrderFormOpen(false)}
        onSubmit={handleWorkOrderSubmit}
        onApprove={handleApprove}
        onReject={handleReject}
        workOrder={selectedWorkOrder}
        isApprovalMode={activeTab === "Pending Approval" && selectedWorkOrder?.status === "Pending Approval"}
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