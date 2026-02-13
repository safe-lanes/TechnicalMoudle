import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type WorkOrder, type Component, type FleetComponents, insertWorkOrderSchema } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const fleetJobFormSchema = z.object({
  jobTitle: z.string().min(1, "Job title is required"),
  fleetEquipmentCode: z.string().min(1, "Equipment is required"),
  fleetJobCode: z.string().optional(),
  component: z.string().default(""),
  workOrderNo: z.string().default(""),
  assignedTo: z.string().default(""),
  status: z.string().default("Active"),
  taskType: z.string().optional(),
  jobCategory: z.string().optional(),
  maintenanceIntervalValue: z.number().nullable().optional(),
  maintenanceIntervalUnit: z.string().optional(),
  briefWorkDescription: z.string().optional(),
});

type FleetJobFormData = z.infer<typeof fleetJobFormSchema>;

interface FleetJobFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: WorkOrder | null;
}

export default function FleetJobForm({ open, onOpenChange, job }: FleetJobFormProps) {
  const { toast } = useToast();

  // Fetch fleet components for equipment selection
  const { data: components } = useQuery<FleetComponents[]>({
    queryKey: ['/technical/api/fleet-admin/fleet-components'],
    enabled: open,
  });

  const form = useForm<FleetJobFormData>({
    resolver: zodResolver(fleetJobFormSchema),
    defaultValues: {
      jobTitle: "",
      fleetJobCode: "",
      fleetEquipmentCode: "",
      component: "",
      workOrderNo: "",
      assignedTo: "",
      status: "Active",
      maintenanceIntervalValue: null,
      maintenanceIntervalUnit: "",
      taskType: "",
      jobCategory: "",
      briefWorkDescription: "",
    },
  });

  // Reset form when job changes
  useEffect(() => {
    if (job) {
      form.reset({
        jobTitle: job.jobTitle || "",
        fleetJobCode: job.fleetJobCode || "",
        fleetEquipmentCode: job.fleetEquipmentCode || "",
        component: job.component || "",
        workOrderNo: job.workOrderNo || "",
        assignedTo: job.assignedTo || "",
        status: job.status || "Active",
        maintenanceIntervalValue: job.maintenanceIntervalValue || null,
        maintenanceIntervalUnit: job.maintenanceIntervalUnit || "",
        taskType: job.taskType || "",
        jobCategory: job.jobCategory || "",
        briefWorkDescription: job.briefWorkDescription || "",
      });
    } else {
      form.reset({
        jobTitle: "",
        fleetJobCode: "",
        fleetEquipmentCode: "",
        component: "",
        workOrderNo: "",
        assignedTo: "",
        status: "Active",
        maintenanceIntervalValue: null,
        maintenanceIntervalUnit: "",
        taskType: "",
        jobCategory: "",
        briefWorkDescription: "",
      });
    }
  }, [job, form]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: FleetJobFormData) => {
      return apiRequest('POST', '/technical/api/fleet/jobs', { ...data, dataScope: 'fleet' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/jobs'], exact: false });
      toast({
        title: "Success",
        description: "Fleet job created successfully",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create job",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: FleetJobFormData & { id: string }) => {
      const { id, ...updateData } = data;
      return apiRequest('PATCH', `/technical/api/fleet/jobs/${id}`, { ...updateData, dataScope: 'fleet' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/jobs'], exact: false });
      toast({
        title: "Success",
        description: "Fleet job updated successfully",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update job",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FleetJobFormData) => {
    if (job?.id) {
      updateMutation.mutate({ ...data, id: job.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto" data-testid="dialog-job-form">
        <DialogHeader>
          <DialogTitle>
            {job?.id ? "Edit Fleet Job" : "Add New Fleet Job"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Job Title */}
          <div className="space-y-2">
            <Label htmlFor="jobTitle">
              Job Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="jobTitle"
              {...form.register("jobTitle")}
              placeholder="e.g., Main Engine Overhaul"
              data-testid="input-job-description"
            />
            {form.formState.errors.jobTitle && (
              <p className="text-sm text-red-500">{form.formState.errors.jobTitle.message}</p>
            )}
          </div>

          {/* Fleet Equipment */}
          <div className="space-y-2">
            <Label htmlFor="fleetEquipmentCode">
              Equipment <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.watch("fleetEquipmentCode") || ""}
              onValueChange={(value) => form.setValue("fleetEquipmentCode", value)}
            >
              <SelectTrigger data-testid="select-fleet-equipment">
                <SelectValue placeholder="Select equipment" />
              </SelectTrigger>
              <SelectContent>
                {components?.filter(c => c.fleetEquipmentCode).map((comp) => (
                  <SelectItem key={comp.id} value={comp.fleetEquipmentCode!}>
                    {comp.fleetEquipmentCode} - {comp.fleetEquipmentName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.fleetEquipmentCode && (
              <p className="text-sm text-red-500">{form.formState.errors.fleetEquipmentCode.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Fleet Job Code */}
            <div className="space-y-2">
              <Label htmlFor="fleetJobCode">Fleet Job Code</Label>
              <Input
                id="fleetJobCode"
                {...form.register("fleetJobCode")}
                placeholder="Auto-generated if empty"
                data-testid="input-fleet-job-code"
              />
            </div>

            {/* Task Type */}
            <div className="space-y-2">
              <Label htmlFor="taskType">Task Type</Label>
              <Input
                id="taskType"
                {...form.register("taskType")}
                placeholder="e.g., Overhaul, Inspection"
                data-testid="input-job-type"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Interval Value */}
            <div className="space-y-2">
              <Label htmlFor="maintenanceIntervalValue">Maintenance Interval</Label>
              <Input
                id="maintenanceIntervalValue"
                type="number"
                {...form.register("maintenanceIntervalValue", { 
                  setValueAs: (v) => v === "" ? null : parseInt(v) 
                })}
                placeholder="0"
                data-testid="input-interval-value"
              />
            </div>

            {/* Interval Unit */}
            <div className="space-y-2">
              <Label htmlFor="maintenanceIntervalUnit">Interval Unit</Label>
              <Select
                value={form.watch("maintenanceIntervalUnit") || ""}
                onValueChange={(value) => form.setValue("maintenanceIntervalUnit", value)}
              >
                <SelectTrigger data-testid="select-interval-unit">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hours">Hours</SelectItem>
                  <SelectItem value="Days">Days</SelectItem>
                  <SelectItem value="Months">Months</SelectItem>
                  <SelectItem value="Years">Years</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Brief Work Description */}
          <div className="space-y-2">
            <Label htmlFor="briefWorkDescription">Work Description</Label>
            <Textarea
              id="briefWorkDescription"
              {...form.register("briefWorkDescription")}
              placeholder="Brief description of the work to be performed"
              rows={3}
              data-testid="input-job-instructions"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              data-testid="button-save-job"
            >
              {isPending ? "Saving..." : job?.id ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
