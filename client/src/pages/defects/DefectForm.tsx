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
import { Upload, Eye } from "lucide-react";
import { insertDefectSchema, type InsertDefect } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";

// Form validation schema
const defectFormSchema = insertDefectSchema.extend({
  critical: z.boolean().optional(),
  is_coc: z.boolean().optional(),
});

type DefectFormData = z.infer<typeof defectFormSchema>;

interface DefectFormProps {
  defect?: InsertDefect;
  onSuccess?: () => void;
  onCancel?: () => void;
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

export function DefectForm({ defect, onSuccess, onCancel }: DefectFormProps) {
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();
  
  // Generate reference number (format: DN/007/21/1243/V)
  const generateReference = () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `DN/007/${year}/${random}/V`;
  };

  const form = useForm<DefectFormData>({
    resolver: zodResolver(defectFormSchema),
    defaultValues: defect || {
      id: generateReference(),
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
      ...(defect || {}),
    },
  });

  const onSubmit = async (data: DefectFormData) => {
    try {
      if (defect?.id) {
        await apiRequest(`/technical/api/defects/${defect.id}`, "PATCH", data);
        toast({ title: "Defect updated successfully" });
      } else {
        await apiRequest("/technical/api/defects", "POST", data);
        toast({ title: "Defect created successfully" });
      }
      onSuccess?.();
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to save defect",
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto bg-white min-h-screen">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-gray-800">Defect Report</h1>
          <span className="text-sm text-gray-500">{form.watch("id")}</span>
          <Button variant="ghost" size="sm" onClick={onCancel} data-testid="button-back">
            ← Back
          </Button>
          <Button variant="ghost" size="sm" data-testid="button-view">
            View
          </Button>
        </div>
        <Button 
          onClick={form.handleSubmit(onSubmit)} 
          className="bg-blue-600 hover:bg-blue-700 text-white"
          data-testid="button-save"
        >
          SAVE
        </Button>
      </div>

      <form className="p-6 space-y-8">
        {/* Details Section */}
        <div>
          <h2 className="text-sm font-semibold text-blue-600 mb-4 pb-2 border-b">Details</h2>
          
          <div className="grid grid-cols-3 gap-6">
            {/* Basic Column */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-600">MV SEAFARER</Label>
                <Controller
                  name="vesselId"
                  control={form.control}
                  render={({ field }) => (
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        const vessel = vessels.find(v => v.id === value);
                        if (vessel) {
                          form.setValue("vesselName", vessel.name);
                        }
                      }} 
                      value={field.value}
                    >
                      <SelectTrigger data-testid="select-vessel" className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {vessels.map(vessel => (
                          <SelectItem key={vessel.id} value={vessel.id}>{vessel.name}</SelectItem>
                        ))}
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

              <div className="pt-4 space-y-2">
                <Label className="text-xs font-medium text-blue-600">DIMENSION/CONDITION / LOCATION</Label>
                <div className="flex items-center gap-3">
                  <Controller
                    name="critical"
                    control={form.control}
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="walkby"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                        <Label htmlFor="walkby" className="text-sm font-normal cursor-pointer">
                          Walkby
                        </Label>
                      </div>
                    )}
                  />
                  <div className="flex items-center gap-2">
                    <Checkbox id="running" />
                    <Label htmlFor="running" className="text-sm font-normal cursor-pointer">
                      Running
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="shutdown" />
                    <Label htmlFor="shutdown" className="text-sm font-normal cursor-pointer">
                      At Anchor
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-600">OCCURRENCE TYPE</Label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <input type="radio" id="routine" name="occurrence" className="w-4 h-4" />
                    <Label htmlFor="routine" className="text-sm font-normal cursor-pointer">
                      Routine
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="radio" id="breakdown" name="occurrence" className="w-4 h-4" />
                    <Label htmlFor="breakdown" className="text-sm font-normal cursor-pointer">
                      Breakdown
                    </Label>
                  </div>
                </div>
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

            {/* Equipment / Hardware Column */}
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

              <div className="pt-4 space-y-2">
                <h4 className="text-xs font-semibold text-blue-600">Purchase Order</h4>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-600">P.O REF</Label>
                  <Input 
                    {...form.register("purchaseOrderRef")} 
                    data-testid="input-po-ref"
                    className="h-9"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Controller
                  name="critical"
                  control={form.control}
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="critical"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-critical"
                      />
                      <Label htmlFor="critical" className="text-sm font-normal cursor-pointer">
                        Critical
                      </Label>
                    </div>
                  )}
                />
              </div>
            </div>

            {/* Date Column */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-600">DATE ISSUED</Label>
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
                <Label className="text-xs font-medium text-gray-600">DATE COMPLETED</Label>
                <Input 
                  {...form.register("dateCompleted")} 
                  type="date"
                  data-testid="input-date-completed"
                  className="h-9"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-600">RESPONSIBLE ROLE</Label>
                <Input 
                  {...form.register("responsibleDept")} 
                  data-testid="input-responsible-role"
                  className="h-9"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Description Section */}
        <div>
          <h2 className="text-sm font-semibold text-blue-600 mb-4 pb-2 border-b">Description</h2>
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

        {/* Action Buttons at Bottom */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            className="flex items-center gap-2"
            data-testid="button-upload"
          >
            <Upload className="h-4 w-4" />
            UPLOAD
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex items-center gap-2"
            data-testid="button-view-bottom"
          >
            <Eye className="h-4 w-4" />
            VIEW
          </Button>
          <Button
            type="button"
            onClick={form.handleSubmit(onSubmit)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="button-submit"
          >
            SUBMIT
          </Button>
        </div>
      </form>
    </div>
  );
}
