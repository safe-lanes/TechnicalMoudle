import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type Spare, type Component } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const fleetSpareFormSchema = z.object({
  partName: z.string().min(1, "Part name is required"),
  fleetEquipmentCode: z.string().min(1, "Equipment is required"),
  fleetPartCode: z.string().optional(),
  partNumber: z.string().optional(),
  maker: z.string().optional(),
  model: z.string().optional(),
  uom: z.string().optional(),
  drawingNumber: z.string().optional(),
  specification: z.string().optional(),
  location: z.string().optional(),
  note: z.string().optional(),
  criticality: z.string().optional(),
  isActive: z.boolean().default(true),
});

type FleetSpareFormData = z.infer<typeof fleetSpareFormSchema>;

interface FleetSpareFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spare: Spare | null;
}

export default function FleetSpareForm({ open, onOpenChange, spare }: FleetSpareFormProps) {
  const { toast } = useToast();

  // Fetch fleet components for equipment selection
  const { data: components } = useQuery<Component[]>({
    queryKey: ['/api/fleet/components'],
    enabled: open,
  });

  const form = useForm<FleetSpareFormData>({
    resolver: zodResolver(fleetSpareFormSchema),
    defaultValues: {
      partName: "",
      fleetPartCode: "",
      fleetEquipmentCode: "",
      partNumber: "",
      maker: "",
      model: "",
      uom: "",
      drawingNumber: "",
      specification: "",
      location: "",
      note: "",
      criticality: "",
      isActive: true,
    },
  });

  // Reset form when spare changes
  useEffect(() => {
    if (spare) {
      form.reset({
        partName: spare.partName || "",
        fleetPartCode: spare.fleetPartCode || "",
        fleetEquipmentCode: spare.fleetEquipmentCode || "",
        partNumber: spare.partNumber || "",
        maker: spare.maker || "",
        model: spare.model || "",
        uom: spare.uom || "",
        drawingNumber: spare.drawingNumber || "",
        specification: spare.specification || "",
        location: spare.location || "",
        note: spare.note || "",
        criticality: spare.criticality || "",
        isActive: spare.isActive ?? true,
      });
    } else {
      form.reset({
        partName: "",
        fleetPartCode: "",
        fleetEquipmentCode: "",
        partNumber: "",
        maker: "",
        model: "",
        uom: "",
        drawingNumber: "",
        specification: "",
        location: "",
        note: "",
        criticality: "",
        isActive: true,
      });
    }
  }, [spare, form]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: FleetSpareFormData) => {
      return apiRequest('POST', '/api/fleet/spares', { ...data, dataScope: 'fleet' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fleet/spares'], exact: false });
      toast({
        title: "Success",
        description: "Fleet spare created successfully",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create spare",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: FleetSpareFormData & { id: number }) => {
      const { id, ...updateData } = data;
      return apiRequest('PATCH', `/api/fleet/spares/${id}`, { ...updateData, dataScope: 'fleet' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fleet/spares'], exact: false });
      toast({
        title: "Success",
        description: "Fleet spare updated successfully",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update spare",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FleetSpareFormData) => {
    if (spare?.id) {
      updateMutation.mutate({ ...data, id: spare.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto" data-testid="dialog-spare-form">
        <DialogHeader>
          <DialogTitle>
            {spare?.id ? "Edit Fleet Spare" : "Add New Fleet Spare"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Part Name */}
          <div className="space-y-2">
            <Label htmlFor="partName">
              Part Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="partName"
              {...form.register("partName")}
              placeholder="e.g., Fuel Filter, Oil Seal"
              data-testid="input-part-name"
            />
            {form.formState.errors.partName && (
              <p className="text-sm text-red-500">{form.formState.errors.partName.message}</p>
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
            {/* Fleet Part Code */}
            <div className="space-y-2">
              <Label htmlFor="fleetPartCode">Fleet Part Code</Label>
              <Input
                id="fleetPartCode"
                {...form.register("fleetPartCode")}
                placeholder="Auto-generated if empty"
                data-testid="input-fleet-part-code"
              />
            </div>

            {/* Part Number */}
            <div className="space-y-2">
              <Label htmlFor="partNumber">Part Number</Label>
              <Input
                id="partNumber"
                {...form.register("partNumber")}
                placeholder="Manufacturer's part number"
                data-testid="input-part-number"
              />
            </div>
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
            {/* UOM */}
            <div className="space-y-2">
              <Label htmlFor="uom">Unit of Measurement</Label>
              <Input
                id="uom"
                {...form.register("uom")}
                placeholder="e.g., pcs, kg, ltr"
                data-testid="input-uom"
              />
            </div>

            {/* Drawing Number */}
            <div className="space-y-2">
              <Label htmlFor="drawingNumber">Drawing Number</Label>
              <Input
                id="drawingNumber"
                {...form.register("drawingNumber")}
                placeholder="Drawing/diagram number"
                data-testid="input-drawing-number"
              />
            </div>
          </div>

          {/* Specification */}
          <div className="space-y-2">
            <Label htmlFor="specification">Specification</Label>
            <Input
              id="specification"
              {...form.register("specification")}
              placeholder="Technical specifications (size, dimensions, material)"
              data-testid="input-specification"
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              {...form.register("location")}
              placeholder="Storage location"
              data-testid="input-location"
            />
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="note">Notes</Label>
            <Textarea
              id="note"
              {...form.register("note")}
              placeholder="Additional information or notes"
              rows={3}
              data-testid="textarea-note"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Criticality */}
            <div className="space-y-2">
              <Label htmlFor="criticality">Criticality</Label>
              <Select
                value={form.watch("criticality") || "none"}
                onValueChange={(value) => form.setValue("criticality", value === "none" ? undefined : value)}
              >
                <SelectTrigger data-testid="select-criticality">
                  <SelectValue placeholder="Select criticality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Active Status */}
            <div className="space-y-2 flex items-end">
              <div className="flex items-center space-x-2 pb-2">
                <Checkbox
                  id="isActive"
                  checked={form.watch("isActive")}
                  onCheckedChange={(checked) => form.setValue("isActive", checked as boolean)}
                  data-testid="checkbox-is-active"
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  Active
                </Label>
              </div>
            </div>
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
              data-testid="button-save"
            >
              {isPending ? "Saving..." : spare?.id ? "Update Spare" : "Create Spare"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
