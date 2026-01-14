import { useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Plus, Edit, Trash2, Eye, X } from "lucide-react";
import { insertDefectSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import ImmediateCauseModal from "@/components/ImmediateCauseModal";
import RootCauseModal from "@/components/RootCauseModal";
import AddActionModal from "@/components/AddActionModal";
import { useVessels } from "@/hooks/useVessels";
import { sireHardwareClasses, findHardwareClassById } from "@/data/sireHardwareClasses";
import { defectSources, findSourceById } from "@/data/defectSources";
import { SireHardwareClassCombobox } from "@/components/SireHardwareClassCombobox";

const defectFormSchema = insertDefectSchema.extend({
  critical: z.boolean().optional(),
  is_coc: z.boolean().optional(),
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

const quillModules = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    ['link'],
    [{ 'align': [] }],
    ['clean']
  ],
};

interface DefectFormWizardProps {
  defect?: any;
  mode?: 'view' | 'edit' | 'new';
  initialStep?: 1 | 2 | 3;
  onCompleted?: () => void;
  onBack?: () => void;
}

export default function DefectFormWizard({ 
  defect, 
  mode = 'new', 
  initialStep = 1,
  onCompleted,
  onBack
}: DefectFormWizardProps = {}) {
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();
  
  // Fetch equipment categories from database
  const { data: equipmentCategories = [] } = useQuery<{ id: number; name: string; sortOrder: number }[]>({
    queryKey: ['/technical/api/equipment-categories'],
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
  
  const form = useForm<DefectFormData>({
    resolver: zodResolver(defectFormSchema),
    defaultValues: {
      vesselId: "V001",
      vesselName: "MV SEAFARER",
      issueDate: new Date().toISOString().split('T')[0],
      category: "Defect",
      equipmentCategory: "",
      status: "Open",
      priority: "Medium",
      critical: false,
      is_coc: false,
      severity: 1,
      reportedBy: "MASTER",
      description: "",
      immediateCause: "",
      immediateCauseExplanation: "",
      rootCause: "",
      rootCauseExplanation: "",
      riskLevel: "",
      vesselLocationType: "atPort",
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
      });
      
      if (currentDefect.actions && Array.isArray(currentDefect.actions)) {
        setActions(currentDefect.actions);
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

  const saveDefect = async (data: DefectFormData, showToast = true, navigate = false): Promise<boolean> => {
    try {
      const submitData: any = {
        ...data,
        actions: actions,
        reference: defectId,
      };
      
      if (currentDefect?.id) {
        await apiRequest('PATCH', `/technical/api/defects/${currentDefect.id}`, submitData);
        queryClient.invalidateQueries({ queryKey: ['defects'] });
        if (showToast) {
          toast({ title: "Defect updated successfully" });
        }
      } else {
        await apiRequest('POST', '/technical/api/defects', submitData);
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
    }
  };

  const onSubmit = async (data: DefectFormData) => {
    await saveDefect(data, true, true);
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

  const handleClose = () => {
    if (onBack) {
      onBack();
    } else {
      setLocation("/defects/active");
    }
  };
  
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

  // IntersectionObserver for scroll-based section highlighting
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
              onClick={form.handleSubmit(onSubmit)}
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
                            value={field.value} 
                            disabled={isViewMode}
                          >
                            <SelectTrigger data-testid="select-vessel" className="h-10 text-sm border-gray-300">
                              <SelectValue />
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
                              <SelectValue placeholder="Select category" />
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
                              <SelectValue placeholder="Select source" />
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
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Hull / Structural Integrity">Hull / Structural Integrity</SelectItem>
                              <SelectItem value="Machinery Failure (Main & Auxiliary)">Machinery Failure (Main & Auxiliary)</SelectItem>
                              <SelectItem value="Electrical / Electronic Systems">Electrical / Electronic Systems</SelectItem>
                              <SelectItem value="Navigation & Communication Equipment">Navigation & Communication Equipment</SelectItem>
                              <SelectItem value="Safety & Emergency Systems (Fire, Lifesaving, Alarms)">Safety & Emergency Systems</SelectItem>
                              <SelectItem value="Ballast / Cargo / Tank Systems">Ballast / Cargo / Tank Systems</SelectItem>
                              <SelectItem value="Environmental / Pollution Control (e.g., BWM, SOx, OWS)">Environmental / Pollution Control</SelectItem>
                              <SelectItem value="Steering / Rudder / Propulsion Systems">Steering / Rudder / Propulsion Systems</SelectItem>
                              <SelectItem value="Deck Equipment & Mooring Systems">Deck Equipment & Mooring Systems</SelectItem>
                              <SelectItem value="Condition of Class (CoC) Related">Condition of Class (CoC) Related</SelectItem>
                              <SelectItem value="Survey / Certification Deficiencies">Survey / Certification Deficiencies</SelectItem>
                              <SelectItem value="Wear & Tear / Corrosion / Fatigue">Wear & Tear / Corrosion / Fatigue</SelectItem>
                              <SelectItem value="Human-/Operational Error (not equipment fault)">Human-/Operational Error</SelectItem>
                              <SelectItem value="Other / Miscellaneous">Other / Miscellaneous</SelectItem>
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
                              <SelectValue />
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
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Corrosion / Erosion">Corrosion / Erosion</SelectItem>
                              <SelectItem value="Crack / Fracture / Structural Deformation">Crack / Fracture / Structural Deformation</SelectItem>
                              <SelectItem value="Bearing / Shaft / Gear Failure">Bearing / Shaft / Gear Failure</SelectItem>
                              <SelectItem value="Pump / Compressor / Turbine Malfunction">Pump / Compressor / Turbine Malfunction</SelectItem>
                              <SelectItem value="Valve / Seal / Gasket Leak">Valve / Seal / Gasket Leak</SelectItem>
                              <SelectItem value="Electrical Short / Open Circuit / Ground Fault">Electrical Short / Open Circuit / Ground Fault</SelectItem>
                              <SelectItem value="Control System / Automation Failure">Control System / Automation Failure</SelectItem>
                              <SelectItem value="Sensor / Instrumentation Fault">Sensor / Instrumentation Fault</SelectItem>
                              <SelectItem value="Navigation / Communication System Fault">Navigation / Communication System Fault</SelectItem>
                              <SelectItem value="Safety Equipment Deficiency (Fire / Lifeboat / Alarm)">Safety Equipment Deficiency</SelectItem>
                              <SelectItem value="Ballast / Cargo / Tank System Defect">Ballast / Cargo / Tank System Defect</SelectItem>
                              <SelectItem value="Steering / Rudder / Propulsion System Defect">Steering / Rudder / Propulsion System Defect</SelectItem>
                              <SelectItem value="Mooring / Deck Equipment Failure">Mooring / Deck Equipment Failure</SelectItem>
                              <SelectItem value="Environmental Compliance Issue (BWM / SOx / OWS)">Environmental Compliance Issue</SelectItem>
                              <SelectItem value="Non-Conformity / Certification Lapse">Non-Conformity / Certification Lapse</SelectItem>
                              <SelectItem value="Inspection / Test Failure">Inspection / Test Failure</SelectItem>
                              <SelectItem value="Software / Firmware / Interface Error">Software / Firmware / Interface Error</SelectItem>
                              <SelectItem value="Recurring Fault (same equipment/system)">Recurring Fault</SelectItem>
                              <SelectItem value="Operational / Human Error Induced Defect">Operational / Human Error Induced Defect</SelectItem>
                              <SelectItem value="Documentation / Record-Keeping Defect">Documentation / Record-Keeping Defect</SelectItem>
                              <SelectItem value="Wear / Fatigue – Non-critical">Wear / Fatigue – Non-critical</SelectItem>
                              <SelectItem value="Survey Condition of Class Item">Survey Condition of Class Item</SelectItem>
                              <SelectItem value="Spare / Stock-Out / BOM Defect">Spare / Stock-Out / BOM Defect</SelectItem>
                              <SelectItem value="Other / Miscellaneous">Other / Miscellaneous</SelectItem>
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
                              <SelectValue />
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
                      <label className="text-sm text-gray-600 mb-1.5">Target Date</label>
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
                              <SelectValue placeholder="Select person" />
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
                        <ReactQuill
                          theme="snow"
                          value={field.value || ""}
                          onChange={field.onChange}
                          modules={quillModules}
                          className="bg-white"
                          placeholder="Enter defect description..."
                          readOnly={isViewMode}
                        />
                      )}
                    />
                  </div>

                  {/* Submit Button for Part A */}
                  {!isViewMode && (
                    <div className="flex justify-end pt-6 mt-6 border-t border-gray-200">
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

                  {/* B3. Risk */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold" style={{ color: '#16569e' }}>B3. Risk</h3>
                    <div className="flex flex-col w-48">
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

                  {/* Submit Button for Part B */}
                  {!isViewMode && (
                    <div className="flex justify-end pt-6 mt-6 border-t border-gray-200">
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
                <p className="text-sm text-gray-500 mt-1">Completion and approval</p>
                <div className="h-0.5 bg-blue-500 mt-3 mb-6" />
                
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
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

                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Verified Date</label>
                      <Input 
                        {...form.register("verifiedDate")} 
                        type="date"
                        data-testid="input-verified-date"
                        className="h-10 text-sm border-gray-300"
                        disabled={isViewMode}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-800">Attachments</h3>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 mb-1">Drop files here or click to upload</p>
                      <p className="text-xs text-gray-500 mb-3">PDF, JPG, PNG up to 10MB</p>
                      <input
                        type="file"
                        id="file-upload"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="border-gray-300"
                        data-testid="button-upload-attachment"
                        onClick={() => document.getElementById('file-upload')?.click()}
                        disabled={isViewMode}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Browse Files
                      </Button>
                    </div>
                    {attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-gray-600">Selected files:</p>
                        {attachments.map((file, index) => (
                          <p key={index} className="text-xs text-gray-500">• {file.name}</p>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col">
                    <label className="text-sm text-gray-600 mb-1.5">Closed By</label>
                    <Input 
                      {...form.register("closedBy")} 
                      data-testid="input-closed-by"
                      className="h-10 text-sm border-gray-300"
                      placeholder="Name & Rank"
                      disabled={isViewMode}
                    />
                  </div>

                  {/* Submit Button for Part C */}
                  {!isViewMode && (
                    <div className="flex justify-end pt-6 mt-6 border-t border-gray-200">
                      <Button
                        type="button"
                        onClick={form.handleSubmit(onSubmit)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                        data-testid="button-submit-part-c"
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
    </div>
  );
}
