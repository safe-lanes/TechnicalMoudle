import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { insertDefectSchema, type InsertDefect } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Use shared schema with UI validation extensions
const defectFormSchema = insertDefectSchema.extend({
  vesselId: z.string().min(1, "Vessel is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
});

type DefectFormData = z.infer<typeof defectFormSchema>;

// Vessel mapping for proper vesselName updates
const vesselMap: Record<string, string> = {
  "V001": "MV SEAFARER",
  "V002": "MV VOYAGER", 
  "V003": "MV EXPLORER",
};

interface DefectFormSimpleProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function DefectFormSimple({ onSuccess, onCancel }: DefectFormSimpleProps) {
  const { toast } = useToast();
  
  // Generate reference number
  const generateReference = () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `DN/007/${year}/${random}/V`;
  };

  const form = useForm<DefectFormData>({
    resolver: zodResolver(defectFormSchema),
    defaultValues: {
      id: generateReference(),
      vesselId: "V001",
      vesselName: "MV SEAFARER",
      issueDate: new Date().toISOString().split('T')[0],
      status: "Open",
      reportedBy: "MASTER",
      critical: false,
    },
  });

  const onSubmit = async (data: DefectFormData) => {
    try {
      await apiRequest("POST", "/api/defects", data);
      
      // Invalidate and refetch defects list
      await queryClient.invalidateQueries({ queryKey: ['/api/defects'] });
      
      toast({ title: "Defect created successfully" });
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
    <div className="max-w-4xl mx-auto p-6 space-y-6 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-xl font-semibold">New Defect Report</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel} data-testid="button-back">
            Cancel
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)} data-testid="button-save">
            SAVE
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Reference Number */}
          <div className="flex justify-end">
            <Badge variant="secondary" className="text-blue-600 bg-blue-50">
              {form.watch("id")}
            </Badge>
          </div>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="vesselId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vessel</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          // Update vesselName when vesselId changes
                          form.setValue("vesselName", vesselMap[value] || "");
                        }} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-vessel">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="V001">MV SEAFARER</SelectItem>
                          <SelectItem value="V002">MV VOYAGER</SelectItem>
                          <SelectItem value="V003">MV EXPLORER</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-source">
                            <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Internal">Internal</SelectItem>
                          <SelectItem value="External">External</SelectItem>
                          <SelectItem value="SIRE">SIRE</SelectItem>
                          <SelectItem value="PSC">PSC</SelectItem>
                          <SelectItem value="Class">Class</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Defect">Defect</SelectItem>
                          <SelectItem value="COC">COC</SelectItem>
                          <SelectItem value="Observation">Observation</SelectItem>
                          <SelectItem value="NCR">NCR</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="issueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue Date</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="date"
                          data-testid="input-issue-date"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Date</FormLabel>
                      <FormControl>
                        <Input 
                          {...field}
                          value={field.value || ""}
                          type="date"
                          data-testid="input-target-date"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="defectCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Defect Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-defect-category">
                            <SelectValue placeholder="Select defect category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Minor">Minor</SelectItem>
                          <SelectItem value="Major">Major</SelectItem>
                          <SelectItem value="Catastrophic">Catastrophic</SelectItem>
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
                      <FormLabel>VIQ Version</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-viq-version">
                            <SelectValue placeholder="Select VIQ version" />
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
                      <FormLabel>VIQ Reference</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-viq-ref">
                            <SelectValue placeholder="Select VIQ reference" />
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
                  name="critical"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 col-span-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-critical"
                        />
                      </FormControl>
                      <FormLabel>Critical</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field}
                        rows={4}
                        data-testid="textarea-description"
                        placeholder="Describe the defect..."
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" data-testid="button-submit">
              Create Defect
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}