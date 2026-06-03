import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle } from "lucide-react";

interface PostponeApprovalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: {
    id?: string | null;
    workOrderNo?: string | null;
    templateCode?: string | null;
    executionId?: string | null;
    component?: string | null;
    jobTitle?: string | null;
    dueDate?: string | null;
    postponeRequestedDate?: string | null;
    postponementReason?: string | null;
    postponementRemarks?: string | null;
  } | null;
  onApprove: (workOrderId: string, remarks: string) => void;
  onReject: (workOrderId: string, remarks: string) => void;
  isSubmitting?: boolean;
}

const formatDateDisplay = (val: string | null | undefined): string => {
  if (!val) return "—";
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const [y, m, d] = val.split("T")[0].split("-").map(Number);
    return `${String(d).padStart(2,"0")}-${months[m - 1]}-${y}`;
  }
  return val;
};

const ReadOnlyField: React.FC<{ label: string; value: string | null | undefined }> = ({ label, value }) => (
  <div>
    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</Label>
    <p className="mt-0.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded px-3 py-2 min-h-[36px]">
      {value || "—"}
    </p>
  </div>
);

const PostponeApprovalDialog: React.FC<PostponeApprovalDialogProps> = ({
  isOpen,
  onClose,
  workOrder,
  onApprove,
  onReject,
  isSubmitting = false,
}) => {
  const [approverRemarks, setApproverRemarks] = useState("");
  const [remarksError, setRemarksError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setApproverRemarks("");
      setRemarksError("");
    }
  }, [isOpen, workOrder?.id]);

  if (!workOrder) return null;

  const woDisplayId = workOrder.templateCode || workOrder.workOrderNo || workOrder.executionId || "—";

  const handleApprove = () => {
    setRemarksError("");
    if (!workOrder.id) return;
    onApprove(workOrder.id, approverRemarks.trim());
  };

  const handleReject = () => {
    if (!approverRemarks.trim()) {
      setRemarksError("Approver remarks are required when rejecting a postponement.");
      return;
    }
    setRemarksError("");
    if (!workOrder.id) return;
    onReject(workOrder.id, approverRemarks.trim());
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl w-full max-h-[90vh] overflow-y-auto" data-testid="dialog-postpone-approval">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-gray-900">
            Review Postponement Request
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-4">
            <ReadOnlyField label="Work Order ID" value={woDisplayId} />
            <ReadOnlyField label="Component" value={workOrder.component} />
          </div>

          <ReadOnlyField label="Job Title" value={workOrder.jobTitle} />

          <div className="grid grid-cols-2 gap-4">
            <ReadOnlyField label="Original Due Date" value={formatDateDisplay(workOrder.dueDate)} />
            <ReadOnlyField label="Requested New Date" value={formatDateDisplay(workOrder.postponeRequestedDate)} />
          </div>

          <ReadOnlyField label="Reason for Postponement" value={workOrder.postponementReason} />
          <ReadOnlyField label="Remarks / Additional Details" value={workOrder.postponementRemarks} />

          <div>
            <Label htmlFor="approver-remarks" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Approver Remarks <span className="text-red-500">*</span> (required for rejection)
            </Label>
            <Textarea
              id="approver-remarks"
              data-testid="textarea-approver-remarks"
              className={`mt-1 text-sm resize-none ${remarksError ? "border-red-400" : ""}`}
              rows={3}
              placeholder="Enter your remarks (required if rejecting)..."
              value={approverRemarks}
              onChange={(e) => {
                setApproverRemarks(e.target.value);
                if (remarksError) setRemarksError("");
              }}
              disabled={isSubmitting}
            />
            {remarksError && (
              <p className="mt-1 text-xs text-red-500" data-testid="error-approver-remarks">{remarksError}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              data-testid="button-postpone-approval-cancel"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              className="border-red-400 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={handleReject}
              disabled={isSubmitting}
              data-testid="button-postpone-reject"
            >
              <XCircle className="h-4 w-4 mr-1.5" />
              Reject
            </Button>
            <Button
              className="bg-[#1E5A8E] hover:bg-[#174a78] text-white"
              onClick={handleApprove}
              disabled={isSubmitting}
              data-testid="button-postpone-approve"
            >
              <CheckCircle className="h-4 w-4 mr-1.5" />
              Approve
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostponeApprovalDialog;
