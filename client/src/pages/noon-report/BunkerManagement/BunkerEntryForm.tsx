import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { NrBunkerRecord } from "@shared/schema";

// ── Validation schema ────────────────────────────────────────────────────────

const bunkerSchema = z.object({
  vesselId: z.string().min(1, "Vessel ID required"),
  voyageNo: z.string().optional(),
  port: z.string().min(1, "Port is required"),
  bunkeredDate: z.string().min(1, "Date is required"),
  fuelType: z.enum(["HFO", "LSMGO", "MGO", "VLSFO", "LPG"], {
    errorMap: () => ({ message: "Select a fuel type" }),
  }),
  quantityMt: z.coerce.number().positive("Quantity must be positive"),
  density: z.coerce.number().positive().optional().or(z.literal("")),
  sulphurPct: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  pricePmt: z.coerce.number().min(0).optional().or(z.literal("")),
  supplier: z.string().optional(),
  bdnNumber: z.string().optional(),
  sampleSealNumber: z.string().optional(),
  remarks: z.string().optional(),
});

type BunkerFormValues = z.infer<typeof bunkerSchema>;

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  vesselId: string;
  record?: NrBunkerRecord | null;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BunkerEntryForm({ open, onClose, vesselId, record }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<BunkerFormValues>({
    resolver: zodResolver(bunkerSchema),
    defaultValues: {
      vesselId,
      voyageNo: record?.voyageNo ?? "",
      port: record?.port ?? "",
      bunkeredDate: record?.bunkeredDate ?? new Date().toISOString().slice(0, 10),
      fuelType: (record?.fuelType as BunkerFormValues["fuelType"]) ?? "HFO",
      quantityMt: record ? Number(record.quantityMt) : 0,
      density: record?.density ? Number(record.density) : "",
      sulphurPct: record?.sulphurPct ? Number(record.sulphurPct) : "",
      pricePmt: record?.pricePmt ? Number(record.pricePmt) : "",
      supplier: record?.supplier ?? "",
      bdnNumber: record?.bdnNumber ?? "",
      sampleSealNumber: record?.sampleSealNumber ?? "",
      remarks: record?.remarks ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: BunkerFormValues) => {
      const payload = {
        ...data,
        quantityMt: String(data.quantityMt),
        density: data.density !== "" && data.density !== undefined ? String(data.density) : undefined,
        sulphurPct: data.sulphurPct !== "" && data.sulphurPct !== undefined ? String(data.sulphurPct) : undefined,
        pricePmt: data.pricePmt !== "" && data.pricePmt !== undefined ? String(data.pricePmt) : undefined,
      };
      if (record) {
        return apiRequest("PATCH", `/api/nr-bunker/${record.id}`, payload);
      }
      return apiRequest("POST", "/api/nr-bunker", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nr-bunker"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nr-bunker-cost"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nr-fuel-rob"] });
      toast({
        title: record ? "Record updated" : "Bunker record saved",
        description: record
          ? "The BDN record has been updated and ROB adjusted."
          : "The BDN record has been saved and ROB updated.",
      });
      onClose();
    },
    onError: (err: any) => {
      toast({
        title: "Save failed",
        description: err?.message ?? "An error occurred",
        variant: "destructive",
      });
    },
  });

  function onSubmit(data: BunkerFormValues) {
    mutation.mutate(data);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="bunker-form-title">
            {record ? "Edit BDN Record" : "New Bunker Record"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Row 1 — Port & Date */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="port"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Port</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Singapore" data-testid="input-bunker-port" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bunkeredDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bunkering Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-bunker-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 2 — Fuel Type & Quantity */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fuelType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fuel Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-bunker-fuel-type">
                          <SelectValue placeholder="Select fuel type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="HFO">HFO</SelectItem>
                        <SelectItem value="VLSFO">VLSFO</SelectItem>
                        <SelectItem value="LSMGO">LSMGO</SelectItem>
                        <SelectItem value="MGO">MGO</SelectItem>
                        <SelectItem value="LPG">LPG</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantityMt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity (MT)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.001" min="0" {...field} data-testid="input-bunker-quantity" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 3 — Density & Sulphur */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="density"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Density (kg/m³)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" min="0" {...field} placeholder="e.g. 991.5" data-testid="input-bunker-density" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sulphurPct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sulphur Content (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" max="100" {...field} placeholder="e.g. 0.50" data-testid="input-bunker-sulphur" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 4 — Price & Supplier */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="pricePmt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price per MT (USD)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} placeholder="e.g. 650.00" data-testid="input-bunker-price" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="supplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Supplier name" data-testid="input-bunker-supplier" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 5 — BDN Number & MARPOL Sample Seal */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="bdnNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>BDN Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="BDN reference" data-testid="input-bunker-bdn" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sampleSealNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MARPOL Sample Seal No.</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Seal number" data-testid="input-bunker-seal" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 6 — Voyage No */}
            <FormField
              control={form.control}
              name="voyageNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Voyage No. (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. V-2026-01" data-testid="input-bunker-voyage" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Row 7 — Remarks */}
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} placeholder="Optional remarks..." data-testid="textarea-bunker-remarks" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                data-testid="btn-bunker-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="btn-bunker-save"
              >
                {mutation.isPending ? "Saving…" : record ? "Update Record" : "Save Record"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
