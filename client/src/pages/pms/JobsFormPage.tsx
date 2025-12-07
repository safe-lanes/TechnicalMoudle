import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, ArrowLeft, Menu, AlertTriangle, Save, X } from "lucide-react";
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
import { changeRequestService } from "@/services/changeRequestService";
import { useToast } from "@/hooks/use-toast";

const ReadOnlyField: React.FC<{ label: string; value: string | undefined }> = ({ label, value }) => (
  <div className="space-y-1">
    <Label className="text-sm text-[#8798ad]">{label}</Label>
    <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center">
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
  type?: "text" | "select" | "textarea";
  options?: string[];
}

const EditableField: React.FC<EditableFieldProps> = ({ 
  label, 
  field,
  value, 
  originalValue,
  onChange, 
  isModifyMode,
  type = "text",
  options = []
}) => {
  const isChanged = value !== originalValue;
  
  if (!isModifyMode) {
    return <ReadOnlyField label={label} value={value} />;
  }
  
  return (
    <div className="space-y-1">
      <Label className={`text-sm ${isChanged ? 'text-red-600 font-semibold' : 'text-[#8798ad]'}`}>
        {label} {isChanged && '(Modified)'}
      </Label>
      {type === "select" ? (
        <Select value={value || ''} onValueChange={(val) => onChange(field, val)}>
          <SelectTrigger className={`text-sm ${isChanged ? 'border-red-500 bg-red-50' : ''}`}>
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
          className={`text-sm ${isChanged ? 'border-red-500 bg-red-50 text-red-700' : ''}`}
          rows={3}
        />
      ) : (
        <Input
          value={value || ''}
          onChange={(e) => onChange(field, e.target.value)}
          className={`text-sm ${isChanged ? 'border-red-500 bg-red-50 text-red-700' : ''}`}
        />
      )}
      {isChanged && (
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
  
  const [isWorkInstructionsOpen, setIsWorkInstructionsOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  
  const navSteps = [{ id: 'part-a', label: 'A', title: 'Job Details' }];
  const [activeStep, setActiveStep] = useState('part-a');

  const urlParams = new URLSearchParams(window.location.search);
  const isModifyMode = urlParams.get('modify') === '1';

  const { data: jobContext, isLoading } = useQuery({
    queryKey: [`/api/jobs/${jobId}/context`],
    enabled: !!jobId
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
        
        const newTemplateData = {
          ...context.templateData,
          woTitle: context.templateData.woTitle || context.templateData.jobTitle || '',
          woTemplateCode: context.templateData.jobNo || context.templateData.woTemplateCode || '',
          componentName: context.templateData.componentName || '',
          componentCode: context.templateData.componentCode || context.templateData.sfiCode || '',
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
        
        if (isModifyMode) {
          setOriginalData(newTemplateData);
        }
      }
    }
  }, [jobContext, isModifyMode]);

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

  const handleSaveForApproval = () => {
    const changedFields = getChangedFields();
    
    if (changedFields.length === 0) {
      toast({
        title: "No changes detected",
        description: "Please make some changes before submitting for approval.",
        variant: "destructive"
      });
      return;
    }
    
    changeRequestService.createChangeRequest({
      category: "jobs",
      requestTitle: `Job Change: ${templateData.woTemplateCode || templateData.woTitle || 'Unknown'}`,
      requestedBy: "Current User",
      requestDate: new Date().toISOString().split('T')[0],
      status: "Pending Approval",
      originalData: originalData,
      newData: { ...templateData, jobId },
      changedFields: changedFields,
      comments: `Modification request for job ${templateData.woTemplateCode}`
    });
    
    toast({
      title: "Change request submitted",
      description: "Your modification request has been submitted for approval."
    });
    
    navigate("/pms/modify-pms");
  };

  const handleBack = () => {
    if (isModifyMode) {
      navigate("/pms/modify-pms/jobs");
    } else {
      navigate("/pms/components");
    }
  };

  const handleCancelModify = () => {
    navigate("/pms/modify-pms");
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
              <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate">
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

      {/* Main Content */}
      <div className="flex">
        {/* Left Navigation Sidebar */}
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
              description="Job template details and configuration"
            />
            
            {/* A1. Job Information */}
            <SectionBlock 
              id="job-info"
              number="A1"
              title="Job Information" 
              description="Basic details and configuration for this job"
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
                  />
                  <ReadOnlyField label="Component Name" value={templateData.componentName || templateData.component} />
                  <ReadOnlyField label="Component Code" value={templateData.componentCode} />
                  <ReadOnlyField label="Job Code" value={templateData.woTemplateCode} />
                  <ReadOnlyField label="Maintenance Basis" value={templateData.maintenanceBasis} />
                  <EditableField 
                    label="Frequency" 
                    field="frequencyValue"
                    value={templateData.frequencyValue} 
                    originalValue={originalData.frequencyValue}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                  />
                  <EditableField 
                    label="Task Type" 
                    field="taskType"
                    value={templateData.taskType} 
                    originalValue={originalData.taskType}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    type="select"
                    options={['Inspection', 'Overhaul', 'Service', 'Repair', 'Test', 'Calibration', 'Survey', 'Other']}
                  />
                  <EditableField 
                    label="Assigned To (Rank)" 
                    field="assignedTo"
                    value={templateData.assignedTo} 
                    originalValue={originalData.assignedTo}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    type="select"
                    options={['Chief Engineer', '2nd Engineer', '3rd Engineer', '4th Engineer', 'Electrician', 'Fitter', 'Bosun', 'Chief Officer', '2nd Officer']}
                  />
                  <EditableField 
                    label="Approver (Rank)" 
                    field="approver"
                    value={templateData.approver} 
                    originalValue={originalData.approver}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    type="select"
                    options={['Chief Engineer', 'Master', 'Technical Superintendent', '2nd Engineer']}
                  />
                  <EditableField 
                    label="Job Priority" 
                    field="jobPriority"
                    value={templateData.jobPriority} 
                    originalValue={originalData.jobPriority}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    type="select"
                    options={['High', 'Medium', 'Low']}
                  />
                  <EditableField 
                    label="Class Related" 
                    field="classRelated"
                    value={templateData.classRelated} 
                    originalValue={originalData.classRelated}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    type="select"
                    options={['Yes', 'No']}
                  />
                  {templateData.maintenanceBasis === 'Running Hours' ? (
                    <ReadOnlyField 
                      label="Next Due RH" 
                      value={templateData.nextDueReading ? `${templateData.nextDueReading} Hours` : '-'} 
                    />
                  ) : (
                    <ReadOnlyField label="Next Due Date" value={formatDate(templateData.nextDueDate)} />
                  )}
                  <ReadOnlyField label="Department" value={templateData.department} />
                  <ReadOnlyField label="Criticality" value={templateData.criticality} />
                  <EditableField 
                    label="Is Active" 
                    field="isActive"
                    value={templateData.isActive} 
                    originalValue={originalData.isActive}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    type="select"
                    options={['Yes', 'No']}
                  />
                </div>

                <EditableField 
                  label="Brief Work Description" 
                  field="briefWorkDescription"
                  value={templateData.briefWorkDescription} 
                  originalValue={originalData.briefWorkDescription}
                  onChange={handleFieldChange}
                  isModifyMode={isModifyMode}
                  type="textarea"
                />
              </div>
            </SectionBlock>

            {/* A2. Required Spare Parts */}
            <SectionBlock
              id="spare-parts"
              number="A2"
              title="Required Spare Parts"
              description="Spare parts needed for this job"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-2 font-medium text-gray-700 w-[20%]">PART NO.</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[40%]">DESCRIPTION</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[15%]">QTY REQUIRED</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[10%]">ROB</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[15%]">STATUS</th>
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
                      (templateData.requiredSpareParts || []).map((part, index) => (
                        <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="p-2" data-testid={`text-spare-part-no-${index}`}>{part.partNo || '-'}</td>
                          <td className="p-2" data-testid={`text-spare-description-${index}`}>{part.description || '-'}</td>
                          <td className="p-2" data-testid={`text-spare-quantity-${index}`}>{part.quantityRequired || '-'}</td>
                          <td className="p-2 text-center" data-testid={`text-spare-rob-${index}`}>-</td>
                          <td className="p-2">
                            <span data-testid={`status-spare-${index}`}>
                              <StatusPill status="available" />
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </SectionBlock>

            {/* A3. Required Tools & Equipment */}
            <SectionBlock
              id="tools"
              number="A3"
              title="Required Tools & Equipment"
              description="Tools and equipment needed for this job"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-2 font-medium text-gray-700 w-[50%]">DESCRIPTION</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[15%]">QTY REQUIRED</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[10%]">ROB</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[15%]">STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(templateData.requiredTools || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center p-4 text-gray-500 italic">
                          No tools added yet
                        </td>
                      </tr>
                    ) : (
                      (templateData.requiredTools || []).map((tool, index) => (
                        <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="p-2" data-testid={`text-tool-name-${index}`}>{tool.toolName || '-'}</td>
                          <td className="p-2" data-testid={`text-tool-quantity-${index}`}>{tool.quantity || '-'}</td>
                          <td className="p-2 text-center" data-testid={`text-tool-rob-${index}`}>-</td>
                          <td className="p-2">
                            <span data-testid={`status-tool-${index}`}>
                              <StatusPill status="available" />
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </SectionBlock>

            {/* A4. Safety Requirements */}
            <SectionBlock
              id="safety"
              number="A4"
              title="Safety Requirements"
              description="Safety requirements and permits for this job"
            >
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Personal Protective Equipment (PPE):</Label>
                  {(templateData.safetyRequirements?.ppeRequirements || []).length > 0 ? (
                    <ul className="list-disc list-inside mt-1 text-sm text-gray-600">
                      {templateData.safetyRequirements.ppeRequirements.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 italic mt-1">No PPE requirements specified</p>
                  )}
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-700">Permits Required:</Label>
                  {(templateData.safetyRequirements?.permitRequirements || []).length > 0 ? (
                    <ul className="list-disc list-inside mt-1 text-sm text-gray-600">
                      {templateData.safetyRequirements.permitRequirements.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 italic mt-1">No permits required</p>
                  )}
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-700">Other Safety Requirements:</Label>
                  {(templateData.safetyRequirements?.otherRequirements || []).length > 0 ? (
                    <ul className="list-disc list-inside mt-1 text-sm text-gray-600">
                      {templateData.safetyRequirements.otherRequirements.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 italic mt-1">No other safety requirements specified</p>
                  )}
                </div>
              </div>
            </SectionBlock>

            {/* A5. Work History */}
            <SectionBlock
              id="work-history"
              number="A5"
              title="Work History"
              description="Previous executions and completion history for this job"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-2 font-medium text-gray-700">DATE</th>
                      <th className="text-left p-2 font-medium text-gray-700">WORK ORDER</th>
                      <th className="text-left p-2 font-medium text-gray-700">DESCRIPTION</th>
                      <th className="text-left p-2 font-medium text-gray-700">PERFORMED BY</th>
                      <th className="text-left p-2 font-medium text-gray-700">STATUS</th>
                      <th className="text-left p-2 font-medium text-gray-700">REMARKS</th>
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
                          <td className="p-2" data-testid={`text-history-date-${index}`}>{formatDate(record.completionDate || record.workDate)}</td>
                          <td className="p-2" data-testid={`text-history-wo-${index}`}>{record.woNo || '-'}</td>
                          <td className="p-2 max-w-[200px] truncate" data-testid={`text-history-description-${index}`} title={record.description || '-'}>{record.description || '-'}</td>
                          <td className="p-2" data-testid={`text-history-performed-by-${index}`}>{record.performedBy || '-'}</td>
                          <td className="p-2" data-testid={`text-history-status-${index}`}>
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              {record.status || 'Completed'}
                            </span>
                          </td>
                          <td className="p-2" data-testid={`text-history-remarks-${index}`}>{record.remarks || '-'}</td>
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
    </div>
  );
};

export default JobsFormPage;
