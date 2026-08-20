import React, { useState, useEffect } from "react";
import { ApprovalChainProgress, useApprovalChain } from '@/components/approvals/ApprovalChainProgress';
import { useQuery } from "@tanstack/react-query";
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
import { CheckCircle, XCircle, Info } from "lucide-react";
import { useLocalApprovers } from "@/hooks/useExternalMasterData";
import { useAuth } from "@/contexts/AuthContext";
import { useUIRole } from "@/contexts/UIRoleContext";
import { useVessel } from "@/contexts/VesselContext";

interface PostponeApprovalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: {
    id?: string | null;
    wouuid?: string | null;
    workOrderNo?: string | null;
    templateCode?: string | null;
    executionId?: string | null;
    component?: string | null;
    jobTitle?: string | null;
    dueDate?: string | null;
    postponeRequestedDate?: string | null;
    postponementReason?: string | null;
    postponementRemarks?: string | null;
    vesselId?: string | null;
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
  <div className="space-y-1">
    <Label className="text-sm">{label}</Label>
    <Input
      value={value || "—"}
      className="bg-gray-50 h-9"
      readOnly
    />
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

  const { currentUser } = useAuth();
  const { isVessel, isHeadOfDept, isSailAdmin } = useUIRole();
  const { assignedVesselIds } = useVessel();
  const { data: localApprovers = [], isError: approversError, isLoading: approversLoading } = useLocalApprovers();

  const { data: approvalSteps = [], isError: stepsError, isLoading: stepsLoading } = useQuery({
    queryKey: ['/technical/api/work-orders', workOrder?.id, 'postpone-approval-steps'],
    queryFn: async () => {
      const res = await fetch(`/technical/api/work-orders/${workOrder!.id}/postpone-approval-steps`);
      if (!res.ok) throw new Error(`Failed to fetch postpone approval steps: ${res.status}`);
      return res.json();
    },
    enabled: isOpen && !!workOrder?.id,
  });

  const userApproverLevels: string[] = localApprovers
    .filter((a: any) =>
      a.userUuid && currentUser?.userUuid &&
      a.userUuid === currentUser.userUuid &&
      a.isActive === 1 && !a.isDeleted
    )
    .map((a: any) => a.approverLevel as string);

  const activeStep = approvalSteps.find((s: any) => s.status === 'Pending');
  const noStepsYet = approvalSteps.length === 0;
  const noApproversConfigured = !localApprovers.some((a: any) => a.isActive === 1 && !a.isDeleted);

  // Vessel gate: approver must be assigned to the request's vessel (from profile).
  // Sail Admin bypasses. Empty assignedVesselIds = no profile assignments = global scope (safe fallback).
  const requestVesselId = workOrder?.vesselId ?? null;
  const vesselIsAssigned =
    isSailAdmin
    || assignedVesselIds.length === 0
    || (!!requestVesselId && assignedVesselIds.includes(requestVesselId));

  // Phase 2 / W3 — approval-engine gate (fail-soft: no chain → legacy gating unchanged).
  // Postponement vs re-postponement share the WO subject; check both scopes.
  const chainPost = useApprovalChain('pms-wo-postponement', isOpen ? workOrder?.wouuid : null);
  const chainRePost = useApprovalChain('pms-wo-re-postponement', isOpen ? workOrder?.wouuid : null);
  const engineChain = chainPost.hasChain ? chainPost : chainRePost;

  const legacyUserCanAct = vesselIsAssigned && (
    (approversLoading || stepsLoading || approversError || stepsError)
      ? false
      : (noStepsYet || noApproversConfigured)
        ? (!isVessel && !isHeadOfDept)
        : !!activeStep && userApproverLevels.includes(activeStep.approvalLevel)
  );
  const userCanAct = engineChain.hasChain ? engineChain.canDecide : legacyUserCanAct;
  const engineScreenId = chainPost.hasChain ? 'pms-wo-postponement' : chainRePost.hasChain ? 'pms-wo-re-postponement' : null;

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

  const pendingLevelLabel = activeStep?.approvalLevel === 'Level2' ? 'Level 2' : 'Level 1';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="dialog-postpone-approval">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            Review Postponement Request
          </DialogTitle>
          {engineScreenId && <ApprovalChainProgress screenId={engineScreenId} subjectRef={workOrder?.wouuid ?? null} />}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          <div className="space-y-3 py-4">
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

            <div className="space-y-1">
              <Label className="text-sm">Remarks / Additional Details</Label>
              <p className="text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded px-3 py-2 min-h-[60px]">
                {workOrder.postponementRemarks || "—"}
              </p>
            </div>

            {/* 90-day advisory warning for approver — informational only */}
            {(() => {
              const orig = workOrder.dueDate;
              const requested = workOrder.postponeRequestedDate;
              if (!orig || !requested) return null;
              const origDate = /^\d{4}-\d{2}-\d{2}/.test(orig)
                ? new Date(orig + "T00:00:00")
                : new Date(orig);
              const reqDate = /^\d{4}-\d{2}-\d{2}/.test(requested)
                ? new Date(requested + "T00:00:00")
                : new Date(requested);
              if (isNaN(origDate.getTime()) || isNaN(reqDate.getTime())) return null;
              origDate.setHours(0, 0, 0, 0);
              reqDate.setHours(0, 0, 0, 0);
              const diffDays = Math.round((reqDate.getTime() - origDate.getTime()) / 86400000);
              if (diffDays <= 90) return null;
              return (
                <div
                  className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
                  data-testid="warning-approval-90-days"
                >
                  <span className="mt-0.5 shrink-0 text-amber-500">⚠</span>
                  <span>
                    Warning: This postponement exceeds the recommended 90-day limit from the Work Order Due Date. Please review carefully before approving.
                  </span>
                </div>
              );
            })()}

            {userCanAct && (
              <div className="space-y-1">
                <Label htmlFor="approver-remarks" className="text-sm">
                  Approver Remarks <span className="text-red-500">*</span> (required for rejection)
                </Label>
                <Textarea
                  id="approver-remarks"
                  data-testid="textarea-approver-remarks"
                  className={`text-sm resize-none ${remarksError ? "border-red-400" : ""}`}
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
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                data-testid="button-postpone-approval-cancel"
              >
                Cancel
              </Button>

              {userCanAct ? (
                <>
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
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-500 italic" data-testid="text-postpone-not-approver">
                  <Info className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  {activeStep
                    ? `Awaiting ${pendingLevelLabel} approval — you are not the designated approver for this step.`
                    : 'This postponement is pending approval.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostponeApprovalDialog;
