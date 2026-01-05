import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type Component, insertComponentSchema } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const fleetComponentFormSchema = z.object({
  fleetEquipmentName: z.string().min(1, "Fleet equipment name is required"),
  fleetEquipmentCode: z.string().optional(),
  componentCode: z.string().optional(),
  parentFleetEquipmentCode: z.string().optional(),
  maker: z.string().optional(),
  model: z.string().optional(),
  serialNo: z.string().optional(),
  drawingNo: z.string().optional(),
  notes: z.string().optional(),
  location: z.string().optional(),
});

type FleetComponentFormData = z.infer<typeof fleetComponentFormSchema>;

interface FleetComponentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  component: Component | null;
}

export default function FleetComponentForm({ open, onOpenChange, component }: FleetComponentFormProps) {
  const { toast } = useToast();

  // Fetch all fleet components for parent selection
  const { data: components } = useQuery<Component[]>({
    queryKey: ['/technical/api/fleet/components'],
    enabled: open,
  });

  const form = useForm<FleetComponentFormData>({
    resolver: zodResolver(fleetComponentFormSchema),
    defaultValues: {
      fleetEquipmentName: "",
      fleetEquipmentCode: "",
      componentCode: "",
      parentFleetEquipmentCode: "",
      maker: "",
      model: "",
      serialNo: "",
      drawingNo: "",
      notes: "",
      location: "",
    },
  });

  // Reset form when component changes
  useEffect(() => {
    if (component) {
      form.reset({
        fleetEquipmentName: component.fleetEquipmentName || "",
        fleetEquipmentCode: component.fleetEquipmentCode || "",
        componentCode: component.componentCode || "",
        parentFleetEquipmentCode: component.parentFleetEquipmentCode || "",
        maker: component.maker || "",
        model: component.model || "",
        serialNo: component.serialNo || "",
        drawingNo: component.drawingNo || "",
        notes: component.notes || "",
        location: component.location || "",
      });
    } else {
      form.reset({
        fleetEquipmentName: "",
        fleetEquipmentCode: "",
        componentCode: "",
        parentFleetEquipmentCode: "",
        maker: "",
        model: "",
        serialNo: "",
        drawingNo: "",
        notes: "",
        location: "",
      });
    }
  }, [component, form]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: FleetComponentFormData) => {
      return apiRequest('POST', '/technical/api/fleet/components', { ...data, dataScope: 'fleet' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/components'], exact: false });
      toast({
        title: "Success",
        description: "Fleet component created successfully",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create component",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: FleetComponentFormData & { id: string }) => {
      const { id, ...updateData } = data;
      return apiRequest('PATCH', `/technical/api/fleet/components/${id}`, { ...updateData, dataScope: 'fleet' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/components'], exact: false });
      toast({
        title: "Success",
        description: "Fleet component updated successfully",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update component",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FleetComponentFormData) => {
    if (component?.id) {
      updateMutation.mutate({ ...data, id: component.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Get parent components (exclude current component to prevent circular reference)
  const parentOptions = components?.filter((c) => c.id !== component?.id) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="dialog-component-form">
        <DialogHeader>
          <DialogTitle>
            {component?.id ? "Edit Fleet Component" : "Add New Fleet Component"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Fleet Equipment Name */}
          <div className="space-y-2">
            <Label htmlFor="fleetEquipmentName">
              Fleet Equipment Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="fleetEquipmentName"
              {...form.register("fleetEquipmentName")}
              placeholder="e.g., Main Engine, Auxiliary Engine"
              data-testid="input-fleet-equipment-name"
            />
            {form.formState.errors.fleetEquipmentName && (
              <p className="text-sm text-red-500">{form.formState.errors.fleetEquipmentName.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Fleet Equipment Code */}
            <div className="space-y-2">
              <Label htmlFor="fleetEquipmentCode">Fleet Equipment Code</Label>
              <Input
                id="fleetEquipmentCode"
                {...form.register("fleetEquipmentCode")}
                placeholder="Auto-generated if empty"
                data-testid="input-fleet-equipment-code"
              />
            </div>

            {/* Component Code (SFI Code) */}
            <div className="space-y-2">
              <Label htmlFor="componentCode">Component Code (SFI)</Label>
              <Input
                id="componentCode"
                {...form.register("componentCode")}
                placeholder="e.g., 122, 122.1"
                data-testid="input-component-code"
              />
            </div>
          </div>

          {/* Parent Component */}
          <div className="space-y-2">
            <Label htmlFor="parentFleetEquipmentCode">Parent Component</Label>
            <Select
              value={form.watch("parentFleetEquipmentCode") || "none"}
              onValueChange={(value) => form.setValue("parentFleetEquipmentCode", value === "none" ? undefined : value)}
            >
              <SelectTrigger data-testid="select-parent-component">
                <SelectValue placeholder="Select parent (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Top Level)</SelectItem>
                {parentOptions.filter(c => c.fleetEquipmentCode).map((c) => (
                  <SelectItem key={c.id} value={c.fleetEquipmentCode!}>
                    {c.fleetEquipmentCode} - {c.fleetEquipmentName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Maker */}
            <div className="space-y-2">
              <Label htmlFor="maker">Maker</Label>
              <Input
                id="maker"
                {...form.register("maker")}
                placeholder="Manufacturer name"
                data-testid="input-maker"
              />
            </div>

            {/* Model */}
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                {...form.register("model")}
                placeholder="Model number"
                data-testid="input-model"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Serial Number */}
            <div className="space-y-2">
              <Label htmlFor="serialNo">Serial Number</Label>
              <Input
                id="serialNo"
                {...form.register("serialNo")}
                placeholder="Serial number"
                data-testid="input-serial-no"
              />
            </div>

            {/* Drawing Number */}
            <div className="space-y-2">
              <Label htmlFor="drawingNo">Drawing Number</Label>
              <Input
                id="drawingNo"
                {...form.register("drawingNo")}
                placeholder="Drawing number"
                data-testid="input-drawing-no"
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              {...form.register("location")}
              placeholder="Equipment location"
              data-testid="input-location"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...form.register("notes")}
              placeholder="Additional details about the equipment"
              rows={3}
              data-testid="input-notes"
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
              data-testid="button-save-component"
            >
              {isPending ? "Saving..." : component?.id ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
