import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Plus, Edit, Trash2, ArrowLeft, Eye } from "lucide-react";
import { insertDefectSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";

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
    },
  });

  const onSubmit = async (data: DefectFormData) => {
    try {
      const submitData = {
        ...data,
        id: params.id || defectId,
      };
      
      if (params.id) {
        await apiRequest("PATCH", `/api/defects/${params.id}`, submitData);
        toast({ title: "Defect updated successfully" });
      } else {
        await apiRequest("POST", "/api/defects", submitData);
        toast({ title: "Defect created successfully" });
      }
      queryClient.invalidateQueries({ queryKey: ['defects'] });
      setLocation("/defects/active");
    } catch (error) {
      console.error("Defect save error:", error);
      toast({ 
        title: "Error", 
        description: "Failed to save defect",
        variant: "destructive" 
      });
    }
  };

  const addAction = () => {
    const newAction: Action = {
      id: Date.now().toString(),
      actionType: "Corrective Action",
      actionDescription: "",
      proposedBy: form.getValues("reportedBy") || "MASTER",
      responsibility: "Chief Engineer",
      dueDate: new Date().toISOString().split('T')[0],
      status: "Pending",
    };
    setActions([...actions, newAction]);
  };

  const deleteAction = (id: string) => {
    setActions(actions.filter(a => a.id !== id));
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Steps Only */}
      <div className="w-52 bg-white flex flex-col">
        {/* Step circles */}
        <div className="flex-1 pt-6">
          <div 
            onClick={() => setCurrentStep(1)} 
            className={`flex items-center gap-3 px-6 py-3 mb-1 cursor-pointer ${currentStep === 1 ? 'bg-blue-50' : ''}`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
              currentStep === 1 
                ? 'bg-[#1976d2] text-white' 
                : 'border-2 border-gray-400 text-gray-500 bg-white'
            }`}>
              1
            </div>
            <span className={`text-sm ${currentStep === 1 ? 'text-gray-900' : 'text-gray-600'}`}>
              Reporting
            </span>
          </div>

          <div 
            onClick={() => setCurrentStep(2)} 
            className={`flex items-center gap-3 px-6 py-3 mb-1 cursor-pointer ${currentStep === 2 ? 'bg-blue-50' : ''}`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
              currentStep === 2 
                ? 'bg-[#1976d2] text-white' 
                : 'border-2 border-gray-400 text-gray-500 bg-white'
            }`}>
              2
            </div>
            <span className={`text-sm ${currentStep === 2 ? 'text-gray-900' : 'text-gray-600'}`}>
              Actions
            </span>
          </div>

          <div 
            onClick={() => setCurrentStep(3)} 
            className={`flex items-center gap-3 px-6 py-3 mb-1 cursor-pointer ${currentStep === 3 ? 'bg-blue-50' : ''}`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
              currentStep === 3 
                ? 'bg-[#1976d2] text-white' 
                : 'border-2 border-gray-400 text-gray-500 bg-white'
            }`}>
              3
            </div>
            <span className={`text-sm ${currentStep === 3 ? 'text-gray-900' : 'text-gray-600'}`}>
              Closeout
            </span>
          </div>
        </div>

        {/* Back button at bottom of sidebar */}
        <div className="p-4 border-t border-gray-200">
          <Button
            variant="ghost"
            onClick={() => setLocation("/defects/active")}
            className="w-full justify-start text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Top Action Bar - Right aligned buttons only */}
        <div className="h-14 border-b border-gray-200 px-6 flex items-center justify-end bg-white">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="text-gray-700 border-gray-300 h-9"
              data-testid="button-view"
            >
              <Eye className="h-4 w-4 mr-2" />
              View
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

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto bg-white">
          <div className="p-8 space-y-6">
            {/* Report Title - Left aligned with Report ID on right */}
            <div className="flex justify-between items-center pb-4 border-b border-gray-200">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Defect Report</h1>
                <p className="text-xs text-gray-500 mt-0.5">{defectId}</p>
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-normal">Report ID :</span>
              </div>
            </div>

            {/* Step 1: Reporting */}
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-[#1976d2]">Reporting</h2>
                <p className="text-sm text-cyan-500">Part A - Describe what happened</p>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-800">Details</h3>
                
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  {/* Row 1 */}
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

                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-600 uppercase font-normal">Category</Label>
                    <Controller
                      name="equipmentCategory"
                      control={form.control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || ""}>
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

                  {/* Row 2 */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-600 uppercase font-normal">Source</Label>
                    <Controller
                      name="source"
                      control={form.control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || ""}>
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
                    <Label className="text-xs text-gray-600 uppercase font-normal">Date Issued*</Label>
                    <Input 
                      {...form.register("issueDate")} 
                      type="date"
                      data-testid="input-date-issued"
                      className="h-9 text-sm border-gray-300"
                    />
                  </div>

                  {/* Row 3 */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-600 uppercase font-normal">Defect Category</Label>
                    <Controller
                      name="defectCategory"
                      control={form.control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <SelectTrigger data-testid="select-defect-category" className="h-9 text-sm border-gray-300">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Minor">Minor</SelectItem>
                            <SelectItem value="Major">Major</SelectItem>
                            <SelectItem value="Catastrophic">Catastrophic</SelectItem>
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
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <SelectTrigger data-testid="select-equipment-type" className="h-9 text-sm border-gray-300">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pump">Pump</SelectItem>
                            <SelectItem value="Engine">Engine</SelectItem>
                            <SelectItem value="Valve">Valve</SelectItem>
                            <SelectItem value="Sensor">Sensor</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {/* Row 4 */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-600 uppercase font-normal">Defect Type</Label>
                    <Controller
                      name="defectType"
                      control={form.control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <SelectTrigger data-testid="select-defect-type" className="h-9 text-sm border-gray-300">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Routine">Routine</SelectItem>
                            <SelectItem value="Corrective">Corrective</SelectItem>
                            <SelectItem value="Emergency">Emergency</SelectItem>
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
                    />
                  </div>

                  {/* Row 5 */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-600 uppercase font-normal">Make</Label>
                    <Controller
                      name="equipmentMake"
                      control={form.control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || ""}>
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
                    />
                  </div>

                  {/* Row 6 */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-600 uppercase font-normal">Model</Label>
                    <Controller
                      name="equipmentModel"
                      control={form.control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || ""}>
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
                    />
                  )}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button 
                  type="button"
                  className="bg-[#1976d2] hover:bg-[#1565c0] text-white h-9 px-8 font-medium"
                  data-testid="button-submit-step1"
                >
                  SUBMIT
                </Button>
              </div>
            </div>

            {/* Step 2: Actions */}
            <div className="space-y-6 pt-4">
              <div>
                <h2 className="text-base font-semibold text-[#1976d2]">Actions</h2>
                <p className="text-sm text-cyan-500">Part B - Corrective and Preventive Actions</p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-gray-800">Action Plan</h3>
                  <Button 
                    onClick={addAction}
                    size="sm"
                    className="bg-[#1976d2] hover:bg-[#1565c0] text-white h-9"
                    data-testid="button-add-action"
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
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-7 w-7 p-0"
                                  onClick={() => deleteAction(action.id)}
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
                  className="bg-[#1976d2] hover:bg-[#1565c0] text-white h-9 px-8 font-medium"
                  data-testid="button-submit-step2"
                >
                  SUBMIT
                </Button>
              </div>
            </div>

            {/* Step 3: Closeout */}
            <div className="space-y-6 pt-4">
              <div>
                <h2 className="text-base font-semibold text-[#1976d2]">Closeout</h2>
                <p className="text-sm text-cyan-500">Part C - Completion and Approval</p>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600 uppercase font-normal">Date Completed</Label>
                  <Input 
                    {...form.register("dateCompleted")} 
                    type="date"
                    data-testid="input-date-completed"
                    className="h-9 text-sm border-gray-300"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600 uppercase font-normal">Verified Date</Label>
                  <Input 
                    {...form.register("verifiedDate")} 
                    type="date"
                    data-testid="input-verified-date"
                    className="h-9 text-sm border-gray-300"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-800">Attachments</h3>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-1">Drop files here or click to upload</p>
                  <p className="text-xs text-gray-500 mb-3">PDF, JPG, PNG up to 10MB</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="border-gray-300"
                    data-testid="button-upload-attachment"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Browse Files
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600 uppercase font-normal">Closed By</Label>
                <Input 
                  {...form.register("closedBy")} 
                  data-testid="input-closed-by"
                  className="h-9 text-sm border-gray-300"
                  placeholder="Name & Rank"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button 
                  type="button"
                  className="bg-[#1976d2] hover:bg-[#1565c0] text-white h-9 px-8 font-medium"
                  data-testid="button-submit-step3"
                >
                  SUBMIT
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
