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
import { FileText, ArrowLeft, Plus, Eye, Upload, Download, Menu, Check, X, Edit2, Trash2 } from "lucide-react";
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
import { PartHeader } from '@/components/PartHeader';
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
  
  // Check for mode query parameter (e.g., ?mode=template)
  const urlParams = new URLSearchParams(window.location.search);
  const modeFromUrl = urlParams.get('mode') as 'template' | 'execution' | null;
  const resolvedMode = modeFromUrl || mode;
  
  const [isWorkInstructionsOpen, setIsWorkInstructionsOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  
  // Minimal A/B navigation matching reference design (hide Part B in template mode)
  const navSteps = resolvedMode === 'template'
    ? [{ id: 'part-a', label: 'A', title: 'Job Details' }]
    : [
        { id: 'part-a', label: 'A', title: 'Job Details' },
        { id: 'part-b', label: 'B', title: 'Work Completion Record' }
      ];
  
  const [activeStep, setActiveStep] = useState('part-a');
  
  // Scroll tracking for navigation with IntersectionObserver (only if Part B exists)
  useEffect(() => {
    // Skip scroll tracking in template mode (no Part B)
    if (resolvedMode === 'template') return;
    
    const partAElement = document.getElementById('part-a');
    const partBElement = document.getElementById('part-b');
    
    if (!partAElement || !partBElement) return;
    
    // Check initial position on mount
    const checkInitialPosition = () => {
      const scrollPosition = window.scrollY + 200;
      const partATop = partAElement.offsetTop;
      const partBTop = partBElement.offsetTop;
      
      if (scrollPosition >= partBTop) {
        setActiveStep('part-b');
      } else {
        setActiveStep('part-a');
      }
    };
    
    // IntersectionObserver for continuous tracking
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            if (id === 'part-a' || id === 'part-b') {
              setActiveStep(id);
            }
          }
        });
      },
      {
        rootMargin: '-200px 0px -50% 0px',
        threshold: 0
      }
    );
    
    observer.observe(partAElement);
    observer.observe(partBElement);
    
    // Check initial position after a short delay to ensure layout is ready
    setTimeout(checkInitialPosition, 100);
    
    return () => {
      observer.disconnect();
    };
  }, [resolvedMode]);
  
  // Use job context endpoint for template mode (viewing job template), 
  // work order context endpoint otherwise
  const { data: jobContext, isLoading: isJobContextLoading } = useQuery({
    queryKey: [`/api/jobs/${workOrderId}/context`],
    enabled: !!workOrderId && resolvedMode === 'template'
  });

  const { data: woContext, isLoading: isWoContextLoading } = useQuery({
    queryKey: [`/api/work-orders/${workOrderId}/context`],
    enabled: !!workOrderId && resolvedMode !== 'template'
  });
  
  // Combine contexts: use job context for template mode, work order context otherwise
  const workOrderContext = resolvedMode === 'template' ? jobContext : woContext;
  const isContextLoading = resolvedMode === 'template' ? isJobContextLoading : isWoContextLoading;

  // Extract vesselId from context for spares query
  const vesselId = workOrderContext ? (workOrderContext as any).templateData?.vesselId || (workOrderContext as any).workOrder?.vesselId : null;
  
  // Fetch spares inventory for location auto-selection in Part B4
  const { data: sparesInventory = [] } = useQuery<Array<{
    id: number;
    partCode: string;
    partName: string;
    rob: string;
    robLocationA: string;
    robLocationB: string;
    locationA: string | null;
    locationB: string | null;
  }>>({
    queryKey: ['/api/spares', vesselId],
    enabled: !!vesselId
  });

  // Helper function to get available locations for a spare part
  const getAvailableLocationsForSpare = (partNo: string): Array<'Location A' | 'Location B'> => {
    const spare = sparesInventory.find(s => s.partCode === partNo);
    if (!spare) return ['Location A', 'Location B']; // Default if not found
    
    const locations: Array<'Location A' | 'Location B'> = [];
    const robA = parseFloat(spare.robLocationA || '0');
    const robB = parseFloat(spare.robLocationB || '0');
    
    if (robA > 0) locations.push('Location A');
    if (robB > 0) locations.push('Location B');
    
    // If no stock anywhere, allow both locations for manual entry
    if (locations.length === 0) return ['Location A', 'Location B'];
    
    return locations;
  };

  // Helper to check if auto-selection should be applied
  const getAutoSelectedLocation = (partNo: string): 'Location A' | 'Location B' | null => {
    const locations = getAvailableLocationsForSpare(partNo);
    if (locations.length === 1) return locations[0];
    return null;
  };
  
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
  const [originalSparePart, setOriginalSparePart] = useState<{partNo: string, description: string, quantityRequired: string, remarks: string} | null>(null);
  const [originalTool, setOriginalTool] = useState<{toolName: string, quantity: string, remarks: string} | null>(null);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [newSafetyRequirement, setNewSafetyRequirement] = useState("");
  const [safetyRequirementCategory, setSafetyRequirementCategory] = useState<'ppeRequirements' | 'permitRequirements' | 'otherRequirements'>('ppeRequirements');
  
  const riskAssessmentFileRef = useRef<HTMLInputElement>(null);
  const safetyChecklistFileRef = useRef<HTMLInputElement>(null);
  const operationalFormFileRef = useRef<HTMLInputElement>(null);
  const [deleteDocumentDialogOpen, setDeleteDocumentDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{type: string, fileKey: string} | null>(null);
  
  const [editingConsumedSparePart, setEditingConsumedSparePart] = useState<number | null>(null);
  
  // Cache the last Calendar unit selection to preserve user choice when toggling maintenance basis
  const [lastCalendarUnit, setLastCalendarUnit] = useState('Months');
  
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
    consumedSpareParts: [] as Array<{partNo: string, description: string, quantityConsumed: string, location: 'Location A' | 'Location B' | '', comments: string}>,
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

  // Normalize frequency value to ensure it's a valid positive integer
  const normalizeFrequencyValue = (value: string): string => {
    if (value === '' || value === null || value === undefined) return '';
    // Only accept positive integers: 1, 2, 10, 100, etc.
    if (/^[1-9]\d*$/.test(value)) {
      return value;
    }
    // If invalid, return empty string (will be handled by validation)
    return '';
  };

  // Load work order data when workOrderContext is fetched
  useEffect(() => {
    if (workOrderContext) {
      const context = workOrderContext as any;
      if (context.templateData) {
        // Determine the correct frequency unit based on maintenance basis
        let normalizedFrequencyUnit = context.templateData.frequencyUnit;
        if (context.templateData.maintenanceBasis === 'Running Hours') {
          // Running Hours must always use Hours
          normalizedFrequencyUnit = 'Hours';
        } else if (!normalizedFrequencyUnit || normalizedFrequencyUnit === 'Hours') {
          // Calendar basis with missing or Hours unit → default to Months
          normalizedFrequencyUnit = 'Months';
        }
        
        const normalizedTemplateData = {
          ...context.templateData,
          // Normalize frequency value from backend to ensure it's valid
          frequencyValue: normalizeFrequencyValue(context.templateData.frequencyValue || ''),
          // Ensure frequency unit matches maintenance basis
          frequencyUnit: normalizedFrequencyUnit
        };
        
        setTemplateData(prev => ({
          ...prev,
          ...normalizedTemplateData
        }));
        
        // Cache the original calendar unit from backend data (preserve even if currently Running Hours)
        // This ensures we restore the correct unit when toggling from Running Hours back to Calendar
        const originalCalendarUnit = context.templateData.frequencyUnit;
        if (originalCalendarUnit && originalCalendarUnit !== 'Hours' && 
            ['Days', 'Weeks', 'Months', 'Years'].includes(originalCalendarUnit)) {
          setLastCalendarUnit(originalCalendarUnit);
        } else if (normalizedTemplateData.maintenanceBasis === 'Calendar') {
          // Only default to Months if we're in Calendar mode and have no valid unit to preserve
          setLastCalendarUnit(normalizedFrequencyUnit);
        }
        
        // Set Modify Mode snapshot if enabled
        if (isModifyMode && setOriginalSnapshot) {
          setOriginalSnapshot(normalizedTemplateData);
        }
      }
      if (context.executionData) {
        setExecutionData(prev => ({
          ...prev,
          ...context.executionData,
          woExecutionId: prev.woExecutionId || context.executionData.woExecutionId || generateWOExecutionId()
        }));
      }
      
      // Auto-populate previousReading from component's current running hours (Part B Section B3)
      // Only set previousReading if it's not already set (avoid overwriting saved data when editing WOs)
      // Use null/undefined check instead of truthiness to allow 0-hour readings (common after meter replacement)
      if (context.component?.currentCumulativeRH != null) {
        setExecutionData(prev => {
          // Only populate if previousReading hasn't been set yet
          if (prev.previousReading === '' || prev.previousReading == null) {
            return {
              ...prev,
              previousReading: context.component.currentCumulativeRH
            };
          }
          return prev;
        });
      }
    }
  }, [workOrderContext, isModifyMode, setOriginalSnapshot]);

  const handleTemplateChange = (field: string, value: string) => {
    setTemplateData(prev => {
      let finalValue = value;
      
      // Validate frequency value - only accept positive integers (no decimals, no scientific notation)
      if (field === 'frequencyValue') {
        if (value !== '') {
          // Only accept strings that are positive integers: 1, 2, 10, 100, etc.
          if (!/^[1-9]\d*$/.test(value)) {
            toast({
              title: "Invalid Frequency",
              description: "Frequency must be a positive whole number (no decimals or negative values)",
              variant: "destructive"
            });
            return prev; // Don't update if invalid
          }
        }
      }
      
      const newData = { ...prev, [field]: finalValue };
      
      // Auto-update frequency unit when maintenance basis changes
      if (field === 'maintenanceBasis') {
        if (value === 'Running Hours') {
          newData.frequencyUnit = 'Hours';
        } else if (prev.frequencyUnit === 'Hours') {
          // Restore the last Calendar unit (fallback to Months if cache is empty)
          newData.frequencyUnit = lastCalendarUnit || 'Months';
        }
      }
      
      // Cache the calendar unit when it changes (but not when it's Hours)
      if (field === 'frequencyUnit' && value !== 'Hours' && newData.maintenanceBasis === 'Calendar') {
        setLastCalendarUnit(value);
      }
      
      if (isModifyMode && trackFieldChange) {
        trackFieldChange(field, finalValue, (prev as any)[field]);
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
    setOriginalSparePart(null); // New parts have no original state
    setEditingSparePart(templateData.requiredSpareParts.length);
  };

  const handleEditSparePart = (index: number) => {
    // Store original values before editing
    setOriginalSparePart({...templateData.requiredSpareParts[index]});
    setEditingSparePart(index);
  };

  const handleSaveSparePart = (index: number) => {
    const part = templateData.requiredSpareParts[index];
    if (!part.partNo || !part.quantityRequired) {
      toast({
        title: "Validation Error",
        description: "Part Number and Quantity are required fields.",
        variant: "destructive"
      });
      return;
    }
    setEditingSparePart(null);
  };

  const handleCancelEditSparePart = () => {
    if (originalSparePart) {
      // Restore original values for existing parts
      setTemplateData(prev => ({
        ...prev,
        requiredSpareParts: prev.requiredSpareParts.map((part, i) => 
          i === editingSparePart ? originalSparePart : part
        )
      }));
    } else {
      // Remove new parts that were never saved
      setTemplateData(prev => ({
        ...prev,
        requiredSpareParts: prev.requiredSpareParts.filter((_, i) => i !== editingSparePart)
      }));
    }
    setOriginalSparePart(null);
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
    setOriginalTool(null); // New tools have no original state
    setEditingTool(templateData.requiredTools.length);
  };

  const handleEditTool = (index: number) => {
    // Store original values before editing
    setOriginalTool({...templateData.requiredTools[index]});
    setEditingTool(index);
  };

  const handleSaveTool = (index: number) => {
    const tool = templateData.requiredTools[index];
    if (!tool.toolName || !tool.quantity) {
      toast({
        title: "Validation Error",
        description: "Tool Name and Quantity are required fields.",
        variant: "destructive"
      });
      return;
    }
    setEditingTool(null);
  };

  const handleCancelEditTool = () => {
    if (originalTool) {
      // Restore original values for existing tools
      setTemplateData(prev => ({
        ...prev,
        requiredTools: prev.requiredTools.map((tool, i) => 
          i === editingTool ? originalTool : tool
        )
      }));
    } else {
      // Remove new tools that were never saved
      setTemplateData(prev => ({
        ...prev,
        requiredTools: prev.requiredTools.filter((_, i) => i !== editingTool)
      }));
    }
    setOriginalTool(null);
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
    const newPart = { partNo: "", description: "", quantityConsumed: "", location: "" as const, comments: "" };
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
    // Rule #9: Show warning toast when quantity consumed is 0 or blank
    const part = executionData.consumedSpareParts[index];
    const quantityValue = parseFloat(part.quantityConsumed || '0');
    
    if (!part.quantityConsumed || part.quantityConsumed.trim() === '' || quantityValue === 0) {
      toast({
        title: "Spare Consumption Notice",
        description: `No deduction will be made from ROB for "${part.partNo || part.description || 'this spare part'}" since quantity consumed is zero or blank.`,
        variant: "default",
        duration: 5000
      });
    }
    
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
      // Validate frequency value before saving using the normalization helper
      const normalizedFrequency = normalizeFrequencyValue(templateData.frequencyValue);
      if (!normalizedFrequency) {
        toast({
          title: "Validation Error",
          description: "Frequency value is required. Please enter a positive whole number (no decimals, negative values, or zero).",
          variant: "destructive",
        });
        return;
      }
      
      // Validate frequency unit
      if (!templateData.frequencyUnit || templateData.frequencyUnit.trim() === '') {
        toast({
          title: "Validation Error",
          description: "Frequency unit is required.",
          variant: "destructive",
        });
        return;
      }

      // Validate spare parts consumed - location must be selected for items with quantity
      const sparesWithMissingLocation = executionData.consumedSpareParts.filter(spare => {
        const hasQuantity = spare.quantityConsumed && parseFloat(spare.quantityConsumed) > 0;
        const autoLocation = getAutoSelectedLocation(spare.partNo);
        const hasLocation = spare.location || autoLocation;
        return hasQuantity && !hasLocation;
      });

      if (sparesWithMissingLocation.length > 0) {
        const missingParts = sparesWithMissingLocation.map(s => s.partNo).join(', ');
        toast({
          title: "Validation Error",
          description: `Please select a location for consumed spare parts: ${missingParts}`,
          variant: "destructive",
        });
        return;
      }
      
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
                <SheetContent side="left" className="w-[200px]">
                  <SheetHeader>
                    <SheetTitle>Navigation</SheetTitle>
                  </SheetHeader>
                  <nav className="mt-6 space-y-4">
                    {navSteps.map((step) => (
                      <a
                        key={step.id}
                        href={`#${step.id}`}
                        onClick={() => {
                          setActiveStep(step.id);
                          setIsMobileNavOpen(false);
                        }}
                        className="flex items-center gap-3"
                        data-testid={`mobile-nav-step-${step.id}`}
                      >
                        <div className={`
                          w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                          ${activeStep === step.id 
                            ? 'bg-[hsl(var(--primary))] text-white' 
                            : 'bg-gray-200 text-gray-600'
                          }
                        `}>
                          {step.label}
                        </div>
                        <span className="text-sm text-gray-700">
                          {step.title}
                        </span>
                      </a>
                    ))}
                  </nav>
                </SheetContent>
              </Sheet>
              <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate">Work Order Form</h1>
            </div>
            <div className="flex items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsWorkInstructionsOpen(true)}
                className="border-[hsl(var(--primary))] text-[hsl(var(--primary))] hover:bg-blue-50 font-medium px-4 h-9"
                data-testid="button-work-instructions"
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Work Instructions
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Single Scrollable Page with Left Navigation */}
      <div className="flex">
        {/* Left Navigation Sidebar - Minimal A/B Steps */}
        <aside className="hidden lg:block w-20 flex-shrink-0">
          <div className="sticky top-6 px-4 py-6">
            <nav className="space-y-6">
              {navSteps.map((step) => (
                <a
                  key={step.id}
                  href={`#${step.id}`}
                  onClick={() => setActiveStep(step.id)}
                  className="flex flex-col items-center gap-2 group"
                  data-testid={`nav-step-${step.id}`}
                >
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors
                    ${activeStep === step.id 
                      ? 'bg-[hsl(var(--primary))] text-white' 
                      : 'bg-gray-200 text-gray-600 group-hover:bg-blue-100'
                    }
                  `}>
                    {step.label}
                  </div>
                  <span className="text-xs text-center text-gray-500 max-w-[60px] leading-tight">
                    {step.title}
                  </span>
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 px-6 py-6">
          <div className="max-w-5xl mx-auto space-y-6">
            
            {/* Part A - Job Details */}
            <PartHeader
              id="part-a"
              label="Part A"
              title="Job Details"
              description="Work details about this work order"
            />
            
            {/* A1. Job Information */}
            <SectionBlock 
              id="work-order-info"
              number="A1"
              title="Job Information" 
              description="Basic details and configuration for this work order"
            >
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Job Title</Label>
                  <Input
                    value={templateData.woTitle}
                    onChange={(e) => handleTemplateChange('woTitle', e.target.value)}
                    className="text-sm"
                    placeholder="Enter job title"
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
                  <Label className="text-sm text-[#8798ad]">SFI Code</Label>
                  <Input
                    value={templateData.componentCode}
                    onChange={(e) => handleTemplateChange('componentCode', e.target.value)}
                    className="text-sm"
                    placeholder="Enter SFI code"
                    disabled={isReadOnly}
                    data-testid="input-component-code"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Job Template Code</Label>
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
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Frequency</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="1"
                      value={templateData.frequencyValue}
                      onChange={(e) => handleTemplateChange('frequencyValue', e.target.value)}
                      className="text-sm flex-1"
                      placeholder="Value"
                      disabled={isReadOnly}
                      data-testid="input-frequency-value"
                    />
                    <Select
                      value={templateData.maintenanceBasis === 'Running Hours' ? 'Hours' : templateData.frequencyUnit}
                      onValueChange={(value) => handleTemplateChange('frequencyUnit', value)}
                      disabled={isReadOnly || templateData.maintenanceBasis === 'Running Hours'}
                    >
                      <SelectTrigger className="text-sm w-32" data-testid="select-frequency-unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {templateData.maintenanceBasis === 'Running Hours' ? (
                          <SelectItem value="Hours">Hours</SelectItem>
                        ) : (
                          <>
                            <SelectItem value="Days">Days</SelectItem>
                            <SelectItem value="Weeks">Weeks</SelectItem>
                            <SelectItem value="Months">Months</SelectItem>
                            <SelectItem value="Years">Years</SelectItem>
                          </>
                        )}
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

          {/* A2. Required Spare Parts */}
          <SectionBlock
            id="spare-parts"
            number="A2"
            title="Required Spare Parts"
            description="Spare parts needed for this work order"
          >
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="bg-[#22c55e] hover:bg-[#16a34a] text-white"
                  onClick={handleAddSparePart}
                  disabled={isReadOnly}
                  data-testid="button-add-spare"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add spares
                </Button>
              </div>
              
              {/* Editable Spare Parts Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-2 font-medium text-gray-700 w-[20%]">PART NO.</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[40%]">DESCRIPTION</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[15%]">QTY REQUIRED</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[10%]">ROB</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[15%]">STATUS</th>
                      {!isReadOnly && <th className="text-center p-2 font-medium text-gray-700 w-[100px]">ACTIONS</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(templateData.requiredSpareParts || []).length === 0 ? (
                      <tr>
                        <td colSpan={isReadOnly ? 5 : 6} className="text-center p-4 text-gray-500 italic">
                          No spare parts added yet
                        </td>
                      </tr>
                    ) : (
                      (templateData.requiredSpareParts || []).map((part, index) => (
                        <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                          {editingSparePart === index ? (
                            <>
                              <td className="p-2">
                                <Input
                                  value={part.partNo}
                                  onChange={(e) => handleUpdateSparePartField(index, 'partNo', e.target.value)}
                                  placeholder="Part number"
                                  className="text-sm"
                                  data-testid={`input-spare-part-no-${index}`}
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  value={part.description}
                                  onChange={(e) => handleUpdateSparePartField(index, 'description', e.target.value)}
                                  placeholder="Description"
                                  className="text-sm"
                                  data-testid={`input-spare-description-${index}`}
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  value={part.quantityRequired}
                                  onChange={(e) => handleUpdateSparePartField(index, 'quantityRequired', e.target.value)}
                                  placeholder="Qty"
                                  className="text-sm"
                                  data-testid={`input-spare-quantity-${index}`}
                                />
                              </td>
                              <td className="p-2 text-center text-gray-500">-</td>
                              <td className="p-2">
                                <StatusPill status="available" />
                              </td>
                              <td className="p-2">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleSaveSparePart(index)}
                                    className="h-7 px-2"
                                    data-testid={`button-save-spare-${index}`}
                                  >
                                    <Check className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleCancelEditSparePart}
                                    className="h-7 px-2"
                                    data-testid={`button-cancel-spare-${index}`}
                                  >
                                    <X className="h-4 w-4 text-red-600" />
                                  </Button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-2" data-testid={`text-spare-part-no-${index}`}>{part.partNo || '-'}</td>
                              <td className="p-2" data-testid={`text-spare-description-${index}`}>{part.description || '-'}</td>
                              <td className="p-2" data-testid={`text-spare-quantity-${index}`}>{part.quantityRequired || '-'}</td>
                              <td className="p-2 text-center" data-testid={`text-spare-rob-${index}`}>-</td>
                              <td className="p-2">
                                <span data-testid={`status-spare-${index}`}>
                                  <StatusPill status="available" />
                                </span>
                              </td>
                              {!isReadOnly && (
                                <td className="p-2">
                                  <div className="flex items-center justify-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleEditSparePart(index)}
                                      className="h-7 px-2"
                                      data-testid={`button-edit-spare-${index}`}
                                    >
                                      <Edit2 className="h-4 w-4 text-blue-600" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteSparePart(index)}
                                      className="h-7 px-2"
                                      data-testid={`button-delete-spare-${index}`}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </div>
                                </td>
                              )}
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </SectionBlock>

          {/* A3. Required Tools & Equipment */}
          <SectionBlock
            id="tools"
            number="A3"
            title="Required Tools & Equipment"
            description="Tools and equipment needed for this work order"
          >
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="bg-[#22c55e] hover:bg-[#16a34a] text-white"
                  onClick={handleAddTool}
                  disabled={isReadOnly}
                  data-testid="button-add-tool"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add tools
                </Button>
              </div>
              
              {/* Editable Tools Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-2 font-medium text-gray-700 w-[50%]">DESCRIPTION</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[20%]">QTY REQUIRED</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[15%]">ROB</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[15%]">STATUS</th>
                      {!isReadOnly && <th className="text-center p-2 font-medium text-gray-700 w-[100px]">ACTIONS</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(templateData.requiredTools || []).length === 0 ? (
                      <tr>
                        <td colSpan={isReadOnly ? 4 : 5} className="text-center p-4 text-gray-500 italic">
                          No tools added yet
                        </td>
                      </tr>
                    ) : (
                      (templateData.requiredTools || []).map((tool, index) => (
                        <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                          {editingTool === index ? (
                            <>
                              <td className="p-2">
                                <Input
                                  value={tool.toolName}
                                  onChange={(e) => handleUpdateToolField(index, 'toolName', e.target.value)}
                                  placeholder="Tool description"
                                  className="text-sm"
                                  data-testid={`input-tool-name-${index}`}
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  value={tool.quantity}
                                  onChange={(e) => handleUpdateToolField(index, 'quantity', e.target.value)}
                                  placeholder="Quantity"
                                  className="text-sm"
                                  data-testid={`input-tool-quantity-${index}`}
                                />
                              </td>
                              <td className="p-2 text-center text-gray-500">{tool.quantity || '-'}</td>
                              <td className="p-2">
                                <StatusPill status="available" />
                              </td>
                              <td className="p-2">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleSaveTool(index)}
                                    className="h-7 px-2"
                                    data-testid={`button-save-tool-${index}`}
                                  >
                                    <Check className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleCancelEditTool}
                                    className="h-7 px-2"
                                    data-testid={`button-cancel-tool-${index}`}
                                  >
                                    <X className="h-4 w-4 text-red-600" />
                                  </Button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-2" data-testid={`text-tool-name-${index}`}>{tool.toolName || '-'}</td>
                              <td className="p-2" data-testid={`text-tool-quantity-${index}`}>{tool.quantity || '-'}</td>
                              <td className="p-2 text-center" data-testid={`text-tool-rob-${index}`}>{tool.quantity || '-'}</td>
                              <td className="p-2">
                                <span data-testid={`status-tool-${index}`}>
                                  <StatusPill status="available" />
                                </span>
                              </td>
                              {!isReadOnly && (
                                <td className="p-2">
                                  <div className="flex items-center justify-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleEditTool(index)}
                                      className="h-7 px-2"
                                      data-testid={`button-edit-tool-${index}`}
                                    >
                                      <Edit2 className="h-4 w-4 text-blue-600" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteTool(index)}
                                      className="h-7 px-2"
                                      data-testid={`button-delete-tool-${index}`}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </div>
                                </td>
                              )}
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </SectionBlock>

          {/* A4. Safety Requirements */}
          <SectionBlock
            id="safety"
            number="A4"
            title="Safety Requirements"
            description="Safety requirements and permits for this work order"
          >
            <div className="space-y-3">
              {/* PPE Requirements */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1.5">Personal Protective Equipment (PPE):</h3>
                {(templateData.safetyRequirements?.ppeRequirements || []).length > 0 ? (
                  <ul className="space-y-0.5 text-sm text-gray-700 ml-4">
                    {templateData.safetyRequirements.ppeRequirements.map((req, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-[hsl(var(--primary))] mt-1.5">•</span>
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 italic ml-4">No PPE requirements specified</p>
                )}
              </div>
              
              {/* Permit Requirements */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1.5">Permits Required:</h3>
                {(templateData.safetyRequirements?.permitRequirements || []).length > 0 ? (
                  <ul className="space-y-0.5 text-sm text-gray-700 ml-4">
                    {templateData.safetyRequirements.permitRequirements.map((req, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-[hsl(var(--primary))] mt-1.5">•</span>
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 italic ml-4">No permits required</p>
                )}
              </div>
              
              {/* Other Requirements */}
              {(templateData.safetyRequirements?.otherRequirements || []).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1.5">Other Requirements:</h3>
                  <ul className="space-y-0.5 text-sm text-gray-700 ml-4">
                    {templateData.safetyRequirements.otherRequirements.map((req, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-[hsl(var(--primary))] mt-1.5">•</span>
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </SectionBlock>

          {/* A5. Work History */}
          <SectionBlock
            id="history"
            number="A5"
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
              data={(templateData.workHistory || []).map(history => ({
                date: history.completionDate || history.workDate,
                workOrder: history.woNo,
                description: '-',
                performedBy: history.performedBy,
                status: history.status?.toLowerCase() === 'completed' ? ('completed' as const) : ('postponed' as const),
                remarks: '-'
              }))}
              showActions={false}
            />
          </SectionBlock>

          {/* Part B - Work Completion Record (hidden for template mode) */}
          {resolvedMode !== 'template' && (
            <>
              <PartHeader
                id="part-b"
                label="Part B"
                title="Work Completion Record"
                description="Record details of work execution and completion"
              />
          
          {/* B1. Work Completion Record */}
          <SectionBlock
            id="completion"
            number="B1"
            title="Risk Assessment, Checklist & Remarks"
            description="Safety assessments and checklists completed"
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

          {/* B2. Document Management */}
          <SectionBlock
            id="documents"
            number="B2"
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

          {/* B3. Running Hours */}
          <SectionBlock
            id="running-hours"
            number="B3"
            title="Running Hours"
            description="Component running hours at time of work completion"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Previous Reading (RH)</Label>
                  <Input
                    value={executionData.previousReading}
                    className="text-sm bg-gray-50"
                    placeholder="Auto-filled from component"
                    disabled
                    data-testid="input-previous-reading"
                  />
                  <p className="text-xs text-gray-500">Last recorded running hours for this component</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Current Reading (RH)</Label>
                  <Input
                    type="number"
                    value={executionData.currentReading}
                    onChange={(e) => handleExecutionChange('currentReading', e.target.value)}
                    className="text-sm"
                    placeholder="Enter current running hours"
                    data-testid="input-current-reading"
                  />
                  <p className="text-xs text-gray-500">Enter running hours at work completion</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> Upon work order approval, the component's running hours will be automatically updated. 
                  For parent components, the running hours will be set to the current reading. 
                  For child components, the delta (current - previous) will be propagated to maintain hierarchy consistency.
                </p>
              </div>
            </div>
          </SectionBlock>

          {/* B4. Spare Parts Consumed */}
          <SectionBlock
            id="spare-parts-consumed"
            number="B4"
            title="Spare Parts Consumed"
            description="Record spare parts used during work order execution"
          >
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="bg-[#22c55e] hover:bg-[#16a34a] text-white"
                  onClick={() => {
                    setExecutionData(prev => ({
                      ...prev,
                      consumedSpareParts: [
                        ...prev.consumedSpareParts,
                        { partNo: '', description: '', quantityConsumed: '', location: '' as const, comments: '' }
                      ]
                    }));
                  }}
                  data-testid="button-add-consumed-spare"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Spare
                </Button>
              </div>

              {/* Spare Parts Consumed Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-2 font-medium text-gray-700 w-[15%]">PART NO.</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[25%]">DESCRIPTION</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[10%]">QTY CONSUMED</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[15%]">LOCATION</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[20%]">COMMENTS</th>
                      <th className="text-center p-2 font-medium text-gray-700 w-[10%]">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Pre-loaded spares from Part A (requiredSpareParts) */}
                    {templateData.requiredSpareParts.map((spare, index) => {
                      const consumedIndex = executionData.consumedSpareParts.findIndex(c => c.partNo === spare.partNo);
                      const consumedData = consumedIndex >= 0 ? executionData.consumedSpareParts[consumedIndex] : null;
                      const availableLocations = getAvailableLocationsForSpare(spare.partNo);
                      const autoSelectedLocation = getAutoSelectedLocation(spare.partNo);
                      const currentLocation = consumedData?.location || autoSelectedLocation || '';
                      const hasQuantityConsumed = consumedData?.quantityConsumed && parseFloat(consumedData.quantityConsumed) > 0;
                      const needsLocationSelection = hasQuantityConsumed && !currentLocation && availableLocations.length > 1;
                      
                      return (
                        <tr key={`preloaded-${index}`} className={`border-b border-gray-200 hover:bg-gray-50 ${needsLocationSelection ? 'bg-amber-50' : ''}`}>
                          <td className="p-2 text-gray-900">{spare.partNo}</td>
                          <td className="p-2 text-gray-700">{spare.description}</td>
                          <td className="p-2">
                            <Input
                              type="number"
                              value={consumedData?.quantityConsumed || ''}
                              onChange={(e) => {
                                const newValue = e.target.value;
                                setExecutionData(prev => {
                                  const consumed = [...prev.consumedSpareParts];
                                  if (consumedIndex >= 0) {
                                    consumed[consumedIndex] = {
                                      ...consumed[consumedIndex],
                                      quantityConsumed: newValue,
                                      // Auto-select location if only one available
                                      location: consumed[consumedIndex].location || autoSelectedLocation || ''
                                    };
                                  } else {
                                    consumed.push({
                                      partNo: spare.partNo,
                                      description: spare.description,
                                      quantityConsumed: newValue,
                                      location: autoSelectedLocation || '',
                                      comments: ''
                                    });
                                  }
                                  return { ...prev, consumedSpareParts: consumed };
                                });
                              }}
                              placeholder="0"
                              className="text-sm h-8"
                              data-testid={`input-consumed-qty-${spare.partNo}`}
                            />
                          </td>
                          <td className="p-2">
                            <div className="space-y-1">
                              <select
                                value={currentLocation}
                                onChange={(e) => {
                                  const newValue = e.target.value as 'Location A' | 'Location B' | '';
                                  setExecutionData(prev => {
                                    const consumed = [...prev.consumedSpareParts];
                                    if (consumedIndex >= 0) {
                                      consumed[consumedIndex] = {
                                        ...consumed[consumedIndex],
                                        location: newValue
                                      };
                                    } else {
                                      consumed.push({
                                        partNo: spare.partNo,
                                        description: spare.description,
                                        quantityConsumed: '',
                                        location: newValue,
                                        comments: ''
                                      });
                                    }
                                    return { ...prev, consumedSpareParts: consumed };
                                  });
                                }}
                                className={`w-full h-8 text-sm border rounded px-2 bg-white ${needsLocationSelection ? 'border-amber-400 ring-1 ring-amber-200' : 'border-gray-200'}`}
                                disabled={autoSelectedLocation !== null}
                                data-testid={`select-consumed-location-${spare.partNo}`}
                              >
                                {autoSelectedLocation ? (
                                  <option value={autoSelectedLocation}>{autoSelectedLocation} (only stock)</option>
                                ) : (
                                  <>
                                    <option value="">Select Location</option>
                                    {availableLocations.map(loc => (
                                      <option key={loc} value={loc}>{loc}</option>
                                    ))}
                                  </>
                                )}
                              </select>
                              {needsLocationSelection && (
                                <p className="text-xs text-amber-600">Location required</p>
                              )}
                              {autoSelectedLocation && (
                                <p className="text-xs text-gray-500">Auto-selected (single location)</p>
                              )}
                            </div>
                          </td>
                          <td className="p-2">
                            <Input
                              value={consumedData?.comments || ''}
                              onChange={(e) => {
                                const newValue = e.target.value;
                                setExecutionData(prev => {
                                  const consumed = [...prev.consumedSpareParts];
                                  if (consumedIndex >= 0) {
                                    consumed[consumedIndex] = {
                                      ...consumed[consumedIndex],
                                      comments: newValue
                                    };
                                  } else {
                                    consumed.push({
                                      partNo: spare.partNo,
                                      description: spare.description,
                                      quantityConsumed: '',
                                      location: '' as const,
                                      comments: newValue
                                    });
                                  }
                                  return { ...prev, consumedSpareParts: consumed };
                                });
                              }}
                              placeholder="Optional notes..."
                              className="text-sm h-8"
                              data-testid={`input-consumed-comments-${spare.partNo}`}
                            />
                          </td>
                          <td className="p-2 text-center text-gray-400 italic">Pre-loaded</td>
                        </tr>
                      );
                    })}

                    {/* Manually added consumed spare parts (not from Part A) */}
                    {executionData.consumedSpareParts
                      .filter(consumed => !templateData.requiredSpareParts.some(s => s.partNo === consumed.partNo))
                      .map((consumed, index) => {
                        const actualIndex = executionData.consumedSpareParts.findIndex(c => c === consumed);
                        const isEditing = editingConsumedSparePart === actualIndex;
                        
                        return (
                          <tr key={`manual-${actualIndex}`} className="border-b border-gray-200 hover:bg-gray-50">
                            {isEditing ? (
                              <>
                                <td className="p-2">
                                  <Input
                                    value={consumed.partNo}
                                    onChange={(e) => {
                                      setExecutionData(prev => {
                                        const updated = [...prev.consumedSpareParts];
                                        updated[actualIndex] = { ...updated[actualIndex], partNo: e.target.value };
                                        return { ...prev, consumedSpareParts: updated };
                                      });
                                    }}
                                    placeholder="Part number"
                                    className="text-sm h-8"
                                  />
                                </td>
                                <td className="p-2">
                                  <Input
                                    value={consumed.description}
                                    onChange={(e) => {
                                      setExecutionData(prev => {
                                        const updated = [...prev.consumedSpareParts];
                                        updated[actualIndex] = { ...updated[actualIndex], description: e.target.value };
                                        return { ...prev, consumedSpareParts: updated };
                                      });
                                    }}
                                    placeholder="Description"
                                    className="text-sm h-8"
                                  />
                                </td>
                                <td className="p-2">
                                  <Input
                                    type="number"
                                    value={consumed.quantityConsumed}
                                    onChange={(e) => {
                                      setExecutionData(prev => {
                                        const updated = [...prev.consumedSpareParts];
                                        updated[actualIndex] = { ...updated[actualIndex], quantityConsumed: e.target.value };
                                        return { ...prev, consumedSpareParts: updated };
                                      });
                                    }}
                                    placeholder="0"
                                    className="text-sm h-8"
                                  />
                                </td>
                                <td className="p-2">
                                  <select
                                    value={consumed.location || ''}
                                    onChange={(e) => {
                                      setExecutionData(prev => {
                                        const updated = [...prev.consumedSpareParts];
                                        updated[actualIndex] = { ...updated[actualIndex], location: e.target.value as 'Location A' | 'Location B' | '' };
                                        return { ...prev, consumedSpareParts: updated };
                                      });
                                    }}
                                    className="w-full h-8 text-sm border border-gray-200 rounded px-2 bg-white"
                                  >
                                    <option value="">Select Location</option>
                                    <option value="Location A">Location A</option>
                                    <option value="Location B">Location B</option>
                                  </select>
                                </td>
                                <td className="p-2">
                                  <Input
                                    value={consumed.comments}
                                    onChange={(e) => {
                                      setExecutionData(prev => {
                                        const updated = [...prev.consumedSpareParts];
                                        updated[actualIndex] = { ...updated[actualIndex], comments: e.target.value };
                                        return { ...prev, consumedSpareParts: updated };
                                      });
                                    }}
                                    placeholder="Optional notes..."
                                    className="text-sm h-8"
                                  />
                                </td>
                                <td className="p-2">
                                  <div className="flex items-center justify-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setEditingConsumedSparePart(null)}
                                      className="h-7 w-7 p-0"
                                    >
                                      <Check className="h-4 w-4 text-green-600" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setExecutionData(prev => ({
                                          ...prev,
                                          consumedSpareParts: prev.consumedSpareParts.filter((_, i) => i !== actualIndex)
                                        }));
                                        setEditingConsumedSparePart(null);
                                      }}
                                      className="h-7 w-7 p-0 text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="p-2 text-gray-900">{consumed.partNo}</td>
                                <td className="p-2 text-gray-700">{consumed.description}</td>
                                <td className="p-2 text-gray-900">{consumed.quantityConsumed}</td>
                                <td className="p-2 text-gray-700">{consumed.location || '-'}</td>
                                <td className="p-2 text-gray-700">{consumed.comments}</td>
                                <td className="p-2">
                                  <div className="flex items-center justify-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setEditingConsumedSparePart(actualIndex)}
                                      className="h-7 w-7 p-0"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setExecutionData(prev => ({
                                          ...prev,
                                          consumedSpareParts: prev.consumedSpareParts.filter((_, i) => i !== actualIndex)
                                        }));
                                      }}
                                      className="h-7 w-7 p-0 text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}

                    {templateData.requiredSpareParts.length === 0 && executionData.consumedSpareParts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center p-4 text-gray-500 italic">
                          No spare parts consumed yet. Click "Add Spare" to record consumption.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-amber-900">
                  <strong>Note:</strong> Upon work order approval, spare parts consumed will be automatically deducted from inventory. 
                  ROB (Remaining on Board) will be updated, and low-stock alerts will be triggered if inventory falls below minimum levels.
                </p>
              </div>
            </div>
          </SectionBlock>

          {/* Save Button at Bottom */}
          <div className="flex justify-end mt-6 pb-6">
            <Button
              onClick={handleSave}
              className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-bold px-12 py-2.5 h-auto text-sm shadow-md"
              data-testid="button-save-bottom"
            >
              Save
            </Button>
          </div>
            </>
          )}
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
