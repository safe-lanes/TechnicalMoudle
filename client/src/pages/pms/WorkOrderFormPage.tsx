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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
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
import { FileText, ArrowLeft, Plus, Eye, Upload, Download, Menu, Check, X, Edit2, Trash2, Link2, Paperclip, Copy } from "lucide-react";
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
import { useVessel } from "@/contexts/VesselContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useModifyMode } from "@/hooks/useModifyMode";
import { ModifyFieldWrapper } from "@/components/modify/ModifyFieldWrapper";
import { ModifyStickyFooter } from "@/components/modify/ModifyStickyFooter";
import { generateSuggestions, extractContextFromWorkOrder, type WorkOrderContext } from "@/utils/suggestionEngine";
import { FEATURES, IHM_ACTIONS } from '@/config/features';
import type { WorkOrder, WorkOrderExecution } from '@shared/schema';
import { SectionBlock } from '@/components/SectionBlock';
import { PartHeader } from '@/components/PartHeader';
import { WorkOrderDataTable } from '@/components/WorkOrderDataTable';
import { StatusPill } from '@/components/StatusPill';
import { Marker } from "@/components/Marker";

export interface HistoryWorkOrderPayload {
  template: WorkOrder;
  execution: WorkOrderExecution;
}

interface WorkOrderFormPageProps {
  mode?: 'template' | 'execution' | 'history' | 'new';
  embedded?: boolean;
  workOrderIdOverride?: string;
  onClose?: () => void;
}

const WorkOrderFormPage: React.FC<WorkOrderFormPageProps> = ({
  mode = 'execution',
  embedded = false,
  workOrderIdOverride,
  onClose
}) => {
  const { toast } = useToast();
  const { vesselId: contextVesselId } = useVessel();
  const [location, navigate] = useLocation();
  const [, params] = useRoute("/pms/work-order/:id");
  const [, newParams] = useRoute("/pms/work-order/new/:componentId");
  const workOrderIdFromUrl = params?.id;
  const workOrderId = workOrderIdOverride || workOrderIdFromUrl;
  const componentIdFromUrl = newParams?.componentId;
  
  // Determine if this is a "new job" creation flow (Add Job button)
  const isNewJobCreation = !!componentIdFromUrl;
  
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
    queryKey: [`/technical/api/jobs/${workOrderId}/context`],
    enabled: !!workOrderId && resolvedMode === 'template'
  });

  const { data: woContext, isLoading: isWoContextLoading } = useQuery({
    queryKey: [`/technical/api/work-orders/${workOrderId}/context`],
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
    queryKey: ['/technical/api/spares', vesselId],
    enabled: !!vesselId
  });

  // Fetch vessel locations for location selection in B4
  const { data: locationsResponse } = useQuery<{ success: boolean; data: Array<{ id: number; locationName: string }> }>({
    queryKey: [`/technical/api/inventory/locations/${vesselId}`],
    enabled: !!vesselId
  });
  const vesselLocations = locationsResponse?.data || [];

  // Fetch spares with inventory for stock validation
  const { data: sparesWithInventoryResponse, isLoading: isSparesInventoryLoading, isFetched: isSparesInventoryFetched, isError: isSparesInventoryError } = useQuery<{ success: boolean; data: Array<{
    spare: { id: number; partCode: string; partName: string };
    robTotal: number;
    stockStatus: string;
    locations: Array<{ locationId: number; locationName: string; qty: number }>;
  }> }>({
    queryKey: [`/technical/api/inventory/spares-with-inventory/${vesselId}`],
    enabled: !!vesselId
  });
  const sparesWithInventory = sparesWithInventoryResponse?.data || [];

  // Helper to get stock at a specific location for a part
  const getStockAtLocation = (partCode: string, locationId: number): number => {
    const spare = sparesWithInventory.find(s => s.spare.partCode === partCode);
    if (!spare) return 0;
    const loc = spare.locations.find(l => l.locationId === locationId);
    return loc?.qty || 0;
  };

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
  
  // Spare parts selection modal state
  const [isSparePartsModalOpen, setIsSparePartsModalOpen] = useState(false);
  const [linkedSpares, setLinkedSpares] = useState<Array<{
    spare: any;
    robTotal: number;
    stockStatus: string;
    locations: Array<{ locationId: number; locationName: string; qty: number }>;
    linkedComponents: any[];
    selected: boolean;
    consumeQty: string;
    selectedLocationId: number | null;
    comments: string;
  }>>([]);
  const [isLoadingSpares, setIsLoadingSpares] = useState(false);
  
  // Cache the last Calendar unit selection to preserve user choice when toggling maintenance basis
  const [lastCalendarUnit, setLastCalendarUnit] = useState('Months');
  
  // Form hydration guard - prevent late async data from overwriting user edits
  const hasUserTouchedForm = useRef(false);
  const contextLoadedOnce = useRef(false);
  
  // Approver workflow state
  const [currentWorkOrderStatus, setCurrentWorkOrderStatus] = useState<string>('');
  const [rejectionComments, setRejectionComments] = useState('');
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);
  
  // Track work order type to conditionally skip frequency validation for unplanned WOs
  const [workOrderType, setWorkOrderType] = useState<'Planned' | 'Unplanned'>('Planned');
  
  // Determine if Part A should be read-only (immutable)
  // Per PMS business rules: Part A is a "frozen snapshot" of the job template
  // Part A is read-only when:
  // 1. VIEWING an existing job template (mode=template AND has workOrderId)
  // 2. Editing ANY existing work order (has workOrderId) - Part A was frozen at creation
  // Part A is EDITABLE when:
  // 1. Creating a NEW job template via Add Job button (mode=template AND isNewJobCreation)
  // 2. Creating a new work order from scratch (no workOrderId)
  const context = workOrderContext as any;
  const isPartAReadOnly = isNewJobCreation ? false : (resolvedMode === 'template' || !!workOrderId);
  
  const isReadOnly = embedded; // Read-only in embedded mode for maintenance history viewing

  const [templateData, setTemplateData] = useState({
    woTitle: "",
    component: "",
    componentName: "",
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
    department: "",
    criticality: "",
    isActive: "Yes",
    briefWorkDescription: "",
    nextDueDate: "",
    nextDueReading: "",
    requiredSpareParts: [] as Array<{partNo: string, partCode?: string, description: string, quantityRequired: string, remarks: string}>,
    requiredTools: [] as Array<{toolName: string, quantity: string, remarks: string}>,
    safetyRequirements: {
      ppeRequirements: [] as string[],
      permitRequirements: [] as string[],
      otherRequirements: [] as string[]
    },
    workHistory: [] as Array<{woNo: string, assignedTo: string, performedBy: string, workDate: string, runDate: string, completionDate: string, status: string}>
  });

  // Store work order number from context (e.g., MKR-IN-00001.WO-2025-001)
  const [workOrderNo, setWorkOrderNo] = useState("");

  const [executionData, setExecutionData] = useState({
    woExecutionId: "",
    riskAssessment: "No",
    safetyChecklists: "No",
    operationalForms: "No",
    startDateTime: "",
    completionDateTime: "",
    dateOfCompletion: "",
    runningHours: "",
    performedBy: "",
    noOfPersons: "",
    totalTimeHours: "",
    manhours: "",
    workCarriedOut: "",
    jobExperienceNotes: "",
    previousReading: "",
    currentReading: "",
    uploadedDocuments: [] as Array<{type: string, fileName: string, fileKey: string, uploadedAt: string, uploadedBy: string}>,
    consumedSpareParts: [] as Array<{partNo: string, partCode?: string, description: string, quantityConsumed: string, location: 'Location A' | 'Location B' | '', locationId: number | null, comments: string}>,
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
  // HYDRATION GUARD: Only load context data once, and don't overwrite if user has touched the form
  useEffect(() => {
    if (workOrderContext) {
      // Skip if user has already started editing the form
      if (hasUserTouchedForm.current && contextLoadedOnce.current) {
        console.log('[WorkOrderForm] Skipping context hydration - user has touched form');
        return;
      }
      
      const context = workOrderContext as any;
      if (context.templateData) {
        // Determine the correct frequency unit based on maintenance basis
        let normalizedFrequencyUnit = context.templateData.frequencyUnit;
        const isRunningHours = context.templateData.maintenanceBasis === 'Running Hours';
        
        if (isRunningHours) {
          // Running Hours must always use Hours
          normalizedFrequencyUnit = 'Hours';
        } else if (!normalizedFrequencyUnit || normalizedFrequencyUnit === 'Hours') {
          // Calendar basis with missing or Hours unit → default to Months
          normalizedFrequencyUnit = 'Months';
        }
        
        // For Running Hours jobs, use intervalRunningHour as the frequency value
        const frequencyValue = isRunningHours
          ? (context.templateData.intervalRunningHour || context.templateData.frequencyValue || '')
          : (context.templateData.frequencyValue || '');
        
        const normalizedTemplateData = {
          ...context.templateData,
          // Map backend field names to frontend field names
          woTitle: context.templateData.woTitle || context.templateData.jobTitle || '',
          woTemplateCode: context.templateData.jobNo || context.templateData.woTemplateCode || '',
          componentName: context.templateData.componentName || '',
          componentCode: context.templateData.componentCode || context.templateData.sfiCode || '',
          // Normalize frequency value from backend to ensure it's valid
          frequencyValue: normalizeFrequencyValue(String(frequencyValue)),
          // Ensure frequency unit matches maintenance basis
          frequencyUnit: normalizedFrequencyUnit,
          // For RH jobs, store the next due RH value
          nextDueReading: context.templateData.nextDueRH || '',
          // Map other fields
          taskType: context.templateData.maintenanceType || context.templateData.taskType || 'Inspection',
          assignedTo: context.templateData.assignedTo || '',
          approver: context.templateData.approver || '',
          department: context.templateData.department || '',
          jobPriority: context.templateData.jobPriority || 'Medium',
          classRelated: context.templateData.classRelated || 'No',
          criticality: context.templateData.criticality || '',
          isActive: context.templateData.isActive || 'Yes',
          briefWorkDescription: context.templateData.briefWorkDescription || context.templateData.jobDescription || '',
          nextDueDate: context.templateData.nextDueDate || '',
          requiredSpareParts: context.templateData.requiredSpareParts || [],
          requiredTools: context.templateData.requiredTools || [],
          safetyRequirements: context.templateData.safetyRequirements || { ppeRequirements: [], permitRequirements: [], otherRequirements: [] }
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
        // PHASE 3A: Hydrate locationId for existing consumedSpareParts by matching location names
        const hydratedConsumedSpareParts = (context.executionData.consumedSpareParts || []).map((spare: any) => {
          // If locationId already present, use it
          if (spare.locationId != null && spare.locationId > 0) {
            return spare;
          }
          // Try to find locationId by matching location name (legacy data)
          if (spare.location && vesselLocations?.length > 0) {
            const matchedLocation = vesselLocations.find(
              (loc: any) => loc.locationName?.toLowerCase() === spare.location?.toLowerCase()
            );
            if (matchedLocation) {
              return { ...spare, locationId: matchedLocation.id };
            }
          }
          return spare;
        });
        
        // Determine previousReading value:
        // - For existing WOs: use saved previousReading from executionData
        // - For new WOs (no saved previousReading): use component's currentCumulativeRH as initial value
        const savedPreviousReading = context.executionData?.previousReading;
        const hasNoSavedPreviousReading = savedPreviousReading === '' || savedPreviousReading == null || savedPreviousReading === undefined;
        const fallbackPreviousReading = (hasNoSavedPreviousReading && context.component?.currentCumulativeRH != null)
          ? String(context.component.currentCumulativeRH)
          : undefined;
        
        // Single consolidated setExecutionData call to prevent React batching race conditions
        setExecutionData(prev => ({
          ...prev,
          ...context.executionData,
          consumedSpareParts: hydratedConsumedSpareParts,
          woExecutionId: prev.woExecutionId || context.executionData.woExecutionId || generateWOExecutionId(),
          // Preserve saved previousReading; only use fallback for new WOs
          // Use nullish check (not falsy) to preserve 0-hour readings correctly
          ...(fallbackPreviousReading && (context.executionData.previousReading === '' || context.executionData.previousReading == null) ? { previousReading: fallbackPreviousReading } : {})
        }));
      } else if (context.component?.currentCumulativeRH != null) {
        // No executionData at all (brand new WO) - populate previousReading from component RH
        setExecutionData(prev => ({
          ...prev,
          previousReading: String(context.component.currentCumulativeRH)
        }));
      }
      
      // Load work order number from context (for Part B display)
      if (context.workOrder?.workOrderNo || context.workOrder?.templateCode) {
        setWorkOrderNo(context.workOrder.workOrderNo || context.workOrder.templateCode);
      }
      
      // Load work order status for approval workflow
      if (context.workOrder?.status) {
        setCurrentWorkOrderStatus(context.workOrder.status);
      }
      
      // Load work order type to conditionally skip frequency validation for unplanned WOs
      // Check multiple sources: explicit workOrderType field, or infer from WO number prefix (UWO- = Unplanned)
      if (context.workOrder?.workOrderType) {
        setWorkOrderType(context.workOrder.workOrderType as 'Planned' | 'Unplanned');
      } else if (context.workOrder?.workOrderNo?.startsWith('UWO-')) {
        // Fallback: detect unplanned WO from number format (UWO-{component_code}-{year}-{increment})
        setWorkOrderType('Unplanned');
      }
      
      // Mark context as loaded once to prevent re-hydration
      contextLoadedOnce.current = true;
    }
  }, [workOrderContext, isModifyMode, setOriginalSnapshot, vesselLocations]);

  // Initialize form for new job creation (Add Job flow)
  useEffect(() => {
    if (isNewJobCreation && componentIdFromUrl) {
      // Pre-populate componentCode from URL
      setTemplateData(prev => ({
        ...prev,
        componentCode: componentIdFromUrl,
        // Set sensible defaults for new job
        maintenanceBasis: prev.maintenanceBasis || 'Calendar',
        frequencyUnit: prev.frequencyUnit || 'Months',
        taskType: prev.taskType || 'Inspection',
        jobPriority: prev.jobPriority || 'Medium',
        classRelated: prev.classRelated || 'No',
        isActive: prev.isActive || 'Yes'
      }));
    }
  }, [isNewJobCreation, componentIdFromUrl]);

  const handleTemplateChange = (field: string, value: string) => {
    // Mark form as touched by user to prevent late async data from overwriting
    hasUserTouchedForm.current = true;
    
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
    if (isReadOnly) return;
    const newPart = { partNo: "", description: "", quantityRequired: "", remarks: "" };
    setTemplateData(prev => ({
      ...prev,
      requiredSpareParts: [...prev.requiredSpareParts, newPart]
    }));
    setOriginalSparePart(null); // New parts have no original state
    setEditingSparePart(templateData.requiredSpareParts.length);
  };

  // Fetch and open spare parts selection modal for Section B4
  const handleOpenSparePartsModal = async () => {
    if (isReadOnly) return;
    
    const componentCode = templateData.componentCode;
    if (!componentCode) {
      toast({
        title: "Component Code Required",
        description: "Please select a component code first before adding spare parts.",
        variant: "destructive"
      });
      return;
    }
    
    if (!vesselId) {
      toast({
        title: "Vessel Required",
        description: "Vessel ID is required to fetch spare parts.",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoadingSpares(true);
    setIsSparePartsModalOpen(true);
    
    try {
      const response = await fetch(`/technical/api/inventory/spares-by-component-code/${vesselId}/${encodeURIComponent(componentCode)}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        // Initialize spares with selection state
        const sparesWithState = data.data.map((item: any) => ({
          ...item,
          selected: false,
          consumeQty: '',
          selectedLocationId: null,
          comments: ''
        }));
        setLinkedSpares(sparesWithState);
      } else {
        setLinkedSpares([]);
        toast({
          title: "No Spares Found",
          description: `No spare parts are linked to component ${componentCode}.`,
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Error fetching linked spares:', error);
      toast({
        title: "Error",
        description: "Failed to fetch spare parts for this component.",
        variant: "destructive"
      });
      setLinkedSpares([]);
    } finally {
      setIsLoadingSpares(false);
    }
  };

  // Add selected spares to consumed spare parts
  const handleAddSelectedSpares = () => {
    const selectedSpares = linkedSpares.filter(s => s.selected && s.consumeQty && parseInt(s.consumeQty) > 0);
    
    if (selectedSpares.length === 0) {
      toast({
        title: "No Spares Selected",
        description: "Please select at least one spare part with a consumption quantity.",
        variant: "destructive"
      });
      return;
    }
    
    // Validate location selection and quantities
    for (const spare of selectedSpares) {
      const qty = parseInt(spare.consumeQty);
      
      // Require location selection
      if (!spare.selectedLocationId) {
        toast({
          title: "Location Required",
          description: `Please select a location for ${spare.spare.partCode || spare.spare.partName}.`,
          variant: "destructive"
        });
        return;
      }
      
      // Validate quantity doesn't exceed stock at selected location
      const selectedLocation = spare.locations.find((l: any) => l.locationId === spare.selectedLocationId);
      const availableQty = selectedLocation ? selectedLocation.qty : 0;
      
      if (qty > availableQty) {
        toast({
          title: "Quantity Exceeds Stock",
          description: `Consumption quantity for ${spare.spare.partCode} (${qty}) exceeds available stock at ${selectedLocation?.locationName || 'selected location'} (${availableQty}).`,
          variant: "destructive"
        });
        return;
      }
    }
    
    // Add selected spares to consumedSpareParts
    const newConsumedParts = selectedSpares.map(s => {
      const selectedLocation = s.locations.find((l: any) => l.locationId === s.selectedLocationId);
      const locationName = selectedLocation?.locationName || '';
      return {
        partNo: s.spare.partCode || s.spare.partNumber || '',
        partCode: s.spare.partCode || '',
        description: s.spare.partName || '',
        quantityConsumed: s.consumeQty,
        location: (locationName === 'Location A' || locationName === 'Location B' ? locationName : '') as 'Location A' | 'Location B' | '',
        locationId: s.selectedLocationId,
        comments: s.comments
      };
    });
    
    setExecutionData(prev => ({
      ...prev,
      consumedSpareParts: [...prev.consumedSpareParts, ...newConsumedParts]
    }));
    
    setIsSparePartsModalOpen(false);
    setLinkedSpares([]);
    
    toast({
      title: "Spare Parts Added",
      description: `Added ${selectedSpares.length} spare part(s) to consumed list.`,
    });
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
    if (isReadOnly) return;
    setTemplateData(prev => ({
      ...prev,
      requiredSpareParts: prev.requiredSpareParts.filter((_, i) => i !== index)
    }));
  };

  const handleAddTool = () => {
    if (isReadOnly) return;
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
    if (isReadOnly) return;
    setTemplateData(prev => ({
      ...prev,
      requiredTools: prev.requiredTools.filter((_, i) => i !== index)
    }));
  };

  const handleAddSafetyRequirement = (category: 'ppeRequirements' | 'permitRequirements' | 'otherRequirements') => {
    if (isReadOnly) return;
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
    if (isReadOnly) return;
    setTemplateData(prev => ({
      ...prev,
      safetyRequirements: {
        ...prev.safetyRequirements,
        [category]: prev.safetyRequirements[category].filter((_, i) => i !== index)
      }
    }));
  };

  const handleUploadDocument = async (documentType: string, fileInputRef: React.RefObject<HTMLInputElement>) => {
    if (isReadOnly) return;
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>, documentType: string) => {
    if (isReadOnly) return;
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);

      const response = await fetch('/technical/api/upload-document', {
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
      const response = await fetch(`/technical/api/documents/${fileKeyEncoded}`);
      
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
    if (isReadOnly) return;
    const document = executionData.uploadedDocuments.find(doc => doc.type === documentType);
    if (!document) return;

    setDocumentToDelete({ type: documentType, fileKey: document.fileKey });
    setDeleteDocumentDialogOpen(true);
  };

  const handleDeleteDocumentConfirm = async () => {
    if (isReadOnly) return;
    if (!documentToDelete) return;

    try {
      const fileKeyEncoded = encodeURIComponent(documentToDelete.fileKey.substring(1));
      const response = await fetch(`/technical/api/documents/${fileKeyEncoded}`, {
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
    if (isReadOnly) return;
    const newPart = { partNo: "", description: "", quantityConsumed: "", location: "" as const, locationId: null, comments: "" };
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
    if (isReadOnly) return;
    setExecutionData(prev => ({
      ...prev,
      consumedSpareParts: prev.consumedSpareParts.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    if (embedded) return;
    try {
      // Skip frequency validation for unplanned work orders
      // Unplanned WOs are single-execution tasks without frequency requirements
      const isUnplannedWO = workOrderType === 'Unplanned';
      
      if (!isUnplannedWO) {
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
      }

      // PHASE 3A: Block submission if inventory data not loaded or failed and spares are being consumed
      const hasConsumedSpares = executionData.consumedSpareParts.some(
        spare => spare.partNo && spare.quantityConsumed && parseFloat(spare.quantityConsumed) > 0
      );
      if (hasConsumedSpares && vesselId) {
        if (!isSparesInventoryFetched) {
          toast({
            title: "Loading Inventory Data",
            description: "Please wait for inventory data to load before submitting.",
            variant: "destructive",
          });
          return;
        }
        if (isSparesInventoryError) {
          toast({
            title: "Inventory Data Error",
            description: "Failed to load inventory data. Stock validation cannot be performed. Please try again.",
            variant: "destructive",
          });
          return;
        }
      }

      // PHASE 3A: Validate spare parts consumed - locationId must be selected for inventory-tracked items
      // Use partCode for inventory matching (not partNo - they are separate fields)
      const sparesWithMissingLocation = executionData.consumedSpareParts.filter(spare => {
        const hasQuantity = spare.quantityConsumed && parseFloat(spare.quantityConsumed) > 0;
        if (!hasQuantity) return false;
        
        // Check if this spare exists in inventory using partCode (primary) or partNo (fallback)
        const lookupKey = spare.partCode || spare.partNo;
        const isInInventory = lookupKey && sparesWithInventory.some(s => s.spare.partCode === lookupKey);
        if (!isInInventory) return false; // Skip validation for manual entries not in inventory
        
        const hasLocationId = spare.locationId != null && spare.locationId > 0;
        return !hasLocationId;
      });

      if (sparesWithMissingLocation.length > 0) {
        const missingParts = sparesWithMissingLocation.map(s => s.partNo || s.description).join(', ');
        toast({
          title: "Location Required",
          description: `Please select a location for: ${missingParts}. Location selection is required for inventory tracking.`,
          variant: "destructive",
        });
        return;
      }

      // PHASE 3A: Validate stock availability at selected locations (only for inventory-tracked items)
      // Use partCode for inventory matching (not partNo - they are separate fields)
      const sparesWithInsufficientStock = executionData.consumedSpareParts.filter(spare => {
        const qty = parseFloat(spare.quantityConsumed);
        if (!qty || qty <= 0 || !spare.locationId) return false;
        
        // Only validate stock for items in inventory using partCode (primary) or partNo (fallback)
        const lookupKey = spare.partCode || spare.partNo;
        const isInInventory = lookupKey && sparesWithInventory.some(s => s.spare.partCode === lookupKey);
        if (!isInInventory) return false;
        
        const stockAtLocation = getStockAtLocation(lookupKey, spare.locationId);
        return qty > stockAtLocation;
      });

      if (sparesWithInsufficientStock.length > 0) {
        const insufficientParts = sparesWithInsufficientStock.map(s => {
          const lookupKey = s.partCode || s.partNo;
          const stockAtLoc = getStockAtLocation(lookupKey, s.locationId!);
          return `${s.partNo || s.partCode} (need ${s.quantityConsumed}, have ${stockAtLoc})`;
        }).join(', ');
        toast({
          title: "Insufficient Stock",
          description: `Not enough stock at selected locations: ${insufficientParts}`,
          variant: "destructive",
        });
        return;
      }
      
      // Check if Part B has completion data (indicates work is done and needs approval)
      const hasCompletionData = !!(executionData.completionDateTime || executionData.dateOfCompletion);
      
      // Validate running hours if completion data is present
      // Note: The form uses "currentReading" field for running hours input (B3 section)
      // We check both executionData.runningHours and executionData.currentReading for backwards compatibility
      const runningHoursValue = executionData.currentReading || executionData.runningHours;
      
      // Validate that currentReading is not less than previousReading (running hours can only increase)
      if (runningHoursValue && executionData.previousReading) {
        const currentRH = parseFloat(runningHoursValue);
        const previousRH = parseFloat(executionData.previousReading);
        
        if (!isNaN(currentRH) && !isNaN(previousRH) && currentRH < previousRH) {
          toast({
            title: "Validation Error",
            description: `Current Reading (${currentRH}) cannot be less than Previous Reading (${previousRH}). Running hours can only increase.`,
            variant: "destructive",
          });
          return;
        }
      }
      
      if (hasCompletionData) {
        if ((workOrderContext as any)?.maintenanceBasis === 'Running Hours' && !runningHoursValue) {
          toast({
            title: "Validation Error",
            description: "Running hours is required for RH-based maintenance when submitting for approval",
            variant: "destructive",
          });
          return;
        }
        
        if (runningHoursValue && workOrderContext && (workOrderContext as any).component) {
          const { component, rhMasterComponent } = workOrderContext as any;
          const newRunningHours = parseInt(runningHoursValue);
          
          if (isNaN(newRunningHours)) {
            toast({
              title: "Validation Error",
              description: "Running hours must be a valid number",
              variant: "destructive",
            });
            return;
          }
          
          // For INHERITED components, validate RH against master component
          // Inherited components can NEVER have RH greater than their master component
          const counterType = (component.rhCounterType || '').toUpperCase();
          if (counterType === 'INHERITED' && rhMasterComponent) {
            const masterRH = parseFloat(rhMasterComponent.currentCumulativeRH);
            if (!isNaN(masterRH) && newRunningHours > masterRH) {
              toast({
                title: "Running Hours Exceeds Master",
                description: `Running hours (${newRunningHours}) cannot exceed master component "${rhMasterComponent.name}" (${rhMasterComponent.componentCode}) running hours of ${masterRH}. Please update the master component's running hours in the Running Hours module first.`,
                variant: "destructive",
              });
              return;
            }
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
      
      // FIXED: When saving Part B with completion data, set status to "Pending Approval"
      // The work order should NOT go directly to "Completed" - it requires approval first
      // Only the approver can change status to "Completed" via the Approve action
      let response;
      
      // Ensure runningHours is set from currentReading for backend compatibility
      const saveExecutionData = {
        ...executionData,
        // Sync runningHours with currentReading for backend storage
        runningHours: runningHoursValue || executionData.runningHours
      };
      
      response = await fetch(`/technical/api/work-orders/${workOrderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...templateData,
          ...saveExecutionData,
          // If completion data is filled, set status to "Pending Approval"
          // Otherwise keep current status (likely "Active" or "Due")
          status: hasCompletionData ? 'Pending Approval' : undefined
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save work order');
      }
      
      // Invalidate all work orders-related caches so the updated status is reflected
      // This includes the list (with any vesselId variants) and the specific work order context
      await queryClient.invalidateQueries({ queryKey: ['/technical/api/work-orders'] });
      await queryClient.invalidateQueries({ queryKey: [`/technical/api/work-orders/${workOrderId}/context`] });
      
      toast({
        title: "Success",
        description: hasCompletionData 
          ? "Work order submitted for approval" 
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

  // Save handler for creating a new job template (Add Job flow)
  const handleSaveNewJob = async () => {
    if (embedded) return;
    try {
      // Validate required fields for new job
      if (!templateData.woTitle?.trim()) {
        toast({
          title: "Validation Error",
          description: "Job Title is required",
          variant: "destructive",
        });
        return;
      }
      
      if (!templateData.componentCode?.trim()) {
        toast({
          title: "Validation Error",
          description: "Component Code is required",
          variant: "destructive",
        });
        return;
      }
      
      // Validate frequency value
      const normalizedFrequency = normalizeFrequencyValue(templateData.frequencyValue);
      if (!normalizedFrequency) {
        toast({
          title: "Validation Error",
          description: "Frequency value is required. Please enter a positive whole number.",
          variant: "destructive",
        });
        return;
      }
      
      // Use componentCode as componentId (they are often the same in this system)
      // componentName defaults to componentCode if not provided
      const componentId = templateData.componentCode;
      const componentName = templateData.componentName || templateData.componentCode;
      
      // Generate a unique job number (format: JOB-XXXXXXX)
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 5).toUpperCase();
      const jobNo = `JOB-${timestamp}${random}`;
      
      // Build job payload matching the jobs schema
      // Note: All fields are strings as per the schema (frequencyValue is text type)
      const jobPayload = {
        vesselId: contextVesselId,
        componentId: componentId,
        componentCode: templateData.componentCode,
        componentName: componentName,
        jobNo: jobNo,
        jobTitle: templateData.woTitle,
        maintenanceBasis: templateData.maintenanceBasis,
        frequencyValue: normalizedFrequency, // Keep as string
        frequencyUnit: templateData.frequencyUnit,
        maintenanceType: templateData.taskType,
        assignedTo: templateData.assignedTo || null,
        approver: templateData.approver || null,
        jobPriority: templateData.jobPriority,
        classRelated: templateData.classRelated,
        department: templateData.department || null,
        briefWorkDescription: templateData.briefWorkDescription || null,
        jobDescription: templateData.briefWorkDescription || null,
        nextDueDate: templateData.nextDueDate || null,
        nextDueRH: templateData.nextDueReading || null,
        requiredSpareParts: templateData.requiredSpareParts || [],
        requiredTools: templateData.requiredTools || [],
        safetyRequirements: templateData.safetyRequirements || {ppeRequirements: [], permitRequirements: [], otherRequirements: []},
        isActive: templateData.isActive === 'Yes',
        dataScope: 'vessel', // Jobs created from UI are vessel-specific
      };
      
      const response = await apiRequest('POST', '/technical/api/jobs', jobPayload);
      const result = await response.json();
      
      // Invalidate jobs cache so the new job appears in the list
      queryClient.invalidateQueries({ queryKey: ['/technical/api/jobs'] });
      
      toast({
        title: "Success",
        description: "New job created successfully",
      });
      
      // Navigate back to components page
      navigate("/pms/components");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create job",
        variant: "destructive",
      });
    }
  };

  // Approver actions
  const handleApprove = async () => {
    if (embedded) return;
    if (!workOrderId) return;
    
    // Use the actual completion date entered by the user (from execution data)
    // Priority: completionDateTime > dateOfCompletion > undefined (let backend handle)
    // Keep full ISO timestamp - do not trim to preserve time information
    const actualCompletionDate = executionData.completionDateTime || executionData.dateOfCompletion || undefined;
    
    setIsProcessingApproval(true);
    try {
      const payload: Record<string, any> = {
        status: 'Completed',
        approvalAction: 'approved'
      };
      
      // Only set dateCompleted if we have an actual completion date from the form
      if (actualCompletionDate) {
        payload.dateCompleted = actualCompletionDate;
      }
      
      const response = await fetch(`/technical/api/work-orders/${workOrderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to approve work order');
      }
      
      setCurrentWorkOrderStatus('Completed');
      toast({
        title: "Approved",
        description: "Work order has been approved and marked as completed",
      });
      navigate("/pms/work-orders");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve work order",
        variant: "destructive",
      });
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const handleReject = async () => {
    if (embedded) return;
    if (!workOrderId) return;
    
    if (!rejectionComments.trim()) {
      toast({
        title: "Rejection Comments Required",
        description: "Please provide rejection comments before rejecting the work order",
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessingApproval(true);
    try {
      const response = await fetch(`/technical/api/work-orders/${workOrderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'Rejected',
          approvalAction: 'rejected',
          rejectionComments: rejectionComments
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to reject work order');
      }
      
      setCurrentWorkOrderStatus('Rejected');
      // Invalidate work orders cache so the list shows updated data
      queryClient.invalidateQueries({ queryKey: ['/technical/api/work-orders'] });
      toast({
        title: "Rejected",
        description: "Work order has been rejected",
      });
      navigate("/pms/work-orders");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject work order",
        variant: "destructive",
      });
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const handleBack = () => {
    if (embedded && onClose) {
      onClose();
    } else {
      navigate("/pms/work-orders");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Read-only mode banner for embedded viewing - scrolls with content */}
      {isReadOnly && (
        <div className="sticky top-0 z-50 bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-amber-800 font-medium">
            Read-only view of completed work order
          </span>
          <Button
            onClick={onClose}
            size="sm"
            variant="outline"
            className="border-amber-600 text-amber-700 hover:bg-amber-100"
          >
            Close Viewer
          </Button>
        </div>
      )}
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
                data-testid="WOF2"
              >
                <Marker id="WOF2" />
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
              <div className="flex flex-col">
                <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate" data-testid="WOF1">
                  <Marker id="WOF1" />
                  {isNewJobCreation ? 'Job Form' : 'Work Order Form'}
                </h1>
                {!isNewJobCreation && workOrderNo && (
                  <span className="text-sm text-blue-600 font-medium" data-testid="WOF-wo-number">
                    {workOrderNo}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsWorkInstructionsOpen(true)}
                className="border-[hsl(var(--primary))] text-[hsl(var(--primary))] hover:bg-blue-50 font-medium px-4 h-9"
                data-testid="WOF5"
              >
                <Marker id="WOF5" />
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
            <div data-testid="WOF3"><Marker id="WOF3" /></div>
            <PartHeader
              id="part-a"
              label="Part A"
              title="Job Details"
              description="Work details about this work order"
            />
            <div data-testid="WOF.AA"><Marker id="WOF.AA" /></div>
            <div data-testid="WOF.A"><Marker id="WOF.A" /></div>
            
            {/* A1. Job Information */}
            <div data-testid="WOF.A1.1"><Marker id="WOF.A1.1" /></div>
            <div data-testid="WOF.A1.2"><Marker id="WOF.A1.2" /></div>
            <SectionBlock 
              id="work-order-info"
              number="A1"
              title="Job Information" 
              description="Basic details and configuration for this work order"
            >
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]" data-testid="WOF.A1.3"><Marker id="WOF.A1.3" />Job Title</Label>
                  <Input
                    value={templateData.woTitle}
                    onChange={(e) => handleTemplateChange('woTitle', e.target.value)}
                    className="text-sm"
                    placeholder="Enter job title"
                    disabled={isPartAReadOnly}
                    data-testid="WOF.A1.4"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]" data-testid="WOF.A1.5"><Marker id="WOF.A1.5" />Component Name</Label>
                  <Input
                    value={templateData.componentName || templateData.component}
                    onChange={(e) => handleTemplateChange('componentName', e.target.value)}
                    className="text-sm"
                    placeholder="Enter component"
                    disabled={isPartAReadOnly}
                    data-testid="WOF.A1.6"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]" data-testid="WOF.A1.7"><Marker id="WOF.A1.7" />Component Code</Label>
                  <Input
                    value={templateData.componentCode}
                    onChange={(e) => handleTemplateChange('componentCode', e.target.value)}
                    className="text-sm"
                    placeholder="Enter component code"
                    disabled={isPartAReadOnly}
                    data-testid="WOF.A1.8"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]" data-testid="WOF.A1.9"><Marker id="WOF.A1.9" />Job Code</Label>
                  <Input
                    value={templateData.woTemplateCode}
                    onChange={(e) => handleTemplateChange('woTemplateCode', e.target.value)}
                    className="text-sm"
                    placeholder="Auto-generated"
                    disabled={isPartAReadOnly}
                    data-testid="WOF.A1.10"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]" data-testid="WOF.A1.11"><Marker id="WOF.A1.11" />Maintenance Basis</Label>
                  <Select
                    value={templateData.maintenanceBasis}
                    onValueChange={(value) => handleTemplateChange('maintenanceBasis', value)}
                    disabled={isPartAReadOnly}
                  >
                    <SelectTrigger className="text-sm" data-testid="WOF.A1.12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Calendar">Calendar</SelectItem>
                      <SelectItem value="Running Hours">Running Hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]" data-testid="WOF.A1.13"><Marker id="WOF.A1.13" />Frequency</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="1"
                      value={templateData.frequencyValue}
                      onChange={(e) => handleTemplateChange('frequencyValue', e.target.value)}
                      className="text-sm flex-1"
                      placeholder="Value"
                      disabled={isPartAReadOnly}
                      data-testid="WOF.A1.14"
                    />
                    <Select
                      value={templateData.maintenanceBasis === 'Running Hours' ? 'Hours' : templateData.frequencyUnit}
                      onValueChange={(value) => handleTemplateChange('frequencyUnit', value)}
                      disabled={isPartAReadOnly || templateData.maintenanceBasis === 'Running Hours'}
                    >
                      <SelectTrigger className="text-sm w-32" data-testid="WOF.A1.15">
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
                  <Label className="text-sm text-[#8798ad]" data-testid="WOF.A1.16"><Marker id="WOF.A1.16" />Task Type</Label>
                  <Select
                    value={templateData.taskType}
                    onValueChange={(value) => handleTemplateChange('taskType', value)}
                    disabled={isPartAReadOnly}
                  >
                    <SelectTrigger className="text-sm" data-testid="WOF.A1.17">
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
                  <Label className="text-sm text-[#8798ad]" data-testid="WOF.A1.18"><Marker id="WOF.A1.18" />Assigned To (Rank)</Label>
                  <Select
                    value={templateData.assignedTo}
                    onValueChange={(value) => handleTemplateChange('assignedTo', value)}
                    disabled={isPartAReadOnly}
                  >
                    <SelectTrigger className="text-sm" data-testid="WOF.A1.19">
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
                  <Label className="text-sm text-[#8798ad]" data-testid="WOF.A1.20"><Marker id="WOF.A1.20" />Approver (Rank)</Label>
                  <Select
                    value={templateData.approver}
                    onValueChange={(value) => handleTemplateChange('approver', value)}
                    disabled={isPartAReadOnly}
                  >
                    <SelectTrigger className="text-sm" data-testid="WOF.A1.21">
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
                  <Label className="text-sm text-[#8798ad]" data-testid="WOF.A1.22"><Marker id="WOF.A1.22" />Job Priority</Label>
                  <Select
                    value={templateData.jobPriority}
                    onValueChange={(value) => handleTemplateChange('jobPriority', value)}
                    disabled={isPartAReadOnly}
                  >
                    <SelectTrigger className="text-sm" data-testid="WOF.A1.23">
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
                  <Label className="text-sm text-[#8798ad]" data-testid="WOF.A1.24"><Marker id="WOF.A1.24" />Class Related</Label>
                  <Select
                    value={templateData.classRelated}
                    onValueChange={(value) => handleTemplateChange('classRelated', value)}
                    disabled={isPartAReadOnly}
                  >
                    <SelectTrigger className="text-sm" data-testid="WOF.A1.25">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Conditional Next Due field based on Maintenance Basis */}
                {templateData.maintenanceBasis === 'Running Hours' ? (
                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]" data-testid="WOF.A1.26"><Marker id="WOF.A1.26" />Next Due RH</Label>
                    <Input
                      type="text"
                      value={templateData.nextDueReading ? `${templateData.nextDueReading} Hours` : '-'}
                      className="text-sm bg-gray-50"
                      disabled={true}
                      data-testid="WOF.A1.27"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]" data-testid="WOF.A1.26"><Marker id="WOF.A1.26" />Next Due Date</Label>
                    <Input
                      type="date"
                      value={templateData.nextDueDate}
                      onChange={(e) => handleTemplateChange('nextDueDate', e.target.value)}
                      className="text-sm"
                      disabled={isPartAReadOnly}
                      data-testid="WOF.A1.27"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]" data-testid="WOF.A1.28"><Marker id="WOF.A1.28" />Department</Label>
                  <Input
                    value={templateData.department}
                    onChange={(e) => handleTemplateChange('department', e.target.value)}
                    className="text-sm"
                    placeholder="Enter department"
                    disabled={isPartAReadOnly}
                    data-testid="WOF.A1.29"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]" data-testid="WOF.A1.30"><Marker id="WOF.A1.30" />Criticality</Label>
                  <Select
                    value={templateData.criticality}
                    onValueChange={(value) => handleTemplateChange('criticality', value)}
                    disabled={isPartAReadOnly}
                  >
                    <SelectTrigger className="text-sm" data-testid="WOF.A1.31">
                      <SelectValue placeholder="Select criticality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]" data-testid="WOF.A1.32"><Marker id="WOF.A1.32" />Is Active</Label>
                  <Select
                    value={templateData.isActive}
                    onValueChange={(value) => handleTemplateChange('isActive', value)}
                    disabled={isPartAReadOnly}
                  >
                    <SelectTrigger className="text-sm" data-testid="WOF.A1.33">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-[#8798ad]" data-testid="WOF.A1.34"><Marker id="WOF.A1.34" />Brief Work Description</Label>
                <Textarea
                  value={templateData.briefWorkDescription}
                  onChange={(e) => handleTemplateChange('briefWorkDescription', e.target.value)}
                  className="text-sm min-h-[80px]"
                  placeholder="Describe what this job is to do for the manufacturer/builder guidance (e.g. Lubricate, Clean, Change Oil, etc.)"
                  disabled={isPartAReadOnly}
                  data-testid="WOF.A1.35"
                />
              </div>
            </div>
          </SectionBlock>

          {/* A2. Required Spare Parts */}
          <div data-testid="WOF.A2.1"><Marker id="WOF.A2.1" /></div>
          <div data-testid="WOF.A2.2"><Marker id="WOF.A2.2" /></div>
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
                  disabled={isPartAReadOnly}
                  data-testid="WOF.A2.16"
                >
                  <Marker id="WOF.A2.16" />
                  <Plus className="h-4 w-4 mr-1" />
                  Add spares
                </Button>
              </div>
              
              {/* Editable Spare Parts Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-2 font-medium text-gray-700 w-[20%]" data-testid="WOF.A2.3"><Marker id="WOF.A2.3" />PART NO.</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[40%]" data-testid="WOF.A2.4"><Marker id="WOF.A2.4" />DESCRIPTION</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[15%]" data-testid="WOF.A2.5"><Marker id="WOF.A2.5" />QTY REQUIRED</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[10%]" data-testid="WOF.A2.6"><Marker id="WOF.A2.6" />ROB</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[15%]" data-testid="WOF.A2.7"><Marker id="WOF.A2.7" />STATUS</th>
                      {!isReadOnly && <th className="text-center p-2 font-medium text-gray-700 w-[100px]" data-testid="WOF.A2.8"><Marker id="WOF.A2.8" />ACTIONS</th>}
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
                      (templateData.requiredSpareParts || []).map((part: any, index) => {
                        // ROB lookup: Use partCode for inventory lookup (not partNo)
                        // partCode is the reliable identifier for spare inventory matching
                        const lookupKey = part.partCode || '';
                        const inventoryMatch = lookupKey ? sparesWithInventory.find(s => s.spare.partCode === lookupKey) : null;
                        const robValue = inventoryMatch ? inventoryMatch.robTotal : (part.rob !== null && part.rob !== undefined ? part.rob : null);
                        const qtyRequired = parseInt(part.quantityRequired) || 0;
                        const isAvailable = robValue !== null && robValue >= qtyRequired;
                        const isLowStock = robValue !== null && robValue > 0 && robValue < qtyRequired;
                        const stockStatus = robValue === null ? 'unknown' : isAvailable ? 'available' : isLowStock ? 'low' : 'unavailable';
                        
                        return (
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
                                <td className="p-2 text-center text-gray-500">{robValue !== null ? robValue : '-'}</td>
                                <td className="p-2">
                                  <StatusPill status={stockStatus} />
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
                                <td className="p-2 text-center" data-testid={`text-spare-rob-${index}`}>{robValue !== null ? robValue : '-'}</td>
                                <td className="p-2">
                                  <span data-testid={`status-spare-${index}`}>
                                    <StatusPill status={stockStatus} />
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
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </SectionBlock>

          {/* A3. Required Tools & Equipment */}
          <div data-testid="WOF.A3.1"><Marker id="WOF.A3.1" /></div>
          <div data-testid="WOF.A3.2"><Marker id="WOF.A3.2" /></div>
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
                  disabled={isPartAReadOnly}
                  data-testid="WOF.A3.14"
                >
                  <Marker id="WOF.A3.14" />
                  <Plus className="h-4 w-4 mr-1" />
                  Add tools
                </Button>
              </div>
              
              {/* Editable Tools Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-2 font-medium text-gray-700 w-[50%]" data-testid="WOF.A3.3"><Marker id="WOF.A3.3" />DESCRIPTION</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[20%]" data-testid="WOF.A3.4"><Marker id="WOF.A3.4" />QTY REQUIRED</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[15%]" data-testid="WOF.A3.5"><Marker id="WOF.A3.5" />ROB</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[15%]" data-testid="WOF.A3.6"><Marker id="WOF.A3.6" />STATUS</th>
                      {!isReadOnly && <th className="text-center p-2 font-medium text-gray-700 w-[100px]" data-testid="WOF.A3.7"><Marker id="WOF.A3.7" />ACTIONS</th>}
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
          <div data-testid="WOF.A4.1"><Marker id="WOF.A4.1" /></div>
          <div data-testid="WOF.A4.2"><Marker id="WOF.A4.2" /></div>
          <SectionBlock
            id="safety"
            number="A4"
            title="Safety Requirements"
            description="Safety requirements and permits for this work order"
          >
            <div className="space-y-3" data-testid="WOF.A4.3"><Marker id="WOF.A4.3" />
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
          <div data-testid="WOF.A5.1"><Marker id="WOF.A5.1" /></div>
          <div data-testid="WOF.A5.2"><Marker id="WOF.A5.2" /></div>
          <SectionBlock
            id="history"
            number="A5"
            title="Work History"
            description="Previous executions and completion history for this work order"
          >
            <div className="flex flex-wrap gap-1 mb-2">
              <span data-testid="WOF.A5.3"><Marker id="WOF.A5.3" /></span>
              <span data-testid="WOF.A5.4"><Marker id="WOF.A5.4" /></span>
              <span data-testid="WOF.A5.5"><Marker id="WOF.A5.5" /></span>
              <span data-testid="WOF.A5.6"><Marker id="WOF.A5.6" /></span>
              <span data-testid="WOF.A5.7"><Marker id="WOF.A5.7" /></span>
              <span data-testid="WOF.A5.8"><Marker id="WOF.A5.8" /></span>
            </div>
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
              <div data-testid="WOF.B"><Marker id="WOF.B" /></div>
              <PartHeader
                id="part-b"
                label="Part B"
                title="Work Completion Record"
                description="Enter work completion details here including Risk assessment, checklists, comments etc."
              />
          
          {/* B1. Risk Assessment, Checklists & Records */}
          <div data-testid="WOF.B1.1"><Marker id="WOF.B1.1" /></div>
          <div data-testid="WOF.B1.2"><Marker id="WOF.B1.2" /></div>
          <SectionBlock
            id="completion"
            number="B1"
            title="Risk Assessment, Checklists & Records"
          >
            <div className="space-y-4">
              {/* B1.1 Risk Assessment */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100" data-testid="WOF.B1.3"><Marker id="WOF.B1.3" />
                <Label className="text-sm text-gray-700" data-testid="WOF.B1.4"><Marker id="WOF.B1.4" />B1.1 Risk Assessment Completed / Reviewed:</Label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        name="riskAssessment" 
                        value="Yes" 
                        checked={executionData.riskAssessment === "Yes"}
                        onChange={(e) => handleExecutionChange('riskAssessment', e.target.value)}
                        className="text-blue-600" 
                        data-testid="WOF.B1.5"
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
                        data-testid="WOF.B1.6"
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
                        data-testid="WOF.B1.7"
                      />
                      <span className="text-sm">NA</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    {getUploadedDocument('riskAssessment') ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDocument('riskAssessment')}
                          data-testid="WOF.B1.8"
                        >
                          View
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUploadDocument('riskAssessment', riskAssessmentFileRef)}
                        data-testid="WOF.B1.9"
                      >
                        Upload
                      </Button>
                    )}
                    <input
                      ref={riskAssessmentFileRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => handleFileSelected(e, 'riskAssessment')}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Link2 className="h-4 w-4 text-gray-500" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Paperclip className="h-4 w-4 text-gray-500" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* B1.2 Safety Checklists */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100" data-testid="WOF.B1.10"><Marker id="WOF.B1.10" />
                <Label className="text-sm text-gray-700" data-testid="WOF.B1.11"><Marker id="WOF.B1.11" />B1.2 Safety Checklists Completed (As applicable):</Label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        name="safetyChecklists" 
                        value="Yes" 
                        checked={executionData.safetyChecklists === "Yes"}
                        onChange={(e) => handleExecutionChange('safetyChecklists', e.target.value)}
                        className="text-blue-600" 
                        data-testid="WOF.B1.12"
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
                        data-testid="WOF.B1.13"
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
                        data-testid="WOF.B1.14"
                      />
                      <span className="text-sm">NA</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    {getUploadedDocument('safetyChecklists') ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDocument('safetyChecklists')}
                          data-testid="WOF.B1.15"
                        >
                          View
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUploadDocument('safetyChecklists', safetyChecklistFileRef)}
                        data-testid="WOF.B1.16"
                      >
                        Upload
                      </Button>
                    )}
                    <input
                      ref={safetyChecklistFileRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => handleFileSelected(e, 'safetyChecklists')}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Link2 className="h-4 w-4 text-gray-500" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Paperclip className="h-4 w-4 text-gray-500" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* B1.3 Operational Forms */}
              <div className="flex items-center justify-between py-3" data-testid="WOF.B1.17"><Marker id="WOF.B1.17" />
                <Label className="text-sm text-gray-700" data-testid="WOF.B1.18"><Marker id="WOF.B1.18" />B1.3 Operational Forms Completed (As applicable):</Label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        name="operationalForms" 
                        value="Yes" 
                        checked={executionData.operationalForms === "Yes"}
                        onChange={(e) => handleExecutionChange('operationalForms', e.target.value)}
                        className="text-blue-600" 
                        data-testid="WOF.B1.19"
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
                        data-testid="WOF.B1.20"
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
                        data-testid="WOF.B1.21"
                      />
                      <span className="text-sm">NA</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    {getUploadedDocument('operationalForms') ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDocument('operationalForms')}
                          data-testid="button-view-operational-forms"
                        >
                          View
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUploadDocument('operationalForms', operationalFormFileRef)}
                        data-testid="button-upload-operational-forms"
                      >
                        Upload
                      </Button>
                    )}
                    <input
                      ref={operationalFormFileRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => handleFileSelected(e, 'operationalForms')}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Link2 className="h-4 w-4 text-gray-500" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Paperclip className="h-4 w-4 text-gray-500" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </SectionBlock>

          {/* B2. Details of Work Carried Out */}
          <div data-testid="WOF.B2.1"><Marker id="WOF.B2.1" /></div>
          <div data-testid="WOF.B2.2"><Marker id="WOF.B2.2" /></div>
          <SectionBlock
            id="work-details"
            number="B2"
            title="Details of Work Carried Out"
          >
            <div className="space-y-6">
              {/* B2.1 Work Duration */}
              <div data-testid="WOF.B2.3"><Marker id="WOF.B2.3" />
                <h4 className="text-sm font-medium text-gray-700 mb-4" data-testid="WOF.B2.4"><Marker id="WOF.B2.4" />B2.1 Work Duration:</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]" data-testid="WOF.B2.5"><Marker id="WOF.B2.5" />Start Date</Label>
                    <Input
                      type="date"
                      value={executionData.startDateTime ? executionData.startDateTime.split('T')[0] : ''}
                      onChange={(e) => {
                        const currentTime = executionData.startDateTime ? executionData.startDateTime.split('T')[1] || '' : '';
                        handleExecutionChange('startDateTime', currentTime ? `${e.target.value}T${currentTime}` : e.target.value);
                      }}
                      className="text-sm"
                      placeholder="dd-mm-yyyy"
                      data-testid="WOF.B2.6"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]" data-testid="WOF.B2.7"><Marker id="WOF.B2.7" />Start Time</Label>
                    <Input
                      type="text"
                      value={executionData.startDateTime ? executionData.startDateTime.split('T')[1]?.substring(0, 5) || '' : ''}
                      onChange={(e) => {
                        const currentDate = executionData.startDateTime ? executionData.startDateTime.split('T')[0] : '';
                        handleExecutionChange('startDateTime', currentDate ? `${currentDate}T${e.target.value}` : e.target.value);
                      }}
                      className="text-sm"
                      placeholder="1045"
                      data-testid="WOF.B2.8"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]" data-testid="WOF.B2.9"><Marker id="WOF.B2.9" />Completion Date</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={executionData.completionDateTime ? executionData.completionDateTime.split('T')[0] : (executionData.dateOfCompletion || '')}
                        onChange={(e) => {
                          const currentTime = executionData.completionDateTime ? executionData.completionDateTime.split('T')[1] || '' : '';
                          handleExecutionChange('completionDateTime', currentTime ? `${e.target.value}T${currentTime}` : e.target.value);
                          handleExecutionChange('dateOfCompletion', e.target.value);
                        }}
                        className="text-sm flex-1"
                        placeholder="dd-mm-yyyy"
                        data-testid="WOF.B2.10"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const startDate = executionData.startDateTime ? executionData.startDateTime.split('T')[0] : '';
                          if (startDate) {
                            const currentTime = executionData.completionDateTime ? executionData.completionDateTime.split('T')[1] || '' : '';
                            handleExecutionChange('completionDateTime', currentTime ? `${startDate}T${currentTime}` : startDate);
                            handleExecutionChange('dateOfCompletion', startDate);
                          }
                        }}
                        className="text-xs whitespace-nowrap"
                        title="Same as Start Date"
                        data-testid="button-copy-start-date"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Same as Start Date
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]" data-testid="WOF.B2.11"><Marker id="WOF.B2.11" />Completion Time</Label>
                    <Input
                      type="text"
                      value={executionData.completionDateTime ? executionData.completionDateTime.split('T')[1]?.substring(0, 5) || '' : ''}
                      onChange={(e) => {
                        const currentDate = executionData.completionDateTime ? executionData.completionDateTime.split('T')[0] : '';
                        handleExecutionChange('completionDateTime', currentDate ? `${currentDate}T${e.target.value}` : e.target.value);
                      }}
                      className="text-sm"
                      placeholder="1200"
                      data-testid="WOF.B2.12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]" data-testid="WOF.B2.13"><Marker id="WOF.B2.13" />Performed by</Label>
                    <Select
                      value={executionData.performedBy}
                      onValueChange={(value) => handleExecutionChange('performedBy', value)}
                    >
                      <SelectTrigger className="text-sm" data-testid="WOF.B2.14">
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
                    <Label className="text-sm text-[#8798ad]" data-testid="WOF.B2.15"><Marker id="WOF.B2.15" />No of Persons in the team</Label>
                    <Input
                      type="number"
                      value={executionData.noOfPersons}
                      onChange={(e) => handleExecutionChange('noOfPersons', e.target.value)}
                      className="text-sm"
                      placeholder="3"
                      data-testid="WOF.B2.16"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]" data-testid="WOF.B2.17"><Marker id="WOF.B2.17" />Total Time Taken (Hours)</Label>
                    <Input
                      type="number"
                      value={executionData.totalTimeHours}
                      onChange={(e) => handleExecutionChange('totalTimeHours', e.target.value)}
                      className="text-sm"
                      placeholder="3"
                      data-testid="WOF.B2.18"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]" data-testid="WOF.B2.19"><Marker id="WOF.B2.19" />Manhours</Label>
                    <Input
                      type="number"
                      value={executionData.manhours}
                      onChange={(e) => handleExecutionChange('manhours', e.target.value)}
                      className="text-sm"
                      placeholder="3.3"
                      data-testid="WOF.B2.20"
                    />
                  </div>
                </div>
              </div>

              {/* Work Carried Out */}
              <div className="space-y-2">
                {/* Header with Quick Input and Smart Suggestions buttons */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-[#8798ad]">Work Carried Out</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowQuickInputs(!showQuickInputs)}
                      className="h-8 px-3 text-xs font-medium border-[#17a2b8] text-[#17a2b8] hover:bg-[#17a2b8]/10 hover:text-[#17a2b8] transition-colors"
                      data-testid="button-quick-input"
                    >
                      Quick Input {showQuickInputs ? '▲' : '▼'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={toggleSmartSuggestions}
                      className="h-8 px-3 text-xs font-medium border-[#17a2b8] text-[#17a2b8] hover:bg-[#17a2b8]/10 hover:text-[#17a2b8] transition-colors"
                      data-testid="button-smart-suggestions"
                    >
                      Smart Suggestions {showSmartSuggestions ? '▲' : '▼'}
                    </Button>
                  </div>
                </div>
                
                {/* Quick Input Expandable Panel */}
                {showQuickInputs && (
                  <div className="p-3 border border-[#17a2b8]/30 rounded-lg bg-[#f0fbfc]">
                    <p className="text-xs text-gray-600 mb-2">Click to insert common phrases:</p>
                    <div className="flex flex-wrap gap-2">
                      {quickAnswers.map((phrase, index) => (
                        <Button
                          key={index}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => insertQuickText(phrase)}
                          className="h-auto py-1.5 px-3 text-xs font-normal bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 whitespace-normal text-left"
                          data-testid={`button-quick-phrase-${index}`}
                        >
                          {phrase}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Smart Suggestions Expandable Panel */}
                {showSmartSuggestions && (
                  <div className="p-3 border border-[#17a2b8]/30 rounded-lg bg-[#f0fbfc]">
                    <p className="text-xs text-gray-600 mb-2">AI-powered suggestions based on context:</p>
                    {smartSuggestions.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {smartSuggestions.map((suggestion, index) => (
                          <Button
                            key={index}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => insertSuggestion(suggestion)}
                            className="h-auto py-1.5 px-3 text-xs font-normal bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 whitespace-normal text-left"
                            data-testid={`button-smart-suggestion-${index}`}
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic">Generating suggestions based on job context...</p>
                    )}
                  </div>
                )}
                
                {/* Textarea with Upload button */}
                <div className="flex gap-2">
                  <Textarea
                    ref={workCarriedOutRef}
                    value={executionData.workCarriedOut}
                    onChange={(e) => handleExecutionChange('workCarriedOut', e.target.value)}
                    className="text-sm min-h-[100px] flex-1"
                    placeholder="Describe work carried out..."
                    data-testid="textarea-work-carried-out"
                  />
                  {/* Upload button column */}
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        toast({
                          title: "Upload",
                          description: "Document upload feature coming soon"
                        });
                      }}
                      className="h-8 px-3 text-xs font-medium border-gray-300 text-gray-600 hover:bg-gray-50"
                      data-testid="button-upload-work-carried-out"
                    >
                      Upload
                    </Button>
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <Link2 className="w-4 h-4 cursor-pointer hover:text-gray-600" />
                      <Paperclip className="w-4 h-4 cursor-pointer hover:text-gray-600" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Job Experience / Notes */}
              <div className="space-y-2" data-testid="WOF.B2.21"><Marker id="WOF.B2.21" />
                <Label className="text-sm text-[#8798ad]" data-testid="WOF.B2.22"><Marker id="WOF.B2.22" />Job Experience / Notes</Label>
                <Textarea
                  value={executionData.jobExperienceNotes}
                  onChange={(e) => handleExecutionChange('jobExperienceNotes', e.target.value)}
                  className="text-sm min-h-[80px]"
                  placeholder="Job Experience / Notes"
                  data-testid="WOF.B2.23"
                />
              </div>
            </div>
          </SectionBlock>

          {/* B3. Running Hours */}
          <div data-testid="WOF.B3.1"><Marker id="WOF.B3.1" /></div>
          <div data-testid="WOF.B3.2"><Marker id="WOF.B3.2" /></div>
          <SectionBlock
            id="running-hours"
            number="B3"
            title="Running Hours"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-[#8798ad]" data-testid="WOF.B3.3"><Marker id="WOF.B3.3" />Previous reading</Label>
                <Input
                  value={executionData.previousReading}
                  className="text-sm bg-gray-50"
                  disabled
                  data-testid="WOF.B3.4"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-[#8798ad]" data-testid="WOF.B3.5"><Marker id="WOF.B3.5" />Current Reading</Label>
                <Input
                  type="number"
                  value={executionData.currentReading}
                  onChange={(e) => handleExecutionChange('currentReading', e.target.value)}
                  className="text-sm"
                  data-testid="WOF.B3.6"
                />
              </div>
            </div>
          </SectionBlock>

          {/* B4. Spare Parts Consumed */}
          <div data-testid="WOF.B4.1"><Marker id="WOF.B4.1" /></div>
          <div data-testid="WOF.B4.2"><Marker id="WOF.B4.2" /></div>
          <SectionBlock
            id="spare-parts-consumed"
            number="B4"
            title="Spare Parts Consumed"
          >
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenSparePartsModal}
                  data-testid="WOF.B4.10"
                >
                  <Marker id="WOF.B4.10" />
                  + Add Spare Part
                </Button>
              </div>

              {/* Spare Parts Consumed Table */}
              <div className="overflow-x-auto" data-testid="WOF.B4.3"><Marker id="WOF.B4.3" />
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 font-medium text-gray-700 w-[18%]" data-testid="WOF.B4.4"><Marker id="WOF.B4.4" />Part No</th>
                      <th className="text-left py-2 font-medium text-gray-700 w-[25%]" data-testid="WOF.B4.5"><Marker id="WOF.B4.5" />Description</th>
                      <th className="text-left py-2 font-medium text-gray-700 w-[12%]" data-testid="WOF.B4.6"><Marker id="WOF.B4.6" />Qty Used</th>
                      <th className="text-left py-2 font-medium text-gray-700 w-[20%]" data-testid="WOF.B4.11"><Marker id="WOF.B4.11" />Location *</th>
                      <th className="text-left py-2 font-medium text-gray-700 w-[25%]" data-testid="WOF.B4.7"><Marker id="WOF.B4.7" />Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Pre-loaded spares from Part A (requiredSpareParts) */}
                    {templateData.requiredSpareParts.map((spare, index) => {
                      // Use partCode for inventory matching (not partNo)
                      const sparePartCode = (spare as any).partCode || '';
                      // Match consumedSpareParts by partCode first (reliable), then partNo as fallback for legacy data
                      // Avoid cross-matching: only match partNo to partNo, partCode to partCode
                      const consumedIndex = executionData.consumedSpareParts.findIndex(c => 
                        (sparePartCode && c.partCode === sparePartCode) || 
                        (!sparePartCode && spare.partNo && c.partNo === spare.partNo)
                      );
                      const consumedData = consumedIndex >= 0 ? executionData.consumedSpareParts[consumedIndex] : null;
                      const autoSelectedLocation = getAutoSelectedLocation(sparePartCode || spare.partNo);
                      
                      // Use partCode for inventory lookup (partNo is just display value)
                      const stockInfo = sparePartCode ? sparesWithInventory.find(s => s.spare.partCode === sparePartCode) : null;
                      
                      return (
                        <tr key={`preloaded-${index}`} className="border-b border-gray-100">
                          <td className="py-3 text-gray-900">{spare.partNo || '-'}</td>
                          <td className="py-3 text-gray-700">{spare.description}</td>
                          <td className="py-3">
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
                                      location: consumed[consumedIndex].location || autoSelectedLocation || ''
                                    };
                                  } else {
                                    consumed.push({
                                      partNo: spare.partNo,
                                      partCode: sparePartCode,
                                      description: spare.description,
                                      quantityConsumed: newValue,
                                      location: autoSelectedLocation || '',
                                      locationId: null,
                                      comments: ''
                                    });
                                  }
                                  return { ...prev, consumedSpareParts: consumed };
                                });
                              }}
                              className="text-sm h-8 w-20"
                              data-testid={`input-consumed-qty-${sparePartCode || spare.partNo || index}`}
                            />
                          </td>
                          <td className="py-3">
                            <Select
                              value={consumedData?.locationId?.toString() || ''}
                              onValueChange={(value) => {
                                const locationId = parseInt(value);
                                const location = vesselLocations.find(l => l.id === locationId);
                                setExecutionData(prev => {
                                  const consumed = [...prev.consumedSpareParts];
                                  if (consumedIndex >= 0) {
                                    consumed[consumedIndex] = {
                                      ...consumed[consumedIndex],
                                      locationId: locationId,
                                      location: location?.locationName as any || ''
                                    };
                                  } else {
                                    consumed.push({
                                      partNo: spare.partNo,
                                      partCode: sparePartCode,
                                      description: spare.description,
                                      quantityConsumed: '',
                                      location: location?.locationName as any || '',
                                      locationId: locationId,
                                      comments: ''
                                    });
                                  }
                                  return { ...prev, consumedSpareParts: consumed };
                                });
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs" data-testid={`select-location-${sparePartCode || spare.partNo || index}`}>
                                <SelectValue placeholder="Select location" />
                              </SelectTrigger>
                              <SelectContent>
                                {vesselLocations.length > 0 ? (
                                  vesselLocations.map((loc) => {
                                    const stockAtLoc = stockInfo?.locations.find(l => l.locationId === loc.id)?.qty || 0;
                                    return (
                                      <SelectItem key={loc.id} value={loc.id.toString()}>
                                        {loc.locationName} ({stockAtLoc} avail)
                                      </SelectItem>
                                    );
                                  })
                                ) : (
                                  <SelectItem value="none" disabled>No locations found</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-3">
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
                                      partCode: sparePartCode,
                                      description: spare.description,
                                      quantityConsumed: '',
                                      location: '' as const,
                                      locationId: null,
                                      comments: newValue
                                    });
                                  }
                                  return { ...prev, consumedSpareParts: consumed };
                                });
                              }}
                              className="text-sm h-8"
                              data-testid={`input-consumed-comments-${sparePartCode || spare.partNo || index}`}
                            />
                          </td>
                        </tr>
                      );
                    })}

                    {/* Manually added consumed spare parts (not from Part A) */}
                    {executionData.consumedSpareParts
                      .filter(consumed => !templateData.requiredSpareParts.some(s => {
                        // Match by partCode first (reliable), then partNo for legacy data
                        const reqPartCode = (s as any).partCode || '';
                        if (reqPartCode && consumed.partCode) return reqPartCode === consumed.partCode;
                        if (s.partNo && consumed.partNo) return s.partNo === consumed.partNo;
                        return false;
                      }))
                      .map((consumed, index) => {
                        const actualIndex = executionData.consumedSpareParts.findIndex(c => c === consumed);
                        const isEditing = editingConsumedSparePart === actualIndex;
                        
                        return (
                          <tr key={`manual-${actualIndex}`} className="border-b border-gray-100">
                            {isEditing ? (
                              <>
                                <td className="py-3">
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
                                    autoFocus
                                  />
                                </td>
                                <td className="py-3">
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
                                <td className="py-3">
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
                                    className="text-sm h-8 w-20"
                                    onBlur={() => setEditingConsumedSparePart(null)}
                                  />
                                </td>
                                <td className="py-3">
                                  <Select
                                    value={consumed.locationId?.toString() || ''}
                                    onValueChange={(value) => {
                                      const locationId = parseInt(value);
                                      const location = vesselLocations.find(l => l.id === locationId);
                                      setExecutionData(prev => {
                                        const updated = [...prev.consumedSpareParts];
                                        updated[actualIndex] = { 
                                          ...updated[actualIndex], 
                                          locationId: locationId,
                                          location: location?.locationName as any || ''
                                        };
                                        return { ...prev, consumedSpareParts: updated };
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {vesselLocations.map((loc) => (
                                        <SelectItem key={loc.id} value={loc.id.toString()}>
                                          {loc.locationName}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="py-3">
                                  <Input
                                    value={consumed.comments}
                                    onChange={(e) => {
                                      setExecutionData(prev => {
                                        const updated = [...prev.consumedSpareParts];
                                        updated[actualIndex] = { ...updated[actualIndex], comments: e.target.value };
                                        return { ...prev, consumedSpareParts: updated };
                                      });
                                    }}
                                    className="text-sm h-8"
                                  />
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-3 text-gray-900">{consumed.partNo || '-'}</td>
                                <td className="py-3 text-gray-700">{consumed.description || '-'}</td>
                                <td className="py-3">
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
                                    className="text-sm h-8 w-20"
                                  />
                                </td>
                                <td className="py-3">
                                  <Select
                                    value={consumed.locationId?.toString() || ''}
                                    onValueChange={(value) => {
                                      const locationId = parseInt(value);
                                      const location = vesselLocations.find(l => l.id === locationId);
                                      setExecutionData(prev => {
                                        const updated = [...prev.consumedSpareParts];
                                        updated[actualIndex] = { 
                                          ...updated[actualIndex], 
                                          locationId: locationId,
                                          location: location?.locationName as any || ''
                                        };
                                        return { ...prev, consumedSpareParts: updated };
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {vesselLocations.map((loc) => (
                                        <SelectItem key={loc.id} value={loc.id.toString()}>
                                          {loc.locationName}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="py-3">
                                  <Input
                                    value={consumed.comments}
                                    onChange={(e) => {
                                      setExecutionData(prev => {
                                        const updated = [...prev.consumedSpareParts];
                                        updated[actualIndex] = { ...updated[actualIndex], comments: e.target.value };
                                        return { ...prev, consumedSpareParts: updated };
                                      });
                                    }}
                                    className="text-sm h-8"
                                  />
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </SectionBlock>

          {/* Approval Section - Only visible for Pending Approval work orders, hidden in embedded mode */}
          {!embedded && currentWorkOrderStatus === 'Pending Approval' && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mt-4" data-testid="WOF.B5.1"><Marker id="WOF.B5.1" />
              <div className="space-y-4">
                {/* Rejection Comments */}
                <div className="space-y-2" data-testid="WOF.B5.2"><Marker id="WOF.B5.2" />
                  <Label className="text-base font-semibold text-[#17a2b8]">Rejection Comments</Label>
                  <Textarea
                    value={rejectionComments}
                    onChange={(e) => setRejectionComments(e.target.value)}
                    placeholder="Enter rejection comments..."
                    className="text-sm min-h-[100px] border-gray-200"
                    data-testid="WOF.B5.2.1"
                  />
                </div>
                
                {/* Approve / Reject Buttons */}
                <div className="flex justify-center gap-4 pt-2" data-testid="WOF.B5.3"><Marker id="WOF.B5.3" />
                  <Button
                    onClick={handleApprove}
                    disabled={isProcessingApproval}
                    className="bg-[#28a745] hover:bg-[#218838] text-white font-semibold px-8 py-2.5 h-auto text-sm rounded-full shadow-md min-w-[120px]"
                    data-testid="WOF.B5.4"
                  >
                    <Marker id="WOF.B5.4" />
                    {isProcessingApproval ? 'Processing...' : 'Approve'}
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={isProcessingApproval}
                    className="bg-[#dc3545] hover:bg-[#c82333] text-white font-semibold px-8 py-2.5 h-auto text-sm rounded-full shadow-md min-w-[120px]"
                    data-testid="WOF.B5.5"
                  >
                    <Marker id="WOF.B5.5" />
                    {isProcessingApproval ? 'Processing...' : 'Reject'}
                  </Button>
                </div>
              </div>
            </div>
          )}

            </>
          )}

          {/* Save Button at Bottom - Hidden for Pending Approval, Completed work orders, and embedded mode */}
          {!embedded && currentWorkOrderStatus !== 'Pending Approval' && currentWorkOrderStatus !== 'Completed' && (
            <div className="flex justify-end mt-6 pb-6" data-testid="WOF6"><Marker id="WOF6" />
              <Button
                onClick={isNewJobCreation ? handleSaveNewJob : handleSave}
                className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-bold px-12 py-2.5 h-auto text-sm shadow-md"
                data-testid="WOF6.1"
              >
                <Marker id="WOF6.1" />
                {isNewJobCreation ? 'Create Job' : 'Save'}
              </Button>
            </div>
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

      {/* Spare Parts Selection Modal for Section B4 */}
      <Dialog open={isSparePartsModalOpen} onOpenChange={setIsSparePartsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Spare Parts for Component: {templateData.componentCode}</DialogTitle>
            <DialogDescription>
              Select spare parts to consume and enter the quantity used from each location.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            {isLoadingSpares ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">Loading spare parts...</div>
              </div>
            ) : linkedSpares.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">No spare parts linked to this component.</div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium w-12">Select</th>
                    <th className="text-left py-2 px-2 font-medium">Part Code</th>
                    <th className="text-left py-2 px-2 font-medium">Description</th>
                    <th className="text-center py-2 px-2 font-medium">ROB Loc A</th>
                    <th className="text-center py-2 px-2 font-medium">ROB Loc B</th>
                    <th className="text-center py-2 px-2 font-medium">Total ROB</th>
                    <th className="text-left py-2 px-2 font-medium w-24">Qty to Use</th>
                    <th className="text-left py-2 px-2 font-medium w-32">From Location</th>
                    <th className="text-left py-2 px-2 font-medium">Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {linkedSpares.map((item, index) => {
                    const locA = item.locations.find(l => l.locationName === 'Location A')?.qty || item.spare.robLocationA || 0;
                    const locB = item.locations.find(l => l.locationName === 'Location B')?.qty || item.spare.robLocationB || 0;
                    
                    return (
                      <tr key={item.spare.id || index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-2 px-2">
                          <Checkbox
                            checked={item.selected}
                            onCheckedChange={(checked) => {
                              setLinkedSpares(prev => prev.map((s, i) => 
                                i === index ? { ...s, selected: !!checked } : s
                              ));
                            }}
                            data-testid={`spare-select-${index}`}
                          />
                        </td>
                        <td className="py-2 px-2 font-mono text-xs">{item.spare.partCode || item.spare.partNumber || '-'}</td>
                        <td className="py-2 px-2">{item.spare.partName || '-'}</td>
                        <td className="py-2 px-2 text-center font-medium">{locA}</td>
                        <td className="py-2 px-2 text-center font-medium">{locB}</td>
                        <td className="py-2 px-2 text-center font-semibold">{item.robTotal}</td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            min="0"
                            max={item.robTotal}
                            value={item.consumeQty}
                            onChange={(e) => {
                              setLinkedSpares(prev => prev.map((s, i) => 
                                i === index ? { ...s, consumeQty: e.target.value, selected: e.target.value ? true : s.selected } : s
                              ));
                            }}
                            className="h-8 w-20"
                            placeholder="0"
                            data-testid={`spare-qty-${index}`}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Select
                            value={item.selectedLocationId?.toString() || ''}
                            onValueChange={(value) => {
                              setLinkedSpares(prev => prev.map((s, i) => 
                                i === index ? { ...s, selectedLocationId: parseInt(value) } : s
                              ));
                            }}
                          >
                            <SelectTrigger className="h-8 w-28" data-testid={`spare-location-${index}`}>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {vesselLocations.map((loc: any) => (
                                <SelectItem key={loc.id} value={loc.id.toString()}>
                                  {loc.locationName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            value={item.comments}
                            onChange={(e) => {
                              setLinkedSpares(prev => prev.map((s, i) => 
                                i === index ? { ...s, comments: e.target.value } : s
                              ));
                            }}
                            className="h-8"
                            placeholder="Comments..."
                            data-testid={`spare-comments-${index}`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setIsSparePartsModalOpen(false)} data-testid="spare-modal-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleAddSelectedSpares} 
              disabled={!linkedSpares.some(s => s.selected && s.consumeQty)}
              data-testid="spare-modal-add"
            >
              Add Selected Spares
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkOrderFormPage;
