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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChevronRight, ChevronDown, Plus, Edit2, FileText, FileImage, FileCheck, File, Upload, Download, Lock, HelpCircle, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useVessel } from "@/contexts/VesselContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getComponentCategory } from "@/utils/componentUtils";
import { useAuth } from "@/contexts/AuthContext";
import { AdminOnly } from "@/components/RoleGuard";
import { FEATURES } from '@/config/features';
import { formatProfessionalDate } from "@/lib/dateUtils";

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
    // Section B: Running Hours & Condition Monitoring
    rhCounterType: "NONE",
    rhCounterSource: "",
    lastUpdated: "",
  });

  // Show loading state while fetching data in edit mode
  const [isDataLoaded, setIsDataLoaded] = useState(!isEditMode);

  // Fetch existing component data if in edit mode
  const { data: existingComponent, isLoading: isLoadingComponent } = useQuery<any>({
    queryKey: ['/api/components', componentId],
    enabled: isEditMode && !!componentId,
  });

  // Fetch related data for sections B-H (only in edit mode)
  // Filter jobs by vesselId at the database level
  const { data: allJobs = [], isLoading: isLoadingJobs } = useQuery<any[]>({
    queryKey: [`/api/jobs?vesselId=${vesselId}`],
    enabled: isEditMode && !!vesselId,
  });

  const { data: maintenanceHistory = [], isLoading: isLoadingHistory } = useQuery<any[]>({
    queryKey: [`/api/component-maintenance-history/${componentId}`],
    enabled: isEditMode && !!componentId,
  });

  const { data: allSpares = [] } = useQuery<any[]>({
    queryKey: ['/api/spares'],
    enabled: isEditMode,
  });

  const { data: documents = [], isLoading: isLoadingDocs } = useQuery<any[]>({
    queryKey: [`/api/component-documents/${componentId}`],
    enabled: isEditMode && !!componentId,
  });

  const { data: classRegData = [], isLoading: isLoadingClassReg } = useQuery<any[]>({
    queryKey: [`/api/component-class-regulatory/${componentId}`],
    enabled: isEditMode && !!componentId,
  });

  const { data: requisitions = [], isLoading: isLoadingRequisitions } = useQuery<any[]>({
    queryKey: [`/api/component-requisitions/${componentId}`],
    enabled: isEditMode && !!componentId,
  });

  const { data: allComponents = [] } = useQuery<any[]>({
    queryKey: ['/api/components'],
    enabled: isEditMode,
  });

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
    queryKey: [`/api/components/details/${rhMasterComponentId}`],
    enabled: isEditMode && rhCounterType === 'INHERITED' && !!rhMasterComponentId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch parent component for INHERITED type
  const { data: rhParentComponent } = useQuery<any>({
    queryKey: [`/api/components/details/${parentId}`],
    enabled: isEditMode && rhCounterType === 'INHERITED' && !!parentId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch running hours data for accurate timestamps (for MASTER type)
  const { data: runningHoursData = [] } = useQuery<any[]>({
    queryKey: [`/api/running-hours/${componentId}`],
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

  // Populate form in edit mode
  useEffect(() => {
    if (isEditMode && existingComponent && !isLoadingComponent) {
      setComponentData({
        fleetEquipmentCode: existingComponent.fleetEquipmentCode || "",
        fleetEquipmentName: existingComponent.fleetEquipmentName || "",
        parentComponent: existingComponent.parentId || "",
        componentCode: existingComponent.componentCode || "",
        componentName: existingComponent.name || "",
        componentCategory: existingComponent.componentCategory || getComponentCategory(existingComponent.componentCode || existingComponent.id),
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
        // Section B: Running Hours & Condition Monitoring
        rhCounterType: existingComponent.rhCounterType || "NONE",
        rhCounterSource: existingComponent.rhCounterSource || "",
        lastUpdated: existingComponent.lastUpdated || existingComponent.rhLastUpdated || "",
      });
      setIsDataLoaded(true);
    } else if (!isEditMode && parentComponent) {
      setComponentData(prev => ({
        ...prev,
        parentComponent: parentComponent.code,
        componentCategory: getComponentCategory(parentComponent.code),
        vesselCode: vesselId || "",
      }));
      setIsDataLoaded(true);
    } else if (!isEditMode) {
      setIsDataLoaded(true);
    }
  }, [existingComponent, isLoadingComponent, isEditMode, parentComponent, vesselId]);

  // Auto-update componentCategory when componentCode changes
  useEffect(() => {
    if (componentData.componentCode) {
      const derivedCategory = getComponentCategory(componentData.componentCode);
      if (derivedCategory && derivedCategory !== componentData.componentCategory) {
        setComponentData(prev => ({ ...prev, componentCategory: derivedCategory }));
      }
    }
  }, [componentData.componentCode]);

  const handleFieldChange = (fieldName: string, value: string) => {
    setComponentData(prev => ({ ...prev, [fieldName]: value }));
  };

  // Convert Yes/No strings to boolean
  const toBool = (val: string) => val === "Yes";

  const handleSave = async () => {
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
        vesselId: vesselId || "V001",
      };

      if (isEditMode && componentId) {
        await apiRequest('PATCH', `/api/components/${componentId}`, payload);
        toast({
          title: "Component Updated",
          description: "Component has been updated successfully.",
        });
      } else {
        await apiRequest('POST', '/api/components', payload);
        toast({
          title: "Component Created",
          description: "New component has been created successfully.",
        });
      }

      // Invalidate all component-related queries to force fresh data fetch
      console.log('🔄 Invalidating component queries after save, vesselId:', vesselId);
      await queryClient.invalidateQueries({ queryKey: ['/api/components'] });
      
      // Also invalidate the vessel-specific query
      const currentVesselId = vesselId || 'V001';
      await queryClient.invalidateQueries({ 
        queryKey: [`/api/components/${currentVesselId}`] 
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
                              <label className="text-xs font-medium text-gray-600 block mb-1">Parent Component Code</label>
                              <input
                                type="text"
                                value={componentData.parentComponent}
                                onChange={(e) => handleFieldChange('parentComponent', e.target.value)}
                                className="text-sm w-full px-2 py-1 border rounded text-[#52BAF3] border-[#52BAF3]"
                                data-testid="input-parent-component-code"
                                disabled={!!parentComponent}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Component Code</label>
                              {isEditMode ? (
                                <div className="text-sm text-gray-900" data-testid="text-component-code">
                                  {componentData.componentCode}
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  value={componentData.componentCode}
                                  onChange={(e) => handleFieldChange('componentCode', e.target.value)}
                                  className="text-sm w-full px-2 py-1 border rounded text-[#52BAF3] border-[#52BAF3]"
                                  data-testid="input-component-code"
                                />
                              )}
                            </div>
                          </div>

                          {/* Row 2: Component Name, Component Category, Maker, Maker Code */}
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Component Name</label>
                              <input
                                type="text"
                                value={componentData.componentName}
                                onChange={(e) => handleFieldChange('componentName', e.target.value)}
                                className="text-sm w-full px-2 py-1 border rounded text-[#52BAF3] border-[#52BAF3]"
                                data-testid="input-component-name"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Component Category</label>
                              <input
                                type="text"
                                value={componentData.componentCategory}
                                readOnly
                                className="text-sm w-full px-2 py-1 border rounded bg-gray-50 text-gray-700 border-gray-300 cursor-not-allowed"
                                data-testid="input-component-category"
                                title="Auto-populated based on component group (1-8)"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Maker</label>
                              <input
                                type="text"
                                value={componentData.maker}
                                onChange={(e) => handleFieldChange('maker', e.target.value)}
                                className="text-sm w-full px-2 py-1 border rounded text-[#52BAF3] border-[#52BAF3]"
                                data-testid="input-maker"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Maker Code</label>
                              <input
                                type="text"
                                value={componentData.makerCode}
                                onChange={(e) => handleFieldChange('makerCode', e.target.value)}
                                className="text-sm w-full px-2 py-1 border rounded text-[#52BAF3] border-[#52BAF3]"
                                data-testid="input-maker-code"
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
                              <label className="text-xs font-medium text-gray-600 block mb-1">Equipment / System Department</label>
                              <select
                                value={componentData.eqptSystemDept}
                                onChange={(e) => handleFieldChange('eqptSystemDept', e.target.value)}
                                className="text-sm w-full px-2 py-1 border rounded text-[#52BAF3] border-[#52BAF3]"
                                data-testid="select-eqpt-system-dept"
                              >
                                <option value="">Select Department</option>
                                <option value="Deck">Deck</option>
                                <option value="Engine">Engine</option>
                                <option value="Electrical">Electrical</option>
                              </select>
                            </div>
                            <div>
                              {/* Empty spacer field */}
                            </div>
                          </div>

                          {/* Row 6: IS Active, Vessel Code, IS Parent */}
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              {/* Empty spacer field */}
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">IS Active</label>
                              <select
                                value={componentData.isActive}
                                onChange={(e) => handleFieldChange('isActive', e.target.value)}
                                className="text-sm w-full px-2 py-1 border rounded text-[#52BAF3] border-[#52BAF3]"
                                data-testid="select-is-active"
                              >
                                <option value="">Select</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                              </select>
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

                      {/* Section B: Running Hours & Condition Monitoring - Teal Header with Editable Controls */}
                      {section.id === "B" && (
                        <div className="space-y-4">
                          {/* Running Hours Table with 4 columns - Editable Controls */}
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse" data-testid="table-running-hours">
                              <thead>
                                <tr className="bg-teal-500 text-white">
                                  <th className="px-4 py-2 text-left text-xs font-semibold border border-teal-600">RH Counter Type</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold border border-teal-600">RH Counter Source</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold border border-teal-600">Running Hours</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold border border-teal-600">Last Updated</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="bg-white">
                                  <td className="px-4 py-3 border border-gray-200">
                                    <select
                                      value={componentData.rhCounterType || 'NONE'}
                                      onChange={(e) => handleFieldChange('rhCounterType', e.target.value)}
                                      className="h-8 w-full text-sm px-2 border rounded border-gray-200"
                                      data-testid="select-rh-counter-type"
                                    >
                                      <option value="NONE">None</option>
                                      <option value="MASTER">Master</option>
                                      <option value="INHERITED">Inherited</option>
                                    </select>
                                  </td>
                                  <td className="px-4 py-3 border border-gray-200">
                                    <input
                                      type="text"
                                      value={componentData.rhCounterSource || '—'}
                                      readOnly
                                      className="h-8 w-full text-sm px-2 border rounded border-gray-200 bg-gray-50"
                                      data-testid="input-rh-counter-source"
                                    />
                                  </td>
                                  <td className="px-4 py-3 border border-gray-200">
                                    <input
                                      type="text"
                                      value={componentData.runningHours || ''}
                                      onChange={(e) => handleFieldChange('runningHours', e.target.value)}
                                      className="h-8 w-full text-sm px-2 border rounded border-gray-200"
                                      placeholder=""
                                      data-testid="input-running-hours-b"
                                    />
                                  </td>
                                  <td className="px-4 py-3 border border-gray-200">
                                    <input
                                      type="date"
                                      value={componentData.lastUpdated || ''}
                                      onChange={(e) => handleFieldChange('lastUpdated', e.target.value)}
                                      className="h-8 w-full text-sm px-2 border rounded border-gray-200"
                                      data-testid="input-last-updated"
                                    />
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Section C: Jobs - EXACT REPLICA */}
                      {section.id === "C" && (
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
                                </tr>
                              </thead>
                              <tbody>
                                {isLoadingJobs ? (
                                  <tr>
                                    <td colSpan={6} className="py-8 text-center text-gray-500">
                                      Loading jobs...
                                    </td>
                                  </tr>
                                ) : !isEditMode ? (
                                  <tr>
                                    <td colSpan={6} className="py-8 text-center text-gray-500">
                                      Jobs will be available after component is created
                                    </td>
                                  </tr>
                                ) : componentJobs.length === 0 ? (
                                  <tr>
                                    <td colSpan={6} className="py-8 text-center text-gray-500">
                                      No jobs found for this component
                                    </td>
                                  </tr>
                                ) : (
                                  getPreviewData(componentJobs, "C").map((job, index) => (
                                    <tr
                                      key={index}
                                      className="border-b border-gray-100 hover:bg-gray-50"
                                      data-testid={`job-row-${job.jobNo}`}
                                    >
                                      <td className="py-3 px-3 text-gray-900">{job.jobNo}</td>
                                      <td className="py-3 px-3 text-gray-900">{job.jobTitle}</td>
                                      <td className="py-3 px-3 text-gray-900">{job.maintenanceType}</td>
                                      <td className="py-3 px-3 text-gray-900">{job.frequencyValue} {job.frequencyUnit}</td>
                                      <td className="py-3 px-3 text-gray-900">{formatProfessionalDate(job.lastDoneDate) || '-'}</td>
                                      <td className="py-3 px-3 text-gray-900">{formatProfessionalDate(job.nextDueDate) || '-'}</td>
                                    </tr>
                                  ))
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
                        </>
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
