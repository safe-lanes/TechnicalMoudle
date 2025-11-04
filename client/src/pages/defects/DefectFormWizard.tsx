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
import { Upload, Eye, Plus, Edit, Trash2 } from "lucide-react";
import { insertDefectSchema, type InsertDefect, type Defect } from "@shared/schema";
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
  const [showActionForm, setShowActionForm] = useState(false);
  
  // Generate reference number (format: DN/007/21/1243/V)
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
        id: params.id || defectId, // Use existing id for edit, or generated id for new
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
    setShowActionForm(true);
  };

  const deleteAction = (id: string) => {
    setActions(actions.filter(a => a.id !== id));
  };

  // Step navigation styles
  const stepItemClass = (step: number) => {
    return currentStep === step
      ? "flex items-center gap-3 p-4 bg-blue-50 border-l-4 border-blue-600 cursor-pointer"
      : "flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer";
  };

  const stepNumberClass = (step: number) => {
    return currentStep === step
      ? "w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm"
      : "w-8 h-8 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center font-semibold text-sm";
  };

  const stepTextClass = (step: number) => {
    return currentStep === step
      ? "font-semibold text-gray-800"
      : "text-gray-600";
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Left Sidebar - Steps Navigation */}
      <div className="w-64 border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-lg font-semibold text-gray-800">Defect Report</h1>
          <p className="text-xs text-gray-500 mt-1">{defectId}</p>
        </div>
        
        <div className="flex-1">
          <div onClick={() => setCurrentStep(1)} className={stepItemClass(1)}>
            <div className={stepNumberClass(1)}>1</div>
            <span className={stepTextClass(1)}>Reporting</span>
          </div>
          
          <div onClick={() => setCurrentStep(2)} className={stepItemClass(2)}>
            <div className={stepNumberClass(2)}>2</div>
            <span className={stepTextClass(2)}>Actions</span>
          </div>
          
          <div onClick={() => setCurrentStep(3)} className={stepItemClass(3)}>
            <div className={stepNumberClass(3)}>3</div>
            <span className={stepTextClass(3)}>Closeout</span>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex gap-2">
          <Button
            variant="outline"
            onClick={() => setLocation("/defects/active")}
            className="flex-1"
            data-testid="button-back"
          >
            ← Back
          </Button>
          <Button
            onClick={form.handleSubmit(onSubmit)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="button-save"
          >
            SAVE
          </Button>
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8">
          {/* Step 1: Reporting */}
          {currentStep === 1 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-semibold text-blue-600 mb-1">Reporting</h2>
                <p className="text-sm text-gray-500">Part A - Describe what happened</p>
              </div>

              {/* Details Section */}
              <div>
                <h3 className="text-sm font-semibold text-blue-600 mb-4 pb-2 border-b">Details</h3>
                
                <div className="grid grid-cols-3 gap-6">
                  {/* Column 1: Basic */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600">VESSEL*</Label>
                      <Controller
                        name="vesselId"
                        control={form.control}
                        render={({ field }) => (
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              // Update vesselName based on vesselId
                              const vesselNames: Record<string, string> = {
                                "V001": "MV SEAFARER",
                                "V002": "MV VOYAGER",
                                "V003": "MV EXPLORER"
                              };
                              form.setValue("vesselName", vesselNames[value] || "");
                            }} 
                            value={field.value}
                          >
                            <SelectTrigger data-testid="select-vessel" className="h-9">
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

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600">SOURCE</Label>
                      <Controller
                        name="source"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <SelectTrigger data-testid="select-source" className="h-9">
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

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600">DEFECT CATEGORY</Label>
                      <Controller
                        name="defectCategory"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <SelectTrigger data-testid="select-defect-category" className="h-9">
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

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600">DEFECT TYPE</Label>
                      <Controller
                        name="defectType"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <SelectTrigger data-testid="select-defect-type" className="h-9">
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
                  </div>

                  {/* Column 2: Equipment/Hardware */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600">CATEGORY</Label>
                      <Controller
                        name="equipmentCategory"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <SelectTrigger data-testid="select-equipment-category" className="h-9">
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

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600">TYPE</Label>
                      <Controller
                        name="equipmentType"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <SelectTrigger data-testid="select-equipment-type" className="h-9">
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

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600">MAKE</Label>
                      <Controller
                        name="equipmentMake"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <SelectTrigger data-testid="select-make" className="h-9">
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

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600">MODEL</Label>
                      <Controller
                        name="equipmentModel"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <SelectTrigger data-testid="select-model" className="h-9">
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
                  </div>

                  {/* Column 3: Date */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600">DATE ISSUED*</Label>
                      <Input 
                        {...form.register("issueDate")} 
                        type="date"
                        data-testid="input-date-issued"
                        className="h-9"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600">TARGET DATE</Label>
                      <Input 
                        {...form.register("targetCloseDate")} 
                        type="date"
                        data-testid="input-target-date"
                        className="h-9"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600">RESPONSIBLE ROLE</Label>
                      <Input 
                        {...form.register("responsibleDept")} 
                        data-testid="input-responsible-role"
                        className="h-9"
                        placeholder="e.g., Chief Engineer"
                      />
                    </div>

                    <div className="pt-2">
                      <Controller
                        name="is_coc"
                        control={form.control}
                        render={({ field }) => (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="coc"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-coc"
                            />
                            <Label htmlFor="coc" className="text-sm font-normal cursor-pointer">
                              Condition of Class (CoC)
                            </Label>
                          </div>
                        )}
                      />
                      <p className="text-xs text-gray-500 mt-1 ml-6">
                        Only if the Defect is Class Related
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description Section */}
              <div>
                <h3 className="text-sm font-semibold text-blue-600 mb-4 pb-2 border-b">Description*</h3>
                <div className="space-y-2">
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
              </div>
            </div>
          )}

          {/* Step 2: Actions */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-blue-600 mb-1">Actions</h2>
                <p className="text-sm text-gray-500">Part B - Corrective and Preventive Actions</p>
              </div>

              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-blue-600">Action Plan</h3>
                <Button 
                  onClick={addAction}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  data-testid="button-add-action"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Action
                </Button>
              </div>

              {actions.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]">Action Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[120px]">Proposed By</TableHead>
                        <TableHead className="w-[120px]">Responsibility</TableHead>
                        <TableHead className="w-[100px]">Due Date</TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {actions.map((action) => (
                        <TableRow key={action.id}>
                          <TableCell className="font-medium">{action.actionType}</TableCell>
                          <TableCell>{action.actionDescription || "N/A"}</TableCell>
                          <TableCell>{action.proposedBy}</TableCell>
                          <TableCell>{action.responsibility}</TableCell>
                          <TableCell>{action.dueDate}</TableCell>
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
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                  <p className="text-gray-500 mb-4">No actions added yet</p>
                  <Button 
                    onClick={addAction}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Action
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Closeout */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-blue-600 mb-1">Closeout</h2>
                <p className="text-sm text-gray-500">Part C - Completion and Approval</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-600">DATE COMPLETED</Label>
                  <Input 
                    {...form.register("dateCompleted")} 
                    type="date"
                    data-testid="input-date-completed"
                    className="h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-600">VERIFIED DATE</Label>
                  <Input 
                    {...form.register("verifiedDate")} 
                    type="date"
                    data-testid="input-verified-date"
                    className="h-9"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-blue-600 mb-4 pb-2 border-b">Attachments</h3>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-2">Drop files here or click to upload</p>
                  <p className="text-xs text-gray-500">PDF, JPG, PNG up to 10MB</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4"
                    data-testid="button-upload-attachment"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Browse Files
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-600">CLOSED BY</Label>
                <Input 
                  {...form.register("closedBy")} 
                  data-testid="input-closed-by"
                  className="h-9"
                  placeholder="Name & Rank"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
