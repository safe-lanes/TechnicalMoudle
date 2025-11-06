import { useState } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Plus, Edit, Trash2, ArrowLeft, Eye } from "lucide-react";
import { insertDefectSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";
import ImmediateCauseModal from "@/components/ImmediateCauseModal";
import RootCauseModal from "@/components/RootCauseModal";
import AddActionModal from "@/components/AddActionModal";

// Form validation schema
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

// Quill editor modules configuration
const quillModules = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    ['link'],
    [{ 'align': [] }],
    ['clean']
  ],
};

export default function DefectFormWizard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const params = useParams();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [actions, setActions] = useState<Action[]>([]);
  const [isImmediateCauseModalOpen, setIsImmediateCauseModalOpen] = useState(false);
  const [isRootCauseModalOpen, setIsRootCauseModalOpen] = useState(false);
  const [isAddActionModalOpen, setIsAddActionModalOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [editingAction, setEditingAction] = useState<Action | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  
  // Generate reference number (format: DN/007/25/4329/V)
  const generateReference = () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `DN/007/${year}/${random}/V`;
  };

  const [defectId] = useState(generateReference());
  
  const form = useForm<DefectFormData>({
    resolver: zodResolver(defectFormSchema),
    defaultValues: {
      vesselId: "V001",
      vesselName: "MV SEAFARER",
      issueDate: new Date().toISOString().split('T')[0],
      category: "Defect",
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
    },
  });

  // Helper functions for Cause Analysis
  const buildImmediateCauseText = (ic: { unsafeAct: string[]; unsafeCondition: string[] }): string => {
    const sections: string[] = [];
    if (ic?.unsafeAct?.length) {
      sections.push(
        "UNSAFE ACT",
        ...ic.unsafeAct.map(item => `• ${item}`)
      );
    }
    if (ic?.unsafeCondition?.length) {
      if (sections.length) sections.push("");
      sections.push(
        "UNSAFE CONDITION",
        ...ic.unsafeCondition.map(item => `• ${item}`)
      );
    }
    return sections.join("\n");
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
      if (sections.length) sections.push("");
      sections.push(
        "SYSTEM FACTOR",
        ...rc.systemFactor.map(item => `• ${item}`)
      );
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

  const saveDefect = async (data: DefectFormData, showToast = true, navigate = false) => {
    try {
      const submitData = {
        ...data,
        id: params.id || defectId,
      };
      
      if (params.id) {
        await apiRequest("PATCH", `/api/defects/${params.id}`, submitData);
        if (showToast) toast({ title: "Defect saved successfully" });
      } else {
        await apiRequest("POST", "/api/defects", submitData);
        if (showToast) toast({ title: "Defect saved successfully" });
      }
      queryClient.invalidateQueries({ queryKey: ['defects'] });
      
      if (navigate) {
        setLocation("/defects/active");
      }
    } catch (error) {
      console.error("Defect save error:", error);
      toast({ 
        title: "Error", 
        description: "Failed to save defect",
        variant: "destructive" 
      });
    }
  };

  const onSubmit = async (data: DefectFormData) => {
    await saveDefect(data, true, true);
  };

  const handleStepSubmit = async (stepNumber: 1 | 2 | 3) => {
    const data = form.getValues();
    await saveDefect(data, true, false);
    if (stepNumber < 3) {
      toast({ title: `Step ${stepNumber} saved. You can continue to the next step.` });
    }
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
      // Update existing action
      updatedActions = actions.map(a => a.id === editingAction.id ? { ...editingAction, ...actionData } : a);
      setActions(updatedActions);
      toast({ title: "Action updated successfully" });
    } else {
      // Add new action
      const newAction: Action = {
        id: Date.now().toString(),
        ...actionData,
      };
      updatedActions = [...actions, newAction];
      setActions(updatedActions);
      toast({ title: "Action added successfully" });
    }
    // Sync to form
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
      
      // Sync to form as metadata
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

  return (
    <div className="flex h-screen bg-[#f5f5f5]">
      {/* Left Sidebar - Light Grey background matching Near Miss */}
      <div className="w-52 bg-[#f5f5f5] border-r border-gray-200 flex flex-col">
        {/* Step circles - matching Near Miss style */}
        <div className="flex-1 pt-20">
          <div 
            onClick={() => setCurrentStep(1)} 
            className="flex items-center gap-3 px-6 py-3 mb-1 cursor-pointer hover:bg-gray-50"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
              currentStep === 1 
                ? 'bg-[#1976d2] text-white' 
                : 'border-2 border-gray-300 text-gray-500 bg-white'
            }`}>
              1
            </div>
            <span className={`text-sm font-medium ${currentStep === 1 ? 'text-[#1976d2]' : 'text-gray-600'}`}>
              Reporting
            </span>
          </div>

          <div 
            onClick={() => setCurrentStep(2)} 
            className="flex items-center gap-3 px-6 py-3 mb-1 cursor-pointer hover:bg-gray-50"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
              currentStep === 2 
                ? 'bg-[#1976d2] text-white' 
                : 'border-2 border-gray-300 text-gray-500 bg-white'
            }`}>
              2
            </div>
            <span className={`text-sm font-medium ${currentStep === 2 ? 'text-[#1976d2]' : 'text-gray-600'}`}>
              Actions
            </span>
          </div>

          <div 
            onClick={() => setCurrentStep(3)} 
            className="flex items-center gap-3 px-6 py-3 mb-1 cursor-pointer hover:bg-gray-50"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
              currentStep === 3 
                ? 'bg-[#1976d2] text-white' 
                : 'border-2 border-gray-300 text-gray-500 bg-white'
            }`}>
              3
            </div>
            <span className={`text-sm font-medium ${currentStep === 3 ? 'text-[#1976d2]' : 'text-gray-600'}`}>
              Closeout
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-[#f5f5f5]">
        {/* Top Bar - Buttons only on right - matching Near Miss */}
        <div className="h-16 px-8 flex items-center justify-end bg-white border-b border-gray-200">
          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setLocation("/defects/active")}
              className="text-gray-700 border-gray-300 h-9"
              data-testid="button-back-top"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              variant="outline"
              onClick={toggleViewMode}
              className="text-gray-700 border-gray-300 h-9"
              data-testid="button-view"
            >
              <Eye className="h-4 w-4 mr-2" />
              {isViewMode ? 'Edit' : 'View'}
            </Button>
            <Button
              onClick={form.handleSubmit(onSubmit)}
              className="bg-[#1976d2] hover:bg-[#1565c0] text-white h-9 px-6 font-medium"
              data-testid="button-save"
            >
              SAVE
            </Button>
          </div>
        </div>

        {/* Scrollable Content with Gray Background */}
        <div className="flex-1 overflow-y-auto bg-[#f5f5f5] px-8">
          {/* Page Title - positioned to align with step 1 circle - matching Near Miss */}
          <div className="pt-20 pb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Defect Report</h1>
          </div>
          <div className="max-w-6xl mx-auto">
            {/* ONE BIG WHITE CONTAINER CARD - Matching Near Miss */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200" style={{padding: '24px'}}>
            
            {/* Step 1: Reporting */}
            <div>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#1976d2]">Reporting</h2>
                  <p className="text-sm text-cyan-600 mt-1">Part A - Describe what happened</p>
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-normal">Report ID :</span>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-4">Details</h3>
                  
                  <div className="grid grid-cols-3 gap-x-4 gap-y-4">
                    {/* Column 1: Basic */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600 uppercase font-normal">Vessel*</Label>
                      <Controller
                        name="vesselId"
                        control={form.control}
                        render={({ field }) => (
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              const vesselNames: Record<string, string> = {
                                "V001": "MV SEAFARER",
                                "V002": "MV VOYAGER",
                                "V003": "MV EXPLORER"
                              };
                              form.setValue("vesselName", vesselNames[value] || "");
                            }} 
                            value={field.value}
                            disabled={isViewMode}
                          >
                            <SelectTrigger data-testid="select-vessel" className="h-9 text-sm border-gray-300">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="V001">MV SEAFARER</SelectItem>
                              <SelectItem value="V002">MV VOYAGER</SelectItem>
                              <SelectItem value="V003">MV EXPLORER</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    {/* Column 2: Equipment/Hardware */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600 uppercase font-normal">Category</Label>
                      <Controller
                        name="equipmentCategory"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                            <SelectTrigger data-testid="select-equipment-category" className="h-9 text-sm border-gray-300">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Deck">Deck</SelectItem>
                              <SelectItem value="Navigation">Navigation</SelectItem>
                              <SelectItem value="Machinery">Machinery</SelectItem>
                              <SelectItem value="Safety">Safety</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    {/* Column 3: Date */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600 uppercase font-normal">Date Issued*</Label>
                      <Input 
                        {...form.register("issueDate")} 
                        type="date"
                        data-testid="input-date-issued"
                        className="h-9 text-sm border-gray-300"
                        disabled={isViewMode}
                      />
                    </div>

                    {/* Row 2 */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600 uppercase font-normal">Source</Label>
                      <Controller
                        name="source"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                            <SelectTrigger data-testid="select-source" className="h-9 text-sm border-gray-300">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Internal">Internal</SelectItem>
                              <SelectItem value="External">External</SelectItem>
                              <SelectItem value="SIRE">SIRE</SelectItem>
                              <SelectItem value="PSC">PSC</SelectItem>
                              <SelectItem value="Class">Class</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600 uppercase font-normal">Type</Label>
                      <Controller
                        name="equipmentType"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                            <SelectTrigger data-testid="select-equipment-type" className="h-9 text-sm border-gray-300">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pump">Pump</SelectItem>
                              <SelectItem value="Compressor">Compressor</SelectItem>
                              <SelectItem value="Turbine">Turbine</SelectItem>
                              <SelectItem value="Engine">Engine</SelectItem>
                              <SelectItem value="Motor">Motor</SelectItem>
                              <SelectItem value="Generator">Generator</SelectItem>
                              <SelectItem value="Valve">Valve</SelectItem>
                              <SelectItem value="Heat Exchanger">Heat Exchanger</SelectItem>
                              <SelectItem value="Boiler">Boiler</SelectItem>
                              <SelectItem value="Tank">Tank</SelectItem>
                              <SelectItem value="Piping System">Piping System</SelectItem>
                              <SelectItem value="Electrical Panel">Electrical Panel</SelectItem>
                              <SelectItem value="Control System">Control System</SelectItem>
                              <SelectItem value="Sensor">Sensor</SelectItem>
                              <SelectItem value="Navigation Equipment">Navigation Equipment</SelectItem>
                              <SelectItem value="Communication Equipment">Communication Equipment</SelectItem>
                              <SelectItem value="Safety Equipment">Safety Equipment</SelectItem>
                              <SelectItem value="Deck Equipment">Deck Equipment</SelectItem>
                              <SelectItem value="Hull Structure">Hull Structure</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600 uppercase font-normal">Target Date</Label>
                      <Input 
                        {...form.register("targetCloseDate")} 
                        type="date"
                        data-testid="input-target-date"
                        className="h-9 text-sm border-gray-300"
                        disabled={isViewMode}
                      />
                    </div>

                    {/* Row 3 */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600 uppercase font-normal">Defect Category</Label>
                      <Controller
                        name="defectCategory"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                            <SelectTrigger data-testid="select-defect-category" className="h-9 text-sm border-gray-300">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Hull / Structural Integrity">Hull / Structural Integrity</SelectItem>
                              <SelectItem value="Machinery Failure (Main & Auxiliary)">Machinery Failure (Main & Auxiliary)</SelectItem>
                              <SelectItem value="Electrical / Electronic Systems">Electrical / Electronic Systems</SelectItem>
                              <SelectItem value="Navigation & Communication Equipment">Navigation & Communication Equipment</SelectItem>
                              <SelectItem value="Safety & Emergency Systems (Fire, Lifesaving, Alarms)">Safety & Emergency Systems (Fire, Lifesaving, Alarms)</SelectItem>
                              <SelectItem value="Ballast / Cargo / Tank Systems">Ballast / Cargo / Tank Systems</SelectItem>
                              <SelectItem value="Environmental / Pollution Control (e.g., BWM, SOx, OWS)">Environmental / Pollution Control (e.g., BWM, SOx, OWS)</SelectItem>
                              <SelectItem value="Steering / Rudder / Propulsion Systems">Steering / Rudder / Propulsion Systems</SelectItem>
                              <SelectItem value="Deck Equipment & Mooring Systems">Deck Equipment & Mooring Systems</SelectItem>
                              <SelectItem value="Condition of Class (CoC) Related">Condition of Class (CoC) Related</SelectItem>
                              <SelectItem value="Survey / Certification Deficiencies">Survey / Certification Deficiencies</SelectItem>
                              <SelectItem value="Wear & Tear / Corrosion / Fatigue">Wear & Tear / Corrosion / Fatigue</SelectItem>
                              <SelectItem value="Human-/Operational Error (not equipment fault)">Human-/Operational Error (not equipment fault)</SelectItem>
                              <SelectItem value="Other / Miscellaneous">Other / Miscellaneous</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600 uppercase font-normal">Make</Label>
                      <Controller
                        name="equipmentMake"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                            <SelectTrigger data-testid="select-make" className="h-9 text-sm border-gray-300">
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

                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600 uppercase font-normal">Responsible Role</Label>
                      <Input 
                        {...form.register("responsibleDept")} 
                        data-testid="input-responsible-role"
                        className="h-9 text-sm border-gray-300"
                        placeholder="e.g., Chief Engineer"
                        disabled={isViewMode}
                      />
                    </div>

                    {/* Row 4 */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600 uppercase font-normal">Defect Type</Label>
                      <Controller
                        name="defectType"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                            <SelectTrigger data-testid="select-defect-type" className="h-9 text-sm border-gray-300">
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
                              <SelectItem value="Safety Equipment Deficiency (Fire / Lifeboat / Alarm)">Safety Equipment Deficiency (Fire / Lifeboat / Alarm)</SelectItem>
                              <SelectItem value="Ballast / Cargo / Tank System Defect">Ballast / Cargo / Tank System Defect</SelectItem>
                              <SelectItem value="Steering / Rudder / Propulsion System Defect">Steering / Rudder / Propulsion System Defect</SelectItem>
                              <SelectItem value="Mooring / Deck Equipment Failure">Mooring / Deck Equipment Failure</SelectItem>
                              <SelectItem value="Environmental Compliance Issue (BWM / SOx / OWS)">Environmental Compliance Issue (BWM / SOx / OWS)</SelectItem>
                              <SelectItem value="Non-Conformity / Certification Lapse">Non-Conformity / Certification Lapse</SelectItem>
                              <SelectItem value="Inspection / Test Failure">Inspection / Test Failure</SelectItem>
                              <SelectItem value="Software / Firmware / Interface Error">Software / Firmware / Interface Error</SelectItem>
                              <SelectItem value="Recurring Fault (same equipment/system)">Recurring Fault (same equipment/system)</SelectItem>
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

                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600 uppercase font-normal">Model</Label>
                      <Controller
                        name="equipmentModel"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                            <SelectTrigger data-testid="select-model" className="h-9 text-sm border-gray-300">
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

                    <div className="pt-2">
                      <Controller
                        name="is_coc"
                        control={form.control}
                        render={({ field }) => (
                          <div className="flex items-start gap-2">
                            <Checkbox
                              id="coc"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-coc"
                              className="mt-0.5"
                              disabled={isViewMode}
                            />
                            <div>
                              <Label htmlFor="coc" className="text-sm font-normal cursor-pointer text-gray-700">
                                Condition of Class (CoC)
                              </Label>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Only if the Defect is Class Related
                              </p>
                            </div>
                          </div>
                        )}
                      />
                    </div>
                  </div>
                </div>

              <div className="space-y-2">
                <Label className="text-xs text-gray-600 uppercase font-normal">Description*</Label>
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

              <div className="flex justify-end pt-2">
                <Button 
                  type="button"
                  onClick={() => handleStepSubmit(1)}
                  className="bg-[#1976d2] hover:bg-[#1565c0] text-white h-9 px-8 font-medium"
                  data-testid="button-submit-step1"
                  disabled={isViewMode}
                >
                  SUBMIT
                </Button>
              </div>
            </div>

            {/* Cause Analysis Section - White Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#1976d2]">Cause Analysis</h2>
              </div>

              <div className="space-y-4">
                {/* Immediate Cause */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-[#1976d2]">Immediate Cause</h4>
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm" 
                      className="hover:opacity-80" 
                      style={{color: '#1976d2', borderColor: '#1976d2'}} 
                      data-testid="button-select-immediate"
                      onClick={handleImmediateCauseSelect}
                      disabled={isViewMode}
                    >
                      Select
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600 uppercase font-normal">Immediate Cause</Label>
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
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600 uppercase font-normal">Further Explanation</Label>
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
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-[#1976d2]">Root Cause</h4>
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm" 
                      className="hover:opacity-80" 
                      style={{color: '#1976d2', borderColor: '#1976d2'}} 
                      data-testid="button-select-root"
                      onClick={handleRootCauseSelect}
                      disabled={isViewMode}
                    >
                      Select
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600 uppercase font-normal">Root Cause</Label>
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
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600 uppercase font-normal">Further Explanation</Label>
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

                {/* B4. VIQ Section */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-[#1976d2]">B4. VIQ</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600 uppercase font-normal">VIQ 7</Label>
                      <Controller
                        name="viqVersion"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                            <SelectTrigger data-testid="select-viq-version" className="h-9 text-sm border-gray-300">
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

                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600 uppercase font-normal">VIQ Reference</Label>
                      <Controller
                        name="viqRef"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                            <SelectTrigger data-testid="select-viq-ref" className="h-9 text-sm border-gray-300">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {/* Chapter 1: General Information (1.1-1.26) */}
                              <SelectItem value="1.1">1.1 - Vessel Name</SelectItem>
                              <SelectItem value="1.2">1.2 - IMO Number</SelectItem>
                              <SelectItem value="1.3">1.3 - Inspection Date</SelectItem>
                              <SelectItem value="1.4">1.4 - Full Inspection Completed</SelectItem>
                              <SelectItem value="1.5">1.5 - Port of Inspection</SelectItem>
                              <SelectItem value="1.6">1.6 - Flag</SelectItem>
                              <SelectItem value="1.7">1.7 - Deadweight</SelectItem>
                              <SelectItem value="1.8">1.8 - Delivery Date</SelectItem>
                              <SelectItem value="1.9">1.9 - Inspecting Company</SelectItem>
                              <SelectItem value="1.10">1.10 - Boarding Time</SelectItem>
                              <SelectItem value="1.11">1.11 - Departure Time</SelectItem>
                              <SelectItem value="1.12">1.12 - Inspection Duration</SelectItem>
                              <SelectItem value="1.13">1.13 - Inspector Name</SelectItem>
                              <SelectItem value="1.14">1.14 - HVPQ Available</SelectItem>
                              <SelectItem value="1.15">1.15 - Vessel Operation</SelectItem>
                              <SelectItem value="1.16">1.16 - Products Being Handled</SelectItem>
                              <SelectItem value="1.17">1.17 - Vessel Type</SelectItem>
                              <SelectItem value="1.18">1.18 - Hull Type</SelectItem>
                              <SelectItem value="1.19">1.19 - Operator Name</SelectItem>
                              <SelectItem value="1.20">1.20 - Operator Responsibility Date</SelectItem>
                              <SelectItem value="1.21">1.21 - Last PSC Inspection Date</SelectItem>
                              <SelectItem value="1.22">1.22 - Last PSC Port</SelectItem>
                              <SelectItem value="1.23">1.23 - Classification Society</SelectItem>
                              <SelectItem value="1.24">1.24 - Class Certificate Expiry</SelectItem>
                              <SelectItem value="1.25">1.25 - Last Drydock Date</SelectItem>
                              <SelectItem value="1.26">1.26 - Class Survey Records</SelectItem>

                              {/* Chapter 2: Certification and Documentation */}
                              <SelectItem value="2.1">2.1 - Statutory Certificates Valid</SelectItem>
                              <SelectItem value="2.1.1">2.1.1 - Certificate of Registry</SelectItem>
                              <SelectItem value="2.1.2">2.1.2 - Continuous Synopsis Record</SelectItem>
                              <SelectItem value="2.1.3">2.1.3 - Document of Compliance (DoC)</SelectItem>
                              <SelectItem value="2.1.4">2.1.4 - Safety Management Certificate (SMC)</SelectItem>
                              <SelectItem value="2.1.5">2.1.5 - Safety Equipment Certificate</SelectItem>
                              <SelectItem value="2.1.6">2.1.6 - Safety Radio Certificate</SelectItem>
                              <SelectItem value="2.1.7">2.1.7 - Safety Construction Certificate</SelectItem>
                              <SelectItem value="2.1.8">2.1.8 - IOPP Certificate</SelectItem>
                              <SelectItem value="2.1.9">2.1.9 - Vessel Designation (IOPP)</SelectItem>
                              <SelectItem value="2.1.10">2.1.10 - Minimum Safe Manning Document</SelectItem>
                              <SelectItem value="2.1.11">2.1.11 - Certificate of Fitness</SelectItem>
                              <SelectItem value="2.1.12">2.1.12 - NLS Certificate</SelectItem>
                              <SelectItem value="2.1.13">2.1.13 - Civil Liability Certificate</SelectItem>
                              <SelectItem value="2.1.14">2.1.14 - Maritime Labour Convention (MLC)</SelectItem>
                              <SelectItem value="2.1.15">2.1.15 - Ballast Water Management Certificate</SelectItem>
                              <SelectItem value="2.2">2.2 - P&I Club Member</SelectItem>
                              <SelectItem value="2.3">2.3 - Procedures Manuals Comply with ISM</SelectItem>
                              <SelectItem value="2.4">2.4 - Operator Representative Visits</SelectItem>
                              <SelectItem value="2.5">2.5 - Internal Audit Report Available</SelectItem>
                              <SelectItem value="2.6">2.6 - Master Reviews Safety Management</SelectItem>
                              <SelectItem value="2.7">2.7 - Free of Conditions of Class</SelectItem>
                              <SelectItem value="2.8">2.8 - Enrolled in CAP</SelectItem>
                              <SelectItem value="2.9">2.9 - Regular Tank Inspections</SelectItem>
                              <SelectItem value="2.10">2.10 - Oil Record Books Correct</SelectItem>
                              <SelectItem value="2.11">2.11 - Engine Room Oily Water Disposal</SelectItem>
                              <SelectItem value="2.12">2.12 - VOC Management Plan</SelectItem>
                              <SelectItem value="2.13">2.13 - Ballast Water Management Plan</SelectItem>
                              <SelectItem value="2.14">2.14 - Ship Energy Efficiency Management Plan (SEEMP)</SelectItem>
                              <SelectItem value="2.15">2.15 - Free of Structural Concerns</SelectItem>
                              <SelectItem value="2.16">2.16 - Tanks in Good Order</SelectItem>

                              {/* Chapter 3: Crew Management (3.1-3.8) */}
                              <SelectItem value="3.1">3.1 - Manning Level Adequate</SelectItem>
                              <SelectItem value="3.2">3.2 - STCW Hours of Work Compliance</SelectItem>
                              <SelectItem value="3.3">3.3 - Master Competency Certificates</SelectItem>
                              <SelectItem value="3.4">3.4 - Deck Officers Certificates</SelectItem>
                              <SelectItem value="3.5">3.5 - Engineer Officers Certificates</SelectItem>
                              <SelectItem value="3.6">3.6 - Radio Officers Certificates</SelectItem>
                              <SelectItem value="3.7">3.7 - Bridge Team Familiarization</SelectItem>
                              <SelectItem value="3.8">3.8 - Drug and Alcohol Policy</SelectItem>

                              {/* Chapter 4: Navigation and Communications */}
                              <SelectItem value="4.1">4.1 - Navigation Procedures Familiarity</SelectItem>
                              <SelectItem value="4.2">4.2 - Navigational Activities Record</SelectItem>
                              <SelectItem value="4.3">4.3 - Bridge Equipment Testing Procedures</SelectItem>
                              <SelectItem value="4.4">4.4 - Fire and Safety Rounds</SelectItem>
                              <SelectItem value="4.5">4.5 - Under Keel Clearance Policy</SelectItem>
                              <SelectItem value="4.6">4.6 - Bridge Manning and Lookout</SelectItem>
                              <SelectItem value="4.7">4.7 - Navigation Equipment in Good Order</SelectItem>
                              <SelectItem value="4.7.1">4.7.1 - GNSS Receiver</SelectItem>
                              <SelectItem value="4.7.2">4.7.2 - Navtex Receiver</SelectItem>
                              <SelectItem value="4.7.3">4.7.3 - Whistle, Bell and Gong</SelectItem>
                              <SelectItem value="4.7.4">4.7.4 - Shapes</SelectItem>
                              <SelectItem value="4.7.5">4.7.5 - Standard Magnetic Compass</SelectItem>
                              <SelectItem value="4.7.6">4.7.6 - Steering Magnetic Compass</SelectItem>
                              <SelectItem value="4.7.7">4.7.7 - Means for Taking Bearings</SelectItem>
                              <SelectItem value="4.7.8">4.7.8 - Spare Magnetic Compass</SelectItem>
                              <SelectItem value="4.7.9">4.7.9 - Emergency Steering Telephone</SelectItem>
                              <SelectItem value="4.7.10">4.7.10 - Daylight Signalling Lamp</SelectItem>
                              <SelectItem value="4.7.11">4.7.11 - AIS System</SelectItem>
                              <SelectItem value="4.8">4.8 - Charts and Publications Updated</SelectItem>
                              <SelectItem value="4.9">4.9 - Passage Planning Procedures</SelectItem>
                              <SelectItem value="4.10">4.10 - Echo Sounding Equipment</SelectItem>
                              <SelectItem value="4.11">4.11 - Speed and Distance Measuring Device</SelectItem>
                              <SelectItem value="4.12">4.12 - Main Steering Gear</SelectItem>
                              <SelectItem value="4.13">4.13 - Auxiliary Steering Gear</SelectItem>
                              <SelectItem value="4.14">4.14 - Gyro Compass</SelectItem>
                              <SelectItem value="4.15">4.15 - Radar Installation</SelectItem>
                              <SelectItem value="4.16">4.16 - ECDIS Installation</SelectItem>
                              <SelectItem value="4.17">4.17 - Voyage Data Recorder (VDR)</SelectItem>
                              <SelectItem value="4.18">4.18 - Electronic Position Fixing Systems</SelectItem>
                              <SelectItem value="4.19">4.19 - Bridge Navigational Watch Alarm System (BNWAS)</SelectItem>
                              <SelectItem value="4.20">4.20 - Sound Reception System</SelectItem>
                              <SelectItem value="4.21">4.21 - Telephone Communication</SelectItem>
                              <SelectItem value="4.22">4.22 - General Alarm System</SelectItem>
                              <SelectItem value="4.23">4.23 - Radio Equipment and Logs</SelectItem>
                              <SelectItem value="4.24">4.24 - Radio Equipment Maintenance</SelectItem>
                              <SelectItem value="4.25">4.25 - Satellite EPIRB</SelectItem>
                              <SelectItem value="4.26">4.26 - Portable Radios for Deck Use</SelectItem>
                              <SelectItem value="4.27">4.27 - Survival Craft VHF Radios</SelectItem>

                              {/* Chapter 5: Safety Management (5.1-5.48) */}
                              <SelectItem value="5.1">5.1 - Risk Assessment Process</SelectItem>
                              <SelectItem value="5.2">5.2 - Permit to Work System</SelectItem>
                              <SelectItem value="5.3">5.3 - Safety Officer Training</SelectItem>
                              <SelectItem value="5.4">5.4 - Firefighting Equipment Familiarization</SelectItem>
                              <SelectItem value="5.5">5.5 - Personal Protective Equipment (PPE)</SelectItem>
                              <SelectItem value="5.6">5.6 - Intrinsically Safe Equipment</SelectItem>
                              <SelectItem value="5.7">5.7 - Safety Meetings</SelectItem>
                              <SelectItem value="5.8">5.8 - Accident Reporting System</SelectItem>
                              <SelectItem value="5.9">5.9 - ISGOTT Ship/Shore Safety Checklist</SelectItem>
                              <SelectItem value="5.10">5.10 - Doors and Ports Closed</SelectItem>
                              <SelectItem value="5.11">5.11 - Loose Gear Secured</SelectItem>
                              <SelectItem value="5.12">5.12 - Fire and Safety Equipment Familiarization</SelectItem>
                              <SelectItem value="5.13">5.13 - Abandon Ship Drills</SelectItem>
                              <SelectItem value="5.14">5.14 - Fire Drills</SelectItem>
                              <SelectItem value="5.15">5.15 - Enclosed Space Entry Drills</SelectItem>
                              <SelectItem value="5.16">5.16 - Emergency Steering Drills</SelectItem>
                              <SelectItem value="5.17">5.17 - MOB Drills</SelectItem>
                              <SelectItem value="5.18">5.18 - Oil Pollution Emergency Plan</SelectItem>
                              <SelectItem value="5.19">5.19 - Shipboard Marine Pollution Emergency Plan</SelectItem>
                              <SelectItem value="5.20">5.20 - Emergency Procedures and Contingency Plans</SelectItem>
                              <SelectItem value="5.21">5.21 - Muster List</SelectItem>
                              <SelectItem value="5.22">5.22 - Lifeboats and Launching Equipment</SelectItem>
                              <SelectItem value="5.23">5.23 - Lifeboat Equipment</SelectItem>
                              <SelectItem value="5.24">5.24 - Fast Rescue Boat</SelectItem>
                              <SelectItem value="5.25">5.25 - Lifeboat Davits and Winches</SelectItem>
                              <SelectItem value="5.26">5.26 - Liferaft Servicing</SelectItem>
                              <SelectItem value="5.27">5.27 - Liferaft Hydrostatic Release</SelectItem>
                              <SelectItem value="5.28">5.28 - Embarkation Ladders</SelectItem>
                              <SelectItem value="5.29">5.29 - Pilot Ladder and Accommodation Ladder</SelectItem>
                              <SelectItem value="5.30">5.30 - Lifebuoy and Line Throwing Equipment</SelectItem>
                              <SelectItem value="5.31">5.31 - Distress Flares and Signals</SelectItem>
                              <SelectItem value="5.32">5.32 - Lifejackets</SelectItem>
                              <SelectItem value="5.33">5.33 - Immersion Suits</SelectItem>
                              <SelectItem value="5.34">5.34 - Fire Training Manuals</SelectItem>
                              <SelectItem value="5.35">5.35 - Fixed Firefighting Equipment</SelectItem>
                              <SelectItem value="5.36">5.36 - Foam Compound Testing</SelectItem>
                              <SelectItem value="5.37">5.37 - International Shore Connection</SelectItem>
                              <SelectItem value="5.38">5.38 - Fire Mains and Equipment</SelectItem>
                              <SelectItem value="5.39">5.39 - Fire Detection and Alarm Systems</SelectItem>
                              <SelectItem value="5.40">5.40 - Fixed Fire Extinguishing Systems</SelectItem>
                              <SelectItem value="5.41">5.41 - Emergency Fire Pump</SelectItem>
                              <SelectItem value="5.42">5.42 - Portable Fire Extinguishers</SelectItem>
                              <SelectItem value="5.43">5.43 - Fireman's Outfits and Breathing Apparatus</SelectItem>
                              <SelectItem value="5.44">5.44 - Emergency Escape Breathing Devices (EEBD)</SelectItem>
                              <SelectItem value="5.45">5.45 - Fire Doors and Dampers</SelectItem>
                              <SelectItem value="5.46">5.46 - Inert Gas System (IGS)</SelectItem>
                              <SelectItem value="5.47">5.47 - Fixed Deck Foam System</SelectItem>
                              <SelectItem value="5.48">5.48 - Gas Detection Equipment</SelectItem>

                              {/* Chapter 6: Pollution Prevention (6.1-6.11) */}
                              <SelectItem value="6.1">6.1 - Shipboard Oil Pollution Emergency Plan</SelectItem>
                              <SelectItem value="6.2">6.2 - Garbage Management Plan</SelectItem>
                              <SelectItem value="6.3">6.3 - Garbage Record Book</SelectItem>
                              <SelectItem value="6.4">6.4 - Cargo Residue Disposal</SelectItem>
                              <SelectItem value="6.5">6.5 - Sewage Treatment System</SelectItem>
                              <SelectItem value="6.6">6.6 - Ozone-Depleting Substances</SelectItem>
                              <SelectItem value="6.7">6.7 - Exhaust Gas Emission Compliance</SelectItem>
                              <SelectItem value="6.8">6.8 - VOC Emissions Control</SelectItem>
                              <SelectItem value="6.9">6.9 - Fuel Oil Quality</SelectItem>
                              <SelectItem value="6.10">6.10 - Incinerator Operation</SelectItem>
                              <SelectItem value="6.11">6.11 - Anti-Fouling Systems</SelectItem>

                              {/* Chapter 7: Maritime Security (7.1-7.17) */}
                              <SelectItem value="7.1">7.1 - Ship Security Plan</SelectItem>
                              <SelectItem value="7.2">7.2 - Ship Security Officer</SelectItem>
                              <SelectItem value="7.3">7.3 - Ship Security Assessment</SelectItem>
                              <SelectItem value="7.4">7.4 - Security Equipment</SelectItem>
                              <SelectItem value="7.5">7.5 - Security Drills and Training</SelectItem>
                              <SelectItem value="7.6">7.6 - International Ship Security Certificate (ISSC)</SelectItem>
                              <SelectItem value="7.7">7.7 - Security Level Implementation</SelectItem>
                              <SelectItem value="7.8">7.8 - Restricted Area Access</SelectItem>
                              <SelectItem value="7.9">7.9 - Deck and Hull Integrity</SelectItem>
                              <SelectItem value="7.10">7.10 - Security Communication</SelectItem>
                              <SelectItem value="7.11">7.11 - Security Alarms</SelectItem>
                              <SelectItem value="7.12">7.12 - Ship Security Alert System (SSAS)</SelectItem>
                              <SelectItem value="7.13">7.13 - Access Control</SelectItem>
                              <SelectItem value="7.14">7.14 - Surveillance and Monitoring</SelectItem>
                              <SelectItem value="7.15">7.15 - Security Records</SelectItem>
                              <SelectItem value="7.16">7.16 - Security Incident Procedures</SelectItem>
                              <SelectItem value="7.17">7.17 - Declaration of Security (DoS)</SelectItem>

                              {/* Chapter 8: Cargo and Ballast Systems (varies by ship type) */}
                              <SelectItem value="8.1">8.1 - Cargo System Knowledge</SelectItem>
                              <SelectItem value="8.2">8.2 - Cargo Handling Procedures</SelectItem>
                              <SelectItem value="8.3">8.3 - Cargo Tank Inspection</SelectItem>
                              <SelectItem value="8.4">8.4 - Cargo Pumps and Piping</SelectItem>
                              <SelectItem value="8.5">8.5 - Cargo Tank Venting</SelectItem>
                              <SelectItem value="8.6">8.6 - Cargo Tank Gauging</SelectItem>
                              <SelectItem value="8.7">8.7 - Cargo Sample Points</SelectItem>
                              <SelectItem value="8.8">8.8 - Loading Computer</SelectItem>
                              <SelectItem value="8.9">8.9 - Cargo Control Room</SelectItem>
                              <SelectItem value="8.10">8.10 - Emergency Shutdown Systems (ESD)</SelectItem>

                              {/* Chapter 9: Mooring and Anchoring (9.1-9.25) */}
                              <SelectItem value="9.1">9.1 - Mooring Equipment Inspection</SelectItem>
                              <SelectItem value="9.2">9.2 - Wire Ropes and Lines</SelectItem>
                              <SelectItem value="9.3">9.3 - Mooring Winches and Brakes</SelectItem>
                              <SelectItem value="9.4">9.4 - Fairleads and Bitts</SelectItem>
                              <SelectItem value="9.5">9.5 - Mooring Procedure</SelectItem>
                              <SelectItem value="9.6">9.6 - Mooring Line Management</SelectItem>
                              <SelectItem value="9.7">9.7 - Anchor Equipment</SelectItem>
                              <SelectItem value="9.8">9.8 - Anchor Windlass</SelectItem>
                              <SelectItem value="9.9">9.9 - Anchor Chain</SelectItem>
                              <SelectItem value="9.10">9.10 - Chain Locker</SelectItem>

                              {/* Chapter 10: Engine and Steering Compartments (10.1-10.44) */}
                              <SelectItem value="10.1">10.1 - Engine Room Procedures</SelectItem>
                              <SelectItem value="10.2">10.2 - Main Engine Operation</SelectItem>
                              <SelectItem value="10.3">10.3 - Auxiliary Engines</SelectItem>
                              <SelectItem value="10.4">10.4 - Boiler Operation</SelectItem>
                              <SelectItem value="10.5">10.5 - Fuel Oil System</SelectItem>
                              <SelectItem value="10.6">10.6 - Lub Oil System</SelectItem>
                              <SelectItem value="10.7">10.7 - Cooling Water System</SelectItem>
                              <SelectItem value="10.8">10.8 - Compressed Air System</SelectItem>
                              <SelectItem value="10.9">10.9 - Steering Gear</SelectItem>
                              <SelectItem value="10.10">10.10 - Emergency Generator</SelectItem>
                              <SelectItem value="10.11">10.11 - Electrical System</SelectItem>
                              <SelectItem value="10.12">10.12 - Bilge System</SelectItem>
                              <SelectItem value="10.13">10.13 - Ballast System</SelectItem>
                              <SelectItem value="10.14">10.14 - Machinery Maintenance Records</SelectItem>
                              <SelectItem value="10.15">10.15 - Engine Room Cleanliness</SelectItem>

                              {/* Chapter 11: General Appearance and Condition (11.1-11.9) */}
                              <SelectItem value="11.1">11.1 - Hull Condition</SelectItem>
                              <SelectItem value="11.2">11.2 - Deck Condition</SelectItem>
                              <SelectItem value="11.3">11.3 - Accommodation Condition</SelectItem>
                              <SelectItem value="11.4">11.4 - Galley and Provisions</SelectItem>
                              <SelectItem value="11.5">11.5 - Sanitary Facilities</SelectItem>
                              <SelectItem value="11.6">11.6 - Recreational Facilities</SelectItem>
                              <SelectItem value="11.7">11.7 - General Housekeeping</SelectItem>
                              <SelectItem value="11.8">11.8 - Pest Control</SelectItem>
                              <SelectItem value="11.9">11.9 - Vessel Overall Appearance</SelectItem>

                              {/* Chapter 12: Ice Operations (12.1-12.4) */}
                              <SelectItem value="12.1">12.1 - Ice Class Certificate</SelectItem>
                              <SelectItem value="12.2">12.2 - Ice Navigation Procedures</SelectItem>
                              <SelectItem value="12.3">12.3 - Ice Navigation Equipment</SelectItem>
                              <SelectItem value="12.4">12.4 - Ice Operations Training</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600 uppercase font-normal">VIQ Chapter</Label>
                      <Controller
                        name="viqChapter"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                            <SelectTrigger data-testid="select-viq-chapter" className="h-9 text-sm border-gray-300">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              <SelectItem value="General Information">General Information</SelectItem>
                              <SelectItem value="Certification and Documentation">Certification and Documentation</SelectItem>
                              <SelectItem value="Crew Management">Crew Management</SelectItem>
                              <SelectItem value="Navigation and Communications">Navigation and Communications</SelectItem>
                              <SelectItem value="Safety Management">Safety Management</SelectItem>
                              <SelectItem value="Pollution Prevention">Pollution Prevention</SelectItem>
                              <SelectItem value="Maritime Security">Maritime Security</SelectItem>
                              <SelectItem value="Cargo and Ballast Systems">Cargo and Ballast Systems</SelectItem>
                              <SelectItem value="Mooring and Anchoring">Mooring and Anchoring</SelectItem>
                              <SelectItem value="Machinery Spaces">Machinery Spaces</SelectItem>
                              <SelectItem value="General Appearance and Condition">General Appearance and Condition</SelectItem>
                              <SelectItem value="Ice Operations">Ice Operations</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600 uppercase font-normal">VIQ Section</Label>
                      <Controller
                        name="viqSection"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                            <SelectTrigger data-testid="select-viq-section" className="h-9 text-sm border-gray-300">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              <SelectItem value="Certification">Certification</SelectItem>
                              <SelectItem value="Safety management and the operator's procedures manuals">Safety management and the operator's procedures manuals</SelectItem>
                              <SelectItem value="Survey and repair history">Survey and repair history</SelectItem>
                              <SelectItem value="Crewing and Manning">Crewing and Manning</SelectItem>
                              <SelectItem value="Bridge Navigation Systems">Bridge Navigation Systems</SelectItem>
                              <SelectItem value="Communication Equipment">Communication Equipment</SelectItem>
                              <SelectItem value="Fire Fighting and Life Saving">Fire Fighting and Life Saving</SelectItem>
                              <SelectItem value="Emergency Equipment">Emergency Equipment</SelectItem>
                              <SelectItem value="Drills and Training">Drills and Training</SelectItem>
                              <SelectItem value="Enclosed Spaces">Enclosed Spaces</SelectItem>
                              <SelectItem value="Environmental Protection">Environmental Protection</SelectItem>
                              <SelectItem value="MARPOL Compliance">MARPOL Compliance</SelectItem>
                              <SelectItem value="Security Procedures">Security Procedures</SelectItem>
                              <SelectItem value="Cargo Handling Equipment">Cargo Handling Equipment</SelectItem>
                              <SelectItem value="Ballast Systems">Ballast Systems</SelectItem>
                              <SelectItem value="Mooring Equipment">Mooring Equipment</SelectItem>
                              <SelectItem value="Engine Room Systems">Engine Room Systems</SelectItem>
                              <SelectItem value="Steering Systems">Steering Systems</SelectItem>
                              <SelectItem value="Hull and Structure">Hull and Structure</SelectItem>
                              <SelectItem value="Deck Condition">Deck Condition</SelectItem>
                              <SelectItem value="Accommodation">Accommodation</SelectItem>
                              <SelectItem value="Ice Navigation Equipment">Ice Navigation Equipment</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Actions */}
            <div className="mt-8 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#1976d2]">Actions</h2>
                <p className="text-sm text-cyan-600 mt-1">Part B - Corrective and Preventive Actions</p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-gray-800">Action Plan</h3>
                  <Button 
                    onClick={openAddActionModal}
                    size="sm"
                    className="bg-[#1976d2] hover:bg-[#1565c0] text-white h-9"
                    data-testid="button-add-action"
                    disabled={isViewMode}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Action
                  </Button>
                </div>

                {actions.length > 0 ? (
                  <div className="border border-gray-300 rounded overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-xs font-medium">Action Type</TableHead>
                          <TableHead className="text-xs font-medium">Description</TableHead>
                          <TableHead className="text-xs font-medium">Proposed By</TableHead>
                          <TableHead className="text-xs font-medium">Responsibility</TableHead>
                          <TableHead className="text-xs font-medium">Due Date</TableHead>
                          <TableHead className="text-xs font-medium">Status</TableHead>
                          <TableHead className="text-xs font-medium">Actions</TableHead>
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

              <div className="flex justify-end pt-2">
                <Button 
                  type="button"
                  onClick={() => handleStepSubmit(2)}
                  className="bg-[#1976d2] hover:bg-[#1565c0] text-white h-9 px-8 font-medium"
                  data-testid="button-submit-step2"
                  disabled={isViewMode}
                >
                  SUBMIT
                </Button>
              </div>
            </div>

            {/* Step 3: Closeout */}
            <div className="mt-8 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#1976d2]">Closeout</h2>
                <p className="text-sm text-cyan-600 mt-1">Part C - Completion and Approval</p>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600 uppercase font-normal">Date Completed</Label>
                  <Input 
                    {...form.register("dateCompleted")} 
                    type="date"
                    data-testid="input-date-completed"
                    className="h-9 text-sm border-gray-300"
                    disabled={isViewMode}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600 uppercase font-normal">Verified Date</Label>
                  <Input 
                    {...form.register("verifiedDate")} 
                    type="date"
                    data-testid="input-verified-date"
                    className="h-9 text-sm border-gray-300"
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

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600 uppercase font-normal">Closed By</Label>
                <Input 
                  {...form.register("closedBy")} 
                  data-testid="input-closed-by"
                  className="h-9 text-sm border-gray-300"
                  placeholder="Name & Rank"
                  disabled={isViewMode}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button 
                  type="button"
                  onClick={form.handleSubmit(onSubmit)}
                  className="bg-[#1976d2] hover:bg-[#1565c0] text-white h-9 px-8 font-medium"
                  data-testid="button-submit-step3"
                  disabled={isViewMode}
                >
                  SUBMIT
                </Button>
              </div>
            </div>
            
            </div> {/* Close BIG WHITE CONTAINER CARD */}
          </div>
        </div>
      </div>
    </div>

    {/* Modals - Outside main content, inside main container */}
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
