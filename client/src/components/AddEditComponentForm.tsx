import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChevronRight, ChevronDown, Plus, Edit2, FileText, FileImage, FileCheck, File, Upload, Download, Lock, HelpCircle, CheckCircle, AlertCircle, Check, ChevronsUpDown, X, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useVessel } from "@/contexts/VesselContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getComponentCategory } from "@/utils/componentUtils";
import { useMasterListOptions } from "@/hooks/useDepartments";
import { useAuth } from "@/contexts/AuthContext";
import { AdminOnly } from "@/components/RoleGuard";
import { FEATURES } from '@/config/features';
import { formatProfessionalDate } from "@/lib/dateUtils";
import RunningHoursConditionPanel from "@/components/RunningHoursConditionPanel";

interface JobsSectionCProps {
  isEditMode: boolean;
  isLoadingJobs: boolean;
  componentJobs: any[];
  getPreviewData: <T>(data: T[], sectionId: string) => T[];
  showAllRows: Set<string>;
  toggleShowAllRows: (sectionId: string) => void;
  PREVIEW_ROW_LIMIT: number;
  vesselId: string;
}

const JobsSectionC: React.FC<JobsSectionCProps> = ({
  isEditMode,
  isLoadingJobs,
  componentJobs,
  getPreviewData,
  showAllRows,
  toggleShowAllRows,
  PREVIEW_ROW_LIMIT,
  vesselId,
}) => {
  const { toast } = useToast();
  const [jobToDeactivate, setJobToDeactivate] = useState<any>(null);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

  const inactivateMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/technical/api/jobs/${jobId}/inactivate`, { vesselId });
      return await res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: data.message || "Job deactivated successfully" });
      queryClient.invalidateQueries({ queryKey: [`/technical/api/jobs?vesselId=${vesselId}`] });
      setShowDeactivateDialog(false);
      setJobToDeactivate(null);
    },
    onError: (error: any) => {
      const message = error?.message || "Failed to deactivate job";
      toast({ title: "Error", description: message, variant: "destructive" });
      setShowDeactivateDialog(false);
      setJobToDeactivate(null);
    },
  });

  return (
    <>
      <div className="overflow-x-auto">
        {isEditMode && (
          <div className="flex justify-end mb-3">
            <Button
              size="sm"
              className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white"
              disabled
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Job
            </Button>
          </div>
        )}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-medium text-gray-600">Job Code</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Job Title</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Task Type</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Frequency</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Last Done Date</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Next Due Date</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {isLoadingJobs ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  Loading jobs...
                </td>
              </tr>
            ) : !isEditMode ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  Jobs will be available after component is created
                </td>
              </tr>
            ) : componentJobs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  No jobs found for this component
                </td>
              </tr>
            ) : (
              getPreviewData(componentJobs, "C").map((job, index) => {
                const isInactive = job.isActive === false;
                return (
                  <tr
                    key={index}
                    className={`border-b border-gray-100 ${isInactive ? "opacity-60" : "hover:bg-gray-50"}`}
                    data-testid={`job-row-${job.jobNo}`}
                  >
                    <td className={`py-3 px-3 ${isInactive ? "text-gray-400" : "text-gray-900"}`}>
                      {job.jobNo}{isInactive && <span className="ml-1 text-xs text-red-400">(Inactive)</span>}
                    </td>
                    <td className={`py-3 px-3 ${isInactive ? "text-gray-400" : "text-gray-900"}`}>{job.jobTitle}</td>
                    <td className={`py-3 px-3 ${isInactive ? "text-gray-400" : "text-gray-900"}`}>{job.maintenanceType}</td>
                    <td className={`py-3 px-3 ${isInactive ? "text-gray-400" : "text-gray-900"}`}>{job.frequencyValue} {job.frequencyUnit}</td>
                    <td className={`py-3 px-3 ${isInactive ? "text-gray-400" : "text-gray-900"}`}>{formatProfessionalDate(job.lastDoneDate) || '-'}</td>
                    <td className={`py-3 px-3 ${isInactive ? "text-gray-400" : "text-gray-900"}`}>{formatProfessionalDate(job.nextDueDate) || '-'}</td>
                    <td className="py-3 px-1">
                      {!isInactive && (
                        <button
                          className="p-1.5 rounded text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setJobToDeactivate(job);
                            setShowDeactivateDialog(true);
                          }}
                          data-testid={`btn-delete-job-${job.jobNo}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {componentJobs.length > PREVIEW_ROW_LIMIT && (
          <div className="text-center mt-2">
            <Button
              variant="link"
              size="sm"
              onClick={() => toggleShowAllRows("C")}
              className="text-[#16569e] text-xs"
              data-testid="button-toggle-jobs"
            >
              {showAllRows.has("C") ? `Show Less` : `View More (${componentJobs.length - PREVIEW_ROW_LIMIT} more)`}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deactivate Job</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate job{" "}
              <span className="font-semibold">{jobToDeactivate?.jobNo}</span>? It will no longer appear for vessel and department users.
              Any active work orders for this job will continue to completion.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => { setShowDeactivateDialog(false); setJobToDeactivate(null); }}
              data-testid="btn-deactivate-job-cancel"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => jobToDeactivate && inactivateMutation.mutate(jobToDeactivate.id)}
              disabled={inactivateMutation.isPending}
              data-testid="btn-deactivate-job-confirm"
            >
              {inactivateMutation.isPending ? "Deactivating..." : "Deactivate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

interface AddEditComponentFormProps {
  isOpen: boolean;
  onClose: () => void;
  componentId?: string | null;
  parentComponent?: { code: string; id: string; name: string } | null;
}

const AddEditComponentForm: React.FC<AddEditComponentFormProps> = ({
  isOpen,
  onClose,
  componentId,
  parentComponent,
}) => {
  const { toast } = useToast();
  const { vesselId } = useVessel();
  const { canViewDocument, canDownloadDocument } = useAuth();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["A"]));
  const [isSaving, setIsSaving] = useState(false);
  // Track which sections show all rows (default: only 2 rows preview)
  const [showAllRows, setShowAllRows] = useState<Set<string>>(new Set());
  const PREVIEW_ROW_LIMIT = 2;

  const isEditMode = !!componentId;
  const [makerOpen, setMakerOpen] = useState(false);

  const { data: makersList = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/fleet/makers'],
  });

  const { options: componentCategoryOptions, items: componentCategoryItems } = useMasterListOptions('componentCategory');

  // Component data state - matches exact field structure from Components.tsx Section A
  // Boolean fields default to "No" per specification
  const [componentData, setComponentData] = useState({
    fleetEquipmentCode: "",
    fleetEquipmentName: "",
    parentComponent: parentComponent?.code || "",
    componentCode: "",
    componentName: "",
    componentCategory: "",
    maker: "",
    makerCode: "",
    model: "",
    modelCode: "",
    serialNo: "",
    drawingNo: "",
    location: "",
    critical: "No",
    conditionBased: "No",
    installationDate: "",
    commissionedDate: "",
    rating: "",
    eqptSystemDept: "",
    notes: "",
    runningHours: "",
    isActive: "Yes",
    vesselCode: "",
    isParent: "No",
    classItem: "No",
    // Section B: Running Hours & Condition Monitoring
    rhCounterType: "NOT_RH_DRIVEN",
    rhCounterSource: "",
    rhMasterComponentId: "",
    lastUpdated: "",
  });

  // Show loading state while fetching data in edit mode
  const [isDataLoaded, setIsDataLoaded] = useState(!isEditMode);

  // Fetch existing component data if in edit mode
  const { data: existingComponent, isLoading: isLoadingComponent } = useQuery<any>({
    queryKey: ['/technical/api/components', componentId],
    enabled: isEditMode && !!componentId,
  });

  // Fetch related data for sections B-H (only in edit mode)
  // Filter jobs by vesselId at the database level
  const { data: allJobs = [], isLoading: isLoadingJobs } = useQuery<any[]>({
    queryKey: [`/technical/api/jobs?vesselId=${vesselId}`],
    enabled: isEditMode && !!vesselId,
  });

  const { data: maintenanceHistory = [], isLoading: isLoadingHistory } = useQuery<any[]>({
    queryKey: [`/technical/api/component-maintenance-history/${componentId}`],
    enabled: isEditMode && !!componentId,
  });

  const { data: allSpares = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/spares'],
    enabled: isEditMode,
  });

  const { data: documents = [], isLoading: isLoadingDocs } = useQuery<any[]>({
    queryKey: [`/technical/api/component-documents/${componentId}`],
    enabled: isEditMode && !!componentId,
  });

  const { data: classRegData = [], isLoading: isLoadingClassReg } = useQuery<any[]>({
    queryKey: [`/technical/api/component-class-regulatory/${componentId}`],
    enabled: isEditMode && !!componentId,
  });

  const { data: requisitions = [], isLoading: isLoadingRequisitions } = useQuery<any[]>({
    queryKey: [`/technical/api/component-requisitions/${componentId}`],
    enabled: isEditMode && !!componentId,
  });

  const { data: allComponents = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/components'],
    enabled: isEditMode,
  });

  const { data: addModeMasterComponents = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/rh-config/master-components', vesselId],
    queryFn: async () => {
      const res = await fetch(`/technical/api/rh-config/master-components/${vesselId}`);
      if (!res.ok) throw new Error("Failed to fetch master components");
      return res.json();
    },
    enabled: !!vesselId && componentData.rhCounterType === "INHERITED",
    staleTime: 0,
  });

  const [rhSourceOpen, setRhSourceOpen] = useState(false);

  // Section B: Running Hours Counter Type Logic
  const explicitRhType = existingComponent?.rhCounterType;
  const rhMasterComponentId = existingComponent?.rhMasterComponentId;
  const existingComponentCode = existingComponent?.componentCode;
  const parentId = existingComponent?.parentId;

  // Auto-detect RH type from jobs if no explicit type is set
  const autoDetectedType = React.useMemo(() => {
    if (!isEditMode || !existingComponent) return 'NONE';
    if (explicitRhType) return null;
    if (!existingComponentCode || isLoadingJobs) return 'NONE';
    
    const compJobs = allJobs.filter((j: any) => j.componentCode === existingComponentCode);
    const hasRHJobs = compJobs.some((j: any) => 
      j.frequencyType === 'Running Hours' || 
      (j.rhInterval && Number(j.rhInterval) > 0)
    );
    return hasRHJobs ? 'MASTER' : 'NONE';
  }, [explicitRhType, existingComponentCode, allJobs, isLoadingJobs, isEditMode, existingComponent]);

  // Final RH counter type: explicit takes precedence, fallback to auto-detected
  const rhCounterType = explicitRhType || autoDetectedType || 'NONE';

  // Fetch master component data if type is INHERITED
  const { data: masterComponent, isLoading: isMasterLoading } = useQuery<any>({
    queryKey: [`/technical/api/components/details/${rhMasterComponentId}`],
    enabled: isEditMode && rhCounterType === 'INHERITED' && !!rhMasterComponentId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch parent component for INHERITED type
  const { data: rhParentComponent } = useQuery<any>({
    queryKey: [`/technical/api/components/details/${parentId}`],
    enabled: isEditMode && rhCounterType === 'INHERITED' && !!parentId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch running hours data for accurate timestamps (for MASTER type)
  const { data: runningHoursData = [] } = useQuery<any[]>({
    queryKey: [`/technical/api/running-hours/${componentId}`],
    enabled: isEditMode && !!componentId && rhCounterType === 'MASTER',
    staleTime: 60 * 1000,
  });

  // Get the latest running hours update timestamp from the data
  const latestRhUpdate = Array.isArray(runningHoursData) && runningHoursData.length > 0 
    ? runningHoursData[0] 
    : (runningHoursData && typeof runningHoursData === 'object' ? runningHoursData : null);

  // Helper to get display label for counter type
  const getCounterTypeLabel = (type: string) => {
    switch (type) {
      case 'MASTER': return 'Master (RH Owner)';
      case 'INHERITED': return 'Inherited (Uses Master Counter)';
      case 'NONE': 
      default: return 'Not RH Driven';
    }
  };

  // Get component's own RH and timestamp values (used as fallback)
  const componentRh = existingComponent?.currentCumulativeRH ?? existingComponent?.runningHours;
  const componentLastUpdated = existingComponent?.lastUpdated ?? existingComponent?.rhLastUpdated;

  // Unified loading state for INHERITED type
  const isMasterPending = rhCounterType === 'INHERITED' && (isMasterLoading || masterComponent === undefined);

  // Dummy date fallback for Last Updated when no real timestamp exists
  const DUMMY_DATE = '15 Dec 2025';

  // Get running hours value - always show component RH value for all types
  const getRunningHoursValue = (): string => {
    if (rhCounterType === 'INHERITED') {
      if (isMasterPending) return 'Loading...';
      const inheritedRh = masterComponent?.currentCumulativeRH ?? masterComponent?.runningHours ?? componentRh;
      return inheritedRh != null ? String(inheritedRh) : '—';
    }
    if (rhCounterType === 'MASTER') {
      return componentRh != null ? String(componentRh) : '0';
    }
    return componentRh != null ? String(componentRh) : '—';
  };

  // Get last updated date
  const getLastUpdatedValue = (): string => {
    if (rhCounterType === 'INHERITED') {
      if (isMasterPending) return 'Loading...';
      const inheritedUpdated = masterComponent?.lastUpdated ?? masterComponent?.rhLastUpdated ?? componentLastUpdated;
      return inheritedUpdated ?? DUMMY_DATE;
    }
    const masterUpdated = latestRhUpdate?.dateUpdatedLocal ?? latestRhUpdate?.updatedAt ?? componentLastUpdated;
    return masterUpdated ?? DUMMY_DATE;
  };

  // Get counter source
  const getCounterSourceValue = (): string => {
    if (rhCounterType === 'MASTER') return 'Self';
    if (rhCounterType === 'INHERITED') {
      return rhParentComponent?.name ?? parentId ?? '—';
    }
    return '—';
  };

  // Helper to normalize boolean/string to "Yes"/"No" - defaults to "No" for null/undefined
  const toBoolString = (val: any) => {
    if (val === true || (typeof val === 'string' && val.toLowerCase() === 'yes')) return "Yes";
    if (val === false || val === null || val === undefined || (typeof val === 'string' && val.toLowerCase() === 'no')) return "No";
    return "No";
  };

  // Filter jobs for this component and its children
  const componentJobs = isEditMode && existingComponent ? (() => {
    const getAllChildCodes = (parentCode: string): string[] => {
      const children = allComponents.filter(c => c.parentId === parentCode);
      const childCodes = children.map(c => c.componentCode);
      const descendantCodes = children.flatMap(c => getAllChildCodes(c.componentCode));
      return [...childCodes, ...descendantCodes];
    };
    const relevantCodes = [existingComponent.componentCode, ...getAllChildCodes(existingComponent.componentCode)];
    return allJobs.filter(job => relevantCodes.includes(job.componentCode));
  })() : [];

  // Filter spares for this component
  const componentSpares = isEditMode && componentId
    ? allSpares.filter(s => s.componentId === componentId)
    : [];

  const deriveComponentCategory = (codeOrId: string): string => {
    if (!codeOrId) return '';
    const firstChar = codeOrId.includes('.') ? codeOrId.split('.')[0].charAt(0) : codeOrId.charAt(0);
    const mlItem = componentCategoryItems.find(item => item.listKey === firstChar && item.isActive);
    if (mlItem) return mlItem.listValue;
    return getComponentCategory(codeOrId);
  };

  // Populate form in edit mode
  useEffect(() => {
    if (isEditMode && existingComponent && !isLoadingComponent) {
      setComponentData({
        fleetEquipmentCode: existingComponent.fleetEquipmentCode || "",
        fleetEquipmentName: existingComponent.fleetEquipmentName || "",
        parentComponent: existingComponent.parentId || "",
        componentCode: existingComponent.componentCode || "",
        componentName: existingComponent.name || "",
        componentCategory: existingComponent.componentCategory || deriveComponentCategory(existingComponent.componentCode || existingComponent.id),
        maker: existingComponent.maker || "",
        makerCode: existingComponent.makerCode || "",
        model: existingComponent.model || "",
        modelCode: existingComponent.modelCode || "",
        serialNo: existingComponent.serialNo || "",
        drawingNo: existingComponent.drawingNo || "",
        location: existingComponent.location || "",
        critical: toBoolString(existingComponent.critical),
        conditionBased: toBoolString(existingComponent.conditionBased),
        installationDate: existingComponent.installationDate || "",
        commissionedDate: existingComponent.commissionedDate || "",
        rating: existingComponent.rating || "",
        eqptSystemDept: existingComponent.eqptSystemDept || existingComponent.deptCategory || "",
        notes: existingComponent.notes || "",
        runningHours: existingComponent.runningHours?.toString() || existingComponent.currentCumulativeRH?.toString() || "",
        isActive: toBoolString(existingComponent.isActive),
        vesselCode: existingComponent.vesselCode || vesselId || "",
        isParent: toBoolString(existingComponent.isParent),
        classItem: toBoolString(existingComponent.classItem),
        // Section B: Running Hours & Condition Monitoring
        rhCounterType: existingComponent.rhCounterType || "NOT_RH_DRIVEN",
        rhCounterSource: existingComponent.rhCounterSource || "",
        rhMasterComponentId: existingComponent.rhMasterComponentId || "",
        lastUpdated: existingComponent.lastUpdated || existingComponent.rhLastUpdated || "",
      });
      setIsDataLoaded(true);
    } else if (!isEditMode && parentComponent) {
      setComponentData(prev => ({
        ...prev,
        parentComponent: parentComponent.code,
        componentCategory: deriveComponentCategory(parentComponent.code),
        vesselCode: vesselId || "",
      }));
      setIsDataLoaded(true);
    } else if (!isEditMode) {
      setIsDataLoaded(true);
    }
  }, [existingComponent, isLoadingComponent, isEditMode, parentComponent, vesselId]);

  // Auto-update componentCategory when componentCode changes
  useEffect(() => {
    if (componentData.componentCode && componentCategoryItems.length > 0) {
      const derivedCategory = deriveComponentCategory(componentData.componentCode);
      if (derivedCategory && derivedCategory !== componentData.componentCategory) {
        setComponentData(prev => ({ ...prev, componentCategory: derivedCategory }));
      }
    }
  }, [componentData.componentCode, componentCategoryItems]);

  const PARENT_OPTIONAL_FIELDS = ['eqptSystemDept'];

  const ALL_MANDATORY_FIELDS = [
    { key: 'parentComponent', label: 'Parent Component Code' },
    { key: 'componentCode', label: 'Component Code' },
    { key: 'componentName', label: 'Component Name' },
    { key: 'componentCategory', label: 'Component Category' },
    { key: 'eqptSystemDept', label: 'Equipment / System Department' },
    { key: 'isActive', label: 'Is Active' },
  ] as const;

  const isParentComponent = componentData.isParent === "Yes";

  const MANDATORY_FIELDS = isParentComponent
    ? ALL_MANDATORY_FIELDS.filter(f => !PARENT_OPTIONAL_FIELDS.includes(f.key))
    : ALL_MANDATORY_FIELDS;

  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

  const validateMandatoryFields = (): boolean => {
    const errors: Record<string, boolean> = {};
    let hasErrors = false;
    for (const field of MANDATORY_FIELDS) {
      const value = componentData[field.key as keyof typeof componentData];
      if (!value || value.trim() === '') {
        errors[field.key] = true;
        hasErrors = true;
      }
    }
    setValidationErrors(errors);
    return !hasErrors;
  };

  const handleFieldChange = (fieldName: string, value: string) => {
    setComponentData(prev => ({ ...prev, [fieldName]: value }));
    if (validationErrors[fieldName]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  };

  // Convert Yes/No strings to boolean
  const toBool = (val: string) => val === "Yes";

  const handleSave = async () => {
    if (!validateMandatoryFields()) {
      toast({
        title: "Validation Error",
        description: "Please fill all mandatory fields before saving.",
        variant: "destructive",
      });
      return;
    }
    if (componentData.maker && componentData.maker.trim()) {
      if (makersList.length === 0) {
        toast({
          title: "Validation Error",
          description: "Maker list is still loading. Please try again in a moment.",
          variant: "destructive",
        });
        return;
      }
      const validMaker = makersList.find((m: any) => m.makerName === componentData.maker);
      if (!validMaker) {
        toast({
          title: "Validation Error",
          description: "Please select a valid Maker from the Maker List.",
          variant: "destructive",
        });
        return;
      }
      if (componentData.makerCode !== validMaker.makerCode) {
        handleFieldChange('makerCode', validMaker.makerCode);
      }
    } else if (componentData.makerCode) {
      handleFieldChange('makerCode', '');
    }
    if (componentData.rhCounterType === "INHERITED" && !componentData.rhMasterComponentId) {
      toast({
        title: "Validation Error",
        description: "Please select a RH Counter Source from MASTER components.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    try {
      // Prepare component payload with proper field name mapping and boolean conversion
      const payload = {
        name: componentData.componentName,
        componentCode: componentData.componentCode,
        parentId: componentData.parentComponent || null,
        fleetEquipmentCode: componentData.fleetEquipmentCode || null,
        fleetEquipmentName: componentData.fleetEquipmentName || null,
        componentCategory: componentData.componentCategory || null,
        maker: componentData.maker || null,
        makerCode: componentData.makerCode || null,
        model: componentData.model || null,
        modelCode: componentData.modelCode || null,
        serialNo: componentData.serialNo || null,
        drawingNo: componentData.drawingNo || null,
        location: componentData.location || null,
        critical: toBool(componentData.critical),
        conditionBased: toBool(componentData.conditionBased),
        installationDate: componentData.installationDate || null,
        commissionedDate: componentData.commissionedDate || null,
        rating: componentData.rating || null,
        eqptSystemDept: componentData.eqptSystemDept || null,
        notes: componentData.notes || null,
        runningHours: componentData.runningHours ? parseFloat(componentData.runningHours) : null,
        isActive: toBool(componentData.isActive),
        vesselCode: componentData.vesselCode || vesselId || null,
        isParent: toBool(componentData.isParent),
        classItem: toBool(componentData.classItem),
        vesselId: vesselId || "V001",
        rhCounterType: componentData.rhCounterType === "NOT_RH_DRIVEN" ? "NOT_RH_DRIVEN" : componentData.rhCounterType,
        rhMasterComponentId: componentData.rhCounterType === "INHERITED" ? (componentData.rhMasterComponentId || null) : null,
      };

      if (isEditMode && componentId) {
        await apiRequest('PATCH', `/technical/api/components/${componentId}`, payload);
        toast({
          title: "Component Updated",
          description: "Component has been updated successfully.",
        });
      } else {
        await apiRequest('POST', '/technical/api/components', payload);
        toast({
          title: "Component Created",
          description: "New component has been created successfully.",
        });
      }

      // Invalidate all component-related queries to force fresh data fetch
      console.log('🔄 Invalidating component queries after save, vesselId:', vesselId);
      await queryClient.invalidateQueries({ queryKey: ['/technical/api/components'] });
      
      // Also invalidate the vessel-specific query
      const currentVesselId = vesselId || 'V001';
      await queryClient.invalidateQueries({ 
        queryKey: [`/technical/api/components/${currentVesselId}`] 
      });
      console.log('[CREATE] Cache invalidated for vessel:', currentVesselId);
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save component",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const toggleShowAllRows = (sectionId: string) => {
    setShowAllRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // Helper to get limited data for preview
  const getPreviewData = <T,>(data: T[], sectionId: string): T[] => {
    if (showAllRows.has(sectionId)) return data;
    return data.slice(0, PREVIEW_ROW_LIMIT);
  };

  const formSections = [
    { id: "A", title: "Component Information" },
    { id: "B", title: "Running Hours & Condition Monitoring" },
    { id: "C", title: "Jobs" },
    { id: "D", title: "Maintenance History" },
    { id: "E", title: "Spares" },
    { id: "F", title: "Drawings & Manuals" },
    { id: "G", title: "Classification & Regulatory Data" },
    { id: "H", title: "Requisitions" }
  ];

  const getFileTypeIcon = (fileType: string) => {
    switch (fileType) {
      case 'Manual': return FileText;
      case 'Drawing': return FileImage;
      case 'Certificate': return FileCheck;
      default: return File;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-lg font-semibold text-[#16569e]">
            {isEditMode ? "Edit Component" : "Add New Component"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEditMode ? "Edit component details across sections A-H" : "Add a new component with details"}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-4" style={{ maxHeight: "calc(90vh - 140px)" }}>
          {/* Show loading state in edit mode while fetching data */}
          {isEditMode && (isLoadingComponent || !isDataLoaded) ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">Loading component data...</div>
            </div>
          ) : (
          <div className="space-y-4">
            {formSections.map((section) => {
              const isExpanded = expandedSections.has(section.id);

              return (
                <Card key={section.id} className="rounded-sm border border-gray-200">
                  <CardHeader
                    className="py-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleSection(section.id)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-[#16569e]">
                        {section.id}. {section.title}
                      </CardTitle>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-4 border-t border-gray-100">
                      {/* Section A: Component Information - EXACT REPLICA */}
                      {section.id === "A" && (
                        <div className="space-y-4">
                          {/* Row 1: Fleet Equipment Code, Fleet Equipment Name, Parent Component Code, Component Code */}
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Fleet Equipment Code</label>
                              <input
                                type="text"
                                value={componentData.fleetEquipmentCode}
                                onChange={(e) => handleFieldChange('fleetEquipmentCode', e.target.value)}
                                className="text-sm w-full px-2 py-1 border rounded text-[#52BAF3] border-[#52BAF3]"
                                data-testid="input-fleet-equipment-code"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Fleet Equipment Name</label>
                              <input
                                type="text"
                                value={componentData.fleetEquipmentName}
                                onChange={(e) => handleFieldChange('fleetEquipmentName', e.target.value)}
                                className="text-sm w-full px-2 py-1 border rounded text-[#52BAF3] border-[#52BAF3]"
                                data-testid="input-fleet-equipment-name"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Parent Component Code<span className="text-red-500 ml-0.5">*</span></label>
                              <input
                                type="text"
                                value={componentData.parentComponent}
                                onChange={(e) => handleFieldChange('parentComponent', e.target.value)}
                                className={`text-sm w-full px-2 py-1 border rounded ${validationErrors.parentComponent ? 'border-red-500 text-red-700' : 'text-[#52BAF3] border-[#52BAF3]'}`}
                                data-testid="input-parent-component-code"
                                disabled={!!parentComponent}
                              />
                              {validationErrors.parentComponent && <span className="text-xs text-red-500" data-testid="validation-error-parentComponent">This field is required</span>}
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Component Code<span className="text-red-500 ml-0.5">*</span></label>
                              {isEditMode ? (
                                <div className="text-sm text-gray-900" data-testid="text-component-code">
                                  {componentData.componentCode}
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  value={componentData.componentCode}
                                  onChange={(e) => handleFieldChange('componentCode', e.target.value)}
                                  className={`text-sm w-full px-2 py-1 border rounded ${validationErrors.componentCode ? 'border-red-500 text-red-700' : 'text-[#52BAF3] border-[#52BAF3]'}`}
                                  data-testid="input-component-code"
                                />
                              )}
                              {validationErrors.componentCode && <span className="text-xs text-red-500" data-testid="validation-error-componentCode">This field is required</span>}
                            </div>
                          </div>

                          {/* Row 2: Component Name, Component Category, Maker, Maker Code */}
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Component Name<span className="text-red-500 ml-0.5">*</span></label>
                              <input
                                type="text"
                                value={componentData.componentName}
                                onChange={(e) => handleFieldChange('componentName', e.target.value)}
                                className={`text-sm w-full px-2 py-1 border rounded ${validationErrors.componentName ? 'border-red-500 text-red-700' : 'text-[#52BAF3] border-[#52BAF3]'}`}
                                data-testid="input-component-name"
                              />
                              {validationErrors.componentName && <span className="text-xs text-red-500" data-testid="validation-error-componentName">This field is required</span>}
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Component Category<span className="text-red-500 ml-0.5">*</span></label>
                              <select
                                value={componentData.componentCategory}
                                onChange={(e) => handleFieldChange('componentCategory', e.target.value)}
                                className={`text-sm w-full px-2 py-1 border rounded ${validationErrors.componentCategory ? 'border-red-500 text-red-700' : 'text-[#52BAF3] border-[#52BAF3]'}`}
                                data-testid="select-component-category"
                                title="Auto-populated based on component group (1-8), can be overridden"
                              >
                                <option value="">Select Category</option>
                                {componentCategoryOptions.map(opt => (
                                  <option key={opt.value} value={opt.label}>{opt.label}</option>
                                ))}
                              </select>
                              {validationErrors.componentCategory && <span className="text-xs text-red-500" data-testid="validation-error-componentCategory">This field is required</span>}
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Maker</label>
                              <div className="flex gap-1">
                                <Popover open={makerOpen} onOpenChange={setMakerOpen}>
                                  <PopoverTrigger asChild>
                                    <button
                                      type="button"
                                      role="combobox"
                                      aria-expanded={makerOpen}
                                      className="flex items-center justify-between w-full px-2 py-1 text-sm border rounded bg-white hover:bg-gray-50 text-left border-[#52BAF3]"
                                      data-testid="input-maker"
                                    >
                                      <span className={`truncate ${componentData.maker ? 'text-[#52BAF3]' : 'text-gray-400'}`}>
                                        {componentData.maker || "Select maker..."}
                                      </span>
                                      <ChevronsUpDown className="h-3 w-3 flex-shrink-0 text-gray-400 ml-1" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[280px] p-0" align="start">
                                    <Command>
                                      <CommandInput placeholder="Search makers..." data-testid="input-search-maker" />
                                      <CommandList className="max-h-[200px]">
                                        <CommandEmpty>No makers found.</CommandEmpty>
                                        <CommandGroup>
                                          {makersList.map((maker: any) => (
                                            <CommandItem
                                              key={maker.id || maker.makerListUuid}
                                              value={maker.makerName}
                                              onSelect={() => {
                                                handleFieldChange('maker', maker.makerName);
                                                handleFieldChange('makerCode', maker.makerCode);
                                                setMakerOpen(false);
                                              }}
                                              data-testid={`option-maker-${maker.makerCode}`}
                                            >
                                              <span className="truncate">{maker.makerName}</span>
                                              {componentData.maker === maker.makerName && <Check className="h-3 w-3 ml-auto text-blue-600" />}
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                                {componentData.maker && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleFieldChange('maker', '');
                                      handleFieldChange('makerCode', '');
                                    }}
                                    className="flex items-center justify-center w-8 text-gray-400 hover:text-red-500 border rounded border-gray-300"
                                    data-testid="button-clear-maker"
                                    title="Clear maker"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Maker Code</label>
                              <input
                                type="text"
                                value={componentData.makerCode}
                                readOnly
                                className="text-sm w-full px-2 py-1 border rounded bg-gray-50 text-gray-700 cursor-not-allowed border-gray-300"
                                data-testid="input-maker-code"
                                title="Auto-populated from selected maker"
                              />
                            </div>
                          </div>

                          {/* Row 3: Model, Model Code, Serial No, Drawing No */}
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Model</label>
                              <input
                                type="text"
                                value={componentData.model}
                                onChange={(e) => handleFieldChange('model', e.target.value)}
                                className="text-sm w-full px-2 py-1 border rounded text-[#52BAF3] border-[#52BAF3]"
                                data-testid="input-model"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Model Code</label>
                              <input
                                type="text"
                                value={componentData.modelCode}
                                onChange={(e) => handleFieldChange('modelCode', e.target.value)}
                                className="text-sm w-full px-2 py-1 border rounded text-[#52BAF3] border-[#52BAF3]"
                                data-testid="input-model-code"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Serial No</label>
                              <input
                                type="text"
                                value={componentData.serialNo}
                                onChange={(e) => handleFieldChange('serialNo', e.target.value)}
                                className="text-sm w-full px-2 py-1 border rounded text-[#52BAF3] border-[#52BAF3]"
                                data-testid="input-serial-no"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Drawing No</label>
                              <input
                                type="text"
                                value={componentData.drawingNo}
                                onChange={(e) => handleFieldChange('drawingNo', e.target.value)}
                                className="text-sm w-full px-2 py-1 border rounded text-[#52BAF3] border-[#52BAF3]"
                                data-testid="input-drawing-no"
                              />
                            </div>
                          </div>

                          {/* Row 4: Location, Critical (Yes/No), Condition Based (Yes/No), Installation Date */}
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Location</label>
                              <input
                                type="text"
                                value={componentData.location}
                                onChange={(e) => handleFieldChange('location', e.target.value)}
                                className="text-sm w-full px-2 py-1 border rounded text-[#52BAF3] border-[#52BAF3]"
                                data-testid="input-location"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Criticality</label>
                              <select
                                value={componentData.critical}
                                onChange={(e) => handleFieldChange('critical', e.target.value)}
                                className="text-sm w-full px-2 py-1 border rounded text-[#52BAF3] border-[#52BAF3]"
                                data-testid="select-criticality"
                              >
                                <option value="">Select</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Condition Based</label>
                              <select
                                value={componentData.conditionBased}
                                onChange={(e) => handleFieldChange('conditionBased', e.target.value)}
                                className="text-sm w-full px-2 py-1 border rounded text-[#52BAF3] border-[#52BAF3]"
                                data-testid="select-condition-based"
                              >
                                <option value="">Select</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Installation Date</label>
                              <input
                                type="date"
                                value={componentData.installationDate}
                                onChange={(e) => handleFieldChange('installationDate', e.target.value)}
                                className="text-sm w-full px-2 py-1 border rounded text-[#52BAF3] border-[#52BAF3]"
                                data-testid="input-installation-date"
                              />
                            </div>
                          </div>

                          {/* Row 5: Commissioning Date, Rating, Equip/System Department, (spacer) */}
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Commissioned Date</label>
                              <input
                                type="date"
                                value={componentData.commissionedDate}
                                onChange={(e) => handleFieldChange('commissionedDate', e.target.value)}
                                className="text-sm w-full px-2 py-1 border rounded text-[#52BAF3] border-[#52BAF3]"
                                data-testid="input-commissioned-date"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Rating</label>
                              <input
                                type="text"
                                value={componentData.rating}
                                onChange={(e) => handleFieldChange('rating', e.target.value)}
                                className="text-sm w-full px-2 py-1 border rounded text-[#52BAF3] border-[#52BAF3]"
                                data-testid="input-rating"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Equipment / System Department{!isParentComponent && <span className="text-red-500 ml-0.5">*</span>}</label>
                              <select
                                value={componentData.eqptSystemDept}
                                onChange={(e) => handleFieldChange('eqptSystemDept', e.target.value)}
                                className={`text-sm w-full px-2 py-1 border rounded ${validationErrors.eqptSystemDept ? 'border-red-500 text-red-700' : 'text-[#52BAF3] border-[#52BAF3]'}`}
                                data-testid="select-eqpt-system-dept"
                              >
                                <option value="">Select Department</option>
                                <option value="Deck">Deck</option>
                                <option value="Engine">Engine</option>
                                <option value="Electrical">Electrical</option>
                              </select>
                              {validationErrors.eqptSystemDept && <span className="text-xs text-red-500" data-testid="validation-error-eqptSystemDept">This field is required</span>}
                            </div>
                            <div>
                              {/* Empty spacer field */}
                            </div>
                          </div>

                          {/* Row 6: Class Item, IS Active, Vessel Code, IS Parent */}
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Class Item</label>
                              <select
                                value={componentData.classItem}
                                onChange={(e) => handleFieldChange('classItem', e.target.value)}
                                className="text-sm w-full px-2 py-1 border rounded text-[#52BAF3] border-[#52BAF3]"
                                data-testid="select-class-item"
                              >
                                <option value="">Select</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">IS Active<span className="text-red-500 ml-0.5">*</span></label>
                              <select
                                value={componentData.isActive}
                                onChange={(e) => handleFieldChange('isActive', e.target.value)}
                                className={`text-sm w-full px-2 py-1 border rounded ${validationErrors.isActive ? 'border-red-500 text-red-700' : 'text-[#52BAF3] border-[#52BAF3]'}`}
                                data-testid="select-is-active"
                              >
                                <option value="">Select</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                              </select>
                              {validationErrors.isActive && <span className="text-xs text-red-500" data-testid="validation-error-isActive">This field is required</span>}
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Vessel Code</label>
                              <input
                                type="text"
                                value={componentData.vesselCode}
                                onChange={(e) => handleFieldChange('vesselCode', e.target.value)}
                                className="text-sm w-full px-2 py-1 border rounded text-[#52BAF3] border-[#52BAF3]"
                                data-testid="input-vessel-code"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">IS Parent</label>
                              <select
                                value={componentData.isParent}
                                onChange={(e) => handleFieldChange('isParent', e.target.value)}
                                className="text-sm w-full px-2 py-1 border rounded text-[#52BAF3] border-[#52BAF3]"
                                data-testid="select-is-parent"
                              >
                                <option value="">Select</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                              </select>
                            </div>
                          </div>

                          {/* Row 7: Notes (full width) */}
                          <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">Notes</label>
                            <textarea
                              value={componentData.notes}
                              onChange={(e) => handleFieldChange('notes', e.target.value)}
                              className="text-sm w-full px-2 py-1 border rounded text-[#52BAF3] border-[#52BAF3]"
                              rows={3}
                              data-testid="input-notes"
                            />
                          </div>
                        </div>
                      )}

                      {/* Section B: Running Hours & Condition Monitoring - B7.B Panel */}
                      {section.id === "B" && isEditMode && componentId && (
                        <div className="space-y-4" data-testid="section-b-rh-panel">
                          <RunningHoursConditionPanel
                            componentId={componentId}
                            vesselId={vesselId}
                            isExpanded={true}
                            readOnly={false}
                            embedded={true}
                          />
                        </div>
                      )}
                      {section.id === "B" && !isEditMode && (
                        <div className="space-y-4" data-testid="section-b-add-mode">
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse" data-testid="rh-table-add">
                              <thead>
                                <tr className="bg-[#52baf3] text-white text-sm">
                                  <th className="p-3 text-left font-medium border-r border-[#4aa3d9]">RH Counter Type</th>
                                  <th className="p-3 text-left font-medium border-r border-[#4aa3d9]">RH Counter Source</th>
                                  <th className="p-3 text-left font-medium border-r border-[#4aa3d9]">Running Hours</th>
                                  <th className="p-3 text-left font-medium">Last Updated</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-b border-gray-100">
                                  <td className="p-3">
                                    <select
                                      value={componentData.rhCounterType}
                                      onChange={(e) => {
                                        const newType = e.target.value;
                                        handleFieldChange('rhCounterType', newType);
                                        if (newType !== "INHERITED") {
                                          handleFieldChange('rhMasterComponentId', '');
                                        }
                                      }}
                                      className="h-8 w-full text-sm px-2 border rounded border-gray-200"
                                      data-testid="select-rh-counter-type-add"
                                    >
                                      <option value="NOT_RH_DRIVEN">Not RH Driven</option>
                                      <option value="MASTER">Master (RH Owner)</option>
                                      <option value="INHERITED">Inherited (Uses Master Counter)</option>
                                    </select>
                                  </td>
                                  <td className="p-3">
                                    {componentData.rhCounterType === "INHERITED" ? (
                                      <div className="flex gap-1">
                                        <Popover open={rhSourceOpen} onOpenChange={setRhSourceOpen}>
                                          <PopoverTrigger asChild>
                                            <button
                                              type="button"
                                              role="combobox"
                                              aria-expanded={rhSourceOpen}
                                              className="flex items-center justify-between w-full h-8 px-2 text-sm border rounded-md bg-white hover:bg-gray-50 text-left"
                                              data-testid="input-rh-source-add"
                                            >
                                              <span className={`truncate ${componentData.rhMasterComponentId ? 'text-gray-900' : 'text-gray-400'}`}>
                                                {componentData.rhMasterComponentId
                                                  ? (() => {
                                                      const mc = addModeMasterComponents.find((m: any) => m.id === componentData.rhMasterComponentId);
                                                      return mc ? `${mc.componentCode} — ${mc.name}` : "Select source...";
                                                    })()
                                                  : "Select source..."}
                                              </span>
                                              <ChevronsUpDown className="h-3 w-3 flex-shrink-0 text-gray-400 ml-1" />
                                            </button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-[350px] p-0" align="start">
                                            <Command>
                                              <CommandInput placeholder="Search by code or name..." data-testid="input-search-rh-source-add" />
                                              <CommandList className="max-h-[200px]">
                                                <CommandEmpty>No MASTER components found.</CommandEmpty>
                                                <CommandGroup>
                                                  {addModeMasterComponents.map((mc: any) => (
                                                    <CommandItem
                                                      key={mc.id}
                                                      value={`${mc.componentCode} ${mc.name}`}
                                                      onSelect={() => {
                                                        handleFieldChange('rhMasterComponentId', mc.id);
                                                        handleFieldChange('rhCounterSource', mc.name);
                                                        setRhSourceOpen(false);
                                                      }}
                                                      data-testid={`option-rh-source-add-${mc.componentCode}`}
                                                    >
                                                      <div className="flex flex-col">
                                                        <span className="text-sm font-medium">{mc.componentCode}</span>
                                                        <span className="text-xs text-gray-500">{mc.name}</span>
                                                      </div>
                                                      {componentData.rhMasterComponentId === mc.id && <Check className="h-3 w-3 ml-auto text-blue-600" />}
                                                    </CommandItem>
                                                  ))}
                                                </CommandGroup>
                                              </CommandList>
                                            </Command>
                                          </PopoverContent>
                                        </Popover>
                                        {componentData.rhMasterComponentId && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              handleFieldChange('rhMasterComponentId', '');
                                              handleFieldChange('rhCounterSource', '');
                                            }}
                                            className="h-8 w-8 flex items-center justify-center border rounded-md hover:bg-red-50"
                                            data-testid="button-clear-rh-source-add"
                                          >
                                            <X className="h-3 w-3 text-gray-500" />
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-sm text-gray-700">
                                        {componentData.rhCounterType === "MASTER" ? "SELF" : "—"}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    <Input
                                      value={componentData.runningHours}
                                      onChange={(e) => handleFieldChange('runningHours', e.target.value)}
                                      className="h-8 text-sm"
                                      placeholder="0.00"
                                      data-testid="input-running-hours-add"
                                    />
                                  </td>
                                  <td className="p-3">
                                    <span className="text-sm text-gray-500">—</span>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Section C: Jobs - EXACT REPLICA */}
                      {section.id === "C" && (
                        <JobsSectionC
                          isEditMode={isEditMode}
                          isLoadingJobs={isLoadingJobs}
                          componentJobs={componentJobs}
                          getPreviewData={getPreviewData}
                          showAllRows={showAllRows}
                          toggleShowAllRows={toggleShowAllRows}
                          PREVIEW_ROW_LIMIT={PREVIEW_ROW_LIMIT}
                          vesselId={vesselId}
                        />
                      )}

                      {/* Section D: Maintenance History - EXACT REPLICA */}
                      {section.id === "D" && (
                        <div>
                          {!isEditMode ? (
                            <div className="text-sm text-gray-500">
                              Maintenance history will be available after component is created
                            </div>
                          ) : isLoadingHistory ? (
                            <div className="text-sm text-gray-500">Loading maintenance history...</div>
                          ) : maintenanceHistory.length === 0 ? (
                            <div className="text-center py-8">
                              <div className="text-gray-400 text-sm">
                                No maintenance history records found for this component
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                History records are automatically created when work orders are approved and completed
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between mb-4">
                                <div className="text-sm text-gray-600">
                                  <span className="font-semibold">{maintenanceHistory.length}</span> maintenance record(s) found
                                </div>
                                <div className="text-xs text-gray-500 italic">
                                  ⚠️ Records are immutable and cannot be edited or deleted
                                </div>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                  <thead>
                                    <tr className="bg-gray-50 border-b-2 border-gray-200">
                                      <th className="text-left py-3 px-3 font-semibold text-gray-700">WO No</th>
                                      <th className="text-left py-3 px-3 font-semibold text-gray-700">Job Title</th>
                                      <th className="text-left py-3 px-3 font-semibold text-gray-700">Type</th>
                                      <th className="text-left py-3 px-3 font-semibold text-gray-700">Date Completed</th>
                                      <th className="text-left py-3 px-3 font-semibold text-gray-700">Running Hours</th>
                                      <th className="text-left py-3 px-3 font-semibold text-gray-700">Performed By</th>
                                      <th className="text-left py-3 px-3 font-semibold text-gray-700">Approved By</th>
                                      <th className="text-left py-3 px-3 font-semibold text-gray-700">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {getPreviewData(maintenanceHistory, "D").map((record, index) => (
                                      <tr
                                        key={index}
                                        className="border-b border-gray-100 hover:bg-blue-50"
                                        data-testid={`maintenance-record-${record.workOrderNo}`}
                                      >
                                        <td className="py-3 px-3 text-gray-900 font-medium">{record.workOrderNo}</td>
                                        <td className="py-3 px-3 text-gray-900">{record.jobTitle}</td>
                                        <td className="py-3 px-3 text-gray-900">{record.maintenanceType}</td>
                                        <td className="py-3 px-3 text-gray-900">{record.dateCompleted}</td>
                                        <td className="py-3 px-3 text-gray-900">{record.runningHoursAtCompletion || '-'}</td>
                                        <td className="py-3 px-3 text-gray-900">{record.performedBy}</td>
                                        <td className="py-3 px-3 text-gray-900">{record.approvedBy || '-'}</td>
                                        <td className="py-3 px-3">
                                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            {record.status}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {maintenanceHistory.length > PREVIEW_ROW_LIMIT && (
                                  <div className="text-center mt-2">
                                    <Button
                                      variant="link"
                                      size="sm"
                                      onClick={() => toggleShowAllRows("D")}
                                      className="text-[#16569e] text-xs"
                                      data-testid="button-toggle-maintenance"
                                    >
                                      {showAllRows.has("D") ? `Show Less` : `View More (${maintenanceHistory.length - PREVIEW_ROW_LIMIT} more)`}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Section E: Spares - EXACT REPLICA */}
                      {section.id === "E" && (
                        <div>
                          {!isEditMode ? (
                            <div className="text-sm text-gray-500">
                              Spares data will be available after component is created
                            </div>
                          ) : componentSpares.length === 0 ? (
                            <div className="text-center py-8">
                              <div className="text-gray-400 text-sm">
                                No spare parts linked to this component
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                Navigate to the Spares module to manage spare parts inventory
                              </p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-200">
                                    <th className="text-left py-2 px-3 font-medium text-gray-600">Part Code</th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-600">Part Name</th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-600">Critical</th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-600">ROB</th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-600">Min</th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-600">Stock</th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-600">Location</th>
                                    <th className="text-center py-2 px-3 font-medium text-gray-600">Rotation</th>
                                    {FEATURES.IHM && (
                                      <th className="text-center py-2 px-3 font-medium text-gray-600" title="IHM Status">IHM</th>
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {getPreviewData(componentSpares, "E").map((spare, index) => (
                                    <tr key={index} className="border-b border-gray-100">
                                      <td className="py-3 px-3 text-gray-900">{spare.partCode}</td>
                                      <td className="py-3 px-3 text-gray-900">{spare.partName}</td>
                                      <td className="py-3 px-3 text-gray-900">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                          spare.critical === true || spare.critical === "Yes"
                                            ? "bg-red-100 text-red-800"
                                            : "bg-gray-100 text-gray-800"
                                        }`}>
                                          {spare.critical === true || spare.critical === "Yes" ? "Yes" : "No"}
                                        </span>
                                      </td>
                                      <td className="py-3 px-3 text-gray-900">{spare.rob}</td>
                                      <td className="py-3 px-3 text-gray-900">{spare.min}</td>
                                      <td className="py-3 px-3 text-gray-900">{spare.stock}</td>
                                      <td className="py-3 px-3 text-gray-900">{spare.location}</td>
                                      <td className="py-3 px-3 text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                          spare.isRotationItem
                                            ? "bg-blue-100 text-blue-800"
                                            : "bg-gray-100 text-gray-600"
                                        }`}>
                                          {spare.isRotationItem ? "Yes" : "No"}
                                        </span>
                                      </td>
                                      {FEATURES.IHM && (
                                        <td className="py-3 px-3 text-center">
                                          {spare.ihmPresence === "Present" ? (
                                            <AlertCircle className="h-4 w-4 text-amber-500 mx-auto" />
                                          ) : spare.ihmPresence === "Not Present" ? (
                                            <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                                          ) : (
                                            <HelpCircle className="h-4 w-4 text-gray-400 mx-auto" />
                                          )}
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {componentSpares.length > PREVIEW_ROW_LIMIT && (
                                <div className="text-center mt-2">
                                  <Button
                                    variant="link"
                                    size="sm"
                                    onClick={() => toggleShowAllRows("E")}
                                    className="text-[#16569e] text-xs"
                                    data-testid="button-toggle-spares"
                                  >
                                    {showAllRows.has("E") ? `Show Less` : `View More (${componentSpares.length - PREVIEW_ROW_LIMIT} more)`}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Section F: Drawings & Manuals - EXACT REPLICA */}
                      {section.id === "F" && (
                        <div>
                          {!isEditMode ? (
                            <div className="text-sm text-gray-500">
                              Documents will be available after component is created
                            </div>
                          ) : isLoadingDocs ? (
                            <div className="text-sm text-gray-500">Loading documents...</div>
                          ) : documents.length === 0 ? (
                            <div className="text-center py-8">
                              <div className="text-gray-400 text-sm">
                                No drawings or manuals available for this component
                              </div>
                              <AdminOnly>
                                <p className="text-xs text-gray-500 mt-2">
                                  Upload technical documents using object storage integration
                                </p>
                              </AdminOnly>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between mb-4">
                                <div className="text-sm text-gray-600">
                                  <span className="font-semibold">{documents.filter(doc => canViewDocument(doc)).length}</span> document(s) available
                                </div>
                                <AdminOnly>
                                  <Button size="sm" variant="outline" className="text-xs" data-testid="button-upload-document">
                                    <Upload className="h-3 w-3 mr-1" />
                                    Upload Document
                                  </Button>
                                </AdminOnly>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                {getPreviewData(documents.filter(doc => canViewDocument(doc)), "F").map((doc, index) => {
                                  const IconComponent = getFileTypeIcon(doc.fileType);
                                  const hasDownloadAccess = canDownloadDocument(doc);

                                  return (
                                    <div
                                      key={index}
                                      className={`flex items-center gap-3 p-3 rounded-md border ${
                                        hasDownloadAccess
                                          ? 'hover:bg-blue-50 cursor-pointer border-gray-200'
                                          : 'border-gray-200 opacity-75'
                                      }`}
                                    >
                                      <IconComponent className="h-5 w-5 text-blue-600" />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-900 truncate">{doc.fileName}</div>
                                        <div className="text-xs text-gray-500">{doc.fileType}</div>
                                      </div>
                                      {hasDownloadAccess ? (
                                        <Download className="h-4 w-4 text-gray-400" />
                                      ) : (
                                        <Lock className="h-4 w-4 text-gray-400" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              {documents.filter(doc => canViewDocument(doc)).length > PREVIEW_ROW_LIMIT && (
                                <div className="text-center mt-2">
                                  <Button
                                    variant="link"
                                    size="sm"
                                    onClick={() => toggleShowAllRows("F")}
                                    className="text-[#16569e] text-xs"
                                    data-testid="button-toggle-documents"
                                  >
                                    {showAllRows.has("F") ? `Show Less` : `View More (${documents.filter(doc => canViewDocument(doc)).length - PREVIEW_ROW_LIMIT} more)`}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Section G: Classification & Regulatory Data - EXACT REPLICA */}
                      {section.id === "G" && (
                        <div>
                          {!isEditMode ? (
                            <div className="text-sm text-gray-500">
                              Classification data will be available after component is created
                            </div>
                          ) : isLoadingClassReg ? (
                            <div className="text-sm text-gray-500">Loading classification & regulatory data...</div>
                          ) : classRegData.length === 0 ? (
                            <div className="text-center py-8">
                              <div className="text-gray-400 text-sm">
                                No classification & regulatory data found for this component
                              </div>
                              <AdminOnly>
                                <p className="text-xs text-gray-500 mt-2">
                                  Add survey records to track classification society requirements
                                </p>
                              </AdminOnly>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between mb-4">
                                <div className="text-sm text-gray-600">
                                  <span className="font-semibold">{classRegData.length}</span> survey record(s)
                                </div>
                                <AdminOnly>
                                  <Button size="sm" variant="outline" className="text-xs" data-testid="button-add-survey">
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add Survey
                                  </Button>
                                </AdminOnly>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-gray-200">
                                      <th className="text-left py-2 px-3 font-medium text-gray-600">Classification Society</th>
                                      <th className="text-left py-2 px-3 font-medium text-gray-600">Survey Type</th>
                                      <th className="text-left py-2 px-3 font-medium text-gray-600">Certificate No.</th>
                                      <th className="text-left py-2 px-3 font-medium text-gray-600">Last Survey</th>
                                      <th className="text-left py-2 px-3 font-medium text-gray-600">Next Due</th>
                                      <th className="text-left py-2 px-3 font-medium text-gray-600">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {getPreviewData(classRegData, "G").map((item, index) => (
                                      <tr key={index} className="border-b border-gray-100">
                                        <td className="py-3 px-3 text-gray-900">{item.classificationSociety}</td>
                                        <td className="py-3 px-3 text-gray-900">{item.surveyType}</td>
                                        <td className="py-3 px-3 text-gray-900">{item.certificateNo}</td>
                                        <td className="py-3 px-3 text-gray-900">{item.lastSurveyDate}</td>
                                        <td className="py-3 px-3 text-gray-900">{item.nextDueDate}</td>
                                        <td className="py-3 px-3">
                                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            item.status === "Valid" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                          }`}>
                                            {item.status}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {classRegData.length > PREVIEW_ROW_LIMIT && (
                                  <div className="text-center mt-2">
                                    <Button
                                      variant="link"
                                      size="sm"
                                      onClick={() => toggleShowAllRows("G")}
                                      className="text-[#16569e] text-xs"
                                      data-testid="button-toggle-classreg"
                                    >
                                      {showAllRows.has("G") ? `Show Less` : `View More (${classRegData.length - PREVIEW_ROW_LIMIT} more)`}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Section H: Requisitions */}
                      {section.id === "H" && (
                        <div>
                          {!isEditMode ? (
                            <div className="text-sm text-gray-500">
                              Requisitions will be available after component is created
                            </div>
                          ) : isLoadingRequisitions ? (
                            <div className="text-sm text-gray-500">Loading requisitions...</div>
                          ) : requisitions.length === 0 ? (
                            <div className="text-center py-8">
                              <div className="text-gray-400 text-sm">
                                No requisitions found for this component
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                Requisitions for spares and services will appear here
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between mb-4">
                                <div className="text-sm text-gray-600">
                                  <span className="font-semibold">{requisitions.length}</span> requisition(s)
                                </div>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-gray-200">
                                      <th className="text-left py-2 px-3 font-medium text-gray-600">Req. No</th>
                                      <th className="text-left py-2 px-3 font-medium text-gray-600">Item/Service</th>
                                      <th className="text-left py-2 px-3 font-medium text-gray-600">Qty</th>
                                      <th className="text-left py-2 px-3 font-medium text-gray-600">Raised On</th>
                                      <th className="text-left py-2 px-3 font-medium text-gray-600">Priority</th>
                                      <th className="text-left py-2 px-3 font-medium text-gray-600">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {getPreviewData(requisitions, "H").map((req, index) => (
                                      <tr key={index} className="border-b border-gray-100">
                                        <td className="py-3 px-3 text-gray-900 font-medium">{req.requisitionNo}</td>
                                        <td className="py-3 px-3 text-gray-900">{req.itemOrService}</td>
                                        <td className="py-3 px-3 text-gray-900">{req.quantity} {req.uom}</td>
                                        <td className="py-3 px-3 text-gray-900">{req.raisedOn}</td>
                                        <td className="py-3 px-3">
                                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            req.priority === "Urgent" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"
                                          }`}>
                                            {req.priority}
                                          </span>
                                        </td>
                                        <td className="py-3 px-3">
                                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            req.status === "Delivered On Board" ? "bg-green-100 text-green-800" :
                                            req.status === "PO Raised" ? "bg-blue-100 text-blue-800" :
                                            req.status === "Draft" ? "bg-gray-100 text-gray-800" :
                                            "bg-yellow-100 text-yellow-800"
                                          }`}>
                                            {req.status}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {requisitions.length > PREVIEW_ROW_LIMIT && (
                                  <div className="text-center mt-2">
                                    <Button
                                      variant="link"
                                      size="sm"
                                      onClick={() => toggleShowAllRows("H")}
                                      className="text-[#16569e] text-xs"
                                      data-testid="button-toggle-requisitions"
                                    >
                                      {showAllRows.has("H") ? `Show Less` : `View More (${requisitions.length - PREVIEW_ROW_LIMIT} more)`}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
          )}
        </div>

        <div className="border-t px-6 py-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90"
            data-testid="button-save"
          >
            {isSaving ? "Saving..." : isEditMode ? "Update Component" : "Create Component"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditComponentForm;
