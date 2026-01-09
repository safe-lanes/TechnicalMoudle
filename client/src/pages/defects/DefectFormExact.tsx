import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Eye, Upload, Plus, Edit, Trash2, Calendar } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { insertDefectSchema, type InsertDefect, type Defect } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import ImmediateCauseModal from "@/components/ImmediateCauseModal";
import RootCauseModal from "@/components/RootCauseModal";
import RichTextEditor, { RichTextDisplay } from "@/components/RichTextEditor";
import { useVessels } from "@/hooks/useVessels";

// Generate defect reference number
const generateDefectRef = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `DN/${day}${month}/${year}/${random}/V`;
};

// Form validation schema
const defectFormSchema = insertDefectSchema.extend({
  vesselId: insertDefectSchema.shape.vesselId.refine(val => val && val.length > 0, "Vessel is required"),
  description: insertDefectSchema.shape.description.refine(val => val && val.length > 0, "Description is required"),
}).partial({
  category: true, // Make category optional since it defaults to "Defect"
});

type DefectFormData = typeof defectFormSchema._type;

interface Action {
  id: string;
  actionType: string;
  proposedBy: string;
  responsibility: string;
  dueDate: string;
  dateCompleted?: string;
  status: string;
}

interface DefectFormExactProps {
  onClose: () => void;
  defect?: Defect | null;
  mode?: 'view' | 'edit' | 'new';
}

export default function DefectFormExact({ onClose, defect, mode = 'new' }: DefectFormExactProps) {
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();
  const [defectRef] = useState(defect?.id || generateDefectRef());
  const [isViewMode, setIsViewMode] = useState(mode === 'view');
  const [isImmediateCauseModalOpen, setIsImmediateCauseModalOpen] = useState(false);
  const [isRootCauseModalOpen, setIsRootCauseModalOpen] = useState(false);
  const [actions, setActions] = useState<Action[]>([
    {
      id: "1",
      actionType: "Corrective Action Planned",
      proposedBy: "MASTER",
      responsibility: "Vessel Manager",
      dueDate: "29 May 2021",
      dateCompleted: "29 May 2021",
      status: "Close"
    },
    {
      id: "2", 
      actionType: "Corrective Action Planned",
      proposedBy: "MASTER",
      responsibility: "Vessel Manager", 
      dueDate: "29 May 2021",
      dateCompleted: "29 May 2021",
      status: "Close"
    }
  ]);

  const [descriptionHtml, setDescriptionHtml] = useState(defect?.descriptionHtml || defect?.description || "");
  const [descriptionText, setDescriptionText] = useState(defect?.descriptionText || defect?.description || "");

  const form = useForm<DefectFormData>({
    resolver: zodResolver(defectFormSchema),
    defaultValues: defect ? {
      id: defect.id,
      vesselId: defect.vesselId || "V001",
      vesselName: defect.vesselName || "MV SEAFARER",
      issueDate: defect.issueDate || "",
      category: defect.category || "Defect",
      defectType: defect.defectType || "",
      description: defect.description || "",
      descriptionHtml: defect.descriptionHtml || defect.description || "",
      descriptionText: defect.descriptionText || defect.description || "",
      status: defect.status || "Open",
      priority: defect.priority || "Medium",
      critical: defect.critical || false,
      is_coc: defect.is_coc || false,
      severity: defect.severity || 2,
      source: defect.source || "",
      equipmentCategory: defect.equipmentCategory || "",
      equipmentType: defect.equipmentType || "",
      equipmentMake: defect.equipmentMake || "",
      equipmentModel: defect.equipmentModel || "",
      equipmentSerialNo: defect.equipmentSerialNo || "",
      equipmentLocation: defect.equipmentLocation || "",
      equipmentSystem: defect.equipmentSystem || "",
      targetCloseDate: defect.targetCloseDate || "",
      dateCompleted: defect.dateCompleted || "",
      verifiedDate: defect.verifiedDate || "",
      responsibleDept: defect.responsibleDept || "",
      purchaseOrderRef: defect.purchaseOrderRef || "",
      viqVersion: defect.viqVersion || "",
      viqRef: defect.viqRef || "",
      sfiCodeRef: defect.sfiCodeRef || "",
      immediateCause: defect.immediateCause || "",
      immediateCauseExplanation: defect.immediateCauseExplanation || "",
      rootCause: defect.rootCause || "",
      rootCauseExplanation: defect.rootCauseExplanation || "",
      reportedBy: defect.reportedBy || "System User",
      // New fields
      raisedById: defect.raisedById || "",
      raisedByName: defect.raisedByName || "System User",
      raisedByRank: defect.raisedByRank || "Master",
      operatingCondition: defect.operatingCondition || "SAILING",
      locationText: defect.locationText || "",
      occurrenceType: defect.occurrenceType || "ROUTINE",
      responsibleRole: defect.responsibleRole || "",
      responsibleRoleId: defect.responsibleRoleId || "",
      isDeferred: defect.isDeferred || false,
      deferReason: defect.deferReason || "",
      deferNewTargetDate: defect.deferNewTargetDate || "",
      deferApprovalRequired: defect.deferApprovalRequired || true,
      reportToThirdParty: defect.reportToThirdParty || false,
      classReport: defect.classReport || false,
      flagReport: defect.flagReport || false,
      portReport: defect.portReport || false,
      reportReferenceNo: defect.reportReferenceNo || "",
      reportDate: defect.reportDate || "",
    } : {
      id: defectRef,
      vesselId: "V001",
      vesselName: "MV SEAFARER",
      issueDate: "",
      category: "Defect",
      defectType: "",
      description: "",
      descriptionHtml: "",
      descriptionText: "",
      status: "Open",
      priority: "Medium",
      critical: false,
      is_coc: false,
      severity: 2,
      source: "",
      equipmentCategory: "",
      equipmentType: "",
      equipmentMake: "",
      equipmentModel: "",
      equipmentSerialNo: "",
      equipmentLocation: "",
      equipmentSystem: "",
      targetCloseDate: "",
      dateCompleted: "",
      verifiedDate: "",
      responsibleDept: "",
      purchaseOrderRef: "",
      viqVersion: "",
      viqRef: "",
      sfiCodeRef: "",
      immediateCause: "",
      immediateCauseExplanation: "",
      rootCause: "",
      rootCauseExplanation: "",
      reportedBy: "System User",
      // New fields
      raisedById: "",
      raisedByName: "System User",
      raisedByRank: "Master",
      operatingCondition: "SAILING",
      locationText: "",
      occurrenceType: "ROUTINE",
      responsibleRole: "",
      responsibleRoleId: "",
      isDeferred: false,
      deferReason: "",
      deferNewTargetDate: "",
      deferApprovalRequired: true,
      reportToThirdParty: false,
      classReport: false,
      flagReport: false,
      portReport: false,
      reportReferenceNo: "",
      reportDate: "",
    },
  });

  const saveDefectMutation = useMutation({
    mutationFn: async (data: DefectFormData) => {
      if (mode === 'edit' && defect) {
        return apiRequest("PATCH", `/technical/api/defects/${defect.id}`, data);
      } else {
        return apiRequest("POST", "/technical/api/defects", data);
      }
    },
    onSuccess: () => {
      toast({ 
        title: "Success", 
        description: mode === 'edit' ? "Defect updated successfully" : "Defect created successfully" 
      });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/defects'] });
      onClose();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || `Failed to ${mode === 'edit' ? 'update' : 'create'} defect`,
        variant: "destructive" 
      });
    },
  });

  const handleImmediateCauseSelect = () => {
    setIsImmediateCauseModalOpen(true);
  };

  // Helper function to render read-only field value
  const renderReadOnlyField = (label: string, value: string | undefined | null) => {
    return (
      <div className="py-2">
        <span className="font-semibold text-sm">{label}: </span>
        <span className="text-sm" style={value ? {} : { color: '#9e9e9e' }}>{value || '—'}</span>
      </div>
    );
  };

  // Helper function to render checkbox value
  const renderCheckboxValue = (checked: boolean) => {
    return checked ? '✅' : '❌';
  };

  const buildImmediateCauseText = (ic: { unsafeAct: string[]; unsafeCondition: string[] }): string => {
    const sections: string[] = [];
    if (ic?.unsafeAct?.length) {
      sections.push(
        "UNSAFE ACT",
        ...ic.unsafeAct.map(item => `• ${item}`)
      );
    }
    if (ic?.unsafeCondition?.length) {
      if (sections.length) sections.push(""); // blank line between sections
      sections.push(
        "UNSAFE CONDITION",
        ...ic.unsafeCondition.map(item => `• ${item}`)
      );
    }
    return sections.join("\n");
  };

  const handleImmediateCauseSubmit = (causeData: { unsafeAct: string[], unsafeCondition: string[] }) => {
    // Store the structured data for backend persistence
    form.setValue('immediateCause', causeData);
  };

  const handleRootCauseSelect = () => {
    setIsRootCauseModalOpen(true);
  };

  const buildRootCauseText = (rc: { individualFactor: string[]; systemFactor: string[] }): string => {
    const sections: string[] = [];
    if (rc?.individualFactor?.length) {
      sections.push(
        "INDIVIDUAL FACTOR",
        ...rc.individualFactor.map(item => `• ${item}`)
      );
    }
    if (rc?.systemFactor?.length) {
      if (sections.length) sections.push(""); // blank line between sections
      sections.push(
        "SYSTEM FACTOR",
        ...rc.systemFactor.map(item => `• ${item}`)
      );
    }
    return sections.join("\n");
  };

  const handleRootCauseSubmit = (causeData: { individualFactor: string[], systemFactor: string[] }) => {
    // Store the structured data for backend persistence
    form.setValue('rootCause', causeData);
    
    // Close the modal after successful submission
    setIsRootCauseModalOpen(false);
  };

  const handleSubmit = (data: DefectFormData) => {
    // Check for critical defects without immediate cause (non-blocking warning)
    if (data.critical && (!data.immediateCause || 
        (typeof data.immediateCause === 'object' && !Array.isArray(data.immediateCause) && 
         (!data.immediateCause.unsafeAct?.length && !data.immediateCause.unsafeCondition?.length)))) {
      toast({
        title: "Missing Immediate Cause",
        description: "This critical defect should have an immediate cause analysis for proper investigation.",
        variant: "default",
        style: { borderColor: '#16569e', color: '#16569e' }
      });
    }

    // Check for critical defects without root cause (non-blocking warning)
    if (data.critical && (!data.rootCause || 
        (typeof data.rootCause === 'object' && !Array.isArray(data.rootCause) && 
         (!data.rootCause.individualFactor?.length && !data.rootCause.systemFactor?.length)))) {
      toast({
        title: "Missing Root Cause",
        description: "This critical defect should have a root cause analysis for thorough investigation.",
        variant: "default",
        style: { borderColor: '#16569e', color: '#16569e' }
      });
    }

    saveDefectMutation.mutate(data);
  };

  const addAction = () => {
    const newAction: Action = {
      id: (actions.length + 1).toString(),
      actionType: "Corrective Action Planned",
      proposedBy: "MASTER",
      responsibility: "Vessel Manager",
      dueDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      status: "Open"
    };
    setActions([...actions, newAction]);
  };

  const removeAction = (id: string) => {
    setActions(actions.filter(action => action.id !== id));
  };

  const getSeverityBadge = (severity: number) => {
    switch (severity) {
      case 1: return <Badge className="bg-green-500 text-white">Minor</Badge>;
      case 2: return <Badge className="bg-yellow-500 text-white">Moderate</Badge>;
      case 3: return <Badge className="bg-red-500 text-white">Major</Badge>;
      default: return <Badge className="bg-green-500 text-white">Minor</Badge>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white">
      {/* Header with ID in top right */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center">
          <h1 className="text-xl font-semibold text-gray-900">Defect Report</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-medium text-sm" style={{color: '#16569e'}}>{defectRef}</span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="text-gray-600" 
            onClick={() => setIsViewMode(!isViewMode)}
            data-testid="button-view"
          >
            <Eye className="w-4 h-4 mr-1" />
            {isViewMode ? 'Edit' : 'View'}
          </Button>
          <Button 
            className="text-white hover:opacity-90"
            style={{backgroundColor: '#16569e'}} 
            size="sm" 
            onClick={() => form.handleSubmit(handleSubmit)()}
            disabled={saveDefectMutation.isPending || isViewMode}
            data-testid="button-save-header"
          >
            {saveDefectMutation.isPending ? "SAVING..." : "SAVE"}
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Details Section - 3 Column Layout */}
          <div className="bg-gray-50 p-6">
            <div className="pb-4">
              <div className="border-b pb-2" style={{borderColor: '#16569e'}}>
                <h2 className="font-semibold text-base" style={{color: '#16569e'}}>Details</h2>
              </div>
            </div>
            <div>
              <div className="grid grid-cols-3 gap-8">
                {/* Basic Column */}
                <div className="space-y-4">
                  <div className="border-b pb-1" style={{borderColor: '#16569e'}}>
                    <h3 className="font-semibold text-sm" style={{color: '#16569e'}}>Basic</h3>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="vesselId"
                    render={({ field }) => (
                      <FormItem>
                        {isViewMode ? (
                          renderReadOnlyField("VESSEL", form.watch("vesselName") || "")
                        ) : (
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-700">VESSEL</label>
                            <Select 
                              onValueChange={(value) => {
                                field.onChange(value);
                                const vessel = vessels.find(v => v.id === value);
                                if (vessel) {
                                  form.setValue("vesselName", vessel.name);
                                }
                              }} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-vessel">
                                  <SelectValue placeholder="Select vessel" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {vessels.map(vessel => (
                                  <SelectItem key={vessel.id} value={vessel.id}>{vessel.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="source"
                    render={({ field }) => (
                      <FormItem>
                        {isViewMode ? (
                          renderReadOnlyField("SOURCE", field.value || "")
                        ) : (
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-700">SOURCE</label>
                            <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-source">
                                  <SelectValue placeholder="Select source" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="SIRE">SIRE</SelectItem>
                                <SelectItem value="PSC">PSC</SelectItem>
                                <SelectItem value="Internal">Internal</SelectItem>
                                <SelectItem value="Class">Class</SelectItem>
                                <SelectItem value="External">External</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="defectCategory"
                    render={({ field }) => (
                      <FormItem>
                        {isViewMode ? (
                          renderReadOnlyField("DEFECT CATEGORY", field.value || "")
                        ) : (
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-700">DEFECT CATEGORY</label>
                            <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-defect-category">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Minor">Minor</SelectItem>
                                <SelectItem value="Major">Major</SelectItem>
                                <SelectItem value="Catastrophic">Catastrophic</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="defectType"
                    render={({ field }) => (
                      <FormItem>
                        {isViewMode ? (
                          renderReadOnlyField("DEFECT TYPE", field.value || "")
                        ) : (
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-700">DEFECT TYPE</label>
                            <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-defect-type">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Routine">Routine</SelectItem>
                                <SelectItem value="Corrective">Corrective</SelectItem>
                                <SelectItem value="Emergency">Emergency</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </FormItem>
                    )}
                  />
                  
                  {/* Raised By Field - Auto-filled with current user but editable */}
                  <FormField
                    control={form.control}
                    name="raisedByName"
                    render={({ field }) => (
                      <FormItem>
                        {isViewMode ? (
                          renderReadOnlyField("RAISED BY", `${form.watch("raisedByRank")} - ${field.value}`)
                        ) : (
                          <div className="space-y-1">
                            <label 
                              className="text-xs font-medium text-gray-700"
                              title="Auto-selected from login. Change if reporting on behalf of another crew member."
                            >
                              RAISED BY
                            </label>
                            <Select 
                              onValueChange={(value) => {
                                const [rank, ...nameParts] = value.split(" - ");
                                const name = nameParts.join(" - ");
                                field.onChange(name);
                                form.setValue("raisedByRank", rank);
                                form.setValue("raisedById", value);
                              }} 
                              defaultValue={`${form.watch("raisedByRank")} - ${field.value}`}
                            >
                              <FormControl>
                                <SelectTrigger 
                                  data-testid="select-raised-by"
                                  title="Auto-selected from login. Change if reporting on behalf of another crew member."
                                >
                                  <SelectValue placeholder="Select person" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Master - System User">Master - System User</SelectItem>
                                <SelectItem value="Chief Engineer - John Mathews">Chief Engineer - John Mathews</SelectItem>
                                <SelectItem value="2nd Officer - Rahul Verma">2nd Officer - Rahul Verma</SelectItem>
                                <SelectItem value="AB - Suresh Kumar">AB - Suresh Kumar</SelectItem>
                                <SelectItem value="Chief Officer - Mike Anderson">Chief Officer - Mike Anderson</SelectItem>
                                <SelectItem value="2E - David Smith">2E - David Smith</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </FormItem>
                    )}
                  />
                  
                  {/* Operating Condition / Location Field */}
                  <div className="space-y-2">
                    <FormField
                      control={form.control}
                      name="operatingCondition"
                      render={({ field }) => (
                        <FormItem>
                          {isViewMode ? (
                            renderReadOnlyField("OPERATING CONDITION", field.value || "")
                          ) : (
                            <div className="space-y-2">
                              <label 
                                className="text-xs font-medium text-gray-700"
                                title="Select vessel condition during occurrence and specify port/position if applicable."
                              >
                                OPERATION CONDITION / LOCATION
                              </label>
                              <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    value="SAILING"
                                    checked={field.value === "SAILING"}
                                    onChange={(e) => field.onChange(e.target.value)}
                                    className="text-blue-600"
                                  />
                                  <span className="text-sm">Sailing 🚢</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    value="PORT"
                                    checked={field.value === "PORT"}
                                    onChange={(e) => field.onChange(e.target.value)}
                                    className="text-blue-600"
                                  />
                                  <span className="text-sm">Port 🏗️</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    value="ANCHOR"
                                    checked={field.value === "ANCHOR"}
                                    onChange={(e) => field.onChange(e.target.value)}
                                    className="text-blue-600"
                                  />
                                  <span className="text-sm">At Anchor ⚓</span>
                                </label>
                              </div>
                            </div>
                          )}
                        </FormItem>
                      )}
                    />
                    
                    {(form.watch("operatingCondition") === "PORT" || form.watch("operatingCondition") === "ANCHOR") && (
                      <FormField
                        control={form.control}
                        name="locationText"
                        render={({ field }) => (
                          <FormItem>
                            {!isViewMode && (
                              <FormControl>
                                <Input
                                  placeholder="Enter port or position (e.g. Mumbai Anchorage or Lat/Long)"
                                  {...field}
                                  value={field.value || ''}
                                  className="text-xs"
                                  required={form.watch("operatingCondition") === "PORT" || form.watch("operatingCondition") === "ANCHOR"}
                                  data-testid="input-location-text"
                                />
                              </FormControl>
                            )}
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                  
                  {/* Occurrence Type (Routine / Breakdown) */}
                  <FormField
                    control={form.control}
                    name="occurrenceType"
                    render={({ field }) => (
                      <FormItem>
                        {isViewMode ? (
                          renderReadOnlyField("OCCURRENCE TYPE", field.value || "")
                        ) : (
                          <div className="space-y-2">
                            <label 
                              className="text-xs font-medium text-gray-700"
                              title="Mark as Breakdown for unplanned equipment failures."
                            >
                              OCCURRENCE TYPE
                            </label>
                            <div className="flex gap-4">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  value="ROUTINE"
                                  checked={field.value === "ROUTINE"}
                                  onChange={(e) => field.onChange(e.target.value)}
                                  className="text-blue-600"
                                />
                                <span className="text-sm">Routine</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  value="BREAKDOWN"
                                  checked={field.value === "BREAKDOWN"}
                                  onChange={(e) => field.onChange(e.target.value)}
                                  className="text-blue-600"
                                />
                                <span className="text-sm">Breakdown</span>
                              </label>
                            </div>
                          </div>
                        )}
                      </FormItem>
                    )}
                  />
                </div>

                {/* Equipment/Hardware Column */}
                <div className="space-y-4">
                  <div className="border-b pb-1" style={{borderColor: '#16569e'}}>
                    <h3 className="font-semibold text-sm" style={{color: '#16569e'}}>Equipment / Hardware</h3>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="equipmentCategory"
                    render={({ field }) => (
                      <FormItem>
                        {isViewMode ? (
                          renderReadOnlyField("CATEGORY", field.value || "")
                        ) : (
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-700">CATEGORY</label>
                            <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-equipment-category">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Deck">Deck</SelectItem>
                                <SelectItem value="Navigation">Navigation</SelectItem>
                                <SelectItem value="Machinery">Machinery</SelectItem>
                                <SelectItem value="Safety">Safety</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="equipmentType"
                    render={({ field }) => (
                      <FormItem>
                        {isViewMode ? (
                          renderReadOnlyField("TYPE", field.value || "")
                        ) : (
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-700">TYPE</label>
                            <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-equipment-type">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Pump">Pump</SelectItem>
                                <SelectItem value="Valve">Valve</SelectItem>
                                <SelectItem value="Motor">Motor</SelectItem>
                                <SelectItem value="Sensor">Sensor</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="equipmentMake"
                    render={({ field }) => (
                      <FormItem>
                        {isViewMode ? (
                          renderReadOnlyField("MAKE", field.value || "")
                        ) : (
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-700">MAKE</label>
                            <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-equipment-make">
                                  <SelectValue placeholder="Select make" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Wartsila">Wartsila</SelectItem>
                                <SelectItem value="MAN">MAN</SelectItem>
                                <SelectItem value="Caterpillar">Caterpillar</SelectItem>
                                <SelectItem value="ABB">ABB</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="equipmentModel"
                    render={({ field }) => (
                      <FormItem>
                        {isViewMode ? (
                          renderReadOnlyField("MODEL", field.value || "")
                        ) : (
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-700">MODEL</label>
                            <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-equipment-model">
                                  <SelectValue placeholder="Select model" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="W32">W32</SelectItem>
                                <SelectItem value="6L20">6L20</SelectItem>
                                <SelectItem value="3508">3508</SelectItem>
                                <SelectItem value="VFD">VFD</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </FormItem>
                    )}
                  />
                </div>

                {/* Date Column */}
                <div className="space-y-4">
                  <div className="border-b pb-1" style={{borderColor: '#16569e'}}>
                    <h3 className="font-semibold text-sm" style={{color: '#16569e'}}>Date</h3>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="issueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          {isViewMode ? (
                            renderReadOnlyField("DATE ISSUED", field.value || "")
                          ) : (
                            <label className="relative block cursor-pointer">
                              <div className="flex items-center justify-between border rounded-md px-3 py-2 bg-white">
                                <span className="text-gray-400 text-sm">
                                  DATE ISSUED
                                </span>
                                <span className="flex items-center gap-2">
                                  {field.value && <span className="text-black">{field.value}</span>}
                                  <Calendar className="h-4 w-4 text-gray-400" />
                                </span>
                              </div>
                              <input
                                type="date"
                                value={field.value || ""}
                                onChange={(e) => field.onChange(e.target.value)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                data-testid="input-issue-date"
                              />
                            </label>
                          )}
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="targetCloseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          {isViewMode ? (
                            renderReadOnlyField("TARGET DATE FOR CLOSURE", field.value || "")
                          ) : (
                            <label className="relative block cursor-pointer">
                              <div className="flex items-center justify-between border rounded-md px-3 py-2 bg-white">
                                <span className="text-gray-400 text-sm">
                                  TARGET DATE FOR CLOSURE
                                </span>
                                <span className="flex items-center gap-2">
                                  {field.value && <span className="text-black">{field.value}</span>}
                                  <Calendar className="h-4 w-4 text-gray-400" />
                                </span>
                              </div>
                              <input
                                type="date"
                                value={field.value || ""}
                                onChange={(e) => field.onChange(e.target.value)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                data-testid="input-target-date"
                              />
                            </label>
                          )}
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  {/* Responsible Role Field */}
                  <FormField
                    control={form.control}
                    name="responsibleRole"
                    render={({ field }) => (
                      <FormItem>
                        {isViewMode ? (
                          renderReadOnlyField("RESPONSIBLE ROLE", field.value || "")
                        ) : (
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              form.setValue("responsibleRoleId", value);
                            }} 
                            defaultValue={field.value || ""}
                          >
                            <FormControl>
                              <SelectTrigger 
                                data-testid="select-responsible-role"
                                title="Select the main role accountable for closing this defect."
                              >
                                <SelectValue placeholder="RESPONSIBLE ROLE" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Master">Master</SelectItem>
                              <SelectItem value="Chief Engineer">Chief Engineer</SelectItem>
                              <SelectItem value="Chief Officer">Chief Officer</SelectItem>
                              <SelectItem value="2E">2E</SelectItem>
                              <SelectItem value="ETO">ETO</SelectItem>
                              <SelectItem value="Tech Superintendent">Tech Superintendent</SelectItem>
                              <SelectItem value="HSEQ Superintendent">HSEQ Superintendent</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dateCompleted"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          {isViewMode ? (
                            renderReadOnlyField("DATE COMPLETED", field.value || "")
                          ) : (
                            <label className="relative block cursor-pointer">
                              <div className="flex items-center justify-between border rounded-md px-3 py-2 bg-white">
                                <span className="text-gray-400 text-sm">
                                  DATE COMPLETED
                                </span>
                                <span className="flex items-center gap-2">
                                  {field.value && <span className="text-black">{field.value}</span>}
                                  <Calendar className="h-4 w-4 text-gray-400" />
                                </span>
                              </div>
                              <input
                                type="date"
                                value={field.value || ""}
                                onChange={(e) => field.onChange(e.target.value)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                data-testid="input-date-completed"
                              />
                            </label>
                          )}
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Condition of Class (CoC) Checkbox - Separated from Date fields */}
              <div className="mt-4">
                <FormField
                  control={form.control}
                  name="is_coc"
                  render={({ field }) => (
                    <FormItem>
                      {isViewMode ? (
                        renderReadOnlyField("Condition of Class (CoC)", field.value ? "Yes" : "No")
                      ) : (
                        <div className="border rounded-md p-3 bg-gray-50">
                          <div className="flex items-center space-x-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-coc"
                              />
                            </FormControl>
                            <div className="space-y-1">
                              <FormLabel className="font-semibold text-sm">Condition of Class (CoC)</FormLabel>
                              <p className="text-xs text-gray-600">Tick if this defect is a Class Condition.</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </FormItem>
                  )}
                />
              </div>

              {/* Purchase Order Section */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="border-b pb-1 mb-4" style={{borderColor: '#16569e'}}>
                  <h3 className="font-semibold text-sm" style={{color: '#16569e'}}>Purchase Order</h3>
                </div>
                <div className="flex items-center gap-4">
                  <FormField
                    control={form.control}
                    name="purchaseOrderRef"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          {isViewMode ? (
                            renderReadOnlyField("PO REF", field.value || "")
                          ) : (
                            <Input 
                              {...field}
                              value={field.value || ""}
                              placeholder="PO REF"
                              data-testid="input-po-ref"
                            />
                          )}
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="critical"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        {isViewMode ? (
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-sm">Critical: </span>
                            <span className="text-sm">{renderCheckboxValue(field.value || false)}</span>
                          </div>
                        ) : (
                          <>
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-critical"
                              />
                            </FormControl>
                            <FormLabel>Critical</FormLabel>
                          </>
                        )}
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="bg-gray-50 p-6">
            <div className="pb-4">
              <div className="border-b pb-2" style={{borderColor: '#16569e'}}>
                <h2 className="font-semibold text-base" style={{color: '#16569e'}}>Description</h2>
              </div>
            </div>
            <div>
              {/* Display formatted HTML in view mode */}
              {isViewMode ? (
                <div className="bg-white p-3 rounded-md border min-h-[150px]">
                  {defect?.descriptionHtml ? (
                    <RichTextDisplay html={defect.descriptionHtml} />
                  ) : (
                    <p className="text-gray-700 whitespace-pre-wrap">{defect?.description || 'No description provided'}</p>
                  )}
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RichTextEditor
                          value={descriptionHtml}
                          onChange={(html, text) => {
                            setDescriptionHtml(html);
                            setDescriptionText(text);
                            // Keep the plain text in description field for backward compatibility
                            field.onChange(text);
                            form.setValue('descriptionHtml', html);
                            form.setValue('descriptionText', text);
                          }}
                          placeholder="Enter defect description..."
                          required={true}
                          disabled={isViewMode}
                          height="200px"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              {/* Bottom Row with Severity and VIQ Fields */}
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-4">
                  <FormField
                    control={form.control}
                    name="severity"
                    render={({ field }) => (
                      <FormItem>
                        <Select 
                          onValueChange={(value) => field.onChange(parseInt(value))} 
                          defaultValue={(field.value || 2).toString()}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-green-600 text-white border-green-600 hover:bg-green-700 min-w-[120px] h-10 font-medium">
                              <SelectValue>
                                {field.value === 1 ? "1 - Minor" : 
                                 field.value === 3 ? "3 - Major" : 
                                 "2 - Minor"}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1">1 - Minor</SelectItem>
                            <SelectItem value="2">2 - Minor</SelectItem>
                            <SelectItem value="3">3 - Major</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="viqVersion"
                    render={({ field }) => (
                      <FormItem>
                        <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                          <FormControl>
                            <SelectTrigger className="w-32" data-testid="select-viq-version">
                              <SelectValue placeholder="VIQ VER" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="7.0">7.0</SelectItem>
                            <SelectItem value="6.0">6.0</SelectItem>
                            <SelectItem value="5.0">5.0</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="viqRef"
                    render={({ field }) => (
                      <FormItem>
                        <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                          <FormControl>
                            <SelectTrigger className="w-32" data-testid="select-viq-ref">
                              <SelectValue placeholder="VIQ REF" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1.1">1.1</SelectItem>
                            <SelectItem value="1.2">1.2</SelectItem>
                            <SelectItem value="2.1">2.1</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sfiCodeRef"
                    render={({ field }) => (
                      <FormItem>
                        <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                          <FormControl>
                            <SelectTrigger className="w-40" data-testid="select-sfi-code">
                              <SelectValue placeholder="SFI CODE REF" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="011">011</SelectItem>
                            <SelectItem value="012">012</SelectItem>
                            <SelectItem value="021">021</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
                
                <Button 
                  type="button"
                  className="hover:opacity-90"
                  style={{backgroundColor: '#16569e'}} 
                  disabled={saveDefectMutation.isPending || isViewMode}
                  data-testid="button-save-description"
                  onClick={() => form.handleSubmit(handleSubmit)()}
                >
                  {saveDefectMutation.isPending ? "SAVING..." : "SAVE"}
                </Button>
              </div>
            </div>
          </div>

          {/* Cause Analysis Section */}
          <div className="bg-gray-50 p-6">
            <div className="pb-4">
              <div className="border-b pb-2" style={{borderColor: '#16569e'}}>
                <h2 className="font-semibold text-base" style={{color: '#16569e'}}>Cause Analysis</h2>
              </div>
            </div>
            <div>
              <div className="space-y-6">
                {/* Row 1: Immediate Cause */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm" style={{color: '#16569e'}}>Immediate Cause</h4>
                    {!isViewMode && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="hover:opacity-80" 
                        style={{color: '#16569e', borderColor: '#16569e'}} 
                        data-testid="button-select-immediate"
                        onClick={handleImmediateCauseSelect}
                        type="button"
                      >
                        Select
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="immediateCause"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            {isViewMode ? (
                              <div className="py-2">
                                <span className="font-semibold text-sm">IMMEDIATE CAUSE: </span>
                                <pre className="text-sm whitespace-pre-wrap font-sans">
                                  {typeof field.value === 'string' ? field.value : 
                                   field.value && typeof field.value === 'object' ? 
                                   buildImmediateCauseText(field.value as { unsafeAct: string[], unsafeCondition: string[] }) : "—"}
                                </pre>
                              </div>
                            ) : (
                              <Textarea 
                                {...field}
                                value={typeof field.value === 'string' ? field.value : 
                                       field.value && typeof field.value === 'object' ? 
                                       buildImmediateCauseText(field.value as { unsafeAct: string[], unsafeCondition: string[] }) : ""}
                                rows={3}
                                placeholder="IMMEDIATE CAUSE"
                                className="bg-white"
                                data-testid="textarea-immediate-cause"
                              />
                            )}
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="immediateCauseExplanation"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            {isViewMode ? (
                              <div className="py-2">
                                <span className="font-semibold text-sm">FURTHER EXPLANATION: </span>
                                <p className="text-sm">{field.value || "—"}</p>
                              </div>
                            ) : (
                              <Textarea 
                                {...field}
                                value={field.value || ""}
                                rows={3}
                                placeholder="FURTHER EXPLANATION"
                                className="bg-white"
                                data-testid="textarea-immediate-explanation"
                              />
                            )}
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Row 2: Root Cause */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm" style={{color: '#16569e'}}>Root Cause</h4>
                    {!isViewMode && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="hover:opacity-80" 
                        style={{color: '#16569e', borderColor: '#16569e'}} 
                        data-testid="button-select-root"
                        onClick={handleRootCauseSelect}
                        type="button"
                      >
                        Select
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="rootCause"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            {isViewMode ? (
                              <div className="py-2">
                                <span className="font-semibold text-sm">ROOT CAUSE: </span>
                                <pre className="text-sm whitespace-pre-wrap font-sans">
                                  {typeof field.value === 'object' && field.value ? 
                                    buildRootCauseText(field.value as { individualFactor: string[], systemFactor: string[] }) : 
                                    field.value || "—"}
                                </pre>
                              </div>
                            ) : (
                              <Textarea 
                                {...field}
                                value={typeof field.value === 'object' && field.value ? 
                                  buildRootCauseText(field.value as { individualFactor: string[], systemFactor: string[] }) : 
                                  String(field.value || "")}
                                rows={3}
                                placeholder="ROOT CAUSE"
                                className="bg-white"
                                data-testid="textarea-root-cause"
                              />
                            )}
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="rootCauseExplanation"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            {isViewMode ? (
                              <div className="py-2">
                                <span className="font-semibold text-sm">FURTHER EXPLANATION: </span>
                                <p className="text-sm">{field.value || "—"}</p>
                              </div>
                            ) : (
                              <Textarea 
                                {...field}
                                value={field.value || ""}
                                rows={3}
                                placeholder="FURTHER EXPLANATION"
                                className="bg-white"
                                data-testid="textarea-root-explanation"
                              />
                            )}
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Deferment Procedure Section */}
          <div className="bg-gray-50 p-6">
            <div className="pb-4">
              <div className="border-b pb-2" style={{borderColor: '#16569e'}}>
                <h2 className="font-semibold text-base" style={{color: '#16569e'}}>Deferment Procedure</h2>
              </div>
            </div>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="isDeferred"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    {isViewMode ? (
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-sm">Deferment Needed: </span>
                        <span className="text-sm">{field.value ? "Yes" : "No"}</span>
                      </div>
                    ) : (
                      <>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-deferment"
                          />
                        </FormControl>
                        <FormLabel>Deferment Needed? (Yes/No)</FormLabel>
                      </>
                    )}
                  </FormItem>
                )}
              />
              
              {form.watch("isDeferred") && (
                <div className="grid grid-cols-3 gap-4 pl-6">
                  <FormField
                    control={form.control}
                    name="deferReason"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          {isViewMode ? (
                            renderReadOnlyField("DEFERMENT REASON", field.value || "")
                          ) : (
                            <Textarea
                              {...field}
                              value={field.value || ''}
                              placeholder="Deferment Reason (required)"
                              rows={2}
                              required={form.watch("isDeferred")}
                              className="bg-white"
                              data-testid="textarea-defer-reason"
                            />
                          )}
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="deferNewTargetDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          {isViewMode ? (
                            renderReadOnlyField("PROPOSED NEW TARGET DATE", field.value || "")
                          ) : (
                            <label className="relative block cursor-pointer">
                              <div className="flex items-center justify-between border rounded-md px-3 py-2 bg-white">
                                <span className="text-gray-400 text-sm">
                                  Proposed New Target Date
                                </span>
                                <span className="flex items-center gap-2">
                                  {field.value && <span className="text-black">{field.value}</span>}
                                  <Calendar className="h-4 w-4 text-gray-400" />
                                </span>
                              </div>
                              <input
                                type="date"
                                value={field.value || ""}
                                onChange={(e) => field.onChange(e.target.value)}
                                required={form.watch("isDeferred")}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                data-testid="input-defer-new-target"
                              />
                            </label>
                          )}
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="deferApprovalRequired"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        {isViewMode ? (
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-sm">Approval Required: </span>
                            <span className="text-sm">{renderCheckboxValue(field.value || false)}</span>
                          </div>
                        ) : (
                          <>
                            <FormControl>
                              <Checkbox
                                checked={field.value || false}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-defer-approval"
                              />
                            </FormControl>
                            <FormLabel>Approval Required</FormLabel>
                          </>
                        )}
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Third-Party Reporting Section */}
          <div className="bg-gray-50 p-6">
            <div className="pb-4">
              <div className="border-b pb-2" style={{borderColor: '#16569e'}}>
                <h2 className="font-semibold text-base" style={{color: '#16569e'}}>Third-Party Reporting</h2>
              </div>
            </div>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="reportToThirdParty"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    {isViewMode ? (
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-sm">Reported to Third Party: </span>
                        <span className="text-sm">{field.value ? "Yes" : "No"}</span>
                      </div>
                    ) : (
                      <>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-third-party"
                          />
                        </FormControl>
                        <FormLabel>Reported to Third Party?</FormLabel>
                      </>
                    )}
                  </FormItem>
                )}
              />
              
              {form.watch("reportToThirdParty") && (
                <div className="space-y-4 pl-6">
                  <div className="flex gap-6">
                    <FormField
                      control={form.control}
                      name="classReport"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          {!isViewMode && (
                            <>
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-class-report"
                                />
                              </FormControl>
                              <FormLabel>Class</FormLabel>
                            </>
                          )}
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="flagReport"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          {!isViewMode && (
                            <>
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-flag-report"
                                />
                              </FormControl>
                              <FormLabel>Flag</FormLabel>
                            </>
                          )}
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="portReport"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          {!isViewMode && (
                            <>
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-port-report"
                                />
                              </FormControl>
                              <FormLabel>Port State</FormLabel>
                            </>
                          )}
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="reportReferenceNo"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            {isViewMode ? (
                              renderReadOnlyField("REFERENCE NO", field.value || "")
                            ) : (
                              <Input
                                {...field}
                                value={field.value || ''}
                                placeholder="Reference No (optional)"
                                data-testid="input-report-ref"
                              />
                            )}
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="reportDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            {isViewMode ? (
                              renderReadOnlyField("DATE REPORTED", field.value || "")
                            ) : (
                              <label className="relative block cursor-pointer">
                                <div className="flex items-center justify-between border rounded-md px-3 py-2 bg-white">
                                  <span className="text-gray-400 text-sm">
                                    Date Reported
                                  </span>
                                  <span className="flex items-center gap-2">
                                    {field.value && <span className="text-black">{field.value}</span>}
                                    <Calendar className="h-4 w-4 text-gray-400" />
                                  </span>
                                </div>
                                <input
                                  type="date"
                                  value={field.value || ""}
                                  onChange={(e) => field.onChange(e.target.value)}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  data-testid="input-report-date"
                                />
                              </label>
                            )}
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        className="flex items-center gap-2"
                        data-testid="button-upload-report"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Report File
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cross-reference with Drydock Spec (Placeholder - Phase 3) */}
          <div className="bg-gray-50 p-6">
            <div className="pb-4">
              <div className="border-b pb-2" style={{borderColor: '#16569e'}}>
                <h2 className="font-semibold text-base" style={{color: '#16569e'}}>Drydock Specification</h2>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-4">
                <Select disabled>
                  <SelectTrigger className="w-full opacity-50" data-testid="select-drydock-disabled">
                    <SelectValue placeholder="Link to Drydock Specification" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Feature coming soon</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500 italic" title="This will link defect to upcoming drydock work items.">
                  Feature coming soon - This will link defect to upcoming drydock work items.
                </p>
              </div>
            </div>
          </div>

          {/* Actions Section */}
          <div className="bg-gray-50 p-6">
            <div className="pb-4">
              <div className="flex items-center justify-between">
                <div className="border-b pb-2" style={{borderColor: '#16569e'}}>
                  <h2 className="font-semibold text-base" style={{color: '#16569e'}}>ACTIONS</h2>
                </div>
                {!isViewMode && (
                  <Button 
                    type="button"
                    variant="outline"
                    className="hover:bg-gray-100 rounded-full px-4"
                    style={{color: '#16569e', borderColor: '#16569e'}} 
                    size="sm" 
                    onClick={addAction}
                    data-testid="button-add-action"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    ADD ACTION
                  </Button>
                )}
              </div>
            </div>
            <div>
              <div className="bg-gray-100 p-3 rounded">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action Type</TableHead>
                    <TableHead>Proposed By</TableHead>
                    <TableHead>Responsibility</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Date Completed</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actions.map((action) => (
                    <TableRow key={action.id}>
                      <TableCell>{action.actionType}</TableCell>
                      <TableCell>{action.proposedBy}</TableCell>
                      <TableCell>{action.responsibility}</TableCell>
                      <TableCell>{action.dueDate}</TableCell>
                      <TableCell>{action.dateCompleted || "-"}</TableCell>
                      <TableCell>
                        {action.status}
                      </TableCell>
                      <TableCell>
                        {!isViewMode && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" data-testid={`button-edit-action-${action.id}`}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => removeAction(action.id)}
                              data-testid={`button-delete-action-${action.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>

              {/* Note section under actions table */}
              <div className="mt-4 text-sm text-gray-600">
                <p>Nature Of Action</p>
                <p>All crew members have been briefed on the correct procedure to carry out in accordance with the Quality Management Manual section 3.2 Personal protective Equipment. All crew members have been briefed on the correct procedure to carry out in accordance with the Quality Management Manual section 3.2 Personal protective Equipment.</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-6">
            <div className="flex items-center gap-2">
              <Button variant="outline" className="hover:bg-gray-100 rounded-full px-4" style={{color: '#16569e', borderColor: '#16569e'}} size="sm" data-testid="button-upload">
                <Upload className="w-4 h-4 mr-2" />
                UPLOAD
              </Button>
              <Button variant="outline" className="hover:bg-gray-100 rounded-full px-4" style={{color: '#16569e', borderColor: '#16569e'}} size="sm" data-testid="button-view-attachments">
                <Eye className="w-4 h-4 mr-2" />
                VIEW
              </Button>
            </div>
            
            <Button 
              type="submit" 
              className="hover:opacity-90 px-8"
              style={{backgroundColor: '#16569e'}}
              disabled={saveDefectMutation.isPending || isViewMode}
              data-testid="button-submit"
            >
              {saveDefectMutation.isPending ? "SUBMITTING..." : "SUBMIT"}
            </Button>
          </div>
        </form>
      </Form>

      {/* Immediate Cause Modal */}
      <ImmediateCauseModal
        isOpen={isImmediateCauseModalOpen}
        onClose={() => setIsImmediateCauseModalOpen(false)}
        onSubmit={handleImmediateCauseSubmit}
        initialData={form.getValues('immediateCause') as { unsafeAct: string[], unsafeCondition: string[] } | null}
      />

      {/* Root Cause Modal */}
      <RootCauseModal
        isOpen={isRootCauseModalOpen}
        onClose={() => setIsRootCauseModalOpen(false)}
        onSubmit={handleRootCauseSubmit}
        initialData={form.getValues('rootCause') as { individualFactor: string[], systemFactor: string[] } | null}
      />
    </div>
  );
}