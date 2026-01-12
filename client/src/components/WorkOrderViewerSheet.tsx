import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Wrench,
  Calendar,
  User,
  Clock,
  Package,
  Settings,
  CheckCircle,
  AlertTriangle,
  ClipboardList,
  Shield,
  Info,
} from "lucide-react";

interface WorkOrderViewerSheetProps {
  workOrderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ReadOnlyFieldProps {
  label: string;
  value: string | number | null | undefined;
  className?: string;
}

const ReadOnlyField: React.FC<ReadOnlyFieldProps> = ({ label, value, className = "" }) => (
  <div className={className}>
    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
    <p className="text-sm font-medium text-gray-900 mt-1">{value || "-"}</p>
  </div>
);

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string }> = ({ 
  icon, 
  title, 
  subtitle 
}) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="p-2 bg-blue-100 rounded-lg text-blue-600">{icon}</div>
    <div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </div>
  </div>
);

export const WorkOrderViewerSheet: React.FC<WorkOrderViewerSheetProps> = ({
  workOrderId,
  open,
  onOpenChange,
}) => {
  // Use array query key with workOrderId as separate segment to ensure proper cache invalidation
  // when different work orders are selected
  const { data: woContext, isLoading, isError } = useQuery({
    queryKey: ['/technical/api/work-orders', workOrderId, 'context'],
    queryFn: async () => {
      if (!workOrderId) return null;
      const response = await fetch(`/technical/api/work-orders/${workOrderId}/context`);
      if (!response.ok) throw new Error('Failed to fetch work order');
      return response.json();
    },
    enabled: !!workOrderId && open,
  });

  const context = woContext as any;
  const templateData = context?.templateData;
  const executionData = context?.executionData;
  const workOrder = context?.workOrder;

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "approved":
        return "bg-green-100 text-green-800 border-green-200";
      case "in progress":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "pending approval":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        className="w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl p-0 overflow-hidden"
        data-testid="work-order-viewer-sheet"
      >
        <ScrollArea className="h-full">
          <div className="p-6">
            {/* Header */}
            <SheetHeader className="mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <SheetTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Completed Work Order
                  </SheetTitle>
                  {workOrder?.workOrderNo && (
                    <p className="text-lg font-semibold text-blue-600 mt-1">
                      {workOrder.workOrderNo}
                    </p>
                  )}
                </div>
                {workOrder?.status && (
                  <Badge className={`${getStatusBadgeColor(workOrder.status)} border`}>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {workOrder.status}
                  </Badge>
                )}
              </div>
            </SheetHeader>

            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-sm text-gray-500">Loading work order details...</p>
                </div>
              </div>
            )}

            {isError && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center text-red-600">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Failed to load work order details</p>
                </div>
              </div>
            )}

            {!isLoading && !isError && templateData && (
              <div className="space-y-6">
                {/* PART A - Job Details */}
                <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-lg p-4 border border-blue-200">
                  <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2 mb-4">
                    <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      A
                    </span>
                    Job Details (Frozen Template)
                  </h2>
                  
                  {/* Basic Information */}
                  <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
                    <SectionHeader 
                      icon={<Info className="h-4 w-4" />} 
                      title="Basic Information" 
                    />
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <ReadOnlyField 
                        label="Job Title" 
                        value={templateData.woTitle || templateData.jobTitle} 
                        className="col-span-2 md:col-span-3"
                      />
                      <ReadOnlyField label="Job No" value={templateData.woTemplateCode || templateData.jobNo} />
                      <ReadOnlyField label="Task Type" value={templateData.taskType || templateData.maintenanceType} />
                      <ReadOnlyField label="Priority" value={templateData.jobPriority} />
                    </div>
                  </div>

                  {/* Component Information */}
                  <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
                    <SectionHeader 
                      icon={<Settings className="h-4 w-4" />} 
                      title="Component" 
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <ReadOnlyField label="Component Code" value={templateData.componentCode} />
                      <ReadOnlyField label="Component Name" value={templateData.componentName} />
                    </div>
                  </div>

                  {/* Scheduling */}
                  <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
                    <SectionHeader 
                      icon={<Calendar className="h-4 w-4" />} 
                      title="Scheduling" 
                    />
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <ReadOnlyField label="Maintenance Basis" value={templateData.maintenanceBasis} />
                      <ReadOnlyField 
                        label="Frequency" 
                        value={templateData.frequencyValue ? `${templateData.frequencyValue} ${templateData.frequencyUnit}` : '-'} 
                      />
                      <ReadOnlyField label="Class Related" value={templateData.classRelated} />
                    </div>
                  </div>

                  {/* Assignment */}
                  <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
                    <SectionHeader 
                      icon={<User className="h-4 w-4" />} 
                      title="Assignment" 
                    />
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <ReadOnlyField label="Assigned To" value={templateData.assignedTo} />
                      <ReadOnlyField label="Approver" value={templateData.approver} />
                      <ReadOnlyField label="Department" value={templateData.department} />
                    </div>
                  </div>

                  {/* Work Description */}
                  {templateData.briefWorkDescription && (
                    <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
                      <SectionHeader 
                        icon={<ClipboardList className="h-4 w-4" />} 
                        title="Work Description" 
                      />
                      <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded border">
                        {templateData.briefWorkDescription}
                      </p>
                    </div>
                  )}

                  {/* Required Spare Parts */}
                  {templateData.requiredSpareParts && templateData.requiredSpareParts.length > 0 && (
                    <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
                      <SectionHeader 
                        icon={<Package className="h-4 w-4" />} 
                        title="Required Spare Parts" 
                      />
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-b">
                              <th className="text-left py-2 px-3 font-medium text-gray-600">Part No</th>
                              <th className="text-left py-2 px-3 font-medium text-gray-600">Description</th>
                              <th className="text-right py-2 px-3 font-medium text-gray-600">Qty Required</th>
                              <th className="text-left py-2 px-3 font-medium text-gray-600">Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {templateData.requiredSpareParts.map((part: any, idx: number) => (
                              <tr key={idx} className="border-b border-gray-100">
                                <td className="py-2 px-3 text-gray-900">{part.partNo}</td>
                                <td className="py-2 px-3 text-gray-900">{part.description}</td>
                                <td className="py-2 px-3 text-gray-900 text-right">{part.quantityRequired}</td>
                                <td className="py-2 px-3 text-gray-500">{part.remarks || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Safety Requirements */}
                  {templateData.safetyRequirements && (
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <SectionHeader 
                        icon={<Shield className="h-4 w-4" />} 
                        title="Safety Requirements" 
                      />
                      <div className="space-y-3">
                        {templateData.safetyRequirements.ppeRequirements?.length > 0 && (
                          <div>
                            <label className="text-xs font-medium text-gray-500">PPE Requirements</label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {templateData.safetyRequirements.ppeRequirements.map((ppe: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-xs">{ppe}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {templateData.safetyRequirements.permitRequirements?.length > 0 && (
                          <div>
                            <label className="text-xs font-medium text-gray-500">Permit Requirements</label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {templateData.safetyRequirements.permitRequirements.map((permit: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-xs">{permit}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <Separator className="my-6" />

                {/* PART B - Work Completion Record */}
                <div className="bg-gradient-to-r from-green-50 to-green-100/50 rounded-lg p-4 border border-green-200">
                  <h2 className="text-lg font-bold text-green-900 flex items-center gap-2 mb-4">
                    <span className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      B
                    </span>
                    Work Completion Record
                  </h2>

                  {/* Execution Details */}
                  <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
                    <SectionHeader 
                      icon={<Clock className="h-4 w-4" />} 
                      title="Execution Details" 
                    />
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <ReadOnlyField label="Date of Completion" value={executionData?.dateOfCompletion} />
                      <ReadOnlyField label="Running Hours" value={executionData?.runningHours} />
                      <ReadOnlyField label="Performed By" value={executionData?.performedBy} />
                      <ReadOnlyField label="No. of Persons" value={executionData?.noOfPersons} />
                      <ReadOnlyField label="Total Time (Hours)" value={executionData?.totalTimeHours} />
                      <ReadOnlyField label="Man-hours" value={executionData?.manhours} />
                    </div>
                  </div>

                  {/* Work Carried Out */}
                  {executionData?.workCarriedOut && (
                    <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
                      <SectionHeader 
                        icon={<Wrench className="h-4 w-4" />} 
                        title="Work Carried Out" 
                      />
                      <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded border">
                        {executionData.workCarriedOut}
                      </p>
                    </div>
                  )}

                  {/* Job Experience Notes */}
                  {executionData?.jobExperienceNotes && (
                    <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
                      <SectionHeader 
                        icon={<ClipboardList className="h-4 w-4" />} 
                        title="Job Experience Notes" 
                      />
                      <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded border">
                        {executionData.jobExperienceNotes}
                      </p>
                    </div>
                  )}

                  {/* Consumed Spare Parts */}
                  {executionData?.consumedSpareParts && executionData.consumedSpareParts.length > 0 && (
                    <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
                      <SectionHeader 
                        icon={<Package className="h-4 w-4" />} 
                        title="Spares Consumed" 
                      />
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-b">
                              <th className="text-left py-2 px-3 font-medium text-gray-600">Part No</th>
                              <th className="text-left py-2 px-3 font-medium text-gray-600">Description</th>
                              <th className="text-right py-2 px-3 font-medium text-gray-600">Qty Used</th>
                              <th className="text-left py-2 px-3 font-medium text-gray-600">Location</th>
                              <th className="text-left py-2 px-3 font-medium text-gray-600">Comments</th>
                            </tr>
                          </thead>
                          <tbody>
                            {executionData.consumedSpareParts.map((part: any, idx: number) => (
                              <tr key={idx} className="border-b border-gray-100">
                                <td className="py-2 px-3 text-gray-900">{part.partNo}</td>
                                <td className="py-2 px-3 text-gray-900">{part.description}</td>
                                <td className="py-2 px-3 text-gray-900 text-right">{part.quantityConsumed}</td>
                                <td className="py-2 px-3 text-gray-500">{part.location || "-"}</td>
                                <td className="py-2 px-3 text-gray-500">{part.comments || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Documents */}
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <SectionHeader 
                      icon={<FileText className="h-4 w-4" />} 
                      title="Documents & Checklists" 
                    />
                    <div className="grid grid-cols-3 gap-4">
                      <ReadOnlyField label="Risk Assessment" value={executionData?.riskAssessment || "No"} />
                      <ReadOnlyField label="Safety Checklists" value={executionData?.safetyChecklists || "No"} />
                      <ReadOnlyField label="Operational Forms" value={executionData?.operationalForms || "No"} />
                    </div>
                  </div>
                </div>

                {/* Footer Metadata */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border text-xs text-gray-500">
                  <p className="flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    This is a read-only view of the completed work order. The work order was completed and approved.
                  </p>
                  <p className="mt-1">Maintenance history records are immutable for audit compliance purposes.</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default WorkOrderViewerSheet;
