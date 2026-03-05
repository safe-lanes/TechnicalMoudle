import React, { useState, useEffect, useRef } from "react";
import { calculateNextDueDate, normalizeDateToDDMMMYYYY } from "@shared/dateUtils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useVessel } from "@/contexts/VesselContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ChevronDown, ChevronRight, FileText, ArrowLeft, AlertCircle, Pencil, Trash2, Check, X, Plus, Eye, Upload, Paperclip } from "lucide-react";
import { useLocation } from "wouter";
import WorkInstructionsDialog from "./WorkInstructionsDialog";
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
  workOrder?: any; // For template/execution modes
  workOrderHistory?: HistoryWorkOrderPayload; // For history mode
  isApprovalMode?: boolean;
  mode?: 'template' | 'execution' | 'history'; // Controls Section A/B visibility and edit capabilities
}

const WorkOrderForm: React.FC<WorkOrderFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onApprove,
  onReject,
  component,
  workOrder,
  workOrderHistory,
  isApprovalMode = false,
  mode = 'execution' // Default to execution for backward compatibility
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
      fetch(`/technical/api/change-requests/${changeRequestId}`)
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
  const isReadOnly = !isModifyMode && (workOrder?.status === "Pending Approval" || workOrder?.status === "Approved" || isApprovalMode || mode === 'history');
  
  // Part A is ALWAYS read-only for ship users in execution mode (per spec)
  // Part A should display pre-populated job data and not be editable by ship crew
  const isPartAReadOnly = mode === 'execution' || executionMode || isReadOnly;

  const isPartBReadOnly = isReadOnly || workOrder?.status === 'Completed' || workOrder?.status === 'Pending Approval';

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
    requiredSpareParts: [] as Array<{partNo: string, description: string, quantityRequired: string, remarks: string}>,
    requiredTools: [] as Array<{toolName: string, quantity: string, remarks: string}>,
    safetyRequirements: {
      ppeRequirements: [] as string[],
      permitRequirements: [] as string[],
      otherRequirements: [] as string[]
    },
    workHistory: []
  });
  
  // State for inline editing
  const [editingSparePart, setEditingSparePart] = useState<number | null>(null);
  const [editingTool, setEditingTool] = useState<number | null>(null);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [newSafetyRequirement, setNewSafetyRequirement] = useState("");
  
  // State for Part B document management
  const riskAssessmentFileRef = useRef<HTMLInputElement>(null);
  const safetyChecklistFileRef = useRef<HTMLInputElement>(null);
  const operationalFormFileRef = useRef<HTMLInputElement>(null);
  const [deleteDocumentDialogOpen, setDeleteDocumentDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{type: string, fileKey: string} | null>(null);
  
  // State for Part B4 spare parts consumed inline editing
  const [editingConsumedSparePart, setEditingConsumedSparePart] = useState<number | null>(null);
  const [currentReadingWarningAcknowledged, setCurrentReadingWarningAcknowledged] = useState(false);
  
  // State for B4 spare consumption dialog
  const [showConsumeDialog, setShowConsumeDialog] = useState(false);
  const [selectedBomSpare, setSelectedBomSpare] = useState<any>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [consumeQty, setConsumeQty] = useState<string>("1");
  const [consumeComments, setConsumeComments] = useState<string>("");

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
    uploadedDocuments: [] as Array<{type: string, fileName: string, fileKey: string, uploadedAt: string, uploadedBy: string}>,
    consumedSpareParts: [] as Array<{
      spareId: number | null;
      partNo: string;
      description: string;
      quantityConsumed: string;
      comments: string;
      locationId: number | null;
      locationName: string;
      availableQty: number;
      isFromBom: boolean;
    }>,
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

  // Vessel context for inventory transactions
  const { vesselId } = useVessel();
  
  // Fetch spare BOM for the component (from spare_component_links)
  const componentCode = workOrder?.componentCode || component?.code || templateData?.componentCode;
  const { data: spareBomResponse, isLoading: spareBomLoading } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: [`/technical/api/inventory/spares-by-component/${componentCode}`],
    enabled: !!componentCode && isOpen,
  });
  const componentSpareBom = spareBomResponse?.data || [];
  
  // Mutation for posting consumption transactions
  const consumptionMutation = useMutation({
    mutationFn: async (consumedParts: typeof executionData.consumedSpareParts) => {
      const workOrderRef = workOrder?.id || workOrder?.workOrderNo || executionData.woExecutionId;
      
      const results = await Promise.all(
        consumedParts
          .filter(part => part.isFromBom && part.spareId && part.locationId)
          .map(part => 
            apiRequest('POST', '/technical/api/inventory/transactions', {
              vesselId,
              spareId: part.spareId,
              locationId: part.locationId,
              eventType: 'CONSUME',
              qty: parseInt(part.quantityConsumed, 10),
              referenceType: 'WORK_ORDER',
              referenceId: workOrderRef,
              remarks: part.comments || `Consumed for WO: ${workOrderRef}`,
              performedBy: executionData.performedBy || 'System'
            })
          )
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/inventory/transactions'] });
      queryClient.invalidateQueries({ queryKey: [`/technical/api/inventory/spares-by-component/${componentCode}`] });
    },
    onError: (error: any) => {
      console.error('Consumption transaction failed:', error);
      toast({
        title: "Inventory Update Failed",
        description: error?.message || "Failed to record spare consumption. Please update inventory manually.",
        variant: "destructive"
      });
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
  // Format: WO-EXE-XXXXXXX where XXXXXXX is a unique 7-digit number
  const generateWOExecutionId = () => {
    // Generate a unique 7-digit number (1000000-9999999)
    const uniqueId = Math.floor(Math.random() * 9000000) + 1000000;
    return `WO-EXE-${uniqueId}`;
  };

  // History mode: Hydrate state from workOrderHistory
  useEffect(() => {
    if (mode === 'history' && workOrderHistory) {
      const { template, execution } = workOrderHistory;
      
      // Hydrate Section A (Template Data) from template
      setTemplateData({
        woTitle: template.workOrderNo || '',
        component: template.component || '',
        componentCode: template.componentCode || '',
        woTemplateCode: template.workOrderNo || '',
        maintenanceBasis: template.maintenanceBasis || 'Calendar',
        frequencyValue: (template as any).frequency || template.frequencyValue || '',
        frequencyUnit: template.frequencyUnit || 'Months',
        taskType: template.taskType || 'Inspection',
        assignedTo: template.assignedTo || '',
        approver: template.approver || '',
        jobPriority: template.jobPriority || 'Medium',
        classRelated: template.classRelated || 'No',
        briefWorkDescription: template.briefWorkDescription || (template as any).jobDescription || '',
        nextDueDate: template.nextDueDate || '',
        nextDueReading: template.nextDueReading || '',
        requiredSpareParts: Array.isArray(template.requiredSpareParts) ? template.requiredSpareParts : [],
        requiredTools: Array.isArray(template.requiredTools) ? template.requiredTools : [],
        safetyRequirements: (template.safetyRequirements as { ppeRequirements: string[]; permitRequirements: string[]; otherRequirements: string[]; }) || {
          ppeRequirements: [],
          permitRequirements: [],
          otherRequirements: []
        },
        workHistory: []
      });
      
      // Hydrate Section B (Execution Data) from execution
      setExecutionData({
        woExecutionId: execution.executionId || '',
        riskAssessment: execution.riskAssessmentStatus || 'No',
        safetyChecklists: execution.safetyChecklistsStatus || 'No',
        operationalForms: execution.operationalFormsStatus || 'No',
        startDateTime: '',
        completionDateTime: execution.dateCompleted || '',
        assignedTo: '',
        performedBy: execution.performedBy || '',
        noOfPersons: '',
        totalTimeHours: '',
        manhours: '',
        workCarriedOut: execution.workDescription || '',
        jobExperienceNotes: execution.remarks || '',
        previousReading: '',
        currentReading: '',
        uploadedDocuments: Array.isArray(execution.uploadedDocuments) ? execution.uploadedDocuments : [],
        consumedSpareParts: Array.isArray(execution.consumedSpareParts) ? execution.consumedSpareParts : [],
        ihmUpdate: {
          enabled: false,
          action: '',
          targetComponent: '',
          targetSpare: '',
          quantity: '',
          location: '',
          materials: [],
          remarks: ''
        }
      });
      
      // Set active section to Part B to show execution data
      setActiveSection('partB');
    }
  }, [mode, workOrderHistory]);

  // Update template code placeholder display when component code changes
  useEffect(() => {
    if (mode !== 'history' && !templateData.woTemplateCode && templateData.componentCode) {
      const placeholder = generateWOTemplateCodePlaceholder();
      // Store placeholder for display only - don't send to backend
      setTemplateData(prev => ({ ...prev, woTemplateCode: placeholder }));
    }
  }, [mode, templateData.componentCode]);

  // Load existing workOrder data (skip in history mode)
  // This hydrates Part A with ALL job data - Part A is read-only for ship users
  useEffect(() => {
    if (mode !== 'history' && workOrder) {
      // Parse safety requirements from workOrder
      const safetyReqs = workOrder.safetyRequirements || {};
      const parsedSafetyRequirements = {
        ppeRequirements: Array.isArray(safetyReqs.ppeRequirements) ? safetyReqs.ppeRequirements : [],
        permitRequirements: Array.isArray(safetyReqs.permitRequirements) ? safetyReqs.permitRequirements : [],
        otherRequirements: Array.isArray(safetyReqs.otherRequirements) ? safetyReqs.otherRequirements : []
      };
      
      // Parse required spare parts from workOrder
      // NOTE: Do NOT fallback partNo to partCode - they are separate fields
      // partNo should remain blank/null if not provided in source data
      const parsedSpareParts = Array.isArray(workOrder.requiredSpareParts) 
        ? workOrder.requiredSpareParts.map((spare: any) => ({
            partNo: spare.partNo || '',
            partCode: spare.partCode || '',
            description: spare.description || spare.partName || '',
            quantityRequired: spare.quantityRequired || spare.quantity || '',
            remarks: spare.remarks || ''
          }))
        : [];
      
      // Parse required tools from workOrder
      const parsedTools = Array.isArray(workOrder.requiredTools) 
        ? workOrder.requiredTools.map((tool: any) => ({
            toolName: tool.toolName || tool.name || '',
            quantity: tool.quantity || '',
            remarks: tool.remarks || ''
          }))
        : [];
      
      // Hydrate ALL Part A fields from workOrder data
      const initialData = {
        woTitle: workOrder.jobTitle || "",
        component: workOrder.component || component?.name || "",
        componentCode: workOrder.componentCode || component?.code || "",
        woTemplateCode: workOrder.workOrderNo || workOrder.templateCode || "",
        maintenanceBasis: workOrder.maintenanceBasis || "Calendar",
        frequencyValue: workOrder.frequencyValue || "",
        frequencyUnit: workOrder.frequencyUnit || "Months",
        taskType: workOrder.taskType || workOrder.maintenanceType || "Inspection",
        assignedTo: workOrder.assignedTo || "",
        approver: workOrder.approver || workOrder.department || "",
        jobPriority: workOrder.jobPriority || "Medium",
        classRelated: workOrder.classRelated || "No",
        briefWorkDescription: workOrder.briefWorkDescription || workOrder.jobDescription || "",
        nextDueDate: workOrder.dueDate || workOrder.nextDueDate || "",
        nextDueReading: workOrder.nextDueReading || workOrder.nextDueRH || "",
        requiredSpareParts: parsedSpareParts,
        requiredTools: parsedTools,
        safetyRequirements: parsedSafetyRequirements,
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
    setExecutionData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };

      if (field === 'currentReading' || field === 'previousReading') {
        setCurrentReadingWarningAcknowledged(false);
      }

      if (field === 'noOfPersons' || field === 'totalTimeHours') {
        const persons = field === 'noOfPersons' ? parseFloat(value) : parseFloat(prev.noOfPersons);
        const hours = field === 'totalTimeHours' ? parseFloat(value) : parseFloat(prev.totalTimeHours);

        if (!isNaN(persons) && !isNaN(hours) && persons > 0 && hours > 0) {
          newData.manhours = (persons * hours).toString();
        } else {
          newData.manhours = '';
        }
      }

      return newData;
    });
  };

  // Part B1 - Document Upload Handlers
  const handleUploadDocument = async (documentType: string, fileInputRef: React.RefObject<HTMLInputElement>) => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>, documentType: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      toast({ title: "Invalid file type", description: "Only PDF, JPG, and PNG files are allowed.", variant: "destructive" });
      event.target.value = '';
      return;
    }

    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast({ title: "File too large", description: `Maximum file size is 5MB. Selected file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`, variant: "destructive" });
      event.target.value = '';
      return;
    }

    try {
      // Create form data for upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);

      // Upload to backend
      const response = await fetch('/technical/api/upload-document', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload document');
      }

      const result = await response.json();

      // Add to uploadedDocuments array
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

      // Reset file input
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

  const dataUrlToBlob = (dataUrl: string): Blob => {
    const [header, base64Data] = dataUrl.split(',');
    const mimeMatch = header.match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  };

  const handleViewDocument = async (documentType: string) => {
    const document = executionData.uploadedDocuments.find(doc => doc.type === documentType);
    if (!document) return;

    try {
      const fileKeyEncoded = encodeURIComponent(document.fileKey.substring(1));
      const response = await fetch(`/technical/api/documents/${fileKeyEncoded}`);
      
      if (!response.ok) {
        throw new Error('Failed to retrieve document');
      }

      const result = await response.json();
      const blob = dataUrlToBlob(result.dataUrl);
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (error) {
      console.error('View error:', error);
      toast({
        title: "View failed",
        description: "Failed to open document. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDownloadDocument = async (documentType: string) => {
    const docData = executionData.uploadedDocuments.find(doc => doc.type === documentType);
    if (!docData) return;

    try {
      const fileKeyEncoded = encodeURIComponent(docData.fileKey.substring(1));
      const response = await fetch(`/technical/api/documents/${fileKeyEncoded}`);
      
      if (!response.ok) {
        throw new Error('Failed to retrieve document');
      }

      const result = await response.json();
      const blob = dataUrlToBlob(result.dataUrl);
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = result.fileName || docData.fileName || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download failed",
        description: "Failed to download document. Please try again.",
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
      // Delete from backend
      const fileKeyEncoded = encodeURIComponent(documentToDelete.fileKey.substring(1));
      const response = await fetch(`/technical/api/documents/${fileKeyEncoded}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      // Remove from uploadedDocuments array
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

  // Helper function to get uploaded document for a type
  const getUploadedDocument = (documentType: string) => {
    return executionData.uploadedDocuments.find(doc => doc.type === documentType);
  };

  // Part B4 - Consumed Spare Parts Handlers
  const handleAddConsumedSparePart = () => {
    // Show dialog to select spare from BOM
    if (componentSpareBom.length > 0) {
      setShowConsumeDialog(true);
    } else {
      // Fallback: Add manual entry for spares not in BOM
      const newPart = {
        spareId: null,
        partNo: "",
        description: "",
        quantityConsumed: "",
        comments: "",
        locationId: null,
        locationName: "",
        availableQty: 0,
        isFromBom: false
      };
      setExecutionData(prev => ({
        ...prev,
        consumedSpareParts: [...prev.consumedSpareParts, newPart]
      }));
      setEditingConsumedSparePart(executionData.consumedSpareParts.length);
    }
  };

  // Open consume dialog for a specific BOM spare
  const handleOpenConsumeDialog = (spare: any) => {
    setSelectedBomSpare(spare);
    setSelectedLocationId("");
    setConsumeQty("1");
    setConsumeComments("");
    setShowConsumeDialog(true);
  };

  // Add consumption from dialog
  const handleConfirmConsumption = () => {
    if (!selectedBomSpare) return;
    
    const selectedLocation = selectedBomSpare.locations?.find((loc: any) => loc.locationId.toString() === selectedLocationId);
    const qty = parseInt(consumeQty, 10);
    
    if (!selectedLocation || isNaN(qty) || qty <= 0) {
      toast({
        title: "Invalid input",
        description: "Please select a location and enter a valid quantity.",
        variant: "destructive"
      });
      return;
    }
    
    if (qty > selectedLocation.qty) {
      toast({
        title: "Insufficient stock",
        description: `Only ${selectedLocation.qty} available at ${selectedLocation.locationName}. Cannot consume ${qty}.`,
        variant: "destructive"
      });
      return;
    }
    
    const newPart = {
      spareId: selectedBomSpare.id,
      partNo: selectedBomSpare.partCode || "",
      description: selectedBomSpare.name || "",
      quantityConsumed: qty.toString(),
      comments: consumeComments,
      locationId: selectedLocation.locationId,
      locationName: selectedLocation.locationName,
      availableQty: selectedLocation.qty,
      isFromBom: true
    };
    
    setExecutionData(prev => ({
      ...prev,
      consumedSpareParts: [...prev.consumedSpareParts, newPart]
    }));
    
    // Reset dialog state
    setShowConsumeDialog(false);
    setSelectedBomSpare(null);
    setSelectedLocationId("");
    setConsumeQty("1");
    setConsumeComments("");
    
    toast({
      title: "Spare part added",
      description: `${qty} x ${selectedBomSpare.partCode} from ${selectedLocation.locationName} will be consumed when work order is completed.`
    });
  };

  const handleEditConsumedSparePart = (index: number) => {
    setEditingConsumedSparePart(index);
  };

  const handleSaveConsumedSparePart = (index: number) => {
    setEditingConsumedSparePart(null);
  };

  const handleCancelEditConsumedSparePart = () => {
    // If it's a new part (empty values), remove it
    const currentPart = executionData.consumedSpareParts[editingConsumedSparePart!];
    if (!currentPart.partNo && !currentPart.description && !currentPart.quantityConsumed && !currentPart.comments) {
      setExecutionData(prev => ({
        ...prev,
        consumedSpareParts: prev.consumedSpareParts.filter((_, i) => i !== editingConsumedSparePart)
      }));
    }
    setEditingConsumedSparePart(null);
  };

  const handleDeleteConsumedSparePart = (index: number) => {
    setExecutionData(prev => ({
      ...prev,
      consumedSpareParts: prev.consumedSpareParts.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateConsumedSparePartField = (index: number, field: string, value: string) => {
    setExecutionData(prev => ({
      ...prev,
      consumedSpareParts: prev.consumedSpareParts.map((part, i) =>
        i === index ? { ...part, [field]: value } : part
      )
    }));
  };

  // Section A2 - Spare Parts handlers
  const handleAddSparePart = () => {
    const newPart = {
      partNo: "",
      description: "",
      quantityRequired: "",
      remarks: ""
    };
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
    // If it's a new part (empty values), remove it
    const currentPart = templateData.requiredSpareParts[editingSparePart!];
    if (!currentPart.partNo && !currentPart.description && !currentPart.quantityRequired && !currentPart.remarks) {
      setTemplateData(prev => ({
        ...prev,
        requiredSpareParts: prev.requiredSpareParts.filter((_, i) => i !== editingSparePart)
      }));
    }
    setEditingSparePart(null);
  };

  const handleDeleteSparePart = (index: number) => {
    setTemplateData(prev => ({
      ...prev,
      requiredSpareParts: prev.requiredSpareParts.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateSparePartField = (index: number, field: keyof typeof templateData.requiredSpareParts[0], value: string) => {
    setTemplateData(prev => ({
      ...prev,
      requiredSpareParts: prev.requiredSpareParts.map((part, i) =>
        i === index ? { ...part, [field]: value } : part
      )
    }));
  };

  // Section A3 - Tools handlers
  const handleAddTool = () => {
    const newTool = {
      toolName: "",
      quantity: "",
      remarks: ""
    };
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
    // If it's a new tool (empty values), remove it
    const currentTool = templateData.requiredTools[editingTool!];
    if (!currentTool.toolName && !currentTool.quantity && !currentTool.remarks) {
      setTemplateData(prev => ({
        ...prev,
        requiredTools: prev.requiredTools.filter((_, i) => i !== editingTool)
      }));
    }
    setEditingTool(null);
  };

  const handleDeleteTool = (index: number) => {
    setTemplateData(prev => ({
      ...prev,
      requiredTools: prev.requiredTools.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateToolField = (index: number, field: keyof typeof templateData.requiredTools[0], value: string) => {
    setTemplateData(prev => ({
      ...prev,
      requiredTools: prev.requiredTools.map((tool, i) =>
        i === index ? { ...tool, [field]: value } : tool
      )
    }));
  };

  // Section A4 - Safety Requirements handlers
  const handleAddSafetyRequirement = (type: 'ppeRequirements' | 'permitRequirements' | 'otherRequirements') => {
    if (!newSafetyRequirement.trim()) return;
    
    setTemplateData(prev => ({
      ...prev,
      safetyRequirements: {
        ...prev.safetyRequirements,
        [type]: [...prev.safetyRequirements[type], newSafetyRequirement.trim()]
      }
    }));
    setNewSafetyRequirement("");
  };

  const handleDeleteSafetyRequirement = (type: 'ppeRequirements' | 'permitRequirements' | 'otherRequirements', index: number) => {
    setTemplateData(prev => ({
      ...prev,
      safetyRequirements: {
        ...prev.safetyRequirements,
        [type]: prev.safetyRequirements[type].filter((_, i) => i !== index)
      }
    }));
  };

  const handleSubmit = async () => {
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
      // B1 Validation: Warn and block if any B1 field is set to "No"
      const b1Warnings: string[] = [];
      if (executionData.riskAssessment === 'No') b1Warnings.push('Risk Assessment');
      if (executionData.safetyChecklists === 'No') b1Warnings.push('Safety Checklists');
      if (executionData.operationalForms === 'No') b1Warnings.push('Operational Forms');
      if (b1Warnings.length > 0) {
        toast({
          title: "Safety Warning",
          description: `${b1Warnings.join(', ')} ${b1Warnings.length === 1 ? 'is' : 'are'} marked as "No". This is a safety concern — please complete the required assessments or select "NA" if not applicable.`,
          variant: "destructive"
        });
        return;
      }

      // B1 Validation: If "Yes" is selected, at least 1 supporting document must be uploaded
      const b1DocTypes = [
        { field: executionData.riskAssessment, type: 'riskAssessment', label: 'Risk Assessment' },
        { field: executionData.safetyChecklists, type: 'safetyChecklist', label: 'Safety Checklists' },
        { field: executionData.operationalForms, type: 'operationalForm', label: 'Operational Forms' },
      ];
      for (const check of b1DocTypes) {
        if (check.field === 'Yes') {
          const hasDoc = executionData.uploadedDocuments.some(doc => doc.type === check.type);
          if (!hasDoc) {
            toast({
              title: "Validation Error",
              description: `${check.label} is marked as "Yes" but no supporting document has been uploaded. Please upload at least one document.`,
              variant: "destructive"
            });
            return;
          }
        }
      }

      // Validate execution data
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

      // Start Date is required and cannot be in the future
      const startDate = executionData.startDateTime ? executionData.startDateTime.split('T')[0] : '';
      if (!startDate) {
        toast({
          title: "Validation Error",
          description: "Start Date is required",
          variant: "destructive"
        });
        return;
      }
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const startDateObj = new Date(startDate);
      if (startDateObj > today) {
        toast({
          title: "Validation Error",
          description: "Start Date cannot be in the future.",
          variant: "destructive"
        });
        return;
      }

      // Start Time is required and must be valid HH:MM
      const startTime = executionData.startDateTime ? executionData.startDateTime.split('T')[1]?.substring(0, 5) || '' : '';
      if (!startTime) {
        toast({
          title: "Validation Error",
          description: "Start Time is required",
          variant: "destructive"
        });
        return;
      }
      if (!timeRegex.test(startTime)) {
        toast({
          title: "Validation Error",
          description: "Start Time must be in HH:MM 24-hour format (00:00–23:59).",
          variant: "destructive"
        });
        return;
      }

      // Completion Date is required, cannot be future, must be >= Start Date
      const completionDate = executionData.completionDateTime ? executionData.completionDateTime.split('T')[0] : '';
      if (!completionDate) {
        toast({
          title: "Validation Error",
          description: "Completion Date is required",
          variant: "destructive"
        });
        return;
      }
      const completionDateObj = new Date(completionDate);
      if (completionDateObj > today) {
        toast({
          title: "Validation Error",
          description: "Completion Date cannot be in the future.",
          variant: "destructive"
        });
        return;
      }
      if (completionDateObj < startDateObj) {
        toast({
          title: "Validation Error",
          description: "Completion Date cannot be before Start Date.",
          variant: "destructive"
        });
        return;
      }

      // Completion Time is required and must be valid HH:MM
      const completionTime = executionData.completionDateTime ? executionData.completionDateTime.split('T')[1]?.substring(0, 5) || '' : '';
      if (!completionTime) {
        toast({
          title: "Validation Error",
          description: "Completion Time is required",
          variant: "destructive"
        });
        return;
      }
      if (!timeRegex.test(completionTime)) {
        toast({
          title: "Validation Error",
          description: "Completion Time must be in HH:MM 24-hour format (00:00–23:59).",
          variant: "destructive"
        });
        return;
      }

      // If same day, Completion Time must be >= Start Time
      if (startDate === completionDate && startTime && completionTime) {
        if (completionTime < startTime) {
          toast({
            title: "Validation Error",
            description: "Completion Time cannot be before Start Time on the same day.",
            variant: "destructive"
          });
          return;
        }
      }

      // Rule 2: Start Date must not be earlier than Work Order creation date
      const woCreatedAtVal = (workOrder as any)?.createdAt;
      if (woCreatedAtVal) {
        const woCreationDate = new Date(woCreatedAtVal);
        woCreationDate.setHours(0, 0, 0, 0);
        const startDateCheck = new Date(startDate);
        startDateCheck.setHours(0, 0, 0, 0);
        if (startDateCheck < woCreationDate) {
          const formattedCreationDate = woCreationDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          toast({
            title: "Validation Error",
            description: `Start Date cannot be earlier than the Work Order creation date (${formattedCreationDate}).`,
            variant: "destructive"
          });
          return;
        }
      }

      // Rule 1: Completion Date vs Next Due Date — soft overdue warning (non-blocking)
      if (templateData.nextDueDate && completionDate) {
        try {
          const normalizedNextDue = normalizeDateToDDMMMYYYY(templateData.nextDueDate);
          if (normalizedNextDue) {
            const nextDueParts = normalizedNextDue.split('-');
            const nextDueDateObj = new Date(`${nextDueParts[1]} ${nextDueParts[0]}, ${nextDueParts[2]}`);
            nextDueDateObj.setHours(0, 0, 0, 0);
            const completionCheckObj = new Date(completionDate);
            completionCheckObj.setHours(0, 0, 0, 0);
            if (!isNaN(nextDueDateObj.getTime()) && completionCheckObj > nextDueDateObj) {
              toast({
                title: "Overdue Completion",
                description: `Work was completed after the scheduled due date (${normalizedNextDue}). The record will be tagged as overdue.`,
              });
            }
          }
        } catch (e) {
        }
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

      // Rule 3: Approver ≠ Performer for Head of Department ranks
      const hodRanks = ["Chief Engineer", "Chief Officer", "Master"];
      if (hodRanks.includes(executionData.performedBy) && executionData.performedBy === templateData.approver) {
        toast({
          title: "Validation Error",
          description: `The same Head of Department rank (${executionData.performedBy}) cannot both perform and approve the work. Please select a different Performed By or Approver rank.`,
          variant: "destructive"
        });
        return;
      }

      // No. of Persons is required, must be integer >= 1 and <= 50
      const noOfPersonsStr = (executionData.noOfPersons || '').trim();
      if (!noOfPersonsStr) {
        toast({
          title: "Validation Error",
          description: "No. of Persons in Team is required.",
          variant: "destructive"
        });
        return;
      }
      if (!/^[1-9]\d*$/.test(noOfPersonsStr)) {
        toast({
          title: "Validation Error",
          description: "No. of Persons must be a positive whole number (≥ 1).",
          variant: "destructive"
        });
        return;
      }
      const noOfPersonsVal = parseInt(noOfPersonsStr, 10);
      if (noOfPersonsVal > 50) {
        toast({
          title: "Validation Error",
          description: "No. of Persons cannot exceed 50.",
          variant: "destructive"
        });
        return;
      }

      // Total Time Taken is required, must be > 0 and <= 720
      const totalTimeVal = parseFloat(executionData.totalTimeHours);
      if (!executionData.totalTimeHours || isNaN(totalTimeVal)) {
        toast({
          title: "Validation Error",
          description: "Total Time Taken (Hours) is required.",
          variant: "destructive"
        });
        return;
      }
      if (totalTimeVal <= 0) {
        toast({
          title: "Validation Error",
          description: "Total Time Taken must be greater than 0.",
          variant: "destructive"
        });
        return;
      }
      if (totalTimeVal > 720) {
        toast({
          title: "Validation Error",
          description: "Total Time Taken cannot exceed 720 hours (30 days).",
          variant: "destructive"
        });
        return;
      }

      // Manhours validation (auto-calculated, but safety check)
      const manhoursVal = parseFloat(executionData.manhours);
      if (executionData.manhours && !isNaN(manhoursVal) && manhoursVal <= 0) {
        toast({
          title: "Validation Error",
          description: "Manhours must be a positive number.",
          variant: "destructive"
        });
        return;
      }

      // Work Carried Out is required, min 20 characters, no placeholder text
      const workCarriedOutTrimmed = (executionData.workCarriedOut || '').trim();
      if (!workCarriedOutTrimmed) {
        toast({
          title: "Validation Error",
          description: "Work Carried Out is required.",
          variant: "destructive"
        });
        return;
      }
      if (workCarriedOutTrimmed.toLowerCase() === 'describe work carried out...' || workCarriedOutTrimmed.toLowerCase() === 'describe work carried out') {
        toast({
          title: "Validation Error",
          description: "Please provide a proper description of work carried out, not the placeholder text.",
          variant: "destructive"
        });
        return;
      }
      if (workCarriedOutTrimmed.length < 20) {
        toast({
          title: "Validation Error",
          description: "Work Carried Out must be at least 20 characters to provide a meaningful description.",
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

      // Current Reading must be a positive number ≥ 0
      if (executionData.currentReading) {
        const currentRHNum = parseFloat(executionData.currentReading);
        if (isNaN(currentRHNum) || currentRHNum < 0) {
          toast({
            title: "Validation Error",
            description: "Current Reading must be a positive number (≥ 0).",
            variant: "destructive"
          });
          return;
        }

        // Current Reading must be ≥ Previous Reading
        if (executionData.previousReading) {
          const previousRHNum = parseFloat(executionData.previousReading);
          if (!isNaN(currentRHNum) && !isNaN(previousRHNum) && currentRHNum < previousRHNum) {
            toast({
              title: "Validation Error",
              description: `Current Reading (${currentRHNum}) cannot be less than Previous Reading (${previousRHNum}). Running hours can only increase.`,
              variant: "destructive"
            });
            return;
          }

          // Soft warning: large jump (> 2000 hrs above previous) may indicate a typo
          if (!isNaN(currentRHNum) && !isNaN(previousRHNum) && (currentRHNum - previousRHNum) > 2000 && !currentReadingWarningAcknowledged) {
            toast({
              title: "Warning — Large Reading Jump",
              description: `Current Reading (${currentRHNum}) exceeds Previous Reading (${previousRHNum}) by ${(currentRHNum - previousRHNum).toFixed(2)} hrs. Please verify this value is correct and save again to confirm.`,
              variant: "destructive"
            });
            setCurrentReadingWarningAcknowledged(true);
            return;
          }
        }
      }

      // B4 Validation: Qty Used must be a positive integer ≥ 1 if spare part row has data
      const sparesWithInvalidQty = executionData.consumedSpareParts.filter(spare => {
        const hasData = spare.partNo || spare.description;
        if (!hasData) return false;
        const qty = spare.quantityConsumed;
        if (!qty || qty.trim() === '') return true;
        const qtyNum = parseFloat(qty);
        if (isNaN(qtyNum) || qtyNum < 1 || !Number.isInteger(qtyNum)) return true;
        return false;
      });
      if (sparesWithInvalidQty.length > 0) {
        const parts = sparesWithInvalidQty.map(s => s.partNo || s.description).join(', ');
        toast({
          title: "Validation Error",
          description: `Qty Used must be a positive whole number (≥ 1) for: ${parts}. Remove the row if no spares were consumed.`,
          variant: "destructive"
        });
        return;
      }

      // B4 Validation: Location mandatory for ALL spares with qty > 0
      const sparesWithMissingLoc = executionData.consumedSpareParts.filter(spare => {
        const qty = parseFloat(spare.quantityConsumed || '0');
        if (qty <= 0) return false;
        const hasLocationId = spare.locationId != null && spare.locationId > 0;
        const hasLocationName = spare.locationName && spare.locationName.trim().length > 0;
        return !hasLocationId && !hasLocationName;
      });
      if (sparesWithMissingLoc.length > 0) {
        const parts = sparesWithMissingLoc.map(s => s.partNo || s.description).join(', ');
        toast({
          title: "Location Required",
          description: `Please select a location for: ${parts}. A location is required when consuming spare parts.`,
          variant: "destructive"
        });
        return;
      }

      // B4 Validation: Comments required if qty exceeds 50% of available stock
      const sparesNeedingComments = executionData.consumedSpareParts.filter(spare => {
        const qty = parseFloat(spare.quantityConsumed || '0');
        if (qty <= 0) return false;
        if (spare.comments && spare.comments.trim().length > 0) return false;
        const available = spare.availableQty || 0;
        if (available <= 0) return qty > 0;
        return qty > (available * 0.5);
      });
      if (sparesNeedingComments.length > 0) {
        const parts = sparesNeedingComments.map(s => s.partNo || s.description).join(', ');
        toast({
          title: "Comments Required",
          description: `High consumption detected for: ${parts}. Please add a comment explaining the usage when consuming more than 50% of available stock.`,
          variant: "destructive"
        });
        return;
      }

      if (onSubmit) {
        // Rule 4: Frequency Integrity — auto-recalculate next due date for Calendar-basis jobs
        let recalculatedNextDueDate = templateData.nextDueDate;
        if (completionDate && templateData.maintenanceBasis !== 'Running Hours' && templateData.frequencyValue && templateData.frequencyUnit) {
          const calculatedNextDue = calculateNextDueDate(completionDate, templateData.frequencyValue, templateData.frequencyUnit);
          if (calculatedNextDue) {
            if (templateData.nextDueDate && templateData.nextDueDate !== calculatedNextDue) {
              const normalizedManual = normalizeDateToDDMMMYYYY(templateData.nextDueDate);
              if (normalizedManual && normalizedManual !== calculatedNextDue) {
                toast({
                  title: "Next Due Date Recalculated",
                  description: `Next Due Date recalculated: ${calculatedNextDue} (based on completion date + frequency of ${templateData.frequencyValue} ${templateData.frequencyUnit}).`,
                });
              }
            }
            recalculatedNextDueDate = calculatedNextDue;
          }
        }

        const workOrderId = workOrder?.id || `new-${Date.now()}`;
        const executionRecord = {
          ...templateData,
          ...executionData,
          nextDueDate: recalculatedNextDueDate,
          riskAssessmentStatus: executionData.riskAssessment,
          safetyChecklistsStatus: executionData.safetyChecklists,
          operationalFormsStatus: executionData.operationalForms,
          woExecutionId: executionData.woExecutionId || generateWOExecutionId(),
          templateCode: templateData.woTemplateCode || workOrder?.templateCode,
          submittedDate: new Date().toISOString().split('T')[0]
        };
        
        // Post consumption transactions for BOM-linked spare parts FIRST (atomic requirement)
        const bomConsumedParts = executionData.consumedSpareParts.filter(
          part => part.isFromBom && part.spareId && part.locationId
        );
        if (bomConsumedParts.length > 0) {
          try {
            await consumptionMutation.mutateAsync(bomConsumedParts);
          } catch (error: any) {
            console.error('Failed to post consumption transactions:', error);
            toast({
              title: "Inventory Update Failed",
              description: error?.message || "Failed to record spare consumption. Work Order not submitted. Please try again or remove consumption entries.",
              variant: "destructive"
            });
            // Do NOT proceed with work order submission - keep dialog open
            return;
          }
        }
        
        onSubmit(workOrderId, { type: 'execution', data: executionRecord });
        
        toast({
          title: "Success",
          description: bomConsumedParts.length > 0 
            ? `Work Order submitted. ${bomConsumedParts.length} spare consumption(s) recorded.`
            : "Work Order submitted for approval",
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
                  onClick={() => window.history.back()}
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
              {/* Hide Part B tab when in template mode */}
              {mode !== 'template' && (
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
              )}
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
                          isModifyMode={isModifyMode && !isPartAReadOnly}
                          onFieldChange={trackFieldChange}
                        >
                          <Input 
                            value={templateData.woTitle} 
                            onChange={(e) => handleTemplateChange('woTitle', e.target.value)}
                            className="text-sm"
                            placeholder="Enter work order title"
                            disabled={isPartAReadOnly}
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
                          isModifyMode={isModifyMode && !isPartAReadOnly}
                          onFieldChange={trackFieldChange}
                        >
                          <Select 
                            value={templateData.maintenanceBasis} 
                            onValueChange={(value) => handleTemplateChange('maintenanceBasis', value)}
                            disabled={isPartAReadOnly}
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
                          isModifyMode={isModifyMode && !isPartAReadOnly}
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
                            disabled={isPartAReadOnly || isPreviewMode}
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
                            isModifyMode={isModifyMode && !isPartAReadOnly}
                            onFieldChange={trackFieldChange}
                          >
                            <Select 
                              value={templateData.frequencyUnit} 
                              onValueChange={(value) => handleTemplateChange('frequencyUnit', value)}
                              disabled={isPartAReadOnly}
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
                          isModifyMode={isModifyMode && !isPartAReadOnly}
                          onFieldChange={trackFieldChange}
                        >
                          <Select 
                            value={templateData.taskType} 
                            onValueChange={(value) => handleTemplateChange('taskType', value)}
                            disabled={isPartAReadOnly}
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
                          isModifyMode={isModifyMode && !isPartAReadOnly}
                          onFieldChange={trackFieldChange}
                        >
                          <Select 
                            value={templateData.assignedTo} 
                            onValueChange={(value) => handleTemplateChange('assignedTo', value)}
                            disabled={isPartAReadOnly}
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
                        <Select 
                          value={templateData.approver} 
                          onValueChange={(value) => handleTemplateChange('approver', value)}
                          disabled={isPartAReadOnly}
                        >
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
                        <Select 
                          value={templateData.jobPriority} 
                          onValueChange={(value) => handleTemplateChange('jobPriority', value)}
                          disabled={isPartAReadOnly}
                        >
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
                        <Select 
                          value={templateData.classRelated} 
                          onValueChange={(value) => handleTemplateChange('classRelated', value)}
                          disabled={isPartAReadOnly}
                        >
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
                            disabled={isPartAReadOnly}
                          />
                        ) : (
                          <Input
                            type="text"
                            value={templateData.nextDueReading}
                            onChange={(e) => handleTemplateChange('nextDueReading', e.target.value)}
                            className="text-sm"
                            placeholder="Leave empty to auto-calculate"
                            disabled={isPartAReadOnly}
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
                        isModifyMode={isModifyMode && !isPartAReadOnly}
                        onFieldChange={trackFieldChange}
                      >
                        <Textarea 
                          value={templateData.briefWorkDescription} 
                          onChange={(e) => handleTemplateChange('briefWorkDescription', e.target.value)}
                          className="mt-2 text-sm"
                          rows={3}
                          placeholder="Enter work description..."
                          disabled={isPartAReadOnly}
                        />
                      </ModifyFieldWrapper>
                    </div>
                  </div>

                  {/* A2. Required Spare Parts */}
                  <div className="border border-gray-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-md font-medium" style={{ color: '#16569e' }}>A2. Required Spare Parts</h4>
                      {!isPartAReadOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-800"
                          onClick={handleAddSparePart}
                          data-testid="button-add-spare-part-a2"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Spare Part
                        </Button>
                      )}
                    </div>

                    {/* Component Spare BOM (Read-only from inventory system) */}
                    {componentSpareBom.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium text-gray-500 uppercase">Component Spare BOM</span>
                          <span className="text-xs text-gray-400">(from inventory system - read only)</span>
                        </div>
                        <div className="border border-blue-100 rounded bg-blue-50/50">
                          <div className="bg-blue-100 px-4 py-2 border-b border-blue-200">
                            <div className="grid grid-cols-[2fr_3fr_1fr_1.5fr] gap-4 text-xs font-medium text-blue-800">
                              <div>Part No</div>
                              <div>Description</div>
                              <div>ROB</div>
                              <div>Status</div>
                            </div>
                          </div>
                          <div className="divide-y divide-blue-100">
                            {componentSpareBom.map((spare: any) => {
                              const stockStatus = spare.rob >= spare.min ? 'OK' : spare.rob > 0 ? 'Low' : 'Critical';
                              return (
                                <div key={spare.id} className="px-4 py-2">
                                  <div className="grid grid-cols-[2fr_3fr_1fr_1.5fr] gap-4 items-center text-sm">
                                    <div className="text-gray-900 font-medium">{spare.partCode || '-'}</div>
                                    <div className="text-gray-700">{spare.partName || '-'}</div>
                                    <div className="text-gray-900 font-semibold">{spare.rob ?? 0}</div>
                                    <div>
                                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                                        stockStatus === 'OK' 
                                          ? 'bg-green-100 text-green-800' 
                                          : stockStatus === 'Low'
                                          ? 'bg-orange-100 text-orange-800'
                                          : 'bg-red-100 text-red-800'
                                      }`}>
                                        {stockStatus}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Manually Added Spare Parts */}
                    {(templateData.requiredSpareParts.length > 0 || !isPartAReadOnly) && (
                      <div className="text-xs font-medium text-gray-500 uppercase mb-2">
                        Additional Required Parts
                      </div>
                    )}
                    
                    <div className="border border-gray-200 rounded">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <div className="grid grid-cols-[2fr_3fr_1.5fr_2fr_auto] gap-4 text-sm font-medium text-gray-700">
                          <div>Part No</div>
                          <div>Description</div>
                          <div>Quantity Required</div>
                          <div>Remarks</div>
                          <div className="w-20">Actions</div>
                        </div>
                      </div>
                      <div className="divide-y divide-gray-200">
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
                                  />
                                  <Input
                                    value={part.description}
                                    onChange={(e) => handleUpdateSparePartField(index, 'description', e.target.value)}
                                    placeholder="Description"
                                    className="text-sm"
                                  />
                                  <Input
                                    type="number"
                                    value={part.quantityRequired}
                                    onChange={(e) => handleUpdateSparePartField(index, 'quantityRequired', e.target.value)}
                                    placeholder="Qty"
                                    className="text-sm"
                                  />
                                  <Input
                                    value={part.remarks}
                                    onChange={(e) => handleUpdateSparePartField(index, 'remarks', e.target.value)}
                                    placeholder="Remarks"
                                    className="text-sm"
                                  />
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleSaveSparePart(index)}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Check className="h-4 w-4 text-green-600" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={handleCancelEditSparePart}
                                      className="h-8 w-8 p-0"
                                    >
                                      <X className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className={`grid gap-4 items-center ${isPartAReadOnly ? 'grid-cols-[2fr_3fr_1.5fr_2fr]' : 'grid-cols-[2fr_3fr_1.5fr_2fr_auto]'}`}>
                                  <div className="text-sm text-gray-900">{part.partNo || '-'}</div>
                                  <div className="text-sm text-gray-900">{part.description || '-'}</div>
                                  <div className="text-sm text-gray-900">{part.quantityRequired || '-'}</div>
                                  <div className="text-sm text-gray-900">{part.remarks || '-'}</div>
                                  {!isPartAReadOnly && (
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditSparePart(index)}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Pencil className="h-4 w-4 text-blue-600" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteSparePart(index)}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Trash2 className="h-4 w-4 text-red-600" />
                                      </Button>
                                    </div>
                                  )}
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
                  <div className="border border-gray-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-md font-medium" style={{ color: '#16569e' }}>A3. Required Tools & Equipment</h4>
                      {!isPartAReadOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-800"
                          onClick={handleAddTool}
                          data-testid="button-add-tool-a3"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Tool
                        </Button>
                      )}
                    </div>
                    
                    <div className="border border-gray-200 rounded">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <div className="grid grid-cols-[3fr_1.5fr_2fr_auto] gap-4 text-sm font-medium text-gray-700">
                          <div>Tool Name</div>
                          <div>Quantity</div>
                          <div>Remarks</div>
                          <div className="w-20">Actions</div>
                        </div>
                      </div>
                      <div className="divide-y divide-gray-200">
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
                                  />
                                  <Input
                                    type="number"
                                    value={tool.quantity}
                                    onChange={(e) => handleUpdateToolField(index, 'quantity', e.target.value)}
                                    placeholder="Qty"
                                    className="text-sm"
                                  />
                                  <Input
                                    value={tool.remarks}
                                    onChange={(e) => handleUpdateToolField(index, 'remarks', e.target.value)}
                                    placeholder="Remarks"
                                    className="text-sm"
                                  />
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleSaveTool(index)}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Check className="h-4 w-4 text-green-600" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={handleCancelEditTool}
                                      className="h-8 w-8 p-0"
                                    >
                                      <X className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className={`grid gap-4 items-center ${isPartAReadOnly ? 'grid-cols-[3fr_1.5fr_2fr]' : 'grid-cols-[3fr_1.5fr_2fr_auto]'}`}>
                                  <div className="text-sm text-gray-900">{tool.toolName || '-'}</div>
                                  <div className="text-sm text-gray-900">{tool.quantity || '-'}</div>
                                  <div className="text-sm text-gray-900">{tool.remarks || '-'}</div>
                                  {!isPartAReadOnly && (
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditTool(index)}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Pencil className="h-4 w-4 text-blue-600" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteTool(index)}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Trash2 className="h-4 w-4 text-red-600" />
                                      </Button>
                                    </div>
                                  )}
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
                  <div className="border border-gray-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-md font-medium" style={{ color: '#16569e' }}>A4. Safety Requirements</h4>
                      {!isPartAReadOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-800"
                          onClick={() => setIsSafetyModalOpen(true)}
                          data-testid="button-add-requirement-a4"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Requirement
                        </Button>
                      )}
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
                                {!isPartAReadOnly && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteSafetyRequirement('ppeRequirements', index)}
                                    className="h-6 w-6 p-0"
                                  >
                                    <Trash2 className="h-3 w-3 text-red-600" />
                                  </Button>
                                )}
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
                                {!isPartAReadOnly && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteSafetyRequirement('permitRequirements', index)}
                                    className="h-6 w-6 p-0"
                                  >
                                    <Trash2 className="h-3 w-3 text-red-600" />
                                  </Button>
                                )}
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
                                {!isPartAReadOnly && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteSafetyRequirement('otherRequirements', index)}
                                    className="h-6 w-6 p-0"
                                  >
                                    <Trash2 className="h-3 w-3 text-red-600" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">No other safety requirements specified yet</div>
                        )}
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
                            
                            const response = await fetch('/technical/api/change-requests', {
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
                
                {/* Maintenance Records Button - Show in template mode */}
                {mode === 'template' && (workOrder?.componentId || workOrder?.componentCode || component?.code) && (
                  <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
                    <div className="flex justify-center">
                      <Button 
                        size="lg" 
                        className="bg-[#16569e] hover:bg-[#124580] text-white px-8 py-3 text-base font-medium"
                        onClick={() => {
                          const componentId = workOrder?.componentId || workOrder?.componentCode || component?.code;
                          const workOrderId = workOrder?.id;
                          const url = workOrderId 
                            ? `/pms/maintenance-records/${componentId}?sourceWorkOrderId=${workOrderId}`
                            : `/pms/maintenance-records/${componentId}`;
                          setLocation(url);
                        }}
                        data-testid="button-maintenance-records"
                      >
                        <FileText className="h-5 w-5 mr-2" />
                        View Maintenance Records
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Part B - Work Completion Record (EXECUTION) */}
            {activeSection === 'partB' && (
              <div className="border border-gray-200 rounded-lg mb-6">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-[#16569e]">Part B - Work Completion Record (EXECUTION)</h3>
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
                            <input type="radio" name="riskAssessment" value="Yes" checked={executionData.riskAssessment === "Yes"} onChange={() => handleExecutionChange('riskAssessment', 'Yes')} disabled={isPartBReadOnly} className="text-blue-600" />
                            <span className="text-sm">Yes</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" name="riskAssessment" value="No" checked={executionData.riskAssessment === "No"} onChange={() => handleExecutionChange('riskAssessment', 'No')} disabled={isPartBReadOnly} className="text-blue-600" />
                            <span className="text-sm">No</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" name="riskAssessment" value="NA" checked={executionData.riskAssessment === "NA"} onChange={() => handleExecutionChange('riskAssessment', 'NA')} disabled={isPartBReadOnly} className="text-blue-600" />
                            <span className="text-sm">NA</span>
                          </label>
                        </div>
                        {executionData.riskAssessment === "Yes" && (
                        <div className="col-span-3 flex items-center gap-2">
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
                            disabled={executionData.riskAssessment !== "Yes"}
                            data-testid="button-upload-risk-assessment"
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Upload
                          </Button>
                          {getUploadedDocument('riskAssessment') && (
                            <Paperclip className="h-4 w-4 text-blue-500 cursor-pointer" onClick={() => handleDownloadDocument('riskAssessment')} data-testid="button-download-risk-assessment" />
                          )}
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
                        )}
                      </div>

                      {/* B1.2 Safety Checklists Completed */}
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-6">
                          <Label className="text-sm text-gray-900">B1.2 Safety Checklists Completed (As applicable):</Label>
                        </div>
                        <div className="col-span-3 flex items-center gap-4">
                          <label className="flex items-center gap-2">
                            <input type="radio" name="safetyChecklists" value="Yes" checked={executionData.safetyChecklists === "Yes"} onChange={() => handleExecutionChange('safetyChecklists', 'Yes')} disabled={isPartBReadOnly} className="text-blue-600" />
                            <span className="text-sm">Yes</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" name="safetyChecklists" value="No" checked={executionData.safetyChecklists === "No"} onChange={() => handleExecutionChange('safetyChecklists', 'No')} disabled={isPartBReadOnly} className="text-blue-600" />
                            <span className="text-sm">No</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" name="safetyChecklists" value="NA" checked={executionData.safetyChecklists === "NA"} onChange={() => handleExecutionChange('safetyChecklists', 'NA')} disabled={isPartBReadOnly} className="text-blue-600" />
                            <span className="text-sm">NA</span>
                          </label>
                        </div>
                        {executionData.safetyChecklists === "Yes" && (
                        <div className="col-span-3 flex items-center gap-2">
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
                            disabled={executionData.safetyChecklists !== "Yes"}
                            data-testid="button-upload-safety-checklist"
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Upload
                          </Button>
                          {getUploadedDocument('safetyChecklist') && (
                            <Paperclip className="h-4 w-4 text-blue-500 cursor-pointer" onClick={() => handleDownloadDocument('safetyChecklist')} data-testid="button-download-safety-checklist" />
                          )}
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
                        )}
                      </div>

                      {/* B1.3 Operational Forms Completed */}
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-6">
                          <Label className="text-sm text-gray-900">B1.3 Operational Forms Completed (As applicable):</Label>
                        </div>
                        <div className="col-span-3 flex items-center gap-4">
                          <label className="flex items-center gap-2">
                            <input type="radio" name="operationalForms" value="Yes" checked={executionData.operationalForms === "Yes"} onChange={() => handleExecutionChange('operationalForms', 'Yes')} disabled={isPartBReadOnly} className="text-blue-600" />
                            <span className="text-sm">Yes</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" name="operationalForms" value="No" checked={executionData.operationalForms === "No"} onChange={() => handleExecutionChange('operationalForms', 'No')} disabled={isPartBReadOnly} className="text-blue-600" />
                            <span className="text-sm">No</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" name="operationalForms" value="NA" checked={executionData.operationalForms === "NA"} onChange={() => handleExecutionChange('operationalForms', 'NA')} disabled={isPartBReadOnly} className="text-blue-600" />
                            <span className="text-sm">NA</span>
                          </label>
                        </div>
                        {executionData.operationalForms === "Yes" && (
                        <div className="col-span-3 flex items-center gap-2">
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
                            disabled={executionData.operationalForms !== "Yes"}
                            data-testid="button-upload-operational-form"
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Upload
                          </Button>
                          {getUploadedDocument('operationalForm') && (
                            <Paperclip className="h-4 w-4 text-blue-500 cursor-pointer" onClick={() => handleDownloadDocument('operationalForm')} data-testid="button-download-operational-form" />
                          )}
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
                        )}
                      </div>
                    </div>
                  </div>

                  {/* B2. Details of Work Carried Out */}
                  <div className="border border-gray-200 rounded-lg p-4 mb-6">
                    <h4 className="text-md font-medium mb-4" style={{ color: '#16569e' }}>B2. Details of Work Carried Out</h4>
                    
                    <div className="mb-6">
                      {/* Work Carried Out */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm text-[#8798ad]">Work Carried Out <span className="text-red-500">*</span></Label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowQuickInputs(!showQuickInputs)}
                              disabled={isPartBReadOnly}
                              className="text-xs text-[#52BAF3] border-[#52BAF3] hover:bg-blue-50 h-6 px-2"
                            >
                              Quick Input {showQuickInputs ? '▲' : '▼'}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={toggleSmartSuggestions}
                              disabled={isPartBReadOnly}
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
                          disabled={isPartBReadOnly}
                          maxLength={2000}
                          className="w-full min-h-[80px]" 
                          placeholder="Describe work carried out..."
                        />
                        <span className="text-xs text-gray-400 text-right block" data-testid="text-work-carried-out-count">{(executionData.workCarriedOut || '').length} / 2000</span>
                      </div>
                      
                      {/* Job Experience / Notes */}
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Job Experience / Notes (to be retained for future)</Label>
                        <Textarea 
                          value={executionData.jobExperienceNotes}
                          onChange={(e) => handleExecutionChange('jobExperienceNotes', e.target.value)}
                          disabled={isPartBReadOnly}
                          maxLength={2000}
                          className="w-full min-h-[80px]" 
                          placeholder="Enter job experience notes..."
                        />
                        <span className="text-xs text-gray-400 text-right block" data-testid="text-job-experience-count">{(executionData.jobExperienceNotes || '').length} / 2000</span>
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
                            disabled={isPartBReadOnly}
                            placeholder="Enter previous hours reading"
                            className="w-full" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Current Reading *</Label>
                          <Input 
                            type="number" 
                            min="0"
                            value={executionData.currentReading}
                            onChange={(e) => handleExecutionChange('currentReading', e.target.value)}
                            disabled={isPartBReadOnly}
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
                      <div className="flex gap-2">
                        {componentSpareBom.length > 0 && (
                          <span className="text-xs text-gray-500 self-center">
                            {componentSpareBom.length} spare(s) in BOM
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-800"
                          onClick={handleAddConsumedSparePart}
                          disabled={isPartBReadOnly}
                          data-testid="button-add-spare-part-b4"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Spare Part
                        </Button>
                      </div>
                    </div>
                    
                    {/* Quick select from BOM */}
                    {componentSpareBom.length > 0 && (
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <p className="text-xs text-blue-700 mb-2 font-medium">Quick select from Component BOM:</p>
                        <div className="flex flex-wrap gap-2">
                          {componentSpareBom.map((spare: any) => {
                            const stockStatus = spare.rob >= (spare.min || 0) ? 'OK' : spare.rob > 0 ? 'Low' : 'Critical';
                            const statusColor = stockStatus === 'OK' ? 'bg-green-100 text-green-700' : 
                                                stockStatus === 'Low' ? 'bg-yellow-100 text-yellow-700' : 
                                                'bg-red-100 text-red-700';
                            return (
                              <button
                                key={spare.id}
                                type="button"
                                onClick={() => handleOpenConsumeDialog(spare)}
                                disabled={spare.rob <= 0}
                                className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs border rounded-full cursor-pointer transition-colors duration-150 ${
                                  spare.rob > 0 
                                    ? 'bg-white border-gray-300 text-gray-700 hover:bg-blue-100 hover:border-blue-300' 
                                    : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                                data-testid={`button-consume-spare-${spare.id}`}
                              >
                                <span className="font-medium">{spare.partCode}</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusColor}`}>
                                  ROB: {spare.rob}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    <div className="border border-gray-200 rounded">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <div className="grid grid-cols-[1.5fr_2.5fr_1fr_1.5fr_1.5fr_auto] gap-4 text-sm font-medium text-gray-700">
                          <div>Part No</div>
                          <div>Description</div>
                          <div>Qty</div>
                          <div>Location</div>
                          <div>Comments</div>
                          <div className="w-16">Actions</div>
                        </div>
                      </div>
                      <div className="divide-y divide-gray-200">
                        {executionData.consumedSpareParts.length > 0 ? (
                          executionData.consumedSpareParts.map((part, index) => (
                            <div key={index} className="px-4 py-3">
                              {editingConsumedSparePart === index && !part.isFromBom ? (
                                <div className="grid grid-cols-[1.5fr_2.5fr_1fr_1.5fr_1.5fr_auto] gap-4 items-center">
                                  <Input
                                    value={part.partNo}
                                    onChange={(e) => handleUpdateConsumedSparePartField(index, 'partNo', e.target.value)}
                                    placeholder="Part No"
                                    className="text-sm"
                                  />
                                  <Input
                                    value={part.description}
                                    onChange={(e) => handleUpdateConsumedSparePartField(index, 'description', e.target.value)}
                                    placeholder="Description"
                                    className="text-sm"
                                  />
                                  <Input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={part.quantityConsumed}
                                    onChange={(e) => handleUpdateConsumedSparePartField(index, 'quantityConsumed', e.target.value)}
                                    placeholder="Qty"
                                    className="text-sm"
                                  />
                                  <Input
                                    value={part.locationName || ''}
                                    onChange={(e) => handleUpdateConsumedSparePartField(index, 'locationName', e.target.value)}
                                    placeholder="Location"
                                    className="text-sm"
                                  />
                                  <Input
                                    value={part.comments}
                                    onChange={(e) => handleUpdateConsumedSparePartField(index, 'comments', e.target.value)}
                                    placeholder="Comments"
                                    className="text-sm"
                                  />
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleSaveConsumedSparePart(index)}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Check className="h-4 w-4 text-green-600" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={handleCancelEditConsumedSparePart}
                                      className="h-8 w-8 p-0"
                                    >
                                      <X className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="grid grid-cols-[1.5fr_2.5fr_1fr_1.5fr_1.5fr_auto] gap-4 items-center">
                                  <div className="text-sm text-gray-900 font-medium">
                                    {part.partNo || '-'}
                                    {part.isFromBom && (
                                      <span className="ml-1 text-[10px] text-blue-500">(BOM)</span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-900">{part.description || '-'}</div>
                                  <div className="text-sm text-gray-900">{part.quantityConsumed || '-'}</div>
                                  <div className="text-sm text-gray-600">{part.locationName || '-'}</div>
                                  <div className="text-sm text-gray-500 truncate" title={part.comments}>{part.comments || '-'}</div>
                                  <div className="flex gap-1">
                                    {!part.isFromBom && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditConsumedSparePart(index)}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Pencil className="h-4 w-4 text-blue-600" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteConsumedSparePart(index)}
                                      className="h-8 w-8 p-0"
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
                            No spare parts consumed yet. {componentSpareBom.length > 0 ? 'Select from BOM above or add manually.' : 'Click "Add Spare Part" to add.'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Consume Spare Dialog */}
                  <Dialog open={showConsumeDialog} onOpenChange={setShowConsumeDialog}>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Consume Spare Part</DialogTitle>
                      </DialogHeader>
                      {selectedBomSpare && (
                        <div className="space-y-4 py-4">
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="text-sm font-medium text-gray-900">{selectedBomSpare.partCode}</div>
                            <div className="text-sm text-gray-600">{selectedBomSpare.name}</div>
                            <div className="text-xs text-gray-500 mt-1">Total ROB: {selectedBomSpare.rob}</div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-sm text-gray-700">Select Location *</Label>
                            <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select location to consume from" />
                              </SelectTrigger>
                              <SelectContent>
                                {selectedBomSpare.locations?.filter((loc: any) => loc.qty > 0).map((loc: any) => (
                                  <SelectItem key={loc.locationId} value={loc.locationId.toString()}>
                                    {loc.locationName} (Available: {loc.qty})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-sm text-gray-700">Quantity to Consume *</Label>
                            <Input
                              type="number"
                              min="1"
                              max={selectedBomSpare.locations?.find((loc: any) => loc.locationId.toString() === selectedLocationId)?.qty || 1}
                              value={consumeQty}
                              onChange={(e) => setConsumeQty(e.target.value)}
                              placeholder="Enter quantity"
                            />
                            {selectedLocationId && (
                              <p className="text-xs text-gray-500">
                                Max available: {selectedBomSpare.locations?.find((loc: any) => loc.locationId.toString() === selectedLocationId)?.qty || 0}
                              </p>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-sm text-gray-700">Comments (optional)</Label>
                            <Input
                              value={consumeComments}
                              onChange={(e) => setConsumeComments(e.target.value)}
                              placeholder="e.g., Replaced worn part"
                            />
                          </div>
                          
                          <div className="flex justify-end gap-2 pt-4">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setShowConsumeDialog(false);
                                setSelectedBomSpare(null);
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleConfirmConsumption}
                              disabled={!selectedLocationId || !consumeQty || parseInt(consumeQty) <= 0}
                              className="bg-blue-600 hover:bg-blue-700"
                              data-testid="button-confirm-consumption"
                            >
                              Add to Consumption
                            </Button>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>

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
                            
                            const response = await fetch('/technical/api/change-requests', {
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
      
      {/* Safety Requirements Modal */}
      <Dialog open={isSafetyModalOpen} onOpenChange={setIsSafetyModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Safety Requirements</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* PPE Requirements Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-900">PPE Requirements</h4>
              <div className="flex gap-2">
                <Input
                  value={newSafetyRequirement}
                  onChange={(e) => setNewSafetyRequirement(e.target.value)}
                  placeholder="Enter PPE requirement (e.g., Safety helmet, gloves)"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddSafetyRequirement('ppeRequirements');
                    }
                  }}
                />
                <Button
                  onClick={() => handleAddSafetyRequirement('ppeRequirements')}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              {templateData.safetyRequirements.ppeRequirements.length > 0 && (
                <div className="space-y-2 mt-3">
                  {templateData.safetyRequirements.ppeRequirements.map((req, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <span className="text-sm text-gray-900">{req}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSafetyRequirement('ppeRequirements', index)}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3 text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Permit Requirements Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-900">Permit Requirements</h4>
              <div className="flex gap-2">
                <Input
                  value={newSafetyRequirement}
                  onChange={(e) => setNewSafetyRequirement(e.target.value)}
                  placeholder="Enter permit requirement (e.g., Hot work permit, Confined space)"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddSafetyRequirement('permitRequirements');
                    }
                  }}
                />
                <Button
                  onClick={() => handleAddSafetyRequirement('permitRequirements')}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              {templateData.safetyRequirements.permitRequirements.length > 0 && (
                <div className="space-y-2 mt-3">
                  {templateData.safetyRequirements.permitRequirements.map((req, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <span className="text-sm text-gray-900">{req}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSafetyRequirement('permitRequirements', index)}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3 text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Other Requirements Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-900">Other Safety Requirements</h4>
              <div className="flex gap-2">
                <Input
                  value={newSafetyRequirement}
                  onChange={(e) => setNewSafetyRequirement(e.target.value)}
                  placeholder="Enter other safety requirement"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddSafetyRequirement('otherRequirements');
                    }
                  }}
                />
                <Button
                  onClick={() => handleAddSafetyRequirement('otherRequirements')}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              {templateData.safetyRequirements.otherRequirements.length > 0 && (
                <div className="space-y-2 mt-3">
                  {templateData.safetyRequirements.otherRequirements.map((req, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <span className="text-sm text-gray-900">{req}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSafetyRequirement('otherRequirements', index)}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3 text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsSafetyModalOpen(false);
                setNewSafetyRequirement("");
              }}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Document Confirmation Dialog */}
      <AlertDialog open={deleteDocumentDialogOpen} onOpenChange={setDeleteDocumentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this attachment?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDocumentDialogOpen(false);
              setDocumentToDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDocumentConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default WorkOrderForm;