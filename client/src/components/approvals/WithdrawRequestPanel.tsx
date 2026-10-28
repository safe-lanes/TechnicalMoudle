/**
 * Sender withdrawal of a pending approval (28-Sep-2026, Sahil E6).
 * Shows the Withdraw button to the SENDER only (the server decides — GET /approvals/withdrawals/status),
 * and the withdrawal history of this request:
 *   waiting for the office · "Withdrawn by <name> on <date>" · too late (the decision stands) · refused.
 */
import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export type WithdrawalSubjectType = "change-request" | "wo-postponement" | "defect-extension";

interface WithdrawalRow {
  awuuid: string;
  requestedByName: string | null;
  requestedAt: string;
  reason: string | null;
  outcome: "withdrawn" | "too-late" | "refused" | null;
  outcomeAt: string | null;
  outcomeNote: string | null;
}
interface WithdrawalStatus { canWithdraw: boolean; blockedReason: string | null; withdrawals: WithdrawalRow[] }

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${String(d.getUTCDate()).padStart(2, "0")}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
};

export function withdrawalStatusKey(subjectType: WithdrawalSubjectType, subjectRef: string | null | undefined, extensionId?: string | null) {
  return ["/technical/api/approvals/withdrawals/status", subjectType, subjectRef ?? null, extensionId ?? null] as const;
}

export function WithdrawRequestPanel({
  subjectType, subjectRef, extensionId = null, onWithdrawn, className = "",
}: {
  subjectType: WithdrawalSubjectType;
  subjectRef: string | null | undefined;
  extensionId?: string | null;
  onWithdrawn?: () => void;
  className?: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const key = withdrawalStatusKey(subjectType, subjectRef, extensionId);
  const status = useQuery<WithdrawalStatus>({
    queryKey: key,
    enabled: !!subjectRef && (subjectType !== "defect-extension" || !!extensionId),
    retry: false,
    queryFn: async () => {
      const qs = new URLSearchParams({ subjectType, subjectRef: String(subjectRef) });
      if (extensionId) qs.set("extensionId", extensionId);
      const res = await fetch(`/technical/api/approvals/withdrawals/status?${qs.toString()}`);
      if (!res.ok) return { canWithdraw: false, blockedReason: null, withdrawals: [] };
      return res.json();
    },
  });
  const withdraw = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/technical/api/approvals/withdrawals", {
        subjectType, subjectRef, extensionId, reason: reason.trim() || null,
      });
      return res.json() as Promise<WithdrawalRow>;
    },
    onSuccess: (row) => {
      setConfirming(false);
      setReason("");
      toast({
        title: row.outcome === "withdrawn" ? "Request withdrawn" : "Withdrawal sent",
        description: row.outcome === "withdrawn"
          ? "The approvers have been told."
          : "The office cancels the request when this reaches shore by sync.",
      });
      void queryClient.invalidateQueries({ queryKey: key });
      // The engine request is gone — refresh every approval-progress view of it.
      void queryClient.invalidateQueries({ queryKey: ["/technical/api/approval-engine/requests/status"] });
      onWithdrawn?.();
    },
    onError: (e: unknown) => {
      toast({ title: "Could not withdraw", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    },
  });

  const data = status.data;
  if (!data) return null;
  // QA round 3 WD-01 (28-Oct-2026): the settled outcomes ("Withdrawn by … on …", "too late") are already
  // rows of the "Approval process" list shown with every request, so this panel keeps only what that
  // list cannot show yet: the Withdraw button, a withdrawal still waiting for the office, and a refusal.
  const latest = data.withdrawals[0] ?? null;
  const note = latest && (latest.outcome === null || latest.outcome === "refused") ? latest : null;
  if (!data.canWithdraw && !note) return null;

  return (
    <div className={`rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700 space-y-2 ${className}`} data-testid="withdraw-request-panel">
      {note && (
        <div data-testid={`withdrawal-note-${note.outcome ?? "waiting"}`}>
          {note.outcome === null && (
            <span className="text-amber-700">
              Withdrawal sent by {note.requestedByName || "the sender"} on {day(note.requestedAt)} — waiting for the office (after sync).
            </span>
          )}
          {note.outcome === "refused" && (
            <span className="text-red-700">Withdrawal refused: {note.outcomeNote || "not the sender."}</span>
          )}
          {note.reason && <div className="text-slate-500">Reason: {note.reason}</div>}
        </div>
      )}
      {data.canWithdraw && !confirming && (
        <Button type="button" variant="outline" size="sm" className="border-slate-300"
          onClick={() => setConfirming(true)} data-testid="button-withdraw-request">
          Withdraw request
        </Button>
      )}
      {data.canWithdraw && confirming && (
        <div className="space-y-2">
          <div>Withdraw this request? The approvers are told and nothing is changed by it.</div>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)"
            className="text-xs min-h-[48px]" data-testid="input-withdraw-reason" />
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="destructive" disabled={withdraw.isPending}
              onClick={() => withdraw.mutate()} data-testid="button-withdraw-confirm">
              {withdraw.isPending ? "Withdrawing…" : "Withdraw"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
