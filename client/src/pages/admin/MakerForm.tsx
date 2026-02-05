import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMakerListSchema, type MakerList } from "@shared/schema";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Marker } from "@/components/Marker";

interface MakerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maker?: MakerList | null;
}

// Extend schema for email validation
const makerFormSchema = insertMakerListSchema.extend({
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
});

type MakerFormData = z.infer<typeof makerFormSchema>;

export default function MakerForm({ open, onOpenChange, maker }: MakerFormProps) {
  const { toast } = useToast();
  const isEditMode = !!maker;

  const form = useForm<MakerFormData>({
    resolver: zodResolver(makerFormSchema),
    defaultValues: {
      makerName: maker?.makerName || "",
      makerCode: maker?.makerCode || "",
      address: maker?.address || "",
      addressId: maker?.addressId || "",
      contactPerson: maker?.contactPerson || "",
      email: maker?.email || "",
      phone: maker?.phone || "",
      isActive: maker?.isActive ?? true,
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: MakerFormData) => {
      return apiRequest('POST', '/technical/api/fleet/makers', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/makers'], exact: false });
      toast({
        title: "Success",
        description: "Maker created successfully",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create maker",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: MakerFormData) => {
      return apiRequest('PUT', `/technical/api/fleet/makers/${maker?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/makers'], exact: false });
      toast({
        title: "Success",
        description: "Maker updated successfully",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update maker",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: MakerFormData) => {
    if (isEditMode) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Reset form when maker prop changes (for Edit mode) or when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        makerName: maker?.makerName || "",
        makerCode: maker?.makerCode || "",
        address: maker?.address || "",
        addressId: maker?.addressId || "",
        contactPerson: maker?.contactPerson || "",
        email: maker?.email || "",
        phone: maker?.phone || "",
        isActive: maker?.isActive ?? true,
      });
    }
  }, [open, maker, form]);

  // Reset form when dialog opens/closes or maker changes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    } else if (maker) {
      form.reset({
        makerName: maker.makerName || "",
        makerCode: maker.makerCode || "",
        address: maker.address || "",
        addressId: maker.addressId || "",
        contactPerson: maker.contactPerson || "",
        email: maker.email || "",
        phone: maker.phone || "",
        isActive: maker.isActive ?? true,
      });
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid={isEditMode ? "I4.QL.1.24.1" : "I4.QL.1.12.1"}>
        <DialogHeader>
          <DialogTitle data-testid={isEditMode ? "I4.QL.1.24.1" : "I4.QL.1.12.1"}>
            {isEditMode ? <Marker id="I4.QL.1.24.1" /> : <Marker id="I4.QL.1.12.1" />}
            {isEditMode ? "Edit Maker" : "Add New Maker"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Maker Name - Required */}
          <div className="space-y-2">
            <Label htmlFor="makerName" className="required" data-testid={isEditMode ? "I4.QL.1.24.3" : "I4.QL.1.12.3"}>
              {isEditMode ? <Marker id="I4.QL.1.24.3" /> : <Marker id="I4.QL.1.12.3" />}
              Maker Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="makerName"
              {...form.register("makerName")}
              placeholder="Enter manufacturer name"
              data-testid={isEditMode ? "I4.QL.1.24.4" : "I4.QL.1.12.4"}
            />
            {isEditMode ? <Marker id="I4.QL.1.24.4" /> : <Marker id="I4.QL.1.12.4" />}
            {form.formState.errors.makerName && (
              <p className="text-sm text-red-500">{form.formState.errors.makerName.message}</p>
            )}
          </div>

          {/* Maker Code */}
          <div className="space-y-2">
            <Label htmlFor="makerCode" data-testid={isEditMode ? "I4.QL.1.24.5" : "I4.QL.1.12.5"}>
              {isEditMode ? <Marker id="I4.QL.1.24.5" /> : <Marker id="I4.QL.1.12.5" />}
              Maker Code
            </Label>
            <Input
              id="makerCode"
              {...form.register("makerCode")}
              placeholder="Enter maker code (auto-generated if empty)"
              data-testid={isEditMode ? "I4.QL.1.24.6" : "I4.QL.1.12.6"}
            />
            {isEditMode ? <Marker id="I4.QL.1.24.6" /> : <Marker id="I4.QL.1.12.6" />}
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address" data-testid={isEditMode ? "I4.QL.1.24.7" : "I4.QL.1.12.7"}>
              {isEditMode ? <Marker id="I4.QL.1.24.7" /> : <Marker id="I4.QL.1.12.7" />}
              Address
            </Label>
            <Textarea
              id="address"
              {...form.register("address")}
              placeholder="Enter address"
              rows={3}
              data-testid={isEditMode ? "I4.QL.1.24.8" : "I4.QL.1.12.8"}
            />
            {isEditMode ? <Marker id="I4.QL.1.24.8" /> : <Marker id="I4.QL.1.12.8" />}
          </div>

          {/* Address ID */}
          <div className="space-y-2">
            <Label htmlFor="addressId" data-testid={isEditMode ? "I4.QL.1.24.9" : "I4.QL.1.12.9"}>
              {isEditMode ? <Marker id="I4.QL.1.24.9" /> : <Marker id="I4.QL.1.12.9" />}
              Address ID
            </Label>
            <Input
              id="addressId"
              {...form.register("addressId")}
              placeholder="Enter address identifier"
              data-testid={isEditMode ? "I4.QL.1.24.10" : "I4.QL.1.12.10"}
            />
            {isEditMode ? <Marker id="I4.QL.1.24.10" /> : <Marker id="I4.QL.1.12.10" />}
          </div>

          {/* Contact Person */}
          <div className="space-y-2">
            <Label htmlFor="contactPerson" data-testid={isEditMode ? "I4.QL.1.24.11" : "I4.QL.1.12.11"}>
              {isEditMode ? <Marker id="I4.QL.1.24.11" /> : <Marker id="I4.QL.1.12.11" />}
              Contact Person
            </Label>
            <Input
              id="contactPerson"
              {...form.register("contactPerson")}
              placeholder="Enter contact person name"
              data-testid={isEditMode ? "I4.QL.1.24.12" : "I4.QL.1.12.12"}
            />
            {isEditMode ? <Marker id="I4.QL.1.24.12" /> : <Marker id="I4.QL.1.12.12" />}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" data-testid={isEditMode ? "I4.QL.1.24.13" : "I4.QL.1.12.13"}>
              {isEditMode ? <Marker id="I4.QL.1.24.13" /> : <Marker id="I4.QL.1.12.13" />}
              Email
            </Label>
            <Input
              id="email"
              type="email"
              {...form.register("email")}
              placeholder="Enter email address"
              data-testid={isEditMode ? "I4.QL.1.24.14" : "I4.QL.1.12.14"}
            />
            {isEditMode ? <Marker id="I4.QL.1.24.14" /> : <Marker id="I4.QL.1.12.14" />}
            {form.formState.errors.email && (
              <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" data-testid={isEditMode ? "I4.QL.1.24.15" : "I4.QL.1.12.15"}>
              {isEditMode ? <Marker id="I4.QL.1.24.15" /> : <Marker id="I4.QL.1.12.15" />}
              Phone
            </Label>
            <Input
              id="phone"
              {...form.register("phone")}
              placeholder="Enter phone number"
              data-testid={isEditMode ? "I4.QL.1.24.16" : "I4.QL.1.12.16"}
            />
            {isEditMode ? <Marker id="I4.QL.1.24.16" /> : <Marker id="I4.QL.1.12.16" />}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
              data-testid={isEditMode ? "I4.QL.1.24.17" : "I4.QL.1.12.18"}
            >
              {isEditMode ? <Marker id="I4.QL.1.24.17" /> : <Marker id="I4.QL.1.12.18" />}
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              data-testid={isEditMode ? "I4.QL.1.24.18" : "I4.QL.1.12.17"}
            >
              {isEditMode ? <Marker id="I4.QL.1.24.18" /> : <Marker id="I4.QL.1.12.17" />}
              {isPending ? "Saving..." : isEditMode ? "Update Maker" : "Create Maker"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
