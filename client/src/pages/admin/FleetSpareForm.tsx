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
import { Marker } from "@/components/Marker";

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
    queryKey: ['/technical/api/fleet/components'],
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
      return apiRequest('POST', '/technical/api/fleet/spares', { ...data, dataScope: 'fleet' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/spares'], exact: false });
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
      return apiRequest('PATCH', `/technical/api/fleet/spares/${id}`, { ...updateData, dataScope: 'fleet' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/spares'], exact: false });
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
    if (spare?.suuid) {
      updateMutation.mutate({ ...data, suuid: spare.suuid });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const isEditMode = !!spare?.suuid;
  const m = (addId: string, editId: string) => isEditMode ? editId : addId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto" data-testid={m("I4.QL5.5.14.1", "I4.QL5.5.28.1")}>
        <Marker id={m("I4.QL5.5.14.1", "I4.QL5.5.28.1")} />
        <DialogHeader>
          <DialogTitle data-testid={m("I4.QL5.5.14.2", "I4.QL5.5.28.2")}>
            <Marker id={m("I4.QL5.5.14.2", "I4.QL5.5.28.2")} />
            {spare?.id ? "Edit Fleet Spare" : "Add New Fleet Spare"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Part Name */}
          <div className="space-y-2">
            <Label htmlFor="partName" data-testid={m("I4.QL5.5.14.3", "I4.QL5.5.28.3")}>
              <Marker id={m("I4.QL5.5.14.3", "I4.QL5.5.28.3")} />
              Part Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="partName"
              {...form.register("partName")}
              placeholder="e.g., Fuel Filter, Oil Seal"
              data-testid={m("I4.QL5.5.14.4", "I4.QL5.5.28.4")}
            />
            <Marker id={m("I4.QL5.5.14.4", "I4.QL5.5.28.4")} />
            {form.formState.errors.partName && (
              <p className="text-sm text-red-500">{form.formState.errors.partName.message}</p>
            )}
          </div>

          {/* Fleet Equipment */}
          <div className="space-y-2">
            <Label htmlFor="fleetEquipmentCode" data-testid={m("I4.QL5.5.14.5", "I4.QL5.5.28.5")}>
              <Marker id={m("I4.QL5.5.14.5", "I4.QL5.5.28.5")} />
              Equipment <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.watch("fleetEquipmentCode") || ""}
              onValueChange={(value) => form.setValue("fleetEquipmentCode", value)}
            >
              <SelectTrigger data-testid={m("I4.QL5.5.14.6", "I4.QL5.5.28.6")}>
                <Marker id={m("I4.QL5.5.14.6", "I4.QL5.5.28.6")} />
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
              <Label htmlFor="fleetPartCode" data-testid={m("I4.QL5.5.14.7", "I4.QL5.5.28.7")}>
                <Marker id={m("I4.QL5.5.14.7", "I4.QL5.5.28.7")} />
                Fleet Part Code
              </Label>
              <Input
                id="fleetPartCode"
                {...form.register("fleetPartCode")}
                placeholder="Auto-generated if empty"
                data-testid={m("I4.QL5.5.14.8", "I4.QL5.5.28.8")}
              />
              <Marker id={m("I4.QL5.5.14.8", "I4.QL5.5.28.8")} />
            </div>

            {/* Part Number */}
            <div className="space-y-2">
              <Label htmlFor="partNumber" data-testid={m("I4.QL5.5.14.21", "I4.QL5.5.28.9")}>
                <Marker id={m("I4.QL5.5.14.21", "I4.QL5.5.28.9")} />
                Part Number
              </Label>
              <Input
                id="partNumber"
                {...form.register("partNumber")}
                placeholder="Manufacturer's part number"
                data-testid={m("I4.QL5.5.14.22", "I4.QL5.5.28.10")}
              />
              <Marker id={m("I4.QL5.5.14.22", "I4.QL5.5.28.10")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Maker */}
            <div className="space-y-2">
              <Label htmlFor="maker" data-testid={m("I4.QL5.5.14.9", "I4.QL5.5.28.11")}>
                <Marker id={m("I4.QL5.5.14.9", "I4.QL5.5.28.11")} />
                Maker
              </Label>
              <Input
                id="maker"
                {...form.register("maker")}
                placeholder="Manufacturer name"
                data-testid={m("I4.QL5.5.14.10", "I4.QL5.5.28.12")}
              />
              <Marker id={m("I4.QL5.5.14.10", "I4.QL5.5.28.12")} />
            </div>

            {/* Model */}
            <div className="space-y-2">
              <Label htmlFor="model" data-testid={m("I4.QL5.5.14.23", "I4.QL5.5.28.13")}>
                <Marker id={m("I4.QL5.5.14.23", "I4.QL5.5.28.13")} />
                Model
              </Label>
              <Input
                id="model"
                {...form.register("model")}
                placeholder="Model number"
                data-testid={m("I4.QL5.5.14.24", "I4.QL5.5.28.14")}
              />
              <Marker id={m("I4.QL5.5.14.24", "I4.QL5.5.28.14")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* UOM */}
            <div className="space-y-2">
              <Label htmlFor="uom" data-testid={m("I4.QL5.5.14.11", "I4.QL5.5.28.15")}>
                <Marker id={m("I4.QL5.5.14.11", "I4.QL5.5.28.15")} />
                Unit of Measurement
              </Label>
              <Input
                id="uom"
                {...form.register("uom")}
                placeholder="e.g., pcs, kg, ltr"
                data-testid={m("I4.QL5.5.14.12", "I4.QL5.5.28.16")}
              />
              <Marker id={m("I4.QL5.5.14.12", "I4.QL5.5.28.16")} />
            </div>

            {/* Drawing Number */}
            <div className="space-y-2">
              <Label htmlFor="drawingNumber" data-testid={m("I4.QL5.5.14.25", "I4.QL5.5.28.17")}>
                <Marker id={m("I4.QL5.5.14.25", "I4.QL5.5.28.17")} />
                Drawing Number
              </Label>
              <Input
                id="drawingNumber"
                {...form.register("drawingNumber")}
                placeholder="Drawing/diagram number"
                data-testid={m("I4.QL5.5.14.26", "I4.QL5.5.28.18")}
              />
              <Marker id={m("I4.QL5.5.14.26", "I4.QL5.5.28.18")} />
            </div>
          </div>

          {/* Specification */}
          <div className="space-y-2">
            <Label htmlFor="specification" data-testid={m("I4.QL5.5.14.13", "I4.QL5.5.28.19")}>
              <Marker id={m("I4.QL5.5.14.13", "I4.QL5.5.28.19")} />
              Specification
            </Label>
            <Input
              id="specification"
              {...form.register("specification")}
              placeholder="Technical specifications (size, dimensions, material)"
              data-testid={m("I4.QL5.5.14.14", "I4.QL5.5.28.20")}
            />
            <Marker id={m("I4.QL5.5.14.14", "I4.QL5.5.28.20")} />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location" data-testid={m("I4.QL5.5.14.15", "I4.QL5.5.28.21")}>
              <Marker id={m("I4.QL5.5.14.15", "I4.QL5.5.28.21")} />
              Location
            </Label>
            <Input
              id="location"
              {...form.register("location")}
              placeholder="Storage location"
              data-testid={m("I4.QL5.5.14.16", "I4.QL5.5.28.22")}
            />
            <Marker id={m("I4.QL5.5.14.16", "I4.QL5.5.28.22")} />
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="note" data-testid={m("I4.QL5.5.14.17", "I4.QL5.5.28.23")}>
              <Marker id={m("I4.QL5.5.14.17", "I4.QL5.5.28.23")} />
              Notes
            </Label>
            <Textarea
              id="note"
              {...form.register("note")}
              placeholder="Additional information or notes"
              rows={3}
              data-testid={m("I4.QL5.5.14.18", "I4.QL5.5.28.24")}
            />
            <Marker id={m("I4.QL5.5.14.18", "I4.QL5.5.28.24")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Criticality */}
            <div className="space-y-2">
              <Label htmlFor="criticality" data-testid={m("I4.QL5.5.14.19", "I4.QL5.5.28.25")}>
                <Marker id={m("I4.QL5.5.14.19", "I4.QL5.5.28.25")} />
                Criticality
              </Label>
              <Select
                value={form.watch("criticality") || "none"}
                onValueChange={(value) => form.setValue("criticality", value === "none" ? undefined : value)}
              >
                <SelectTrigger data-testid={m("I4.QL5.5.14.20", "I4.QL5.5.28.26")}>
                  <Marker id={m("I4.QL5.5.14.20", "I4.QL5.5.28.26")} />
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
                  data-testid={m("I4.QL5.5.14.27", "I4.QL5.5.28.27")}
                />
                <Marker id={m("I4.QL5.5.14.27", "I4.QL5.5.28.27")} />
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
              data-testid={m("I4.QL5.5.14.28", "I4.QL5.5.28.28")}
            >
              <Marker id={m("I4.QL5.5.14.28", "I4.QL5.5.28.28")} />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              data-testid={m("I4.QL5.5.14.29", "I4.QL5.5.28.29")}
            >
              <Marker id={m("I4.QL5.5.14.29", "I4.QL5.5.28.29")} />
              {isPending ? "Saving..." : spare?.id ? "Update Spare" : "Create Spare"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
