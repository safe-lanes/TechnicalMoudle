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
import { FileText, ArrowLeft, Plus, Eye, Upload, Download, Menu } from "lucide-react";
import sailLogo from "@assets/SAIL logo Transparent_1753957135582.png";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import { sampleSpareParts, sampleTools, sampleSafetyRequirements, sampleWorkHistory } from '@/lib/workOrderSampleData';
import { SectionBlock } from '@/components/SectionBlock';
import { WorkOrderDataTable } from '@/components/WorkOrderDataTable';
import { StatusPill } from '@/components/StatusPill';

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
  
  const [isWorkInstructionsOpen, setIsWorkInstructionsOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  
  // Navigation sections for sidebar and mobile menu
  const navSections = [
    { id: 'work-order-info', label: 'Work Order Information' },
    { id: 'spare-parts', label: 'Required Spare Parts' },
    { id: 'tools', label: 'Required Tools' },
    { id: 'safety', label: 'Safety Requirements' },
    { id: 'history', label: 'Work History' },
    { id: 'completion', label: 'Work Completion' },
    { id: 'documents', label: 'Documents' }
  ];
  
  const { data: workOrderContext, isLoading: isContextLoading } = useQuery({
    queryKey: ['/api/work-orders', workOrderId, 'context'],
    enabled: !!workOrderId
  });
  
  const workCarriedOutRef = useRef<HTMLTextAreaElement>(null);
  const [showQuickInputs, setShowQuickInputs] = useState(false);
  
  const [showSmartSuggestions, setShowSmartSuggestions] = useState(false);
  const [smartSuggestions, setSmartSuggestions] = useState<string[]>([]);
  
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
  
  const { isModifyMode, targetId, fieldChanges, trackFieldChange, setOriginalSnapshot } = useModifyMode();
  
  const [editingSparePart, setEditingSparePart] = useState<number | null>(null);
  const [editingTool, setEditingTool] = useState<number | null>(null);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [newSafetyRequirement, setNewSafetyRequirement] = useState("");
  const [safetyRequirementCategory, setSafetyRequirementCategory] = useState<'ppeRequirements' | 'permitRequirements' | 'otherRequirements'>('ppeRequirements');
  
  const riskAssessmentFileRef = useRef<HTMLInputElement>(null);
  const safetyChecklistFileRef = useRef<HTMLInputElement>(null);
  const operationalFormFileRef = useRef<HTMLInputElement>(null);
  const [deleteDocumentDialogOpen, setDeleteDocumentDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{type: string, fileKey: string} | null>(null);
  
  const [editingConsumedSparePart, setEditingConsumedSparePart] = useState<number | null>(null);
  
  const isReadOnly = false;

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

  const [executionData, setExecutionData] = useState({
    woExecutionId: "",
    riskAssessment: "No",
    safetyChecklists: "No",
    operationalForms: "No",
    startDateTime: "",
    completionDateTime: "",
    dateOfCompletion: "",
    runningHours: "",
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

  const generateWOExecutionId = () => {
    const uniqueId = Math.floor(Math.random() * 9000000) + 1000000;
    return `WO-EXE-${uniqueId}`;
  };

  useEffect(() => {
    if (!executionData.woExecutionId) {
      setExecutionData(prev => ({ ...prev, woExecutionId: generateWOExecutionId() }));
    }
  }, []);

  // Load work order data when workOrderContext is fetched
  useEffect(() => {
    if (workOrderContext) {
      const context = workOrderContext as any;
      if (context.templateData) {
        setTemplateData(prev => ({
          ...prev,
          ...context.templateData
        }));
      }
      if (context.executionData) {
        setExecutionData(prev => ({
          ...prev,
          ...context.executionData,
          woExecutionId: prev.woExecutionId || context.executionData.woExecutionId || generateWOExecutionId()
        }));
      }
      
      // Set Modify Mode snapshot if enabled
      if (isModifyMode && setOriginalSnapshot && context.templateData) {
        setOriginalSnapshot(context.templateData);
      }
    }
  }, [workOrderContext, isModifyMode, setOriginalSnapshot]);

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

  const generateSmartSuggestions = () => {
    try {
      const workOrder = null;
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

  const handleSave = async () => {
    try {
      const isCompleting = !!(executionData.completionDateTime || executionData.dateOfCompletion);
      
      if (isCompleting) {
        if ((workOrderContext as any)?.maintenanceBasis === 'Running Hours' && !executionData.runningHours) {
          toast({
            title: "Validation Error",
            description: "Running hours is required for RH-based maintenance when completing work order",
            variant: "destructive",
          });
          return;
        }
        
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
          
          if (parentComponent && newRunningHours > parentComponent.currentCumulativeRH) {
            toast({
              title: "Validation Error",
              description: `Running hours (${newRunningHours}) cannot exceed parent component's running hours (${parentComponent.currentCumulativeRH}). Please update parent running hours first.`,
              variant: "destructive",
            });
            return;
          }
          
          if (newRunningHours < component.currentCumulativeRH) {
            toast({
              title: "Validation Error",
              description: `Running hours cannot decrease from ${component.currentCumulativeRH} to ${newRunningHours}. If meter was replaced, please use the Running Hours module.`,
              variant: "destructive",
            });
            return;
          }
          
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
      
      let response;
      if (isCompleting) {
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
      {/* Top Header Bar - Professional maritime header with logo and actions */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 md:gap-6">
              <img src={sailLogo} alt="SAIL Logo" className="h-10 w-auto" data-testid="img-logo" />
              <div className="hidden md:block h-8 w-px bg-gray-300" />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="text-gray-600 hover:text-gray-900"
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              {/* Mobile Navigation Button */}
              <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="lg:hidden"
                    data-testid="button-mobile-nav"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px]">
                  <SheetHeader>
                    <SheetTitle>Sections</SheetTitle>
                  </SheetHeader>
                  <nav className="mt-6 space-y-1">
                    {navSections.map((section) => (
                      <a
                        key={section.id}
                        href={`#${section.id}`}
                        onClick={() => setIsMobileNavOpen(false)}
                        className="block px-3 py-2 text-sm text-gray-600 hover:text-[hsl(var(--primary))] hover:bg-blue-50 rounded-md transition-colors"
                        data-testid={`mobile-nav-link-${section.id}`}
                      >
                        {section.label}
                      </a>
                    ))}
                  </nav>
                </SheetContent>
              </Sheet>
              <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate">Work Order Form</h1>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsWorkInstructionsOpen(true)}
                className="border-gray-300 hover:bg-gray-50"
                data-testid="button-work-instructions"
              >
                <FileText className="h-4 w-4 mr-1" />
                Work Instructions
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="border-gray-300 hover:bg-gray-50"
                data-testid="button-export"
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <Button
                onClick={handleSave}
                size="sm"
                className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-medium"
                data-testid="button-save"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Single Scrollable Page with Left Navigation */}
      <div className="flex">
        {/* Left Navigation Sidebar - Sticky */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-6 px-6 py-6">
            <nav className="space-y-1">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Sections</div>
              {navSections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block px-3 py-2 text-sm text-gray-600 hover:text-[hsl(var(--primary))] hover:bg-blue-50 rounded-md transition-colors"
                  data-testid={`nav-link-${section.id}`}
                >
                  {section.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 px-6 py-6">
          <div className="max-w-5xl mx-auto space-y-6">
            
            {/* Section: Work Order Information */}
            <SectionBlock 
              id="work-order-info"
              title="Work Order Information" 
              description="Basic details and configuration for this work order"
            >
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">WO Title</Label>
                  <Input
                    value={templateData.woTitle}
                    onChange={(e) => handleTemplateChange('woTitle', e.target.value)}
                    className="text-sm"
                    placeholder="Enter work order title"
                    disabled={isReadOnly}
                    data-testid="input-wo-title"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Component</Label>
                  <Input
                    value={templateData.component}
                    onChange={(e) => handleTemplateChange('component', e.target.value)}
                    className="text-sm"
                    placeholder="Enter component"
                    disabled={isReadOnly}
                    data-testid="input-component"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Component Code</Label>
                  <Input
                    value={templateData.componentCode}
                    onChange={(e) => handleTemplateChange('componentCode', e.target.value)}
                    className="text-sm"
                    placeholder="Enter component code"
                    disabled={isReadOnly}
                    data-testid="input-component-code"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">WO Template Code</Label>
                  <Input
                    value={templateData.woTemplateCode}
                    onChange={(e) => handleTemplateChange('woTemplateCode', e.target.value)}
                    className="text-sm"
                    placeholder="Auto-generated"
                    disabled={isReadOnly}
                    data-testid="input-wo-template-code"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Maintenance Basis</Label>
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
                      <SelectItem value="Condition">Condition</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Frequency</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={templateData.frequencyValue}
                      onChange={(e) => handleTemplateChange('frequencyValue', e.target.value)}
                      className="text-sm flex-1"
                      placeholder="Value"
                      disabled={isReadOnly}
                      data-testid="input-frequency-value"
                    />
                    <Select
                      value={templateData.frequencyUnit}
                      onValueChange={(value) => handleTemplateChange('frequencyUnit', value)}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="text-sm w-32" data-testid="select-frequency-unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Days">Days</SelectItem>
                        <SelectItem value="Weeks">Weeks</SelectItem>
                        <SelectItem value="Months">Months</SelectItem>
                        <SelectItem value="Years">Years</SelectItem>
                        <SelectItem value="Hours">Hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Task Type</Label>
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
                      <SelectItem value="Test">Test</SelectItem>
                      <SelectItem value="Calibration">Calibration</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Assigned To (Rank)</Label>
                  <Select
                    value={templateData.assignedTo}
                    onValueChange={(value) => handleTemplateChange('assignedTo', value)}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger className="text-sm" data-testid="select-assigned-to">
                      <SelectValue placeholder="Select rank" />
                    </SelectTrigger>
                    <SelectContent>
                      {ranks.map((rank) => (
                        <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Approver (Rank)</Label>
                  <Select
                    value={templateData.approver}
                    onValueChange={(value) => handleTemplateChange('approver', value)}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger className="text-sm" data-testid="select-approver">
                      <SelectValue placeholder="Select rank" />
                    </SelectTrigger>
                    <SelectContent>
                      {ranks.map((rank) => (
                        <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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
                      <SelectItem value="Critical">Critical</SelectItem>
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
                  <Label className="text-sm text-[#8798ad]">Next Due Date</Label>
                  <Input
                    type="date"
                    value={templateData.nextDueDate}
                    onChange={(e) => handleTemplateChange('nextDueDate', e.target.value)}
                    className="text-sm"
                    disabled={isReadOnly}
                    data-testid="input-next-due-date"
                  />
                </div>
              </div>

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
          </SectionBlock>

          {/* Section: Required Spare Parts */}
          <SectionBlock
            id="spare-parts"
            title="Required Spare Parts"
            description="Spare parts needed for this work order"
          >
            <WorkOrderDataTable
              columns={[
                { key: 'partNumber', label: 'Part Number', width: '15%' },
                { key: 'description', label: 'Description', width: '30%' },
                { key: 'quantity', label: 'Qty', width: '10%' },
                { key: 'unit', label: 'Unit', width: '10%' },
                {
                  key: 'status',
                  label: 'Status',
                  width: '15%',
                  render: (value) => <StatusPill status={value} />
                },
                { key: 'location', label: 'Location', width: '15%' },
                { key: 'rob', label: 'ROB', width: '5%' }
              ]}
              data={templateData.requiredSpareParts.length > 0 ? templateData.requiredSpareParts.map(sp => ({
                partNumber: sp.partNo,
                description: sp.description,
                quantity: sp.quantityRequired,
                unit: 'EA',
                status: 'available' as const,
                location: sp.remarks || '-',
                rob: '-'
              })) : sampleSpareParts}
              showActions={false}
            />
          </SectionBlock>

          {/* Section: Required Tools */}
          <SectionBlock
            id="tools"
            title="Required Tools & Equipment"
            description="Tools and equipment needed for this work order"
          >
            <WorkOrderDataTable
              columns={[
                { key: 'toolId', label: 'Tool ID', width: '15%' },
                { key: 'description', label: 'Description', width: '40%' },
                { key: 'quantity', label: 'Qty', width: '10%' },
                {
                  key: 'status',
                  label: 'Status',
                  width: '15%',
                  render: (value) => <StatusPill status={value} />
                },
                { key: 'location', label: 'Location', width: '20%' }
              ]}
              data={templateData.requiredTools.length > 0 ? templateData.requiredTools.map(tool => ({
                toolId: '-',
                description: tool.toolName,
                quantity: tool.quantity,
                status: 'available' as const,
                location: tool.remarks || 'Tool Room'
              })) : sampleTools}
              showActions={false}
            />
          </SectionBlock>

          {/* Section: Safety Requirements */}
          <SectionBlock
            id="safety"
            title="Safety Requirements"
            description="Safety requirements and permits for this work order"
          >
            <WorkOrderDataTable
              columns={[
                { key: 'requirement', label: 'Requirement', width: '40%' },
                { key: 'type', label: 'Type', width: '20%' },
                { key: 'responsibility', label: 'Responsibility', width: '20%' },
                {
                  key: 'status',
                  label: 'Status',
                  width: '20%',
                  render: (value) => <StatusPill status={value} />
                }
              ]}
              data={(() => {
                const allSafetyReqs = [
                  ...templateData.safetyRequirements.ppeRequirements.map(req => ({ requirement: req, type: 'PPE', responsibility: '-', status: 'completed' as const })),
                  ...templateData.safetyRequirements.permitRequirements.map(req => ({ requirement: req, type: 'Permit', responsibility: '-', status: 'active' as const })),
                  ...templateData.safetyRequirements.otherRequirements.map(req => ({ requirement: req, type: 'Other', responsibility: '-', status: 'active' as const }))
                ];
                return allSafetyReqs.length > 0 ? allSafetyReqs : sampleSafetyRequirements;
              })()}
              showActions={false}
            />
          </SectionBlock>

          {/* Section: Work History */}
          <SectionBlock
            id="history"
            title="Work History"
            description="Previous executions and completion history for this work order"
          >
            <WorkOrderDataTable
              columns={[
                { key: 'date', label: 'Date', width: '12%' },
                { key: 'workOrder', label: 'Work Order', width: '15%' },
                { key: 'description', label: 'Description', width: '25%' },
                { key: 'performedBy', label: 'Performed By', width: '15%' },
                {
                  key: 'status',
                  label: 'Status',
                  width: '13%',
                  render: (value) => <StatusPill status={value} />
                },
                { key: 'remarks', label: 'Remarks', width: '20%' }
              ]}
              data={templateData.workHistory.length > 0 ? templateData.workHistory.map(history => ({
                date: history.completionDate || history.workDate,
                workOrder: history.woNo,
                description: '-',
                performedBy: history.performedBy,
                status: history.status?.toLowerCase() === 'completed' ? ('completed' as const) : ('postponed' as const),
                remarks: '-'
              })) : sampleWorkHistory}
              showActions={false}
            />
          </SectionBlock>

          {/* Section: Work Completion Record */}
          <SectionBlock
            id="completion"
            title="Work Completion Record"
            description="Record details of work execution and completion"
          >
            <div className="space-y-6">
              {/* WO Execution ID */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <Label className="text-sm text-[#8798ad]">WO Execution ID</Label>
                <div className="text-sm font-medium text-gray-900 mt-1">
                  {executionData.woExecutionId}
                </div>
              </div>

              {/* Execution Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Start Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={executionData.startDateTime}
                    onChange={(e) => handleExecutionChange('startDateTime', e.target.value)}
                    className="text-sm"
                    data-testid="input-start-datetime"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Completion Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={executionData.completionDateTime}
                    onChange={(e) => handleExecutionChange('completionDateTime', e.target.value)}
                    className="text-sm"
                    data-testid="input-completion-datetime"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Date of Completion</Label>
                  <Input
                    type="date"
                    value={executionData.dateOfCompletion}
                    onChange={(e) => handleExecutionChange('dateOfCompletion', e.target.value)}
                    className="text-sm"
                    data-testid="input-date-of-completion"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Running Hours</Label>
                  <Input
                    type="number"
                    value={executionData.runningHours}
                    onChange={(e) => handleExecutionChange('runningHours', e.target.value)}
                    className="text-sm"
                    placeholder="Enter running hours"
                    data-testid="input-running-hours"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Assigned To (Rank)</Label>
                  <Select
                    value={executionData.assignedTo}
                    onValueChange={(value) => handleExecutionChange('assignedTo', value)}
                  >
                    <SelectTrigger className="text-sm" data-testid="select-execution-assigned-to">
                      <SelectValue placeholder="Select rank" />
                    </SelectTrigger>
                    <SelectContent>
                      {ranks.map((rank) => (
                        <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Performed By (Rank)</Label>
                  <Select
                    value={executionData.performedBy}
                    onValueChange={(value) => handleExecutionChange('performedBy', value)}
                  >
                    <SelectTrigger className="text-sm" data-testid="select-performed-by">
                      <SelectValue placeholder="Select rank" />
                    </SelectTrigger>
                    <SelectContent>
                      {ranks.map((rank) => (
                        <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">No. of Persons</Label>
                  <Input
                    type="number"
                    value={executionData.noOfPersons}
                    onChange={(e) => handleExecutionChange('noOfPersons', e.target.value)}
                    className="text-sm"
                    placeholder="Enter number"
                    data-testid="input-no-of-persons"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Total Time (Hours)</Label>
                  <Input
                    type="number"
                    value={executionData.totalTimeHours}
                    onChange={(e) => handleExecutionChange('totalTimeHours', e.target.value)}
                    className="text-sm"
                    placeholder="Enter hours"
                    data-testid="input-total-time-hours"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Man-hours</Label>
                  <Input
                    type="number"
                    value={executionData.manhours}
                    onChange={(e) => handleExecutionChange('manhours', e.target.value)}
                    className="text-sm"
                    placeholder="Calculated automatically"
                    disabled
                    data-testid="input-manhours"
                  />
                </div>
              </div>

              {/* Work Carried Out */}
              <div className="space-y-2">
                <Label className="text-sm text-[#8798ad]">Work Carried Out</Label>
                <Textarea
                  ref={workCarriedOutRef}
                  value={executionData.workCarriedOut}
                  onChange={(e) => handleExecutionChange('workCarriedOut', e.target.value)}
                  className="text-sm min-h-[120px]"
                  placeholder="Describe the work performed..."
                  data-testid="textarea-work-carried-out"
                />
              </div>

              {/* Job Experience Notes */}
              <div className="space-y-2">
                <Label className="text-sm text-[#8798ad]">Job Experience Notes</Label>
                <Textarea
                  value={executionData.jobExperienceNotes}
                  onChange={(e) => handleExecutionChange('jobExperienceNotes', e.target.value)}
                  className="text-sm min-h-[80px]"
                  placeholder="Any important notes or learnings..."
                  data-testid="textarea-job-experience-notes"
                />
              </div>
            </div>
          </SectionBlock>

          {/* Section: Document Management */}
          <SectionBlock
            id="documents"
            title="Document Management"
            description="Upload and manage risk assessments, checklists, and operational forms"
          >
            <div className="space-y-4">
              {/* Risk Assessment */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium text-gray-900">Risk Assessment</Label>
                  <div className="flex items-center gap-4">
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
                  </div>
                </div>
                {executionData.riskAssessment === "Yes" && (
                  <div className="flex items-center gap-2">
                    {getUploadedDocument('riskAssessment') ? (
                      <>
                        <span className="text-sm text-gray-700 flex-1">{getUploadedDocument('riskAssessment')?.fileName}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDocument('riskAssessment')}
                          data-testid="button-view-risk-assessment"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDocumentClick('riskAssessment')}
                          className="text-red-600 hover:text-red-800"
                          data-testid="button-delete-risk-assessment"
                        >
                          Delete
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUploadDocument('riskAssessment', riskAssessmentFileRef)}
                        data-testid="button-upload-risk-assessment"
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Upload Document
                      </Button>
                    )}
                    <input
                      ref={riskAssessmentFileRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => handleFileSelected(e, 'riskAssessment')}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    />
                  </div>
                )}
              </div>

              {/* Safety Checklists */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium text-gray-900">Safety Checklists</Label>
                  <div className="flex items-center gap-4">
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
                  </div>
                </div>
                {executionData.safetyChecklists === "Yes" && (
                  <div className="flex items-center gap-2">
                    {getUploadedDocument('safetyChecklists') ? (
                      <>
                        <span className="text-sm text-gray-700 flex-1">{getUploadedDocument('safetyChecklists')?.fileName}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDocument('safetyChecklists')}
                          data-testid="button-view-safety-checklists"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDocumentClick('safetyChecklists')}
                          className="text-red-600 hover:text-red-800"
                          data-testid="button-delete-safety-checklists"
                        >
                          Delete
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUploadDocument('safetyChecklists', safetyChecklistFileRef)}
                        data-testid="button-upload-safety-checklists"
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Upload Document
                      </Button>
                    )}
                    <input
                      ref={safetyChecklistFileRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => handleFileSelected(e, 'safetyChecklists')}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    />
                  </div>
                )}
              </div>

              {/* Operational Forms */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium text-gray-900">Operational Forms</Label>
                  <div className="flex items-center gap-4">
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
                  </div>
                </div>
                {executionData.operationalForms === "Yes" && (
                  <div className="flex items-center gap-2">
                    {getUploadedDocument('operationalForms') ? (
                      <>
                        <span className="text-sm text-gray-700 flex-1">{getUploadedDocument('operationalForms')?.fileName}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDocument('operationalForms')}
                          data-testid="button-view-operational-forms"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDocumentClick('operationalForms')}
                          className="text-red-600 hover:text-red-800"
                          data-testid="button-delete-operational-forms"
                        >
                          Delete
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUploadDocument('operationalForms', operationalFormFileRef)}
                        data-testid="button-upload-operational-forms"
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Upload Document
                      </Button>
                    )}
                    <input
                      ref={operationalFormFileRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => handleFileSelected(e, 'operationalForms')}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    />
                  </div>
                )}
              </div>
            </div>
          </SectionBlock>
          </div>
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
