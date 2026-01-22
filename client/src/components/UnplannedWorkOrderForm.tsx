import { useState, useEffect, useRef } from "react";
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
import { ArrowLeft, Plus, Check, X, Edit2, Trash2, Link2, Paperclip, Loader2, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SectionBlock } from '@/components/SectionBlock';
import { PartHeader } from '@/components/PartHeader';
import { WorkOrderDataTable } from '@/components/WorkOrderDataTable';
import { StatusPill } from '@/components/StatusPill';
import type { Component } from "@shared/schema";
import { generateSuggestions, extractContextFromWorkOrder, type WorkOrderContext } from "@/utils/suggestionEngine";

interface UnplannedWorkOrderFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (formData: any) => void;
  vesselId?: string;
}

const UnplannedWorkOrderForm: React.FC<UnplannedWorkOrderFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  vesselId,
}) => {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<'partA' | 'partB'>('partA');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch active components from API
  const { data: components = [], isLoading: componentsLoading } = useQuery<Component[]>({
    queryKey: ['/technical/api/components', vesselId],
    queryFn: async () => {
      if (!vesselId) return [];
      const response = await fetch(`/technical/api/components/${vesselId}`);
      if (!response.ok) throw new Error('Failed to fetch components');
      const allComponents = await response.json() as Component[];
      const activeComponents = allComponents.filter(c => c.isActive === true);
      return activeComponents;
    },
    enabled: isOpen && !!vesselId,
  });

  // Fetch vessel locations for B4 location selection
  const { data: locationsResponse } = useQuery<{ success: boolean; data: Array<{ id: number; locationName: string }> }>({
    queryKey: [`/technical/api/inventory/locations/${vesselId}`],
    enabled: isOpen && !!vesselId
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
    enabled: isOpen && !!vesselId
  });
  const sparesWithInventory = sparesWithInventoryResponse?.data || [];

  // Helper to get stock at a specific location for a part
  const getStockAtLocation = (partCode: string, locationId: number): number => {
    const spare = sparesWithInventory.find(s => s.spare.partCode === partCode);
    if (!spare) return 0;
    const loc = spare.locations.find(l => l.locationId === locationId);
    return loc?.qty || 0;
  };

  // State for editing spare parts and tools
  const [editingSparePart, setEditingSparePart] = useState<number | null>(null);
  const [editingTool, setEditingTool] = useState<number | null>(null);
  const [originalSparePart, setOriginalSparePart] = useState<{partNo: string, description: string, quantityRequired: string, remarks: string} | null>(null);
  const [originalTool, setOriginalTool] = useState<{toolName: string, quantity: string, remarks: string} | null>(null);

  // Safety modal state
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [newSafetyRequirement, setNewSafetyRequirement] = useState("");
  const [safetyRequirementCategory, setSafetyRequirementCategory] = useState<'ppeRequirements' | 'permitRequirements' | 'otherRequirements'>('ppeRequirements');

  // Document upload refs
  const riskAssessmentFileRef = useRef<HTMLInputElement>(null);
  const safetyChecklistFileRef = useRef<HTMLInputElement>(null);
  const operationalFormFileRef = useRef<HTMLInputElement>(null);
  const [deleteDocumentDialogOpen, setDeleteDocumentDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{type: string, fileKey: string} | null>(null);

  // Consumed spare parts editing
  const [editingConsumedSparePart, setEditingConsumedSparePart] = useState<number | null>(null);

  // Quick answers and smart suggestions
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

  // Approval workflow state
  const [currentWorkOrderStatus, setCurrentWorkOrderStatus] = useState<string>('Active');
  const [rejectionComments, setRejectionComments] = useState('');
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);

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

  // Template Data (Part A)
  const [templateData, setTemplateData] = useState({
    woTitle: "",
    component: "",
    componentId: "",
    componentName: "",
    componentCode: "",
    woTemplateCode: "",
    maintenanceBasis: "Calendar",
    frequencyValue: "",
    frequencyUnit: "Months",
    taskType: "Unplanned Maintenance",
    assignedTo: "",
    approver: "",
    jobPriority: "Medium",
    jobCategory: "",
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

  // Execution Data (Part B)
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
    consumedSpareParts: [] as Array<{partNo: string, partCode?: string, description: string, quantityConsumed: string, location: 'Location A' | 'Location B' | '', locationId: number | null, comments: string}>
  });

  const generateWOExecutionId = () => {
    const uniqueId = Math.floor(Math.random() * 9000000) + 1000000;
    return `WO-EXE-${uniqueId}`;
  };

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTemplateData({
        woTitle: "",
        component: "",
        componentId: "",
        componentName: "",
        componentCode: "",
        woTemplateCode: "",
        maintenanceBasis: "Calendar",
        frequencyValue: "",
        frequencyUnit: "Months",
        taskType: "Unplanned Maintenance",
        assignedTo: "",
        approver: "",
        jobPriority: "Medium",
        jobCategory: "",
        classRelated: "No",
        department: "",
        criticality: "",
        isActive: "Yes",
        briefWorkDescription: "",
        nextDueDate: "",
        nextDueReading: "",
        requiredSpareParts: [],
        requiredTools: [],
        safetyRequirements: {
          ppeRequirements: [],
          permitRequirements: [],
          otherRequirements: []
        },
        workHistory: []
      });
      setExecutionData({
        woExecutionId: generateWOExecutionId(),
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
        uploadedDocuments: [],
        consumedSpareParts: []
      });
      setActiveSection('partA');
      setCurrentWorkOrderStatus('Active');
    }
  }, [isOpen]);

  const selectSection = (section: 'partA' | 'partB') => {
    setActiveSection(section);
  };

  const handleTemplateChange = (field: string, value: string) => {
    setTemplateData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleExecutionChange = (field: string, value: string) => {
    setExecutionData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Component selection handler
  const handleComponentSelect = (componentId: string) => {
    const selectedComponent = components.find(c => c.id === componentId);
    if (selectedComponent) {
      setTemplateData(prev => ({
        ...prev,
        componentId: componentId,
        componentCode: selectedComponent.componentCode || '',
        componentName: selectedComponent.name || '',
        component: selectedComponent.name || '',
      }));
    }
  };

  // Spare Parts handlers
  const handleAddSparePart = () => {
    const newPart = { partNo: "", description: "", quantityRequired: "", remarks: "" };
    setTemplateData(prev => ({
      ...prev,
      requiredSpareParts: [...prev.requiredSpareParts, newPart]
    }));
    setOriginalSparePart(null);
    setEditingSparePart(templateData.requiredSpareParts.length);
  };

  const handleEditSparePart = (index: number) => {
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
      setTemplateData(prev => ({
        ...prev,
        requiredSpareParts: prev.requiredSpareParts.map((part, i) => 
          i === editingSparePart ? originalSparePart : part
        )
      }));
    } else {
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

  // Tools handlers
  const handleAddTool = () => {
    const newTool = { toolName: "", quantity: "", remarks: "" };
    setTemplateData(prev => ({
      ...prev,
      requiredTools: [...prev.requiredTools, newTool]
    }));
    setOriginalTool(null);
    setEditingTool(templateData.requiredTools.length);
  };

  const handleEditTool = (index: number) => {
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
      setTemplateData(prev => ({
        ...prev,
        requiredTools: prev.requiredTools.map((tool, i) => 
          i === editingTool ? originalTool : tool
        )
      }));
    } else {
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

  // Safety requirement handlers
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

  // Document upload handlers
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
    const document = executionData.uploadedDocuments.find(doc => doc.type === documentType);
    if (!document) return;

    setDocumentToDelete({ type: documentType, fileKey: document.fileKey });
    setDeleteDocumentDialogOpen(true);
  };

  const handleDeleteDocumentConfirm = async () => {
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

  // Consumed spare parts handlers
  const handleAddConsumedSparePart = () => {
    const newPart = { partNo: "", description: "", quantityConsumed: "", location: "" as const, locationId: null, comments: "" };
    setExecutionData(prev => ({
      ...prev,
      consumedSpareParts: [...prev.consumedSpareParts, newPart]
    }));
    setEditingConsumedSparePart(executionData.consumedSpareParts.length);
  };

  const handleSaveConsumedSparePart = (index: number) => {
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

  // Quick text insertion
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
      const context = extractContextFromWorkOrder(null, executionData);
      const suggestions = generateSuggestions(context);
      setSmartSuggestions(suggestions);
    } catch (error) {
      console.error('Error generating smart suggestions:', error);
      setSmartSuggestions([]);
    }
  };

  const toggleSmartSuggestions = () => {
    const newShowState = !showSmartSuggestions;
    setShowSmartSuggestions(newShowState);
    
    if (newShowState && smartSuggestions.length === 0) {
      generateSmartSuggestions();
    }
  };

  // Main submit handler
  const handleSubmit = async () => {
    // Validate required fields
    if (!templateData.woTitle) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a Job Title',
        variant: 'destructive'
      });
      return;
    }
    if (!templateData.componentId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a Component',
        variant: 'destructive'
      });
      return;
    }
    if (!templateData.briefWorkDescription) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a Brief Work Description',
        variant: 'destructive'
      });
      return;
    }

    // Validate running hours if provided
    if (executionData.currentReading && executionData.previousReading) {
      const currentRH = parseFloat(executionData.currentReading);
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

    // Validate spare parts consumed have location if quantity > 0
    const sparesWithMissingLocation = executionData.consumedSpareParts.filter(spare => {
      const hasQuantity = spare.quantityConsumed && parseFloat(spare.quantityConsumed) > 0;
      if (!hasQuantity) return false;
      
      const lookupKey = spare.partCode || spare.partNo;
      const isInInventory = lookupKey && sparesWithInventory.some(s => s.spare.partCode === lookupKey);
      if (!isInInventory) return false;
      
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

    // Validate stock availability
    const sparesWithInsufficientStock = executionData.consumedSpareParts.filter(spare => {
      const qty = parseFloat(spare.quantityConsumed);
      if (!qty || qty <= 0 || !spare.locationId) return false;
      
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

    if (onSubmit) {
      setIsSubmitting(true);
      try {
        const hasCompletionData = !!(executionData.completionDateTime || executionData.dateOfCompletion);
        
        const workOrderPayload = {
          vesselId: vesselId,
          component: templateData.componentName,
          componentCode: templateData.componentCode,
          jobTitle: templateData.woTitle,
          workOrderType: 'Unplanned',
          maintenanceType: templateData.taskType || 'Unplanned Maintenance',
          assignedTo: templateData.assignedTo || 'Chief Engineer',
          approver: templateData.approver || '',
          jobCategory: templateData.jobCategory || '',
          jobPriority: templateData.jobPriority || 'Medium',
          classRelated: templateData.classRelated || 'No',
          department: templateData.department || '',
          criticality: templateData.criticality || '',
          status: hasCompletionData ? 'Pending Approval' : 'Active',
          briefWorkDescription: templateData.briefWorkDescription,
          dataScope: 'vessel',
          maintenanceBasis: 'Calendar',
          frequencyValue: '',
          frequencyUnit: '',
          requiredSpareParts: templateData.requiredSpareParts,
          requiredTools: templateData.requiredTools,
          safetyRequirements: templateData.safetyRequirements,
          ...executionData,
          runningHours: executionData.currentReading || executionData.runningHours
        };
        
        await onSubmit(workOrderPayload);
        onClose();
      } catch (error) {
        console.error('[UNPLANNED_WO] Error submitting:', error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[80vw] max-w-none h-[90vh] flex flex-col">
        <DialogHeader className="pb-4 pr-12">
          <div className="flex items-center justify-between">
            <DialogTitle>Work Order Form - Unplanned Maintenance</DialogTitle>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                className="bg-[#22c55e] hover:bg-[#16a34a] text-white"
                onClick={handleSubmit}
                disabled={isSubmitting}
                data-testid="button-save-unplanned-wo"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Navigation */}
          <div className="w-20 flex-shrink-0 bg-gray-50 border-r border-gray-200 p-4">
            <nav className="space-y-6">
              <a
                href="#part-a"
                onClick={() => selectSection('partA')}
                className="flex flex-col items-center gap-2 group cursor-pointer"
                data-testid="nav-step-part-a"
              >
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors
                  ${activeSection === 'partA' 
                    ? 'bg-[hsl(var(--primary))] text-white' 
                    : 'bg-gray-200 text-gray-600 group-hover:bg-blue-100'
                  }
                `}>
                  A
                </div>
                <span className="text-xs text-center text-gray-500 max-w-[60px] leading-tight">
                  Job Details
                </span>
              </a>
              <a
                href="#part-b"
                onClick={() => selectSection('partB')}
                className="flex flex-col items-center gap-2 group cursor-pointer"
                data-testid="nav-step-part-b"
              >
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors
                  ${activeSection === 'partB' 
                    ? 'bg-[hsl(var(--primary))] text-white' 
                    : 'bg-gray-200 text-gray-600 group-hover:bg-blue-100'
                  }
                `}>
                  B
                </div>
                <span className="text-xs text-center text-gray-500 max-w-[60px] leading-tight">
                  Work Completion
                </span>
              </a>
            </nav>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 overflow-auto p-6">
            {/* Part A - Work Order Details */}
            {activeSection === 'partA' && (
              <div className="space-y-6">
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
                          data-testid="input-job-title"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Component</Label>
                        <Select
                          value={templateData.componentId}
                          onValueChange={handleComponentSelect}
                        >
                          <SelectTrigger className="text-sm" data-testid="select-component">
                            <SelectValue placeholder={componentsLoading ? "Loading..." : "Select component"} />
                          </SelectTrigger>
                          <SelectContent>
                            {components.map((component) => (
                              <SelectItem key={component.id} value={component.id}>
                                {component.componentCode} - {component.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Component Code</Label>
                        <Input
                          value={templateData.componentCode}
                          className="text-sm bg-gray-50"
                          disabled
                          data-testid="input-component-code"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Task Type</Label>
                        <Select
                          value={templateData.taskType}
                          onValueChange={(value) => handleTemplateChange('taskType', value)}
                        >
                          <SelectTrigger className="text-sm" data-testid="select-task-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Unplanned Maintenance">Unplanned Maintenance</SelectItem>
                            <SelectItem value="Emergency Maintenance">Emergency Maintenance</SelectItem>
                            <SelectItem value="Breakdown Maintenance">Breakdown Maintenance</SelectItem>
                            <SelectItem value="Corrective Maintenance">Corrective Maintenance</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Assigned To (Rank)</Label>
                        <Select
                          value={templateData.assignedTo}
                          onValueChange={(value) => handleTemplateChange('assignedTo', value)}
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
                        >
                          <SelectTrigger className="text-sm" data-testid="select-priority">
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
                        <Label className="text-sm text-[#8798ad]">Job Category</Label>
                        <Select
                          value={templateData.jobCategory}
                          onValueChange={(value) => handleTemplateChange('jobCategory', value)}
                        >
                          <SelectTrigger className="text-sm" data-testid="select-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Mechanical">Mechanical</SelectItem>
                            <SelectItem value="Electrical">Electrical</SelectItem>
                            <SelectItem value="Hydraulic">Hydraulic</SelectItem>
                            <SelectItem value="Safety">Safety</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Class Related</Label>
                        <Select
                          value={templateData.classRelated}
                          onValueChange={(value) => handleTemplateChange('classRelated', value)}
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
                        <Label className="text-sm text-[#8798ad]">Department</Label>
                        <Input
                          value={templateData.department}
                          onChange={(e) => handleTemplateChange('department', e.target.value)}
                          className="text-sm"
                          placeholder="Enter department"
                          data-testid="input-department"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Criticality</Label>
                        <Input
                          value={templateData.criticality}
                          onChange={(e) => handleTemplateChange('criticality', e.target.value)}
                          className="text-sm"
                          placeholder="Enter criticality"
                          data-testid="input-criticality"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Is Active</Label>
                        <Select
                          value={templateData.isActive}
                          onValueChange={(value) => handleTemplateChange('isActive', value)}
                        >
                          <SelectTrigger className="text-sm" data-testid="select-is-active">
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
                      <Label className="text-sm text-[#8798ad]">Brief Work Description</Label>
                      <Textarea
                        value={templateData.briefWorkDescription}
                        onChange={(e) => handleTemplateChange('briefWorkDescription', e.target.value)}
                        className="text-sm min-h-[80px]"
                        placeholder="Describe the work to be performed"
                        data-testid="input-description"
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
                        data-testid="button-add-spare"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add spares
                      </Button>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border border-gray-200">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left p-2 font-medium text-gray-700 w-[20%]">PART NO.</th>
                            <th className="text-left p-2 font-medium text-gray-700 w-[40%]">DESCRIPTION</th>
                            <th className="text-left p-2 font-medium text-gray-700 w-[15%]">QTY REQUIRED</th>
                            <th className="text-left p-2 font-medium text-gray-700 w-[10%]">ROB</th>
                            <th className="text-left p-2 font-medium text-gray-700 w-[15%]">STATUS</th>
                            <th className="text-center p-2 font-medium text-gray-700 w-[100px]">ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {templateData.requiredSpareParts.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center p-4 text-gray-500 italic">
                                No spare parts added yet
                              </td>
                            </tr>
                          ) : (
                            templateData.requiredSpareParts.map((part, index) => {
                              const lookupKey = part.partCode || '';
                              const inventoryMatch = lookupKey ? sparesWithInventory.find(s => s.spare.partCode === lookupKey) : null;
                              const robValue = inventoryMatch ? inventoryMatch.robTotal : null;
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
                                          placeholder="Part No"
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
                                        <StatusPill status={stockStatus} />
                                      </td>
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
                        data-testid="button-add-tool"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add tools
                      </Button>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border border-gray-200">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left p-2 font-medium text-gray-700 w-[50%]">DESCRIPTION</th>
                            <th className="text-left p-2 font-medium text-gray-700 w-[20%]">QTY REQUIRED</th>
                            <th className="text-left p-2 font-medium text-gray-700 w-[15%]">ROB</th>
                            <th className="text-left p-2 font-medium text-gray-700 w-[15%]">STATUS</th>
                            <th className="text-center p-2 font-medium text-gray-700 w-[100px]">ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {templateData.requiredTools.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-center p-4 text-gray-500 italic">
                                No tools added yet
                              </td>
                            </tr>
                          ) : (
                            templateData.requiredTools.map((tool, index) => (
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
                                      <StatusPill status="available" />
                                    </td>
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
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        className="bg-[#22c55e] hover:bg-[#16a34a] text-white"
                        onClick={() => setIsSafetyModalOpen(true)}
                        data-testid="button-add-safety"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add requirement
                      </Button>
                    </div>
                    
                    {/* PPE Requirements */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1.5">Personal Protective Equipment (PPE):</h3>
                      {templateData.safetyRequirements.ppeRequirements.length > 0 ? (
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
                      {templateData.safetyRequirements.permitRequirements.length > 0 ? (
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
                    {templateData.safetyRequirements.otherRequirements.length > 0 && (
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
                    data={templateData.workHistory.map(history => ({
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
              </div>
            )}

            {/* Part B - Work Completion Record */}
            {activeSection === 'partB' && (
              <div className="space-y-6">
                <PartHeader
                  id="part-b"
                  label="Part B"
                  title="Work Completion Record"
                  description="Enter work completion details here including Risk assessment, checklists, comments etc."
                />

                {/* B1. Risk Assessment, Checklists & Records */}
                <SectionBlock
                  id="completion"
                  number="B1"
                  title="Risk Assessment, Checklists & Records"
                >
                  <div className="space-y-4">
                    {/* B1.1 Risk Assessment */}
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <Label className="text-sm text-gray-700">B1.1 Risk Assessment Completed / Reviewed:</Label>
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
                              data-testid="radio-risk-yes"
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
                              data-testid="radio-risk-no"
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
                              data-testid="radio-risk-na"
                            />
                            <span className="text-sm">NA</span>
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          {getUploadedDocument('riskAssessment') ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDocument('riskAssessment')}
                              data-testid="button-view-risk-doc"
                            >
                              View
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUploadDocument('riskAssessment', riskAssessmentFileRef)}
                              data-testid="button-upload-risk-doc"
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
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <Label className="text-sm text-gray-700">B1.2 Safety Checklists Completed (As applicable):</Label>
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
                              data-testid="radio-safety-yes"
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
                              data-testid="radio-safety-no"
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
                              data-testid="radio-safety-na"
                            />
                            <span className="text-sm">NA</span>
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          {getUploadedDocument('safetyChecklists') ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDocument('safetyChecklists')}
                              data-testid="button-view-safety-doc"
                            >
                              View
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUploadDocument('safetyChecklists', safetyChecklistFileRef)}
                              data-testid="button-upload-safety-doc"
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
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <Label className="text-sm text-gray-700">B1.3 Operational Forms Completed (As applicable):</Label>
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
                              data-testid="radio-ops-yes"
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
                              data-testid="radio-ops-no"
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
                              data-testid="radio-ops-na"
                            />
                            <span className="text-sm">NA</span>
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          {getUploadedDocument('operationalForms') ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDocument('operationalForms')}
                              data-testid="button-view-ops-doc"
                            >
                              View
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUploadDocument('operationalForms', operationalFormFileRef)}
                              data-testid="button-upload-ops-doc"
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
                <SectionBlock
                  id="work-details"
                  number="B2"
                  title="Details of Work Carried Out"
                >
                  <div className="space-y-4">
                    <h5 className="text-sm font-medium text-gray-900">B2.1 Work Duration:</h5>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Start Date & Time</Label>
                        <Input 
                          type="datetime-local" 
                          value={executionData.startDateTime}
                          onChange={(e) => handleExecutionChange('startDateTime', e.target.value)}
                          className="w-full" 
                          data-testid="input-start-datetime"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Assigned To</Label>
                        <Input 
                          value={templateData.assignedTo || 'Chief Engineer'}
                          className="w-full bg-gray-50" 
                          disabled
                          data-testid="input-assigned-display"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Completion Date & Time</Label>
                        <Input 
                          type="datetime-local" 
                          value={executionData.completionDateTime}
                          onChange={(e) => handleExecutionChange('completionDateTime', e.target.value)}
                          className="w-full"
                          data-testid="input-completion-datetime"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Performed by</Label>
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
                        <Label className="text-sm text-[#8798ad]">No of Persons in the team</Label>
                        <Input 
                          type="number"
                          value={executionData.noOfPersons}
                          onChange={(e) => handleExecutionChange('noOfPersons', e.target.value)}
                          className="w-full" 
                          data-testid="input-no-persons"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Total Time Taken (Hours)</Label>
                        <Input 
                          type="number"
                          value={executionData.totalTimeHours}
                          onChange={(e) => handleExecutionChange('totalTimeHours', e.target.value)}
                          className="w-full" 
                          data-testid="input-total-time"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Manhours</Label>
                        <Input 
                          type="number"
                          step="0.1"
                          value={executionData.manhours}
                          onChange={(e) => handleExecutionChange('manhours', e.target.value)}
                          className="w-full" 
                          data-testid="input-manhours"
                        />
                      </div>
                    </div>
                    
                    {/* Work Carried Out with Quick Answers */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm text-[#8798ad]">Work Carried Out</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowQuickInputs(!showQuickInputs)}
                            className="text-xs"
                            data-testid="button-quick-answers"
                          >
                            {showQuickInputs ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                            Quick Answers
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={toggleSmartSuggestions}
                            className="text-xs"
                            data-testid="button-smart-suggestions"
                          >
                            <Lightbulb className="h-3 w-3 mr-1" />
                            Smart Suggestions
                          </Button>
                        </div>
                      </div>
                      
                      {/* Quick Answers Panel */}
                      {showQuickInputs && (
                        <div className="bg-gray-50 border border-gray-200 rounded-md p-3 space-y-2">
                          <p className="text-xs text-gray-500 font-medium">Click to insert:</p>
                          <div className="flex flex-wrap gap-2">
                            {quickAnswers.map((answer, idx) => (
                              <Button
                                key={idx}
                                variant="outline"
                                size="sm"
                                onClick={() => insertQuickText(answer)}
                                className="text-xs h-7"
                                data-testid={`button-quick-answer-${idx}`}
                              >
                                {answer}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Smart Suggestions Panel */}
                      {showSmartSuggestions && smartSuggestions.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 space-y-2">
                          <p className="text-xs text-blue-700 font-medium flex items-center gap-1">
                            <Lightbulb className="h-3 w-3" />
                            AI-Generated Suggestions:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {smartSuggestions.map((suggestion, idx) => (
                              <Button
                                key={idx}
                                variant="outline"
                                size="sm"
                                onClick={() => insertQuickText(suggestion)}
                                className="text-xs h-7 border-blue-300 text-blue-700 hover:bg-blue-100"
                                data-testid={`button-smart-suggestion-${idx}`}
                              >
                                {suggestion}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <Textarea 
                        ref={workCarriedOutRef}
                        value={executionData.workCarriedOut}
                        onChange={(e) => handleExecutionChange('workCarriedOut', e.target.value)}
                        className="w-full min-h-[100px]" 
                        placeholder="Describe the work carried out"
                        data-testid="input-work-carried-out"
                      />
                    </div>
                    
                    {/* Job Experience / Notes */}
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Job Experience / Notes</Label>
                      <Textarea 
                        value={executionData.jobExperienceNotes}
                        onChange={(e) => handleExecutionChange('jobExperienceNotes', e.target.value)}
                        className="w-full min-h-[80px]" 
                        placeholder="Add any job experience or notes"
                        data-testid="input-job-experience"
                      />
                    </div>
                  </div>
                </SectionBlock>

                {/* B3. Running Hours */}
                <SectionBlock
                  id="running-hours"
                  number="B3"
                  title="Running Hours"
                >
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Previous reading</Label>
                      <Input 
                        type="number"
                        value={executionData.previousReading}
                        onChange={(e) => handleExecutionChange('previousReading', e.target.value)}
                        className="w-full" 
                        data-testid="input-previous-reading"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Current Reading</Label>
                      <Input 
                        type="number"
                        value={executionData.currentReading}
                        onChange={(e) => handleExecutionChange('currentReading', e.target.value)}
                        className="w-full" 
                        data-testid="input-current-reading"
                      />
                    </div>
                  </div>
                </SectionBlock>

                {/* B4. Spare Parts Consumed */}
                <SectionBlock
                  id="spares-consumed"
                  number="B4"
                  title="Spare Parts Consumed"
                >
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        className="bg-[#22c55e] hover:bg-[#16a34a] text-white"
                        onClick={handleAddConsumedSparePart}
                        data-testid="button-add-consumed-spare"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Spare Part
                      </Button>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border border-gray-200">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left p-2 font-medium text-gray-700">PART NO.</th>
                            <th className="text-left p-2 font-medium text-gray-700">DESCRIPTION</th>
                            <th className="text-left p-2 font-medium text-gray-700">QTY CONSUMED</th>
                            <th className="text-left p-2 font-medium text-gray-700">LOCATION</th>
                            <th className="text-left p-2 font-medium text-gray-700">COMMENTS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Pre-populated from required spares */}
                          {templateData.requiredSpareParts.map((spare, index) => {
                            const sparePartCode = spare.partCode || spare.partNo || '';
                            const consumedIndex = executionData.consumedSpareParts.findIndex(
                              c => (c.partCode && c.partCode === sparePartCode) || (c.partNo && c.partNo === spare.partNo)
                            );
                            const consumedData = consumedIndex >= 0 ? executionData.consumedSpareParts[consumedIndex] : null;
                            
                            const stockInfo = sparePartCode ? sparesWithInventory.find(s => s.spare.partCode === sparePartCode) : null;
                            
                            return (
                              <tr key={`req-${index}`} className="border-b border-gray-100">
                                <td className="py-3 text-gray-900">{spare.partNo || '-'}</td>
                                <td className="py-3 text-gray-700">{spare.description || '-'}</td>
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
                                            quantityConsumed: newValue
                                          };
                                        } else {
                                          consumed.push({
                                            partNo: spare.partNo,
                                            partCode: sparePartCode,
                                            description: spare.description,
                                            quantityConsumed: newValue,
                                            location: '' as const,
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

                          {/* Manually added consumed spare parts */}
                          {executionData.consumedSpareParts
                            .filter(consumed => !templateData.requiredSpareParts.some(s => {
                              const reqPartCode = (s as any).partCode || '';
                              if (reqPartCode && consumed.partCode) return reqPartCode === consumed.partCode;
                              if (s.partNo && consumed.partNo) return s.partNo === consumed.partNo;
                              return false;
                            }))
                            .map((consumed, index) => {
                              const actualIndex = executionData.consumedSpareParts.findIndex(c => c === consumed);
                              
                              return (
                                <tr key={`manual-${actualIndex}`} className="border-b border-gray-100">
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
                                </tr>
                              );
                            })}
                            
                          {templateData.requiredSpareParts.length === 0 && executionData.consumedSpareParts.length === 0 && (
                            <tr>
                              <td colSpan={5} className="text-center p-4 text-gray-500 italic">
                                No spare parts to consume. Add spare parts in Part A or click "Add Spare Part" above.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </SectionBlock>

                {/* Submit Button */}
                <div className="flex justify-end mt-6 pb-6">
                  <Button 
                    size="lg" 
                    className="bg-[#22c55e] hover:bg-[#16a34a] text-white px-8 py-3 text-base font-medium"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    data-testid="button-submit"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

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
    </>
  );
};

export default UnplannedWorkOrderForm;
