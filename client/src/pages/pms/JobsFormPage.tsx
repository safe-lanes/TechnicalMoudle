import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, ArrowLeft, Menu, AlertTriangle, Save, X, Pencil, Trash2 } from "lucide-react";
import { Marker } from "@/components/Marker";
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
import { SectionBlock } from "@/components/SectionBlock";
import { PartHeader } from "@/components/PartHeader";
import { StatusPill } from "@/components/StatusPill";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useVessel } from "@/contexts/VesselContext";
import { useUIRole } from "@/contexts/UIRoleContext";

const ReadOnlyField: React.FC<{ label: string; value: string | undefined; labelMarker?: string; valueMarker?: string; type?: "text" | "textarea" }> = ({ label, value, labelMarker, valueMarker, type = "text" }) => (
  <div className="space-y-1">
    <Label className="text-sm text-[#8798ad]" data-testid={labelMarker}>
      {labelMarker && <Marker id={labelMarker} />}
      {label}
    </Label>
    <div className={`text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] ${type === "textarea" ? "whitespace-pre-wrap" : "flex items-center"}`} data-testid={valueMarker}>
      {valueMarker && <Marker id={valueMarker} />}
      {value || '-'}
    </div>
  </div>
);

interface EditableFieldProps {
  label: string;
  field: string;
  value: string | undefined;
  originalValue: string | undefined;
  onChange: (field: string, value: string) => void;
  isModifyMode: boolean;
  isEditMode?: boolean;
  type?: "text" | "select" | "textarea";
  options?: string[];
  labelMarker?: string;
  valueMarker?: string;
}

const EditableField: React.FC<EditableFieldProps> = ({ 
  label, 
  field,
  value, 
  originalValue,
  onChange, 
  isModifyMode,
  isEditMode = false,
  type = "text",
  options = [],
  labelMarker,
  valueMarker
}) => {
  const isChanged = value !== originalValue;
  const canEdit = isModifyMode || isEditMode;
  
  if (!canEdit) {
    return <ReadOnlyField label={label} value={value} labelMarker={labelMarker} valueMarker={valueMarker} type={type} />;
  }
  
  return (
    <div className="space-y-1">
      <Label className={`text-sm ${isChanged && isModifyMode ? 'text-red-600 font-semibold' : 'text-[#8798ad]'}`} data-testid={labelMarker}>
        {labelMarker && <Marker id={labelMarker} />}
        {label} {isChanged && isModifyMode && '(Modified)'}
      </Label>
      {type === "select" ? (
        <Select value={value || ''} onValueChange={(val) => onChange(field, val)}>
          <SelectTrigger className={`text-sm ${isChanged && isModifyMode ? 'border-red-500 bg-red-50' : ''}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : type === "textarea" ? (
        <Textarea
          value={value || ''}
          onChange={(e) => onChange(field, e.target.value)}
          className={`text-sm ${isChanged && isModifyMode ? 'border-red-500 bg-red-50 text-red-700' : ''}`}
          rows={3}
        />
      ) : (
        <Input
          value={value || ''}
          onChange={(e) => onChange(field, e.target.value)}
          className={`text-sm ${isChanged && isModifyMode ? 'border-red-500 bg-red-50 text-red-700' : ''}`}
        />
      )}
      {isChanged && isModifyMode && (
        <p className="text-xs text-gray-500">Original: {originalValue || '-'}</p>
      )}
    </div>
  );
};

const JobsFormPage: React.FC = () => {
  const [location, navigate] = useLocation();
  const [, params] = useRoute("/pms/job/:id");
  const jobId = params?.id;
  const { toast } = useToast();
  const { vesselId } = useVessel();
  const { isVessel, isHeadOfDept, isSailAdmin, isClientAdmin } = useUIRole();
  
  const [isWorkInstructionsOpen, setIsWorkInstructionsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const navSteps = [{ id: 'part-a', label: 'A', title: 'Job Details' }];
  const [activeStep, setActiveStep] = useState('part-a');

  const urlParams = new URLSearchParams(window.location.search);
  const isModifyMode = urlParams.get('modify') === '1';
  // activeComponentCode from URL allows the job to be viewed in context of a specific component
  // This is crucial for multi-linked jobs where the same job can be accessed from different components
  const activeComponentCode = urlParams.get('activeComponentCode') || '';

  const { data: jobContext, isLoading } = useQuery({
    queryKey: [`/technical/api/jobs/${jobId}/context`],
    enabled: !!jobId
  });

  const [, setLocation] = useLocation();

  const inactivateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/technical/api/jobs/${jobId}/inactivate`, { vesselId });
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Job Deactivated", description: data.message });
      queryClient.invalidateQueries({ predicate: (query) =>
        typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('/technical/api/jobs')
      });
      setShowDeleteConfirm(false);
      setLocation('/pms/components');
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to deactivate job", variant: "destructive" });
      setShowDeleteConfirm(false);
    }
  });
  
  const [originalData, setOriginalData] = useState<Record<string, any>>({});

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
    requiredSpareParts: [] as Array<{partNo: string, description: string, quantityRequired: string, remarks: string}>,
    requiredTools: [] as Array<{toolName: string, quantity: string, remarks: string}>,
    safetyRequirements: {
      ppeRequirements: [] as string[],
      permitRequirements: [] as string[],
      otherRequirements: [] as string[]
    },
    workHistory: [] as Array<{woNo: string, assignedTo: string, performedBy: string, workDate: string, runDate: string, completionDate: string, status: string, description: string, remarks: string}>
  });

  useEffect(() => {
    if (jobContext) {
      const context = jobContext as any;
      if (context.templateData) {
        const isRunningHours = context.templateData.maintenanceBasis === 'Running Hours';
        let normalizedFrequencyUnit = context.templateData.frequencyUnit;
        
        if (isRunningHours) {
          normalizedFrequencyUnit = 'Hours';
        } else if (!normalizedFrequencyUnit || normalizedFrequencyUnit === 'Hours') {
          normalizedFrequencyUnit = 'Months';
        }
        
        const frequencyValue = isRunningHours
          ? (context.templateData.intervalRunningHour || context.templateData.frequencyValue || '')
          : (context.templateData.frequencyValue || '');
        
        // IMPORTANT: Use activeComponentCode from URL if provided (for multi-linked jobs),
        // otherwise fall back to the job's stored componentCode
        // This ensures clicking a job from component X always binds to component X
        const effectiveComponentCode = activeComponentCode || context.templateData.componentCode || context.templateData.sfiCode || '';
        
        const newTemplateData = {
          ...context.templateData,
          woTitle: context.templateData.woTitle || context.templateData.jobTitle || '',
          woTemplateCode: context.templateData.jobNo || context.templateData.woTemplateCode || '',
          componentName: context.templateData.componentName || '',
          componentCode: effectiveComponentCode,
          frequencyValue: String(frequencyValue),
          frequencyUnit: normalizedFrequencyUnit,
          taskType: context.templateData.maintenanceType || context.templateData.taskType || 'Inspection',
          nextDueReading: context.templateData.nextDueRH || '',
          briefWorkDescription: context.templateData.briefWorkDescription || context.templateData.jobDescription || ''
        };
        
        setTemplateData(prev => ({
          ...prev,
          ...newTemplateData
        }));
        
        setOriginalData(newTemplateData);
      }
    }
  }, [jobContext, activeComponentCode]);

  const handleFieldChange = (field: string, value: string) => {
    setTemplateData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getChangedFields = (): string[] => {
    const changedFields: string[] = [];
    const fieldsToCheck = ['woTitle', 'assignedTo', 'approver', 'jobPriority', 'classRelated', 'briefWorkDescription', 'frequencyValue', 'frequencyUnit', 'taskType', 'isActive'];
    
    for (const field of fieldsToCheck) {
      if (templateData[field as keyof typeof templateData] !== originalData[field]) {
        changedFields.push(field);
      }
    }
    return changedFields;
  };

  const handleSaveForApproval = async () => {
    const changedFields = getChangedFields();
    
    if (changedFields.length === 0) {
      toast({
        title: "No changes detected",
        description: "Please make some changes before submitting for approval.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Build the proposed changes array
      const proposedChanges = changedFields.map(field => ({
        field,
        oldValue: originalData[field],
        newValue: templateData[field as keyof typeof templateData]
      }));
      
      // Create change request via backend API
      await apiRequest('POST', '/technical/api/change-requests', {
        vesselId: vesselId,
        category: 'jobs',
        title: `Job Change: ${templateData.woTemplateCode || templateData.woTitle || 'Unknown'}`,
        reason: `Modification request for job ${templateData.woTemplateCode}`,
        targetType: 'job',
        targetId: jobId,
        snapshotBeforeJson: originalData,
        proposedChangesJson: proposedChanges,
        status: 'submitted',
        requestedByUserId: 'Current User'
      });
      
      // Invalidate change requests cache so ModifyPMS shows the new request
      queryClient.invalidateQueries({ queryKey: ['/technical/api/change-requests'] });
      
      toast({
        title: "Change request submitted",
        description: "Your modification request has been submitted for approval."
      });
      
      navigate("/pms/modify-pms");
    } catch (error) {
      console.error('Error submitting change request:', error);
      toast({
        title: "Error",
        description: "Failed to submit change request. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleBack = () => {
    window.history.back();
  };

  const handleCancelModify = () => {
    navigate("/pms/modify-pms");
  };

  const handleEditClick = () => {
    setOriginalData({ ...templateData });
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setTemplateData(prev => ({
      ...prev,
      ...originalData
    }));
    setIsEditMode(false);
  };

  const handleSaveChanges = async () => {
    if (!jobId) return;
    
    setIsSaving(true);
    try {
      const updatePayload: Record<string, any> = {};
      
      if (templateData.woTitle !== originalData.woTitle) {
        updatePayload.jobTitle = templateData.woTitle;
      }
      if (templateData.assignedTo !== originalData.assignedTo) {
        updatePayload.assignedTo = templateData.assignedTo;
      }
      if (templateData.approver !== originalData.approver) {
        updatePayload.approver = templateData.approver;
      }
      if (templateData.jobPriority !== originalData.jobPriority) {
        updatePayload.jobPriority = templateData.jobPriority;
      }
      if (templateData.classRelated !== originalData.classRelated) {
        updatePayload.classRelated = templateData.classRelated;
      }
      if (templateData.isActive !== originalData.isActive) {
        updatePayload.isActive = templateData.isActive;
      }
      if (templateData.briefWorkDescription !== originalData.briefWorkDescription) {
        updatePayload.briefWorkDescription = templateData.briefWorkDescription;
      }
      if (templateData.frequencyValue !== originalData.frequencyValue) {
        updatePayload.frequencyValue = templateData.frequencyValue;
      }
      if (templateData.frequencyUnit !== originalData.frequencyUnit) {
        updatePayload.frequencyUnit = templateData.frequencyUnit;
      }
      if (templateData.taskType !== originalData.taskType) {
        updatePayload.maintenanceType = templateData.taskType;
      }
      
      if (Object.keys(updatePayload).length === 0) {
        toast({
          title: "No changes",
          description: "No changes were made to save.",
        });
        setIsEditMode(false);
        setIsSaving(false);
        return;
      }
      
      await apiRequest('PATCH', `/technical/api/jobs/${jobId}`, updatePayload);
      
      queryClient.invalidateQueries({ queryKey: [`/technical/api/jobs/${jobId}/context`] });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/jobs'] });
      
      toast({
        title: "Changes saved",
        description: "Job details have been updated successfully.",
      });
      
      setOriginalData({ ...templateData });
      setIsEditMode(false);
    } catch (error) {
      console.error('Error saving job changes:', error);
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatFrequency = () => {
    if (!templateData.frequencyValue) return '-';
    const unit = templateData.maintenanceBasis === 'Running Hours' ? 'Hours' : templateData.frequencyUnit;
    return `${templateData.frequencyValue} ${unit}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      let normalizedDate = dateStr;
      
      // Handle non-standard formats like "2025-11-28T1200" (missing colon in time)
      if (/^\d{4}-\d{2}-\d{2}T\d{4}$/.test(dateStr)) {
        normalizedDate = dateStr.replace(/T(\d{2})(\d{2})$/, 'T$1:$2:00');
      }
      
      // Handle DD-MMM-YYYY format (e.g., "28-Nov-2025")
      const ddMmmYyyyMatch = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
      if (ddMmmYyyyMatch) {
        const [, day, month, year] = ddMmmYyyyMatch;
        const monthMap: Record<string, string> = {
          'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
          'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        };
        const monthNum = monthMap[month];
        if (monthNum) {
          normalizedDate = `${year}-${monthNum}-${day.padStart(2, '0')}`;
        }
      }
      
      const date = new Date(normalizedDate);
      if (isNaN(date.getTime())) return dateStr;
      
      return date.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading job details...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modification Mode Banner */}
      {isModifyMode && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span className="text-amber-800 font-medium">
              Modification Mode: Changes will be submitted for approval. Modified fields appear in red.
            </span>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <div className={`bg-white border-b shadow-sm ${isModifyMode ? 'border-amber-300' : 'border-gray-200'}`}>
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
                data-testid="JF3"
              >
                <Marker id="JF3" />
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
              <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate" data-testid="JF1">
                <Marker id="JF1" />
                {isModifyMode ? 'Modify Job' : 'Jobs Form'}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {isModifyMode && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelModify}
                  className="text-gray-600 hover:text-gray-900"
                  data-testid="button-cancel-modify"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              )}
              {!isModifyMode && !isEditMode && (isSailAdmin || isClientAdmin) && templateData.isActive !== 'No' && templateData.isActive !== false && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 border-red-300 text-red-500 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setShowDeleteConfirm(true)}
                  data-testid="button-delete-job"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              {!isModifyMode && !isEditMode && !isVessel && !isHeadOfDept && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEditClick}
                  data-testid="button-edit-job"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
              )}
              {isEditMode && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    data-testid="button-cancel-edit"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                    data-testid="button-save-job"
                  >
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsWorkInstructionsOpen(true)}
                className="border-[hsl(var(--primary))] text-[hsl(var(--primary))] hover:bg-blue-50 font-medium px-4 h-9"
                data-testid="JF2"
              >
                <Marker id="JF2" />
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Work Instructions
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex">
        {/* Left Navigation Sidebar */}
        <aside className="hidden lg:block w-20 flex-shrink-0">
          <div className="sticky top-6 px-4 py-6">
            <nav className="space-y-6">
              {navSteps.map((step, index) => (
                <a
                  key={step.id}
                  href={`#${step.id}`}
                  onClick={() => setActiveStep(step.id)}
                  className="flex flex-col items-center gap-2 group"
                  data-testid={index === 0 ? "JF4" : `nav-step-${step.id}`}
                >
                  {index === 0 && <Marker id="JF4" />}
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
              description="Job template details and configuration"
              headerMarker="JF5"
              descriptionMarker="JF6"
            />
            
            {/* A1. Job Information */}
            <SectionBlock 
              id="job-info"
              number="A1"
              title="Job Information" 
              description="Basic details and configuration for this job"
              headerMarker="JF.A1.1"
              descriptionMarker="JF.A1.2"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <EditableField 
                    label="Job Title" 
                    field="woTitle"
                    value={templateData.woTitle} 
                    originalValue={originalData.woTitle}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    isEditMode={isEditMode}
                    labelMarker="JF.A1.3"
                    valueMarker="JF.A1.4"
                  />
                  <ReadOnlyField label="Component Name" value={templateData.componentName || templateData.component} labelMarker="JF.A1.5" valueMarker="JF.A1.6" />
                  <ReadOnlyField label="Component Code" value={templateData.componentCode} labelMarker="JF.A1.7" valueMarker="JF.A1.8" />
                  <ReadOnlyField label="Job Code" value={templateData.woTemplateCode} labelMarker="JF.A1.9" valueMarker="JF.A1.10" />
                  <ReadOnlyField label="Maintenance Basis" value={templateData.maintenanceBasis} labelMarker="JF.A1.11" valueMarker="JF.A1.12" />
                  <EditableField 
                    label="Frequency" 
                    field="frequencyValue"
                    value={templateData.frequencyValue} 
                    originalValue={originalData.frequencyValue}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    isEditMode={isEditMode}
                    labelMarker="JF.A1.13"
                    valueMarker="JF.A1.14"
                  />
                  <EditableField 
                    label="Task Type" 
                    field="taskType"
                    value={templateData.taskType} 
                    originalValue={originalData.taskType}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    isEditMode={isEditMode}
                    type="select"
                    options={['Inspection', 'Overhaul', 'Service', 'Test', 'Renew/Replace', 'Measurement/Calibration', 'Megger Test', 'Cleaning', 'Lubrication', 'Survey', 'Analysis', 'Checks']}
                    labelMarker="JF.A1.15"
                    valueMarker="JF.A1.16"
                  />
                  <EditableField 
                    label="Assigned To (Rank)" 
                    field="assignedTo"
                    value={templateData.assignedTo} 
                    originalValue={originalData.assignedTo}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    isEditMode={isEditMode}
                    type="select"
                    options={['Master', 'Chief Officer', '2nd Officer', '3rd Officer', 'Chief Engineer', '2nd Engineer', '3rd Engineer', '4th Engineer', 'Deck Cadet', 'Engine Cadet', 'Bosun', 'Pumpman', 'Electrician', 'Fitter', 'Able Seaman', 'Ordinary Seaman', 'Oiler', 'Wiper', 'Cook', 'Steward']}
                    labelMarker="JF.A1.17"
                    valueMarker="JF.A1.18"
                  />
                  <EditableField 
                    label="Approver (Rank)" 
                    field="approver"
                    value={templateData.approver} 
                    originalValue={originalData.approver}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    isEditMode={isEditMode}
                    type="select"
                    options={['Master', 'Chief Officer', '2nd Officer', '3rd Officer', 'Chief Engineer', '2nd Engineer', '3rd Engineer', '4th Engineer', 'Deck Cadet', 'Engine Cadet', 'Bosun', 'Pumpman', 'Electrician', 'Fitter', 'Able Seaman', 'Ordinary Seaman', 'Oiler', 'Wiper', 'Cook', 'Steward']}
                    labelMarker="JF.A1.19"
                    valueMarker="JF.A1.20"
                  />
                  <EditableField 
                    label="Job Priority" 
                    field="jobPriority"
                    value={templateData.jobPriority} 
                    originalValue={originalData.jobPriority}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    isEditMode={isEditMode}
                    type="select"
                    options={['Low', 'Medium', 'High', 'Critical']}
                    labelMarker="JF.A1.21"
                    valueMarker="JF.A1.22"
                  />
                  <EditableField 
                    label="Class Related" 
                    field="classRelated"
                    value={templateData.classRelated} 
                    originalValue={originalData.classRelated}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    isEditMode={isEditMode}
                    type="select"
                    options={['Yes', 'No']}
                    labelMarker="JF.A1.23"
                    valueMarker="JF.A1.24"
                  />
                  {templateData.maintenanceBasis === 'Running Hours' ? (
                    <ReadOnlyField 
                      label="Next Due RH" 
                      value={templateData.nextDueReading ? `${templateData.nextDueReading} Hours` : '-'} 
                      labelMarker="JF.A1.25"
                      valueMarker="JF.A1.26"
                    />
                  ) : (
                    <ReadOnlyField label="Next Due Date" value={formatDate(templateData.nextDueDate)} labelMarker="JF.A1.25" valueMarker="JF.A1.26" />
                  )}
                  <ReadOnlyField label="Department" value={templateData.department} labelMarker="JF.A1.27" valueMarker="JF.A1.28" />
                  <ReadOnlyField label="Criticality" value={templateData.criticality} labelMarker="JF.A1.29" valueMarker="JF.A1.30" />
                  <EditableField 
                    label="Is Active" 
                    field="isActive"
                    value={templateData.isActive} 
                    originalValue={originalData.isActive}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    isEditMode={isEditMode}
                    type="select"
                    options={['Yes', 'No']}
                    labelMarker="JF.A1.31"
                    valueMarker="JF.A1.32"
                  />
                </div>

                <EditableField 
                  label="Brief Work Description" 
                  field="briefWorkDescription"
                  value={templateData.briefWorkDescription} 
                  originalValue={originalData.briefWorkDescription}
                  onChange={handleFieldChange}
                  isModifyMode={isModifyMode}
                  isEditMode={isEditMode}
                  type="textarea"
                  labelMarker="JF.A1.33"
                  valueMarker="JF.A1.34"
                />
              </div>
            </SectionBlock>

            {/* A2. Required Spare Parts */}
            <SectionBlock
              id="spare-parts"
              number="A2"
              title="Required Spare Parts"
              description="Spare parts needed for this job"
              headerMarker="JF.A2.1"
              descriptionMarker="JF.A2.2"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-2 font-medium text-gray-700 w-[20%]" data-testid="JF.A2.3"><Marker id="JF.A2.3" />PART NO.</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[40%]" data-testid="JF.A2.4"><Marker id="JF.A2.4" />DESCRIPTION</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[15%]" data-testid="JF.A2.5"><Marker id="JF.A2.5" />QTY REQUIRED</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[10%]" data-testid="JF.A2.6"><Marker id="JF.A2.6" />ROB</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[15%]" data-testid="JF.A2.7"><Marker id="JF.A2.7" />STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(templateData.requiredSpareParts || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center p-4 text-gray-500 italic">
                          No spare parts added yet
                        </td>
                      </tr>
                    ) : (
                      (templateData.requiredSpareParts || []).map((part: any, index) => {
                        const robValue = part.rob !== null && part.rob !== undefined ? part.rob : null;
                        const qtyRequired = parseInt(part.quantityRequired) || 0;
                        const isAvailable = robValue !== null && robValue >= qtyRequired;
                        const isLowStock = robValue !== null && robValue > 0 && robValue < qtyRequired;
                        const isOutOfStock = robValue === 0;
                        const stockStatus = robValue === null ? 'unknown' : isAvailable ? 'available' : isLowStock ? 'low' : 'unavailable';
                        
                        return (
                          <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="p-2" data-testid={index === 0 ? "JF.A2.8" : `text-spare-part-no-${index}`}>{index === 0 && <Marker id="JF.A2.8" />}{part.partNo || '-'}</td>
                            <td className="p-2" data-testid={index === 0 ? "JF.A2.9" : `text-spare-description-${index}`}>{index === 0 && <Marker id="JF.A2.9" />}{part.description || '-'}</td>
                            <td className="p-2" data-testid={index === 0 ? "JF.A2.10" : `text-spare-quantity-${index}`}>{index === 0 && <Marker id="JF.A2.10" />}{part.quantityRequired || '-'}</td>
                            <td className="p-2 text-center" data-testid={index === 0 ? "JF.A2.11" : `text-spare-rob-${index}`}>{index === 0 && <Marker id="JF.A2.11" />}{robValue !== null ? robValue : '-'}</td>
                            <td className="p-2" data-testid={index === 0 ? "JF.A2.12" : `status-spare-${index}`}>
                              {index === 0 && <Marker id="JF.A2.12" />}
                              <StatusPill status={stockStatus} />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </SectionBlock>

            {/* A3. Safety Requirements */}
            <SectionBlock
              id="safety"
              number="A3"
              title="Safety Requirements"
              description="Safety requirements and permits for this job"
              headerMarker="JF.A4.1"
              descriptionMarker="JF.A4.2"
            >
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700" data-testid="JF.A4.3"><Marker id="JF.A4.3" />Personal Protective Equipment (PPE):</Label>
                  {(templateData.safetyRequirements?.ppeRequirements || []).length > 0 ? (
                    <ul className="list-disc list-inside mt-1 text-sm text-gray-600" data-testid="JF.A4.4">
                      <Marker id="JF.A4.4" />
                      {templateData.safetyRequirements.ppeRequirements.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 italic mt-1" data-testid="JF.A4.4"><Marker id="JF.A4.4" />No PPE requirements specified</p>
                  )}
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-700" data-testid="JF.A4.5"><Marker id="JF.A4.5" />Permits Required:</Label>
                  {(templateData.safetyRequirements?.permitRequirements || []).length > 0 ? (
                    <ul className="list-disc list-inside mt-1 text-sm text-gray-600" data-testid="JF.A4.6">
                      <Marker id="JF.A4.6" />
                      {templateData.safetyRequirements.permitRequirements.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 italic mt-1" data-testid="JF.A4.6"><Marker id="JF.A4.6" />No permits required</p>
                  )}
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-700" data-testid="JF.A4.7"><Marker id="JF.A4.7" />Other Safety Requirements:</Label>
                  {(templateData.safetyRequirements?.otherRequirements || []).length > 0 ? (
                    <ul className="list-disc list-inside mt-1 text-sm text-gray-600" data-testid="JF.A4.8">
                      <Marker id="JF.A4.8" />
                      {templateData.safetyRequirements.otherRequirements.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 italic mt-1" data-testid="JF.A4.8"><Marker id="JF.A4.8" />No other safety requirements specified</p>
                  )}
                </div>
              </div>
            </SectionBlock>

            {/* A4. Work History */}
            <SectionBlock
              id="work-history"
              number="A4"
              title="Work History"
              description="Previous executions and completion history for this job"
              headerMarker="JF.A5.1"
              descriptionMarker="JF.A5.2"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-2 font-medium text-gray-700" data-testid="JF.A5.3"><Marker id="JF.A5.3" />DATE</th>
                      <th className="text-left p-2 font-medium text-gray-700" data-testid="JF.A5.4"><Marker id="JF.A5.4" />WORK ORDER</th>
                      <th className="text-left p-2 font-medium text-gray-700" data-testid="JF.A5.5"><Marker id="JF.A5.5" />DESCRIPTION</th>
                      <th className="text-left p-2 font-medium text-gray-700" data-testid="JF.A5.6"><Marker id="JF.A5.6" />PERFORMED BY</th>
                      <th className="text-left p-2 font-medium text-gray-700" data-testid="JF.A5.7"><Marker id="JF.A5.7" />STATUS</th>
                      <th className="text-left p-2 font-medium text-gray-700" data-testid="JF.A5.8"><Marker id="JF.A5.8" />REMARKS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(templateData.workHistory || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center p-4 text-gray-500 italic">
                          No data available
                        </td>
                      </tr>
                    ) : (
                      (templateData.workHistory || []).map((record, index) => (
                        <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="p-2" data-testid={index === 0 ? "JF.A5.9" : `text-history-date-${index}`}>{index === 0 && <Marker id="JF.A5.9" />}{formatDate(record.completionDate || record.workDate)}</td>
                          <td className="p-2" data-testid={index === 0 ? "JF.A5.10" : `text-history-wo-${index}`}>{index === 0 && <Marker id="JF.A5.10" />}{record.woNo || '-'}</td>
                          <td className="p-2 max-w-[200px] truncate" data-testid={index === 0 ? "JF.A5.11" : `text-history-description-${index}`} title={record.description || '-'}>{index === 0 && <Marker id="JF.A5.11" />}{record.description || '-'}</td>
                          <td className="p-2" data-testid={index === 0 ? "JF.A5.12" : `text-history-performed-by-${index}`}>{index === 0 && <Marker id="JF.A5.12" />}{record.performedBy || '-'}</td>
                          <td className="p-2" data-testid={index === 0 ? "JF.A5.13" : `text-history-status-${index}`}>
                            {index === 0 && <Marker id="JF.A5.13" />}
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              {record.status || 'Completed'}
                            </span>
                          </td>
                          <td className="p-2" data-testid={index === 0 ? "JF.A5.14" : `text-history-remarks-${index}`}>{index === 0 && <Marker id="JF.A5.14" />}{record.remarks || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </SectionBlock>

            {/* Save for Approval Button (only in modify mode) */}
            {isModifyMode && (
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Submit Changes for Approval</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Review your changes above, then submit for approval. Modified fields are highlighted in red.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      onClick={handleCancelModify}
                      data-testid="button-cancel-changes"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveForApproval}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                      data-testid="button-save-for-approval"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save for Approval
                    </Button>
                  </div>
                </div>
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

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Job</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate this job? The job will be soft-deleted and no new work orders will be generated for it. Existing work orders will continue to completion.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={inactivateMutation.isPending} data-testid="button-cancel-delete-job">
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => inactivateMutation.mutate()} disabled={inactivateMutation.isPending} data-testid="button-confirm-delete-job">
              {inactivateMutation.isPending ? 'Deactivating...' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default JobsFormPage;
