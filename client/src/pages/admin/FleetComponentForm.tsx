import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type FleetComponents } from "@shared/schema";
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
  parentFleetEquipmentCode: z.string().optional(),
  makerName: z.string().optional(),
  makerCode: z.string().optional(),
  model: z.string().optional(),
  modelCode: z.string().optional(),
  componentCategory: z.string().optional(),
  eqptSystemDept: z.string().optional(),
  rating: z.string().optional(),
  notes: z.string().optional(),
  location: z.string().optional(),
});

type FleetComponentFormData = z.infer<typeof fleetComponentFormSchema>;

interface FleetComponentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  component: FleetComponents | null;
}

export default function FleetComponentForm({ open, onOpenChange, component }: FleetComponentFormProps) {
  const { toast } = useToast();

  // Fetch all fleet components for parent selection
  const { data: components } = useQuery<FleetComponents[]>({
    queryKey: ['/technical/api/fleet-admin/fleet-components'],
    enabled: open,
  });

  const form = useForm<FleetComponentFormData>({
    resolver: zodResolver(fleetComponentFormSchema),
    defaultValues: {
      fleetEquipmentName: "",
      fleetEquipmentCode: "",
      parentFleetEquipmentCode: "",
      makerName: "",
      makerCode: "",
      model: "",
      modelCode: "",
      componentCategory: "",
      eqptSystemDept: "",
      rating: "",
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
        parentFleetEquipmentCode: component.parentFleetEquipmentCode || "",
        makerName: component.makerName || "",
        makerCode: component.makerCode || "",
        model: component.model || "",
        modelCode: component.modelCode || "",
        componentCategory: component.componentCategory || "",
        eqptSystemDept: component.eqptSystemDept || "",
        rating: component.rating || "",
        notes: component.notes || "",
        location: component.location || "",
      });
    } else {
      form.reset({
        fleetEquipmentName: "",
        fleetEquipmentCode: "",
        parentFleetEquipmentCode: "",
        makerName: "",
        makerCode: "",
        model: "",
        modelCode: "",
        componentCategory: "",
        eqptSystemDept: "",
        rating: "",
        notes: "",
        location: "",
      });
    }
  }, [component, form]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: FleetComponentFormData) => {
      return apiRequest('POST', '/technical/api/fleet-admin/fleet-components', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet-admin/fleet-components'], exact: false });
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
    mutationFn: async (data: FleetComponentFormData & { id: number }) => {
      const { id, ...updateData } = data;
      return apiRequest('PATCH', `/technical/api/fleet-admin/fleet-components/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet-admin/fleet-components'], exact: false });
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

            {/* Component Category */}
            <div className="space-y-2">
              <Label htmlFor="componentCategory">Component Category</Label>
              <Input
                id="componentCategory"
                {...form.register("componentCategory")}
                placeholder="e.g., 1, 2, 3"
                data-testid="input-component-category"
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
                  <SelectItem key={c.id} value={c.fleetEquipmentCode}>
                    {c.fleetEquipmentCode} - {c.fleetEquipmentName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Maker Name */}
            <div className="space-y-2">
              <Label htmlFor="makerName">Maker Name</Label>
              <Input
                id="makerName"
                {...form.register("makerName")}
                placeholder="Manufacturer name"
                data-testid="input-maker-name"
              />
            </div>

            {/* Maker Code */}
            <div className="space-y-2">
              <Label htmlFor="makerCode">Maker Code</Label>
              <Input
                id="makerCode"
                {...form.register("makerCode")}
                placeholder="Maker code"
                data-testid="input-maker-code"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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

            {/* Model Code */}
            <div className="space-y-2">
              <Label htmlFor="modelCode">Model Code</Label>
              <Input
                id="modelCode"
                {...form.register("modelCode")}
                placeholder="Model code"
                data-testid="input-model-code"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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

            {/* Rating */}
            <div className="space-y-2">
              <Label htmlFor="rating">Rating</Label>
              <Input
                id="rating"
                {...form.register("rating")}
                placeholder="Equipment rating"
                data-testid="input-rating"
              />
            </div>
          </div>

          {/* Eqpt / System Department */}
          <div className="space-y-2">
            <Label htmlFor="eqptSystemDept">Eqpt / System Department</Label>
            <Input
              id="eqptSystemDept"
              {...form.register("eqptSystemDept")}
              placeholder="Department"
              data-testid="input-eqpt-system-dept"
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
              className="bg-white text-[#0f172a] border-gray-300"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#5dc86f] hover:bg-[#4db85f] text-white"
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
