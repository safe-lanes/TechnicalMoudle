import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, FileText, ArrowLeft, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import WorkInstructionsDialog from "./WorkInstructionsDialog";
import { useToast } from "@/hooks/use-toast";
import { useModifyMode } from "@/hooks/useModifyMode";
import { ModifyFieldWrapper } from "@/components/modify/ModifyFieldWrapper";
import { ModifyStickyFooter } from "@/components/modify/ModifyStickyFooter";
import { generateSuggestions, extractContextFromWorkOrder, type WorkOrderContext } from "@/utils/suggestionEngine";
import { FEATURES, IHM_ACTIONS } from '@/config/features';

interface WorkOrderFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (workOrderId: string, formData?: any) => void;
  onApprove?: (workOrderId: string, approverRemarks?: string) => void;
  onReject?: (workOrderId: string, rejectionComments: string) => void;
  component?: {
    code: string;
    name: string;
  };
  workOrder?: any;
  isApprovalMode?: boolean;
}

const WorkOrderForm: React.FC<WorkOrderFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onApprove,
  onReject,
  component,
  workOrder,
  isApprovalMode = false
}) => {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<'partA' | 'partB'>('partA');
  const [isWorkInstructionsOpen, setIsWorkInstructionsOpen] = useState(false);
  const [rejectionComments, setRejectionComments] = useState("");
  const [showRejectionComments, setShowRejectionComments] = useState(false);
  const [location, setLocation] = useLocation();
  
  // Preview mode state 
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [changeRequestData, setChangeRequestData] = useState<any>(null);
  const [previewChanges, setPreviewChanges] = useState<any>({});
  
  // Quick Input functionality for Work Carried Out
  const workCarriedOutRef = useRef<HTMLTextAreaElement>(null);
  const [showQuickInputs, setShowQuickInputs] = useState(false);
  
  // Smart Suggestions functionality
  const [showSmartSuggestions, setShowSmartSuggestions] = useState(false);
  const [smartSuggestions, setSmartSuggestions] = useState<string[]>([]);
  
  // Predefined quick answers for Work Carried Out
  const quickAnswers = [
    "Work carried out, found satisfactory.",
    "Checked and tested, no defects observed.",
    "Alarm tested, found satisfactory.",
    "Routine maintenance carried out as per PMS.",
    "Equipment inspected, found in good condition.",
    "Lubrication/oiling carried out, parameters normal.",
    "Work completed, system restored to normal.",
    "Trial conducted, performance satisfactory.",
    "Defect rectified, equipment put back in service.",
    "Cleaning carried out, area left tidy."
  ];
  
  // Modify mode integration
  const { isModifyMode, targetId, fieldChanges, trackFieldChange, setOriginalSnapshot } = useModifyMode();
  
  // Debug logging
  console.log("WorkOrderForm Debug:", { isModifyMode, targetId, fieldChanges, isOpen });
  
  // Preview mode detection from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const previewChanges = urlParams.get('previewChanges');
    const changeRequestId = urlParams.get('changeRequestId');
    const targetType = urlParams.get('targetType');
    const previewTargetId = urlParams.get('targetId');
    
    if (previewChanges === '1' && changeRequestId && targetType === 'workOrder') {
      setIsPreviewMode(true);
      
      // Fetch change request data to get proposed changes
      fetch(`/api/change-requests/${changeRequestId}`)
        .then(res => res.json())
        .then(data => {
          setChangeRequestData(data);
          
          // Convert proposed changes to a lookup map for easy access
          const changes: any = {};
          if (data.proposedChangesJson) {
            data.proposedChangesJson.forEach((change: any) => {
              changes[change.field] = {
                oldValue: change.oldValue,
                newValue: change.newValue
              };
            });
          }
          setPreviewChanges(changes);
        })
        .catch(error => {
          console.error('Failed to fetch change request data:', error);
        });
    } else {
      setIsPreviewMode(false);
      setChangeRequestData(null);
      setPreviewChanges({});
    }
  }, [location, isOpen]);
  
  // Functions for preview mode
  const hasPreviewChange = (fieldName: string) => {
    return previewChanges[fieldName] !== undefined;
  };
  
  const getPreviewValue = (fieldName: string) => {
    return previewChanges[fieldName]?.newValue || '';
  };
  
  // Quick Input function to insert text at cursor position
  const insertQuickText = (text: string) => {
    const textarea = workCarriedOutRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = executionData.workCarriedOut;
    
    // Insert text at cursor position (or replace selection)
    const beforeCursor = currentValue.substring(0, start);
    const afterCursor = currentValue.substring(end);
    
    // Add newline if there's existing text and cursor is not at the beginning
    const prefix = beforeCursor && start > 0 ? '\n' : '';
    const newValue = beforeCursor + prefix + text + afterCursor;
    
    // Update the state
    handleExecutionChange('workCarriedOut', newValue);
    
    // Focus back to textarea and set cursor after inserted text
    setTimeout(() => {
      textarea.focus();
      const newCursorPosition = start + prefix.length + text.length;
      textarea.setSelectionRange(newCursorPosition, newCursorPosition);
    }, 0);
  };
  
  // Smart Suggestions function to generate context-aware suggestions
  const generateSmartSuggestions = () => {
    try {
      const context = extractContextFromWorkOrder(workOrder, executionData);
      const suggestions = generateSuggestions(context);
      setSmartSuggestions(suggestions);
    } catch (error) {
      console.error('Error generating smart suggestions:', error);
      setSmartSuggestions([]);
    }
  };
  
  // Function to insert suggestion text (reuses Quick Input logic)
  const insertSuggestion = (text: string) => {
    insertQuickText(text);
  };
  
  // Toggle Smart Suggestions and generate on first open
  const toggleSmartSuggestions = () => {
    const newShowState = !showSmartSuggestions;
    setShowSmartSuggestions(newShowState);
    
    if (newShowState && smartSuggestions.length === 0) {
      generateSmartSuggestions();
    }
  };
  
  // Check if we're in execution mode (Part B)
  const executionMode = workOrder?.executionMode === true;
  
  // Check if form should be read-only - BUT in modify mode, make it editable
  const isReadOnly = !isModifyMode && (workOrder?.status === "Pending Approval" || workOrder?.status === "Approved" || isApprovalMode);

  // Template data (Part A)
  const [templateData, setTemplateData] = useState({
    woTitle: "",
    component: workOrder?.component || component?.name || "",
    componentCode: workOrder?.componentCode || component?.code || "",
    woTemplateCode: "",
    maintenanceBasis: "Calendar",
    frequencyValue: "",
    frequencyUnit: "Months",
    taskType: "Inspection",
    assignedTo: "",
    approver: "",
    jobPriority: "Medium",
    classRelated: "No",
    briefWorkDescription: "",
    nextDueDate: "",
    nextDueReading: "",
    requiredSpareParts: [],
    requiredTools: [],
    safetyRequirements: {
      ppe: "",
      permits: "",
      other: ""
    },
    workHistory: []
  });

  // Execution data (Part B)
  const [executionData, setExecutionData] = useState({
    woExecutionId: "",
    riskAssessment: "No",
    safetyChecklists: "No",
    operationalForms: "No",
    startDateTime: "",
    completionDateTime: "",
    assignedTo: "",
    performedBy: "",
    noOfPersons: "",
    totalTimeHours: "",
    manhours: "",
    workCarriedOut: "",
    jobExperienceNotes: "",
    previousReading: "",
    currentReading: "",
    sparePartsConsumed: [],
    // IHM fields
    ihmUpdate: {
      enabled: false,
      action: "",
      targetComponent: "",
      targetSpare: "",
      quantity: "",
      location: "",
      materials: [],
      remarks: ""
    }
  });

  // Ranks for dropdowns
  const ranks = [
    "Master",
    "Chief Officer",
    "2nd Officer",
    "3rd Officer",
    "Chief Engineer",
    "2nd Engineer",
    "3rd Engineer",
    "4th Engineer",
    "Deck Cadet",
    "Engine Cadet",
    "Bosun",
    "Pumpman",
    "Electrician",
    "Fitter",
    "Able Seaman",
    "Ordinary Seaman",
    "Oiler",
    "Wiper",
    "Cook",
    "Steward"
  ];

  // Generate WO Template Code placeholder for display
  // Format: WO-{ComponentCode}-{Year}-{Sequence}
  // Actual sequence is generated by backend
  const generateWOTemplateCodePlaceholder = () => {
    const compCode = templateData.componentCode || component?.code;
    if (!compCode) return "";
    
    const year = new Date().getFullYear();
    // Show placeholder format - backend will generate actual sequence
    return `WO-${compCode}-${year}-XX`;
  };

  // Generate WO Execution ID
  const generateWOExecutionId = () => {
    const year = new Date().getFullYear();
    const templateCode = templateData.woTemplateCode || workOrder?.templateCode || generateWOTemplateCodePlaceholder();
    // In real implementation, get sequence from database based on existing executions
    const sequence = String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
    return `${year}-${templateCode}-${sequence}`;
  };

  // Update template code placeholder display when component code changes
  useEffect(() => {
    if (!templateData.woTemplateCode && templateData.componentCode) {
      const placeholder = generateWOTemplateCodePlaceholder();
      // Store placeholder for display only - don't send to backend
      setTemplateData(prev => ({ ...prev, woTemplateCode: placeholder }));
    }
  }, [templateData.componentCode]);

  // Load existing workOrder data
  useEffect(() => {
    if (workOrder) {
      const initialData = {
        woTitle: workOrder.jobTitle || "",
        component: workOrder.component || component?.name || "",
        componentCode: workOrder.componentCode || component?.code || "",
        woTemplateCode: workOrder.templateCode || "",
        maintenanceBasis: workOrder.maintenanceBasis || "Calendar",
        frequencyValue: workOrder.frequencyValue || "",
        frequencyUnit: workOrder.frequencyUnit || "Months",
        taskType: workOrder.taskType || "Inspection",
        assignedTo: workOrder.assignedTo || "",
        approver: "",
        jobPriority: "Medium",
        classRelated: "No",
        briefWorkDescription: "",
        nextDueDate: workOrder.dueDate || "",
        nextDueReading: "",
        requiredSpareParts: [],
        requiredTools: [],
        safetyRequirements: {
          ppe: "",
          permits: "",
          other: ""
        },
        workHistory: []
      };
      
      setTemplateData(prev => ({ ...prev, ...initialData }));
      
      // Set original snapshot for modify mode
      if (isModifyMode && setOriginalSnapshot) {
        console.log("Setting original snapshot:", initialData);
        setOriginalSnapshot(initialData);
      }
      
      // If in execution mode, switch to Part B and generate execution ID
      if (executionMode) {
        setActiveSection('partB');
        setExecutionData(prev => ({
          ...prev,
          woExecutionId: generateWOExecutionId(),
          assignedTo: workOrder.assignedTo || ""
        }));
      }
    }
  }, [workOrder, executionMode, isModifyMode, setOriginalSnapshot]);

  const selectSection = (section: 'partA' | 'partB') => {
    setActiveSection(section);
  };

  const handleTemplateChange = (field: string, value: string) => {
    setTemplateData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Track field change for modify mode
      if (isModifyMode && trackFieldChange) {
        trackFieldChange(field, value, (prev as any)[field]);
      }
      
      return newData;
    });
  };

  const handleExecutionChange = (field: string, value: string) => {
    setExecutionData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = () => {
    if (activeSection === 'partA') {
      // Validate template data
      if (!templateData.woTitle) {
        toast({
          title: "Validation Error",
          description: "WO Title is required",
          variant: "destructive"
        });
        return;
      }
      if (!templateData.maintenanceBasis) {
        toast({
          title: "Validation Error",
          description: "Maintenance Basis is required",
          variant: "destructive"
        });
        return;
      }
      if (!templateData.frequencyValue) {
        toast({
          title: "Validation Error",
          description: "Frequency value is required",
          variant: "destructive"
        });
        return;
      }
      if (!templateData.taskType) {
        toast({
          title: "Validation Error",
          description: "Task Type is required",
          variant: "destructive"
        });
        return;
      }
      if (!templateData.assignedTo) {
        toast({
          title: "Validation Error",
          description: "Assigned To is required",
          variant: "destructive"
        });
        return;
      }

      // Note: Due date calculation is now handled by the backend
      // The backend will auto-calculate if nextDueDate is empty, using component installation date
      
      if (onSubmit) {
        const workOrderId = workOrder?.id || `new-${Date.now()}`;
        
        // Don't send placeholder templateCode (with -XX) to backend
        // Backend will auto-generate the actual sequence
        const shouldSendTemplateCode = templateData.woTemplateCode && 
                                       !templateData.woTemplateCode.includes('-XX');
        
        onSubmit(workOrderId, { 
          type: 'template', 
          data: {
            ...templateData,
            templateCode: shouldSendTemplateCode ? templateData.woTemplateCode : undefined
          } 
        });
      }
    } else {
      // Validate execution data
      if (!executionData.startDateTime) {
        toast({
          title: "Validation Error",
          description: "Start Date/Time is required",
          variant: "destructive"
        });
        return;
      }
      if (!executionData.completionDateTime) {
        toast({
          title: "Validation Error",
          description: "Completion Date/Time is required",
          variant: "destructive"
        });
        return;
      }
      if (!executionData.assignedTo) {
        toast({
          title: "Validation Error",
          description: "Assigned To is required",
          variant: "destructive"
        });
        return;
      }
      if (!executionData.performedBy) {
        toast({
          title: "Validation Error",
          description: "Performed By is required",
          variant: "destructive"
        });
        return;
      }
      if (templateData.maintenanceBasis === "Running Hours") {
        if (!executionData.previousReading || !executionData.currentReading) {
          toast({
            title: "Validation Error",
            description: "Previous and Current readings are required for Running Hours based WOs",
            variant: "destructive"
          });
          return;
        }
      }

      if (onSubmit) {
        const workOrderId = workOrder?.id || `new-${Date.now()}`;
        const executionRecord = {
          ...templateData,
          ...executionData,
          woExecutionId: executionData.woExecutionId || generateWOExecutionId(),
          templateCode: templateData.woTemplateCode || workOrder?.templateCode,
          submittedDate: new Date().toISOString().split('T')[0]
        };
        onSubmit(workOrderId, { type: 'execution', data: executionRecord });
        
        toast({
          title: "Success",
          description: "Work Order submitted for approval",
        });
      }
    }
    onClose();
  };

  const handleApprove = () => {
    if (window.confirm("Approve this work completion?")) {
      if (onApprove) {
        onApprove(workOrder?.executionId || workOrder?.id, "");
      }
      
      toast({
        title: "Success",
        description: "Work Order approved."
      });
      
      onClose();
    }
  };

  const handleReject = () => {
    if (!rejectionComments.trim()) {
      toast({
        title: "Error",
        description: "Please enter rejection comments.",
        variant: "destructive"
      });
      return;
    }

    if (onReject) {
      onReject(workOrder?.executionId || workOrder?.id, rejectionComments);
    }
    
    toast({
      title: "Success",
      description: "Work Order rejected."
    });
    
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[80vw] max-w-none h-[90vh] flex flex-col">
        <DialogHeader className="pb-4 pr-12">
          <div className="flex items-center justify-between">
            <DialogTitle>
              {isPreviewMode ? "Preview Change Request - Work Order Form" : "Work Order Form"}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {activeSection === 'partA' && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsWorkInstructionsOpen(true)}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Work Instructions
                </Button>
              )}
              {!isModifyMode && (
                <>
                  <Button 
                    size="sm" 
                    className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white"
                    onClick={handleSubmit}
                  >
                    Save
                  </Button>
                  <Button variant="outline" size="sm" onClick={onClose}>
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                </>
              )}
            </div>
          </div>
          
          {/* Preview Mode Banner */}
          {isPreviewMode && changeRequestData && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <div className="flex-1">
                  <h4 className="font-medium text-blue-900 text-sm">Viewing Change Request Preview</h4>
                  <p className="text-xs text-blue-700">
                    {changeRequestData.title} - Changed fields are highlighted in <span className="text-red-600 font-medium">red</span>
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation('/pms/modify-pms')}
                  className="text-blue-700 border-blue-300 text-xs px-2 py-1 h-7"
                >
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  Back
                </Button>
              </div>
            </div>
          )}
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Navigation */}
          <div className="w-72 bg-gray-50 border-r border-gray-200 p-4">
            <div className="space-y-2">
              <div 
                className={`flex items-center gap-2 p-3 rounded cursor-pointer ${
                  activeSection === 'partA' ? 'bg-[#16569e] text-white' : 'bg-transparent text-[#8a8a8a] hover:bg-gray-100'
                }`}
                onClick={() => selectSection('partA')}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold ${
                  activeSection === 'partA' ? 'bg-white text-[#52baf3]' : 'bg-gray-300 text-white'
                }`}>
                  A
                </div>
                <span className="font-medium">Work Order Details</span>
              </div>
              <div 
                className={`flex items-center gap-2 p-3 rounded cursor-pointer ${
                  activeSection === 'partB' ? 'bg-[#16569e] text-white' : 'bg-transparent text-[#8a8a8a] hover:bg-gray-100'
                }`}
                onClick={() => selectSection('partB')}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold ${
                  activeSection === 'partB' ? 'bg-white text-[#52baf3]' : 'bg-gray-300 text-white'
                }`}>
                  B
                </div>
                <span className="font-medium">Work Completion Record</span>
              </div>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 overflow-auto p-6">
            {/* Part A - Work Order Details (Template) */}
            {activeSection === 'partA' && (
              <div className="border border-gray-200 rounded-lg mb-6">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Part A - Work Order Details</h3>
                </div>

                <div className="p-6">
                  {/* Header Section */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">WO Title *</Label>
                        <ModifyFieldWrapper
                          originalValue={workOrder?.jobTitle || ""}
                          currentValue={templateData.woTitle}
                          fieldName="woTitle"
                          isModifyMode={isModifyMode}
                          onFieldChange={trackFieldChange}
                        >
                          <Input 
                            value={templateData.woTitle} 
                            onChange={(e) => handleTemplateChange('woTitle', e.target.value)}
                            className="text-sm"
                            placeholder="Enter work order title"
                            disabled={isReadOnly}
                          />
                        </ModifyFieldWrapper>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Component</Label>
                        <div className="text-sm text-gray-900 p-2 bg-gray-100 rounded">{templateData.component}</div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Component Code</Label>
                        <div className="text-xs text-gray-500 p-2 bg-gray-100 rounded">{templateData.componentCode}</div>
                      </div>
                    </div>
                  </div>

                  {/* A1. Work Order Information */}
                  <div className="border border-gray-200 rounded-lg p-4 mb-6">
                    <h4 className="text-md font-medium mb-4" style={{ color: '#16569e' }}>A1. Work Order Information</h4>
                    
                    <div className="grid grid-cols-3 gap-6">
                      {/* Row 1 - Maintenance Basis */}
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Maintenance Basis *</Label>
                        <ModifyFieldWrapper
                          originalValue={workOrder?.maintenanceBasis || "Calendar"}
                          currentValue={templateData.maintenanceBasis}
                          fieldName="maintenanceBasis"
                          isModifyMode={isModifyMode}
                          onFieldChange={trackFieldChange}
                        >
                          <Select 
                            value={templateData.maintenanceBasis} 
                            onValueChange={(value) => handleTemplateChange('maintenanceBasis', value)}
                            disabled={isReadOnly}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Calendar">Calendar</SelectItem>
                              <SelectItem value="Running Hours">Running Hours</SelectItem>
                            </SelectContent>
                          </Select>
                        </ModifyFieldWrapper>
                      </div>
                      
                      {/* Frequency Fields */}
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">
                          {templateData.maintenanceBasis === "Calendar" ? "Every *" : "Every (Hours) *"}
                        </Label>
                        <ModifyFieldWrapper
                          originalValue={workOrder?.frequencyValue || ""}
                          currentValue={templateData.frequencyValue}
                          fieldName="frequencyValue"
                          isModifyMode={isModifyMode}
                          onFieldChange={trackFieldChange}
                        >
                          <Input 
                            type="number"
                            value={isPreviewMode && hasPreviewChange('frequencyValue') ? getPreviewValue('frequencyValue') : templateData.frequencyValue} 
                            onChange={(e) => handleTemplateChange('frequencyValue', e.target.value)}
                            className={`text-sm ${
                              hasPreviewChange('frequencyValue') ? 'text-red-600 border-red-300 bg-red-50' : ''
                            }`}
                            placeholder={templateData.maintenanceBasis === "Running Hours" ? "e.g., 1000" : ""}
                            disabled={isReadOnly || isPreviewMode}
                          />
                        </ModifyFieldWrapper>
                      </div>
                      
                      {templateData.maintenanceBasis === "Calendar" && (
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Unit *</Label>
                          <ModifyFieldWrapper
                            originalValue={workOrder?.frequencyUnit || "Months"}
                            currentValue={templateData.frequencyUnit}
                            fieldName="frequencyUnit"
                            isModifyMode={isModifyMode}
                            onFieldChange={trackFieldChange}
                          >
                            <Select 
                              value={templateData.frequencyUnit} 
                              onValueChange={(value) => handleTemplateChange('frequencyUnit', value)}
                              disabled={isReadOnly}
                            >
                              <SelectTrigger className="text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Days">Days</SelectItem>
                                <SelectItem value="Weeks">Weeks</SelectItem>
                                <SelectItem value="Months">Months</SelectItem>
                                <SelectItem value="Years">Years</SelectItem>
                              </SelectContent>
                            </Select>
                          </ModifyFieldWrapper>
                        </div>
                      )}

                      {/* Row 2 */}
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Task Type *</Label>
                        <ModifyFieldWrapper
                          originalValue={workOrder?.taskType || "Inspection"}
                          currentValue={templateData.taskType}
                          fieldName="taskType"
                          isModifyMode={isModifyMode}
                          onFieldChange={trackFieldChange}
                        >
                          <Select 
                            value={templateData.taskType} 
                            onValueChange={(value) => handleTemplateChange('taskType', value)}
                            disabled={isReadOnly}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Inspection">Inspection</SelectItem>
                              <SelectItem value="Overhaul">Overhaul</SelectItem>
                              <SelectItem value="Service">Service</SelectItem>
                              <SelectItem value="Testing">Testing</SelectItem>
                            </SelectContent>
                          </Select>
                        </ModifyFieldWrapper>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Assigned To *</Label>
                        <ModifyFieldWrapper
                          originalValue={workOrder?.assignedTo || ""}
                          currentValue={templateData.assignedTo}
                          fieldName="assignedTo"
                          isModifyMode={isModifyMode}
                          onFieldChange={trackFieldChange}
                        >
                          <Select 
                            value={templateData.assignedTo} 
                            onValueChange={(value) => handleTemplateChange('assignedTo', value)}
                            disabled={isReadOnly}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue placeholder="Select rank" />
                            </SelectTrigger>
                            <SelectContent>
                              {ranks.map(rank => (
                                <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </ModifyFieldWrapper>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Approver</Label>
                        <Select value={templateData.approver} onValueChange={(value) => handleTemplateChange('approver', value)}>
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder="Select rank (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            {ranks.map(rank => (
                              <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Row 3 */}
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Job Priority</Label>
                        <Select value={templateData.jobPriority} onValueChange={(value) => handleTemplateChange('jobPriority', value)}>
                          <SelectTrigger className="text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Low">Low</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="High">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Class Related</Label>
                        <Select value={templateData.classRelated} onValueChange={(value) => handleTemplateChange('classRelated', value)}>
                          <SelectTrigger className="text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">
                          {templateData.maintenanceBasis === "Calendar" ? "Next Due Date (Optional)" : "Next Due Reading"}
                        </Label>
                        {templateData.maintenanceBasis === "Calendar" ? (
                          <Input
                            type="date"
                            value={templateData.nextDueDate}
                            onChange={(e) => handleTemplateChange('nextDueDate', e.target.value)}
                            className="text-sm"
                            placeholder="Leave empty to auto-calculate"
                            disabled={isReadOnly}
                          />
                        ) : (
                          <Input
                            type="text"
                            value={templateData.nextDueReading}
                            onChange={(e) => handleTemplateChange('nextDueReading', e.target.value)}
                            className="text-sm"
                            placeholder="Leave empty to auto-calculate"
                            disabled={isReadOnly}
                          />
                        )}
                      </div>
                    </div>

                    {/* Brief Work Description */}
                    <div className="mt-6">
                      <Label className="text-sm text-[#8798ad]">Brief Work Description</Label>
                      <ModifyFieldWrapper
                        originalValue={workOrder?.briefWorkDescription || ""}
                        currentValue={templateData.briefWorkDescription}
                        fieldName="briefWorkDescription"
                        isModifyMode={isModifyMode}
                        onFieldChange={trackFieldChange}
                      >
                        <Textarea 
                          value={templateData.briefWorkDescription} 
                          onChange={(e) => handleTemplateChange('briefWorkDescription', e.target.value)}
                          className="mt-2 text-sm"
                          rows={3}
                          placeholder="Enter work description..."
                          disabled={isReadOnly}
                        />
                      </ModifyFieldWrapper>
                    </div>
                  </div>

                  {/* A4. Safety Requirements */}
                  <div className="border border-gray-200 rounded-lg p-4 mb-6">
                    <h4 className="text-md font-medium mb-4" style={{ color: '#16569e' }}>A4. Safety Requirements</h4>
                    
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">PPE Requirements:</Label>
                          <div className="text-sm text-gray-900">Leather Gloves, Goggles, Safety Helmet</div>
                        </div>
                        <div></div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Permit Requirements:</Label>
                          <div className="text-sm text-gray-900">Enclosed Space Entry Permit</div>
                        </div>
                        <div></div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Other Safety Requirements:</Label>
                          <div className="text-sm text-gray-900">Free Text</div>
                        </div>
                        <div></div>
                      </div>
                    </div>
                  </div>

                  {/* A5. Work History (Executions for this template) */}
                  <div className="border border-gray-200 rounded-lg p-4 mb-6">
                    <h4 className="text-md font-medium mb-4" style={{ color: '#16569e' }}>A5. Work History</h4>
                    
                    <div className="border border-gray-200 rounded">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <div className="grid grid-cols-7 gap-4 text-sm font-medium text-gray-700">
                          <div>WO Execution ID</div>
                          <div>Assigned To</div>
                          <div>Performed By</div>
                          <div>Total Time (Hrs)</div>
                          <div>{templateData.maintenanceBasis === "Calendar" ? "Due Date" : "Due Reading"}</div>
                          <div>Completion Date</div>
                          <div>Status</div>
                        </div>
                      </div>
                      <div className="divide-y divide-gray-200">
                        {templateData.workHistory && templateData.workHistory.length > 0 ? (
                          templateData.workHistory.map((execution: any, index: number) => (
                            <div key={index} className="px-4 py-3 cursor-pointer hover:bg-gray-50" onClick={() => {
                              // Open Part B with this execution
                              setExecutionData(execution);
                              setActiveSection('partB');
                            }}>
                              <div className="grid grid-cols-7 gap-4 text-sm items-center">
                                <div className="text-gray-900">{execution.woExecutionId}</div>
                                <div className="text-gray-900">{execution.assignedTo}</div>
                                <div className="text-gray-900">{execution.performedBy}</div>
                                <div className="text-gray-900">{execution.totalTimeHours}</div>
                                <div className="text-gray-900">{execution.dueDate || execution.dueReading}</div>
                                <div className="text-gray-900">{execution.completionDate}</div>
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                                    {execution.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-6 text-center text-gray-500 text-sm">
                            No work history for this template yet
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Part A Action Buttons - Show for modify mode */}
                {isModifyMode && (
                  <div className="border-t border-gray-200 px-6 py-4">
                    <div className="flex justify-end">
                      <Button 
                        size="lg" 
                        className="bg-[#52BAF3] hover:bg-[#40a8e0] text-white px-8 py-3 text-base font-medium"
                        onClick={async () => {
                          if (Object.keys(fieldChanges).length === 0) {
                            toast({
                              title: "No changes to submit",
                              description: "Please make some changes before submitting a change request.",
                              variant: "destructive"
                            });
                            return;
                          }
                          
                          try {
                            // Convert field changes to proposed changes format
                            const proposedChanges = Object.entries(fieldChanges).map(([fieldName, change]) => ({
                              field: fieldName,
                              oldValue: change.originalValue,
                              newValue: change.currentValue
                            }));

                            // Create change request payload matching the schema
                            const changeRequest = {
                              vesselId: 'V001',
                              category: 'workOrders',
                              title: `Modify Work Order: ${workOrder?.jobTitle || workOrder?.woTitle || 'Unknown'}`,
                              reason: 'Work order modification request',
                              requestedByUserId: 'current_user',
                              targetType: 'workOrder',
                              targetId: workOrder?.id,
                              snapshotBeforeJson: {
                                displayKey: workOrder?.workOrderNo || workOrder?.templateCode,
                                displayName: workOrder?.jobTitle || workOrder?.woTitle,
                                displayPath: `${workOrder?.componentCode || ''} ${workOrder?.jobTitle || workOrder?.woTitle || ''}`,
                                fields: workOrder
                              },
                              proposedChangesJson: proposedChanges,
                              status: 'submitted'
                            };

                            console.log("Submitting change request:", changeRequest);
                            
                            const response = await fetch('/api/change-requests', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify(changeRequest),
                            });

                            if (response.ok) {
                              toast({
                                title: "Change Request Submitted",
                                description: `Your change request with ${Object.keys(fieldChanges).length} modifications has been submitted for approval.`,
                              });
                              onClose();
                              window.location.href = '/pms/modify-pms';
                            } else {
                              const errorData = await response.json();
                              throw new Error(errorData.error || 'Failed to submit change request');
                            }
                          } catch (error) {
                            console.error('Error submitting change request:', error);
                            toast({
                              title: "Submission failed",
                              description: (error as Error).message || "Failed to submit change request. Please try again.",
                              variant: "destructive"
                            });
                          }
                        }}
                        disabled={Object.keys(fieldChanges).length === 0}
                      >
                        Submit Change Request
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Part B - Work Completion Record (EXECUTION) */}
            {activeSection === 'partB' && (
              <div className="border border-gray-200 rounded-lg mb-6">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[#16569e]">Part B - Work Completion Record (EXECUTION)</h3>
                  <p className="text-sm text-[#52baf3]">Record a single performance of the template</p>
                </div>

                <div className="p-6">
                  {/* WO Execution ID Header */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <Label className="text-sm text-[#8798ad]">WO Execution ID</Label>
                    <div className="text-sm font-medium text-gray-900 p-2 bg-gray-100 rounded inline-block">
                      {executionData.woExecutionId || generateWOExecutionId()}
                    </div>
                  </div>
                  {/* B1. Risk Assessment, Checklists & Records */}
                  <div className="border border-gray-200 rounded-lg p-4 mb-6">
                    <h4 className="text-md font-medium mb-4" style={{ color: '#16569e' }}>B1. Risk Assessment, Checklists & Records</h4>
                    
                    <div className="space-y-4">
                      {/* B1.1 Risk Assessment Completed / Reviewed */}
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-6">
                          <Label className="text-sm text-gray-900">B1.1 Risk Assessment Completed / Reviewed:</Label>
                        </div>
                        <div className="col-span-3 flex items-center gap-4">
                          <label className="flex items-center gap-2">
                            <input type="radio" name="riskAssessment" value="yes" defaultChecked className="text-blue-600" />
                            <span className="text-sm">Yes</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" name="riskAssessment" value="no" className="text-blue-600" />
                            <span className="text-sm">No</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" name="riskAssessment" value="na" className="text-blue-600" />
                            <span className="text-sm">NA</span>
                          </label>
                        </div>
                        <div className="col-span-3 flex items-center gap-2">
                          <Button variant="outline" size="sm" className="text-xs">Upload</Button>
                          <button className="text-gray-400 hover:text-gray-600">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                            </svg>
                          </button>
                          <button className="text-gray-400 hover:text-gray-600">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd"/>
                              <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 001 1h8a1 1 0 001-1V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM8 8a1 1 0 012 0v3a1 1 0 11-2 0V8zm4 0a1 1 0 10-2 0v3a1 1 0 102 0V8z" clipRule="evenodd"/>
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* B1.2 Safety Checklists Completed */}
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-6">
                          <Label className="text-sm text-gray-900">B1.2 Safety Checklists Completed (As applicable):</Label>
                        </div>
                        <div className="col-span-3 flex items-center gap-4">
                          <label className="flex items-center gap-2">
                            <input type="radio" name="safetyChecklists" value="yes" defaultChecked className="text-blue-600" />
                            <span className="text-sm">Yes</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" name="safetyChecklists" value="no" className="text-blue-600" />
                            <span className="text-sm">No</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" name="safetyChecklists" value="na" className="text-blue-600" />
                            <span className="text-sm">NA</span>
                          </label>
                        </div>
                        <div className="col-span-3 flex items-center gap-2">
                          <Button variant="outline" size="sm" className="text-xs">Upload</Button>
                          <button className="text-gray-400 hover:text-gray-600">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                            </svg>
                          </button>
                          <button className="text-gray-400 hover:text-gray-600">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd"/>
                              <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 001 1h8a1 1 0 001-1V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM8 8a1 1 0 012 0v3a1 1 0 11-2 0V8zm4 0a1 1 0 10-2 0v3a1 1 0 102 0V8z" clipRule="evenodd"/>
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* B1.3 Operational Forms Completed */}
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-6">
                          <Label className="text-sm text-gray-900">B1.3 Operational Forms Completed (As applicable):</Label>
                        </div>
                        <div className="col-span-3 flex items-center gap-4">
                          <label className="flex items-center gap-2">
                            <input type="radio" name="operationalForms" value="yes" checked={executionData.operationalForms === "Yes"} onChange={() => handleExecutionChange('operationalForms', 'Yes')} className="text-blue-600" />
                            <span className="text-sm">Yes</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" name="operationalForms" value="no" className="text-blue-600" />
                            <span className="text-sm">No</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" name="operationalForms" value="na" className="text-blue-600" />
                            <span className="text-sm">NA</span>
                          </label>
                        </div>
                        <div className="col-span-3 flex items-center gap-2">
                          <Button variant="outline" size="sm" className="text-xs">Upload</Button>
                          <button className="text-gray-400 hover:text-gray-600">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                            </svg>
                          </button>
                          <button className="text-gray-400 hover:text-gray-600">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd"/>
                              <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 001 1h8a1 1 0 001-1V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM8 8a1 1 0 012 0v3a1 1 0 11-2 0V8zm4 0a1 1 0 10-2 0v3a1 1 0 102 0V8z" clipRule="evenodd"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* B2. Details of Work Carried Out */}
                  <div className="border border-gray-200 rounded-lg p-4 mb-6">
                    <h4 className="text-md font-medium mb-4" style={{ color: '#16569e' }}>B2. Details of Work Carried Out</h4>
                    
                    <div className="mb-6">
                      <h5 className="text-sm font-medium text-gray-900 mb-4">B2.1 Work Duration:</h5>
                      
                      <div className="grid grid-cols-3 gap-6 mb-4">
                        {/* Row 1 */}
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Start Date & Time *</Label>
                          <Input 
                            type="datetime-local" 
                            value={executionData.startDateTime}
                            onChange={(e) => handleExecutionChange('startDateTime', e.target.value)}
                            className="w-full" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Completion Date & Time *</Label>
                          <Input 
                            type="datetime-local" 
                            value={executionData.completionDateTime}
                            onChange={(e) => handleExecutionChange('completionDateTime', e.target.value)}
                            className="w-full" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Assigned To *</Label>
                          <Select value={executionData.assignedTo} onValueChange={(value) => handleExecutionChange('assignedTo', value)}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select rank" />
                            </SelectTrigger>
                            <SelectContent>
                              {ranks.map(rank => (
                                <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-6 mb-4">
                        {/* Row 2 */}
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Performed by *</Label>
                          <Select value={executionData.performedBy} onValueChange={(value) => handleExecutionChange('performedBy', value)}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select rank" />
                            </SelectTrigger>
                            <SelectContent>
                              {ranks.map(rank => (
                                <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">No of Persons in the team</Label>
                          <Input 
                            type="number" 
                            value={executionData.noOfPersons}
                            onChange={(e) => {
                              handleExecutionChange('noOfPersons', e.target.value);
                              // Calculate manhours
                              const persons = parseInt(e.target.value) || 0;
                              const hours = parseFloat(executionData.totalTimeHours) || 0;
                              handleExecutionChange('manhours', (persons * hours).toString());
                            }}
                            className="w-full" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Total Time Taken (Hours)</Label>
                          <Input 
                            type="number" 
                            value={executionData.totalTimeHours}
                            onChange={(e) => {
                              handleExecutionChange('totalTimeHours', e.target.value);
                              // Calculate manhours
                              const persons = parseInt(executionData.noOfPersons) || 0;
                              const hours = parseFloat(e.target.value) || 0;
                              handleExecutionChange('manhours', (persons * hours).toString());
                            }}
                            className="w-full" 
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-6 mb-6">
                        {/* Row 3 */}
                        <div></div>
                        <div></div>
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Manhours (Auto)</Label>
                          <div className="text-sm text-gray-900 p-2 bg-gray-100 rounded">
                            {executionData.manhours || "0"}
                          </div>
                        </div>
                      </div>
                      
                      {/* Work Carried Out */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm text-[#8798ad]">Work Carried Out</Label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowQuickInputs(!showQuickInputs)}
                              className="text-xs text-[#52BAF3] border-[#52BAF3] hover:bg-blue-50 h-6 px-2"
                            >
                              Quick Input {showQuickInputs ? '▲' : '▼'}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={toggleSmartSuggestions}
                              className="text-xs text-[#52BAF3] border-[#52BAF3] hover:bg-blue-50 h-6 px-2"
                            >
                              Smart Suggestions {showSmartSuggestions ? '▲' : '▼'}
                            </Button>
                          </div>
                        </div>
                        
                        {/* Quick Input Pills */}
                        {showQuickInputs && (
                          <div className="mb-3 p-3 bg-gray-50 rounded-lg border">
                            <p className="text-xs text-gray-600 mb-2">Click to insert common phrases:</p>
                            <div className="flex flex-wrap gap-1">
                              {quickAnswers.map((answer, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => insertQuickText(answer)}
                                  className="inline-flex items-center px-2 py-1 text-xs bg-white border border-gray-300 rounded-full text-gray-700 hover:bg-[#52BAF3] hover:text-white hover:border-[#52BAF3] transition-colors duration-150 cursor-pointer"
                                >
                                  {answer}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Smart Suggestions Panel */}
                        {showSmartSuggestions && (
                          <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-xs text-blue-700 mb-2 font-medium">🧠 Smart Suggestions (based on work order details):</p>
                            <div className="space-y-2">
                              {smartSuggestions.length > 0 ? (
                                smartSuggestions.map((suggestion, index) => (
                                  <div 
                                    key={index}
                                    onClick={() => insertSuggestion(suggestion)}
                                    className="p-2 bg-white border border-blue-200 rounded cursor-pointer hover:bg-blue-100 hover:border-blue-300 transition-colors duration-150"
                                    title={suggestion} // Full text on hover
                                  >
                                    <p className="text-sm text-gray-800 leading-relaxed">
                                      {suggestion.length > 140 ? `${suggestion.substring(0, 140)}...` : suggestion}
                                    </p>
                                  </div>
                                ))
                              ) : (
                                <div className="p-2 text-sm text-gray-500 italic">
                                  No smart suggestions for this job yet.
                                </div>
                              )}
                            </div>
                            {smartSuggestions.length > 0 && (
                              <p className="text-xs text-blue-600 mt-2 italic">💡 Click any suggestion to insert at cursor position</p>
                            )}
                          </div>
                        )}
                        
                        <Textarea 
                          ref={workCarriedOutRef}
                          value={executionData.workCarriedOut}
                          onChange={(e) => handleExecutionChange('workCarriedOut', e.target.value)}
                          className="w-full min-h-[80px]" 
                          placeholder="Describe work carried out..."
                        />
                      </div>
                      
                      {/* Job Experience / Notes */}
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Job Experience / Notes (to be retained for future)</Label>
                        <Textarea 
                          value={executionData.jobExperienceNotes}
                          onChange={(e) => handleExecutionChange('jobExperienceNotes', e.target.value)}
                          className="w-full min-h-[80px]" 
                          placeholder="Enter job experience notes..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* B3. Running Hours (Conditional - only for Running Hours based WOs) */}
                  {templateData.maintenanceBasis === "Running Hours" && (
                    <div className="border border-gray-200 rounded-lg p-4 mb-6">
                      <h4 className="text-md font-medium mb-4" style={{ color: '#16569e' }}>B3. Running Hours</h4>
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Previous reading *</Label>
                          <Input 
                            type="number" 
                            value={executionData.previousReading}
                            onChange={(e) => handleExecutionChange('previousReading', e.target.value)}
                            placeholder="Enter previous hours reading"
                            className="w-full" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Current Reading *</Label>
                          <Input 
                            type="number" 
                            value={executionData.currentReading}
                            onChange={(e) => handleExecutionChange('currentReading', e.target.value)}
                            placeholder="Enter current hours reading"
                            className="w-full" 
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* B4. Spare Parts Consumed */}
                  <div className="border border-gray-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-md font-medium" style={{ color: '#16569e' }}>B4. Spare Parts Consumed</h4>
                      <button className="text-sm text-blue-600 hover:text-blue-800">+ Add Spare Part</button>
                    </div>
                    
                    <div className="border border-gray-200 rounded">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <div className="grid grid-cols-4 gap-4 text-sm font-medium text-gray-700">
                          <div>Part No</div>
                          <div>Description</div>
                          <div>Quantity Consumed</div>
                          <div>Comments (if any)</div>
                        </div>
                      </div>
                      <div className="divide-y divide-gray-200">
                        <div className="px-4 py-3">
                          <div className="grid grid-cols-4 gap-4 text-sm items-center">
                            <div className="text-gray-900">SP -001</div>
                            <div className="text-gray-900">O-Ring Seal</div>
                            <div>
                              <Input type="text" className="w-full" defaultValue="2" />
                            </div>
                            <div>
                              <Input type="text" className="w-full" />
                            </div>
                          </div>
                        </div>
                        <div className="px-4 py-3">
                          <div className="grid grid-cols-4 gap-4 text-sm items-center">
                            <div className="text-gray-900">SP-002</div>
                            <div className="text-gray-900">Filter Element</div>
                            <div>
                              <Input type="text" className="w-full" defaultValue="1" />
                            </div>
                            <div>
                              <Input type="text" className="w-full" />
                            </div>
                          </div>
                        </div>
                        <div className="px-4 py-3">
                          <div className="grid grid-cols-4 gap-4 text-sm items-center">
                            <div className="text-gray-900">SP -003</div>
                            <div className="text-gray-900">Bearing</div>
                            <div>
                              <Input type="text" className="w-full" defaultValue="2" />
                            </div>
                            <div>
                              <Input type="text" className="w-full" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* B5. IHM Update (only show if feature is enabled) */}
                  {FEATURES.IHM && (
                    <div className="border border-gray-200 rounded-lg p-4 mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-md font-medium flex items-center gap-2" style={{ color: '#16569e' }}>
                          B5. IHM Update 
                          <AlertCircle className="h-4 w-4 text-blue-500" />
                        </h4>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={executionData.ihmUpdate.enabled}
                            onChange={(e) => setExecutionData(prev => ({
                              ...prev,
                              ihmUpdate: { ...prev.ihmUpdate, enabled: e.target.checked }
                            }))}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-600">Update IHM Status</span>
                        </label>
                      </div>
                      
                      {executionData.ihmUpdate.enabled && (
                        <div className="space-y-4 mt-4 p-4 bg-blue-50 rounded-lg">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm text-gray-700">IHM Action</Label>
                              <Select
                                value={executionData.ihmUpdate.action}
                                onValueChange={(value) => setExecutionData(prev => ({
                                  ...prev,
                                  ihmUpdate: { ...prev.ihmUpdate, action: value }
                                }))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select action" />
                                </SelectTrigger>
                                <SelectContent>
                                  {IHM_ACTIONS.map(action => (
                                    <SelectItem key={action} value={action}>
                                      {action}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div>
                              <Label className="text-sm text-gray-700">Target Component/Equipment</Label>
                              <Input
                                type="text"
                                value={executionData.ihmUpdate.targetComponent}
                                onChange={(e) => setExecutionData(prev => ({
                                  ...prev,
                                  ihmUpdate: { ...prev.ihmUpdate, targetComponent: e.target.value }
                                }))}
                                placeholder="Component code or name"
                              />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <Label className="text-sm text-gray-700">Material/Spare Part</Label>
                              <Input
                                type="text"
                                value={executionData.ihmUpdate.targetSpare}
                                onChange={(e) => setExecutionData(prev => ({
                                  ...prev,
                                  ihmUpdate: { ...prev.ihmUpdate, targetSpare: e.target.value }
                                }))}
                                placeholder="Part code"
                              />
                            </div>
                            
                            <div>
                              <Label className="text-sm text-gray-700">Quantity</Label>
                              <Input
                                type="text"
                                value={executionData.ihmUpdate.quantity}
                                onChange={(e) => setExecutionData(prev => ({
                                  ...prev,
                                  ihmUpdate: { ...prev.ihmUpdate, quantity: e.target.value }
                                }))}
                                placeholder="kg/units"
                              />
                            </div>
                            
                            <div>
                              <Label className="text-sm text-gray-700">Location</Label>
                              <Input
                                type="text"
                                value={executionData.ihmUpdate.location}
                                onChange={(e) => setExecutionData(prev => ({
                                  ...prev,
                                  ihmUpdate: { ...prev.ihmUpdate, location: e.target.value }
                                }))}
                                placeholder="Location on ship"
                              />
                            </div>
                          </div>
                          
                          <div>
                            <Label className="text-sm text-gray-700">Remarks</Label>
                            <Textarea
                              value={executionData.ihmUpdate.remarks}
                              onChange={(e) => setExecutionData(prev => ({
                                ...prev,
                                ihmUpdate: { ...prev.ihmUpdate, remarks: e.target.value }
                              }))}
                              placeholder="Additional notes about IHM change..."
                              className="min-h-[60px]"
                            />
                          </div>
                          
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                            <p className="text-xs text-yellow-800">
                              <strong>Note:</strong> IHM updates made during work order completion will be logged to the IHM maintenance log 
                              and require approval before updating the main IHM register.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Rejection Comments (only show in approval mode) */}
                  {isApprovalMode && (
                    <div className="border border-gray-200 rounded-lg p-4 mb-6">
                      <h4 className="text-md font-medium mb-4" style={{ color: '#16569e' }}>Rejection Comments</h4>
                      <Textarea
                        value={rejectionComments}
                        onChange={(e) => setRejectionComments(e.target.value)}
                        placeholder="Enter rejection comments..."
                        className="w-full min-h-[80px]"
                        disabled={!isApprovalMode}
                      />
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end mt-6 gap-4">
                    {isApprovalMode ? (
                      <>
                        <Button 
                          size="lg" 
                          className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-base font-medium"
                          onClick={handleApprove}
                        >
                          Approve
                        </Button>
                        <Button 
                          size="lg" 
                          variant="destructive"
                          className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-base font-medium"
                          onClick={handleReject}
                        >
                          Reject
                        </Button>
                      </>
                    ) : isModifyMode ? (
                      <Button 
                        size="lg" 
                        className="bg-[#52BAF3] hover:bg-[#40a8e0] text-white px-8 py-3 text-base font-medium"
                        onClick={async () => {
                          if (Object.keys(fieldChanges).length === 0) {
                            toast({
                              title: "No changes to submit",
                              description: "Please make some changes before submitting a change request.",
                              variant: "destructive"
                            });
                            return;
                          }
                          
                          try {
                            // Convert field changes to proposed changes format
                            const proposedChanges = Object.entries(fieldChanges).map(([fieldName, change]) => ({
                              field: fieldName,
                              oldValue: change.originalValue,
                              newValue: change.currentValue
                            }));

                            // Create change request payload matching the schema
                            const changeRequest = {
                              vesselId: 'V001',
                              category: 'workOrders',
                              title: `Modify Work Order: ${workOrder?.jobTitle || workOrder?.woTitle || 'Unknown'}`,
                              reason: 'Work order modification request',
                              requestedByUserId: 'current_user',
                              targetType: 'workOrder',
                              targetId: workOrder?.id,
                              snapshotBeforeJson: {
                                displayKey: workOrder?.workOrderNo || workOrder?.templateCode,
                                displayName: workOrder?.jobTitle || workOrder?.woTitle,
                                displayPath: `${workOrder?.componentCode || ''} ${workOrder?.jobTitle || workOrder?.woTitle || ''}`,
                                fields: workOrder
                              },
                              proposedChangesJson: proposedChanges,
                              status: 'submitted'
                            };

                            console.log("Submitting change request:", changeRequest);
                            
                            const response = await fetch('/api/change-requests', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify(changeRequest),
                            });

                            if (response.ok) {
                              toast({
                                title: "Change Request Submitted",
                                description: `Your change request with ${Object.keys(fieldChanges).length} modifications has been submitted for approval.`,
                              });
                              onClose();
                              window.location.href = '/pms/modify-pms';
                            } else {
                              const errorData = await response.json();
                              throw new Error(errorData.error || 'Failed to submit change request');
                            }
                          } catch (error) {
                            console.error('Error submitting change request:', error);
                            toast({
                              title: "Submission failed",
                              description: (error as Error).message || "Failed to submit change request. Please try again.",
                              variant: "destructive"
                            });
                          }
                        }}
                        disabled={Object.keys(fieldChanges).length === 0}
                      >
                        Submit Change Request
                      </Button>
                    ) : (
                      <Button 
                        size="lg" 
                        className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-base font-medium"
                        onClick={handleSubmit}
                        disabled={isReadOnly && !isApprovalMode}
                      >
                        Submit
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
      
      {/* Work Instructions Dialog */}
      <WorkInstructionsDialog 
        isOpen={isWorkInstructionsOpen}
        onClose={() => setIsWorkInstructionsOpen(false)}
      />
    </Dialog>
  );
};

export default WorkOrderForm;