import React, { useState, useEffect, useRef } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { ChevronDown, ChevronRight, FileText, ArrowLeft, AlertCircle, Pencil, Trash2, Check, X, Plus, Eye, Upload, Save } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import WorkInstructionsDialog from "@/components/WorkInstructionsDialog";
import { useToast } from "@/hooks/use-toast";
import { useModifyMode } from "@/hooks/useModifyMode";
import { ModifyFieldWrapper } from "@/components/modify/ModifyFieldWrapper";
import { ModifyStickyFooter } from "@/components/modify/ModifyStickyFooter";
import { generateSuggestions, extractContextFromWorkOrder, type WorkOrderContext } from "@/utils/suggestionEngine";
import { FEATURES, IHM_ACTIONS } from '@/config/features';
import type { WorkOrder, WorkOrderExecution } from '@shared/schema';

// Type for history mode payload
export interface HistoryWorkOrderPayload {
  template: WorkOrder;
  execution: WorkOrderExecution;
}

interface WorkOrderFormPageProps {
  mode?: 'template' | 'execution' | 'history' | 'new';
}

const WorkOrderFormPage: React.FC<WorkOrderFormPageProps> = ({
  mode = 'execution'
}) => {
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const [, params] = useRoute("/pms/work-order/:id");
  const workOrderId = params?.id;
  
  const [activeSection, setActiveSection] = useState<'partA' | 'partB'>('partA');
  const [isWorkInstructionsOpen, setIsWorkInstructionsOpen] = useState(false);
  
  // Fetch work order context for running hours validation
  const { data: workOrderContext, isLoading: isContextLoading } = useQuery({
    queryKey: ['/api/work-orders', workOrderId, 'context'],
    enabled: !!workOrderId
  });
  
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
  
  // State for inline editing
  const [editingSparePart, setEditingSparePart] = useState<number | null>(null);
  const [editingTool, setEditingTool] = useState<number | null>(null);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [newSafetyRequirement, setNewSafetyRequirement] = useState("");
  const [safetyRequirementCategory, setSafetyRequirementCategory] = useState<'ppeRequirements' | 'permitRequirements' | 'otherRequirements'>('ppeRequirements');
  
  // State for Part B document management
  const riskAssessmentFileRef = useRef<HTMLInputElement>(null);
  const safetyChecklistFileRef = useRef<HTMLInputElement>(null);
  const operationalFormFileRef = useRef<HTMLInputElement>(null);
  const [deleteDocumentDialogOpen, setDeleteDocumentDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{type: string, fileKey: string} | null>(null);
  
  // State for Part B4 spare parts consumed inline editing
  const [editingConsumedSparePart, setEditingConsumedSparePart] = useState<number | null>(null);
  
  // Check if form should be read-only
  const isReadOnly = false; // For now, make it editable

  // Template data (Part A)
  const [templateData, setTemplateData] = useState({
    woTitle: "",
    component: "",
    componentCode: "",
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
    requiredSpareParts: [] as Array<{partNo: string, description: string, quantityRequired: string, remarks: string}>,
    requiredTools: [] as Array<{toolName: string, quantity: string, remarks: string}>,
    safetyRequirements: {
      ppeRequirements: [] as string[],
      permitRequirements: [] as string[],
      otherRequirements: [] as string[]
    },
    workHistory: [] as Array<{woNo: string, assignedTo: string, performedBy: string, workDate: string, runDate: string, completionDate: string, status: string}>
  });

  // Execution data (Part B)
  const [executionData, setExecutionData] = useState({
    woExecutionId: "",
    riskAssessment: "No",
    safetyChecklists: "No",
    operationalForms: "No",
    startDateTime: "",
    completionDateTime: "",
    dateOfCompletion: "", // NEW FIELD
    runningHours: "", // NEW FIELD
    assignedTo: "",
    performedBy: "",
    noOfPersons: "",
    totalTimeHours: "",
    manhours: "",
    workCarriedOut: "",
    jobExperienceNotes: "",
    previousReading: "",
    currentReading: "",
    uploadedDocuments: [] as Array<{type: string, fileName: string, fileKey: string, uploadedAt: string, uploadedBy: string}>,
    consumedSpareParts: [] as Array<{partNo: string, description: string, quantityConsumed: string, comments: string}>,
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

  // Generate WO Execution ID
  const generateWOExecutionId = () => {
    const uniqueId = Math.floor(Math.random() * 9000000) + 1000000;
    return `WO-EXE-${uniqueId}`;
  };

  // Generate on mount if not set
  useEffect(() => {
    if (!executionData.woExecutionId) {
      setExecutionData(prev => ({ ...prev, woExecutionId: generateWOExecutionId() }));
    }
  }, []);

  const handleTemplateChange = (field: string, value: string) => {
    setTemplateData(prev => {
      const newData = { ...prev, [field]: value };
      
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

  // Quick Input function to insert text at cursor position
  const insertQuickText = (text: string) => {
    const textarea = workCarriedOutRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = executionData.workCarriedOut;
    
    const beforeCursor = currentValue.substring(0, start);
    const afterCursor = currentValue.substring(end);
    
    const prefix = beforeCursor && start > 0 ? '\n' : '';
    const newValue = beforeCursor + prefix + text + afterCursor;
    
    handleExecutionChange('workCarriedOut', newValue);
    
    setTimeout(() => {
      textarea.focus();
      const newCursorPosition = start + prefix.length + text.length;
      textarea.setSelectionRange(newCursorPosition, newCursorPosition);
    }, 0);
  };

  // Smart Suggestions function
  const generateSmartSuggestions = () => {
    try {
      const workOrder = null; // TODO: Load from API
      const context = extractContextFromWorkOrder(workOrder, executionData);
      const suggestions = generateSuggestions(context);
      setSmartSuggestions(suggestions);
    } catch (error) {
      console.error('Error generating smart suggestions:', error);
      setSmartSuggestions([]);
    }
  };

  const insertSuggestion = (text: string) => {
    insertQuickText(text);
  };

  const toggleSmartSuggestions = () => {
    const newShowState = !showSmartSuggestions;
    setShowSmartSuggestions(newShowState);
    
    if (newShowState && smartSuggestions.length === 0) {
      generateSmartSuggestions();
    }
  };

  // Part A - Spare Parts Handlers
  const handleAddSparePart = () => {
    const newPart = { partNo: "", description: "", quantityRequired: "", remarks: "" };
    setTemplateData(prev => ({
      ...prev,
      requiredSpareParts: [...prev.requiredSpareParts, newPart]
    }));
    setEditingSparePart(templateData.requiredSpareParts.length);
  };

  const handleEditSparePart = (index: number) => {
    setEditingSparePart(index);
  };

  const handleSaveSparePart = (index: number) => {
    setEditingSparePart(null);
  };

  const handleCancelEditSparePart = () => {
    const currentPart = templateData.requiredSpareParts[editingSparePart!];
    if (!currentPart.partNo && !currentPart.description && !currentPart.quantityRequired) {
      setTemplateData(prev => ({
        ...prev,
        requiredSpareParts: prev.requiredSpareParts.filter((_, i) => i !== editingSparePart)
      }));
    }
    setEditingSparePart(null);
  };

  const handleUpdateSparePartField = (index: number, field: string, value: string) => {
    setTemplateData(prev => ({
      ...prev,
      requiredSpareParts: prev.requiredSpareParts.map((part, i) => 
        i === index ? { ...part, [field]: value } : part
      )
    }));
  };

  const handleDeleteSparePart = (index: number) => {
    setTemplateData(prev => ({
      ...prev,
      requiredSpareParts: prev.requiredSpareParts.filter((_, i) => i !== index)
    }));
  };

  // Part A - Tools Handlers
  const handleAddTool = () => {
    const newTool = { toolName: "", quantity: "", remarks: "" };
    setTemplateData(prev => ({
      ...prev,
      requiredTools: [...prev.requiredTools, newTool]
    }));
    setEditingTool(templateData.requiredTools.length);
  };

  const handleEditTool = (index: number) => {
    setEditingTool(index);
  };

  const handleSaveTool = (index: number) => {
    setEditingTool(null);
  };

  const handleCancelEditTool = () => {
    const currentTool = templateData.requiredTools[editingTool!];
    if (!currentTool.toolName && !currentTool.quantity) {
      setTemplateData(prev => ({
        ...prev,
        requiredTools: prev.requiredTools.filter((_, i) => i !== editingTool)
      }));
    }
    setEditingTool(null);
  };

  const handleUpdateToolField = (index: number, field: string, value: string) => {
    setTemplateData(prev => ({
      ...prev,
      requiredTools: prev.requiredTools.map((tool, i) => 
        i === index ? { ...tool, [field]: value } : tool
      )
    }));
  };

  const handleDeleteTool = (index: number) => {
    setTemplateData(prev => ({
      ...prev,
      requiredTools: prev.requiredTools.filter((_, i) => i !== index)
    }));
  };

  // Part A - Safety Requirements Handlers
  const handleAddSafetyRequirement = (category: 'ppeRequirements' | 'permitRequirements' | 'otherRequirements') => {
    if (!newSafetyRequirement.trim()) return;
    
    setTemplateData(prev => ({
      ...prev,
      safetyRequirements: {
        ...prev.safetyRequirements,
        [category]: [...prev.safetyRequirements[category], newSafetyRequirement.trim()]
      }
    }));
    setNewSafetyRequirement("");
    setIsSafetyModalOpen(false);
  };

  const handleDeleteSafetyRequirement = (category: 'ppeRequirements' | 'permitRequirements' | 'otherRequirements', index: number) => {
    setTemplateData(prev => ({
      ...prev,
      safetyRequirements: {
        ...prev.safetyRequirements,
        [category]: prev.safetyRequirements[category].filter((_, i) => i !== index)
      }
    }));
  };

  // Part B - Document Upload Handlers
  const handleUploadDocument = async (documentType: string, fileInputRef: React.RefObject<HTMLInputElement>) => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>, documentType: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);

      const response = await fetch('/api/upload-document', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload document');
      }

      const result = await response.json();

      setExecutionData(prev => ({
        ...prev,
        uploadedDocuments: [
          ...prev.uploadedDocuments.filter(doc => doc.type !== documentType),
          {
            type: documentType,
            fileName: result.fileName,
            fileKey: result.fileKey,
            uploadedAt: result.uploadedAt,
            uploadedBy: 'current_user'
          }
        ]
      }));

      toast({
        title: "Document uploaded successfully",
        description: `${file.name} has been uploaded.`,
      });

      event.target.value = '';
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload document. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleViewDocument = async (documentType: string) => {
    const document = executionData.uploadedDocuments.find(doc => doc.type === documentType);
    if (!document) return;

    try {
      const fileKeyEncoded = encodeURIComponent(document.fileKey.substring(1));
      const response = await fetch(`/api/documents/${fileKeyEncoded}`);
      
      if (!response.ok) {
        throw new Error('Failed to retrieve document');
      }

      const result = await response.json();
      window.open(result.dataUrl, '_blank');
    } catch (error) {
      console.error('View error:', error);
      toast({
        title: "View failed",
        description: "Failed to open document. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteDocumentClick = (documentType: string) => {
    const document = executionData.uploadedDocuments.find(doc => doc.type === documentType);
    if (!document) return;

    setDocumentToDelete({ type: documentType, fileKey: document.fileKey });
    setDeleteDocumentDialogOpen(true);
  };

  const handleDeleteDocumentConfirm = async () => {
    if (!documentToDelete) return;

    try {
      const fileKeyEncoded = encodeURIComponent(documentToDelete.fileKey.substring(1));
      const response = await fetch(`/api/documents/${fileKeyEncoded}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      setExecutionData(prev => ({
        ...prev,
        uploadedDocuments: prev.uploadedDocuments.filter(doc => doc.type !== documentToDelete.type)
      }));

      toast({
        title: "Document deleted successfully",
        description: "The document has been removed.",
      });

      setDeleteDocumentDialogOpen(false);
      setDocumentToDelete(null);
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Delete failed",
        description: "Failed to delete document. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getUploadedDocument = (documentType: string) => {
    return executionData.uploadedDocuments.find(doc => doc.type === documentType);
  };

  // Part B4 - Consumed Spare Parts Handlers
  const handleAddConsumedSparePart = () => {
    const newPart = { partNo: "", description: "", quantityConsumed: "", comments: "" };
    setExecutionData(prev => ({
      ...prev,
      consumedSpareParts: [...prev.consumedSpareParts, newPart]
    }));
    setEditingConsumedSparePart(executionData.consumedSpareParts.length);
  };

  const handleEditConsumedSparePart = (index: number) => {
    setEditingConsumedSparePart(index);
  };

  const handleSaveConsumedSparePart = (index: number) => {
    setEditingConsumedSparePart(null);
  };

  const handleCancelEditConsumedSparePart = () => {
    const currentPart = executionData.consumedSpareParts[editingConsumedSparePart!];
    if (!currentPart.partNo && !currentPart.description && !currentPart.quantityConsumed) {
      setExecutionData(prev => ({
        ...prev,
        consumedSpareParts: prev.consumedSpareParts.filter((_, i) => i !== editingConsumedSparePart)
      }));
    }
    setEditingConsumedSparePart(null);
  };

  const handleUpdateConsumedSparePartField = (index: number, field: string, value: string) => {
    setExecutionData(prev => ({
      ...prev,
      consumedSpareParts: prev.consumedSpareParts.map((part, i) => 
        i === index ? { ...part, [field]: value } : part
      )
    }));
  };

  const handleDeleteConsumedSparePart = (index: number) => {
    setExecutionData(prev => ({
      ...prev,
      consumedSpareParts: prev.consumedSpareParts.filter((_, i) => i !== index)
    }));
  };

  // Handle save
  const handleSave = async () => {
    try {
      // Determine if this is a completion or draft save
      const isCompleting = !!(executionData.completionDateTime || executionData.dateOfCompletion);
      
      // Running Hours Validation (frontend pre-check for completions)
      if (isCompleting) {
        // Enforce RH requirement for RH-based maintenance
        if ((workOrderContext as any)?.maintenanceBasis === 'Running Hours' && !executionData.runningHours) {
          toast({
            title: "Validation Error",
            description: "Running hours is required for RH-based maintenance when completing work order",
            variant: "destructive",
          });
          return;
        }
        
        // Validate running hours if provided
        if (executionData.runningHours && workOrderContext && (workOrderContext as any).component) {
          const { component, parentComponent } = workOrderContext as any;
          const newRunningHours = parseInt(executionData.runningHours);
          
          if (isNaN(newRunningHours)) {
            toast({
              title: "Validation Error",
              description: "Running hours must be a valid number",
              variant: "destructive",
            });
            return;
          }
          
          // 1. Check if running hours can exceed parent running hours
          if (parentComponent && newRunningHours > parentComponent.currentCumulativeRH) {
            toast({
              title: "Validation Error",
              description: `Running hours (${newRunningHours}) cannot exceed parent component's running hours (${parentComponent.currentCumulativeRH}). Please update parent running hours first.`,
              variant: "destructive",
            });
            return;
          }
          
          // 2. Check for decrease
          if (newRunningHours < component.currentCumulativeRH) {
            toast({
              title: "Validation Error",
              description: `Running hours cannot decrease from ${component.currentCumulativeRH} to ${newRunningHours}. If meter was replaced, please use the Running Hours module.`,
              variant: "destructive",
            });
            return;
          }
          
          // 3. Check realistic delta (max 25 hrs/day)
          if (executionData.dateOfCompletion && component.lastUpdated) {
            const completionDate = new Date(executionData.dateOfCompletion);
            const lastUpdate = new Date(component.lastUpdated);
            const daysDiff = Math.max(1, (completionDate.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
            const hoursDelta = newRunningHours - component.currentCumulativeRH;
            const maxAllowed = daysDiff * 25;
            
            if (hoursDelta > maxAllowed) {
              toast({
                title: "Validation Error",
                description: `Running hours increase of ${hoursDelta} hrs over ${daysDiff.toFixed(1)} days exceeds realistic limit (max ${maxAllowed.toFixed(0)} hrs at 25 hrs/day). Please verify the entered value.`,
                variant: "destructive",
              });
              return;
            }
          }
        }
      }
      
      // Call appropriate API endpoint
      let response;
      if (isCompleting) {
        // Use completion endpoint for atomic RH update
        response = await fetch(`/api/work-orders/${workOrderId}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...executionData,
            runningHours: executionData.runningHours,
            dateOfCompletion: executionData.dateOfCompletion
          })
        });
      } else {
        // Use regular update for draft saves - include both Part A (template) and Part B (execution) data
        response = await fetch(`/api/work-orders/${workOrderId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...templateData,
            ...executionData
          })
        });
      }
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save work order');
      }
      
      toast({
        title: "Success",
        description: isCompleting && result.runningHoursUpdated 
          ? "Work order completed and running hours updated successfully" 
          : isCompleting 
            ? "Work order completed successfully"
            : "Work order saved successfully",
      });
      navigate("/pms/work-orders");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save work order",
        variant: "destructive",
      });
    }
  };

  const handleBack = () => {
    navigate("/pms/work-orders");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header Bar - Clean white header with border-bottom */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left side: Back button + title */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="text-gray-600 hover:text-gray-900"
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <h1 className="text-lg font-semibold text-gray-900">Work Order Form</h1>
            </div>
            {/* Right side: Work Instructions button (outline) + Save button (blue) */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsWorkInstructionsOpen(true)}
                data-testid="button-work-instructions"
              >
                <FileText className="h-4 w-4 mr-1" />
                Work Instructions
              </Button>
              <Button
                onClick={handleSave}
                size="sm"
                className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white"
                data-testid="button-save"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Horizontal Tab Navigation - Single line tabs with inline subtitles */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveSection('partA')}
              className={`py-3 px-1 border-b-2 text-sm transition-colors whitespace-nowrap ${
                activeSection === 'partA'
                  ? 'border-[#3B82F6] text-[#3B82F6]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              data-testid="tab-part-a"
            >
              <span className="font-medium">Part A - Work Order Details</span>
              <span className="text-xs text-gray-400 font-normal ml-2">Work details about the work that needs to be done</span>
            </button>
            <button
              onClick={() => setActiveSection('partB')}
              className={`py-3 px-1 border-b-2 text-sm transition-colors whitespace-nowrap ${
                activeSection === 'partB'
                  ? 'border-[#3B82F6] text-[#3B82F6]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              data-testid="tab-part-b"
            >
              <span className="font-medium">Part B - Work Completion Record</span>
              <span className="text-xs text-gray-400 font-normal ml-2">Enter work completion details, risk assessments, checklists, consumed parts</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-6 py-6">
        <div className="max-w-7xl mx-auto">
          {activeSection === 'partA' ? (
            <div className="space-y-6">
              {/* Top Section - Three Column Grid (light gray background) */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]">WO Title *</Label>
                    <Input 
                      value={templateData.woTitle} 
                      onChange={(e) => handleTemplateChange('woTitle', e.target.value)}
                      className="text-sm bg-white"
                      placeholder="Enter work order title"
                      disabled={isReadOnly}
                      data-testid="input-wo-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]">Component</Label>
                    <div className="text-sm text-gray-900 p-2 bg-white border border-gray-200 rounded">{templateData.component || "-"}</div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]">Component Code</Label>
                    <div className="text-sm text-gray-600 p-2 bg-white border border-gray-200 rounded">{templateData.componentCode || "-"}</div>
                  </div>
                </div>
              </div>

              {/* A1. Work Order Information */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h4 className="text-md font-medium mb-4 text-[#3B82F6]">A1. Work Order Information</h4>
                
                <div className="space-y-6">
                  {/* Row 1: Maintenance Basis*, Every*, Unit* */}
                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Maintenance Basis *</Label>
                      <Select 
                        value={templateData.maintenanceBasis} 
                        onValueChange={(value) => handleTemplateChange('maintenanceBasis', value)}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger className="text-sm" data-testid="select-maintenance-basis">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Calendar">Calendar</SelectItem>
                          <SelectItem value="Running Hours">Running Hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">
                        {templateData.maintenanceBasis === "Calendar" ? "Every *" : "Every (Hours) *"}
                      </Label>
                      <Input 
                        type="number"
                        value={templateData.frequencyValue} 
                        onChange={(e) => handleTemplateChange('frequencyValue', e.target.value)}
                        className="text-sm"
                        placeholder={templateData.maintenanceBasis === "Running Hours" ? "e.g., 1000" : ""}
                        disabled={isReadOnly}
                        data-testid="input-frequency-value"
                      />
                    </div>
                    
                    {templateData.maintenanceBasis === "Calendar" && (
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Unit *</Label>
                        <Select 
                          value={templateData.frequencyUnit} 
                          onValueChange={(value) => handleTemplateChange('frequencyUnit', value)}
                          disabled={isReadOnly}
                        >
                          <SelectTrigger className="text-sm" data-testid="select-frequency-unit">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Days">Days</SelectItem>
                            <SelectItem value="Weeks">Weeks</SelectItem>
                            <SelectItem value="Months">Months</SelectItem>
                            <SelectItem value="Years">Years</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Row 2: Task Type*, Assigned To*, Approver */}
                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Task Type *</Label>
                      <Select 
                        value={templateData.taskType} 
                        onValueChange={(value) => handleTemplateChange('taskType', value)}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger className="text-sm" data-testid="select-task-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Inspection">Inspection</SelectItem>
                          <SelectItem value="Overhaul">Overhaul</SelectItem>
                          <SelectItem value="Service">Service</SelectItem>
                          <SelectItem value="Testing">Testing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Assigned To *</Label>
                      <Select 
                        value={templateData.assignedTo} 
                        onValueChange={(value) => handleTemplateChange('assignedTo', value)}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger className="text-sm" data-testid="select-assigned-to">
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
                      <Label className="text-sm text-[#8798ad]">Approver</Label>
                      <Select 
                        value={templateData.approver} 
                        onValueChange={(value) => handleTemplateChange('approver', value)}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger className="text-sm" data-testid="select-approver">
                          <SelectValue placeholder="Select rank (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {ranks.map(rank => (
                            <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Row 3: Job Priority, Class Related, Next Due Date (Optional) */}
                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Job Priority</Label>
                      <Select 
                        value={templateData.jobPriority} 
                        onValueChange={(value) => handleTemplateChange('jobPriority', value)}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger className="text-sm" data-testid="select-job-priority">
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
                      <Select 
                        value={templateData.classRelated} 
                        onValueChange={(value) => handleTemplateChange('classRelated', value)}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger className="text-sm" data-testid="select-class-related">
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
                          disabled={isReadOnly}
                          data-testid="input-next-due-date"
                        />
                      ) : (
                        <Input
                          type="number"
                          value={templateData.nextDueReading}
                          onChange={(e) => handleTemplateChange('nextDueReading', e.target.value)}
                          className="text-sm"
                          placeholder="Running hours"
                          disabled={isReadOnly}
                          data-testid="input-next-due-reading"
                        />
                      )}
                    </div>
                  </div>

                  {/* Row 4 (full width): Brief Work Description */}
                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]">Brief Work Description</Label>
                    <Textarea
                      value={templateData.briefWorkDescription}
                      onChange={(e) => handleTemplateChange('briefWorkDescription', e.target.value)}
                      className="text-sm min-h-[80px]"
                      placeholder="Describe what this job is to do for the manufacturer/builder guidance (e.g. Lubricate, Clean, Change Oil, etc.)"
                      disabled={isReadOnly}
                      data-testid="textarea-brief-work-description"
                    />
                  </div>
                </div>
              </div>

              {/* A2. Required Spare Parts */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-medium text-[#3B82F6]">A2. Required Spare Parts</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-600 hover:text-blue-800"
                    onClick={handleAddSparePart}
                    disabled={isReadOnly}
                    data-testid="button-add-spare-part-a2"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Spare Part
                  </Button>
                </div>
                
                <div className="border border-[#E5E7EB] rounded">
                  <div className="bg-gray-50 px-4 py-3 border-b border-[#E5E7EB]">
                    <div className="grid grid-cols-[2fr_3fr_1.5fr_2fr_auto] gap-4 text-sm font-medium text-gray-700">
                      <div>Part No</div>
                      <div>Description</div>
                      <div>Quantity Required</div>
                      <div>Remarks</div>
                      <div className="w-20">Actions</div>
                    </div>
                  </div>
                  <div className="divide-y divide-[#E5E7EB]">
                    {templateData.requiredSpareParts.length > 0 ? (
                      templateData.requiredSpareParts.map((part, index) => (
                        <div key={index} className="px-4 py-3">
                          {editingSparePart === index ? (
                            <div className="grid grid-cols-[2fr_3fr_1.5fr_2fr_auto] gap-4 items-center">
                              <Input
                                value={part.partNo}
                                onChange={(e) => handleUpdateSparePartField(index, 'partNo', e.target.value)}
                                placeholder="Part No"
                                className="text-sm"
                                data-testid={`input-part-no-${index}`}
                              />
                              <Input
                                value={part.description}
                                onChange={(e) => handleUpdateSparePartField(index, 'description', e.target.value)}
                                placeholder="Description"
                                className="text-sm"
                                data-testid={`input-part-description-${index}`}
                              />
                              <Input
                                type="number"
                                value={part.quantityRequired}
                                onChange={(e) => handleUpdateSparePartField(index, 'quantityRequired', e.target.value)}
                                placeholder="Qty"
                                className="text-sm"
                                data-testid={`input-part-quantity-${index}`}
                              />
                              <Input
                                value={part.remarks}
                                onChange={(e) => handleUpdateSparePartField(index, 'remarks', e.target.value)}
                                placeholder="Remarks"
                                className="text-sm"
                                data-testid={`input-part-remarks-${index}`}
                              />
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSaveSparePart(index)}
                                  className="h-8 w-8 p-0"
                                  data-testid={`button-save-part-${index}`}
                                >
                                  <Check className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleCancelEditSparePart}
                                  className="h-8 w-8 p-0"
                                  data-testid={`button-cancel-part-${index}`}
                                >
                                  <X className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-[2fr_3fr_1.5fr_2fr_auto] gap-4 items-center">
                              <div className="text-sm text-gray-900">{part.partNo || '-'}</div>
                              <div className="text-sm text-gray-900">{part.description || '-'}</div>
                              <div className="text-sm text-gray-900">{part.quantityRequired || '-'}</div>
                              <div className="text-sm text-gray-900">{part.remarks || '-'}</div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditSparePart(index)}
                                  className="h-8 w-8 p-0"
                                  disabled={isReadOnly}
                                  data-testid={`button-edit-part-${index}`}
                                >
                                  <Pencil className="h-4 w-4 text-blue-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteSparePart(index)}
                                  className="h-8 w-8 p-0"
                                  disabled={isReadOnly}
                                  data-testid={`button-delete-part-${index}`}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-gray-500 text-sm">
                        No spare parts required yet
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* A3. Required Tools & Equipment */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-medium text-[#3B82F6]">A3. Required Tools & Equipment</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-600 hover:text-blue-800"
                    onClick={handleAddTool}
                    disabled={isReadOnly}
                    data-testid="button-add-tool-a3"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Tool
                  </Button>
                </div>
                
                <div className="border border-[#E5E7EB] rounded">
                  <div className="bg-gray-50 px-4 py-3 border-b border-[#E5E7EB]">
                    <div className="grid grid-cols-[3fr_1.5fr_2fr_auto] gap-4 text-sm font-medium text-gray-700">
                      <div>Tool Name</div>
                      <div>Quantity</div>
                      <div>Remarks</div>
                      <div className="w-20">Actions</div>
                    </div>
                  </div>
                  <div className="divide-y divide-[#E5E7EB]">
                    {templateData.requiredTools.length > 0 ? (
                      templateData.requiredTools.map((tool, index) => (
                        <div key={index} className="px-4 py-3">
                          {editingTool === index ? (
                            <div className="grid grid-cols-[3fr_1.5fr_2fr_auto] gap-4 items-center">
                              <Input
                                value={tool.toolName}
                                onChange={(e) => handleUpdateToolField(index, 'toolName', e.target.value)}
                                placeholder="Tool Name"
                                className="text-sm"
                                data-testid={`input-tool-name-${index}`}
                              />
                              <Input
                                type="number"
                                value={tool.quantity}
                                onChange={(e) => handleUpdateToolField(index, 'quantity', e.target.value)}
                                placeholder="Qty"
                                className="text-sm"
                                data-testid={`input-tool-quantity-${index}`}
                              />
                              <Input
                                value={tool.remarks}
                                onChange={(e) => handleUpdateToolField(index, 'remarks', e.target.value)}
                                placeholder="Remarks"
                                className="text-sm"
                                data-testid={`input-tool-remarks-${index}`}
                              />
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSaveTool(index)}
                                  className="h-8 w-8 p-0"
                                  data-testid={`button-save-tool-${index}`}
                                >
                                  <Check className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleCancelEditTool}
                                  className="h-8 w-8 p-0"
                                  data-testid={`button-cancel-tool-${index}`}
                                >
                                  <X className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-[3fr_1.5fr_2fr_auto] gap-4 items-center">
                              <div className="text-sm text-gray-900">{tool.toolName || '-'}</div>
                              <div className="text-sm text-gray-900">{tool.quantity || '-'}</div>
                              <div className="text-sm text-gray-900">{tool.remarks || '-'}</div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditTool(index)}
                                  className="h-8 w-8 p-0"
                                  disabled={isReadOnly}
                                  data-testid={`button-edit-tool-${index}`}
                                >
                                  <Pencil className="h-4 w-4 text-blue-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteTool(index)}
                                  className="h-8 w-8 p-0"
                                  disabled={isReadOnly}
                                  data-testid={`button-delete-tool-${index}`}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-gray-500 text-sm">
                        No tools required yet
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* A4. Safety Requirements */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-medium text-[#3B82F6]">A4. Safety Requirements</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-600 hover:text-blue-800"
                    onClick={() => setIsSafetyModalOpen(true)}
                    disabled={isReadOnly}
                    data-testid="button-add-requirement-a4"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Requirement
                  </Button>
                </div>
                
                <div className="space-y-4">
                  {/* PPE Requirements */}
                  <div className="border border-gray-200 rounded p-4">
                    <h5 className="text-sm font-medium text-gray-700 mb-3">PPE Requirements</h5>
                    {templateData.safetyRequirements.ppeRequirements.length > 0 ? (
                      <div className="space-y-2">
                        {templateData.safetyRequirements.ppeRequirements.map((req, index) => (
                          <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <span className="text-sm text-gray-900">{req}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSafetyRequirement('ppeRequirements', index)}
                              className="h-6 w-6 p-0"
                              disabled={isReadOnly}
                              data-testid={`button-delete-ppe-${index}`}
                            >
                              <Trash2 className="h-3 w-3 text-red-600" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">No PPE requirements specified yet</div>
                    )}
                  </div>
                  
                  {/* Permit Requirements */}
                  <div className="border border-gray-200 rounded p-4">
                    <h5 className="text-sm font-medium text-gray-700 mb-3">Permit Requirements</h5>
                    {templateData.safetyRequirements.permitRequirements.length > 0 ? (
                      <div className="space-y-2">
                        {templateData.safetyRequirements.permitRequirements.map((req, index) => (
                          <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <span className="text-sm text-gray-900">{req}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSafetyRequirement('permitRequirements', index)}
                              className="h-6 w-6 p-0"
                              disabled={isReadOnly}
                              data-testid={`button-delete-permit-${index}`}
                            >
                              <Trash2 className="h-3 w-3 text-red-600" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">No permit requirements specified yet</div>
                    )}
                  </div>
                  
                  {/* Other Safety Requirements */}
                  <div className="border border-gray-200 rounded p-4">
                    <h5 className="text-sm font-medium text-gray-700 mb-3">Other Safety Requirements</h5>
                    {templateData.safetyRequirements.otherRequirements.length > 0 ? (
                      <div className="space-y-2">
                        {templateData.safetyRequirements.otherRequirements.map((req, index) => (
                          <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <span className="text-sm text-gray-900">{req}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSafetyRequirement('otherRequirements', index)}
                              className="h-6 w-6 p-0"
                              disabled={isReadOnly}
                              data-testid={`button-delete-other-${index}`}
                            >
                              <Trash2 className="h-3 w-3 text-red-600" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">No other safety requirements specified yet</div>
                    )}
                  </div>
                </div>
              </div>

              {/* A5. Work History */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h4 className="text-md font-medium mb-4 text-[#3B82F6]">A5. Work History</h4>
                
                <div className="border border-[#E5E7EB] rounded">
                  <div className="bg-gray-50 px-4 py-3 border-b border-[#E5E7EB]">
                    <div className="grid grid-cols-7 gap-4 text-sm font-medium text-gray-700">
                      <div>Work Done No</div>
                      <div>Completed On</div>
                      <div>By</div>
                      <div>Approved By</div>
                      <div>Last Done Date</div>
                      <div>Next Due</div>
                      <div>Completion Status</div>
                    </div>
                  </div>
                  <div className="divide-y divide-[#E5E7EB]">
                    {templateData.workHistory && templateData.workHistory.length > 0 ? (
                      templateData.workHistory.map((execution: any, index: number) => (
                        <div key={index} className="px-4 py-3 cursor-pointer hover:bg-gray-50" data-testid={`work-history-row-${index}`}>
                          <div className="grid grid-cols-7 gap-4 text-sm items-center">
                            <div className="text-gray-900">{execution.woNo || '-'}</div>
                            <div className="text-gray-900">{execution.workDate || '-'}</div>
                            <div className="text-gray-900">{execution.performedBy || '-'}</div>
                            <div className="text-gray-900">{execution.assignedTo || '-'}</div>
                            <div className="text-gray-900">{execution.completionDate || '-'}</div>
                            <div className="text-gray-900">{execution.runDate || '-'}</div>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                                {execution.status || 'Completed'}
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
          ) : (
            /* Part B - Work Completion Record */
            <div className="space-y-6">
              {/* WO Execution ID Header */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <Label className="text-sm text-[#8798ad]">WO Execution ID</Label>
                <div className="text-sm font-medium text-gray-900 mt-1">
                  {executionData.woExecutionId}
                </div>
              </div>

              {/* B1. Risk Assessment, Checklists & Records */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h4 className="text-md font-medium mb-4 text-[#3B82F6]">B1. Risk Assessment, Checklists & Records</h4>
                
                <div className="space-y-4">
                  {/* B1.1 Risk Assessment */}
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-6">
                      <Label className="text-sm text-gray-900">B1.1 Risk Assessment Completed / Reviewed:</Label>
                    </div>
                    <div className="col-span-3 flex items-center gap-4">
                      <label className="flex items-center gap-2">
                        <input 
                          type="radio" 
                          name="riskAssessment" 
                          value="Yes" 
                          checked={executionData.riskAssessment === "Yes"}
                          onChange={(e) => handleExecutionChange('riskAssessment', e.target.value)}
                          className="text-blue-600" 
                          data-testid="radio-risk-assessment-yes"
                        />
                        <span className="text-sm">Yes</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input 
                          type="radio" 
                          name="riskAssessment" 
                          value="No" 
                          checked={executionData.riskAssessment === "No"}
                          onChange={(e) => handleExecutionChange('riskAssessment', e.target.value)}
                          className="text-blue-600" 
                          data-testid="radio-risk-assessment-no"
                        />
                        <span className="text-sm">No</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input 
                          type="radio" 
                          name="riskAssessment" 
                          value="NA" 
                          checked={executionData.riskAssessment === "NA"}
                          onChange={(e) => handleExecutionChange('riskAssessment', e.target.value)}
                          className="text-blue-600" 
                          data-testid="radio-risk-assessment-na"
                        />
                        <span className="text-sm">NA</span>
                      </label>
                    </div>
                    <div className="col-span-3 flex gap-2 justify-end">
                      <input
                        ref={riskAssessmentFileRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileSelected(e, 'riskAssessment')}
                        className="hidden"
                      />
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs"
                        onClick={() => handleUploadDocument('riskAssessment', riskAssessmentFileRef)}
                        data-testid="button-upload-risk-assessment"
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        Upload
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleViewDocument('riskAssessment')}
                        disabled={!getUploadedDocument('riskAssessment')}
                        data-testid="button-view-risk-assessment"
                      >
                        <Eye className={`h-4 w-4 ${getUploadedDocument('riskAssessment') ? 'text-blue-600' : 'text-gray-400'}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleDeleteDocumentClick('riskAssessment')}
                        disabled={!getUploadedDocument('riskAssessment')}
                        data-testid="button-delete-risk-assessment"
                      >
                        <Trash2 className={`h-4 w-4 ${getUploadedDocument('riskAssessment') ? 'text-red-600' : 'text-gray-400'}`} />
                      </Button>
                    </div>
                  </div>

                  {/* B1.2 Safety Checklists */}
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-6">
                      <Label className="text-sm text-gray-900">B1.2 Safety Checklists Completed (As applicable):</Label>
                    </div>
                    <div className="col-span-3 flex items-center gap-4">
                      <label className="flex items-center gap-2">
                        <input 
                          type="radio" 
                          name="safetyChecklists" 
                          value="Yes" 
                          checked={executionData.safetyChecklists === "Yes"}
                          onChange={(e) => handleExecutionChange('safetyChecklists', e.target.value)}
                          className="text-blue-600" 
                          data-testid="radio-safety-checklists-yes"
                        />
                        <span className="text-sm">Yes</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input 
                          type="radio" 
                          name="safetyChecklists" 
                          value="No" 
                          checked={executionData.safetyChecklists === "No"}
                          onChange={(e) => handleExecutionChange('safetyChecklists', e.target.value)}
                          className="text-blue-600" 
                          data-testid="radio-safety-checklists-no"
                        />
                        <span className="text-sm">No</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input 
                          type="radio" 
                          name="safetyChecklists" 
                          value="NA" 
                          checked={executionData.safetyChecklists === "NA"}
                          onChange={(e) => handleExecutionChange('safetyChecklists', e.target.value)}
                          className="text-blue-600" 
                          data-testid="radio-safety-checklists-na"
                        />
                        <span className="text-sm">NA</span>
                      </label>
                    </div>
                    <div className="col-span-3 flex gap-2 justify-end">
                      <input
                        ref={safetyChecklistFileRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileSelected(e, 'safetyChecklist')}
                        className="hidden"
                      />
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs"
                        onClick={() => handleUploadDocument('safetyChecklist', safetyChecklistFileRef)}
                        data-testid="button-upload-safety-checklist"
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        Upload
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleViewDocument('safetyChecklist')}
                        disabled={!getUploadedDocument('safetyChecklist')}
                        data-testid="button-view-safety-checklist"
                      >
                        <Eye className={`h-4 w-4 ${getUploadedDocument('safetyChecklist') ? 'text-blue-600' : 'text-gray-400'}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleDeleteDocumentClick('safetyChecklist')}
                        disabled={!getUploadedDocument('safetyChecklist')}
                        data-testid="button-delete-safety-checklist"
                      >
                        <Trash2 className={`h-4 w-4 ${getUploadedDocument('safetyChecklist') ? 'text-red-600' : 'text-gray-400'}`} />
                      </Button>
                    </div>
                  </div>

                  {/* B1.3 Operational Forms */}
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-6">
                      <Label className="text-sm text-gray-900">B1.3 Operational Forms Completed (As applicable):</Label>
                    </div>
                    <div className="col-span-3 flex items-center gap-4">
                      <label className="flex items-center gap-2">
                        <input 
                          type="radio" 
                          name="operationalForms" 
                          value="Yes" 
                          checked={executionData.operationalForms === "Yes"}
                          onChange={(e) => handleExecutionChange('operationalForms', e.target.value)}
                          className="text-blue-600" 
                          data-testid="radio-operational-forms-yes"
                        />
                        <span className="text-sm">Yes</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input 
                          type="radio" 
                          name="operationalForms" 
                          value="No" 
                          checked={executionData.operationalForms === "No"}
                          onChange={(e) => handleExecutionChange('operationalForms', e.target.value)}
                          className="text-blue-600" 
                          data-testid="radio-operational-forms-no"
                        />
                        <span className="text-sm">No</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input 
                          type="radio" 
                          name="operationalForms" 
                          value="NA" 
                          checked={executionData.operationalForms === "NA"}
                          onChange={(e) => handleExecutionChange('operationalForms', e.target.value)}
                          className="text-blue-600" 
                          data-testid="radio-operational-forms-na"
                        />
                        <span className="text-sm">NA</span>
                      </label>
                    </div>
                    <div className="col-span-3 flex gap-2 justify-end">
                      <input
                        ref={operationalFormFileRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileSelected(e, 'operationalForm')}
                        className="hidden"
                      />
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs"
                        onClick={() => handleUploadDocument('operationalForm', operationalFormFileRef)}
                        data-testid="button-upload-operational-form"
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        Upload
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleViewDocument('operationalForm')}
                        disabled={!getUploadedDocument('operationalForm')}
                        data-testid="button-view-operational-form"
                      >
                        <Eye className={`h-4 w-4 ${getUploadedDocument('operationalForm') ? 'text-blue-600' : 'text-gray-400'}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleDeleteDocumentClick('operationalForm')}
                        disabled={!getUploadedDocument('operationalForm')}
                        data-testid="button-delete-operational-form"
                      >
                        <Trash2 className={`h-4 w-4 ${getUploadedDocument('operationalForm') ? 'text-red-600' : 'text-gray-400'}`} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* B2. Details of Work Carried Out */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h4 className="text-md font-medium mb-4 text-[#3B82F6]">B2. Details of Work Carried Out</h4>
                
                <div className="space-y-6">
                  {/* Row 1: Start Date/Time, Completion Date/Time, Assigned To */}
                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Start Date/Time</Label>
                      <Input
                        type="datetime-local"
                        value={executionData.startDateTime}
                        onChange={(e) => handleExecutionChange('startDateTime', e.target.value)}
                        className="text-sm"
                        data-testid="input-start-datetime"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Completion Date/Time</Label>
                      <Input
                        type="datetime-local"
                        value={executionData.completionDateTime}
                        onChange={(e) => handleExecutionChange('completionDateTime', e.target.value)}
                        className="text-sm"
                        data-testid="input-completion-datetime"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Assigned To</Label>
                      <Select 
                        value={executionData.assignedTo} 
                        onValueChange={(value) => handleExecutionChange('assignedTo', value)}
                      >
                        <SelectTrigger className="text-sm" data-testid="select-execution-assigned-to">
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

                  {/* Row 2: Performed By, No of Persons, Total Time Hours */}
                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Performed By</Label>
                      <Select 
                        value={executionData.performedBy} 
                        onValueChange={(value) => handleExecutionChange('performedBy', value)}
                      >
                        <SelectTrigger className="text-sm" data-testid="select-performed-by">
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
                      <Label className="text-sm text-[#8798ad]">No of Persons</Label>
                      <Input
                        type="number"
                        value={executionData.noOfPersons}
                        onChange={(e) => handleExecutionChange('noOfPersons', e.target.value)}
                        className="text-sm"
                        placeholder="0"
                        data-testid="input-no-of-persons"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Total Time (Hrs)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={executionData.totalTimeHours}
                        onChange={(e) => handleExecutionChange('totalTimeHours', e.target.value)}
                        className="text-sm"
                        placeholder="0.0"
                        data-testid="input-total-time-hours"
                      />
                    </div>
                  </div>

                  {/* Work Carried Out textarea with Quick Input and Smart Suggestions */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-[#8798ad]">Work Carried Out</Label>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowQuickInputs(!showQuickInputs)}
                          className="text-xs"
                          data-testid="button-quick-input"
                        >
                          Quick Input ▼
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={toggleSmartSuggestions}
                          className="text-xs"
                          data-testid="button-smart-suggestions"
                        >
                          Smart Suggestions ▼
                        </Button>
                      </div>
                    </div>
                    
                    {/* Quick Input Dropdown */}
                    {showQuickInputs && (
                      <div className="border border-gray-200 rounded bg-white p-2 shadow-sm max-h-60 overflow-y-auto">
                        {quickAnswers.map((answer, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              insertQuickText(answer);
                              setShowQuickInputs(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                            data-testid={`quick-input-${index}`}
                          >
                            {answer}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* Smart Suggestions Dropdown */}
                    {showSmartSuggestions && (
                      <div className="border border-gray-200 rounded bg-white p-2 shadow-sm max-h-60 overflow-y-auto">
                        {smartSuggestions.length > 0 ? (
                          smartSuggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                insertSuggestion(suggestion);
                                setShowSmartSuggestions(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                              data-testid={`smart-suggestion-${index}`}
                            >
                              {suggestion}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-gray-500">No suggestions available</div>
                        )}
                      </div>
                    )}
                    
                    <Textarea
                      ref={workCarriedOutRef}
                      value={executionData.workCarriedOut}
                      onChange={(e) => handleExecutionChange('workCarriedOut', e.target.value)}
                      className="text-sm min-h-[100px]"
                      placeholder="Describe work carried out..."
                      data-testid="textarea-work-carried-out"
                    />
                  </div>

                  {/* Job Experience / Notes */}
                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]">Job Experience / Notes</Label>
                    <Textarea
                      value={executionData.jobExperienceNotes}
                      onChange={(e) => handleExecutionChange('jobExperienceNotes', e.target.value)}
                      className="text-sm min-h-[80px]"
                      placeholder="Any notes or experiences..."
                      data-testid="textarea-job-experience-notes"
                    />
                  </div>
                </div>
              </div>

              {/* B3. Running Hours */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h4 className="text-md font-medium mb-4 text-[#3B82F6]">B3. Running Hours</h4>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]">Previous Reading</Label>
                    <Input
                      type="number"
                      value={executionData.previousReading}
                      onChange={(e) => handleExecutionChange('previousReading', e.target.value)}
                      className="text-sm"
                      placeholder="Previous running hours"
                      data-testid="input-previous-reading"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]">Current Reading</Label>
                    <Input
                      type="number"
                      value={executionData.currentReading}
                      onChange={(e) => handleExecutionChange('currentReading', e.target.value)}
                      className="text-sm"
                      placeholder="Current running hours"
                      data-testid="input-current-reading"
                    />
                  </div>
                </div>
              </div>

              {/* B4. Spare Parts Consumed */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h4 className="text-md font-medium mb-4 text-[#3B82F6]">B4. Spare Parts Consumed</h4>
                
                <div className="border border-[#E5E7EB] rounded">
                  <div className="bg-gray-50 px-4 py-3 border-b border-[#E5E7EB]">
                    <div className="grid grid-cols-[2fr_3fr_1.5fr_2fr_auto] gap-4 text-sm font-medium text-gray-700">
                      <div>Part No</div>
                      <div>Description</div>
                      <div>Quantity Consumed</div>
                      <div>Consumable Cost</div>
                      <div className="w-20">Actions</div>
                    </div>
                  </div>
                  <div className="divide-y divide-[#E5E7EB]">
                    {executionData.consumedSpareParts.length > 0 ? (
                      executionData.consumedSpareParts.map((part, index) => (
                        <div key={index} className="px-4 py-3">
                          {editingConsumedSparePart === index ? (
                            <div className="grid grid-cols-[2fr_3fr_1.5fr_2fr_auto] gap-4 items-center">
                              <Input
                                value={part.partNo}
                                onChange={(e) => handleUpdateConsumedSparePartField(index, 'partNo', e.target.value)}
                                placeholder="Part No"
                                className="text-sm"
                                data-testid={`input-consumed-part-no-${index}`}
                              />
                              <Input
                                value={part.description}
                                onChange={(e) => handleUpdateConsumedSparePartField(index, 'description', e.target.value)}
                                placeholder="Description"
                                className="text-sm"
                                data-testid={`input-consumed-description-${index}`}
                              />
                              <Input
                                type="number"
                                value={part.quantityConsumed}
                                onChange={(e) => handleUpdateConsumedSparePartField(index, 'quantityConsumed', e.target.value)}
                                placeholder="Qty"
                                className="text-sm"
                                data-testid={`input-consumed-quantity-${index}`}
                              />
                              <Input
                                value={part.comments}
                                onChange={(e) => handleUpdateConsumedSparePartField(index, 'comments', e.target.value)}
                                placeholder="Comments"
                                className="text-sm"
                                data-testid={`input-consumed-comments-${index}`}
                              />
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSaveConsumedSparePart(index)}
                                  className="h-8 w-8 p-0"
                                  data-testid={`button-save-consumed-${index}`}
                                >
                                  <Check className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleCancelEditConsumedSparePart}
                                  className="h-8 w-8 p-0"
                                  data-testid={`button-cancel-consumed-${index}`}
                                >
                                  <X className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-[2fr_3fr_1.5fr_2fr_auto] gap-4 items-center">
                              <div className="text-sm text-gray-900">{part.partNo || '-'}</div>
                              <div className="text-sm text-gray-900">{part.description || '-'}</div>
                              <div className="text-sm text-gray-900">{part.quantityConsumed || '-'}</div>
                              <div className="text-sm text-gray-900">{part.comments || '-'}</div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditConsumedSparePart(index)}
                                  className="h-8 w-8 p-0"
                                  data-testid={`button-edit-consumed-${index}`}
                                >
                                  <Pencil className="h-4 w-4 text-blue-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteConsumedSparePart(index)}
                                  className="h-8 w-8 p-0"
                                  data-testid={`button-delete-consumed-${index}`}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-gray-500 text-sm">
                        No spare parts consumed yet
                      </div>
                    )}
                  </div>
                </div>
                
                {/* B5. + Add Spare Part button (green at bottom) */}
                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={handleAddConsumedSparePart}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    data-testid="button-add-consumed-spare-part"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Spare Part
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Work Instructions Dialog */}
      <WorkInstructionsDialog
        isOpen={isWorkInstructionsOpen}
        onClose={() => setIsWorkInstructionsOpen(false)}
      />

      {/* Safety Requirement Modal */}
      <AlertDialog open={isSafetyModalOpen} onOpenChange={setIsSafetyModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add Safety Requirement</AlertDialogTitle>
            <AlertDialogDescription>
              Select the category and enter the safety requirement details.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={safetyRequirementCategory} onValueChange={(value: any) => setSafetyRequirementCategory(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ppeRequirements">PPE Requirements</SelectItem>
                  <SelectItem value="permitRequirements">Permit Requirements</SelectItem>
                  <SelectItem value="otherRequirements">Other Requirements</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Requirement</Label>
              <Textarea
                value={newSafetyRequirement}
                onChange={(e) => setNewSafetyRequirement(e.target.value)}
                placeholder="Enter safety requirement..."
                className="min-h-[80px]"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleAddSafetyRequirement(safetyRequirementCategory)}>
              Add
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Document Confirmation Dialog */}
      <AlertDialog open={deleteDocumentDialogOpen} onOpenChange={setDeleteDocumentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDocumentConfirm} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WorkOrderFormPage;
