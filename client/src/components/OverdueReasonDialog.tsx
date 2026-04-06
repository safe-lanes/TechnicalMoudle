import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const OTHER_REASON = "Other Reason";

interface MasterListItem {
  id: number;
  listType: string;
  listKey: string;
  listValue: string;
  displayOrder: number;
  isActive: boolean;
}

interface WorkOrderRef {
  id?: string | null;
  wouuid?: string | null;
  workOrderNo?: string | null;
  templateCode?: string | null;
  component?: string | null;
  jobTitle: string;
  dueDate?: string | null;
  overdueReason?: string | null;
  overdueReasonDetails?: string | null;
}

interface OverdueReasonDialogProps {
  workOrder: WorkOrderRef | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function OverdueReasonDialog({
  workOrder,
  open,
  onClose,
  onSaved,
}: OverdueReasonDialogProps) {
  const { toast } = useToast();

  const [selectedReason, setSelectedReason] = useState("");
  const [reasonDetails, setReasonDetails] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [detailsError, setDetailsError] = useState("");

  const isOtherReason = selectedReason === OTHER_REASON;

  useEffect(() => {
    if (workOrder && open) {
      setSelectedReason(workOrder.overdueReason || "");
      setReasonDetails(workOrder.overdueReasonDetails || "");
      setReasonError("");
      setDetailsError("");
    }
  }, [workOrder, open]);

  const { data: masterListItems, isLoading: reasonsLoading, isError: reasonsError } = useQuery<MasterListItem[]>({
    queryKey: ["/technical/api/fleet/master-lists", "overdueReason"],
    queryFn: async () => {
      const r = await fetch("/technical/api/fleet/master-lists?listType=overdueReason");
      if (!r.ok) throw new Error(`Failed to fetch overdue reasons: ${r.status}`);
      const json = await r.json();
      return Array.isArray(json) ? json : [];
    },
    enabled: open,
  });

  const activeReasons: string[] =
    !reasonsError && masterListItems && masterListItems.length > 0
      ? masterListItems
          .filter((i) => i.isActive)
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((i) => i.listValue)
      : [];

  const allReasons: string[] = [...activeReasons, OTHER_REASON];

  const workOrderId = workOrder?.id || workOrder?.wouuid;

  const mutation = useMutation({
    mutationFn: async (payload: { overdueReason: string; overdueReasonDetails: string | null }) => {
      return apiRequest("POST", `/technical/api/work-orders/${workOrderId}/overdue-reason`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/work-orders"] });
      toast({ title: "Overdue reason saved", description: "The reason has been recorded for this work order." });
      onSaved();
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err?.message || "An error occurred", variant: "destructive" });
    },
  });

  const handleSave = () => {
    let hasError = false;

    if (!selectedReason) {
      setReasonError("Please select an overdue reason.");
      hasError = true;
    } else {
      setReasonError("");
    }

    if (isOtherReason && !reasonDetails.trim()) {
      setDetailsError("Please enter the custom overdue reason.");
      hasError = true;
    } else {
      setDetailsError("");
    }

    if (hasError) return;

    mutation.mutate({
      overdueReason: selectedReason,
      overdueReasonDetails: reasonDetails.trim() || null,
    });
  };

  if (!workOrder) return null;

  const displayId = workOrder.templateCode || workOrder.workOrderNo || workOrder.id || "";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Record Overdue Reason</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-sm">Work Order ID</Label>
                <Input value={displayId} readOnly className="bg-gray-50 h-9" data-testid="input-overdue-wo-id" />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Component</Label>
                <Input value={workOrder.component || ""} readOnly className="bg-gray-50 h-9" data-testid="input-overdue-component" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-sm">Job Title</Label>
              <Input value={workOrder.jobTitle} readOnly className="bg-gray-50 h-9" data-testid="input-overdue-job-title" />
            </div>

            <div className="space-y-1">
              <Label className="text-sm">
                Overdue Reason <span className="text-red-500">*</span>
              </Label>
              <Select
                value={selectedReason}
                onValueChange={(value) => {
                  setSelectedReason(value);
                  setReasonDetails("");
                  if (value) setReasonError("");
                  setDetailsError("");
                }}
                disabled={reasonsLoading}
              >
                <SelectTrigger
                  data-testid="select-overdue-reason"
                  className={reasonError ? "border-red-500" : ""}
                >
                  {reasonsLoading ? (
                    <span className="flex items-center text-muted-foreground text-sm">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading reasons...
                    </span>
                  ) : (
                    <SelectValue placeholder="Select an overdue reason..." />
                  )}
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {allReasons.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {reasonError && (
                <p className="text-sm text-red-500" data-testid="overdue-reason-error">{reasonError}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-sm">
                {isOtherReason ? (
                  <>Custom Overdue Reason <span className="text-red-500">*</span></>
                ) : (
                  "Remarks / Additional Details (Optional)"
                )}
              </Label>
              <Textarea
                data-testid="textarea-overdue-details"
                value={reasonDetails}
                onChange={(e) => {
                  setReasonDetails(e.target.value);
                  if (e.target.value.trim()) setDetailsError("");
                }}
                className={`min-h-[70px] resize-none${detailsError ? " border-red-500" : ""}`}
                placeholder={
                  isOtherReason
                    ? "Enter custom overdue reason..."
                    : "Enter additional remarks or details..."
                }
              />
              {detailsError && (
                <p className="text-sm text-red-500" data-testid="overdue-details-error">{detailsError}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t flex-shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="button-overdue-reason-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white"
            data-testid="button-overdue-reason-save"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
