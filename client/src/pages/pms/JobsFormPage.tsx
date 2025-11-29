import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileText, ArrowLeft, Menu } from "lucide-react";
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

const ReadOnlyField: React.FC<{ label: string; value: string | undefined }> = ({ label, value }) => (
  <div className="space-y-1">
    <Label className="text-sm text-[#8798ad]">{label}</Label>
    <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center">
      {value || '-'}
    </div>
  </div>
);

const JobsFormPage: React.FC = () => {
  const [location, navigate] = useLocation();
  const [, params] = useRoute("/pms/job/:id");
  const jobId = params?.id;
  
  const [isWorkInstructionsOpen, setIsWorkInstructionsOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  
  const navSteps = [{ id: 'part-a', label: 'A', title: 'Job Details' }];
  const [activeStep, setActiveStep] = useState('part-a');

  const { data: jobContext, isLoading } = useQuery({
    queryKey: [`/api/jobs/${jobId}/context`],
    enabled: !!jobId
  });

  const [templateData, setTemplateData] = useState({
    woTitle: "",
    component: "",
    componentName: "",
    componentCode: "",
    woTemplateCode: "",
    fleetEquipmentCode: "",
    fleetEquipmentName: "",
    maintenanceBasis: "Calendar",
    intervalValue: "",
    intervalRunningHour: "",
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
    vesselCode: "",
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
        let normalizedFrequencyUnit = context.templateData.frequencyUnit;
        if (context.templateData.maintenanceBasis === 'Running Hours') {
          normalizedFrequencyUnit = 'Hours';
        } else if (!normalizedFrequencyUnit || normalizedFrequencyUnit === 'Hours') {
          normalizedFrequencyUnit = 'Months';
        }
        
        setTemplateData(prev => ({
          ...prev,
          ...context.templateData,
          frequencyUnit: normalizedFrequencyUnit
        }));
      }
    }
  }, [jobContext]);

  const handleBack = () => {
    navigate("/pms/components");
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
      {/* Top Header Bar */}
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
              <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate">Jobs Form</h1>
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
                  <ReadOnlyField label="Job Code" value={templateData.woTemplateCode} />
                  <ReadOnlyField label="Fleet Equipment Code" value={templateData.fleetEquipmentCode} />
                  <ReadOnlyField label="Fleet Equipment Name" value={templateData.fleetEquipmentName} />
                  <ReadOnlyField label="Job Title" value={templateData.woTitle} />
                  <ReadOnlyField label="Component Code" value={templateData.componentCode} />
                  <ReadOnlyField label="Component Name" value={templateData.componentName || templateData.component} />
                  <ReadOnlyField label="Maintenance Basis" value={templateData.maintenanceBasis} />
                  <ReadOnlyField label="Interval Value" value={templateData.intervalValue || templateData.frequencyValue} />
                  <ReadOnlyField label="Interval Running Hour" value={templateData.intervalRunningHour} />
                  <ReadOnlyField label="Unit" value={templateData.frequencyUnit} />
                  <ReadOnlyField label="Task Type" value={templateData.taskType} />
                  <ReadOnlyField label="Assigned To" value={templateData.assignedTo} />
                  <ReadOnlyField label="Approver" value={templateData.approver} />
                  <ReadOnlyField label="Job Priority" value={templateData.jobPriority} />
                  <ReadOnlyField label="Class Related" value={templateData.classRelated} />
                  <ReadOnlyField label="Next Due Date" value={formatDate(templateData.nextDueDate)} />
                  <ReadOnlyField label="Department" value={templateData.department} />
                  <ReadOnlyField label="Criticality" value={templateData.criticality} />
                  <ReadOnlyField label="Is Active" value={templateData.isActive} />
                  <ReadOnlyField label="Vessel Code" value={templateData.vesselCode} />
                </div>

                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">Brief Work Description</Label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[80px] whitespace-pre-wrap">
                    {templateData.briefWorkDescription || '-'}
                  </div>
                </div>
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
