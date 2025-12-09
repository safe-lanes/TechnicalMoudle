import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMakerSchema, type Maker } from "@shared/schema";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MakerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maker?: Maker | null;
}

// Extend schema for email validation
const makerFormSchema = insertMakerSchema.extend({
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
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: MakerFormData) => {
      return apiRequest('POST', '/api/fleet/makers', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fleet/makers'], exact: false });
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
      return apiRequest('PUT', `/api/fleet/makers/${maker?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fleet/makers'], exact: false });
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
      });
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-maker-form">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Maker" : "Add New Maker"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Maker Name - Required */}
          <div className="space-y-2">
            <Label htmlFor="makerName" className="required">
              Maker Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="makerName"
              {...form.register("makerName")}
              placeholder="Enter manufacturer name"
              data-testid="input-maker-name"
            />
            {form.formState.errors.makerName && (
              <p className="text-sm text-red-500">{form.formState.errors.makerName.message}</p>
            )}
          </div>

          {/* Maker Code */}
          <div className="space-y-2">
            <Label htmlFor="makerCode">Maker Code</Label>
            <Input
              id="makerCode"
              {...form.register("makerCode")}
              placeholder="Enter maker code (auto-generated if empty)"
              data-testid="input-maker-code"
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              {...form.register("address")}
              placeholder="Enter address"
              rows={3}
              data-testid="input-address"
            />
          </div>

          {/* Address ID */}
          <div className="space-y-2">
            <Label htmlFor="addressId">Address ID</Label>
            <Input
              id="addressId"
              {...form.register("addressId")}
              placeholder="Enter address identifier"
              data-testid="input-address-id"
            />
          </div>

          {/* Contact Person */}
          <div className="space-y-2">
            <Label htmlFor="contactPerson">Contact Person</Label>
            <Input
              id="contactPerson"
              {...form.register("contactPerson")}
              placeholder="Enter contact person name"
              data-testid="input-contact-person"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...form.register("email")}
              placeholder="Enter email address"
              data-testid="input-email"
            />
            {form.formState.errors.email && (
              <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              {...form.register("phone")}
              placeholder="Enter phone number"
              data-testid="input-phone"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              data-testid="button-save-maker"
            >
              {isPending ? "Saving..." : isEditMode ? "Update Maker" : "Create Maker"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
