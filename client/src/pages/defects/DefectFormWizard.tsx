import { useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Plus, Edit, Trash2, Eye, X, Paperclip } from "lucide-react";
import { insertDefectSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import ImmediateCauseModal from "@/components/ImmediateCauseModal";
import RootCauseModal from "@/components/RootCauseModal";
import AddActionModal from "@/components/AddActionModal";
import { FileAttachmentDialog, FileAttachment } from "@/components/FileAttachmentDialog";
import { useVessels } from "@/hooks/useVessels";
import { useExternalUsers } from "@/hooks/useExternalMasterData";
import { sireHardwareClasses, findHardwareClassById } from "@/data/sireHardwareClasses";
import { defectSources, findSourceById } from "@/data/defectSources";
import { SireHardwareClassCombobox } from "@/components/SireHardwareClassCombobox";
import { useAuth } from "@/contexts/AuthContext";

const defectFormSchema = insertDefectSchema.extend({
  critical: z.boolean().optional(),
  is_coc: z.boolean().optional(),
  // Mandatory field validations
  vesselId: z.string().min(1, "Vessel is required"),
  issueDate: z.string().min(1, "Date Observed is required"),
  description: z.string().min(1, "Description is required"),
});

type DefectFormData = z.infer<typeof defectFormSchema>;

interface Action {
  id: string;
  actionType: string;
  actionDescription: string;
  proposedBy: string;
  responsibility: string;
  dueDate: string;
  dateCompleted?: string;
  status: string;
}

interface DefectFormWizardProps {
  defect?: any;
  mode?: 'view' | 'edit' | 'new';
  initialStep?: 1 | 2 | 3;
  onCompleted?: () => void;
  onBack?: () => void;
  isCoc?: boolean; // Pre-select CoC checkbox when opened from CoC section
}

export default function DefectFormWizard({ 
  defect, 
  mode = 'new', 
  initialStep = 1,
  onCompleted,
  onBack,
  isCoc = false
}: DefectFormWizardProps = {}) {
  console.log('[DefectFormWizard] Rendering with mode:', mode, 'defect:', defect?.id);
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const { data: vessels = [] } = useVessels();
  
  // Fetch equipment categories from database
  const { data: equipmentCategories = [] } = useQuery<{ id: number; name: string; sortOrder: number }[]>({
    queryKey: ['/technical/api/equipment-categories'],
  });
  
  // Fetch defect categories from database
  const { data: defectCategoriesData = [] } = useQuery<{ id: number; name: string; sortOrder: number }[]>({
    queryKey: ['/technical/api/defect-categories'],
  });
  
  // Fetch defect types from database
  const { data: defectTypesData = [] } = useQuery<{ id: number; name: string; sortOrder: number }[]>({
    queryKey: ['/technical/api/defect-types'],
  });
  const [, setLocation] = useLocation();
  const params = useParams();
  const [activeSection, setActiveSection] = useState<'A' | 'B' | 'C'>('A');
  const [actions, setActions] = useState<Action[]>([]);
  const [isImmediateCauseModalOpen, setIsImmediateCauseModalOpen] = useState(false);
  const [isRootCauseModalOpen, setIsRootCauseModalOpen] = useState(false);
  const [isAddActionModalOpen, setIsAddActionModalOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(mode === 'view');
  const [editingAction, setEditingAction] = useState<Action | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>([]);
  const [isAttachmentDialogOpen, setIsAttachmentDialogOpen] = useState(false);
  const [partAAttachments, setPartAAttachments] = useState<FileAttachment[]>([]);
  const [isPartAAttachmentDialogOpen, setIsPartAAttachmentDialogOpen] = useState(false);
  
  // Track created defect ID to prevent duplicate creation
  const [createdDefectId, setCreatedDefectId] = useState<number | null>(null);
  // Prevent duplicate saves from rapid clicks
  const [isSaving, setIsSaving] = useState(false);
  
  // B5 Target Date Extension state
  const [showExtensionForm, setShowExtensionForm] = useState(false);
  const [targetDateExtensions, setTargetDateExtensions] = useState<Array<{
    id: string;
    existingTargetDate: string;
    newTargetDate: string;
    reasonForExtension: string;
    submitForApprovalTo: string;
    submitForApprovalToName: string;
    status: 'Requested' | 'Approved' | 'Rejected';
    approved?: boolean;
    approvalDate: string;
    approverComments: string;
    electronicConfirmation?: string;
    requestedAt: string;
  }>>([]);
  const [currentExtension, setCurrentExtension] = useState({
    newTargetDate: '',
    reasonForExtension: '',
    submitForApprovalTo: '',
    approved: undefined as boolean | undefined,
    approvalDate: '',
    approverComments: ''
  });
  const [isSubmittingExtension, setIsSubmittingExtension] = useState(false);
  
  // Fetch office users for approval dropdown from Admin > Masters > Users
  const { data: externalUsersData = [] } = useExternalUsers();
  
  // Filter for Office users and map to display format (User Name - Designation)
  const officeUsers = externalUsersData.filter((user: any) => {
    const userType = user.user_type || user.userType || user.type || '';
    return userType.toLowerCase() === 'office';
  }).map((user: any) => {
    const fullName = user.fullname || user.userName || user.name || user.username || user.full_name || '';
    const designation = user.designation || user.position || user.title || user.job_title || '';
    const uuid = user.uuid || user.id || user.userId || '';
    return {
      id: uuid,
      fullName: fullName,
      designation: designation,
      displayName: designation ? `${fullName} - ${designation}` : fullName
    };
  });
  
  // Section refs for scroll tracking
  const partARef = useRef<HTMLDivElement>(null);
  const partBRef = useRef<HTMLDivElement>(null);
  const partCRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const generateReference = () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `DN/007/${year}/${random}/V`;
  };

  const [defectId] = useState(generateReference());
  
  const { data: fetchedDefect, isLoading: isLoadingDefect, error: fetchError } = useQuery({
    queryKey: ['defects', params.id],
    enabled: !!params.id && !defect,
    queryFn: async () => {
      const response = await fetch(`/technical/api/defects/${params.id}`);
      if (!response.ok) throw new Error('Failed to fetch defect');
      return response.json();
    }
  });
  
  const currentDefect = defect || fetchedDefect;
  
  // Compute the correct is_coc default: use existing defect value if available, otherwise use isCoc prop for new defects
  const defaultIsCoc = currentDefect?.is_coc ?? isCoc;
  
  const form = useForm<DefectFormData>({
    resolver: zodResolver(defectFormSchema),
    defaultValues: {
      vesselId: "",
      vesselName: "",
      issueDate: new Date().toISOString().split('T')[0],
      category: "Defect",
      equipmentCategory: "",
      status: "Open",
      priority: "Medium",
      critical: false,
      is_coc: defaultIsCoc, // Use defect's value if editing, or isCoc prop for new defects
      severity: 1,
      reportedBy: "MASTER",
      description: "",
      immediateCause: "",
      immediateCauseExplanation: "",
      rootCause: "",
      rootCauseExplanation: "",
      riskLevel: "",
      vesselLocationType: "atPort",
      dateRegisteredInSystem: new Date().toISOString().split('T')[0],
    },
  });

  const dateCompletedValue = form.watch("dateCompleted");
  const vesselLocationType = form.watch("vesselLocationType");
  
  useEffect(() => {
    if (vesselLocationType === 'atPort') {
      form.setValue('latitude', '');
      form.setValue('longitude', '');
    } else if (vesselLocationType === 'atSea') {
      form.setValue('portName', '');
    }
  }, [vesselLocationType, form]);

  useEffect(() => {
    if (currentDefect) {
      form.reset({
        ...currentDefect,
        issueDate: currentDefect.issueDate || new Date().toISOString().split('T')[0],
        dateCompleted: currentDefect.dateCompleted || '',
        targetCloseDate: currentDefect.targetCloseDate || '',
        verifiedDate: currentDefect.verifiedDate || '',
        // Explicitly preserve the defect's is_coc value, don't fall back to isCoc prop for existing defects
        is_coc: currentDefect.is_coc ?? false,
      });
      
      if (currentDefect.actions && Array.isArray(currentDefect.actions)) {
        setActions(currentDefect.actions);
      }
      
      if (currentDefect.partAAttachments && Array.isArray(currentDefect.partAAttachments)) {
        setPartAAttachments(currentDefect.partAAttachments);
      }
      
      if (currentDefect.attachments && Array.isArray(currentDefect.attachments)) {
        setFileAttachments(currentDefect.attachments);
      }
      
      if (currentDefect.targetDateExtensions && Array.isArray(currentDefect.targetDateExtensions)) {
        setTargetDateExtensions(currentDefect.targetDateExtensions);
        
        // Restore currentExtension display fields from the last saved extension
        if (currentDefect.targetDateExtensions.length > 0) {
          const lastExt = currentDefect.targetDateExtensions[currentDefect.targetDateExtensions.length - 1];
          setCurrentExtension({
            newTargetDate: lastExt.newTargetDate || '',
            reasonForExtension: lastExt.reasonForExtension || '',
            submitForApprovalTo: lastExt.submitForApprovalTo || '',
            approved: lastExt.approved,
            approvalDate: lastExt.approvalDate || '',
            approverComments: lastExt.approverComments || ''
          });
        }
      }
    }
  }, [currentDefect]);

  const buildImmediateCauseText = (ic: { unsafeAct: string[]; unsafeCondition: string[] }): string => {
    const sections: string[] = [];
    if (ic?.unsafeAct?.length) {
      sections.push("UNSAFE ACT", ...ic.unsafeAct.map(item => `• ${item}`));
    }
    if (ic?.unsafeCondition?.length) {
      if (sections.length) sections.push("");
      sections.push("UNSAFE CONDITION", ...ic.unsafeCondition.map(item => `• ${item}`));
    }
    return sections.join("\n");
  };

  const buildRootCauseText = (rc: { individualFactor: string[]; systemFactor: string[] }): string => {
    const sections: string[] = [];
    if (rc?.individualFactor?.length) {
      sections.push("INDIVIDUAL FACTOR", ...rc.individualFactor.map(item => `• ${item}`));
    }
    if (rc?.systemFactor?.length) {
      if (sections.length) sections.push("");
      sections.push("SYSTEM FACTOR", ...rc.systemFactor.map(item => `• ${item}`));
    }
    return sections.join("\n");
  };

  const handleImmediateCauseSelect = () => {
    setIsImmediateCauseModalOpen(true);
  };

  const handleImmediateCauseSubmit = (causeData: { unsafeAct: string[], unsafeCondition: string[] }) => {
    form.setValue('immediateCause', causeData as any);
    setIsImmediateCauseModalOpen(false);
  };

  const handleRootCauseSelect = () => {
    setIsRootCauseModalOpen(true);
  };

  const handleRootCauseSubmit = (causeData: { individualFactor: string[], systemFactor: string[] }) => {
    form.setValue('rootCause', causeData as any);
    setIsRootCauseModalOpen(false);
  };

  const saveDefect = async (data: DefectFormData, showToast = true, navigate = false, extensionsOverride?: typeof targetDateExtensions): Promise<boolean> => {
    // Prevent duplicate saves from rapid clicks
    if (isSaving) {
      return false;
    }
    
    // Validate mandatory fields: Vessel, Date Observed (issueDate), and Description
    const vesselId = data.vesselId?.trim() || '';
    const issueDate = data.issueDate?.trim() || '';
    const description = data.description?.trim() || '';
    
    if (!vesselId || !issueDate || !description) {
      const missingFields: string[] = [];
      if (!vesselId) missingFields.push('Vessel');
      if (!issueDate) missingFields.push('Date Observed');
      if (!description) missingFields.push('Description');
      
      toast({ 
        title: "Required fields missing", 
        description: `Please fill in: ${missingFields.join(', ')}`,
        variant: "destructive" 
      });
      return false;
    }
    
    setIsSaving(true);
    
    try {
      const submitData: any = {
        ...data,
        actions: actions,
        reference: defectId,
        partAAttachments: partAAttachments,
        attachments: fileAttachments,
        targetDateExtensions: extensionsOverride ?? targetDateExtensions,
      };
      
      // Use createdDefectId if we already created this defect in this session
      const existingId = currentDefect?.id || createdDefectId;
      
      if (existingId) {
        await apiRequest('PATCH', `/technical/api/defects/${existingId}`, submitData);
        queryClient.invalidateQueries({ queryKey: ['defects'] });
        if (showToast) {
          toast({ title: "Defect updated successfully" });
        }
      } else {
        const response = await apiRequest('POST', '/technical/api/defects', submitData);
        // Store the created defect ID to prevent duplicate creation on subsequent saves
        try {
          const createdDefect = await response.json();
          if (createdDefect && createdDefect.id) {
            setCreatedDefectId(createdDefect.id);
          }
        } catch (e) {
          // Response might not be JSON, ignore
        }
        queryClient.invalidateQueries({ queryKey: ['defects'] });
        if (showToast) {
          toast({ title: "Defect created successfully" });
        }
      }
      
      if (navigate && onCompleted) {
        onCompleted();
      } else if (navigate) {
        setLocation("/defects/active");
      }
      return true;
    } catch (error) {
      toast({ title: "Error saving defect", variant: "destructive" });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = async (data: DefectFormData) => {
    await saveDefect(data, true, false);
  };

  const handleStepSubmit = async (stepNumber: number): Promise<boolean> => {
    const data = form.getValues();
    const success = await saveDefect(data, true, false);
    if (success) {
      const partLabel = stepNumber === 1 ? 'A' : stepNumber === 2 ? 'B' : 'C';
      toast({ title: `Part ${partLabel} submitted successfully.` });
    }
    return success;
  };

  const openAddActionModal = () => {
    setEditingAction(null);
    setIsAddActionModalOpen(true);
  };

  const openEditActionModal = (action: Action) => {
    setEditingAction(action);
    setIsAddActionModalOpen(true);
  };

  const handleSaveAction = (actionData: any) => {
    let updatedActions;
    if (editingAction) {
      updatedActions = actions.map(a => a.id === editingAction.id ? { ...editingAction, ...actionData } : a);
      setActions(updatedActions);
      toast({ title: "Action updated successfully" });
    } else {
      const newAction: Action = {
        id: Date.now().toString(),
        ...actionData,
      };
      updatedActions = [...actions, newAction];
      setActions(updatedActions);
      toast({ title: "Action added successfully" });
    }
    form.setValue('actions', updatedActions as any);
    setEditingAction(null);
  };

  const deleteAction = (id: string) => {
    const updatedActions = actions.filter(a => a.id !== id);
    setActions(updatedActions);
    form.setValue('actions', updatedActions as any);
    toast({ title: "Action deleted" });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files);
      const updatedAttachments = [...attachments, ...newFiles];
      setAttachments(updatedAttachments);
      
      const attachmentMetadata = updatedAttachments.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type
      }));
      form.setValue('attachments', attachmentMetadata as any);
      
      toast({ title: `${newFiles.length} file(s) selected` });
    }
  };

  const toggleViewMode = () => {
    setIsViewMode(!isViewMode);
  };

  // C2 Verification auto-fill handler for Office and PMS Admin users
  const handleVerifiedChange = (checked: boolean | "indeterminate", fieldOnChange: (value: boolean) => void) => {
    const isChecked = checked === true;
    fieldOnChange(isChecked);
    
    console.log('[C2 Auto-fill] Checkbox changed:', { 
      checked: isChecked, 
      userRole: currentUser?.role, 
      userName: currentUser?.fullName,
      crewDesignation: currentUser?.crewDesignation 
    });
    
    // Auto-fill for Office and PMS Admin users when checkbox is checked
    const canAutoFill = currentUser?.role === 'Office' || currentUser?.role === 'PMS Admin';
    if (isChecked && canAutoFill) {
      const today = new Date().toISOString().split('T')[0];
      console.log('[C2 Auto-fill] Applying auto-fill values:', { 
        dateVerified: today, 
        verifiedByName: currentUser?.fullName, 
        verifiedByOfficePosition: currentUser?.crewDesignation || currentUser?.role
      });
      
      form.setValue('dateVerified', today);
      if (currentUser?.fullName) {
        form.setValue('verifiedByName', currentUser.fullName);
      }
      // Use crewDesignation if available, otherwise fall back to role
      form.setValue('verifiedByOfficePosition', currentUser?.crewDesignation || currentUser?.role || '');
    }
  };

  const handleClose = async () => {
    // Auto-save before closing only if form has been modified by the user
    if (form.formState.isDirty) {
      const data = form.getValues();
      await saveDefect(data, false, false);
      toast({ title: "Defect saved automatically" });
    }
    
    if (onBack) {
      onBack();
    } else {
      setLocation("/defects/active");
    }
  };

  // IntersectionObserver for scroll-based section highlighting
  // IMPORTANT: This useEffect MUST be before any conditional returns to follow React's Rules of Hooks
  useEffect(() => {
    const observerOptions = {
      root: scrollContainerRef.current,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute('data-section');
          if (sectionId === 'A' || sectionId === 'B' || sectionId === 'C') {
            setActiveSection(sectionId);
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    if (partARef.current) observer.observe(partARef.current);
    if (partBRef.current) observer.observe(partBRef.current);
    if (partCRef.current) observer.observe(partCRef.current);

    return () => observer.disconnect();
  }, []);
  
  if (isLoadingDefect) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading defect...</p>
        </div>
      </div>
    );
  }
  
  if (fetchError) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="mb-4 text-red-500">
            <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-800 font-medium mb-2">Failed to load defect</p>
          <p className="text-gray-600 mb-4">The defect could not be found or an error occurred.</p>
          <Button onClick={handleClose} className="bg-blue-600 hover:bg-blue-700">
            Back to Defects
          </Button>
        </div>
      </div>
    );
  }
  
  const getTitle = () => {
    if (!currentDefect) return 'New Defect Report';
    return isViewMode ? 'View Defect Report' : 'Edit Defect Report';
  };

  const steps = [
    { id: 1, label: 'A', name: 'Reporting', ref: partARef },
    { id: 2, label: 'B', name: 'Analysis & Actions', ref: partBRef },
    { id: 3, label: 'C', name: 'Closeout', ref: partCRef },
  ];

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-semibold text-gray-900">{getTitle()}</h1>
        <div className="flex items-center gap-2">
          {currentDefect && (
            <Button
              variant="outline"
              onClick={toggleViewMode}
              className="text-gray-700 border-gray-300 h-9"
              data-testid="button-toggle-mode"
            >
              <Eye className="h-4 w-4 mr-2" />
              {isViewMode ? 'Edit' : 'View'}
            </Button>
          )}
          {!isViewMode && (
            <Button
              onClick={async () => {
                const data = form.getValues();
                await saveDefect(data, true, false);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white h-9 px-6 font-medium"
              data-testid="button-save"
            >
              SAVE
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 h-9 w-9"
            data-testid="button-close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main layout with sidebar and content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Steps */}
        <div className="w-48 bg-gray-50 flex flex-col pt-6 shrink-0">
          {steps.map((step) => (
            <div 
              key={step.id}
              onClick={() => scrollToSection(step.ref)} 
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                activeSection === step.label 
                  ? 'bg-blue-600 text-white' 
                  : 'border-2 border-gray-300 text-gray-500 bg-white'
              }`}>
                {step.label}
              </div>
              <span className={`text-sm font-medium ${activeSection === step.label ? 'text-blue-600' : 'text-gray-600'}`}>
                {step.name}
              </span>
            </div>
          ))}
        </div>

        {/* Main Content Area */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <div className="max-w-5xl mx-auto space-y-6">
            
            {/* Part A: Reporting */}
            <div ref={partARef} data-section="A" className="bg-white border border-gray-200 shadow-sm rounded-lg p-6 scroll-mt-6">
                <div className="flex items-start justify-between mb-2">
                  <h2 className="text-xl font-semibold text-[#1e3a5f]">Part A: Reporting</h2>
                  <div className="text-sm text-gray-600">
                    <span className="font-normal">Report ID: </span>
                    <span className="font-semibold text-gray-800" data-testid="text-report-id">
                      {currentDefect?.id || (mode === 'new' ? 'Auto-generated on save' : '')}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-1">Describe what happened</p>
                <div className="h-0.5 bg-blue-500 mt-3 mb-6" />
                
                <div className="space-y-6">
                  {/* Column Headers */}
                  <div className="grid grid-cols-3 gap-x-6">
                    <div className="text-sm font-semibold" style={{ color: '#1e3a5f' }}>Basic</div>
                    <div className="text-sm font-semibold" style={{ color: '#1e3a5f' }}>Equipment / Hardware</div>
                    <div className="text-sm font-semibold" style={{ color: '#1e3a5f' }}>Timeline</div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                    {/* Row 1: Vessel, Category, Date Observed */}
                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Vessel<span className="text-red-500">*</span></label>
                      <Controller
                        name="vesselId"
                        control={form.control}
                        render={({ field }) => (
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              const selectedVessel = vessels.find((v: any) => v.id === value);
                              if (selectedVessel) {
                                form.setValue('vesselName', selectedVessel.name);
                              }
                            }} 
                            value={field.value || ""} 
                            disabled={isViewMode}
                          >
                            <SelectTrigger data-testid="select-vessel" className="h-10 text-sm border-gray-300">
                              <SelectValue placeholder="Select vessel">
                                {field.value && vessels.length > 0 
                                  ? (vessels.find((v: any) => v.id === field.value)?.name || field.value)
                                  : (field.value || "Select vessel")}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {vessels.map((vessel: any) => (
                                <SelectItem key={vessel.id} value={vessel.id}>{vessel.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Category</label>
                      <Controller
                        name="equipmentCategory"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                            <SelectTrigger data-testid="select-equipment-category" className="h-10 text-sm border-gray-300">
                              <SelectValue placeholder="Select category">
                                {field.value || "Select category"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {equipmentCategories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Date Observed<span className="text-red-500">*</span></label>
                      <Input 
                        {...form.register("issueDate")} 
                        type="date"
                        max={new Date().toISOString().split('T')[0]}
                        data-testid="input-date-observed"
                        className="h-10 text-sm border-gray-300"
                        disabled={isViewMode}
                      />
                    </div>

                    {/* Row 2: Source, Type, Date Reported to Office */}
                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Source</label>
                      <Controller
                        name="source"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                            <SelectTrigger data-testid="select-source" className="h-10 text-sm border-gray-300">
                              <SelectValue placeholder="Select source">
                                {field.value 
                                  ? (defectSources.find(s => s.id === field.value)?.name || field.value)
                                  : "Select source"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {defectSources.map((source) => (
                                <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Component</label>
                      <Controller
                        name="componentHardwareId"
                        control={form.control}
                        render={({ field }) => (
                          <SireHardwareClassCombobox
                            selectedId={field.value || ""}
                            displayValue={form.watch('componentHardwareLevel3') || ""}
                            onSelect={(id, level1, level2, level3) => {
                              form.setValue('componentHardwareId', id);
                              form.setValue('componentHardwareLevel1', level1);
                              form.setValue('componentHardwareLevel2', level2);
                              form.setValue('componentHardwareLevel3', level3);
                            }}
                            disabled={isViewMode}
                            placeholder="Select component"
                            testId="combobox-component"
                          />
                        )}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Date Reported to Office</label>
                      <Input 
                        {...form.register("dateReportedToOffice")} 
                        type="date"
                        max={new Date().toISOString().split('T')[0]}
                        data-testid="input-date-reported-office"
                        className="h-10 text-sm border-gray-300"
                        disabled={isViewMode}
                      />
                    </div>

                    {/* Row 3: Defect Category, Make, Date Registered in System (SAIL) */}
                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Defect Category</label>
                      <Controller
                        name="defectCategory"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                            <SelectTrigger data-testid="select-defect-category" className="h-10 text-sm border-gray-300">
                              <SelectValue placeholder="Select defect category">
                                {field.value || "Select defect category"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {defectCategoriesData.map((cat) => (
                                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Make</label>
                      <Controller
                        name="equipmentMake"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                            <SelectTrigger data-testid="select-make" className="h-10 text-sm border-gray-300">
                              <SelectValue placeholder="Select make">
                                {field.value || "Select make"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Caterpillar">Caterpillar</SelectItem>
                              <SelectItem value="MAN">MAN</SelectItem>
                              <SelectItem value="Wartsila">Wartsila</SelectItem>
                              <SelectItem value="Kongsberg">Kongsberg</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Date Registered in System</label>
                      <Input 
                        {...form.register("dateRegisteredInSystem")} 
                        type="date"
                        max={new Date().toISOString().split('T')[0]}
                        data-testid="input-date-registered-system"
                        className="h-10 text-sm border-gray-300"
                        disabled={isViewMode}
                      />
                    </div>

                    {/* Row 4: Defect Type, Model, Target Date */}
                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Defect Type</label>
                      <Controller
                        name="defectType"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                            <SelectTrigger data-testid="select-defect-type" className="h-10 text-sm border-gray-300">
                              <SelectValue placeholder="Select defect type">
                                {field.value || "Select defect type"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {defectTypesData.map((type) => (
                                <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Model</label>
                      <Controller
                        name="equipmentModel"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                            <SelectTrigger data-testid="select-model" className="h-10 text-sm border-gray-300">
                              <SelectValue placeholder="Select model">
                                {field.value || "Select model"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="3516">3516</SelectItem>
                              <SelectItem value="6L32">6L32</SelectItem>
                              <SelectItem value="W32">W32</SelectItem>
                              <SelectItem value="K-Chief">K-Chief</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1.5">
                        <label className="text-sm text-gray-600">Target Date</label>
                        {targetDateExtensions.some(ext => ext.status === 'Approved') && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800" data-testid="badge-extended">
                            Extended
                          </span>
                        )}
                      </div>
                      <Input 
                        {...form.register("targetCloseDate")} 
                        type="date"
                        data-testid="input-target-date"
                        className="h-10 text-sm border-gray-300"
                        disabled={isViewMode}
                      />
                    </div>

                    {/* Row 5: Raised By, CoC Checkbox, Date Closed */}
                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Raised By</label>
                      <Controller
                        name="raisedByName"
                        control={form.control}
                        render={({ field }) => (
                          <Select 
                            onValueChange={(value) => {
                              const [rank, ...nameParts] = value.split(" - ");
                              const name = nameParts.join(" - ");
                              field.onChange(name);
                              form.setValue("raisedByRank", rank);
                              form.setValue("raisedById", value);
                            }} 
                            value={form.watch("raisedByRank") && field.value ? `${form.watch("raisedByRank")} - ${field.value}` : ""}
                            disabled={isViewMode}
                          >
                            <SelectTrigger data-testid="select-raised-by" className="h-10 text-sm border-gray-300">
                              <SelectValue placeholder="Select person">
                                {form.watch("raisedByRank") && field.value 
                                  ? `${form.watch("raisedByRank")} - ${field.value}`
                                  : "Select person"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Master - System User">Master - System User</SelectItem>
                              <SelectItem value="Chief Engineer - John Mathews">Chief Engineer - John Mathews</SelectItem>
                              <SelectItem value="2nd Officer - Rahul Verma">2nd Officer - Rahul Verma</SelectItem>
                              <SelectItem value="AB - Suresh Kumar">AB - Suresh Kumar</SelectItem>
                              <SelectItem value="Chief Officer - Mike Anderson">Chief Officer - Mike Anderson</SelectItem>
                              <SelectItem value="2E - David Smith">2E - David Smith</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="flex flex-col justify-end">
                      <div className="flex items-center gap-6 h-10">
                        <Controller
                          name="is_coc"
                          control={form.control}
                          render={({ field }) => (
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id="coc"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-coc"
                                disabled={isViewMode}
                              />
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Label htmlFor="coc" className="text-sm font-normal cursor-pointer text-gray-700">
                                    CoC
                                  </Label>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Condition of Class</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          )}
                        />
                        <Controller
                          name="critical"
                          control={form.control}
                          render={({ field }) => (
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id="critical"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-critical-eqpt"
                                disabled={isViewMode}
                              />
                              <Label htmlFor="critical" className="text-sm font-normal cursor-pointer text-gray-700">
                                Critical Eqpt.
                              </Label>
                            </div>
                          )}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Date Closed</label>
                      <Input 
                        value={dateCompletedValue || ""}
                        type="date"
                        data-testid="input-date-closed"
                        className="h-10 text-sm border-gray-300 bg-gray-50"
                        disabled
                        readOnly
                      />
                    </div>
                  </div>

                  {/* Vessel Location Section - Hidden for now */}
                  {false && <div className="space-y-4 bg-gray-50 p-4 rounded-md border border-gray-200 mt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700">Vessel Location</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Select vessel location type</p>
                      </div>
                      <Controller
                        name="vesselLocationType"
                        control={form.control}
                        render={({ field }) => (
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-medium ${field.value === 'atPort' ? 'text-blue-600' : 'text-gray-500'}`}>
                              At Port
                            </span>
                            <Switch
                              checked={field.value === 'atSea'}
                              onCheckedChange={(checked) => field.onChange(checked ? 'atSea' : 'atPort')}
                              data-testid="switch-vessel-location"
                              disabled={isViewMode}
                              className="data-[state=checked]:bg-blue-600"
                            />
                            <span className={`text-sm font-medium ${field.value === 'atSea' ? 'text-blue-600' : 'text-gray-500'}`}>
                              At Sea
                            </span>
                          </div>
                        )}
                      />
                    </div>

                    {form.watch('vesselLocationType') === 'atPort' ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">Port Name</label>
                          <Controller
                            name="portName"
                            control={form.control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                value={field.value || ""}
                                placeholder="Enter port name"
                                className="h-10 text-sm border-gray-300"
                                data-testid="input-port-name"
                                disabled={isViewMode}
                              />
                            )}
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">Vessel Location</label>
                          <Controller
                            name="vesselLocationDetail"
                            control={form.control}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                                <SelectTrigger data-testid="select-vessel-location" className="h-10 text-sm border-gray-300">
                                  <SelectValue placeholder="Select location" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Alongside">Alongside</SelectItem>
                                  <SelectItem value="Anchorage">Anchorage</SelectItem>
                                  <SelectItem value="Berth">Berth</SelectItem>
                                  <SelectItem value="Dry Dock">Dry Dock</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-4">
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">Latitude</label>
                          <Controller
                            name="latitude"
                            control={form.control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                value={field.value || ""}
                                placeholder="e.g., 12.9716° N"
                                className="h-10 text-sm border-gray-300"
                                data-testid="input-latitude"
                                disabled={isViewMode}
                              />
                            )}
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">Longitude</label>
                          <Controller
                            name="longitude"
                            control={form.control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                value={field.value || ""}
                                placeholder="e.g., 77.5946° E"
                                className="h-10 text-sm border-gray-300"
                                data-testid="input-longitude"
                                disabled={isViewMode}
                              />
                            )}
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">Vessel Location</label>
                          <Controller
                            name="vesselLocationDetail"
                            control={form.control}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                                <SelectTrigger data-testid="select-vessel-location" className="h-10 text-sm border-gray-300">
                                  <SelectValue placeholder="Select location" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Open Sea">Open Sea</SelectItem>
                                  <SelectItem value="Coastal Waters">Coastal Waters</SelectItem>
                                  <SelectItem value="Territorial Waters">Territorial Waters</SelectItem>
                                  <SelectItem value="International Waters">International Waters</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </div>}

                  {/* Description */}
                  <div className="space-y-2 mt-6">
                    <label className="text-sm text-gray-600">Description<span className="text-red-500">*</span></label>
                    <Controller
                      name="description"
                      control={form.control}
                      render={({ field }) => (
                        <Textarea
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="bg-white min-h-[120px]"
                          placeholder="Enter defect description..."
                          disabled={isViewMode}
                        />
                      )}
                    />
                  </div>

                  {/* Attachments Button and Submit Button for Part A */}
                  {!isViewMode && (
                    <div className="flex justify-end items-center gap-3 pt-6 mt-6 border-t border-gray-200">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsPartAAttachmentDialogOpen(true)}
                        disabled={isViewMode}
                        data-testid="button-part-a-attachments"
                        className="border-gray-300"
                      >
                        <Paperclip className="h-4 w-4 mr-2" />
                        Attachment(s)
                        {partAAttachments.length > 0 && (
                          <span className="ml-2 bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                            {partAAttachments.length}
                          </span>
                        )}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleStepSubmit(1)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                        data-testid="button-submit-part-a"
                      >
                        Submit
                      </Button>
                    </div>
                  )}
                </div>
              </div>

            {/* Part B: Analysis & Actions */}
            <div ref={partBRef} data-section="B" className="bg-white border border-gray-200 shadow-sm rounded-lg p-6 scroll-mt-6">
                <h2 className="text-xl font-semibold text-[#1e3a5f]">Part B: Analysis & Actions</h2>
                <p className="text-sm text-gray-500 mt-1">Cause analysis and corrective actions</p>
                <div className="h-0.5 bg-blue-500 mt-3 mb-6" />
                
                <div className="space-y-8">
                  {/* B1. Cause Analysis */}
                  <div className="space-y-6">
                    <h3 className="text-sm font-semibold" style={{ color: '#16569e' }}>B1. Cause Analysis</h3>
                    
                    {/* Immediate Cause */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-end">
                        <Button 
                          type="button"
                          variant="outline" 
                          size="sm" 
                          className="text-gray-600 border-gray-300 hover:bg-gray-50" 
                          data-testid="button-select-immediate"
                          onClick={handleImmediateCauseSelect}
                          disabled={isViewMode}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Select
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">Immediate Cause</label>
                          <Controller
                            name="immediateCause"
                            control={form.control}
                            render={({ field }) => (
                              <Textarea 
                                {...field}
                                value={typeof field.value === 'string' ? field.value : 
                                       field.value && typeof field.value === 'object' ? 
                                       buildImmediateCauseText(field.value as { unsafeAct: string[], unsafeCondition: string[] }) : ""}
                                rows={3}
                                placeholder="IMMEDIATE CAUSE"
                                className="bg-white text-sm border-gray-300"
                                data-testid="textarea-immediate-cause"
                                readOnly
                              />
                            )}
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">Further Explanation</label>
                          <Textarea 
                            {...form.register("immediateCauseExplanation")}
                            rows={3}
                            placeholder="FURTHER EXPLANATION"
                            className="bg-white text-sm border-gray-300"
                            data-testid="textarea-immediate-explanation"
                            disabled={isViewMode}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Root Cause */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-end">
                        <Button 
                          type="button"
                          variant="outline" 
                          size="sm" 
                          className="text-gray-600 border-gray-300 hover:bg-gray-50" 
                          data-testid="button-select-root"
                          onClick={handleRootCauseSelect}
                          disabled={isViewMode}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Select
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">Root Cause</label>
                          <Controller
                            name="rootCause"
                            control={form.control}
                            render={({ field }) => (
                              <Textarea 
                                {...field}
                                value={typeof field.value === 'object' && field.value ? 
                                  buildRootCauseText(field.value as { individualFactor: string[], systemFactor: string[] }) : 
                                  String(field.value || "")}
                                rows={3}
                                placeholder="ROOT CAUSE"
                                className="bg-white text-sm border-gray-300"
                                data-testid="textarea-root-cause"
                                readOnly
                              />
                            )}
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">Further Explanation</label>
                          <Textarea 
                            {...form.register("rootCauseExplanation")}
                            rows={3}
                            placeholder="FURTHER EXPLANATION"
                            className="bg-white text-sm border-gray-300"
                            data-testid="textarea-root-explanation"
                            disabled={isViewMode}
                          />
                        </div>
                      </div>
                    </div>

                    {/* B2. SIRE Reference */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold" style={{ color: '#16569e' }}>B2. SIRE Reference</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">SIRE Version</label>
                          <Controller
                            name="viqVersion"
                            control={form.control}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                                <SelectTrigger data-testid="select-viq-version" className="h-10 text-sm border-gray-300">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="VIQ 7">VIQ 7</SelectItem>
                                  <SelectItem value="SIRE 2.0">SIRE 2.0</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">SIRE Reference</label>
                          <Controller
                            name="viqRef"
                            control={form.control}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                                <SelectTrigger data-testid="select-viq-ref" className="h-10 text-sm border-gray-300">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                  <SelectItem value="1.1">1.1 - Vessel Name</SelectItem>
                                  <SelectItem value="1.2">1.2 - IMO Number</SelectItem>
                                  <SelectItem value="1.3">1.3 - Inspection Date</SelectItem>
                                  <SelectItem value="2.1">2.1 - Statutory Certificates Valid</SelectItem>
                                  <SelectItem value="3.1">3.1 - Manning Level Adequate</SelectItem>
                                  <SelectItem value="4.1">4.1 - Navigation Procedures</SelectItem>
                                  <SelectItem value="5.1">5.1 - Risk Assessment Process</SelectItem>
                                  <SelectItem value="6.1">6.1 - Shipboard Oil Pollution Emergency Plan</SelectItem>
                                  <SelectItem value="7.1">7.1 - Ship Security Plan</SelectItem>
                                  <SelectItem value="8.1">8.1 - Cargo System Knowledge</SelectItem>
                                  <SelectItem value="9.1">9.1 - Mooring Equipment Inspection</SelectItem>
                                  <SelectItem value="10.1">10.1 - Engine Room Procedures</SelectItem>
                                  <SelectItem value="11.1">11.1 - Hull Condition</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">SIRE Hardware Class</label>
                          <Controller
                            name="sireHardwareId"
                            control={form.control}
                            render={({ field }) => (
                              <SireHardwareClassCombobox
                                selectedId={field.value || ""}
                                displayValue={form.watch('sireHardwareLevel3') || ""}
                                onSelect={(id, level1, level2, level3) => {
                                  form.setValue('sireHardwareId', id);
                                  form.setValue('sireHardwareLevel1', level1);
                                  form.setValue('sireHardwareLevel2', level2);
                                  form.setValue('sireHardwareLevel3', level3);
                                }}
                                disabled={isViewMode}
                                placeholder="Select hardware class"
                                testId="combobox-sire-hardware-class"
                              />
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* B3. Risk & Priority */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold" style={{ color: '#16569e' }}>B3. Risk & Priority</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1.5">Risk Level</label>
                        <Controller
                          name="riskLevel"
                          control={form.control}
                          render={({ field }) => {
                            const getRiskColor = (value: string) => {
                              switch (value) {
                                case 'Low': return 'bg-green-500 text-white border-green-500';
                                case 'Medium': return 'bg-orange-500 text-white border-orange-500';
                                case 'High': return 'bg-red-500 text-white border-red-500';
                                default: return 'bg-white text-gray-900 border-gray-300';
                              }
                            };
                            return (
                              <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                                <SelectTrigger 
                                  data-testid="select-risk-level" 
                                  className={`h-10 text-sm ${getRiskColor(field.value || '')}`}
                                >
                                  <SelectValue placeholder="Select risk" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Low">Low</SelectItem>
                                  <SelectItem value="Medium">Medium</SelectItem>
                                  <SelectItem value="High">High</SelectItem>
                                </SelectContent>
                              </Select>
                            );
                          }}
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1.5">Priority</label>
                        <Controller
                          name="priority"
                          control={form.control}
                          render={({ field }) => {
                            const getPriorityColor = (value: string) => {
                              switch (value) {
                                case 'Low': return 'bg-green-500 text-white border-green-500';
                                case 'Medium': return 'bg-orange-500 text-white border-orange-500';
                                case 'High': return 'bg-red-500 text-white border-red-500';
                                default: return 'bg-white text-gray-900 border-gray-300';
                              }
                            };
                            return (
                              <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                                <SelectTrigger 
                                  data-testid="select-priority" 
                                  className={`h-10 text-sm ${getPriorityColor(field.value || '')}`}
                                >
                                  <SelectValue placeholder="Select Priority" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Low">Low</SelectItem>
                                  <SelectItem value="Medium">Medium</SelectItem>
                                  <SelectItem value="High">High</SelectItem>
                                </SelectContent>
                              </Select>
                            );
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* B4. Actions Table */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold" style={{ color: '#16569e' }}>B4. Actions</h3>
                      {!isViewMode && (
                        <Button 
                          type="button"
                          variant="outline" 
                          size="sm" 
                          className="text-gray-600 border-gray-300 hover:bg-gray-50"
                          onClick={openAddActionModal}
                          data-testid="button-add-action"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Action
                        </Button>
                      )}
                    </div>

                    {actions.length > 0 ? (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="text-xs font-medium text-gray-600">Action Type</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600">Description</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600">Proposed By</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600">Responsibility</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600">Due Date</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600">Status</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {actions.map((action) => (
                              <TableRow key={action.id}>
                                <TableCell className="text-sm">{action.actionType}</TableCell>
                                <TableCell className="text-sm">{action.actionDescription || "N/A"}</TableCell>
                                <TableCell className="text-sm">{action.proposedBy}</TableCell>
                                <TableCell className="text-sm">{action.responsibility}</TableCell>
                                <TableCell className="text-sm">{action.dueDate}</TableCell>
                                <TableCell>
                                  <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
                                    {action.status}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      className="h-7 w-7 p-0"
                                      onClick={() => openEditActionModal(action)}
                                      data-testid={`button-edit-action-${action.id}`}
                                      disabled={isViewMode}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      className="h-7 w-7 p-0"
                                      onClick={() => deleteAction(action.id)}
                                      data-testid={`button-delete-action-${action.id}`}
                                      disabled={isViewMode}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                        <p className="text-gray-500 text-sm">No actions added yet</p>
                      </div>
                    )}
                  </div>

                  {/* B5. Target Date Extension */}
                  <div className="space-y-4 pt-6">
                    <div className="flex items-center justify-center">
                      {!showExtensionForm && targetDateExtensions.length === 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowExtensionForm(true)}
                          disabled={isViewMode}
                          data-testid="button-extend-target-date"
                          className="border-gray-300"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Extend Target Date
                        </Button>
                      )}
                    </div>

                    {(showExtensionForm || targetDateExtensions.length > 0) && (
                      <div className="border border-amber-300 rounded-lg p-6 bg-amber-50/30 space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold" style={{ color: '#16569e' }}>B5. Target Date Extension</h3>
                          {targetDateExtensions.length > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600">Status:</span>
                              <span className={`text-sm font-medium ${
                                targetDateExtensions[targetDateExtensions.length - 1]?.status === 'Approved' 
                                  ? 'text-green-600' 
                                  : targetDateExtensions[targetDateExtensions.length - 1]?.status === 'Rejected'
                                    ? 'text-red-600'
                                    : 'text-amber-600'
                              }`}>
                                {targetDateExtensions[targetDateExtensions.length - 1]?.status?.toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <div className="flex flex-col">
                            <label className="text-sm text-gray-600 mb-1.5">Existing Target Date (Auto filled)</label>
                            <Input 
                              type="date"
                              value={form.watch('targetCloseDate') || ''}
                              disabled
                              data-testid="input-existing-target-date"
                              className="h-10 text-sm border-gray-300 bg-gray-100"
                            />
                          </div>
                          <div className="flex flex-col">
                            <label className="text-sm text-gray-600 mb-1.5">New Target Date</label>
                            <Input 
                              type="date"
                              value={currentExtension.newTargetDate}
                              onChange={(e) => setCurrentExtension(prev => ({ ...prev, newTargetDate: e.target.value }))}
                              disabled={isViewMode}
                              data-testid="input-new-target-date"
                              className="h-10 text-sm border-gray-300"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <div className="flex flex-col">
                            <label className="text-sm text-gray-600 mb-1.5">Reason for Extension</label>
                            <Textarea 
                              value={currentExtension.reasonForExtension}
                              onChange={(e) => setCurrentExtension(prev => ({ ...prev, reasonForExtension: e.target.value }))}
                              disabled={isViewMode}
                              data-testid="input-reason-for-extension"
                              className="text-sm border-gray-300 min-h-[80px]"
                              placeholder="Enter reason for extension..."
                            />
                          </div>
                          <div className="flex flex-col">
                            <label className="text-sm text-gray-600 mb-1.5">Submit for Approval to:</label>
                            <Select
                              value={currentExtension.submitForApprovalTo}
                              onValueChange={(value) => setCurrentExtension(prev => ({ ...prev, submitForApprovalTo: value }))}
                              disabled={isViewMode}
                            >
                              <SelectTrigger data-testid="select-approval-to" className="h-10 text-sm border-gray-300">
                                <SelectValue placeholder="Select approver" />
                              </SelectTrigger>
                              <SelectContent>
                                {officeUsers.map((user: any) => (
                                  <SelectItem key={user.id} value={user.id.toString()}>
                                    {user.displayName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <div className="flex items-center gap-6">
                            <span className="text-sm text-gray-600">Approved?</span>
                            <div className="flex items-center gap-4">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="approved"
                                  checked={currentExtension.approved === true}
                                  onChange={() => setCurrentExtension(prev => ({ ...prev, approved: true }))}
                                  disabled={isViewMode}
                                  className="w-4 h-4 text-blue-600"
                                  data-testid="radio-approved-yes"
                                />
                                <span className="text-sm">Yes</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="approved"
                                  checked={currentExtension.approved === false}
                                  onChange={() => setCurrentExtension(prev => ({ ...prev, approved: false }))}
                                  disabled={isViewMode}
                                  className="w-4 h-4 text-blue-600"
                                  data-testid="radio-approved-no"
                                />
                                <span className="text-sm">No</span>
                              </label>
                            </div>
                          </div>
                          <div className="flex flex-col">
                            <label className="text-sm text-gray-600 mb-1.5">Approval Date</label>
                            <Input 
                              type="date"
                              value={currentExtension.approvalDate}
                              onChange={(e) => setCurrentExtension(prev => ({ ...prev, approvalDate: e.target.value }))}
                              disabled={isViewMode}
                              data-testid="input-approval-date"
                              className="h-10 text-sm border-gray-300"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">Approver Comments (if any):</label>
                          <Textarea 
                            value={currentExtension.approverComments}
                            onChange={(e) => setCurrentExtension(prev => ({ ...prev, approverComments: e.target.value }))}
                            disabled={isViewMode}
                            data-testid="input-approver-comments"
                            className="text-sm border-gray-300 min-h-[60px]"
                            placeholder="Enter approver comments..."
                          />
                        </div>

                        {targetDateExtensions.length > 0 && targetDateExtensions[targetDateExtensions.length - 1]?.electronicConfirmation && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span>Electronic Confirmation (System Generated):</span>
                            <span className="italic text-gray-800">
                              {targetDateExtensions[targetDateExtensions.length - 1]?.electronicConfirmation}
                            </span>
                          </div>
                        )}

                        {!isViewMode && (
                          <div className="flex justify-end pt-2">
                            <Button
                              type="button"
                              onClick={async () => {
                                // Prevent duplicate submissions
                                if (isSubmittingExtension) return;
                                setIsSubmittingExtension(true);
                                
                                try {
                                  // Validate form before saving
                                  const isValid = await form.trigger();
                                  if (!isValid) {
                                    toast({ title: "Please fix form errors before submitting extension", variant: "destructive" });
                                    return;
                                  }
                                  
                                  const existingTargetDate = form.getValues('targetCloseDate') || '';
                                  const approverUser = officeUsers.find((u: any) => u.id.toString() === currentExtension.submitForApprovalTo);
                                  const newExtension = {
                                    id: `EXT-${Date.now()}`,
                                    existingTargetDate,
                                    newTargetDate: currentExtension.newTargetDate,
                                    reasonForExtension: currentExtension.reasonForExtension,
                                    submitForApprovalTo: currentExtension.submitForApprovalTo,
                                    submitForApprovalToName: approverUser?.fullName || '',
                                    status: (currentExtension.approved === true ? 'Approved' : currentExtension.approved === false ? 'Rejected' : 'Requested') as 'Requested' | 'Approved' | 'Rejected',
                                    approved: currentExtension.approved,
                                    approvalDate: currentExtension.approvalDate,
                                    approverComments: currentExtension.approverComments,
                                    electronicConfirmation: currentExtension.approved !== undefined 
                                      ? `Approved by System User on ${new Date().toLocaleDateString()}` 
                                      : undefined,
                                    requestedAt: new Date().toISOString(),
                                  };
                                  
                                  // Update the extensions array
                                  const updatedExtensions = [...targetDateExtensions, newExtension];
                                  setTargetDateExtensions(updatedExtensions);
                                  
                                  if (newExtension.status === 'Approved' && newExtension.newTargetDate) {
                                    form.setValue('targetCloseDate', newExtension.newTargetDate);
                                    form.setValue('isDeferred', true);
                                  }
                                  
                                  // Don't clear currentExtension - keep the values visible in the form
                                  
                                  // Auto-save using the existing saveDefect function with the updated extensions
                                  const formData = form.getValues();
                                  const success = await saveDefect(formData, false, false, updatedExtensions);
                                  
                                  if (success) {
                                    toast({ title: newExtension.status === 'Requested' ? "Extension request submitted and saved" : `Extension ${newExtension.status.toLowerCase()} and saved` });
                                  } else {
                                    toast({ title: "Extension added but save failed. Please click SAVE.", variant: "destructive" });
                                  }
                                } finally {
                                  setIsSubmittingExtension(false);
                                }
                              }}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                              data-testid="button-submit-extension"
                              disabled={!currentExtension.newTargetDate || !currentExtension.reasonForExtension || isSubmittingExtension}
                            >
                              {isSubmittingExtension ? 'Saving...' : 'Submit'}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Attachments Button and Submit Button for Part B */}
                  {!isViewMode && (
                    <div className="flex justify-end items-center gap-3 pt-6 mt-6 border-t border-gray-200">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAttachmentDialogOpen(true)}
                        disabled={isViewMode}
                        data-testid="button-attachments"
                        className="border-gray-300"
                      >
                        <Paperclip className="h-4 w-4 mr-2" />
                        Attachment(s)
                        {fileAttachments.length > 0 && (
                          <span className="ml-2 bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                            {fileAttachments.length}
                          </span>
                        )}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleStepSubmit(2)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                        data-testid="button-submit-part-b"
                      >
                        Submit
                      </Button>
                    </div>
                  )}
                </div>
              </div>

            {/* Part C: Closeout */}
            <div ref={partCRef} data-section="C" className="bg-white border border-gray-200 shadow-sm rounded-lg p-6 scroll-mt-6">
                <h2 className="text-xl font-semibold text-[#1e3a5f]">Part C: Closeout</h2>
                <p className="text-sm text-gray-500 mt-1">Completion and Verification</p>
                <div className="h-0.5 bg-blue-500 mt-3 mb-6" />
                
                <div className="space-y-8">
                  {/* C1. Closeout Section */}
                  <div className="space-y-6">
                    <h3 className="text-base font-semibold text-[#1e3a5f]">C1. Closeout</h3>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div className="flex items-center gap-3">
                        <Controller
                          name="confirmCompleted"
                          control={form.control}
                          render={({ field }) => (
                            <Checkbox
                              id="confirm-completed"
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                              disabled={isViewMode}
                              data-testid="checkbox-confirm-completed"
                            />
                          )}
                        />
                        <Label htmlFor="confirm-completed" className="text-sm text-gray-700">Confirm Completed</Label>
                      </div>
                      <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1.5">Date Completed</label>
                        <Input 
                          {...form.register("dateCompleted")} 
                          type="date"
                          data-testid="input-date-completed"
                          className="h-10 text-sm border-gray-300"
                          disabled={isViewMode}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1.5">Closed By (Name)</label>
                        <Input 
                          {...form.register("closedByName")} 
                          data-testid="input-closed-by-name"
                          className="h-10 text-sm border-gray-300"
                          placeholder="Enter name"
                          disabled={isViewMode}
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1.5">Closed By (Rank)</label>
                        <Input 
                          {...form.register("closedByRank")} 
                          data-testid="input-closed-by-rank"
                          className="h-10 text-sm border-gray-300"
                          placeholder="Enter rank"
                          disabled={isViewMode}
                        />
                      </div>
                    </div>

                    {/* Submit Button for C1 */}
                    {!isViewMode && (
                      <div className="flex justify-end pt-4">
                        <Button
                          type="button"
                          onClick={() => handleStepSubmit(3)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                          data-testid="button-submit-c1"
                        >
                          Submit
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* C2. Verification Section */}
                  <div className="space-y-6 pt-4">
                    <h3 className="text-base font-semibold text-[#1e3a5f]">C2. Verification</h3>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div className="flex items-center gap-3">
                        <Controller
                          name="verified"
                          control={form.control}
                          render={({ field }) => (
                            <Checkbox
                              id="verified"
                              checked={field.value || false}
                              onCheckedChange={(checked) => handleVerifiedChange(checked, field.onChange)}
                              disabled={isViewMode}
                              data-testid="checkbox-verified"
                            />
                          )}
                        />
                        <Label htmlFor="verified" className="text-sm text-gray-700">Verified</Label>
                      </div>
                      <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1.5">Date Verified</label>
                        <Input 
                          {...form.register("dateVerified")} 
                          type="date"
                          data-testid="input-date-verified"
                          className="h-10 text-sm border-gray-300"
                          disabled={isViewMode}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1.5">Verified By (Name)</label>
                        <Input 
                          {...form.register("verifiedByName")} 
                          data-testid="input-verified-by-name"
                          className="h-10 text-sm border-gray-300"
                          placeholder="Enter name"
                          disabled={isViewMode}
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1.5">Verified By (Office Position)</label>
                        <Input 
                          {...form.register("verifiedByOfficePosition")} 
                          data-testid="input-verified-by-office-position"
                          className="h-10 text-sm border-gray-300"
                          placeholder="Enter office position"
                          disabled={isViewMode}
                        />
                      </div>
                    </div>

                    {/* Submit Button for C2 */}
                    {!isViewMode && (
                      <div className="flex justify-end pt-4">
                        <Button
                          type="button"
                          onClick={async () => {
                            const data = form.getValues();
                            await saveDefect(data, true, false);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                          data-testid="button-submit-c2"
                        >
                          Submit
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

          </div>
        </div>
      </div>

      {/* Modals */}
      <ImmediateCauseModal
        isOpen={isImmediateCauseModalOpen}
        onClose={() => setIsImmediateCauseModalOpen(false)}
        onSubmit={handleImmediateCauseSubmit}
        initialData={typeof form.getValues('immediateCause') === 'object' ? form.getValues('immediateCause') as any : undefined}
      />

      <RootCauseModal
        isOpen={isRootCauseModalOpen}
        onClose={() => setIsRootCauseModalOpen(false)}
        onSubmit={handleRootCauseSubmit}
        initialData={typeof form.getValues('rootCause') === 'object' ? form.getValues('rootCause') as any : undefined}
      />

      <AddActionModal
        open={isAddActionModalOpen}
        onOpenChange={setIsAddActionModalOpen}
        onSave={handleSaveAction}
        initialData={editingAction}
      />

      <FileAttachmentDialog
        open={isAttachmentDialogOpen}
        onOpenChange={setIsAttachmentDialogOpen}
        attachments={fileAttachments}
        onAttachmentsChange={setFileAttachments}
        title="C1 Attachments - Rectification Documentation"
        itemName="Rectification"
      />

      <FileAttachmentDialog
        open={isPartAAttachmentDialogOpen}
        onOpenChange={setIsPartAAttachmentDialogOpen}
        attachments={partAAttachments}
        onAttachmentsChange={setPartAAttachments}
        title="Part A Attachments - Defect Photos"
        itemName="Defect Photo"
      />
    </div>
  );
}
