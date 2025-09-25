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
import { ArrowLeft, Eye, Upload, Plus, Edit, Trash2 } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { insertDefectSchema, type InsertDefect } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";

// Vessel mapping for proper vesselName updates
const vesselMap: Record<string, string> = {
  "V001": "MV SEAFARER",
  "V002": "MV VOYAGER", 
  "V003": "MV EXPLORER",
};

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
}

export default function DefectFormExact({ onClose }: DefectFormExactProps) {
  const { toast } = useToast();
  const [defectRef] = useState(generateDefectRef());
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

  const form = useForm<DefectFormData>({
    resolver: zodResolver(defectFormSchema),
    defaultValues: {
      id: defectRef,
      vesselId: "V001",
      vesselName: "MV SEAFARER",
      issueDate: new Date().toISOString().split('T')[0],
      category: "Defect", // Default category
      defectType: "",
      description: "",
      status: "Open",
      priority: "Medium",
      critical: false,
      severity: 2, // Minor
      source: "",
      equipmentCategory: "",
      equipmentType: "",
      equipmentMake: "",
      equipmentModel: "",
      equipmentSerialNo: "",
      equipmentLocation: "",
      equipmentSystem: "",
      targetDate: "",
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
    },
  });

  const createDefectMutation = useMutation({
    mutationFn: async (data: DefectFormData) => {
      return apiRequest("POST", "/api/defects", data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Defect created successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/defects'] });
      onClose();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to create defect",
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = (data: DefectFormData) => {
    createDefectMutation.mutate(data);
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
        <div className="flex items-center gap-4">
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
          <h1 className="text-xl font-semibold text-gray-900">Defect Report</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-blue-600 font-medium text-sm">{defectRef}</span>
          <Button variant="outline" size="sm" className="text-gray-600" data-testid="button-view">
            <Eye className="w-4 h-4 mr-1" />
            View
          </Button>
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white" 
            size="sm" 
            onClick={() => form.handleSubmit(handleSubmit)()}
            disabled={createDefectMutation.isPending}
            data-testid="button-save-header"
          >
            {createDefectMutation.isPending ? "SAVING..." : "SAVE"}
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Details Section - 3 Column Layout */}
          <div className="bg-gray-50 p-6">
            <div className="pb-4">
              <div className="border-b border-blue-200 pb-2">
                <h2 className="text-blue-600 font-semibold text-base">Details</h2>
              </div>
            </div>
            <div>
              <div className="grid grid-cols-3 gap-8">
                {/* Basic Column */}
                <div className="space-y-4">
                  <div className="border-b border-blue-200 pb-1">
                    <h3 className="font-semibold text-blue-600 text-sm">Basic</h3>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="vesselId"
                    render={({ field }) => (
                      <FormItem>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue("vesselName", vesselMap[value] || "");
                          }} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-vessel">
                              <SelectValue placeholder="VESSEL" />
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
                        <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-source">
                              <SelectValue placeholder="SOURCE" />
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
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="defectCategory"
                    render={({ field }) => (
                      <FormItem>
                        <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-defect-category">
                              <SelectValue placeholder="DEFECT CATEGORY" />
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
                    name="defectType"
                    render={({ field }) => (
                      <FormItem>
                        <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-defect-type">
                              <SelectValue placeholder="DEFECT TYPE" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Routine">Routine</SelectItem>
                            <SelectItem value="Corrective">Corrective</SelectItem>
                            <SelectItem value="Emergency">Emergency</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Equipment/Hardware Column */}
                <div className="space-y-4">
                  <div className="border-b border-blue-200 pb-1">
                    <h3 className="font-semibold text-blue-600 text-sm">Equipment / Hardware</h3>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="equipmentCategory"
                    render={({ field }) => (
                      <FormItem>
                        <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-equipment-category">
                              <SelectValue placeholder="CATEGORY" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Deck">Deck</SelectItem>
                            <SelectItem value="Navigation">Navigation</SelectItem>
                            <SelectItem value="Machinery">Machinery</SelectItem>
                            <SelectItem value="Safety">Safety</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="equipmentType"
                    render={({ field }) => (
                      <FormItem>
                        <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-equipment-type">
                              <SelectValue placeholder="TYPE" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Pump">Pump</SelectItem>
                            <SelectItem value="Valve">Valve</SelectItem>
                            <SelectItem value="Motor">Motor</SelectItem>
                            <SelectItem value="Sensor">Sensor</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="equipmentMake"
                    render={({ field }) => (
                      <FormItem>
                        <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-equipment-make">
                              <SelectValue placeholder="MAKE" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Wartsila">Wartsila</SelectItem>
                            <SelectItem value="MAN">MAN</SelectItem>
                            <SelectItem value="Caterpillar">Caterpillar</SelectItem>
                            <SelectItem value="ABB">ABB</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="equipmentModel"
                    render={({ field }) => (
                      <FormItem>
                        <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-equipment-model">
                              <SelectValue placeholder="MODEL" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="W32">W32</SelectItem>
                            <SelectItem value="6L20">6L20</SelectItem>
                            <SelectItem value="3508">3508</SelectItem>
                            <SelectItem value="VFD">VFD</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Date Column */}
                <div className="space-y-4">
                  <div className="border-b border-blue-200 pb-1">
                    <h3 className="font-semibold text-blue-600 text-sm">Date</h3>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="issueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input 
                            {...field}
                            type="date"
                            placeholder="DATE ISSUED"
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
                        <FormControl>
                          <Input 
                            {...field}
                            value={field.value || ""}
                            type="date"
                            placeholder="TARGET DATE"
                            data-testid="input-target-date"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dateCompleted"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input 
                            {...field}
                            value={field.value || ""}
                            type="date"
                            placeholder="DATE COMPLETED"
                            data-testid="input-date-completed"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Purchase Order Section */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="border-b border-blue-200 pb-1 mb-4">
                  <h3 className="font-semibold text-blue-600 text-sm">Purchase Order</h3>
                </div>
                <div className="flex items-center gap-4">
                  <FormField
                    control={form.control}
                    name="purchaseOrderRef"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input 
                            {...field}
                            value={field.value || ""}
                            placeholder="PO REF"
                            data-testid="input-po-ref"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="critical"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
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
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="bg-gray-50 p-6">
            <div className="pb-4">
              <div className="border-b border-blue-200 pb-2">
                <h2 className="text-blue-600 font-semibold text-base">Description</h2>
              </div>
            </div>
            <div>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea 
                        {...field}
                        rows={4}
                        placeholder="DESCRIPTION"
                        data-testid="textarea-description"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

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
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700" 
                  disabled={createDefectMutation.isPending}
                  data-testid="button-save-description"
                >
                  {createDefectMutation.isPending ? "SAVING..." : "SAVE"}
                </Button>
              </div>
            </div>
          </div>

          {/* Cause Analysis Section */}
          <div className="bg-gray-50 p-6">
            <div className="pb-4">
              <div className="border-b border-blue-200 pb-2">
                <h2 className="text-blue-600 font-semibold text-base">Cause Analysis</h2>
              </div>
            </div>
            <div>
              <div className="space-y-6">
                {/* Row 1: Immediate Cause */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-blue-600 text-sm">Immediate Cause</h4>
                    <Button variant="outline" size="sm" className="text-blue-600 border-blue-300" data-testid="button-select-immediate">
                      Select
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="immediateCause"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea 
                              {...field}
                              value={field.value || ""}
                              rows={3}
                              placeholder="IMMEDIATE CAUSE"
                              className="bg-white"
                              data-testid="textarea-immediate-cause"
                            />
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
                            <Textarea 
                              {...field}
                              value={field.value || ""}
                              rows={3}
                              placeholder="FURTHER EXPLANATION"
                              className="bg-white"
                              data-testid="textarea-immediate-explanation"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Row 2: Root Cause */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-blue-600 text-sm">Root Cause</h4>
                    <Button variant="outline" size="sm" className="text-blue-600 border-blue-300" data-testid="button-select-root">
                      Select
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="rootCause"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea 
                              {...field}
                              value={field.value || ""}
                              rows={3}
                              placeholder="ROOT CAUSE"
                              className="bg-white"
                              data-testid="textarea-root-cause"
                            />
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
                            <Textarea 
                              {...field}
                              value={field.value || ""}
                              rows={3}
                              placeholder="FURTHER EXPLANATION"
                              className="bg-white"
                              data-testid="textarea-root-explanation"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions Section */}
          <div className="bg-gray-50 p-6">
            <div className="pb-4">
              <div className="flex items-center justify-between">
                <div className="border-b border-blue-200 pb-2">
                  <h2 className="text-blue-600 font-semibold text-base">ACTIONS</h2>
                </div>
                <Button 
                  type="button"
                  variant="outline"
                  className="text-blue-600 border-blue-300 hover:bg-blue-50 rounded-full px-4" 
                  size="sm" 
                  onClick={addAction}
                  data-testid="button-add-action"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  ADD ACTION
                </Button>
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
              <Button variant="outline" className="text-blue-600 border-blue-300 hover:bg-blue-50 rounded-full px-4" size="sm" data-testid="button-upload">
                <Upload className="w-4 h-4 mr-2" />
                UPLOAD
              </Button>
              <Button variant="outline" className="text-blue-600 border-blue-300 hover:bg-blue-50 rounded-full px-4" size="sm" data-testid="button-view-attachments">
                <Eye className="w-4 h-4 mr-2" />
                VIEW
              </Button>
            </div>
            
            <Button 
              type="submit" 
              className="bg-blue-600 hover:bg-blue-700 px-8"
              disabled={createDefectMutation.isPending}
              data-testid="button-submit"
            >
              {createDefectMutation.isPending ? "SUBMITTING..." : "SUBMIT"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}