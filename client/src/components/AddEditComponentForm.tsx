import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChevronRight, ChevronDown, Package, FileText, FileImage, FileCheck, File, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useVessel } from "@/contexts/VesselContext";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertComponentSchema, type InsertComponent } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getComponentCategory } from "@/utils/componentUtils";
import { useAuth } from "@/contexts/AuthContext";
import { AdminOnly } from "@/components/RoleGuard";
import { FEATURES } from '@/config/features';

interface AddEditComponentFormProps {
  isOpen: boolean;
  onClose: () => void;
  componentId?: string | null; // If provided, edit mode; otherwise add mode
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

  const isEditMode = !!componentId;

  // Fetch existing component data if in edit mode
  const { data: existingComponent, isLoading: isLoadingComponent } = useQuery<any>({
    queryKey: ['/api/components', componentId],
    enabled: isEditMode && !!componentId,
  });

  // Fetch related data for sections B-H (only in edit mode)
  const { data: runningHoursAudit = [] } = useQuery<any[]>({
    queryKey: ['/api/running-hours-audit', componentId],
    enabled: isEditMode && !!componentId,
  });

  const { data: allJobs = [] } = useQuery<any[]>({
    queryKey: ['/api/jobs'],
    enabled: isEditMode,
  });

  const { data: maintenanceHistory = [] } = useQuery<any[]>({
    queryKey: ['/api/component-maintenance-history', componentId],
    enabled: isEditMode && !!componentId,
  });

  const { data: allSpares = [] } = useQuery<any[]>({
    queryKey: ['/api/spares'],
    enabled: isEditMode,
  });

  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ['/api/component-documents', componentId],
    enabled: isEditMode && !!componentId,
  });

  const { data: classRegData = [] } = useQuery<any[]>({
    queryKey: ['/api/component-class-regulatory', componentId],
    enabled: isEditMode && !!componentId,
  });

  const { data: allComponents = [] } = useQuery<any[]>({
    queryKey: ['/api/components'],
    enabled: isEditMode,
  });

  // Filter jobs for this component and its children
  const componentJobs = isEditMode && existingComponent
    ? allJobs.filter(job => {
        const getAllChildCodes = (parentCode: string): string[] => {
          const children = allComponents.filter(c => c.parentId === parentCode);
          const childCodes = children.map(c => c.componentCode);
          const descendantCodes = children.flatMap(c => getAllChildCodes(c.componentCode));
          return [...childCodes, ...descendantCodes];
        };
        const relevantCodes = [existingComponent.componentCode, ...getAllChildCodes(existingComponent.componentCode)];
        return relevantCodes.includes(job.componentCode);
      })
    : [];

  // Filter spares for this component
  const componentSpares = isEditMode && componentId
    ? allSpares.filter(s => s.componentId === componentId)
    : [];

  // Helper to normalize boolean/string to "Yes"/"No"/""
  const toBoolString = (val: any) => {
    if (val === true || (typeof val === 'string' && val.toLowerCase() === 'yes')) return "Yes";
    if (val === false || (typeof val === 'string' && val.toLowerCase() === 'no')) return "No";
    return "";
  };

  // Form schema with validation
  const form = useForm<any>({
    resolver: zodResolver(insertComponentSchema.partial()),
    defaultValues: {
      fleetEquipmentCode: "",
      fleetEquipmentName: "",
      parentId: parentComponent?.code || "",
      componentCode: "",
      name: "",
      componentCategory: "",
      maker: "",
      makerCode: "",
      model: "",
      modelCode: "",
      serialNo: "",
      drawingNo: "",
      location: "",
      critical: false,
      conditionBased: false,
      installationDate: "",
      commissionedDate: "",
      rating: "",
      eqptSystemDept: "",
      notes: "",
      runningHours: "0",
      isActive: true,
      vesselCode: "",
      isParent: false,
      vesselId: vesselId || "V001",
    },
  });

  // Populate form in edit mode
  useEffect(() => {
    if (isEditMode && existingComponent && !isLoadingComponent) {
      form.reset({
        fleetEquipmentCode: existingComponent.fleetEquipmentCode || "",
        fleetEquipmentName: existingComponent.fleetEquipmentName || "",
        parentId: existingComponent.parentId || "",
        componentCode: existingComponent.componentCode || "",
        name: existingComponent.name || "",
        componentCategory: existingComponent.componentCategory || getComponentCategory(existingComponent.id),
        maker: existingComponent.maker || "",
        makerCode: existingComponent.makerCode || "",
        model: existingComponent.model || "",
        modelCode: existingComponent.modelCode || "",
        serialNo: existingComponent.serialNo || "",
        drawingNo: existingComponent.drawingNo || "",
        location: existingComponent.location || "",
        critical: existingComponent.critical || false,
        conditionBased: existingComponent.conditionBased || false,
        installationDate: existingComponent.installationDate || "",
        commissionedDate: existingComponent.commissionedDate || "",
        rating: existingComponent.rating || "",
        eqptSystemDept: existingComponent.eqptSystemDept || existingComponent.deptCategory || "",
        notes: existingComponent.notes || "",
        runningHours: existingComponent.runningHours?.toString() || existingComponent.currentCumulativeRH?.toString() || "0",
        isActive: existingComponent.isActive ?? true,
        vesselCode: existingComponent.vesselCode || "",
        isParent: existingComponent.isParent || false,
        vesselId: existingComponent.vesselId || vesselId || "V001",
      });
    }
  }, [existingComponent, isLoadingComponent, isEditMode, vesselId]);

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEditMode && componentId) {
        return apiRequest('PATCH', `/api/components/${componentId}`, data);
      } else {
        return apiRequest('POST', '/api/components', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/components'] });
      toast({
        title: isEditMode ? "Component Updated" : "Component Created",
        description: isEditMode
          ? "Component has been updated successfully."
          : "New component has been created successfully.",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save component",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    saveMutation.mutate(data);
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
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-4" style={{ maxHeight: "calc(90vh - 140px)" }}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      {/* Section A: Component Information */}
                      {section.id === "A" && (
                        <div className="space-y-4">
                          {/* Row 1: Fleet Equipment Code, Fleet Equipment Name, Parent Component Code, Component Code */}
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <Label className="text-xs font-medium text-gray-600 block mb-1">Fleet Equipment Code</Label>
                              <Controller
                                name="fleetEquipmentCode"
                                control={form.control}
                                render={({ field }) => (
                                  <Input
                                    {...field}
                                    className="text-sm"
                                    data-testid="input-fleet-equipment-code"
                                  />
                                )}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600 block mb-1">Fleet Equipment Name</Label>
                              <Controller
                                name="fleetEquipmentName"
                                control={form.control}
                                render={({ field }) => (
                                  <Input
                                    {...field}
                                    className="text-sm"
                                    data-testid="input-fleet-equipment-name"
                                  />
                                )}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600 block mb-1">Parent Component Code</Label>
                              <Controller
                                name="parentId"
                                control={form.control}
                                render={({ field }) => (
                                  <Input
                                    {...field}
                                    className="text-sm"
                                    data-testid="input-parent-component-code"
                                    disabled={!!parentComponent}
                                  />
                                )}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600 block mb-1">Component Code</Label>
                              <Controller
                                name="componentCode"
                                control={form.control}
                                render={({ field }) => (
                                  <Input
                                    {...field}
                                    className="text-sm"
                                    data-testid="input-component-code"
                                    disabled={isEditMode}
                                  />
                                )}
                              />
                            </div>
                          </div>

                          {/* Row 2: Component Name, Component Category, Maker, Maker Code */}
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <Label className="text-xs font-medium text-gray-600 block mb-1">Component Name</Label>
                              <Controller
                                name="name"
                                control={form.control}
                                render={({ field }) => (
                                  <Input
                                    {...field}
                                    className="text-sm"
                                    data-testid="input-component-name"
                                  />
                                )}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600 block mb-1">Component Category</Label>
                              <Controller
                                name="componentCategory"
                                control={form.control}
                                render={({ field }) => (
                                  <Input
                                    {...field}
                                    className="text-sm"
                                    data-testid="input-component-category"
                                    disabled
                                  />
                                )}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600 block mb-1">Maker</Label>
                              <Controller
                                name="maker"
                                control={form.control}
                                render={({ field }) => (
                                  <Input
                                    {...field}
                                    className="text-sm"
                                    data-testid="input-maker"
                                  />
                                )}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600 block mb-1">Maker Code</Label>
                              <Controller
                                name="makerCode"
                                control={form.control}
                                render={({ field }) => (
                                  <Input
                                    {...field}
                                    className="text-sm"
                                    data-testid="input-maker-code"
                                  />
                                )}
                              />
                            </div>
                          </div>

                          {/* Row 3: Model, Model Code, Serial No, Drawing No */}
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <Label className="text-xs font-medium text-gray-600 block mb-1">Model</Label>
                              <Controller
                                name="model"
                                control={form.control}
                                render={({ field }) => (
                                  <Input
                                    {...field}
                                    className="text-sm"
                                    data-testid="input-model"
                                  />
                                )}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600 block mb-1">Model Code</Label>
                              <Controller
                                name="modelCode"
                                control={form.control}
                                render={({ field }) => (
                                  <Input
                                    {...field}
                                    className="text-sm"
                                    data-testid="input-model-code"
                                  />
                                )}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600 block mb-1">Serial No</Label>
                              <Controller
                                name="serialNo"
                                control={form.control}
                                render={({ field }) => (
                                  <Input
                                    {...field}
                                    className="text-sm"
                                    data-testid="input-serial-no"
                                  />
                                )}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600 block mb-1">Drawing No</Label>
                              <Controller
                                name="drawingNo"
                                control={form.control}
                                render={({ field }) => (
                                  <Input
                                    {...field}
                                    className="text-sm"
                                    data-testid="input-drawing-no"
                                  />
                                )}
                              />
                            </div>
                          </div>

                          {/* Row 4: Location, Critical (Yes/No), Condition Based (Yes/No), Installation Date */}
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <Label className="text-xs font-medium text-gray-600 block mb-1">Location</Label>
                              <Controller
                                name="location"
                                control={form.control}
                                render={({ field }) => (
                                  <Input
                                    {...field}
                                    className="text-sm"
                                    data-testid="input-location"
                                  />
                                )}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600 block mb-1">Critical</Label>
                              <Controller
                                name="critical"
                                control={form.control}
                                render={({ field }) => (
                                  <Select
                                    value={field.value ? "Yes" : "No"}
                                    onValueChange={(val) => field.onChange(val === "Yes")}
                                  >
                                    <SelectTrigger className="text-sm" data-testid="select-critical">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Yes">Yes</SelectItem>
                                      <SelectItem value="No">No</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600 block mb-1">Condition Based</Label>
                              <Controller
                                name="conditionBased"
                                control={form.control}
                                render={({ field }) => (
                                  <Select
                                    value={field.value ? "Yes" : "No"}
                                    onValueChange={(val) => field.onChange(val === "Yes")}
                                  >
                                    <SelectTrigger className="text-sm" data-testid="select-condition-based">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Yes">Yes</SelectItem>
                                      <SelectItem value="No">No</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600 block mb-1">Installation Date</Label>
                              <Controller
                                name="installationDate"
                                control={form.control}
                                render={({ field }) => (
                                  <Input
                                    {...field}
                                    type="date"
                                    className="text-sm"
                                    data-testid="input-installation-date"
                                  />
                                )}
                              />
                            </div>
                          </div>

                          {/* Row 5: Commissioning Date, Rating, Equip/System Department, (spacer) */}
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <Label className="text-xs font-medium text-gray-600 block mb-1">Commissioning Date</Label>
                              <Controller
                                name="commissionedDate"
                                control={form.control}
                                render={({ field }) => (
                                  <Input
                                    {...field}
                                    type="date"
                                    className="text-sm"
                                    data-testid="input-commissioned-date"
                                  />
                                )}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600 block mb-1">Rating</Label>
                              <Controller
                                name="rating"
                                control={form.control}
                                render={({ field }) => (
                                  <Input
                                    {...field}
                                    className="text-sm"
                                    data-testid="input-rating"
                                  />
                                )}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600 block mb-1">Equip/System Department</Label>
                              <Controller
                                name="eqptSystemDept"
                                control={form.control}
                                render={({ field }) => (
                                  <Input
                                    {...field}
                                    className="text-sm"
                                    data-testid="input-eqpt-system-dept"
                                  />
                                )}
                              />
                            </div>
                            <div>
                              {/* Empty spacer field */}
                            </div>
                          </div>

                          {/* Row 6: Running Hours, IS Active, Vessel Code, IS Parent */}
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <Label className="text-xs font-medium text-gray-600 block mb-1">Running Hours</Label>
                              <Controller
                                name="runningHours"
                                control={form.control}
                                render={({ field }) => (
                                  <Input
                                    {...field}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="text-sm"
                                    data-testid="input-running-hours"
                                  />
                                )}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600 block mb-1">IS Active</Label>
                              <Controller
                                name="isActive"
                                control={form.control}
                                render={({ field }) => (
                                  <Select
                                    value={field.value ? "Yes" : "No"}
                                    onValueChange={(val) => field.onChange(val === "Yes")}
                                  >
                                    <SelectTrigger className="text-sm" data-testid="select-is-active">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Yes">Yes</SelectItem>
                                      <SelectItem value="No">No</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600 block mb-1">Vessel Code</Label>
                              <Controller
                                name="vesselCode"
                                control={form.control}
                                render={({ field }) => (
                                  <Input
                                    {...field}
                                    className="text-sm"
                                    data-testid="input-vessel-code"
                                  />
                                )}
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600 block mb-1">IS Parent</Label>
                              <Controller
                                name="isParent"
                                control={form.control}
                                render={({ field }) => (
                                  <Select
                                    value={field.value ? "Yes" : "No"}
                                    onValueChange={(val) => field.onChange(val === "Yes")}
                                  >
                                    <SelectTrigger className="text-sm" data-testid="select-is-parent">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Yes">Yes</SelectItem>
                                      <SelectItem value="No">No</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            </div>
                          </div>

                          {/* Row 7: Notes (full width) */}
                          <div>
                            <Label className="text-xs font-medium text-gray-600 block mb-1">Notes</Label>
                            <Controller
                              name="notes"
                              control={form.control}
                              render={({ field }) => (
                                <Textarea
                                  {...field}
                                  className="text-sm"
                                  rows={3}
                                  data-testid="input-notes"
                                />
                              )}
                            />
                          </div>
                        </div>
                      )}

                      {/* Section B: Running Hours & Condition Monitoring */}
                      {section.id === "B" && (
                        <div className="space-y-6">
                          {isEditMode && existingComponent ? (
                            <>
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <label className="text-sm font-medium text-gray-700">Running Hours:</label>
                                </div>
                                <div className="flex gap-12 pl-2">
                                  <div>
                                    <label className="text-xs font-medium text-gray-600 block mb-1">Current</label>
                                    <div className="text-sm text-gray-900">{existingComponent.currentCumulativeRH || "0.00"}</div>
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-gray-600 block mb-1">Updated</label>
                                    <div className="text-sm text-gray-900">
                                      {existingComponent.lastUpdated || runningHoursAudit[0]?.dateUpdatedLocal || "-"}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Condition Based Monitoring:</label>
                                <div className="text-sm text-gray-600 italic">
                                  Use the Running Hours module to update running hours for this component
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="text-center py-8">
                              <div className="text-gray-400 text-sm">
                                Running hours data will be available after component is created
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Section C: Jobs */}
                      {section.id === "C" && (
                        <div>
                          {isEditMode && componentJobs.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-200">
                                    <th className="text-left py-2 px-3 font-medium text-gray-600">Job No</th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-600">Job Title</th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-600">Type</th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-600">Basis</th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-600">Frequency</th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-600">Last Done</th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-600">Next Due</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {componentJobs.map((job, index) => (
                                    <tr key={index} className="border-b border-gray-100">
                                      <td className="py-3 px-3 text-gray-900">{job.jobNo}</td>
                                      <td className="py-3 px-3 text-gray-900">{job.jobTitle}</td>
                                      <td className="py-3 px-3 text-gray-900">{job.taskType}</td>
                                      <td className="py-3 px-3 text-gray-900">{job.maintenanceBasis}</td>
                                      <td className="py-3 px-3 text-gray-900">
                                        {job.frequencyValue} {job.frequencyUnit}
                                      </td>
                                      <td className="py-3 px-3 text-gray-900">{job.lastDoneDate || "-"}</td>
                                      <td className="py-3 px-3 text-gray-900">{job.nextDueDate || job.nextDueRH || "-"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <div className="text-gray-400 text-sm">
                                {isEditMode ? "No jobs associated with this component" : "Jobs will be available after component is created"}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Section D: Maintenance History */}
                      {section.id === "D" && (
                        <div>
                          {isEditMode && maintenanceHistory.length > 0 ? (
                            <div className="overflow-x-auto">
                              <div className="flex items-center justify-between mb-4">
                                <div className="text-sm text-gray-600">
                                  <span className="font-semibold">{maintenanceHistory.length}</span> maintenance record(s) found
                                </div>
                                <div className="text-xs text-gray-500 italic">
                                  ⚠️ Records are immutable and cannot be edited or deleted
                                </div>
                              </div>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                                    <th className="text-left py-3 px-3 font-semibold text-gray-700">WO No</th>
                                    <th className="text-left py-3 px-3 font-semibold text-gray-700">Job Title</th>
                                    <th className="text-left py-3 px-3 font-semibold text-gray-700">Type</th>
                                    <th className="text-left py-3 px-3 font-semibold text-gray-700">Date Completed</th>
                                    <th className="text-left py-3 px-3 font-semibold text-gray-700">Running Hours</th>
                                    <th className="text-left py-3 px-3 font-semibold text-gray-700">Performed By</th>
                                    <th className="text-left py-3 px-3 font-semibold text-gray-700">Approved By</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {maintenanceHistory.map((record, index) => (
                                    <tr key={index} className="border-b border-gray-100">
                                      <td className="py-3 px-3 text-gray-900">{record.woNo}</td>
                                      <td className="py-3 px-3 text-gray-900">{record.jobTitle}</td>
                                      <td className="py-3 px-3 text-gray-900">{record.maintenanceType}</td>
                                      <td className="py-3 px-3 text-gray-900">{record.dateCompleted}</td>
                                      <td className="py-3 px-3 text-gray-900">{record.runningHoursAtCompletion || "-"}</td>
                                      <td className="py-3 px-3 text-gray-900">{record.performedBy}</td>
                                      <td className="py-3 px-3 text-gray-900">{record.approvedBy}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <div className="text-gray-400 text-sm">
                                {isEditMode ? "No maintenance history records found for this component" : "Maintenance history will be available after component is created"}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Section E: Spares */}
                      {section.id === "E" && (
                        <div>
                          {isEditMode && componentSpares.length > 0 ? (
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
                                  </tr>
                                </thead>
                                <tbody>
                                  {componentSpares.map((spare, index) => (
                                    <tr key={index} className="border-b border-gray-100">
                                      <td className="py-3 px-3 text-gray-900">{spare.partCode}</td>
                                      <td className="py-3 px-3 text-gray-900">{spare.partName}</td>
                                      <td className="py-3 px-3 text-gray-900">{spare.critical ? "Yes" : "No"}</td>
                                      <td className="py-3 px-3 text-gray-900">{spare.rob}</td>
                                      <td className="py-3 px-3 text-gray-900">{spare.min}</td>
                                      <td className="py-3 px-3 text-gray-900">{spare.stock}</td>
                                      <td className="py-3 px-3 text-gray-900">{spare.location}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <div className="text-gray-400 text-sm">
                                {isEditMode ? "No spare parts linked to this component" : "Spares data will be available after component is created"}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Section F: Drawings & Manuals */}
                      {section.id === "F" && (
                        <div>
                          {isEditMode && documents.length > 0 ? (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between mb-4">
                                <div className="text-sm text-gray-600">
                                  <span className="font-semibold">{documents.length}</span> document(s) available
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                {documents.filter(doc => canViewDocument(doc)).map((doc, index) => {
                                  const IconComponent = getFileTypeIcon(doc.fileType);
                                  return (
                                    <div
                                      key={index}
                                      className="flex items-center gap-3 p-3 rounded-md border border-gray-200"
                                    >
                                      <IconComponent className="h-5 w-5 text-blue-600" />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-900 truncate">{doc.fileName}</div>
                                        <div className="text-xs text-gray-500">{doc.fileType}</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <div className="text-gray-400 text-sm">
                                {isEditMode ? "No drawings or manuals available for this component" : "Documents will be available after component is created"}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Section G: Classification & Regulatory Data */}
                      {section.id === "G" && (
                        <div>
                          {isEditMode && classRegData.length > 0 ? (
                            <div className="overflow-x-auto">
                              <div className="flex items-center justify-between mb-4">
                                <div className="text-sm text-gray-600">
                                  <span className="font-semibold">{classRegData.length}</span> survey record(s)
                                </div>
                              </div>
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
                                  {classRegData.map((item, index) => (
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
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <div className="text-gray-400 text-sm">
                                {isEditMode ? "No classification & regulatory data found for this component" : "Classification data will be available after component is created"}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Section H: Requisitions */}
                      {section.id === "H" && (
                        <div className="text-center py-8">
                          <div className="text-gray-400 text-sm">
                            Requisitions section - future enhancement
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Will display component-related purchase and service requisitions
                          </p>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </form>
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
            type="submit"
            onClick={form.handleSubmit(onSubmit)}
            disabled={saveMutation.isPending}
            className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90"
            data-testid="button-save"
          >
            {saveMutation.isPending ? "Saving..." : isEditMode ? "Update Component" : "Create Component"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditComponentForm;
