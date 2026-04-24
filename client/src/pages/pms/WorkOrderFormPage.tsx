import React, { useState, useEffect, useRef } from "react";
import { calculateNextDueDate, normalizeDateToDDMMMYYYY, calculateMissedCycles, formatRelativeTime, formatRHWithSeparators } from "@shared/dateUtils";
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
import { FileText, ArrowLeft, Plus, Eye, Upload, Download, Menu, Check, X, Edit2, Trash2, Copy, Loader2, Paperclip, Image as ImageIcon, FileSpreadsheet, BarChart3, AlertTriangle, CheckCircle2, Clock, ExternalLink, RefreshCw, ChevronDown } from "lucide-react";
import RHTimelineViewer from "@/components/pms/RHTimelineViewer";
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
import { useRanks, ensureRankInOptions } from "@/hooks/useRanks";
import { useVessel } from "@/contexts/VesselContext";
import { useUIRole } from "@/contexts/UIRoleContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useModifyMode } from "@/hooks/useModifyMode";
import { PeriodPicker } from "@/components/filters/PeriodPicker";
import type { PeriodValue } from "@/components/filters/PeriodPicker";
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
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";
import { RejectionHistorySection } from "@/components/wo/RejectionHistorySection";

export interface HistoryWorkOrderPayload {
  template: WorkOrder;
  execution: WorkOrderExecution;
}

interface WorkOrderFormPageProps {
  mode?: 'template' | 'execution' | 'history' | 'new' | 'unplanned-create';
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
  const { vesselId: contextVesselId, vessels } = useVessel();
  const { isVessel } = useUIRole();
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
  const isUnplannedCreate = mode === 'unplanned-create';

  const [isWorkInstructionsOpen, setIsWorkInstructionsOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isUnplannedSaving, setIsUnplannedSaving] = useState(false);
  const forceSubmitOnly = useRef(false);
  const [unplannedComponentId, setUnplannedComponentId] = useState('');

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

  const { data: woAnomalies } = useQuery<Array<{ id: number; severity: string; anomalyType: string; daysLate: number; missedCycles: number; detectedAt: string; status: string }>>({
    queryKey: ['/technical/api/anomalies/work-order', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/technical/api/anomalies/work-order/${workOrderId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!workOrderId && resolvedMode !== 'template',
  });

  // Extract vesselId from context for spares query; fall back to contextVesselId for unplanned-create (no workOrderContext yet)
  const vesselId = workOrderContext
    ? (workOrderContext as any).templateData?.vesselId || (workOrderContext as any).workOrder?.vesselId
    : (isUnplannedCreate ? contextVesselId : null);

  // Fetch spares inventory for location auto-selection in Part B4
  // IMPORTANT: Uses location/location2 and robLocationA/robLocationB from Spares table per spec
  // Query uses vesselId in path to get vessel-specific spares with live ROB data
  const { data: sparesInventory = [] } = useQuery<Array<{
    id: number;
    partCode: string;
    partName: string;
    rob: number;
    robLocationA: number;
    robLocationB: number;
    location: string | null;   // Primary location name from Spares table
    location2: string | null;  // Secondary location name from Spares table
  }>>({
    queryKey: [`/technical/api/spares/${vesselId}`],
    enabled: !!vesselId,
    staleTime: 0, // Always fetch fresh data for live ROB
    refetchOnMount: 'always'
  });

  // Fetch vessel locations for location selection in B4
  const { data: locationsResponse } = useQuery<{ success: boolean; data: Array<{ id: number; locationName: string }> }>({
    queryKey: [`/technical/api/inventory/locations/${vesselId}`],
    enabled: !!vesselId
  });
  const vesselLocations = locationsResponse?.data || [];

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
    jobCategory: "",
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
    workHistory: [] as Array<{woNo: string, assignedTo: string, performedBy: string, workDate: string, runDate: string, completionDate: string, status: string, description: string, remarks: string}>
  });

  const woDepartment = templateData?.department ||
    (workOrderContext as any)?.templateData?.department ||
    (workOrderContext as any)?.workOrder?.department || '';
  const { data: hodResolution } = useQuery<{
    resolved: boolean;
    rankName: string;
    rankId: string | null;
    department: string;
    source: string;
    mismatch: boolean;
  }>({
    queryKey: ['/technical/api/hod', vesselId, woDepartment],
    queryFn: async () => {
      const storedApprover = templateData?.approver || (workOrderContext as any)?.templateData?.approver || '';
      const url = `/technical/api/hod/${vesselId || 'none'}/${encodeURIComponent(woDepartment)}${storedApprover ? `?storedApprover=${encodeURIComponent(storedApprover)}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to resolve HOD');
      return res.json();
    },
    enabled: !!woDepartment,
    staleTime: 5 * 60 * 1000,
  });
  const hodLabel = hodResolution?.rankName || templateData?.approver || 'Head of Dept';
  const hodShort = hodLabel.includes('Chief Engineer') ? 'CE' :
    hodLabel.includes('Chief Officer') ? 'CO' :
    hodLabel.toLowerCase() === 'master' ? 'Master' :
    hodLabel.split(/\s+/).length >= 2 ? hodLabel.split(/\s+/).map(w => w[0].toUpperCase()).join('') : hodLabel;

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

  // Fetch vessel components for unplanned-create mode (component dropdown)
  const { data: unplannedComponents = [] } = useQuery<Array<{
    id: string;
    name: string;
    componentCode: string;
    isActive: boolean;
    isParent: boolean;
    currentCumulativeRH?: number;
  }>>({
    queryKey: [`/technical/api/components/${contextVesselId}`],
    enabled: isUnplannedCreate && !!contextVesselId,
  });
  const filteredUnplannedComponents = unplannedComponents.filter(c => c.isActive && !c.isParent);

  const handleUnplannedComponentSelect = (componentId: string) => {
    setUnplannedComponentId(componentId);
    const selected = filteredUnplannedComponents.find(c => c.id === componentId);
    if (selected) {
      setTemplateData(prev => ({
        ...prev,
        componentName: selected.name || '',
        component: selected.name || '',
        componentCode: selected.componentCode || '',
      }));
      if (selected.currentCumulativeRH != null) {
        setExecutionData(prev => ({ ...prev, previousReading: String(selected.currentCumulativeRH) }));
      }
    }
  };

  // Helper to get stock at a specific location for a part
  const getStockAtLocation = (partCode: string, locationId: number): number => {
    const spare = sparesWithInventory.find(s => s.spare.partCode === partCode);
    if (!spare) return 0;
    const loc = spare.locations.find(l => l.locationId === locationId);
    return loc?.qty || 0;
  };

  // Helper function to get available locations for a spare part
  // Prefers spare_location_stock data (matches backend validation), falls back to legacy ROB fields
  const getAvailableLocationsForSpare = (partCode: string): Array<{ name: string; robValue: number; field: 'location' | 'location2' }> => {
    const spare = sparesInventory.find(s => s.partCode === partCode);
    if (!spare) return [];

    const inventorySpare = sparesWithInventory.find(s => s.spare.partCode === partCode);

    const locations: Array<{ name: string; robValue: number; field: 'location' | 'location2' }> = [];
    const robA = spare.robLocationA ?? 0;
    const robB = spare.robLocationB ?? 0;

    if (spare.location) {
      let qty = robA;
      if (inventorySpare?.locations?.length) {
        const match = inventorySpare.locations.find(l => l.locationName.toLowerCase().trim() === spare.location!.toLowerCase().trim());
        if (match) qty = match.qty;
      }
      locations.push({ name: spare.location, robValue: qty, field: 'location' });
    }
    if (spare.location2) {
      let qty = robB;
      if (inventorySpare?.locations?.length) {
        const match = inventorySpare.locations.find(l => l.locationName.toLowerCase().trim() === spare.location2!.toLowerCase().trim());
        if (match) qty = match.qty;
      }
      locations.push({ name: spare.location2, robValue: qty, field: 'location2' });
    }

    return locations;
  };

  // Get ROB for a specific location field
  const getRobForLocation = (partCode: string, locationField: 'location' | 'location2'): number => {
    const spare = sparesInventory.find(s => s.partCode === partCode);
    if (!spare) return 0;
    return locationField === 'location' ? (spare.robLocationA ?? 0) : (spare.robLocationB ?? 0);
  };

  // Get location name for a specific location field
  const getLocationName = (partCode: string, locationField: 'location' | 'location2'): string | null => {
    const spare = sparesInventory.find(s => s.partCode === partCode);
    if (!spare) return null;
    return locationField === 'location' ? spare.location : spare.location2;
  };

  // Get ROB by location name for a specific spare part
  // Prefers spare_location_stock data (matches backend validation), falls back to legacy ROB fields
  const getRobByLocationName = (partCode: string, locationName: string): number => {
    const spare = sparesInventory.find(s => s.partCode === partCode);
    if (!spare || !locationName) return 0;
    
    const inventorySpare = sparesWithInventory.find(s => s.spare.partCode === partCode);
    if (inventorySpare?.locations?.length) {
      const match = inventorySpare.locations.find(l => l.locationName.toLowerCase().trim() === locationName.toLowerCase().trim());
      if (match) return match.qty;
    }
    
    if (spare.location === locationName) return spare.robLocationA ?? 0;
    if (spare.location2 === locationName) return spare.robLocationB ?? 0;
    return 0;
  };

  // Helper to check if auto-selection should be applied
  // Returns the location field ('location' or 'location2') if only one location has stock
  const getAutoSelectedLocationField = (partCode: string): 'location' | 'location2' | null => {
    const locations = getAvailableLocationsForSpare(partCode);
    // Auto-select only if exactly one location exists with stock > 0
    const locationsWithStock = locations.filter(l => l.robValue > 0);
    if (locationsWithStock.length === 1) return locationsWithStock[0].field;
    // If only one location exists (regardless of stock), auto-select it
    if (locations.length === 1) return locations[0].field;
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
  const workCarriedOutFileRef = useRef<HTMLInputElement>(null);
  const [deleteDocumentDialogOpen, setDeleteDocumentDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{type: string, fileKey: string, documentId?: string} | null>(null);
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  const [woDocuments, setWoDocuments] = useState<Array<{id: string, workOrderId: string, documentType: string, fileName: string, fileKey: string, fileType: string, fileSize: number, uploadedBy: string, uploadedAt: string}>>([]);
  const [previewDoc, setPreviewDoc] = useState<{id: string, fileName: string, fileType: string, fileSize?: number, fetchUrl?: string} | null>(null);
  const [currentReadingWarningAcknowledged, setCurrentReadingWarningAcknowledged] = useState(false);

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
    selectedLocation: string; // Location name from Spares table (location or location_2)
    comments: string;
  }>>([]);
  const [isLoadingSpares, setIsLoadingSpares] = useState(false);

  // A2 Required Spare Parts modal state
  const [isA2SpareModalOpen, setIsA2SpareModalOpen] = useState(false);
  const [a2LinkedSpares, setA2LinkedSpares] = useState<Array<{
    spare: any;
    selected: boolean;
    quantityRequired: string;
    remarks: string;
  }>>([]);
  const [isLoadingA2Spares, setIsLoadingA2Spares] = useState(false);

  // Cache the last Calendar unit selection to preserve user choice when toggling maintenance basis
  const [lastCalendarUnit, setLastCalendarUnit] = useState('Months');

  // Form hydration guard - prevent late async data from overwriting user edits
  const hasUserTouchedForm = useRef(false);
  const contextLoadedOnce = useRef(false);
  const approverManuallySet = useRef(false);
  const lastAutoFilledDept = useRef('');

  // Approver workflow state
  const [currentWorkOrderStatus, setCurrentWorkOrderStatus] = useState<string>('');
  const [rejectionComments, setRejectionComments] = useState('');
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);
  const [skippedCyclesJustification, setSkippedCyclesJustification] = useState('');
  const [ceApprovalRemarks, setCeApprovalRemarks] = useState('');

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

  const isReadOnly = embedded || currentWorkOrderStatus === 'Completed';

  const isRejectedWO = !!(context?.workOrder?.wasRejected === true && currentWorkOrderStatus !== 'Completed' && currentWorkOrderStatus !== 'Pending Approval');

  const isPartBReadOnly = isReadOnly || currentWorkOrderStatus === 'Completed' || (currentWorkOrderStatus === 'Pending Approval' && !isRejectedWO);

  useEffect(() => {
    if (
      hodResolution?.resolved &&
      hodResolution.rankName &&
      !approverManuallySet.current &&
      !isPartAReadOnly &&
      woDepartment &&
      lastAutoFilledDept.current !== woDepartment
    ) {
      lastAutoFilledDept.current = woDepartment;
      setTemplateData(prev => ({ ...prev, approver: hodResolution.rankName }));
    }
  }, [hodResolution, woDepartment, isPartAReadOnly]);

  const [workHistoryExpanded, setWorkHistoryExpanded] = useState(false);
  const [workHistoryPage, setWorkHistoryPage] = useState(0);
  const [isExportingHistoryExcel, setIsExportingHistoryExcel] = useState(false);
  const [isExportingHistoryPDF, setIsExportingHistoryPDF] = useState(false);
  const WORK_HISTORY_COLLAPSED_COUNT = 2;
  const WORK_HISTORY_PAGE_SIZE = 5;
  const [historyComponentFilter] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historyPeriod, setHistoryPeriod] = useState<PeriodValue | null>(null);

  const handleHistoryPeriodChange = (val: PeriodValue | null) => {
    setHistoryPeriod(val);
    setWorkHistoryPage(0);
    setExpandedHistoryIndex(null);
    if (!val) {
      setHistoryDateFrom('');
      setHistoryDateTo('');
      return;
    }
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (val.mode === 'yearQuarterMonth' && val.year) {
      if (val.month !== undefined) {
        const y = val.year;
        const m = val.month;
        const lastDay = new Date(y, m + 1, 0).getDate();
        setHistoryDateFrom(`${y}-${pad(m + 1)}-01`);
        setHistoryDateTo(`${y}-${pad(m + 1)}-${pad(lastDay)}`);
      } else if (val.quarter !== undefined) {
        const startMonth = (val.quarter - 1) * 3;
        const endMonth = startMonth + 2;
        const lastDay = new Date(val.year, endMonth + 1, 0).getDate();
        setHistoryDateFrom(`${val.year}-${pad(startMonth + 1)}-01`);
        setHistoryDateTo(`${val.year}-${pad(endMonth + 1)}-${pad(lastDay)}`);
      } else {
        setHistoryDateFrom(`${val.year}-01-01`);
        setHistoryDateTo(`${val.year}-12-31`);
      }
    } else if (val.mode === 'dateRange') {
      if (val.dateFrom) {
        const d = val.dateFrom;
        setHistoryDateFrom(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      } else {
        setHistoryDateFrom('');
      }
      if (val.dateTo) {
        const d = val.dateTo;
        setHistoryDateTo(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      } else {
        setHistoryDateTo('');
      }
    }
  };
  const [expandedHistoryIndex, setExpandedHistoryIndex] = useState<number | null>(null);

  const calcDaysLate = (originalDueDate: string | null | undefined, completionDate: string | null | undefined): number => {
    if (!originalDueDate || !completionDate) return 0;
    // Normalize to date-only (YYYY-MM-DD) to avoid timezone/time-of-day skew
    const dueStr = originalDueDate.slice(0, 10);
    const compStr = completionDate.slice(0, 10);
    const due = new Date(dueStr + 'T00:00:00Z');
    const completed = new Date(compStr + 'T00:00:00Z');
    if (isNaN(due.getTime()) || isNaN(completed.getTime())) return 0;
    return Math.max(0, Math.floor((completed.getTime() - due.getTime()) / 86400000));
  };

  const buildWorkHistoryForExport = () => {
    const raw = templateData.workHistory || [];
    return raw
      .filter((h: any) => {
        const dateStr = (h.isSkipped ? (h.skippedCycleDate || h.completionDate || h.workDate) : (h.completionDate || h.workDate))?.slice(0, 10) || '';
        if (historyComponentFilter && (h.componentCode || '') !== historyComponentFilter) return false;
        if (historyDateFrom && dateStr < historyDateFrom) return false;
        if (historyDateTo && dateStr > historyDateTo) return false;
        return true;
      })
      .map((h: any) => {
        if (h.isSkipped) {
          return {
            date: h.skippedCycleDate || h.completionDate || h.workDate,
            workOrder: '—',
            description: 'Cycle not performed',
            performedBy: '—',
            runDate: '—',
            status: 'SKIPPED',
            daysLate: 0,
            remarks: `Automatically recorded. See WO: ${h.sourceWorkOrderId ? h.sourceWorkOrderId.slice(-8) : '—'}`,
            missedCycles: 0,
            isSkipped: true,
          };
        }
        const daysLate = calcDaysLate(h.originalDueDate, h.completionDate || h.workDate);
        return {
          date: h.completionDate || h.workDate,
          workOrder: h.woNo || '—',
          description: h.description || '-',
          performedBy: h.performedBy || '-',
          runDate: h.runDate || '—',
          status: h.status?.toLowerCase() === 'completed' ? 'Completed' : 'Postponed',
          daysLate,
          remarks: h.remarks || '-',
          missedCycles: h.missedCycles || 0,
          isSkipped: false,
        };
      });
  };

  const handleExportWorkHistoryExcel = async () => {
    setIsExportingHistoryExcel(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = 'SAIL PMS';
      wb.created = new Date();
      const ws = wb.addWorksheet('Work History');

      const cols = [
        { key: 'date', header: 'Date', width: 16 },
        { key: 'workOrder', header: 'Work Order No', width: 24 },
        { key: 'description', header: 'Description', width: 40 },
        { key: 'performedBy', header: 'Performed By', width: 22 },
        { key: 'runDate', header: 'Running Hours', width: 16 },
        { key: 'status', header: 'Status', width: 14 },
        { key: 'daysLate', header: 'Backdating', width: 14 },
        { key: 'remarks', header: 'Remarks', width: 30 },
        { key: 'missedCycles', header: 'Missed Cycles', width: 15 },
      ];
      const totalCols = cols.length;
      const lastColLetter = String.fromCharCode('A'.charCodeAt(0) + totalCols - 1);
      ws.columns = cols.map(c => ({ key: c.key, width: c.width }));

      ws.mergeCells(`A1:${lastColLetter}1`);
      const t = ws.getCell('A1');
      t.value = 'SEAFARER TECHNICAL MANAGEMENT SYSTEM';
      t.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
      t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E5A8E' } };
      t.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 30;

      ws.mergeCells(`A2:${lastColLetter}2`);
      const s = ws.getCell('A2');
      const exportVesselName = vessels.find(v => v.id === (vesselId || contextVesselId))?.name || 'Vessel';
      const exportJobTitle = templateData.woTitle || templateData.jobTitle || '';
      s.value = `Work History — ${exportJobTitle || templateData.componentName || templateData.componentCode || 'Component'} — ${workOrderNo || 'Work Order'}`;
      s.font = { size: 12, bold: true, color: { argb: 'FF2C3E50' }, name: 'Arial' };
      s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FC' } };
      s.alignment = { horizontal: 'center', vertical: 'middle' };
      s.border = { bottom: { style: 'medium', color: { argb: 'FF1E5A8E' } } };
      ws.getRow(2).height = 25;

      ws.getRow(3).height = 8;
      const exportData = buildWorkHistoryForExport();
      ws.getCell('A4').value = `Vessel: ${exportVesselName}  |  Component: ${templateData.componentName || templateData.componentCode || '-'}`;
      ws.getCell('A4').font = { bold: true, size: 10, color: { argb: 'FF2C3E50' }, name: 'Arial' };
      ws.getCell('A4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FC' } };

      const dtCol = String.fromCharCode(lastColLetter.charCodeAt(0) - 1);
      ws.mergeCells(`${dtCol}4:${lastColLetter}4`);
      ws.getCell(`${dtCol}4`).value = `Report Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
      ws.getCell(`${dtCol}4`).font = { size: 10, color: { argb: 'FF5A6C7D' }, name: 'Arial' };
      ws.getCell(`${dtCol}4`).alignment = { horizontal: 'right' };
      ws.getRow(4).height = 18;

      ws.getCell('A5').value = `Work Order: ${workOrderNo || '-'}  |  Total Records: ${exportData.length}`;
      ws.getCell('A5').font = { size: 9, color: { argb: 'FF2C3E50' }, name: 'Arial' };
      ws.getCell('A5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FC' } };
      ws.getRow(5).height = 16;
      ws.getRow(6).height = 6;

      const hdrRow = ws.getRow(7);
      cols.forEach((col, idx) => {
        const cell = hdrRow.getCell(idx + 1);
        cell.value = col.header;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5DADE2' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Arial' };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = { top: { style: 'thin', color: { argb: 'FFFFFFFF' } }, left: { style: 'thin', color: { argb: 'FFFFFFFF' } }, bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } }, right: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
      });
      hdrRow.height = 25;

      exportData.forEach((record, idx) => {
        const row = ws.getRow(8 + idx);
        const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
        const daysLateVal = record.isSkipped ? '—' : (record.daysLate > 0 ? `${record.daysLate}d late` : '—');
        [fmtDate(record.date), record.workOrder, record.description, record.performedBy, record.runDate, record.status, daysLateVal, record.remarks, record.missedCycles > 0 ? record.missedCycles : '-']
          .forEach((v, ci) => { row.getCell(ci + 1).value = v; });

        const isEven = idx % 2 === 1;
        let bg = isEven ? 'FFF7F9FC' : 'FFFFFFFF';
        let fc = 'FF2C3E50';
        let bold = false;
        if (record.isSkipped) { bg = 'FFFEE2E2'; fc = 'FF991B1B'; bold = true; }
        else if (record.missedCycles > 0) { bg = 'FFFEF3C7'; fc = 'FF92400E'; bold = true; }

        row.eachCell((cell, cn) => {
          if (cn > totalCols) return;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          cell.font = { color: { argb: fc }, size: 9, name: 'Arial', bold };
          cell.border = { top: { style: 'thin', color: { argb: 'FFE1E8ED' } }, left: { style: 'thin', color: { argb: 'FFE1E8ED' } }, bottom: { style: 'thin', color: { argb: 'FFE1E8ED' } }, right: { style: 'thin', color: { argb: 'FFE1E8ED' } } };
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        });
        row.height = 20;
      });

      ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `work-history-${(workOrderNo || 'WO').replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Excel export failed:', err);
      toast({ variant: 'destructive', title: 'Export failed', description: 'Could not generate the Excel file. Please try again.' });
    } finally {
      setIsExportingHistoryExcel(false);
    }
  };

  const handleExportWorkHistoryPDF = async () => {
    setIsExportingHistoryPDF(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const exportData = buildWorkHistoryForExport();
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 10;

      const pdfVesselName = vessels.find(v => v.id === (vesselId || contextVesselId))?.name || 'Vessel';
      const pdfJobTitle = templateData.woTitle || templateData.jobTitle || templateData.componentName || templateData.componentCode || '';
      doc.setFillColor(30, 90, 142);
      doc.rect(0, 0, pageWidth, 38, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('WORK HISTORY REPORT', margin, 12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(pdfJobTitle, margin, 20);
      doc.setFontSize(8);
      doc.text(`Component: ${templateData.componentName || templateData.componentCode || '-'}  |  Vessel: ${pdfVesselName}`, margin, 27);
      doc.text(`Work Order: ${workOrderNo || '-'}`, margin, 33);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, pageWidth - margin, 20, { align: 'right' });
      doc.text(`Records: ${exportData.length}`, pageWidth - margin, 27, { align: 'right' });

      const headers = ['Date', 'Work Order No', 'Description', 'Performed By', 'Run. Hours', 'Status', 'Backdating', 'Remarks', 'Missed Cycles'];
      const body = exportData.map(r => {
        const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
        const daysLateCell = r.isSkipped ? '—' : (r.daysLate > 0 ? `${r.daysLate}d late` : '—');
        return [fmtDate(r.date), r.workOrder, r.description, r.performedBy, r.runDate, r.status, daysLateCell, r.remarks, r.missedCycles > 0 ? `⚠ ${r.missedCycles}` : '—'];
      });

      autoTable(doc, {
        head: [headers],
        body,
        startY: 44,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak', lineColor: [225, 232, 237], lineWidth: 0.1 },
        headStyles: { fillColor: [93, 173, 226], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
        alternateRowStyles: { fillColor: [247, 249, 252] },
        columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 28 }, 2: { cellWidth: 50 }, 3: { cellWidth: 24 }, 4: { cellWidth: 16 }, 5: { cellWidth: 18 }, 6: { cellWidth: 16 }, 7: { cellWidth: 44 }, 8: { cellWidth: 16 } },
        didParseCell: (hookData) => {
          if (hookData.section !== 'body') return;
          const record = exportData[hookData.row.index];
          if (!record) return;
          if (record.isSkipped) {
            hookData.cell.styles.fillColor = [254, 226, 226];
            hookData.cell.styles.textColor = [153, 27, 27];
          } else if (record.missedCycles > 0) {
            hookData.cell.styles.fillColor = [254, 243, 199];
            hookData.cell.styles.textColor = [146, 64, 14];
          }
        },
        didDrawPage: (hookData) => {
          const pageCount = (doc as any).internal.getNumberOfPages();
          const currentPage = hookData.pageNumber;
          doc.setFontSize(7);
          doc.setTextColor(90, 108, 125);
          doc.text(`Work History — ${workOrderNo || ''}  |  Page ${currentPage} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });
        },
      });

      doc.save(`work-history-${(workOrderNo || 'WO').replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      toast({ variant: 'destructive', title: 'Export failed', description: 'Could not generate the PDF file. Please try again.' });
    } finally {
      setIsExportingHistoryPDF(false);
    }
  };

  // Layer 7: RH Validation & Isolation state
  const [rhValidation, setRhValidation] = useState<{
    status: 'idle' | 'loading' | 'valid' | 'invalid' | 'warning';
    message: string;
    validRange: { min: number; max: number } | null;
    utilizationRate: number;
    previousEntry: { date: string; runningHours: number } | null;
    nextEntry: { date: string; runningHours: number } | null;
    validationDetails: any;
    componentActualRH: number | null;
  }>({ status: 'idle', message: '', validRange: null, utilizationRate: 0, previousEntry: null, nextEntry: null, validationDetails: null, componentActualRH: null });
  const [componentActualRHStatus, setComponentActualRHStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [componentActualRHLastUpdated, setComponentActualRHLastUpdated] = useState<string | null>(null);
  const [rhJustificationModalOpen, setRhJustificationModalOpen] = useState(false);
  const [rhJustificationText, setRhJustificationText] = useState('');
  const [rhJustificationConfirmed, setRhJustificationConfirmed] = useState(false);
  const [rhErrorModalOpen, setRhErrorModalOpen] = useState(false);
  const [rhErrorDetails, setRhErrorDetails] = useState<any>(null);
  const [rhTimelineOpen, setRhTimelineOpen] = useState(false);
  const [pendingSaveAfterJustification, setPendingSaveAfterJustification] = useState(false);
  const rhValidationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Store work order number from context (e.g., MKR-IN-00001.WO-2025-001)
  const [workOrderNo, setWorkOrderNo] = useState("");
  const [workOrderDueDate, setWorkOrderDueDate] = useState("");

  const [lastDoneDate, setLastDoneDate] = useState<string>("");
  const [lastDoneRH, setLastDoneRH] = useState<string>("");
  const [lastDoneDateForRH, setLastDoneDateForRH] = useState<string>("");

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
    consumedSpareParts: [] as Array<{partNo: string, partCode?: string, description: string, quantityConsumed: string, location: string, locationId: number | null, comments: string}>,
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

  const { ranks: rankOptions } = useRanks();
  const ranksForAssignedTo = ensureRankInOptions(rankOptions, templateData.assignedTo);
  const ranksForApprover = ensureRankInOptions(rankOptions, templateData.approver);
  const ranksForPerformedBy = ensureRankInOptions(rankOptions, executionData.performedBy);

  const generateWOExecutionId = () => {
    const uniqueId = Math.floor(Math.random() * 9000000) + 1000000;
    return `WO-EXE-${uniqueId}`;
  };

  useEffect(() => {
    if (!executionData.woExecutionId) {
      setExecutionData(prev => ({ ...prev, woExecutionId: generateWOExecutionId() }));
    }
  }, []);

  useEffect(() => {
    if (isUnplannedCreate) {
      setTemplateData(prev => ({ ...prev, taskType: 'Unplanned Maintenance' }));
    }
  }, [isUnplannedCreate]);

  useEffect(() => {
    if (pendingSaveAfterJustification && rhJustificationText.length >= 20) {
      handleSave();
    }
  }, [pendingSaveAfterJustification]);

  useEffect(() => {
    if (workOrderId && resolvedMode !== 'template') {
      fetch(`/technical/api/work-orders/${workOrderId}/documents`)
        .then(res => res.ok ? res.json() : [])
        .then(docs => setWoDocuments(docs))
        .catch(() => setWoDocuments([]));
    }
  }, [workOrderId, resolvedMode]);

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

        setLastDoneDate(context.templateData.lastCompletedDate || context.templateData.lastDoneDate || '');
        setLastDoneRH(context.templateData.lastCompletedRH || context.templateData.lastDoneRH || '');
        setLastDoneDateForRH(context.templateData.lastCompletedDateForRH || context.templateData.lastCompletedDate || context.templateData.lastDoneDate || '');

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
        const savedIsZero = savedPreviousReading === '0' || savedPreviousReading === '0.00' || savedPreviousReading === '0.0';
        const lastCompletedCR = context.templateData?.lastCompletedCurrentReading;
        const componentRH = context.component?.currentCumulativeRH;
        const fallbackSource = lastCompletedCR || (componentRH != null ? String(componentRH) : undefined);
        const fallbackSourceNum = fallbackSource ? parseFloat(fallbackSource) : 0;
        const shouldUseFallback = (hasNoSavedPreviousReading || (savedIsZero && fallbackSourceNum > 0)) && fallbackSource;
        const fallbackPreviousReading = shouldUseFallback
          ? fallbackSource
          : undefined;

        // Single consolidated setExecutionData call to prevent React batching race conditions
        setExecutionData(prev => ({
          ...prev,
          ...context.executionData,
          riskAssessment: context.executionData.riskAssessmentStatus || context.executionData.riskAssessment || prev.riskAssessment,
          safetyChecklists: context.executionData.safetyChecklistsStatus || context.executionData.safetyChecklists || prev.safetyChecklists,
          operationalForms: context.executionData.operationalFormsStatus || context.executionData.operationalForms || prev.operationalForms,
          consumedSpareParts: hydratedConsumedSpareParts,
          woExecutionId: prev.woExecutionId || context.executionData.woExecutionId || generateWOExecutionId(),
          // Preserve saved previousReading; only use fallback for new WOs
          // Use nullish check (not falsy) to preserve 0-hour readings correctly
          ...(fallbackPreviousReading ? { previousReading: fallbackPreviousReading } : {})
        }));
      } else if (context.templateData?.lastCompletedCurrentReading || context.component?.currentCumulativeRH != null) {
        const prevReading = context.templateData?.lastCompletedCurrentReading || String(context.component?.currentCumulativeRH || '0');
        setExecutionData(prev => ({
          ...prev,
          previousReading: prevReading
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

      if (context.workOrder?.dueDate) {
        setWorkOrderDueDate(context.workOrder.dueDate);
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
  const componentNameFromUrl = urlParams.get('componentName') || '';
  useEffect(() => {
    if (isNewJobCreation && componentIdFromUrl) {
      // Pre-populate componentCode and componentName from URL
      setTemplateData(prev => ({
        ...prev,
        componentCode: componentIdFromUrl,
        componentName: componentNameFromUrl || prev.componentName,
        // Set sensible defaults for new job
        maintenanceBasis: prev.maintenanceBasis || 'Calendar',
        frequencyUnit: prev.frequencyUnit || 'Months',
        taskType: prev.taskType || 'Inspection',
        jobPriority: prev.jobPriority || 'Medium',
        classRelated: prev.classRelated || 'No',
        isActive: prev.isActive || 'Yes'
      }));
    }
  }, [isNewJobCreation, componentIdFromUrl, componentNameFromUrl]);

  const handleTemplateChange = (field: string, value: string) => {
    // Mark form as touched by user to prevent late async data from overwriting
    hasUserTouchedForm.current = true;

    if (field === 'department') {
      approverManuallySet.current = false;
    }
    if (field === 'approver') {
      approverManuallySet.current = true;
    }

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

  const autoCalcTotalTime = (data: typeof executionData) => {
    const startDate = data.startDateTime ? data.startDateTime.split('T')[0] : '';
    const startTime = data.startDateTime ? data.startDateTime.split('T')[1]?.substring(0, 5) || '' : '';
    const compDate = data.completionDateTime ? data.completionDateTime.split('T')[0] : '';
    const compTime = data.completionDateTime ? data.completionDateTime.split('T')[1]?.substring(0, 5) || '' : '';

    if (startDate && startTime && compDate && compTime) {
      const start = new Date(`${startDate}T${startTime}:00`);
      const end = new Date(`${compDate}T${compTime}:00`);
      const diffMs = end.getTime() - start.getTime();
      if (diffMs > 0) {
        const hours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
        data.totalTimeHours = hours.toString();
      } else {
        data.totalTimeHours = '';
      }
    }

    const persons = parseFloat(data.noOfPersons);
    const hours = parseFloat(data.totalTimeHours);
    if (!isNaN(persons) && !isNaN(hours) && persons > 0 && hours > 0) {
      data.manhours = (persons * hours).toString();
    } else {
      data.manhours = '';
    }
  };

  const performRHValidation = async (rhValue: string, completionDate?: string) => {
    const context = workOrderContext as any;
    const componentId = context?.component?.id;
    if (!componentId || !rhValue || isNaN(Number(rhValue))) {
      setRhValidation(prev => ({ status: 'idle', message: '', validRange: null, utilizationRate: 0, previousEntry: null, nextEntry: null, validationDetails: null, componentActualRH: prev.componentActualRH }));
      return;
    }
    const dateToUse = completionDate || executionData.completionDateTime?.split('T')[0] || executionData.dateOfCompletion || new Date().toISOString().split('T')[0];
    setRhValidation(prev => ({ ...prev, status: 'loading', message: 'Validating...' }));
    try {
      const res = await fetch('/technical/api/running-hours/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineryId: componentId, completionDate: dateToUse, runningHours: Number(rhValue), previousReading: executionData.previousReading ? Number(executionData.previousReading) : undefined })
      });
      const result = await res.json();
      if (result.isValid) {
        setRhValidation({
          status: result.requiresJustification ? 'warning' : 'valid',
          message: result.errorMessage,
          validRange: result.validRange,
          utilizationRate: result.utilizationRate,
          previousEntry: result.previousEntry,
          nextEntry: result.nextEntry,
          validationDetails: result,
          componentActualRH: result.componentActualRH ?? null
        });
      } else {
        setRhValidation({
          status: 'invalid',
          message: result.errorMessage,
          validRange: result.validRange,
          utilizationRate: result.utilizationRate,
          previousEntry: result.previousEntry,
          nextEntry: result.nextEntry,
          validationDetails: result,
          componentActualRH: result.componentActualRH ?? null
        });
      }
    } catch {
      setRhValidation(prev => ({ ...prev, status: 'idle', message: '', componentActualRH: prev.componentActualRH }));
    }
  };

  const fetchCurrentRHFromModule = async () => {
    const context = workOrderContext as any;
    const componentId = context?.component?.id;
    if (!componentId) return;
    try {
      const res = await fetch(`/technical/api/running-hours/current?machineryId=${encodeURIComponent(componentId)}`);
      const result = await res.json();
      if (result.currentRH !== undefined) {
        setExecutionData(prev => ({ ...prev, currentReading: String(result.currentRH) }));
        setRhValidation(prev => ({ ...prev, componentActualRH: result.currentRH }));
        setComponentActualRHStatus('loaded');
        setComponentActualRHLastUpdated(result.lastUpdated || null);
        const fetchedDate = result.lastUpdated ? new Date(result.lastUpdated).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-') : 'N/A';
        toast({ title: "RH Fetched", description: `Running hours fetched: ${result.currentRH} hours as of ${fetchedDate}` });
        performRHValidation(String(result.currentRH));
      }
    } catch {
      toast({ title: "Error", description: "Failed to fetch current running hours from module.", variant: "destructive" });
    }
  };

  const fetchComponentActualRH = async () => {
    const context = workOrderContext as any;
    const componentId = context?.component?.id;
    if (!componentId) return;
    setComponentActualRHStatus('loading');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`/technical/api/running-hours/current?machineryId=${encodeURIComponent(componentId)}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      const result = await res.json();
      if (result.currentRH !== undefined) {
        setRhValidation(prev => ({ ...prev, componentActualRH: result.currentRH }));
        setComponentActualRHStatus('loaded');
        setComponentActualRHLastUpdated(result.lastUpdated || null);
      } else {
        setComponentActualRHStatus('error');
      }
    } catch {
      setComponentActualRHStatus('error');
    }
  };

  useEffect(() => {
    fetchComponentActualRH();
  }, [(workOrderContext as any)?.component?.id]);

  const handleExecutionChange = (field: string, value: string) => {
    setExecutionData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };

      if (field === 'currentReading' || field === 'previousReading') {
        setCurrentReadingWarningAcknowledged(false);
      }

      if (field === 'currentReading') {
        if (rhValidationTimeoutRef.current) clearTimeout(rhValidationTimeoutRef.current);
        rhValidationTimeoutRef.current = setTimeout(() => performRHValidation(value), 500);
      }

      if (field === 'startDateTime' || field === 'completionDateTime') {
        autoCalcTotalTime(newData);
      }

      if ((field === 'completionDateTime' || field === 'dateOfCompletion') && newData.currentReading) {
        const newDate = field === 'completionDateTime' ? value.split('T')[0] : value;
        if (rhValidationTimeoutRef.current) clearTimeout(rhValidationTimeoutRef.current);
        rhValidationTimeoutRef.current = setTimeout(() => performRHValidation(newData.currentReading, newDate), 500);
      }

      if (field === 'noOfPersons') {
        const persons = parseFloat(value);
        const hours = parseFloat(newData.totalTimeHours);

        if (!isNaN(persons) && !isNaN(hours) && persons > 0 && hours > 0) {
          newData.manhours = (persons * hours).toString();
        } else {
          newData.manhours = '';
        }
      }

      return newData;
    });
  };

  useEffect(() => {
    const startDate = executionData.startDateTime ? executionData.startDateTime.split('T')[0] : '';
    const startTime = executionData.startDateTime ? executionData.startDateTime.split('T')[1]?.substring(0, 5) || '' : '';
    const compDate = executionData.completionDateTime ? executionData.completionDateTime.split('T')[0] : '';
    const compTime = executionData.completionDateTime ? executionData.completionDateTime.split('T')[1]?.substring(0, 5) || '' : '';

    if (startDate && startTime && compDate && compTime) {
      const start = new Date(`${startDate}T${startTime}:00`);
      const end = new Date(`${compDate}T${compTime}:00`);
      const diffMs = end.getTime() - start.getTime();
      if (diffMs > 0) {
        const hours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
        const hoursStr = hours.toString();
        if (executionData.totalTimeHours !== hoursStr) {
          setExecutionData(prev => {
            const newData = { ...prev, totalTimeHours: hoursStr };
            const persons = parseFloat(prev.noOfPersons);
            if (!isNaN(persons) && persons > 0 && hours > 0) {
              newData.manhours = (persons * hours).toString();
            }
            return newData;
          });
        }
      }
    }
  }, [executionData.startDateTime, executionData.completionDateTime]);

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

  const handleAddSparePart = async () => {
    if (isReadOnly) return;

    const componentCode = templateData.componentCode;
    const effectiveVesselId = vesselId || contextVesselId;
    if (!componentCode || !effectiveVesselId) {
      const newPart = { partNo: "", description: "", quantityRequired: "", remarks: "" };
      setTemplateData(prev => ({
        ...prev,
        requiredSpareParts: [...prev.requiredSpareParts, newPart]
      }));
      setOriginalSparePart(null);
      setEditingSparePart(templateData.requiredSpareParts.length);
      return;
    }

    setIsLoadingA2Spares(true);
    setIsA2SpareModalOpen(true);

    try {
      const response = await fetch(`/technical/api/inventory/spares-by-component-code/${effectiveVesselId}/${encodeURIComponent(componentCode)}`);
      const data = await response.json();

      if (data.success && data.data) {
        const existingPartCodes = new Set(templateData.requiredSpareParts.map(p => p.partNo || p.partCode));
        const sparesWithState = data.data
          .filter((item: any) => !existingPartCodes.has(item.spare?.partCode || item.spare?.partNumber))
          .map((item: any) => ({
            spare: item.spare,
            selected: false,
            quantityRequired: '1',
            remarks: ''
          }));
        setA2LinkedSpares(sparesWithState);
      } else {
        setA2LinkedSpares([]);
      }
    } catch (error) {
      console.error('Error fetching linked spares for A2:', error);
      setA2LinkedSpares([]);
      toast({
        title: "Error",
        description: "Failed to fetch spare parts for this component.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingA2Spares(false);
    }
  };

  const handleAddSelectedSparesA2 = () => {
    const selectedSpares = a2LinkedSpares.filter(s => s.selected);
    if (selectedSpares.length === 0) return;

    const newParts = selectedSpares.map(s => ({
      partNo: s.spare.partCode || s.spare.partNumber || '',
      partCode: s.spare.partCode || s.spare.partNumber || '',
      description: s.spare.partName || '',
      quantityRequired: s.quantityRequired || '1',
      remarks: s.remarks || ''
    }));

    setTemplateData(prev => ({
      ...prev,
      requiredSpareParts: [...prev.requiredSpareParts, ...newParts]
    }));

    setIsA2SpareModalOpen(false);
    setA2LinkedSpares([]);
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
          selectedLocation: '', // Location name from Spares table (location or location_2)
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

    // Validate location selection and quantities using Spares table locations (NO inventory location IDs)
    for (const spare of selectedSpares) {
      const qty = parseInt(spare.consumeQty);

      // Require location selection (using Spares table location name, not inventory locationId)
      if (!spare.selectedLocation) {
        toast({
          title: "Location Required",
          description: `Please select a location for ${spare.spare.partCode || spare.spare.partName}.`,
          variant: "destructive"
        });
        return;
      }

      // Validate quantity against per-location ROB from Spares table (NO summation or cross-mapping)
      // location -> rob_location_a, location_2 -> rob_location_b
      const locationA = spare.spare.location || '';
      const locationB = spare.spare.location2 || '';
      const robLocationA = spare.spare.robLocationA ?? 0;
      const robLocationB = spare.spare.robLocationB ?? 0;

      // Get available qty based on selected Spares table location name
      const availableQty = spare.selectedLocation === locationA ? robLocationA : 
                           spare.selectedLocation === locationB ? robLocationB : 0;

      if (qty > availableQty) {
        toast({
          title: "Quantity Exceeds Stock",
          description: `Consumption quantity for ${spare.spare.partCode} (${qty}) exceeds available stock at ${spare.selectedLocation} (${availableQty}).`,
          variant: "destructive"
        });
        return;
      }
    }

    // Add selected spares to consumedSpareParts using Spares table location name
    const newConsumedParts = selectedSpares.map(s => {
      return {
        partNo: s.spare.partCode || s.spare.partNumber || '',
        partCode: s.spare.partCode || '',
        description: s.spare.partName || '',
        quantityConsumed: s.consumeQty,
        location: s.selectedLocation, // Store the actual Spares table location name (location or location_2)
        locationId: null, // No inventory location ID, use Spares table location name only
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

  const getDocsByType = (documentType: string) => {
    return woDocuments.filter(d => d.documentType === documentType);
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>, documentType: string) => {
    if (isReadOnly || !workOrderId) return;
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const currentVesselId = vesselId || contextVesselId;
    if (!currentVesselId) {
      toast({ title: "Upload failed", description: "No vessel context available.", variant: "destructive" });
      return;
    }

    const docsOfType = getDocsByType(documentType);
    const slotsAvailable = 5 - docsOfType.length;
    if (slotsAvailable <= 0) {
      toast({ title: "Limit reached", description: "Maximum 5 documents per type. Delete an existing document first.", variant: "destructive" });
      event.target.value = '';
      return;
    }

    const allowedTypes = documentType === 'other'
      ? ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
      : ['application/pdf', 'image/jpeg', 'image/png'];
    const allowedExtensions = documentType === 'other'
      ? ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xlsx']
      : ['.pdf', '.jpg', '.jpeg', '.png'];
    const maxSizeBytes = 5 * 1024 * 1024;

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        toast({ title: "Invalid file type", description: `${file.name}: Only allowed file types are accepted.`, variant: "destructive" });
        continue;
      }
      if (file.size > maxSizeBytes) {
        toast({ title: "File too large", description: `${file.name} is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Maximum is 5MB.`, variant: "destructive" });
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      event.target.value = '';
      return;
    }

    const filesToUpload = validFiles.slice(0, slotsAvailable);
    if (validFiles.length > slotsAvailable) {
      toast({ title: "Partial upload", description: `Only ${slotsAvailable} slot(s) remaining. Uploading first ${slotsAvailable} of ${validFiles.length} files.`, variant: "destructive" });
    }

    setUploadingDocType(documentType);
    let uploadedCount = 0;
    try {
      for (const file of filesToUpload) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('documentType', documentType);
        formData.append('vesselId', currentVesselId);

        const response = await fetch(`/technical/api/work-orders/${workOrderId}/documents`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.message || errBody.error || `Failed to upload ${file.name}`);
        }

        const result = await response.json();
        setWoDocuments(prev => [...prev, result]);

        setExecutionData(prev => ({
          ...prev,
          uploadedDocuments: [
            ...prev.uploadedDocuments,
            {
              type: documentType,
              fileName: result.fileName,
              fileKey: result.fileKey,
              uploadedAt: result.uploadedAt,
              uploadedBy: result.uploadedBy
            }
          ]
        }));
        uploadedCount++;
      }

      toast({
        title: "Documents uploaded",
        description: uploadedCount === 1
          ? `${filesToUpload[0].name} has been uploaded successfully.`
          : `${uploadedCount} files have been uploaded successfully.`,
      });

      event.target.value = '';
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload document. Please try again.",
        variant: "destructive"
      });
      event.target.value = '';
    } finally {
      setUploadingDocType(null);
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

  const resolveDocumentFetchUrl = (documentType: string, docId?: string): { fetchUrl: string | undefined; targetDoc: any } => {
    let targetDoc: any;
    if (docId) {
      targetDoc = woDocuments.find(d => d.id === docId);
    } else {
      targetDoc = woDocuments.find(d => d.documentType === documentType);
      if (!targetDoc) {
        targetDoc = executionData.uploadedDocuments.find(doc => doc.type === documentType);
      }
    }
    if (!targetDoc) return { fetchUrl: undefined, targetDoc: undefined };

    const fetchId = targetDoc.id || null;
    let fetchUrl: string | undefined;

    if (fetchId) {
      fetchUrl = `/technical/api/work-order-documents/${fetchId}/download`;
    } else if (targetDoc.fileKey) {
      const fileKeyEncoded = encodeURIComponent(targetDoc.fileKey.substring(1));
      fetchUrl = `/technical/api/documents/${fileKeyEncoded}`;
    }

    return { fetchUrl, targetDoc };
  };

  const handleViewDocument = async (documentType: string, docId?: string) => {
    const { fetchUrl } = resolveDocumentFetchUrl(documentType, docId);

    if (fetchUrl) {
      try {
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error('Failed to retrieve document');
        const result = await response.json();
        const dataUrl = result.dataUrl || result.url;
        if (dataUrl && dataUrl.startsWith('data:')) {
          const [header, base64Data] = dataUrl.split(',');
          const mimeMatch = header.match(/data:([^;]+)/);
          const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
          const byteChars = atob(base64Data);
          const byteArray = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) {
            byteArray[i] = byteChars.charCodeAt(i);
          }
          const blob = new Blob([byteArray], { type: mime });
          const blobUrl = URL.createObjectURL(blob);
          window.open(blobUrl, '_blank');
        } else if (dataUrl) {
          window.open(dataUrl, '_blank');
        } else {
          window.open(fetchUrl, '_blank');
        }
      } catch (error) {
        console.error('View error:', error);
        toast({
          title: "View failed",
          description: "Failed to open document. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  const handleDownloadDocument = async (documentType: string, docId?: string) => {
    const { fetchUrl, targetDoc } = resolveDocumentFetchUrl(documentType, docId);

    if (fetchUrl) {
      try {
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error('Failed to retrieve document');
        const result = await response.json();
        const blob = dataUrlToBlob(result.dataUrl);
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = result.fileName || targetDoc?.fileName || 'download';
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
    }
  };

  const handleDeleteDocumentClick = (documentType: string, docId?: string) => {
    if (isReadOnly) return;
    if (docId) {
      const doc = woDocuments.find(d => d.id === docId);
      if (!doc) return;
      setDocumentToDelete({ type: documentType, fileKey: doc.fileKey, documentId: docId });
    } else {
      const document = executionData.uploadedDocuments.find(doc => doc.type === documentType);
      if (!document) return;
      setDocumentToDelete({ type: documentType, fileKey: document.fileKey });
    }
    setDeleteDocumentDialogOpen(true);
  };

  const handleDeleteDocumentConfirm = async () => {
    if (isReadOnly) return;
    if (!documentToDelete) return;

    try {
      if (documentToDelete.documentId) {
        const response = await fetch(`/technical/api/work-order-documents/${documentToDelete.documentId}`, {
          method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete document');
        setWoDocuments(prev => prev.filter(d => d.id !== documentToDelete.documentId));
      } else {
        const fileKeyEncoded = encodeURIComponent(documentToDelete.fileKey.substring(1));
        const response = await fetch(`/technical/api/documents/${fileKeyEncoded}`, {
          method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete document');
      }

      setExecutionData(prev => ({
        ...prev,
        uploadedDocuments: documentToDelete.documentId
          ? prev.uploadedDocuments.filter(doc => doc.fileKey !== documentToDelete.fileKey)
          : prev.uploadedDocuments.filter(doc => doc.type !== documentToDelete.type)
      }));

      toast({
        title: "Document deleted",
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

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return <ImageIcon className="h-5 w-5" />;
    if (['pdf'].includes(ext)) return <FileText className="h-5 w-5" />;
    if (['xls', 'xlsx'].includes(ext)) return <FileSpreadsheet className="h-5 w-5" />;
    return <Paperclip className="h-5 w-5" />;
  };

  const renderDocIcons = (documentType: string, typeLabel: string) => {
    const docs = getDocsByType(documentType);
    if (docs.length === 0) return null;
    return (
      <div className="mt-1 flex items-center gap-1 flex-wrap" data-testid={`doc-icons-${documentType}`}>
        {docs.map((doc) => (
          <div key={doc.id} className="relative group/doc" data-testid={`doc-icon-${documentType}-${doc.id}`}>
            <div className="p-1.5 rounded border border-gray-200 bg-gray-50 text-gray-500 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 cursor-pointer transition-colors">
              {getFileIcon(doc.fileName)}
            </div>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/doc:flex flex-col items-start bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-50 min-w-[180px]">
              <span className="text-xs text-gray-700 font-medium truncate max-w-[170px] mb-1" title={doc.fileName}>{doc.fileName}</span>
              <span className="text-[10px] text-gray-400 mb-2">{formatFileSize(doc.fileSize)}</span>
              <div className="flex items-center gap-1 w-full">
                <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => handleViewDocument(documentType, doc.id)} data-testid={`button-view-${typeLabel}-${doc.id}`}>
                  <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                </Button>
                {!isReadOnly && !isPartBReadOnly && (
                  <Button variant="outline" size="sm" className="h-7 text-xs text-red-500 hover:text-red-700 hover:border-red-300" onClick={() => handleDeleteDocumentClick(documentType, doc.id)} data-testid={`button-delete-${typeLabel}-${doc.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
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
      const isUnplannedWO = workOrderType === 'Unplanned';

      if (!isUnplannedWO) {
        const normalizedFrequency = normalizeFrequencyValue(templateData.frequencyValue);
        if (!normalizedFrequency) {
          toast({
            title: "Validation Error",
            description: "Frequency value is required. Please enter a positive whole number (no decimals, negative values, or zero).",
            variant: "destructive",
          });
          return;
        }
        if (!templateData.frequencyUnit || templateData.frequencyUnit.trim() === '') {
          toast({
            title: "Validation Error",
            description: "Frequency unit is required.",
            variant: "destructive",
          });
          return;
        }
      }

      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      const startDate = executionData.startDateTime ? executionData.startDateTime.split('T')[0] : '';
      const startTime = executionData.startDateTime ? executionData.startDateTime.split('T')[1]?.substring(0, 5) || '' : '';
      const completionDate = executionData.completionDateTime ? executionData.completionDateTime.split('T')[0] : (executionData.dateOfCompletion || '');
      const completionTime = executionData.completionDateTime ? executionData.completionDateTime.split('T')[1]?.substring(0, 5) || '' : '';
      const workCarriedOutTrimmed = (executionData.workCarriedOut || '').trim();
      const noOfPersonsStr = (executionData.noOfPersons || '').trim();
      const totalTimeVal = parseFloat(executionData.totalTimeHours);
      const currentRHValue = executionData.currentReading || executionData.runningHours;
      const hasCompletionData = !!(executionData.completionDateTime || executionData.dateOfCompletion);
      const hasConsumedSparesData = executionData.consumedSpareParts.some(s => s.partNo && s.quantityConsumed && parseFloat(s.quantityConsumed) > 0);
      const hasAnyPartBData = !!(startDate || completionDate || executionData.performedBy || noOfPersonsStr || executionData.totalTimeHours || workCarriedOutTrimmed || currentRHValue || executionData.riskAssessment || executionData.safetyChecklists || executionData.operationalForms || hasConsumedSparesData);

      const hardErrors: string[] = [];
      const missingFields: string[] = [];

      if (startTime && !timeRegex.test(startTime)) {
        hardErrors.push("Start Time must be in HH:MM 24-hour format (00:00–23:59).");
      }
      if (completionTime && !timeRegex.test(completionTime)) {
        hardErrors.push("Completion Time must be in HH:MM 24-hour format (00:00–23:59).");
      }

      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (startDate) {
        const startDateObj = new Date(startDate);
        if (startDateObj > today) {
          hardErrors.push("Start Date cannot be in the future.");
        }
      }
      if (completionDate) {
        const completionDateObj = new Date(completionDate);
        if (completionDateObj > today) {
          hardErrors.push("Completion Date cannot be in the future.");
        }
        if (startDate && completionDateObj < new Date(startDate)) {
          hardErrors.push("Completion Date cannot be before Start Date.");
        }
        if (startDate === completionDate && startTime && completionTime && completionTime < startTime) {
          hardErrors.push("Completion Time cannot be before Start Time on the same day.");
        }
      }

      if (executionData.performedBy && hodLabel && executionData.performedBy === hodLabel) {
        hardErrors.push(`The Head of Department (${hodLabel}) cannot both perform and approve the work. The server will assign ${hodLabel} as approver based on the vessel org chart.`);
      }

      if (noOfPersonsStr && !/^[1-9]\d*$/.test(noOfPersonsStr)) {
        hardErrors.push("No. of Persons must be a positive whole number (≥ 1).");
      }
      if (noOfPersonsStr && parseInt(noOfPersonsStr, 10) > 50) {
        hardErrors.push("No. of Persons cannot exceed 50.");
      }

      if (executionData.totalTimeHours && !isNaN(totalTimeVal)) {
        if (totalTimeVal <= 0) hardErrors.push("Total Time Taken must be greater than 0.");
        if (totalTimeVal > 720) hardErrors.push("Total Time Taken cannot exceed 720 hours (30 days).");
      }

      const manhoursVal = parseFloat(executionData.manhours);
      if (executionData.manhours && !isNaN(manhoursVal) && manhoursVal <= 0) {
        hardErrors.push("Manhours must be a positive number.");
      }

      if (workCarriedOutTrimmed && (workCarriedOutTrimmed.toLowerCase() === 'describe work carried out...' || workCarriedOutTrimmed.toLowerCase() === 'describe work carried out')) {
        hardErrors.push("Please provide a proper description of work carried out, not the placeholder text.");
      }
      if (workCarriedOutTrimmed && workCarriedOutTrimmed.length < 20) {
        hardErrors.push("Work Carried Out must be at least 20 characters to provide a meaningful description.");
      }

      if (currentRHValue) {
        const currentRHNum = parseFloat(currentRHValue);
        if (isNaN(currentRHNum) || currentRHNum < 0) {
          hardErrors.push("Current Reading must be a positive number (≥ 0).");
        }
      }

      const b1Warnings: string[] = [];
      if (executionData.riskAssessment === 'No') b1Warnings.push('Risk Assessment');
      if (executionData.safetyChecklists === 'No') b1Warnings.push('Safety Checklists');
      if (executionData.operationalForms === 'No') b1Warnings.push('Operational Forms');
      if (b1Warnings.length > 0) {
        hardErrors.push(`${b1Warnings.join(', ')} ${b1Warnings.length === 1 ? 'is' : 'are'} marked as "No". Please complete the required assessments or select "NA" if not applicable.`);
      }

      const b1DocChecks = [
        { field: executionData.riskAssessment, type: 'riskAssessment', label: 'Risk Assessment' },
        { field: executionData.safetyChecklists, type: 'safetyChecklist', label: 'Safety Checklists' },
        { field: executionData.operationalForms, type: 'operationalForm', label: 'Operational Forms' },
      ];
      for (const check of b1DocChecks) {
        if (check.field === 'Yes' && getDocsByType(check.type).length === 0) {
          hardErrors.push(`${check.label} is marked as "Yes" but no supporting document has been uploaded.`);
        }
      }

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
        hardErrors.push(`Qty Used must be a positive whole number (≥ 1) for: ${parts}. Remove the row if no spares were consumed.`);
      }

      const allSparesWithMissingLocation = executionData.consumedSpareParts.filter(spare => {
        const qty = parseFloat(spare.quantityConsumed || '0');
        if (qty <= 0) return false;
        const hasLocationId = spare.locationId != null && spare.locationId > 0;
        const hasLocationName = spare.location && typeof spare.location === 'string' && spare.location.trim().length > 0;
        return !hasLocationId && !hasLocationName;
      });
      if (allSparesWithMissingLocation.length > 0) {
        const parts = allSparesWithMissingLocation.map(s => s.partNo || s.description).join(', ');
        hardErrors.push(`Please select a location for: ${parts}. A location is required when consuming spare parts.`);
      }

      const hasConsumedSpares = executionData.consumedSpareParts.some(
        spare => spare.partNo && spare.quantityConsumed && parseFloat(spare.quantityConsumed) > 0
      );
      if (hasConsumedSpares && vesselId) {
        if (!isSparesInventoryFetched) {
          hardErrors.push("Please wait for inventory data to load before submitting.");
        }
        if (isSparesInventoryError) {
          hardErrors.push("Failed to load inventory data. Stock validation cannot be performed.");
        }
      }

      if (hasConsumedSpares && isSparesInventoryFetched && !isSparesInventoryError) {
        const sparesWithMissingLocation = executionData.consumedSpareParts.filter(spare => {
          const hasQuantity = spare.quantityConsumed && parseFloat(spare.quantityConsumed) > 0;
          if (!hasQuantity) return false;
          const lookupKey = spare.partCode || spare.partNo;
          const isInInventory = lookupKey && sparesWithInventory.some(s => s.spare.partCode === lookupKey);
          if (!isInInventory) return false;
          const hasLocationId = spare.locationId != null && spare.locationId > 0;
          const hasLocationName = spare.location && typeof spare.location === 'string' && spare.location.trim().length > 0;
          return !hasLocationId && !hasLocationName;
        });
        if (sparesWithMissingLocation.length > 0) {
          const missingParts = sparesWithMissingLocation.map(s => s.partNo || s.description).join(', ');
          hardErrors.push(`Please select a location for: ${missingParts}. Location selection is required for inventory tracking.`);
        }

        const sparesWithInsufficientStock = executionData.consumedSpareParts.filter(spare => {
          const qty = parseFloat(spare.quantityConsumed);
          if (!qty || qty <= 0 || !spare.location) return false;
          const lookupKey = spare.partCode || spare.partNo;
          if (!lookupKey) return false;
          const spareInInventory = sparesInventory.find(s => s.partCode === lookupKey);
          if (!spareInInventory) return false;
          const stockAtLocation = getRobByLocationName(lookupKey, spare.location);
          return qty > stockAtLocation;
        });
        if (sparesWithInsufficientStock.length > 0) {
          const insufficientParts = sparesWithInsufficientStock.map(s => {
            const lookupKey = s.partCode || s.partNo;
            const stockAtLoc = getRobByLocationName(lookupKey, s.location);
            return `${s.partNo || s.partCode} (need ${s.quantityConsumed}, have ${stockAtLoc} at ${s.location})`;
          }).join(', ');
          hardErrors.push(`Consumption cannot exceed available ROB: ${insufficientParts}`);
        }

        const sparesNeedingComments = executionData.consumedSpareParts.filter(spare => {
          const qty = parseFloat(spare.quantityConsumed || '0');
          if (qty <= 0 || !spare.location) return false;
          if (spare.comments && spare.comments.trim().length > 0) return false;
          const lookupKey = spare.partCode || spare.partNo;
          if (!lookupKey) return false;
          const rob = getRobByLocationName(lookupKey, spare.location);
          if (rob <= 0) return qty > 0;
          return qty > (rob * 0.5);
        });
        if (sparesNeedingComments.length > 0) {
          const parts = sparesNeedingComments.map(s => s.partNo || s.description).join(', ');
          hardErrors.push(`High consumption detected for: ${parts}. Please add a comment explaining the usage when consuming more than 50% of available stock.`);
        }
      }

      if ((workOrderContext as any)?.maintenanceBasis === 'Running Hours') {
        if (componentActualRHStatus === 'loading') {
          hardErrors.push('Component running hours are still loading. Please wait for the value to load before saving.');
        } else if (componentActualRHStatus === 'error') {
          hardErrors.push('Unable to verify component running hours. Please refresh the page or retry loading the component RH before saving.');
        }
        if (currentRHValue) {
          const enteredRH = Number(currentRHValue);
          const capRH = rhValidation.componentActualRH ?? (executionData.previousReading ? Number(executionData.previousReading) : null);
          if (capRH !== null && !isNaN(enteredRH) && !isNaN(capRH) && enteredRH > capRH) {
            hardErrors.push(`Running hours entered (${enteredRH}) exceeds the component's actual running hours (${capRH}). You cannot complete maintenance at a running hour that the component has not reached yet. Please update the component's running hours in the Running Hours module first, or enter a value ≤ ${capRH} hours.`);
          }
        }
      }

      if (rhValidation.status === 'invalid' && !isRejectedWO) {
        hardErrors.push(rhValidation.message || 'Running hours validation failed. Please correct the Current Reading value.');
      }

      if (hardErrors.length > 0) {
        toast({
          title: "Validation Error",
          description: hardErrors[0],
          variant: "destructive",
        });
        return;
      }

      if (!startDate) missingFields.push("Start Date");
      if (!startTime) missingFields.push("Start Time");
      if (!completionDate) missingFields.push("Completion Date");
      if (!completionTime) missingFields.push("Completion Time");
      if (!executionData.performedBy || executionData.performedBy.trim() === '') missingFields.push("Performed By");
      if (!noOfPersonsStr) missingFields.push("No. of Persons");
      if (!executionData.totalTimeHours || isNaN(totalTimeVal)) missingFields.push("Total Time Taken");
      if (!workCarriedOutTrimmed) missingFields.push("Work Carried Out");
      if ((workOrderContext as any)?.maintenanceBasis === 'Running Hours' && !currentRHValue) {
        missingFields.push("Current Reading");
      }

      const isReadyForSubmission = missingFields.length === 0;
      const isDraftSave = hasAnyPartBData && !isReadyForSubmission;

      if (forceSubmitOnly.current) {
        forceSubmitOnly.current = false;
        if (!isReadyForSubmission) {
          toast({
            title: "Validation Error",
            description: `The following Part B fields are required to submit for approval: ${missingFields.join(', ')}. Use "Save" to save your progress as a draft instead.`,
            variant: "destructive",
          });
          return;
        }
      } else {
        if (isDraftSave && !hasCompletionData) {
          const saveExecutionData = {
            ...executionData,
            runningHours: currentRHValue || executionData.runningHours,
            riskAssessmentStatus: executionData.riskAssessment,
            safetyChecklistsStatus: executionData.safetyChecklists,
            operationalFormsStatus: executionData.operationalForms,
          };

          const response = await fetch(`/technical/api/work-orders/${workOrderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...templateData,
              ...saveExecutionData,
            })
          });

          const result = await response.json();
          if (!response.ok) {
            if (result.code === 'INVALID_RUNNING_HOURS') {
              throw new Error(`Current Reading (${result.enteredValue} hrs) exceeds component actual RH (${result.componentActualRH} hrs). Update running hours in the RH module first, or enter a value ≤ ${result.maxAllowed} hrs.`);
            }
            throw new Error(result.error || 'Failed to save work order');
          }

          await queryClient.invalidateQueries({ queryKey: ['/technical/api/work-orders'] });
          await queryClient.invalidateQueries({ queryKey: ['/technical/api/scoped-operation-data'] });
          await queryClient.invalidateQueries({ queryKey: [`/technical/api/work-orders/${workOrderId}/context`] });
          if (hasConsumedSparesData && vesselId) {
            await queryClient.invalidateQueries({ queryKey: [`/technical/api/spares/${vesselId}`] });
            await queryClient.invalidateQueries({ queryKey: [`/technical/api/inventory/spares-with-inventory/${vesselId}`] });
          }

          toast({
            title: "Draft Saved",
            description: `Work order saved as draft. Complete these fields before submitting for approval: ${missingFields.join(', ')}.`,
          });
          return;
        }

        if (!isReadyForSubmission) {
          toast({
            title: "Validation Error",
            description: `The following fields are required: ${missingFields.join(', ')}.`,
            variant: "destructive",
          });
          return;
        }
      }

      if (currentRHValue && executionData.previousReading) {
        const currentRH = parseFloat(currentRHValue);
        const previousRH = parseFloat(executionData.previousReading);

        if (!isNaN(currentRH) && !isNaN(previousRH) && currentRH < previousRH) {
          toast({
            title: "Validation Error",
            description: `Current Reading (${currentRH}) cannot be less than Previous Reading (${previousRH}). Running hours can only increase.`,
            variant: "destructive",
          });
          return;
        }

        if (!isNaN(currentRH) && !isNaN(previousRH) && (currentRH - previousRH) > 2000 && !currentReadingWarningAcknowledged) {
          toast({
            title: "Warning — Large Reading Jump",
            description: `Current Reading (${currentRH}) exceeds Previous Reading (${previousRH}) by ${(currentRH - previousRH).toFixed(2)} hrs. Please verify this value is correct and save again to confirm.`,
            variant: "destructive",
          });
          setCurrentReadingWarningAcknowledged(true);
          return;
        }
      }

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

      if (hasCompletionData) {
        if ((workOrderContext as any)?.maintenanceBasis === 'Running Hours' && !currentRHValue) {
          toast({
            title: "Validation Error",
            description: "Running hours is required for RH-based maintenance when submitting for approval",
            variant: "destructive",
          });
          return;
        }

        if (currentRHValue && workOrderContext && (workOrderContext as any).component) {
          const { component, rhMasterComponent } = workOrderContext as any;
          const newRunningHours = parseInt(currentRHValue);

          if (isNaN(newRunningHours)) {
            toast({
              title: "Validation Error",
              description: "Running hours must be a valid number",
              variant: "destructive",
            });
            return;
          }

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

          // Layer 7: Use server-side timeline validation (skip blocking for rejected WOs — they need to resubmit)
          if (rhValidation.status === 'invalid' && !isRejectedWO) {
            setRhErrorDetails(rhValidation.validationDetails);
            setRhErrorModalOpen(true);
            return;
          }

          if (rhValidation.status === 'warning' && !pendingSaveAfterJustification) {
            setRhJustificationModalOpen(true);
            return;
          }
        }
      }

      let recalculatedNextDueDate = templateData.nextDueDate;
      const maintenanceBasis = templateData.maintenanceBasis || (workOrderContext as any)?.maintenanceBasis;
      if (hasCompletionData && maintenanceBasis !== 'Running Hours' && templateData.frequencyValue && templateData.frequencyUnit) {
        const calculatedNextDue = calculateNextDueDate(completionDate, templateData.frequencyValue, templateData.frequencyUnit);
        if (calculatedNextDue) {
          recalculatedNextDueDate = calculatedNextDue;
        }
      }

      const saveExecutionData = {
        ...executionData,
        runningHours: currentRHValue || executionData.runningHours,
        riskAssessmentStatus: executionData.riskAssessment,
        safetyChecklistsStatus: executionData.safetyChecklists,
        operationalFormsStatus: executionData.operationalForms,
      };

      const response = await fetch(`/technical/api/work-orders/${workOrderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...templateData,
          ...saveExecutionData,
          nextDueDate: recalculatedNextDueDate,
          status: hasCompletionData ? 'Pending Approval' : undefined,
          // Layer 7: Include RH justification if provided via modal
          ...(pendingSaveAfterJustification && rhJustificationText ? {
            rhJustification: rhJustificationText,
            completionRHSource: 'MANUAL_ENTRY'
          } : {})
        })
      });

      // Reset justification state after save attempt
      if (pendingSaveAfterJustification) {
        setPendingSaveAfterJustification(false);
      }

      const result = await response.json();

      if (!response.ok) {
        if (result.code === 'INVALID_RUNNING_HOURS') {
          throw new Error(`Current Reading (${result.enteredValue} hrs) exceeds component actual RH (${result.componentActualRH} hrs). Update running hours in the RH module first, or enter a value ≤ ${result.maxAllowed} hrs.`);
        }
        throw new Error(result.error || 'Failed to save work order');
      }

      // Invalidate all work orders-related caches so the updated status is reflected
      // This includes the list (with any vesselId variants) and the specific work order context
      await queryClient.invalidateQueries({ queryKey: ['/technical/api/work-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['/technical/api/scoped-operation-data'] });
      await queryClient.invalidateQueries({ queryKey: [`/technical/api/work-orders/${workOrderId}/context`] });
      if (hasConsumedSparesData && vesselId) {
        await queryClient.invalidateQueries({ queryKey: [`/technical/api/spares/${vesselId}`] });
        await queryClient.invalidateQueries({ queryKey: [`/technical/api/inventory/spares-with-inventory/${vesselId}`] });
      }

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

      const componentCuuid = urlParams.get('componentCuuid') || templateData.componentCode;
      const componentName = templateData.componentName || templateData.componentCode;

      if (!templateData.woTemplateCode?.trim()) {
        toast({
          title: "Validation Error",
          description: "Job Code is required",
          variant: "destructive",
        });
        return;
      }

      const jobPayload = {
        vesselId: contextVesselId,
        componentId: componentCuuid,
        componentCode: templateData.componentCode,
        componentName: componentName,
        jobNo: templateData.woTemplateCode.trim(),
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

  const [isDraftSaving, setIsDraftSaving] = useState(false);

  const isExistingDraftUnplanned = !isUnplannedCreate && workOrderType === 'Unplanned' && currentWorkOrderStatus === 'Draft';
  const showDraftActions = isUnplannedCreate || isExistingDraftUnplanned;

  const handleSaveDraftUnplanned = async () => {
    if (!templateData.woTitle?.trim()) {
      toast({ title: 'Validation Error', description: 'Job Title is required.', variant: 'destructive' });
      return;
    }
    if (!templateData.componentName?.trim()) {
      toast({ title: 'Validation Error', description: 'Please select a Component.', variant: 'destructive' });
      return;
    }

    const currentRHValue = executionData.currentReading || executionData.runningHours;
    const woPayload: Record<string, unknown> = {
      vesselId: contextVesselId,
      component: templateData.componentName,
      componentCode: templateData.componentCode,
      jobTitle: templateData.woTitle,
      workOrderType: 'Unplanned',
      maintenanceType: templateData.taskType || 'Unplanned Maintenance',
      assignedTo: templateData.assignedTo || '',
      approver: templateData.approver || '',
      jobCategory: templateData.jobCategory || '',
      jobPriority: templateData.jobPriority || 'Medium',
      classRelated: templateData.classRelated || 'No',
      department: templateData.department || '',
      criticality: templateData.criticality || '',
      isActive: templateData.isActive === 'Yes',
      status: 'Draft',
      briefWorkDescription: templateData.briefWorkDescription || '',
      safetyRequirements: {
        ppeRequirements: (templateData.safetyRequirements?.ppeRequirements || []).filter((s: string) => s.trim() !== ''),
        permitRequirements: (templateData.safetyRequirements?.permitRequirements || []).filter((s: string) => s.trim() !== ''),
        otherRequirements: (templateData.safetyRequirements?.otherRequirements || []).filter((s: string) => s.trim() !== ''),
      },
      dataScope: 'vessel',
      maintenanceBasis: 'Calendar',
      frequencyValue: '',
      frequencyUnit: '',
      startDateTime: executionData.startDateTime || '',
      completionDateTime: executionData.completionDateTime || '',
      dateOfCompletion: executionData.dateOfCompletion || '',
      performedBy: executionData.performedBy || '',
      noOfPersons: executionData.noOfPersons || '',
      totalTimeHours: executionData.totalTimeHours || '',
      manhours: executionData.manhours || '',
      workCarriedOut: executionData.workCarriedOut || '',
      runningHours: currentRHValue || '',
      riskAssessmentStatus: executionData.riskAssessment || '',
      safetyChecklistsStatus: executionData.safetyChecklists || '',
      operationalFormsStatus: executionData.operationalForms || '',
      executionAssignedTo: executionData.executionAssignedTo || '',
      consumedSpareParts: executionData.consumedSpareParts.filter(s => s.partNo || s.description),
      requiredSpareParts: templateData.requiredSpareParts || [],
      requiredTools: templateData.requiredTools || [],
    };

    setIsDraftSaving(true);
    try {
      if (isExistingDraftUnplanned && workOrderId) {
        await apiRequest('PATCH', `/technical/api/work-orders/${workOrderId}`, woPayload);
        queryClient.invalidateQueries({ queryKey: ['/technical/api/work-orders'] });
        queryClient.invalidateQueries({ queryKey: ['/technical/api/scoped-operation-data'] });
        queryClient.invalidateQueries({ queryKey: [`/technical/api/work-orders/${workOrderId}/context`] });
        toast({ title: 'Draft Updated', description: 'Unplanned work order draft updated successfully.' });
      } else {
        const createRes = await apiRequest('POST', '/technical/api/work-orders', woPayload);
        const createdWO = await createRes.json();
        const newWoId = createdWO?.id || createdWO?.workOrderId;
        if (!newWoId) throw new Error('Failed to create work order — no ID returned.');
        queryClient.invalidateQueries({ queryKey: ['/technical/api/work-orders'] });
        queryClient.invalidateQueries({ queryKey: ['/technical/api/scoped-operation-data'] });
        toast({ title: 'Draft Saved', description: 'Unplanned work order saved as draft. You can resume editing from the Unplanned tab.' });
      }
      sessionStorage.setItem('workOrdersActiveTab', 'Unplanned');
      navigate('/pms/work-orders');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save draft. Please try again.';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsDraftSaving(false);
    }
  };

  const handleSaveUnplannedCreate = async () => {
    // === Part A validation ===
    if (!templateData.woTitle?.trim()) {
      toast({ title: 'Validation Error', description: 'Job Title is required.', variant: 'destructive' });
      return;
    }
    if (!templateData.componentName?.trim()) {
      toast({ title: 'Validation Error', description: 'Please select a Component.', variant: 'destructive' });
      return;
    }
    if (!templateData.briefWorkDescription?.trim()) {
      toast({ title: 'Validation Error', description: 'Brief Work Description is required.', variant: 'destructive' });
      return;
    }

    // === Part B validation (mirrors handleSave validation pipeline) ===
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    const startDate = executionData.startDateTime ? executionData.startDateTime.split('T')[0] : '';
    const startTime = executionData.startDateTime ? executionData.startDateTime.split('T')[1]?.substring(0, 5) || '' : '';
    const completionDate = executionData.completionDateTime
      ? executionData.completionDateTime.split('T')[0]
      : (executionData.dateOfCompletion || '');
    const completionTime = executionData.completionDateTime
      ? executionData.completionDateTime.split('T')[1]?.substring(0, 5) || ''
      : '';
    const workCarriedOutTrimmed = (executionData.workCarriedOut || '').trim();
    const noOfPersonsStr = (executionData.noOfPersons || '').trim();
    const totalTimeVal = parseFloat(executionData.totalTimeHours);
    const currentRHValue = executionData.currentReading || executionData.runningHours;
    const hasConsumedSparesData = executionData.consumedSpareParts.some(
      s => s.partNo && s.quantityConsumed && parseFloat(s.quantityConsumed) > 0
    );
    const hasAnyPartBData = !!(
      startDate || completionDate || executionData.performedBy || noOfPersonsStr ||
      executionData.totalTimeHours || workCarriedOutTrimmed || currentRHValue || hasConsumedSparesData
    );

    const hardErrors: string[] = [];

    if (startTime && !timeRegex.test(startTime)) hardErrors.push('Start Time must be in HH:MM 24-hour format (00:00–23:59).');
    if (completionTime && !timeRegex.test(completionTime)) hardErrors.push('Completion Time must be in HH:MM 24-hour format (00:00–23:59).');

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (startDate && new Date(startDate) > today) hardErrors.push('Start Date cannot be in the future.');
    if (completionDate) {
      const completionDateObj = new Date(completionDate);
      if (completionDateObj > today) hardErrors.push('Completion Date cannot be in the future.');
      if (startDate && completionDateObj < new Date(startDate)) hardErrors.push('Completion Date cannot be before Start Date.');
      if (startDate === completionDate && startTime && completionTime && completionTime < startTime) {
        hardErrors.push('Completion Time cannot be before Start Time on the same day.');
      }
    }

    if (executionData.performedBy && hodLabel && executionData.performedBy === hodLabel) {
      hardErrors.push(`The Head of Department (${hodLabel}) cannot both perform and approve the work. The server will assign ${hodLabel} as approver based on the vessel org chart.`);
    }

    if (noOfPersonsStr && !/^[1-9]\d*$/.test(noOfPersonsStr)) hardErrors.push('No. of Persons must be a positive whole number (≥ 1).');
    if (noOfPersonsStr && parseInt(noOfPersonsStr, 10) > 50) hardErrors.push('No. of Persons cannot exceed 50.');

    if (executionData.totalTimeHours && !isNaN(totalTimeVal)) {
      if (totalTimeVal <= 0) hardErrors.push('Total Time Taken must be greater than 0.');
      if (totalTimeVal > 720) hardErrors.push('Total Time Taken cannot exceed 720 hours (30 days).');
    }

    const manhoursVal = parseFloat(executionData.manhours);
    if (executionData.manhours && !isNaN(manhoursVal) && manhoursVal <= 0) hardErrors.push('Manhours must be a positive number.');

    if (workCarriedOutTrimmed && workCarriedOutTrimmed.length < 20) {
      hardErrors.push('Work Carried Out must be at least 20 characters to provide a meaningful description.');
    }

    if (currentRHValue) {
      const currentRHNum = parseFloat(currentRHValue);
      if (isNaN(currentRHNum) || currentRHNum < 0) hardErrors.push('Current Reading must be a positive number (≥ 0).');
    }

    // RH validation state checks (mirrors handleSave pipeline).
    // Unplanned WOs use maintenanceBasis='Calendar' so these are no-ops in practice,
    // but are included for full parity with the execution save path.
    if ((workOrderContext as any)?.maintenanceBasis === 'Running Hours') {
      if (componentActualRHStatus === 'loading') {
        hardErrors.push('Component running hours are still loading. Please wait for the value to load before saving.');
      } else if (componentActualRHStatus === 'error') {
        hardErrors.push('Unable to verify component running hours. Please refresh the page or retry loading the component RH before saving.');
      }
      if (currentRHValue) {
        const enteredRH = Number(currentRHValue);
        const capRH = rhValidation.componentActualRH ?? (executionData.previousReading ? Number(executionData.previousReading) : null);
        if (capRH !== null && !isNaN(enteredRH) && !isNaN(capRH) && enteredRH > capRH) {
          hardErrors.push(`Running hours entered (${enteredRH}) exceeds the component's actual running hours (${capRH}). Please update the component's running hours in the Running Hours module first, or enter a value ≤ ${capRH} hours.`);
        }
      }
    }
    if (rhValidation.status === 'invalid' && !isRejectedWO) {
      hardErrors.push(rhValidation.message || 'Running hours validation failed. Please correct the Current Reading value.');
    }

    const sparesWithInvalidQty = executionData.consumedSpareParts.filter(spare => {
      const hasData = spare.partNo || spare.description;
      if (!hasData) return false;
      const qty = spare.quantityConsumed;
      if (!qty || qty.trim() === '') return true;
      const qtyNum = parseFloat(qty);
      return isNaN(qtyNum) || qtyNum < 1 || !Number.isInteger(qtyNum);
    });
    if (sparesWithInvalidQty.length > 0) {
      const parts = sparesWithInvalidQty.map(s => s.partNo || s.description).join(', ');
      hardErrors.push(`Qty Used must be a positive whole number (≥ 1) for: ${parts}. Remove the row if no spares were consumed.`);
    }

    const sparesWithMissingLocation = executionData.consumedSpareParts.filter(spare => {
      const qty = parseFloat(spare.quantityConsumed || '0');
      if (qty <= 0) return false;
      const hasLocationId = spare.locationId != null && spare.locationId > 0;
      const hasLocationName = spare.location && spare.location.trim().length > 0;
      return !hasLocationId && !hasLocationName;
    });
    if (sparesWithMissingLocation.length > 0) {
      const parts = sparesWithMissingLocation.map(s => s.partNo || s.description).join(', ');
      hardErrors.push(`Please select a location for: ${parts}. A location is required when consuming spare parts.`);
    }

    // Inventory-loaded and stock availability checks (mirrors handleSave pipeline)
    const hasConsumedSpares = executionData.consumedSpareParts.some(
      spare => spare.partNo && spare.quantityConsumed && parseFloat(spare.quantityConsumed) > 0
    );
    if (hasConsumedSpares && vesselId) {
      if (!isSparesInventoryFetched) {
        hardErrors.push('Please wait for inventory data to load before submitting.');
      }
      if (isSparesInventoryError) {
        hardErrors.push('Failed to load inventory data. Stock validation cannot be performed.');
      }
    }

    if (hasConsumedSpares && isSparesInventoryFetched && !isSparesInventoryError) {
      const sparesWithInsufficientStock = executionData.consumedSpareParts.filter(spare => {
        const qty = parseFloat(spare.quantityConsumed);
        if (!qty || qty <= 0 || !spare.location) return false;
        const lookupKey = spare.partCode || spare.partNo;
        if (!lookupKey) return false;
        const spareInInventory = sparesInventory.find(s => s.partCode === lookupKey);
        if (!spareInInventory) return false;
        const stockAtLocation = getRobByLocationName(lookupKey, spare.location);
        return qty > stockAtLocation;
      });
      if (sparesWithInsufficientStock.length > 0) {
        const insufficientParts = sparesWithInsufficientStock.map(s => {
          const lookupKey = s.partCode || s.partNo;
          const stockAtLoc = getRobByLocationName(lookupKey, s.location);
          return `${s.partNo || s.partCode} (need ${s.quantityConsumed}, have ${stockAtLoc} at ${s.location})`;
        }).join(', ');
        hardErrors.push(`Consumption cannot exceed available ROB: ${insufficientParts}`);
      }

      const sparesNeedingComments = executionData.consumedSpareParts.filter(spare => {
        const qty = parseFloat(spare.quantityConsumed || '0');
        if (qty <= 0 || !spare.location) return false;
        if (spare.comments && spare.comments.trim().length > 0) return false;
        const lookupKey = spare.partCode || spare.partNo;
        if (!lookupKey) return false;
        const rob = getRobByLocationName(lookupKey, spare.location);
        if (rob <= 0) return qty > 0;
        return qty > (rob * 0.5);
      });
      if (sparesNeedingComments.length > 0) {
        const parts = sparesNeedingComments.map(s => s.partNo || s.description).join(', ');
        hardErrors.push(`High consumption detected for: ${parts}. Please add a comment explaining the usage when consuming more than 50% of available stock.`);
      }
    }

    if (hardErrors.length > 0) {
      toast({ title: 'Validation Error', description: hardErrors[0], variant: 'destructive' });
      return;
    }

    // Current vs previous RH regression and large-jump acknowledgment (mirrors handleSave)
    if (currentRHValue && executionData.previousReading) {
      const currentRH = parseFloat(currentRHValue);
      const previousRH = parseFloat(executionData.previousReading);
      if (!isNaN(currentRH) && !isNaN(previousRH) && currentRH < previousRH) {
        toast({
          title: 'Validation Error',
          description: `Current Reading (${currentRH}) cannot be less than Previous Reading (${previousRH}). Running hours can only increase.`,
          variant: 'destructive',
        });
        return;
      }
      if (!isNaN(currentRH) && !isNaN(previousRH) && (currentRH - previousRH) > 2000 && !currentReadingWarningAcknowledged) {
        toast({
          title: 'Warning — Large Reading Jump',
          description: `Current Reading (${currentRH}) exceeds Previous Reading (${previousRH}) by ${(currentRH - previousRH).toFixed(2)} hrs. Please verify this value is correct and save again to confirm.`,
          variant: 'destructive',
        });
        setCurrentReadingWarningAcknowledged(true);
        return;
      }
    }

    // Determine submission status based on Part B completeness
    const missingFields: string[] = [];
    if (!startDate) missingFields.push('Start Date');
    if (!startTime) missingFields.push('Start Time');
    if (!completionDate) missingFields.push('Completion Date');
    if (!completionTime) missingFields.push('Completion Time');
    if (!executionData.performedBy?.trim()) missingFields.push('Performed By');
    if (!noOfPersonsStr) missingFields.push('No. of Persons');
    if (!executionData.totalTimeHours || isNaN(totalTimeVal)) missingFields.push('Total Time Taken');
    if (!workCarriedOutTrimmed) missingFields.push('Work Carried Out');

    const isReadyForSubmission = missingFields.length === 0;

    // B1 assessment and document-required checks are submission-only:
    // draft saves may have incomplete B1 selection, so these errors are only enforced
    // when all required Part B fields are present (full submission path).
    if (isReadyForSubmission) {
      const submissionErrors: string[] = [];

      const b1Warnings: string[] = [];
      if (executionData.riskAssessment === 'No') b1Warnings.push('Risk Assessment');
      if (executionData.safetyChecklists === 'No') b1Warnings.push('Safety Checklists');
      if (executionData.operationalForms === 'No') b1Warnings.push('Operational Forms');
      if (b1Warnings.length > 0) {
        submissionErrors.push(
          `${b1Warnings.join(', ')} ${b1Warnings.length === 1 ? 'is' : 'are'} marked as "No". Please complete the required assessments or select "NA" if not applicable.`
        );
      }

      // B1 document-required checks: if any B1 item is marked "Yes" without a document uploaded,
      // the user should save a draft first, upload docs after WO creation, then re-submit.
      const b1DocChecks = [
        { field: executionData.riskAssessment, type: 'riskAssessment', label: 'Risk Assessment' },
        { field: executionData.safetyChecklists, type: 'safetyChecklist', label: 'Safety Checklists' },
        { field: executionData.operationalForms, type: 'operationalForm', label: 'Operational Forms' },
      ];
      for (const check of b1DocChecks) {
        if (check.field === 'Yes' && getDocsByType(check.type).length === 0) {
          submissionErrors.push(`${check.label} is marked as "Yes" but no supporting document has been uploaded. Save as a draft first and attach the document after the work order is created.`);
        }
      }

      if (submissionErrors.length > 0) {
        toast({ title: 'Validation Error', description: submissionErrors[0], variant: 'destructive' });
        return;
      }
    }

    if (!isReadyForSubmission) {
      toast({
        title: 'Validation Error',
        description: `The following Part B fields are required to submit for approval: ${missingFields.join(', ')}. Use "Save" to save as a draft instead.`,
        variant: 'destructive',
      });
      return;
    }

    const woStatus = 'Pending Approval';

    const woPayload = {
      vesselId: contextVesselId,
      component: templateData.componentName,
      componentCode: templateData.componentCode,
      jobTitle: templateData.woTitle,
      workOrderType: 'Unplanned',
      maintenanceType: templateData.taskType || 'Unplanned Maintenance',
      assignedTo: templateData.assignedTo || '',
      approver: templateData.approver || '',
      jobCategory: templateData.jobCategory || '',
      jobPriority: templateData.jobPriority || 'Medium',
      classRelated: templateData.classRelated || 'No',
      department: templateData.department || '',
      criticality: templateData.criticality || '',
      isActive: templateData.isActive === 'Yes',
      status: woStatus,
      briefWorkDescription: templateData.briefWorkDescription,
      safetyRequirements: {
        ppeRequirements: (templateData.safetyRequirements?.ppeRequirements || []).filter((s: string) => s.trim() !== ''),
        permitRequirements: (templateData.safetyRequirements?.permitRequirements || []).filter((s: string) => s.trim() !== ''),
        otherRequirements: (templateData.safetyRequirements?.otherRequirements || []).filter((s: string) => s.trim() !== ''),
      },
      dataScope: 'vessel',
      maintenanceBasis: 'Calendar',
      frequencyValue: '',
      frequencyUnit: '',
    };

    setIsUnplannedSaving(true);
    try {
      const createRes = await apiRequest('POST', '/technical/api/work-orders', woPayload);
      const createdWO = await createRes.json();
      const newWoId = createdWO?.id || createdWO?.workOrderId;

      if (!newWoId) throw new Error('Failed to create work order — no ID returned.');

      // Always PATCH execution data if any Part B data exists (preserves partial drafts)
      if (hasAnyPartBData) {
        const execPayload = {
          riskAssessment: executionData.riskAssessment || null,
          safetyChecklists: executionData.safetyChecklists || null,
          operationalForms: executionData.operationalForms || null,
          startDateTime: executionData.startDateTime || null,
          completionDateTime: executionData.completionDateTime || null,
          dateOfCompletion: completionDate || null,
          performedBy: executionData.performedBy || null,
          noOfPersons: executionData.noOfPersons || null,
          totalTimeHours: executionData.totalTimeHours || null,
          manhours: executionData.manhours || null,
          workCarriedOut: executionData.workCarriedOut || null,
          jobExperienceNotes: executionData.jobExperienceNotes || null,
          previousReading: executionData.previousReading || null,
          currentReading: executionData.currentReading || null,
          consumedSpareParts: executionData.consumedSpareParts.filter(
            (s) => s.description?.trim() || s.partNo?.trim()
          ),
          status: woStatus,
        };
        await apiRequest('PATCH', `/technical/api/work-orders/${newWoId}`, execPayload);
      }

      queryClient.invalidateQueries({ queryKey: ['/technical/api/work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/scoped-operation-data'] });

      if (isReadyForSubmission) {
        toast({ title: 'Work Order Created', description: 'Unplanned work order submitted for approval.' });
        sessionStorage.setItem('workOrdersActiveTab', 'Pending Approval');
        navigate('/pms/work-orders');
      } else {
        // Draft: navigate to the execution form for the new WO so the user can resume editing
        toast({
          title: 'Draft Saved',
          description: hasAnyPartBData
            ? `Unplanned work order saved as draft. Complete these fields before submitting: ${missingFields.join(', ')}.`
            : 'Unplanned work order saved as draft. Open it to complete the Work Completion Record and submit for approval.',
        });
        navigate(`/pms/work-order/${newWoId}`);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create work order. Please try again.';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsUnplannedSaving(false);
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
      const woMissed = (workOrderContext as any)?.workOrder?.missedCycles || 0;
      const payload: Record<string, any> = {
        status: 'Completed',
        approvalAction: 'approved',
        skippedCyclesJustification: woMissed >= 1 ? skippedCyclesJustification : null,
        ceApprovalRemarks: ceApprovalRemarks.trim() || null
      };

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
      queryClient.invalidateQueries({ queryKey: ['/technical/api/scoped-operation-data'] });
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
    window.history.back();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {embedded && isReadOnly && (
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
      {!embedded && currentWorkOrderStatus === 'Completed' && (
        <div className="sticky top-0 z-50 bg-blue-50 border-b border-blue-200 px-4 py-2">
          <span className="text-sm text-blue-800 font-medium" data-testid="banner-completed-readonly">
            This Work Order is completed. Part B is read-only.
          </span>
        </div>
      )}
      {!embedded && currentWorkOrderStatus === 'Pending Approval' && (() => {
        const topTier: string = (workOrderContext as any)?.workOrder?.approvalTier || 'standard';
        const topDaysLate = (workOrderContext as any)?.workOrder?.daysLate || 0;
        const topMissedCycles = (workOrderContext as any)?.workOrder?.missedCycles || 0;
        const topBannerMap: Record<string, { bg: string; text: string; message: string }> = {
          superintendent_locked: {
            bg: 'bg-red-600', text: 'text-white',
            message: `🔒 LOCKED — ${topMissedCycles} missed cycle(s). Awaiting Superintendent acknowledgment before ${hodShort} can approve.`
          },
          superintendent_notification: {
            bg: 'bg-orange-600', text: 'text-white',
            message: `⚠️ SUPERINTENDENT NOTIFIED — ${topDaysLate} days late. ${hodShort} must approve with detailed remarks (min 20 chars).`
          },
          ce_with_justification: {
            bg: 'bg-yellow-50', text: 'text-yellow-900',
            message: `⚠️ REMARKS REQUIRED — ${topDaysLate} days late. ${hodShort} must provide approval remarks.`
          },
          standard: {
            bg: 'bg-blue-600', text: 'text-white',
            message: `ℹ️ PENDING APPROVAL — Awaiting ${hodLabel} review.`
          }
        };
        const cfg = topBannerMap[topTier] || topBannerMap.standard;
        return (
          <div className={`sticky top-0 z-50 ${cfg.bg} border-b px-4 py-2`} data-testid="banner-top-approval-tier">
            <span className={`text-sm font-medium ${cfg.text}`}>{cfg.message}</span>
          </div>
        );
      })()}
      {!embedded && isRejectedWO && (() => {
        const rc = (workOrderContext as any)?.workOrder?.rejectionComments || '';
        return (
          <div className="sticky top-0 z-50 bg-red-50 border-b border-red-300 px-4 py-3" data-testid="banner-rejection">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-red-800">⚠️ REJECTED — Please make corrections and resubmit.</span>
            </div>
            {rc && (
              <div className="text-sm text-red-700 mt-1" data-testid="text-rejection-reason">
                Reason: {rc}
              </div>
            )}
          </div>
        );
      })()}
      {!embedded && currentWorkOrderStatus === 'Postponed' && (() => {
        const ctx = workOrderContext as { workOrder?: { postponementReason?: string | null; postponementRemarks?: string | null } } | undefined;
        const postponeReason = ctx?.workOrder?.postponementReason || '';
        const postponeRemarks = ctx?.workOrder?.postponementRemarks || '';
        if (!postponeReason) return null;
        return (
          <div className="sticky top-0 z-50 bg-blue-50 border-b border-blue-200 px-4 py-2" data-testid="banner-postponed">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-blue-800">⏸ POSTPONED</span>
              <span className="text-sm text-blue-700">— Reason: {postponeReason}</span>
            </div>
            {postponeRemarks && (
              <div className="text-sm text-blue-600 mt-0.5" data-testid="text-postponement-remarks">
                Remarks: {postponeRemarks}
              </div>
            )}
          </div>
        );
      })()}
      {!embedded && (() => {
        const ctx = workOrderContext as { workOrder?: { overdueReason?: string | null; overdueReasonDetails?: string | null } } | undefined;
        const overdueReason = ctx?.workOrder?.overdueReason || '';
        const overdueDetails = ctx?.workOrder?.overdueReasonDetails || '';
        if (!overdueReason) return null;
        return (
          <div className="sticky top-0 z-50 bg-amber-50 border-b border-amber-200 px-4 py-2" data-testid="banner-overdue-reason">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-amber-800">⚠ OVERDUE</span>
              <span className="text-sm text-amber-700">— Reason: {overdueReason}</span>
            </div>
            {overdueDetails && (
              <div className="text-sm text-amber-600 mt-0.5" data-testid="text-overdue-reason-details">
                Details: {overdueDetails}
              </div>
            )}
          </div>
        );
      })()}
      {!embedded && workOrderId && (() => {
        const anomalyData = woAnomalies;
        if (!anomalyData || anomalyData.length === 0) return null;
        const topAnomaly = anomalyData[0];
        const sevColors: Record<string, { bg: string; text: string; border: string }> = {
          HIGH: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-300' },
          MEDIUM: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-300' },
          LOW: { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-300' },
        };
        const sc = sevColors[topAnomaly.severity] || sevColors.LOW;
        const typeLabels: Record<string, string> = {
          BACKDATING: 'Backdating',
          MISSED_CYCLES: 'Missed Cycles',
          SUSPICIOUS_PATTERN: 'Suspicious Pattern',
          MULTIPLE_ANOMALIES: 'Multiple Anomalies',
        };
        return (
          <div className={`sticky top-0 z-40 ${sc.bg} border-b ${sc.border} px-4 py-2 flex items-center gap-2`} data-testid="banner-anomaly-alert">
            <span className={`text-sm font-bold ${sc.text}`}>
              ⚠️ {topAnomaly.severity} ANOMALY:
            </span>
            <span className={`text-sm ${sc.text}`}>
              {typeLabels[topAnomaly.anomalyType] || topAnomaly.anomalyType}
              {topAnomaly.daysLate > 0 ? ` — ${topAnomaly.daysLate} days late` : ''}
              {topAnomaly.missedCycles > 0 ? ` — ${topAnomaly.missedCycles} missed cycles` : ''}
            </span>
            <span className={`text-xs ${sc.text} opacity-70 ml-auto`}>
              Detected: {topAnomaly.detectedAt ? new Date(topAnomaly.detectedAt).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        );
      })()}
      {/* Top Header Bar - Professional maritime header with logo and actions */}
      <div className={`bg-white border-b border-gray-200 shadow-sm ${showDraftActions ? 'sticky top-0 z-30' : ''}`}>
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
                  {isNewJobCreation ? 'Job Form' : (isUnplannedCreate || isExistingDraftUnplanned) ? 'Work Order Form — Unplanned' : 'Work Order Form'}
                </h1>
                {!isNewJobCreation && workOrderNo && (
                  <span className="text-sm text-blue-600 font-medium" data-testid="WOF-wo-number">
                    {workOrderNo}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {showDraftActions && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveDraftUnplanned}
                  disabled={isDraftSaving}
                  className="border-[#22c55e] text-[#22c55e] hover:bg-green-50 font-medium px-4 h-9"
                  data-testid="button-save-draft"
                >
                  {isDraftSaving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save'
                  )}
                </Button>
              )}
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
            <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-6 space-y-8">
            <div data-testid="WOF3"><Marker id="WOF3" /></div>
            <PartHeader
              id="part-a"
              label="Part A"
              title="Job Details"
              description="Work details about this work order"
              variant="inline"
            />
            <div data-testid="WOF.AA"><Marker id="WOF.AA" /></div>
            <div data-testid="WOF.A"><Marker id="WOF.A" /></div>

            {/* A1. Job Information */}
            <div data-testid="WOF.A1.1"><Marker id="WOF.A1.1" /></div>
            <div data-testid="WOF.A1.2"><Marker id="WOF.A1.2" /></div>

            {(() => {
              const woMissedCycles = (workOrderContext as any)?.workOrder?.missedCycles || 0;
              if (woMissedCycles >= 1) {
                return (
                  <div
                    className="rounded-lg border-2 p-4 mb-4"
                    style={{ backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }}
                    data-testid="banner-skipped-cycles"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg">⚠</span>
                      <div>
                        <h4 className="font-semibold text-sm" style={{ color: '#92400E' }}>SKIPPED CYCLES DETECTED</h4>
                        <p className="text-sm mt-1" style={{ color: '#92400E' }}>
                          This work order was completed {woMissedCycles} cycle{woMissedCycles > 1 ? 's' : ''} late.{' '}
                          {woMissedCycles} job cycle{woMissedCycles > 1 ? 's were' : ' was'} missed between the scheduled due date and the actual completion date.
                          This has been recorded in the audit trail.
                        </p>
                        {(() => {
                          const woOriginalDueDate = (workOrderContext as any)?.workOrder?.originalDueDate;
                          const jobNextDueDate = templateData?.nextDueDate;
                          if (woOriginalDueDate && jobNextDueDate) {
                            const formattedOriginal = normalizeDateToDDMMMYYYY(woOriginalDueDate) || woOriginalDueDate;
                            const formattedNextDue = normalizeDateToDDMMMYYYY(jobNextDueDate) || jobNextDueDate;
                            return (
                              <p className="text-sm mt-2" style={{ color: '#92400E' }} data-testid="text-next-due-corrected">
                                The next due date has been automatically corrected to{' '}
                                <span className="font-semibold">{formattedNextDue}</span> based on the original scheduled due date of{' '}
                                <span className="font-semibold">{formattedOriginal}</span>, not the actual completion date. This prevents schedule drift.
                              </p>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <SectionBlock 
              id="work-order-info"
              number="A1"
              title="Job Information" 
              description="Basic details and configuration for this work order"
              variant="inline"
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
                  {isUnplannedCreate ? (
                    <Select
                      value={unplannedComponentId}
                      onValueChange={handleUnplannedComponentSelect}
                    >
                      <SelectTrigger className="text-sm" data-testid="WOF.A1.6">
                        <SelectValue placeholder="Select component" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredUnplannedComponents.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={templateData.componentName || templateData.component}
                      onChange={(e) => handleTemplateChange('componentName', e.target.value)}
                      className="text-sm"
                      placeholder="Enter component"
                      disabled={isPartAReadOnly}
                      data-testid="WOF.A1.6"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]" data-testid="WOF.A1.7"><Marker id="WOF.A1.7" />Component Code</Label>
                  <Input
                    value={templateData.componentCode}
                    onChange={(e) => handleTemplateChange('componentCode', e.target.value)}
                    className="text-sm"
                    placeholder="Enter component code"
                    disabled={isPartAReadOnly || isUnplannedCreate}
                    data-testid="WOF.A1.8"
                  />
                </div>

                {!isUnplannedCreate && (
                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]" data-testid="WOF.A1.9"><Marker id="WOF.A1.9" />Job Code</Label>
                    <Input
                      value={templateData.woTemplateCode}
                      onChange={(e) => handleTemplateChange('woTemplateCode', e.target.value)}
                      className="text-sm"
                      placeholder="Enter job code"
                      disabled={isPartAReadOnly}
                      data-testid="WOF.A1.10"
                    />
                  </div>
                )}

                {!isUnplannedCreate && (
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
                )}

                {!isUnplannedCreate && (
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
                )}

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
                      {isUnplannedCreate ? (
                        <>
                          <SelectItem value="Unplanned Maintenance">Unplanned Maintenance</SelectItem>
                          <SelectItem value="Emergency">Emergency</SelectItem>
                          <SelectItem value="Breakdown">Breakdown</SelectItem>
                          <SelectItem value="Corrective Maintenance">Corrective Maintenance</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="Inspection">Inspection</SelectItem>
                          <SelectItem value="Overhaul">Overhaul</SelectItem>
                          <SelectItem value="Service">Service</SelectItem>
                          <SelectItem value="Test">Test</SelectItem>
                          <SelectItem value="Renew/Replace">Renew/Replace</SelectItem>
                          <SelectItem value="Measurement/Calibration">Measurement/Calibration</SelectItem>
                          <SelectItem value="Megger Test">Megger Test</SelectItem>
                          <SelectItem value="Cleaning">Cleaning</SelectItem>
                          <SelectItem value="Lubrication">Lubrication</SelectItem>
                          <SelectItem value="Survey">Survey</SelectItem>
                          <SelectItem value="Analysis">Analysis</SelectItem>
                          <SelectItem value="Checks">Checks</SelectItem>
                        </>
                      )}
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
                      {ranksForAssignedTo.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
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
                      {ranksForApprover.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hodResolution?.resolved && woDepartment && !approverManuallySet.current && !isPartAReadOnly && (
                    <p className="text-xs text-[#52baf3]" data-testid="text-approver-auto">
                      Auto-filled from org chart ({hodResolution.source.replace(/_/g, ' ')})
                    </p>
                  )}
                </div>

                {!isUnplannedCreate && (
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
                )}

                {!isUnplannedCreate && (
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
                )}

                {/* Conditional Next Due field based on Maintenance Basis */}
                {!isUnplannedCreate && (templateData.maintenanceBasis === 'Running Hours' ? (
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
                ))}

                {!isUnplannedCreate && templateData.maintenanceBasis === 'Running Hours' && (
                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad] flex items-center gap-1" data-testid="WOF.A1.lastDoneRHLabel">
                      <Clock className="h-3.5 w-3.5" />
                      Last Completed At
                    </Label>
                    <div className="text-xs p-2 bg-gray-100 rounded border border-gray-200 text-gray-700" data-testid="text-last-completed-rh">
                      {lastDoneRH !== '' && lastDoneRH != null ? (
                        <>{formatRHWithSeparators(lastDoneRH)} Hours</>
                      ) : lastDoneDateForRH ? (
                        <span className="text-gray-500 italic">RH not recorded</span>
                      ) : (
                        <span className="text-gray-400 italic">First maintenance cycle</span>
                      )}
                    </div>
                  </div>
                )}

                {!isUnplannedCreate && (
                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad] flex items-center gap-1" data-testid="WOF.A1.lastDoneLabel">
                      <Clock className="h-3.5 w-3.5" />
                      Last Completed On
                    </Label>
                    <div className="text-xs p-2 bg-gray-100 rounded border border-gray-200 text-gray-700" data-testid="text-last-completed-date">
                      {(lastDoneDate || lastDoneDateForRH) ? (
                        <>
                          {normalizeDateToDDMMMYYYY(lastDoneDateForRH || lastDoneDate) || lastDoneDateForRH || lastDoneDate}
                          {formatRelativeTime(lastDoneDateForRH || lastDoneDate) && (
                            <span className="text-gray-500"> ({formatRelativeTime(lastDoneDateForRH || lastDoneDate)})</span>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-400 italic">First maintenance cycle</span>
                      )}
                    </div>
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

                {!isUnplannedCreate && (
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
                )}
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

          {/* A2. Required Spare Parts — hidden for unplanned work orders */}
          {!isUnplannedCreate && (<>
          <div data-testid="WOF.A2.1"><Marker id="WOF.A2.1" /></div>
          <div data-testid="WOF.A2.2"><Marker id="WOF.A2.2" /></div>
          <SectionBlock
            id="spare-parts"
            number="A2"
            title="Required Spare Parts"
            description="Spare parts needed for this work order"
            variant="inline"
          >
            <div className="space-y-3">
              {!isPartAReadOnly && (<div className="flex justify-end">
                <Button
                  size="sm"
                  className="bg-[#22c55e] hover:bg-[#16a34a] text-white"
                  onClick={handleAddSparePart}
                  data-testid="WOF.A2.16"
                >
                  <Marker id="WOF.A2.16" />
                  <Plus className="h-4 w-4 mr-1" />
                  Add spares
                </Button>
              </div>)}

              {/* Editable Spare Parts Table - Updated to show location-wise ROB per spec */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-2 font-medium text-gray-700 w-[15%]" data-testid="WOF.A2.3"><Marker id="WOF.A2.3" />PART NO.</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[25%]" data-testid="WOF.A2.4"><Marker id="WOF.A2.4" />DESCRIPTION</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[8%]" data-testid="WOF.A2.5"><Marker id="WOF.A2.5" />QTY REQ</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[12%]" data-testid="WOF.A2.6"><Marker id="WOF.A2.6" />LOCATION</th>
                      <th className="text-right p-2 font-medium text-gray-700 w-[8%]" data-testid="WOF.A2.6b">ROB</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[12%]" data-testid="WOF.A2.7"><Marker id="WOF.A2.7" />STATUS</th>
                      {!isPartAReadOnly && <th className="text-center p-2 font-medium text-gray-700 w-[100px]" data-testid="WOF.A2.8"><Marker id="WOF.A2.8" />ACTIONS</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(templateData.requiredSpareParts || []).length === 0 ? (
                      <tr>
                        <td colSpan={isPartAReadOnly ? 6 : 7} className="text-center p-4 text-gray-500 italic">
                          No spare parts added yet
                        </td>
                      </tr>
                    ) : (
                      (templateData.requiredSpareParts || []).map((part: any, index) => {
                        // ROB lookup using Spares table mapping per spec:
                        // location -> rob_location_a, location_2 -> rob_location_b
                        const lookupKey = part.partCode || '';
                        const spareData = lookupKey ? sparesInventory.find(s => s.partCode === lookupKey) : null;
                        const locations = lookupKey ? getAvailableLocationsForSpare(lookupKey) : [];

                        // Location-specific ROB values (NO summation per spec)
                        const robLocationA = spareData?.robLocationA ?? 0;
                        const robLocationB = spareData?.robLocationB ?? 0;

                        // Stock status based on per-location availability (no summation)
                        // Available = at least one location can fulfill the required qty
                        // Insufficient = some stock exists at any location but no single location has enough
                        // Unavailable = no stock at any location
                        const qtyRequired = parseInt(part.quantityRequired) || 0;
                        const locationACanFulfill = robLocationA >= qtyRequired;
                        const locationBCanFulfill = robLocationB >= qtyRequired;
                        const hasAnyStock = robLocationA > 0 || robLocationB > 0;
                        const isAvailable = locationACanFulfill || locationBCanFulfill;
                        const isInsufficientStock = hasAnyStock && !isAvailable;
                        const stockStatus = !spareData ? 'unknown' : isAvailable ? 'available' : isInsufficientStock ? 'insufficient' : 'unavailable';

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
                                <td className="p-2 text-xs">
                                  {locations.length > 0 ? (
                                    <div className="space-y-1">
                                      {locations.map((loc, locIdx) => (
                                        <div key={locIdx}>
                                          <span className="text-gray-600">{loc.name}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : '-'}
                                </td>
                                <td className="p-2 text-xs text-right">
                                  {locations.length > 0 ? (
                                    <div className="space-y-1">
                                      {locations.map((loc, locIdx) => (
                                        <div key={locIdx}>
                                          <span className="font-medium">{loc.robValue}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : '-'}
                                </td>
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
                                <td className="p-2 text-xs" data-testid={`text-spare-location-${index}`}>
                                  {locations.length > 0 ? (
                                    <div className="space-y-1">
                                      {locations.map((loc, locIdx) => (
                                        <div key={locIdx}>
                                          <span className="text-gray-600">{loc.name}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : '-'}
                                </td>
                                <td className="p-2 text-xs text-right" data-testid={`text-spare-rob-${index}`}>
                                  {locations.length > 0 ? (
                                    <div className="space-y-1">
                                      {locations.map((loc, locIdx) => (
                                        <div key={locIdx}>
                                          <span className="font-medium">{loc.robValue}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : '-'}
                                </td>
                                <td className="p-2">
                                  <span data-testid={`status-spare-${index}`}>
                                    <StatusPill status={stockStatus} />
                                  </span>
                                </td>
                                {!isPartAReadOnly && (
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
          </>)}

          {/* A3. Safety Requirements */}
          <div data-testid="WOF.A4.1"><Marker id="WOF.A4.1" /></div>
          <div data-testid="WOF.A4.2"><Marker id="WOF.A4.2" /></div>
          <SectionBlock
            id="safety"
            number={isUnplannedCreate ? "A2" : "A3"}
            title="Safety Requirements"
            description="Safety requirements and permits for this work order"
            variant="inline"
          >
            <div className="space-y-3" data-testid="WOF.A4.3"><Marker id="WOF.A4.3" />
              {isUnplannedCreate ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700" data-testid="label-ppe-requirements">Personal Protective Equipment (PPE)</Label>
                    <Textarea
                      value={(templateData.safetyRequirements?.ppeRequirements || []).join('\n')}
                      onChange={(e) => {
                        const lines = e.target.value.split('\n');
                        handleTemplateChange('safetyRequirements', {
                          ...templateData.safetyRequirements,
                          ppeRequirements: lines,
                        });
                      }}
                      onBlur={() => {
                        const cleaned = (templateData.safetyRequirements?.ppeRequirements || []).filter((s: string) => s.trim() !== '');
                        handleTemplateChange('safetyRequirements', {
                          ...templateData.safetyRequirements,
                          ppeRequirements: cleaned,
                        });
                      }}
                      className="text-sm min-h-[80px]"
                      placeholder="Enter PPE requirements (one per line, e.g. Safety Goggles)"
                      data-testid="textarea-ppe-requirements"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700" data-testid="label-permit-requirements">Permits Required</Label>
                    <Textarea
                      value={(templateData.safetyRequirements?.permitRequirements || []).join('\n')}
                      onChange={(e) => {
                        const lines = e.target.value.split('\n');
                        handleTemplateChange('safetyRequirements', {
                          ...templateData.safetyRequirements,
                          permitRequirements: lines,
                        });
                      }}
                      onBlur={() => {
                        const cleaned = (templateData.safetyRequirements?.permitRequirements || []).filter((s: string) => s.trim() !== '');
                        handleTemplateChange('safetyRequirements', {
                          ...templateData.safetyRequirements,
                          permitRequirements: cleaned,
                        });
                      }}
                      className="text-sm min-h-[80px]"
                      placeholder="Enter permit requirements (one per line, e.g. Hot Work Permit)"
                      data-testid="textarea-permit-requirements"
                    />
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </SectionBlock>

          {/* A4. Work History */}
          <div data-testid="WOF.A5.1"><Marker id="WOF.A5.1" /></div>
          <div data-testid="WOF.A5.2"><Marker id="WOF.A5.2" /></div>
          <SectionBlock
            id="history"
            number={isUnplannedCreate ? "A3" : "A4"}
            title="Work History"
            description="Previous executions and completion history for this work order"
            variant="inline"
            headerActions={
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportWorkHistoryExcel}
                  disabled={isExportingHistoryExcel || (templateData.workHistory || []).length === 0}
                  data-testid="button-export-history-excel"
                  className="h-7 text-xs border-green-600 text-green-700 hover:bg-green-50 disabled:opacity-40"
                >
                  {isExportingHistoryExcel
                    ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Exporting…</>
                    : <><FileSpreadsheet className="h-3 w-3 mr-1" />Export Excel</>}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportWorkHistoryPDF}
                  disabled={isExportingHistoryPDF || (templateData.workHistory || []).length === 0}
                  data-testid="button-export-history-pdf"
                  className="h-7 text-xs border-red-500 text-red-600 hover:bg-red-50 disabled:opacity-40"
                >
                  {isExportingHistoryPDF
                    ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Exporting…</>
                    : <><FileText className="h-3 w-3 mr-1" />Export PDF</>}
                </Button>
              </>
            }
          >
            {(() => {
              const rawHistory = templateData.workHistory || [];
              type SpareUsedItem = { partName?: string; partCode?: string; quantity?: number | null };
              const allHistory = rawHistory.map((history: any) => {
                if (history.isSkipped) {
                  return {
                    date: history.skippedCycleDate || history.completionDate || history.workDate,
                    workOrder: '—',
                    description: 'Cycle not performed',
                    performedBy: '—',
                    approvedBy: null as string | null,
                    runDate: '—',
                    status: 'skipped' as const,
                    daysLate: 0,
                    remarks: `Automatically recorded. See WO: ${history.sourceWorkOrderId ? history.sourceWorkOrderId.slice(-8) : '—'}`,
                    sparesUsed: [] as SpareUsedItem[],
                    missedCycles: 0,
                    isSkipped: true,
                    componentCode: history.componentCode || '',
                    originalDueDate: history.originalDueDate,
                    skippedCycleDate: history.skippedCycleDate,
                    sourceWorkOrderId: history.sourceWorkOrderId
                  };
                }
                const daysLate = calcDaysLate(history.originalDueDate, history.completionDate || history.workDate);
                return {
                  date: history.completionDate || history.workDate,
                  workOrder: history.woNo,
                  description: history.description || '-',
                  performedBy: history.performedBy,
                  approvedBy: (history.approvedBy as string | null) || null,
                  runDate: history.runDate || '—',
                  status: history.status?.toLowerCase() === 'completed' ? ('completed' as const) : ('postponed' as const),
                  daysLate,
                  remarks: history.remarks || '-',
                  sparesUsed: (history.sparesUsed as SpareUsedItem[]) || [],
                  missedCycles: history.missedCycles || 0,
                  isSkipped: false,
                  componentCode: history.componentCode || '',
                  originalDueDate: history.originalDueDate,
                  skippedCycleDate: null,
                  sourceWorkOrderId: null
                };
              });

              const filteredHistory = allHistory.filter((h: any) => {
                const dateStr = h.date?.slice(0, 10) || '';
                if (historyComponentFilter && h.componentCode !== historyComponentFilter) return false;
                if (historyDateFrom && dateStr < historyDateFrom) return false;
                if (historyDateTo && dateStr > historyDateTo) return false;
                return true;
              });

              const totalCount = filteredHistory.length;
              const displayData = workHistoryExpanded
                ? filteredHistory.slice(workHistoryPage * WORK_HISTORY_PAGE_SIZE, (workHistoryPage + 1) * WORK_HISTORY_PAGE_SIZE)
                : filteredHistory.slice(0, WORK_HISTORY_COLLAPSED_COUNT);
              const totalPages = Math.ceil(totalCount / WORK_HISTORY_PAGE_SIZE);

              const hasFilters = !!historyPeriod;
              const fmtDate = (d: string | null | undefined) => d ? d.slice(0, 10) : '—';

              return (
                <>
                  {/* Filter bar */}
                  <div className="flex flex-wrap gap-2 items-center mb-3 p-2 bg-gray-50 rounded border border-gray-200" data-testid="history-filter-bar">
                    <PeriodPicker
                      value={historyPeriod}
                      onChange={handleHistoryPeriodChange}
                    />
                    {hasFilters && (
                      <button
                        type="button"
                        onClick={() => { handleHistoryPeriodChange(null); }}
                        data-testid="button-clear-history-filters"
                        className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded border border-gray-200 bg-white hover:bg-gray-100"
                      >
                        Clear
                      </button>
                    )}
                    <span className="ml-auto text-xs text-gray-500" data-testid="text-history-filter-count">
                      {hasFilters ? `${totalCount} of ${rawHistory.length}` : `${rawHistory.length}`} entries
                    </span>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-gray-200">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left p-2 font-medium text-gray-700" data-testid="WOF.A5.3"><Marker id="WOF.A5.3" />DATE</th>
                          <th className="text-left p-2 font-medium text-gray-700" data-testid="WOF.A5.4"><Marker id="WOF.A5.4" />WORK ORDER</th>
                          <th className="text-left p-2 font-medium text-gray-700" data-testid="WOF.A5.5"><Marker id="WOF.A5.5" />DESCRIPTION</th>
                          <th className="text-left p-2 font-medium text-gray-700" data-testid="WOF.A5.6"><Marker id="WOF.A5.6" />PERFORMED BY</th>
                          <th className="text-left p-2 font-medium text-gray-700" data-testid="WOF.A5.7"><Marker id="WOF.A5.7" />RUN. HOURS</th>
                          <th className="text-left p-2 font-medium text-gray-700" data-testid="WOF.A5.8"><Marker id="WOF.A5.8" />STATUS</th>
                          <th className="text-left p-2 font-medium text-gray-700">BACKDATING</th>
                          <th className="text-left p-2 font-medium text-gray-700">REMARKS</th>
                          <th className="w-8 p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayData.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="text-center p-4 text-gray-500 italic">
                              {hasFilters ? 'No matching history entries' : 'No data available'}
                            </td>
                          </tr>
                        ) : displayData.map((row: any, idx: number) => {
                          const isExpanded = expandedHistoryIndex === idx;
                          return (
                            <React.Fragment key={idx}>
                              <tr
                                onClick={() => setExpandedHistoryIndex(isExpanded ? null : idx)}
                                className={`border-b border-gray-200 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                data-testid={`row-history-${idx}`}
                              >
                                <td className="p-2" data-testid={idx === 0 ? "WOF.A5.9" : `text-history-date-${idx}`}>{idx === 0 && <Marker id="WOF.A5.9" />}{fmtDate(row.date)}</td>
                                <td className="p-2" data-testid={idx === 0 ? "WOF.A5.10" : `text-history-wo-${idx}`}>{idx === 0 && <Marker id="WOF.A5.10" />}{row.workOrder || '-'}</td>
                                <td className="p-2 max-w-[180px] truncate" data-testid={idx === 0 ? "WOF.A5.11" : `text-history-description-${idx}`} title={row.description}>{idx === 0 && <Marker id="WOF.A5.11" />}{row.description}</td>
                                <td className="p-2" data-testid={idx === 0 ? "WOF.A5.12" : `text-history-performed-by-${idx}`}>{idx === 0 && <Marker id="WOF.A5.12" />}{row.performedBy}</td>
                                <td className="p-2 text-gray-600" data-testid={`text-history-rh-${idx}`}>{row.runDate}</td>
                                <td className="p-2" data-testid={idx === 0 ? "WOF.A5.13" : `text-history-status-${idx}`}>
                                  {idx === 0 && <Marker id="WOF.A5.13" />}
                                  <div className="flex flex-col gap-1">
                                    {row.status === 'skipped' ? (
                                      <span className="px-2 py-0.5 rounded-full text-xs font-medium text-white whitespace-nowrap" style={{ backgroundColor: '#EF4444' }} data-testid={`badge-status-skipped-${row.date}`}>
                                        SKIPPED
                                      </span>
                                    ) : (
                                      <>
                                        <StatusPill status={row.status} />
                                        {(row.missedCycles || 0) >= 1 && (
                                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500 text-white whitespace-nowrap" data-testid={`badge-history-skipped-${row.workOrder}`}>
                                            ⚠ {row.missedCycles} Skipped
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </td>
                                <td className="p-2">
                                  {row.isSkipped || !row.daysLate ? (
                                    <span className="text-gray-400">—</span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 whitespace-nowrap" data-testid={`badge-backdating-${row.workOrder}`}>
                                      ⚠ {row.daysLate}d late
                                    </span>
                                  )}
                                </td>
                                <td className="p-2 max-w-[120px] truncate text-gray-600" data-testid={idx === 0 ? "WOF.A5.14" : `text-history-remarks-${idx}`}>{idx === 0 && <Marker id="WOF.A5.14" />}{row.remarks}</td>
                                <td className="p-2 text-gray-400">
                                  <ChevronDown className={`h-4 w-4 transition-transform duration-150 ${isExpanded ? 'rotate-180 text-blue-500' : ''}`} />
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr key={`detail-${idx}`}>
                                  <td colSpan={9} className="bg-blue-50 border-b border-blue-100 p-0">
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 px-6 py-4 text-sm" data-testid={`panel-history-detail-${idx}`}>
                                      {row.isSkipped ? (
                                        <>
                                          <div>
                                            <span className="font-medium text-gray-600">Skipped Cycle Date:</span>{' '}
                                            <span className="text-gray-800">{fmtDate(row.skippedCycleDate)}</span>
                                          </div>
                                          <div>
                                            <span className="font-medium text-gray-600">Source Work Order:</span>{' '}
                                            <span className="text-gray-800">{row.sourceWorkOrderId ? row.sourceWorkOrderId.slice(-8) : '—'}</span>
                                          </div>
                                          <div className="col-span-2">
                                            <span className="font-medium text-gray-600">Note:</span>{' '}
                                            <span className="text-gray-500 italic">This cycle was automatically recorded as skipped.</span>
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <div>
                                            <span className="font-medium text-gray-600">Completion Date:</span>{' '}
                                            <span className="text-gray-800">{row.date || '—'}</span>
                                          </div>
                                          <div>
                                            <span className="font-medium text-gray-600">Running Hours:</span>{' '}
                                            <span className="text-gray-800">{row.runDate !== '—' ? row.runDate : '—'}</span>
                                          </div>
                                          {row.daysLate > 0 && (
                                            <div>
                                              <span className="font-medium text-gray-600">Backdating:</span>{' '}
                                              <span className="text-amber-700 font-medium">{row.daysLate} day{row.daysLate !== 1 ? 's' : ''} late</span>
                                            </div>
                                          )}
                                          {(row.missedCycles || 0) > 0 && (
                                            <div>
                                              <span className="font-medium text-gray-600">Missed Cycles:</span>{' '}
                                              <span className="text-amber-700 font-medium">{row.missedCycles}</span>
                                            </div>
                                          )}
                                          <div>
                                            <span className="font-medium text-gray-600">Performed By:</span>{' '}
                                            <span className="text-gray-800">{row.performedBy || '—'}</span>
                                          </div>
                                          <div>
                                            <span className="font-medium text-gray-600">Approved By:</span>{' '}
                                            <span className="text-gray-800">{row.approvedBy || '—'}</span>
                                          </div>
                                          {row.componentCode && (
                                            <div>
                                              <span className="font-medium text-gray-600">Component:</span>{' '}
                                              <span className="text-gray-800">{row.componentCode}</span>
                                            </div>
                                          )}
                                          <div className="col-span-2">
                                            <span className="font-medium text-gray-600">Full Description:</span>{' '}
                                            <span className="text-gray-800">{row.description !== '-' ? row.description : '—'}</span>
                                          </div>
                                          <div className="col-span-2">
                                            <span className="font-medium text-gray-600">Remarks:</span>{' '}
                                            <span className="text-gray-800">{row.remarks !== '-' ? row.remarks : '—'}</span>
                                          </div>
                                          {(row.sparesUsed.length > 0) && (
                                            <div className="col-span-2">
                                              <span className="font-medium text-gray-600">Spare Parts Used:</span>
                                              <ul className="mt-1 space-y-0.5">
                                                {row.sparesUsed.map((sp, si) => (
                                                  <li key={si} className="text-gray-800">
                                                    {sp.partName || sp.partCode || 'Unknown'}{sp.quantity != null ? ` — qty: ${sp.quantity}` : ''}
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Collapsed controls */}
                  {!workHistoryExpanded && totalCount > WORK_HISTORY_COLLAPSED_COUNT && (
                    <div className="flex justify-center mt-3">
                      <button
                        type="button"
                        data-testid="button-show-all-history"
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium px-4 py-1.5 rounded border border-blue-200 hover:bg-blue-50 transition-colors"
                        onClick={() => { setWorkHistoryExpanded(true); setWorkHistoryPage(0); setExpandedHistoryIndex(null); }}
                      >
                        Show All History ({totalCount} entries)
                      </button>
                    </div>
                  )}

                  {/* Expanded pagination controls */}
                  {workHistoryExpanded && (
                    <div className="flex items-center justify-between mt-3">
                      <button
                        type="button"
                        data-testid="button-show-less-history"
                        className="text-sm text-gray-600 hover:text-gray-800 font-medium px-4 py-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors"
                        onClick={() => { setWorkHistoryExpanded(false); setWorkHistoryPage(0); setExpandedHistoryIndex(null); }}
                      >
                        Show Less
                      </button>
                      {totalPages > 1 && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <button
                            type="button"
                            data-testid="button-history-prev-page"
                            className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            disabled={workHistoryPage === 0}
                            onClick={() => { setWorkHistoryPage(p => Math.max(0, p - 1)); setExpandedHistoryIndex(null); }}
                          >
                            &laquo; Prev
                          </button>
                          <span data-testid="text-history-page-info">
                            Page {workHistoryPage + 1} of {totalPages}
                          </span>
                          <button
                            type="button"
                            data-testid="button-history-next-page"
                            className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            disabled={workHistoryPage >= totalPages - 1}
                            onClick={() => { setWorkHistoryPage(p => Math.min(totalPages - 1, p + 1)); setExpandedHistoryIndex(null); }}
                          >
                            Next &raquo;
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </SectionBlock>
          </div>

          {/* Part B - Work Completion Record (hidden for template mode) */}
          {resolvedMode !== 'template' && (
            <>
            <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-6 space-y-8">
              <div data-testid="WOF.B"><Marker id="WOF.B" /></div>
              <PartHeader
                id="part-b"
                label="Part B"
                title="Work Completion Record"
                description="Enter work completion details here including Risk assessment, checklists, comments etc."
                variant="inline"
              />

          {/* B1. Risk Assessment, Checklists & Records */}
          <div data-testid="WOF.B1.1"><Marker id="WOF.B1.1" /></div>
          <div data-testid="WOF.B1.2"><Marker id="WOF.B1.2" /></div>
          <SectionBlock
            id="completion"
            number="B1"
            title="Risk Assessment, Checklists & Records"
            variant="inline"
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
                        disabled={isPartBReadOnly}
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
                        disabled={isPartBReadOnly}
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
                        disabled={isPartBReadOnly}
                        className="text-blue-600" 
                        data-testid="WOF.B1.7"
                      />
                      <span className="text-sm">NA</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isReadOnly && !isPartBReadOnly && getDocsByType('riskAssessment').length < 5 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUploadDocument('riskAssessment', riskAssessmentFileRef)}
                        disabled={uploadingDocType !== null || executionData.riskAssessment !== "Yes"}
                        data-testid="button-upload-risk-assessment"
                      >
                        {uploadingDocType === 'riskAssessment' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                        Upload
                      </Button>
                    )}
                    <input
                      ref={riskAssessmentFileRef}
                      type="file"
                      className="hidden"
                      multiple
                      onChange={(e) => handleFileSelected(e, 'riskAssessment')}
                      accept=".pdf,.jpg,.jpeg,.png"
                    />
                    <span className="text-xs text-gray-400">{getDocsByType('riskAssessment').length}/5</span>
                  </div>
                  {renderDocIcons('riskAssessment', 'risk')}
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
                        disabled={isPartBReadOnly}
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
                        disabled={isPartBReadOnly}
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
                        disabled={isPartBReadOnly}
                        className="text-blue-600" 
                        data-testid="WOF.B1.14"
                      />
                      <span className="text-sm">NA</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isReadOnly && !isPartBReadOnly && getDocsByType('safetyChecklist').length < 5 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUploadDocument('safetyChecklist', safetyChecklistFileRef)}
                        disabled={uploadingDocType !== null || executionData.safetyChecklists !== "Yes"}
                        data-testid="button-upload-safety-checklist"
                      >
                        {uploadingDocType === 'safetyChecklist' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                        Upload
                      </Button>
                    )}
                    <input
                      ref={safetyChecklistFileRef}
                      type="file"
                      className="hidden"
                      multiple
                      onChange={(e) => handleFileSelected(e, 'safetyChecklist')}
                      accept=".pdf,.jpg,.jpeg,.png"
                    />
                    <span className="text-xs text-gray-400">{getDocsByType('safetyChecklist').length}/5</span>
                  </div>
                  {renderDocIcons('safetyChecklist', 'safety')}
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
                        disabled={isPartBReadOnly}
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
                        disabled={isPartBReadOnly}
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
                        disabled={isPartBReadOnly}
                        className="text-blue-600" 
                        data-testid="WOF.B1.21"
                      />
                      <span className="text-sm">NA</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isReadOnly && !isPartBReadOnly && getDocsByType('operationalForm').length < 5 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUploadDocument('operationalForm', operationalFormFileRef)}
                        disabled={uploadingDocType !== null || executionData.operationalForms !== "Yes"}
                        data-testid="button-upload-operational-form"
                      >
                        {uploadingDocType === 'operationalForm' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                        Upload
                      </Button>
                    )}
                    <input
                      ref={operationalFormFileRef}
                      type="file"
                      className="hidden"
                      multiple
                      onChange={(e) => handleFileSelected(e, 'operationalForm')}
                      accept=".pdf,.jpg,.jpeg,.png"
                    />
                    <span className="text-xs text-gray-400">{getDocsByType('operationalForm').length}/5</span>
                  </div>
                  {renderDocIcons('operationalForm', 'operational')}
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
            variant="inline"
          >
            <div className="space-y-6">
              {/* B2.1 Work Duration */}
              <div data-testid="WOF.B2.3"><Marker id="WOF.B2.3" />
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-gray-700" data-testid="WOF.B2.4"><Marker id="WOF.B2.4" />B2.1 Work Duration:</h4>
                  {(() => {
                    const woOrigDueDate = (workOrderContext as any)?.workOrder?.originalDueDate;
                    const woDateCompleted = (workOrderContext as any)?.workOrder?.dateCompleted || (workOrderContext as any)?.workOrder?.completionDateTime;
                    const isCompleted = currentWorkOrderStatus === 'Completed';
                    if (isCompleted && woOrigDueDate) {
                      const formattedScheduled = normalizeDateToDDMMMYYYY(woOrigDueDate) || woOrigDueDate;
                      const formattedCompletion = woDateCompleted ? (normalizeDateToDDMMMYYYY(woDateCompleted) || woDateCompleted) : '-';
                      return (
                        <div className="text-sm text-gray-500 font-medium text-right" data-testid="text-due-date-detail">
                          <div>Scheduled Due Date: <span className="text-gray-700">{formattedScheduled}</span></div>
                          <div>Actual Completion: <span className="text-gray-700">{formattedCompletion}</span></div>
                        </div>
                      );
                    }
                    if (workOrderDueDate) {
                      return (
                        <span className="text-sm text-gray-500 font-medium" data-testid="text-due-date">
                          Due Date: <span className="text-gray-700">{workOrderDueDate}</span>
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]" data-testid="WOF.B2.5"><Marker id="WOF.B2.5" />Start Date <span className="text-red-500">*</span></Label>
                    <Input
                      type="date"
                      value={executionData.startDateTime ? executionData.startDateTime.split('T')[0] : ''}
                      onChange={(e) => {
                        const currentTime = executionData.startDateTime ? executionData.startDateTime.split('T')[1] || '' : '';
                        handleExecutionChange('startDateTime', currentTime ? `${e.target.value}T${currentTime}` : e.target.value);
                      }}
                      disabled={isPartBReadOnly}
                      className="text-sm"
                      placeholder="dd-mm-yyyy"
                      data-testid="WOF.B2.6"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]" data-testid="WOF.B2.7"><Marker id="WOF.B2.7" />Start Time <span className="text-red-500">*</span></Label>
                    <Input
                      type="time"
                      value={executionData.startDateTime ? executionData.startDateTime.split('T')[1]?.substring(0, 5) || '' : ''}
                      onChange={(e) => {
                        const currentDate = executionData.startDateTime ? executionData.startDateTime.split('T')[0] : '';
                        handleExecutionChange('startDateTime', currentDate ? `${currentDate}T${e.target.value}` : e.target.value);
                      }}
                      disabled={isPartBReadOnly}
                      className="text-sm"
                      data-testid="WOF.B2.8"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]" data-testid="WOF.B2.9"><Marker id="WOF.B2.9" />Completion Date <span className="text-red-500">*</span></Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={executionData.completionDateTime ? executionData.completionDateTime.split('T')[0] : (executionData.dateOfCompletion || '')}
                        onChange={(e) => {
                          const currentTime = executionData.completionDateTime ? executionData.completionDateTime.split('T')[1] || '' : '';
                          handleExecutionChange('completionDateTime', currentTime ? `${e.target.value}T${currentTime}` : e.target.value);
                          handleExecutionChange('dateOfCompletion', e.target.value);
                        }}
                        disabled={isPartBReadOnly}
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
                        disabled={isPartBReadOnly}
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
                    <Label className="text-sm text-[#8798ad]" data-testid="WOF.B2.11"><Marker id="WOF.B2.11" />Completion Time <span className="text-red-500">*</span></Label>
                    <Input
                      type="time"
                      value={executionData.completionDateTime ? executionData.completionDateTime.split('T')[1]?.substring(0, 5) || '' : ''}
                      onChange={(e) => {
                        const currentDate = executionData.completionDateTime ? executionData.completionDateTime.split('T')[0] : '';
                        handleExecutionChange('completionDateTime', currentDate ? `${currentDate}T${e.target.value}` : e.target.value);
                      }}
                      disabled={isPartBReadOnly}
                      className="text-sm"
                      data-testid="WOF.B2.12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]" data-testid="WOF.B2.13"><Marker id="WOF.B2.13" />Performed by <span className="text-red-500">*</span></Label>
                    <Select
                      value={executionData.performedBy}
                      onValueChange={(value) => handleExecutionChange('performedBy', value)}
                      disabled={isPartBReadOnly}
                    >
                      <SelectTrigger className="text-sm" data-testid="WOF.B2.14">
                        <SelectValue placeholder="Select rank" />
                      </SelectTrigger>
                      <SelectContent>
                        {ranksForPerformedBy.map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]" data-testid="WOF.B2.15"><Marker id="WOF.B2.15" />No of Persons in the team <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      value={executionData.noOfPersons}
                      onChange={(e) => handleExecutionChange('noOfPersons', e.target.value)}
                      disabled={isPartBReadOnly}
                      className="text-sm"
                      placeholder="3"
                      min={1}
                      max={50}
                      step={1}
                      data-testid="WOF.B2.16"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]" data-testid="WOF.B2.17"><Marker id="WOF.B2.17" />Total Time Taken (Hours) <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      value={executionData.totalTimeHours}
                      readOnly
                      className="text-sm bg-gray-100"
                      placeholder="Auto-calculated"
                      data-testid="WOF.B2.18"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]" data-testid="WOF.B2.19"><Marker id="WOF.B2.19" />Manhours</Label>
                    <Input
                      type="number"
                      value={executionData.manhours}
                      readOnly
                      className="text-sm bg-gray-100"
                      placeholder="Auto-calculated"
                      data-testid="WOF.B2.20"
                    />
                  </div>
                </div>

                {(() => {
                  if (isPartBReadOnly) return null;
                  const maintenanceBasis = templateData.maintenanceBasis || (workOrderContext as any)?.maintenanceBasis;
                  if (maintenanceBasis === 'Running Hours') return null;
                  const completionDateVal = executionData.dateOfCompletion || (executionData.completionDateTime ? executionData.completionDateTime.split('T')[0] : '');
                  if (!completionDateVal || !workOrderDueDate) return null;
                  const liveMissed = calculateMissedCycles(workOrderDueDate, completionDateVal, templateData.frequencyValue, templateData.frequencyUnit);
                  if (liveMissed < 1) return null;
                  return (
                    <div
                      className="rounded-lg border-2 p-3 mt-3"
                      style={{ backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }}
                      data-testid="warning-live-skipped-cycles"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-base">⚠</span>
                        <p className="text-sm" style={{ color: '#92400E' }}>
                          <strong>WARNING:</strong> {liveMissed} job cycle{liveMissed > 1 ? 's' : ''} will be marked as skipped.
                          The completion date you entered is {liveMissed} cycle{liveMissed > 1 ? 's' : ''} past the scheduled due date.
                          This will be flagged in the audit trail and visible to the {hodLabel} and Superintendent.
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Work Carried Out */}
              <div className="space-y-2">
                {/* Header with Quick Input and Smart Suggestions buttons */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-[#8798ad]">Work Carried Out <span className="text-red-500">*</span></Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowQuickInputs(!showQuickInputs)}
                      disabled={isPartBReadOnly}
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
                      disabled={isPartBReadOnly}
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
                  <div className="flex-1 flex flex-col">
                    <Textarea
                      ref={workCarriedOutRef}
                      value={executionData.workCarriedOut}
                      onChange={(e) => handleExecutionChange('workCarriedOut', e.target.value)}
                      disabled={isPartBReadOnly}
                      maxLength={2000}
                      className="text-sm min-h-[100px]"
                      placeholder="Describe work carried out..."
                      data-testid="textarea-work-carried-out"
                    />
                    <span className="text-xs text-gray-400 text-right mt-1" data-testid="text-work-carried-out-count">{(executionData.workCarriedOut || '').length} / 2000</span>
                  </div>
                  {/* Upload button column */}
                  <div className="flex flex-col items-center gap-1 pt-1">
                    {!isReadOnly && !isPartBReadOnly && getDocsByType('other').length < 5 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleUploadDocument('other', workCarriedOutFileRef)}
                        disabled={uploadingDocType !== null}
                        className="h-8 px-3 text-xs font-medium border-gray-300 text-gray-600 hover:bg-gray-50"
                        data-testid="button-upload-work-carried-out"
                      >
                        {uploadingDocType === 'other' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                        Upload
                      </Button>
                    )}
                    <input
                      ref={workCarriedOutFileRef}
                      type="file"
                      className="hidden"
                      multiple
                      onChange={(e) => handleFileSelected(e, 'other')}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx"
                    />
                    <span className="text-xs text-gray-400">{getDocsByType('other').length}/5</span>
                  </div>
                </div>
                {renderDocIcons('other', 'other')}
              </div>

              {/* Job Experience / Notes */}
              <div className="space-y-2" data-testid="WOF.B2.21"><Marker id="WOF.B2.21" />
                <Label className="text-sm text-[#8798ad]" data-testid="WOF.B2.22"><Marker id="WOF.B2.22" />Job Experience / Notes</Label>
                <Textarea
                  value={executionData.jobExperienceNotes}
                  onChange={(e) => handleExecutionChange('jobExperienceNotes', e.target.value)}
                  disabled={isPartBReadOnly}
                  maxLength={2000}
                  className="text-sm min-h-[80px]"
                  placeholder="Job Experience / Notes"
                  data-testid="WOF.B2.23"
                />
                <span className="text-xs text-gray-400" data-testid="text-job-experience-count">{(executionData.jobExperienceNotes || '').length} / 2000</span>
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
            variant="inline"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <Label className="text-sm text-[#8798ad]" data-testid="text-component-actual-rh-label">Component Actual RH</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    value={
                      componentActualRHStatus === 'loading' ? 'Loading...' :
                      componentActualRHStatus === 'error' ? 'Failed to load' :
                      rhValidation.componentActualRH !== null ? `${rhValidation.componentActualRH.toLocaleString()} hrs` : 'N/A'
                    }
                    className={`text-sm font-semibold flex-1 ${
                      componentActualRHStatus === 'loaded' && rhValidation.componentActualRH !== null ? 'bg-green-50 border-green-300 text-green-800' :
                      componentActualRHStatus === 'error' ? 'bg-red-50 border-red-300 text-red-700' :
                      'bg-gray-50 border-gray-200 text-gray-400 italic'
                    }`}
                    disabled
                    data-testid="text-component-actual-rh"
                  />
                  {componentActualRHStatus === 'error' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchComponentActualRH}
                      className="shrink-0 text-xs border-red-300 text-red-600 hover:bg-red-50"
                      data-testid="button-retry-rh-fetch"
                      title="Retry loading component RH"
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      Retry
                    </Button>
                  )}
                </div>
                {componentActualRHStatus === 'loaded' && rhValidation.componentActualRH !== null && executionData.currentReading && Number(executionData.currentReading) > rhValidation.componentActualRH && (
                  <div className="text-xs text-red-600" data-testid="text-rh-cap-hint">
                    Maximum allowed: {rhValidation.componentActualRH.toLocaleString()} hours
                    {componentActualRHLastUpdated && (
                      <span className="ml-1 text-gray-500">
                        (updated {new Date(componentActualRHLastUpdated).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })})
                      </span>
                    )}
                  </div>
                )}
                {componentActualRHStatus === 'error' && (
                  <div className="text-xs text-red-600" data-testid="text-rh-fetch-error">
                    Unable to fetch component RH. Please retry or refresh the page.
                  </div>
                )}
                {componentActualRHStatus === 'loading' && (
                  <div className="text-xs text-gray-500 flex items-center gap-1" data-testid="text-rh-loading">
                    <Loader2 className="h-3 w-3 animate-spin" /> Fetching component running hours...
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-[#8798ad]" data-testid="WOF.B3.5"><Marker id="WOF.B3.5" />Current Reading{(workOrderContext as any)?.maintenanceBasis === 'Running Hours' && <span className="text-red-500"> *</span>}</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={executionData.currentReading}
                    onChange={(e) => handleExecutionChange('currentReading', e.target.value)}
                    disabled={isPartBReadOnly}
                    className={`text-sm flex-1 ${
                      rhValidation.status === 'valid' ? 'border-green-400 focus:ring-green-400' :
                      rhValidation.status === 'invalid' ? 'border-red-400 focus:ring-red-400' :
                      rhValidation.status === 'warning' ? 'border-orange-400 focus:ring-orange-400' :
                      ''
                    }`}
                    data-testid="WOF.B3.6"
                  />
                  {!isPartBReadOnly && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchCurrentRHFromModule}
                      className="shrink-0 text-xs"
                      data-testid="button-fetch-rh"
                      title="Fetch Current RH from Module"
                    >
                      <BarChart3 className="h-3.5 w-3.5 mr-1" />
                      Fetch RH
                    </Button>
                  )}
                </div>

                {/* RH Valid Range Helper */}
                {rhValidation.validRange && (
                  <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded" data-testid="text-rh-valid-range">
                    Valid range: {(() => { const prevR = executionData.previousReading ? Number(executionData.previousReading) : null; const displayMin = prevR !== null && !isNaN(prevR) && prevR < rhValidation.validRange.min ? prevR : rhValidation.validRange.min; return displayMin.toLocaleString(); })()} to {rhValidation.componentActualRH !== null && rhValidation.componentActualRH > 0 ? rhValidation.componentActualRH.toLocaleString() : (rhValidation.validRange.max === Infinity ? '∞' : rhValidation.validRange.max.toLocaleString())} hours
                    {rhValidation.previousEntry && (
                      <span className="ml-1 text-blue-500">
                        | Last: {rhValidation.previousEntry.runningHours.toFixed(0)} hrs on {new Date(rhValidation.previousEntry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                )}

                {/* Live Validation Feedback */}
                {rhValidation.status === 'loading' && (
                  <div className="text-xs text-gray-500 flex items-center gap-1" data-testid="text-rh-validating">
                    <Loader2 className="h-3 w-3 animate-spin" /> Validating...
                  </div>
                )}
                {rhValidation.status === 'valid' && (
                  <div className="text-xs text-green-600 flex items-center gap-1" data-testid="text-rh-valid">
                    <CheckCircle2 className="h-3 w-3" /> {rhValidation.message}
                  </div>
                )}
                {rhValidation.status === 'invalid' && rhValidation.validationDetails?.validationStatus === 'EXCEEDS_COMPONENT_RH' && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-300 rounded-md" data-testid="text-rh-exceeds-component">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-red-800 mb-1">
                      <AlertTriangle className="h-4 w-4 text-red-600" /> Invalid Running Hours Entry
                    </div>
                    <p className="text-xs text-red-700 mb-1.5">
                      The Current Reading you entered ({executionData.currentReading} hours) exceeds the component's actual running hours ({rhValidation.componentActualRH} hours).
                      You cannot complete maintenance at a running hour that the component has not reached yet.
                    </p>
                    <p className="text-xs text-red-700 font-medium">
                      ACTION REQUIRED: Update the component's running hours in the Running Hours module first, or enter a Current Reading value ≤ {rhValidation.componentActualRH} hours.
                    </p>
                    <a
                      href={`/pms/running-hours?vesselId=${encodeURIComponent((workOrderContext as any)?.workOrder?.vesselId || '')}&componentCode=${encodeURIComponent(templateData.componentCode || '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-2 underline"
                      data-testid="link-rh-module"
                    >
                      <ExternalLink className="h-3 w-3" /> Open Running Hours Module
                    </a>
                  </div>
                )}
                {rhValidation.status === 'invalid' && rhValidation.validationDetails?.validationStatus !== 'EXCEEDS_COMPONENT_RH' && (
                  <div className="text-xs text-red-600 flex items-center gap-1" data-testid="text-rh-invalid">
                    <X className="h-3 w-3" /> Invalid: {rhValidation.validRange ? (() => { const prevR = executionData.previousReading ? Number(executionData.previousReading) : null; const displayMin = prevR !== null && !isNaN(prevR) && prevR < rhValidation.validRange!.min ? prevR : rhValidation.validRange!.min; return `Valid range: ${displayMin.toLocaleString()} to ${rhValidation.validRange!.max === Infinity ? '∞' : rhValidation.validRange!.max.toLocaleString()} hours`; })() : rhValidation.message}
                  </div>
                )}
                {rhValidation.status === 'warning' && (
                  <div className="text-xs text-orange-600 flex items-center gap-1" data-testid="text-rh-warning">
                    <AlertTriangle className="h-3 w-3" /> High utilization: {rhValidation.utilizationRate.toFixed(1)} hrs/day — justification required
                  </div>
                )}

                {!isPartBReadOnly && (workOrderContext as any)?.maintenanceBasis === 'Running Hours' && componentActualRHStatus === 'loaded' && (
                  <div className="mt-1">
                    <a
                      href={`/pms/running-hours?vesselId=${encodeURIComponent((workOrderContext as any)?.workOrder?.vesselId || '')}&componentCode=${encodeURIComponent(templateData.componentCode || '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
                      data-testid="link-view-rh-module"
                    >
                      <BarChart3 className="h-3 w-3" /> View Component Running Hours
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* HOD Approval Remarks (for completed WOs) */}
            {(workOrderContext as any)?.workOrder?.status === 'Completed' && (workOrderContext as any)?.workOrder?.ceApprovalRemarks && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm" data-testid="ce-approval-remarks-display">
                <div className="font-medium text-blue-800 mb-1">{hodShort} Approval Remarks</div>
                <p className="text-blue-900 text-xs whitespace-pre-wrap">{(workOrderContext as any).workOrder.ceApprovalRemarks}</p>
              </div>
            )}

            {/* Completion RH Info (for completed WOs) */}
            {(workOrderContext as any)?.workOrder?.status === 'Completed' && (workOrderContext as any)?.workOrder?.completionRH && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm" data-testid="rh-completion-info">
                <div className="font-medium text-gray-700 mb-1">Completion RH Information</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                  <div>Running Hours: <span className="font-medium text-gray-900">{(workOrderContext as any).workOrder.completionRH} hrs</span>
                    {(workOrderContext as any).workOrder.completionRHValidated && <CheckCircle2 className="inline h-3 w-3 text-green-500 ml-1" />}
                  </div>
                  <div>Source: <span className="font-medium">{(workOrderContext as any).workOrder.completionRHSource || 'Manual'}</span></div>
                  {(workOrderContext as any).workOrder.completionRHValidationDetails?.utilizationRate > 0 && (
                    <div>Avg Usage: <span className="font-medium">{(workOrderContext as any).workOrder.completionRHValidationDetails.utilizationRate.toFixed(1)} hrs/day</span></div>
                  )}
                  {(workOrderContext as any).workOrder.rhJustification && (
                    <div className="col-span-2">Justification: <span className="font-medium text-orange-700">{(workOrderContext as any).workOrder.rhJustification}</span></div>
                  )}
                </div>
              </div>
            )}

            {/* View RH Timeline Button */}
            {(workOrderContext as any)?.component?.id && (
              <div className="mt-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRhTimelineOpen(true)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                  data-testid="button-view-rh-timeline"
                >
                  <BarChart3 className="h-3.5 w-3.5 mr-1" />
                  View RH Timeline
                </Button>
              </div>
            )}
          </SectionBlock>

          {/* B4. Spare Parts Consumed */}
          <div data-testid="WOF.B4.1"><Marker id="WOF.B4.1" /></div>
          <div data-testid="WOF.B4.2"><Marker id="WOF.B4.2" /></div>
          <SectionBlock
            id="spare-parts-consumed"
            number="B4"
            title="Spare Parts Consumed"
            variant="inline"
          >
            <div className="space-y-3">
              <div className="flex justify-end">
                {!isReadOnly && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenSparePartsModal}
                  disabled={isPartBReadOnly}
                  data-testid="WOF.B4.10"
                >
                  <Marker id="WOF.B4.10" />
                  + Add Spare Part
                </Button>
                )}
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

                      // Get locations from Spares table per spec: location -> rob_location_a, location_2 -> rob_location_b
                      const spareLocations = getAvailableLocationsForSpare(sparePartCode || spare.partNo);
                      const autoSelectedLocationField = getAutoSelectedLocationField(sparePartCode || spare.partNo);

                      // Calculate if current quantity exceeds ROB at selected location
                      const currentQty = parseFloat(consumedData?.quantityConsumed || '0') || 0;
                      const selectedLocation = consumedData?.location || '';
                      const availableRob = selectedLocation && sparePartCode 
                        ? getRobByLocationName(sparePartCode, selectedLocation) 
                        : 0;
                      const exceedsRob = currentQty > 0 && selectedLocation && currentQty > availableRob;

                      return (
                        <tr key={`preloaded-${index}`} className="border-b border-gray-100">
                          <td className="py-3 text-gray-900">{spare.partNo || '-'}</td>
                          <td className="py-3 text-gray-700">{spare.description}</td>
                          <td className="py-3">
                            <div className="flex flex-col gap-1">
                              <Input
                                type="number"
                                min="1"
                                step="1"
                                max={selectedLocation ? availableRob : undefined}
                                value={consumedData?.quantityConsumed || ''}
                                onChange={(e) => {
                                  const newValue = e.target.value;
                                  const lookupKey = sparePartCode || spare.partNo;
                                  const autoLoc = autoSelectedLocationField ? getLocationName(lookupKey, autoSelectedLocationField) : null;
                                  setExecutionData(prev => {
                                    const consumed = [...prev.consumedSpareParts];
                                    const freshIndex = consumed.findIndex(c =>
                                      (sparePartCode && c.partCode === sparePartCode) ||
                                      (!sparePartCode && spare.partNo && c.partNo === spare.partNo)
                                    );
                                    if (freshIndex >= 0) {
                                      consumed[freshIndex] = {
                                        ...consumed[freshIndex],
                                        quantityConsumed: newValue,
                                        location: consumed[freshIndex].location || autoLoc || ''
                                      };
                                    } else {
                                      consumed.push({
                                        partNo: spare.partNo,
                                        partCode: sparePartCode,
                                        description: spare.description,
                                        quantityConsumed: newValue,
                                        location: autoLoc || '',
                                        locationId: null,
                                        comments: ''
                                      });
                                    }
                                    return { ...prev, consumedSpareParts: consumed };
                                  });
                                }}
                                disabled={isReadOnly}
                                className={`text-sm h-8 w-20 ${exceedsRob ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                                data-testid={`input-consumed-qty-${sparePartCode || spare.partNo || index}`}
                              />
                              {exceedsRob && (
                                <span className="text-xs text-red-500">Max: {availableRob}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3">
                            {/* Location dropdown using Spares table: location -> rob_location_a, location_2 -> rob_location_b */}
                            <Select
                              value={consumedData?.location || ''}
                              onValueChange={(locationName) => {
                                setExecutionData(prev => {
                                  const consumed = [...prev.consumedSpareParts];
                                  const freshIndex = consumed.findIndex(c =>
                                    (sparePartCode && c.partCode === sparePartCode) ||
                                    (!sparePartCode && spare.partNo && c.partNo === spare.partNo)
                                  );
                                  if (freshIndex >= 0) {
                                    consumed[freshIndex] = {
                                      ...consumed[freshIndex],
                                      location: locationName as any,
                                      locationId: null
                                    };
                                  } else {
                                    consumed.push({
                                      partNo: spare.partNo,
                                      partCode: sparePartCode,
                                      description: spare.description,
                                      quantityConsumed: '',
                                      location: locationName as any,
                                      locationId: null,
                                      comments: ''
                                    });
                                  }
                                  return { ...prev, consumedSpareParts: consumed };
                                });
                              }}
                              disabled={isReadOnly}
                            >
                              <SelectTrigger className="h-8 text-xs" data-testid={`select-location-${sparePartCode || spare.partNo || index}`}>
                                <SelectValue placeholder="Select location" />
                              </SelectTrigger>
                              <SelectContent>
                                {spareLocations.length > 0 ? (
                                  spareLocations.map((loc, locIdx) => (
                                    <SelectItem key={locIdx} value={loc.name}>
                                      {loc.name} ({loc.robValue} avail)
                                    </SelectItem>
                                  ))
                                ) : (
                                  <SelectItem value="none" disabled>No locations configured</SelectItem>
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
                                  const freshIndex = consumed.findIndex(c =>
                                    (sparePartCode && c.partCode === sparePartCode) ||
                                    (!sparePartCode && spare.partNo && c.partNo === spare.partNo)
                                  );
                                  if (freshIndex >= 0) {
                                    consumed[freshIndex] = {
                                      ...consumed[freshIndex],
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
                              disabled={isReadOnly}
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

                        // Calculate if current quantity exceeds ROB at selected location
                        const manualCurrentQty = parseFloat(consumed.quantityConsumed || '0') || 0;
                        const manualSelectedLocation = consumed.location || '';
                        const manualPartCode = consumed.partCode || '';
                        const manualAvailableRob = manualSelectedLocation && manualPartCode 
                          ? getRobByLocationName(manualPartCode, manualSelectedLocation) 
                          : 0;
                        const manualExceedsRob = manualCurrentQty > 0 && manualSelectedLocation && manualCurrentQty > manualAvailableRob;

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
                                  <div className="flex flex-col gap-1">
                                    <Input
                                      type="number"
                                      min="1"
                                      step="1"
                                      max={manualSelectedLocation ? manualAvailableRob : undefined}
                                      value={consumed.quantityConsumed}
                                      onChange={(e) => {
                                        setExecutionData(prev => {
                                          const updated = [...prev.consumedSpareParts];
                                          updated[actualIndex] = { ...updated[actualIndex], quantityConsumed: e.target.value };
                                          return { ...prev, consumedSpareParts: updated };
                                        });
                                      }}
                                      disabled={isReadOnly}
                                      className={`text-sm h-8 w-20 ${manualExceedsRob ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                                      onBlur={() => setEditingConsumedSparePart(null)}
                                    />
                                    {manualExceedsRob && (
                                      <span className="text-xs text-red-500">Max: {manualAvailableRob}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3">
                                  {(() => {
                                    const manualSpareLocations = consumed.partCode ? getAvailableLocationsForSpare(consumed.partCode) : [];
                                    return (
                                      <Select
                                        value={consumed.location || ''}
                                        onValueChange={(locationName) => {
                                          setExecutionData(prev => {
                                            const updated = [...prev.consumedSpareParts];
                                            updated[actualIndex] = { 
                                              ...updated[actualIndex], 
                                              location: locationName,
                                              locationId: null
                                            };
                                            return { ...prev, consumedSpareParts: updated };
                                          });
                                        }}
                                        disabled={isReadOnly}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue placeholder="Select" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {manualSpareLocations.length > 0 ? (
                                            manualSpareLocations.map((loc, idx) => (
                                              <SelectItem key={idx} value={loc.name}>
                                                {loc.name} ({loc.robValue} avail)
                                              </SelectItem>
                                            ))
                                          ) : (
                                            <SelectItem value="none" disabled>No locations configured</SelectItem>
                                          )}
                                        </SelectContent>
                                      </Select>
                                    );
                                  })()}
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
                                    disabled={isReadOnly}
                                    className="text-sm h-8"
                                  />
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-3 text-gray-900">{consumed.partNo || '-'}</td>
                                <td className="py-3 text-gray-700">{consumed.description || '-'}</td>
                                <td className="py-3">
                                  <div className="flex flex-col gap-1">
                                    <Input
                                      type="number"
                                      min="0"
                                      max={manualSelectedLocation ? manualAvailableRob : undefined}
                                      value={consumed.quantityConsumed}
                                      onChange={(e) => {
                                        setExecutionData(prev => {
                                          const updated = [...prev.consumedSpareParts];
                                          updated[actualIndex] = { ...updated[actualIndex], quantityConsumed: e.target.value };
                                          return { ...prev, consumedSpareParts: updated };
                                        });
                                      }}
                                      disabled={isReadOnly}
                                      className={`text-sm h-8 w-20 ${manualExceedsRob ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                                    />
                                    {manualExceedsRob && (
                                      <span className="text-xs text-red-500">Max: {manualAvailableRob}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3">
                                  {(() => {
                                    const viewSpareLocations = consumed.partCode ? getAvailableLocationsForSpare(consumed.partCode) : [];
                                    return (
                                      <Select
                                        value={consumed.location || ''}
                                        onValueChange={(locationName) => {
                                          setExecutionData(prev => {
                                            const updated = [...prev.consumedSpareParts];
                                            updated[actualIndex] = { 
                                              ...updated[actualIndex], 
                                              location: locationName,
                                              locationId: null
                                            };
                                            return { ...prev, consumedSpareParts: updated };
                                          });
                                        }}
                                        disabled={isReadOnly}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue placeholder="Select" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {viewSpareLocations.length > 0 ? (
                                            viewSpareLocations.map((loc, idx) => (
                                              <SelectItem key={idx} value={loc.name}>
                                                {loc.name} ({loc.robValue} avail)
                                              </SelectItem>
                                            ))
                                          ) : (
                                            <SelectItem value="none" disabled>No locations configured</SelectItem>
                                          )}
                                        </SelectContent>
                                      </Select>
                                    );
                                  })()}
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
                                    disabled={isReadOnly}
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
          </div>

          {/* Approval Section - Only visible for Pending Approval work orders, hidden in embedded mode and vessel view */}
          {!embedded && currentWorkOrderStatus === 'Pending Approval' && !isVessel && (() => {
            const approvalMissedCycles = (workOrderContext as any)?.workOrder?.missedCycles || 0;
            const approvalOriginalDueDate = (workOrderContext as any)?.workOrder?.originalDueDate || '';
            const approvalDateCompleted = (workOrderContext as any)?.workOrder?.dateCompleted || (workOrderContext as any)?.workOrder?.completionDateTime || '';
            const approvalDaysLate = (workOrderContext as any)?.workOrder?.daysLate || 0;
            const approvalTier: string = (workOrderContext as any)?.workOrder?.approvalTier || 'standard';
            const justificationValid = skippedCyclesJustification.trim().length >= 30;

            const isSuptLocked = approvalTier === 'superintendent_locked';
            const ceRemarksRequired = approvalTier === 'superintendent_locked' || approvalTier === 'superintendent_notification' || approvalTier === 'ce_with_justification';
            const ceRemarksMinLength = (approvalTier === 'superintendent_locked' || approvalTier === 'superintendent_notification') ? 20 : approvalTier === 'ce_with_justification' ? 10 : 0;
            const ceRemarksValid = !ceRemarksRequired || ceApprovalRemarks.trim().length >= ceRemarksMinLength;

            const approveDisabled = isProcessingApproval || isSuptLocked || (approvalMissedCycles >= 1 && !justificationValid) || !ceRemarksValid;

            const formatDateForDisplay = (dateStr: string) => {
              if (!dateStr) return '—';
              try {
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return dateStr;
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                return `${String(d.getDate()).padStart(2,'0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
              } catch { return dateStr; }
            };

            const tierBannerConfig = (() => {
              switch (approvalTier) {
                case 'superintendent_locked':
                  return {
                    bg: '#dc2626', color: '#ffffff',
                    title: 'HIGH SEVERITY \u2014 APPROVAL LOCKED \u2014 SUPERINTENDENT ACTION REQUIRED',
                    body: `This work order has high severity issues (${approvalMissedCycles >= 3 ? `${approvalMissedCycles} missed cycles` : ''}${approvalDaysLate >= 21 ? `${approvalMissedCycles >= 3 ? ', ' : ''}${approvalDaysLate} days late` : ''}). It is LOCKED and cannot be approved by the ${hodLabel} until the Superintendent has acknowledged it. Once acknowledged, the ${hodShort} will be required to enter detailed remarks (minimum 20 characters) before approving.`
                  };
                case 'superintendent_notification':
                  return {
                    bg: '#ea580c', color: '#ffffff',
                    title: 'MEDIUM SEVERITY \u2014 SUPERINTENDENT HAS BEEN NOTIFIED',
                    body: `This work order has medium severity issues (${approvalMissedCycles === 2 ? `${approvalMissedCycles} missed cycles` : ''}${approvalDaysLate >= 14 ? `${approvalMissedCycles === 2 ? ', ' : ''}${approvalDaysLate} days late` : ''}). The Superintendent has been automatically notified. ${hodLabel} approval is permitted but DETAILED REMARKS ARE MANDATORY (minimum 20 characters).`
                  };
                case 'ce_with_justification':
                  return {
                    bg: '#854d0e', color: '#ffffff',
                    title: `LOW SEVERITY \u2014 ${hodShort} REMARKS REQUIRED`,
                    body: `This work order has low severity issues (${approvalMissedCycles === 1 ? `${approvalMissedCycles} missed cycle` : ''}${approvalDaysLate >= 7 ? `${approvalMissedCycles === 1 ? ', ' : ''}${approvalDaysLate} days late` : ''}). ${hodLabel} approval remarks are mandatory (minimum 10 characters).`
                  };
                default:
                  return {
                    bg: '#1d4ed8', color: '#ffffff',
                    title: `PENDING ${hodLabel.toUpperCase()} APPROVAL`,
                    body: approvalDaysLate === 0
                      ? 'This completion was on time. Please review and approve.'
                      : `This completion is ${approvalDaysLate} days late. Please review and approve.`
                  };
              }
            })();

            const tierBadgeConfig = (() => {
              switch (approvalTier) {
                case 'superintendent_locked':
                  return { bg: '#dc2626', color: '#ffffff', label: '\uD83D\uDD12 Locked \u2014 Superintendent Required' };
                case 'superintendent_notification':
                  return { bg: '#ea580c', color: '#ffffff', label: `${hodShort} Approval + Superintendent Notified` };
                case 'ce_with_justification':
                  return { bg: '#854d0e', color: '#ffffff', label: `${hodShort} Approval + Remarks` };
                default:
                  return { bg: '#16a34a', color: '#ffffff', label: 'Standard Approval' };
              }
            })();

            return (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mt-4" data-testid="WOF.B5.1"><Marker id="WOF.B5.1" />
              <div className="space-y-4">

                {/* Rejection History (only shown if at least one prior rejection exists) */}
                {workOrderId && (
                  <RejectionHistorySection entityType="work-order" entityId={workOrderId} />
                )}

                {/* Layer 5: Approval Tier Banner */}
                <div
                  style={{ backgroundColor: tierBannerConfig.bg, color: tierBannerConfig.color }}
                  className="rounded-md p-4"
                  data-testid="banner-approval-tier"
                >
                  <p className="font-bold text-sm mb-2" data-testid="text-approval-tier-title">{tierBannerConfig.title}</p>
                  <p className="text-sm leading-relaxed" data-testid="text-approval-tier-body">{tierBannerConfig.body}</p>
                </div>

                {/* Layer 5: Approval Tier Badge */}
                <div className="flex items-center gap-2" data-testid="approval-tier-badge-container">
                  <span
                    style={{ backgroundColor: tierBadgeConfig.bg, color: tierBadgeConfig.color }}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold"
                    data-testid="badge-approval-tier"
                  >
                    {tierBadgeConfig.label}
                  </span>
                </div>

                {/* Layer 4B: Skipped Cycles Justification (existing - preserved) */}
                {approvalMissedCycles >= 1 && (
                  <>
                    <div
                      style={{ backgroundColor: '#FEF2F2', border: '1px solid #EF4444', borderLeft: '4px solid #EF4444' }}
                      className="rounded-md p-4"
                      data-testid="alert-skipped-cycles-justification"
                    >
                      <p style={{ color: '#991B1B' }} className="font-bold text-sm mb-2">MANDATORY ACKNOWLEDGEMENT REQUIRED</p>
                      <p style={{ color: '#7F1D1D' }} className="text-sm leading-relaxed">
                        This work order has <strong>{approvalMissedCycles}</strong> skipped maintenance cycle{approvalMissedCycles > 1 ? 's' : ''}.
                        {approvalOriginalDueDate && <> The scheduled due date was <strong>{formatDateForDisplay(approvalOriginalDueDate)}</strong>.</>}
                        {approvalDateCompleted && <> The work was completed on <strong>{formatDateForDisplay(approvalDateCompleted)}</strong>.</>}
                      </p>
                      <p style={{ color: '#7F1D1D' }} className="text-sm mt-2">
                        As {hodLabel}, you must provide a written justification explaining why these maintenance cycles were missed before you can approve this work order.
                      </p>
                    </div>

                    <div className="space-y-2" data-testid="field-skipped-cycles-justification">
                      <Label style={{ color: '#991B1B' }} className="text-sm font-semibold">Justification for Skipped Cycles *</Label>
                      <Textarea
                        value={skippedCyclesJustification}
                        onChange={(e) => setSkippedCyclesJustification(e.target.value)}
                        maxLength={500}
                        placeholder={`Required: Explain why ${approvalMissedCycles} maintenance cycle${approvalMissedCycles > 1 ? 's were' : ' was'} missed. Include operational reasons, vessel conditions, or any other relevant factors. This will be permanently recorded in the audit trail.`}
                        style={{ border: '2px solid #EF4444', borderRadius: '6px' }}
                        className="text-sm min-h-[120px] p-3 focus:border-[#DC2626] focus:ring-0 focus:outline-none"
                        data-testid="input-skipped-cycles-justification"
                      />
                      <span
                        className="text-xs text-right block"
                        style={{ color: skippedCyclesJustification.trim().length < 30 ? '#EF4444' : '#6B7280' }}
                        data-testid="text-justification-char-count"
                      >
                        {skippedCyclesJustification.trim().length} / 500 (minimum 30 characters required)
                      </span>
                    </div>
                  </>
                )}

                {/* Layer 5: HOD Approval Remarks */}
                <div className="space-y-2" data-testid="field-ce-approval-remarks">
                  <Label className="text-sm font-semibold">
                    {hodShort} Approval Remarks
                    {ceRemarksRequired && <span className="text-red-600 ml-1">*</span>}
                    {!ceRemarksRequired && !isSuptLocked && <span className="text-gray-400 ml-1">(Optional)</span>}
                  </Label>
                  <Textarea
                    value={ceApprovalRemarks}
                    onChange={(e) => setCeApprovalRemarks(e.target.value)}
                    maxLength={500}
                    disabled={isSuptLocked}
                    placeholder={isSuptLocked
                      ? 'Locked \u2014 Superintendent action required first'
                      : ceRemarksRequired
                        ? `Enter approval remarks (minimum ${ceRemarksMinLength} characters)...`
                        : 'Enter optional approval remarks...'
                    }
                    className={`text-sm min-h-[100px] ${isSuptLocked ? 'bg-gray-100 cursor-not-allowed' : ''} ${ceRemarksRequired && ceApprovalRemarks.trim().length < ceRemarksMinLength ? 'border-red-400' : 'border-gray-200'}`}
                    data-testid="input-ce-approval-remarks"
                  />
                  <div className="flex justify-between items-center">
                    {isSuptLocked && (
                      <span className="text-xs text-gray-500" data-testid="text-ce-remarks-helper">🔒 Locked — cannot enter remarks until Superintendent acknowledges</span>
                    )}
                    {(approvalTier === 'superintendent_locked' || approvalTier === 'superintendent_notification') && (
                      <span className="text-xs text-red-500" data-testid="text-ce-remarks-helper">
                        {ceApprovalRemarks.trim().length < 20
                          ? `Detailed remarks required — minimum 20 characters (currently ${ceApprovalRemarks.trim().length} characters)`
                          : `Required — minimum 20 characters (${approvalTier === 'superintendent_locked' ? 'high' : 'medium'} severity)`}
                      </span>
                    )}
                    {approvalTier === 'ce_with_justification' && (
                      <span className="text-xs text-red-500" data-testid="text-ce-remarks-helper">
                        {ceApprovalRemarks.trim().length < 10
                          ? `Approval remarks required — minimum 10 characters (currently ${ceApprovalRemarks.trim().length} characters)`
                          : 'Required — minimum 10 characters (low severity)'}
                      </span>
                    )}
                    {approvalTier === 'standard' && <span className="text-xs text-gray-400">Optional</span>}
                    {!approvalTier && <span className="text-xs text-gray-400">Optional</span>}
                    <span className="text-xs text-gray-400" data-testid="text-ce-remarks-char-count">{ceApprovalRemarks.length} / 500</span>
                  </div>
                </div>

                {/* Rejection Comments */}
                <div className="space-y-2" data-testid="WOF.B5.2"><Marker id="WOF.B5.2" />
                  <Label className="text-base font-semibold text-[#17a2b8]">Rejection Comments</Label>
                  <Textarea
                    value={rejectionComments}
                    onChange={(e) => setRejectionComments(e.target.value)}
                    maxLength={500}
                    placeholder="Enter rejection comments..."
                    className="text-sm min-h-[100px] border-gray-200"
                    data-testid="WOF.B5.2.1"
                  />
                  <span className="text-xs text-gray-400 text-right" data-testid="text-rejection-comments-count">{(rejectionComments || '').length} / 500</span>
                </div>

                {/* Approve / Reject Buttons */}
                <div className="flex justify-center gap-4 pt-2" data-testid="WOF.B5.3"><Marker id="WOF.B5.3" />
                  {isSuptLocked ? (
                    <Button
                      disabled
                      className="bg-gray-400 cursor-not-allowed text-white font-semibold px-8 py-2.5 h-auto text-sm rounded-full shadow-md min-w-[120px]"
                      data-testid="button-locked-awaiting-superintendent"
                    >
                      Locked — Awaiting Superintendent
                    </Button>
                  ) : (
                    <Button
                      onClick={handleApprove}
                      disabled={approveDisabled}
                      className={`font-semibold px-8 py-2.5 h-auto text-sm rounded-full shadow-md min-w-[120px] ${approveDisabled && !isProcessingApproval ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-[#28a745] hover:bg-[#218838] text-white'}`}
                      title={approvalMissedCycles >= 1 && !justificationValid ? 'Please provide justification for skipped cycles before approving' : !ceRemarksValid ? `Please enter at least ${ceRemarksMinLength} characters in ${hodShort} Approval Remarks` : undefined}
                      data-testid="WOF.B5.4"
                    >
                      <Marker id="WOF.B5.4" />
                      {isProcessingApproval ? 'Processing...' : 'Approve'}
                    </Button>
                  )}
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
            );
          })()}

          {/* Read-only HOD Justification for completed WOs with skipped cycles */}
          {currentWorkOrderStatus === 'Completed' && (workOrderContext as any)?.workOrder?.skippedCyclesJustification && (
            <div className="mt-4 rounded-lg p-4" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }} data-testid="display-skipped-cycles-justification">
              <Label style={{ color: '#991B1B' }} className="text-sm font-semibold block mb-2">{hodShort} Justification for Skipped Cycles</Label>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{(workOrderContext as any).workOrder.skippedCyclesJustification}</p>
            </div>
          )}

            </>
          )}

          {/* Save/Submit Button at Bottom - Hidden for Pending Approval (unless rejected), Completed work orders, and embedded mode */}
          {!embedded && (currentWorkOrderStatus !== 'Pending Approval' || isRejectedWO) && currentWorkOrderStatus !== 'Completed' && (() => {
            const isRHBased = (workOrderContext as any)?.maintenanceBasis === 'Running Hours';
            const currentRHVal = executionData.currentReading;
            const capRH = rhValidation.componentActualRH;
            const rhExceedsActual = isRHBased && currentRHVal && capRH !== null && Number(currentRHVal) > capRH;
            const rhNotLoaded = isRHBased && componentActualRHStatus === 'loading';
            const rhFetchFailed = isRHBased && componentActualRHStatus === 'error';
            const rhInvalid = rhValidation.status === 'invalid' && !isRejectedWO;
            const isRHSaveBlocked = rhExceedsActual || rhNotLoaded || rhFetchFailed || rhInvalid;
            const rhBlockReason = rhExceedsActual ? `Cannot save: Current Reading (${currentRHVal}) exceeds component's actual RH (${capRH})` :
              rhNotLoaded ? 'Cannot save: Component running hours are still loading' :
              rhFetchFailed ? 'Cannot save: Unable to verify component running hours' :
              rhInvalid ? 'Cannot save: Running hours validation failed' : '';
            const handleBottomSubmit = () => {
              if (isUnplannedCreate) {
                handleSaveUnplannedCreate();
              } else if (isExistingDraftUnplanned) {
                forceSubmitOnly.current = true;
                handleSave();
              } else {
                handleSave();
              }
            };
            return (
              <div className="flex justify-end mt-6 pb-6" data-testid="WOF6"><Marker id="WOF6" />
                <div title={isRHSaveBlocked && !showDraftActions ? rhBlockReason : ''}>
                  <Button
                    onClick={isNewJobCreation ? handleSaveNewJob : showDraftActions ? handleBottomSubmit : handleSave}
                    disabled={showDraftActions ? (isUnplannedCreate ? isUnplannedSaving : false) : !!isRHSaveBlocked}
                    className={`font-bold px-12 py-2.5 h-auto text-sm shadow-md ${
                      (showDraftActions ? (isUnplannedCreate ? isUnplannedSaving : false) : isRHSaveBlocked)
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed hover:bg-gray-400'
                        : 'bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white'
                    }`}
                    data-testid="WOF6.1"
                  >
                    <Marker id="WOF6.1" />
                    {isNewJobCreation ? 'Create Job' : showDraftActions ? (isUnplannedSaving ? 'Submitting...' : 'Submit Work Order') : 'Save'}
                  </Button>
                </div>
              </div>
            );
          })()}
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

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        open={!!previewDoc}
        onOpenChange={(open) => { if (!open) setPreviewDoc(null); }}
        documentId={previewDoc?.id || null}
        fileName={previewDoc?.fileName || ''}
        fileType={previewDoc?.fileType || ''}
        fileSize={previewDoc?.fileSize}
        fetchUrl={previewDoc?.fetchUrl}
      />

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

      {/* Spare Parts Selection Modal for Section A2 */}
      <Dialog open={isA2SpareModalOpen} onOpenChange={setIsA2SpareModalOpen}>
        <DialogContent className="max-w-[75vw] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Required Spare Parts for Component: {templateData.componentCode}</DialogTitle>
            <DialogDescription>
              Select spare parts linked to this component to add as required spare parts.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {isLoadingA2Spares ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">Loading spare parts...</div>
              </div>
            ) : a2LinkedSpares.length === 0 ? (
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
                    <th className="text-center py-2 px-2 font-medium">ROB</th>
                    <th className="text-left py-2 px-2 font-medium w-24">Qty Required</th>
                    <th className="text-left py-2 px-2 font-medium">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {a2LinkedSpares.map((item, index) => {
                    const robA = item.spare?.robLocationA ?? 0;
                    const robB = item.spare?.robLocationB ?? 0;
                    const totalRob = robA + robB;

                    return (
                      <tr key={item.spare?.id || index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-2 px-2">
                          <Checkbox
                            checked={item.selected}
                            onCheckedChange={(checked) => {
                              setA2LinkedSpares(prev => prev.map((s, i) =>
                                i === index ? { ...s, selected: !!checked } : s
                              ));
                            }}
                            data-testid={`a2-spare-select-${index}`}
                          />
                        </td>
                        <td className="py-2 px-2 font-mono text-xs">{item.spare?.partCode || item.spare?.partNumber || '-'}</td>
                        <td className="py-2 px-2">{item.spare?.partName || '-'}</td>
                        <td className="py-2 px-2 text-center font-medium">{totalRob}</td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantityRequired}
                            onChange={(e) => {
                              setA2LinkedSpares(prev => prev.map((s, i) =>
                                i === index ? { ...s, quantityRequired: e.target.value, selected: e.target.value ? true : s.selected } : s
                              ));
                            }}
                            className="h-8 w-20"
                            placeholder="1"
                            data-testid={`a2-spare-qty-${index}`}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            value={item.remarks}
                            onChange={(e) => {
                              setA2LinkedSpares(prev => prev.map((s, i) =>
                                i === index ? { ...s, remarks: e.target.value } : s
                              ));
                            }}
                            className="h-8"
                            placeholder="Remarks..."
                            data-testid={`a2-spare-remarks-${index}`}
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
            <Button variant="outline" onClick={() => setIsA2SpareModalOpen(false)} data-testid="a2-spare-modal-cancel">
              Cancel
            </Button>
            <Button
              onClick={handleAddSelectedSparesA2}
              disabled={!a2LinkedSpares.some(s => s.selected)}
              data-testid="a2-spare-modal-add"
            >
              Add Selected Spares
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Spare Parts Selection Modal for Section B4 */}
      <Dialog open={isSparePartsModalOpen} onOpenChange={setIsSparePartsModalOpen}>
        <DialogContent className="max-w-[85vw] max-h-[80vh] overflow-hidden flex flex-col">
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
                    <th className="text-center py-2 px-2 font-medium">ROB (Loc A)</th>
                    <th className="text-center py-2 px-2 font-medium">ROB (Loc B)</th>
                    <th className="text-left py-2 px-2 font-medium w-24">Qty to Use</th>
                    <th className="text-left py-2 px-2 font-medium w-32">From Location</th>
                    <th className="text-left py-2 px-2 font-medium">Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {linkedSpares.map((item, index) => {
                    // Use Spares table mapping: location -> rob_location_a, location_2 -> rob_location_b (NO summation)
                    const robLocationA = item.spare.robLocationA ?? 0;
                    const robLocationB = item.spare.robLocationB ?? 0;
                    const locationA = item.spare.location || '';
                    const locationB = item.spare.location2 || '';

                    // Get the max qty based on selected location (no summation)
                    const selectedLocRob = item.selectedLocation === locationA ? robLocationA : 
                                          item.selectedLocation === locationB ? robLocationB : 
                                          Math.max(robLocationA, robLocationB); // Default to max single location

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
                        <td className="py-2 px-2 text-center font-medium">{locationA ? `${locationA}: ${robLocationA}` : '-'}</td>
                        <td className="py-2 px-2 text-center font-medium">{locationB ? `${locationB}: ${robLocationB}` : '-'}</td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            min="0"
                            max={selectedLocRob}
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
                          {/* Use Spares table locations: location -> rob_location_a, location_2 -> rob_location_b */}
                          {(() => {
                            const spareLocations = item.spare.partCode ? getAvailableLocationsForSpare(item.spare.partCode) : [];
                            return (
                              <Select
                                value={item.selectedLocation || ''}
                                onValueChange={(locationName) => {
                                  setLinkedSpares(prev => prev.map((s, i) => 
                                    i === index ? { ...s, selectedLocation: locationName, selectedLocationId: null } : s
                                  ));
                                }}
                              >
                                <SelectTrigger className="h-8 w-28" data-testid={`spare-location-${index}`}>
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  {spareLocations.length > 0 ? (
                                    spareLocations.map((loc, idx) => (
                                      <SelectItem key={idx} value={loc.name}>
                                        {loc.name} ({loc.robValue})
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <SelectItem value="none" disabled>No locations</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            );
                          })()}
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

      {/* Layer 7: RH Justification Modal */}
      <Dialog open={rhJustificationModalOpen} onOpenChange={setRhJustificationModalOpen}>
        <DialogContent className="max-w-lg" data-testid="rh-justification-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              High Machinery Utilization Detected
            </DialogTitle>
            <DialogDescription className="text-sm pt-2">
              <div className="space-y-2">
                <div className="text-gray-700">
                  <strong>Component:</strong> {(workOrderContext as any)?.component?.name || templateData.componentName}
                  {templateData.componentCode && <span className="text-gray-500 ml-1">({templateData.componentCode})</span>}
                </div>
                <div className="text-gray-700">
                  <strong>Running Hours Entered:</strong> {executionData.currentReading} hours
                </div>
                <div className="text-gray-700">
                  <strong>Average Usage Rate:</strong> {rhValidation.utilizationRate.toFixed(1)} hours/day
                </div>
                <p className="text-gray-600 mt-2">
                  This indicates the machinery ran nearly continuously ({rhValidation.utilizationRate.toFixed(1)} out of 24 hours per day).
                  Please provide justification for this high utilization:
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Textarea
              placeholder="Provide justification (minimum 20 characters)&#10;Example: Continuous voyage/sea passage, Emergency operation, Load testing..."
              value={rhJustificationText}
              onChange={(e) => setRhJustificationText(e.target.value)}
              className="min-h-[100px] text-sm"
              data-testid="input-rh-justification"
            />
            <span className="text-xs text-gray-400">{rhJustificationText.length} / 20 minimum characters</span>

            <div className="flex items-center gap-2 mt-2">
              <Checkbox
                id="rh-confirm"
                checked={rhJustificationConfirmed}
                onCheckedChange={(checked) => setRhJustificationConfirmed(!!checked)}
                data-testid="checkbox-rh-confirm"
              />
              <label htmlFor="rh-confirm" className="text-sm text-gray-700 cursor-pointer">
                I confirm this running hours entry is accurate
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRhJustificationModalOpen(false);
                setPendingSaveAfterJustification(false);
              }}
              data-testid="button-rh-justification-cancel"
            >
              Cancel
            </Button>
            <Button
              disabled={rhJustificationText.length < 20 || !rhJustificationConfirmed}
              onClick={() => {
                setRhJustificationModalOpen(false);
                setPendingSaveAfterJustification(true);
              }}
              className="bg-orange-600 hover:bg-orange-700"
              data-testid="button-rh-justification-confirm"
            >
              Confirm and Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Layer 7: RH Error Modal */}
      <Dialog open={rhErrorModalOpen} onOpenChange={setRhErrorModalOpen}>
        <DialogContent className="max-w-lg" data-testid="rh-error-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <X className="h-5 w-5" />
              Invalid Running Hours Entry
            </DialogTitle>
            <DialogDescription className="text-sm pt-2">
              You cannot save this work order because the Running Hours value is physically impossible.
            </DialogDescription>
          </DialogHeader>

          {rhErrorDetails && (
            <div className="space-y-3 py-2 text-sm">
              <div className="bg-red-50 p-3 rounded-lg space-y-1">
                <div className="font-medium text-red-800">Issue: {rhErrorDetails.validationStatus?.replace(/_/g, ' ')}</div>
                {rhErrorDetails.previousEntry && (
                  <div className="text-red-700">Previous RH Entry: {rhErrorDetails.previousEntry.runningHours} hrs on {new Date(rhErrorDetails.previousEntry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                )}
                {rhErrorDetails.nextEntry && (
                  <div className="text-red-700">Next RH Entry: {rhErrorDetails.nextEntry.runningHours} hrs on {new Date(rhErrorDetails.nextEntry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                )}
                {rhErrorDetails.daysBetweenPrevious > 0 && (
                  <>
                    <div className="text-red-700">Days Between: {rhErrorDetails.daysBetweenPrevious} days</div>
                    <div className="text-red-700">Your Increase: {rhErrorDetails.actualIncrease?.toFixed(0)} hours</div>
                    <div className="text-red-700">Maximum Possible: {rhErrorDetails.maxPossibleIncrease?.toFixed(0)} hours ({rhErrorDetails.daysBetweenPrevious} days × 24 hrs/day)</div>
                  </>
                )}
              </div>
              {rhErrorDetails.validRange && (
                <div className="bg-blue-50 p-3 rounded-lg text-blue-800">
                  Valid RH Range: <strong>{rhErrorDetails.validRange.min?.toFixed(0)} to {rhErrorDetails.validRange.max === Infinity ? '∞' : rhErrorDetails.validRange.max?.toFixed(0)} hours</strong>
                </div>
              )}
              <p className="text-gray-500 text-xs">
                Possible reasons: Incorrect running hours value, wrong completion date, or outdated RH data. Check the RH Module for the latest value.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRhErrorModalOpen(false)}
              data-testid="button-rh-error-close"
            >
              Correct Entry and Try Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Layer 7: RH Timeline Viewer */}
      {(workOrderContext as any)?.component?.id && (
        <RHTimelineViewer
          machineryId={(workOrderContext as any).component.id}
          machineryName={(workOrderContext as any).component.name || templateData.componentName || 'Component'}
          machineryCode={templateData.componentCode}
          open={rhTimelineOpen}
          onOpenChange={setRhTimelineOpen}
        />
      )}
    </div>
  );
};

export default WorkOrderFormPage;
