/**
 * Phase 2 / W3 — chain progress for a subject + the approve-button gate.
 *
 * useApprovalChain(screenId, subjectRef): fetches the engine request for the subject.
 * FAIL-SOFT BY DESIGN: on ships (engine not mounted → 404), with no chain configured, or on
 * any fetch error it reports { hasChain: false } and the caller renders/behaves EXACTLY as
 * before — the legacy screens' own gating stays authoritative (fallback contract).
 * When a pending chain exists: hasChain=true, canDecide = current user is in an ACTIVE
 * slot's resolved approvers — the screens gate their approve/reject buttons on it.
 */
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

interface SlotView {
  nodeKey: string; slotOrdinal: number; roleId: string; roleLabel: string;
  status: "pending" | "active" | "approved" | "rejected" | "superseded";
  decidedBy: string | null; decidedAt: string | null; remarks: string | null;
  resolvedApproverIds: string[] | null;
}
interface RequestView {
  requuid: string; status: "pending" | "approved" | "returned";
  currentNodeKey: string | null; submittedAt: string;
  snapshot: { nodes: Array<{ key: string; type: string; label: string; ordinal: number; quorum?: { rule: string; n?: number } }> };
  slots: SlotView[];
}

export function useApprovalChain(screenId: string, subjectRef: string | null | undefined) {
  const { currentUser } = useAuth();
  const q = useQuery({
    queryKey: ["/technical/api/approval-engine/requests/status", screenId, subjectRef],
    enabled: !!subjectRef,
    staleTime: 15_000,
    retry: false, // ships / engine-off answer 404 — do not hammer
    queryFn: async (): Promise<RequestView[]> => {
      const res = await fetch(`/technical/api/approval-engine/requests/status?moduleId=technical&screenId=${encodeURIComponent(screenId)}&actionId=&subjectRef=${encodeURIComponent(subjectRef!)}`);
      if (!res.ok) return [];
      return res.json();
    },
  });
  const pending = (q.data ?? []).find((r) => r.status === "pending") ?? null;
  const activeSlots = pending?.slots.filter((s) => s.status === "active") ?? [];
  const canDecide = !!currentUser?.userUuid && activeSlots.some((s) => (s.resolvedApproverIds ?? []).includes(currentUser.userUuid!));
  return { hasChain: !!pending, request: pending, canDecide, isLoading: q.isLoading && !!subjectRef };
}

const DOT: Record<string, string> = {
  approved: "#12b76a", active: "#2e90fa", pending: "#98a2b3", rejected: "#f04438", superseded: "#d0d5dd",
};

/** Compact step list; renders NOTHING when there is no pending chain. */
export function ApprovalChainProgress({ screenId, subjectRef }: { screenId: string; subjectRef: string | null | undefined }) {
  const { request } = useApprovalChain(screenId, subjectRef);
  if (!request) return null;
  const steps = request.snapshot.nodes.filter((n) => n.type === "approval-step").sort((a, b) => a.ordinal - b.ordinal);
  return (
    <div style={{ border: "1px solid #e4e7ec", borderRadius: 8, padding: 10, margin: "8px 0", fontSize: 13 }} data-testid="approval-chain-progress">
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Approval progress</div>
      {steps.map((n) => {
        const slots = request.slots.filter((s) => s.nodeKey === n.key);
        return (
          <div key={n.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ minWidth: 60 }}>{n.label || n.key}</span>
            {slots.map((s) => (
              <span key={s.slotOrdinal} title={s.decidedBy ? `${s.status} by ${s.decidedBy}${s.remarks ? ` — ${s.remarks}` : ""}` : s.status}
                style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#f9fafb", borderRadius: 10, padding: "1px 8px" }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: DOT[s.status] ?? "#98a2b3", display: "inline-block" }} />
                {s.roleLabel}
              </span>
            ))}
            {(n.quorum?.rule === "any" && slots.length > 1) && <span style={{ color: "#667085" }}>(any one)</span>}
            {(n.quorum?.rule === "nOfM") && <span style={{ color: "#667085" }}>({n.quorum.n} of {slots.length})</span>}
          </div>
        );
      })}
    </div>
  );
}
