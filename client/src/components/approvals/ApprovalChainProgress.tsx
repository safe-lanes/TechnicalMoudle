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
import { formatDecidedSlotRemark, formatMaritimeUtcDateTime } from "@/pages/defects/defectApprovalPresentation";

export class DefectApprovalChainFetchError extends Error {
  constructor(message: string, public readonly code?: string, public readonly status?: number) {
    super(message);
    this.name = "DefectApprovalChainFetchError";
  }
}

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

/** The compact response used by the defects approval-chain endpoint. */
export interface DefectApprovalStep {
  key?: string;
  stepKey?: string;
  nodeKey?: string;
  label?: string;
  name?: string;
  status?: string;
  decidedBy?: string | null;
  decidedByName?: string | null;
  decidedByPosition?: string | null;
  decidedAt?: string | null;
  remarks?: string | null;
  slots?: Array<{
    slotId?: string;
    roleLabel?: string;
    status?: string;
    decidedBy?: string | null;
    decidedByName?: string | null;
    decidedByPosition?: string | null;
    decidedAt?: string | null;
    remarks?: string | null;
  }>;
  [key: string]: unknown;
}

export interface DefectApprovalChain {
  hasActiveWorkflow: boolean;
  scope?: string | null;
  classification?: string | null;
  requestStatus?: string | null;
  requestUuid?: string | null;
  currentStepKey?: string | null;
  steps: DefectApprovalStep[];
  currentUserCanDecide: boolean;
  currentUserSlotId?: string | null;
  extensionChains?: Record<string, DefectApprovalChain>;
}

export function defectApprovalChainQueryKey(
  defectId: string | number | null | undefined,
  action: "extension" | "verification",
) {
  return [`/technical/api/defects/${defectId}/approval-chain`, action] as const;
}

export function useDefectApprovalChain(
  defectId: string | number | null | undefined,
  action: "extension" | "verification",
) {
  return useQuery<DefectApprovalChain>({
    queryKey: defectApprovalChainQueryKey(defectId, action),
    enabled: defectId !== null && defectId !== undefined && String(defectId) !== "",
    retry: false,
    queryFn: async () => {
      const response = await fetch(
        `/technical/api/defects/${encodeURIComponent(String(defectId))}/approval-chain?action=${action}`,
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new DefectApprovalChainFetchError(
          typeof body?.error === "string" ? body.error : `Could not load approval status (${response.status})`,
          typeof body?.code === "string" ? body.code : undefined,
          response.status,
        );
      }
      return response.json();
    },
  });
}

/** Host admin roles that get a blanket decide override (mirror of mount.ts APPROVAL_ADMIN_ROLES). */
const APPROVAL_ADMIN_ROLES: ReadonlySet<string> = new Set(["Sail Admin", "Super Admin", "PMS Admin"]);

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
  // F3b (narrowed — Q3): an admin sees the decide button ONLY when the active step resolved to
  // ZERO approvers (nobody could otherwise act — a Super Admin configured as the sole approver
  // whose crew row is absent, or a stalled step). Mirrors the server override in engine.decide;
  // the decision is recorded there as an admin override. Admins do NOT get the button on steps
  // that already have other resolved approvers.
  const isAdmin = !!currentUser?.role && APPROVAL_ADMIN_ROLES.has(currentUser.role);
  const activeAllUnresolved = activeSlots.length > 0 && activeSlots.every((s) => (s.resolvedApproverIds ?? []).length === 0);
  const canDecide = !!pending && (
    (!!currentUser?.userUuid && activeSlots.some((s) => (s.resolvedApproverIds ?? []).includes(currentUser.userUuid!)))
    || (isAdmin && activeAllUnresolved)
  );
  // F3 safety-net: an ACTIVE slot that resolved to zero approvers would otherwise sit forever
  // with no button, no notification and no error. Surface it so the caller (progress panel /
  // admin view) can show "no approver resolved" instead of stalling silently.
  const unresolvedActiveSlots = activeSlots.filter((s) => (s.resolvedApproverIds ?? []).length === 0);
  return {
    hasChain: !!pending,
    request: pending,
    canDecide,
    hasUnresolvedApprover: !!pending && unresolvedActiveSlots.length > 0,
    unresolvedRoleLabels: unresolvedActiveSlots.map((s) => s.roleLabel),
    isLoading: q.isLoading && !!subjectRef,
  };
}

/**
 * The SINGLE source of truth for "can this user act on this request".
 * When the engine owns a pending chain, the engine's canDecide is authoritative; otherwise
 * the caller's legacy gate stands (fallback contract). EVERY screen that renders a CR or
 * postponement approve/reject button must gate on this — never re-derive the rule inline
 * (that divergence was the AE-10 dashboard leak).
 */
export function resolveCanAct(
  engine: { hasChain: boolean; canDecide: boolean },
  legacyCanAct: boolean,
): boolean {
  return engine.hasChain ? engine.canDecide : legacyCanAct;
}

const DOT: Record<string, string> = {
  approved: "#12b76a", active: "#2e90fa", pending: "#98a2b3", rejected: "#f04438", superseded: "#d0d5dd",
};

/** Compact step list; renders NOTHING when there is no pending chain. */
export function ApprovalChainProgress({
  screenId,
  subjectRef,
  chain,
}: {
  screenId: string;
  subjectRef: string | null | undefined;
  /** Supply this for the compact defects endpoint without changing legacy consumers. */
  chain?: DefectApprovalChain | null;
}) {
  // Keep the existing request/status behavior untouched for PMS and Work Orders. A supplied
  // chain intentionally disables that legacy query and only changes this component's data view.
  const { request } = useApprovalChain(screenId, chain !== undefined ? null : subjectRef);
  if (chain !== undefined) {
    if (!chain || (!chain.hasActiveWorkflow && !chain.steps?.length && !["rejected", "returned"].includes(String(chain.requestStatus).toLowerCase()))) return null;
    return <DefectChainProgress chain={chain} />;
  }
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
            {slots.map((s) => {
              // F3 safety-net: an active slot with no resolved approver would stall silently.
              const unresolved = s.status === "active" && (s.resolvedApproverIds ?? []).length === 0;
              return (
                <span key={s.slotOrdinal} title={s.decidedBy ? `${s.status} by ${s.decidedBy}${s.remarks ? ` — ${s.remarks}` : ""}` : unresolved ? `No approver assigned for this vessel — assign the vessel to an approver (${s.roleLabel}) in SAILERP` : s.status}
                  data-testid={unresolved ? "approval-slot-unresolved" : undefined}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, background: unresolved ? "#fef3f2" : "#f9fafb", border: unresolved ? "1px solid #fda29b" : undefined, color: unresolved ? "#b42318" : undefined, borderRadius: 10, padding: "1px 8px" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: DOT[s.status] ?? "#98a2b3", display: "inline-block" }} />
                  {s.roleLabel}{unresolved ? " — no approver assigned for this vessel" : ""}
                </span>
              );
            })}
            {(n.quorum?.rule === "any" && slots.length > 1) && <span style={{ color: "#667085" }}>(any one)</span>}
            {(n.quorum?.rule === "nOfM") && <span style={{ color: "#667085" }}>({n.quorum.n} of {slots.length})</span>}
          </div>
        );
      })}
    </div>
  );
}

export function DefectChainProgress({ chain }: { chain: DefectApprovalChain }) {
  const steps = Array.isArray(chain.steps) ? chain.steps : [];
  const rejectedStep = steps.flatMap((step) => step.slots ?? []).find((slot) => String(slot.status).toLowerCase() === "rejected")
    || steps.find((step) => String(step.status).toLowerCase() === "rejected");
  const requestRejected = ["rejected", "returned"].includes(String(chain.requestStatus).toLowerCase());
  const rejection = rejectedStep || (requestRejected
    ? steps.flatMap((step) => [step, ...(step.slots ?? [])]).find((item) => item.remarks || item.decidedBy || item.decidedByName)
    : undefined);
  const chainRecord = chain as DefectApprovalChain & { rejectedBy?: string | null; rejectionReason?: string | null; remarks?: string | null };
  const rejectionAttribution = rejection?.decidedBy || rejection?.decidedByName || chainRecord.rejectedBy;
  const rejectionReason = rejection?.remarks || chainRecord.rejectionReason || chainRecord.remarks;

  return (
    <div style={{ border: "1px solid #e4e7ec", borderRadius: 8, padding: 10, margin: "8px 0", fontSize: 13 }} data-testid="approval-chain-progress">
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Approval progress</div>
      <div className="space-y-1">
        {steps.length === 0 ? (
          <div className="text-sm text-gray-600">No approval steps are configured.</div>
        ) : steps.map((step, index) => {
          const key = step.key || step.stepKey || step.nodeKey || `step-${index}`;
          const status = String(step.status || (chain.currentStepKey === key ? "active" : "pending")).toLowerCase();
          const color = status === "approved" ? "#12b76a" : status === "active" ? "#2e90fa" : status === "rejected" ? "#f04438" : "#98a2b3";
          return (
            <div key={key} className="flex items-center gap-2 flex-wrap">
              <span className="min-w-[90px]">{step.label || step.name || key}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5">
                <span style={{ width: 8, height: 8, borderRadius: 4, background: color, display: "inline-block" }} />
                {status}
              </span>
              {step.decidedBy && <span className="text-gray-600">by {step.decidedBy}</span>}
              {step.slots?.map((slot, slotIndex) => {
                const remark = formatDecidedSlotRemark(slot.status, slot.remarks);
                return (
                  <div key={slot.slotId || `${key}-slot-${slotIndex}`} className="flex flex-col items-start gap-1">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${slot.status === "rejected" ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-700"}`}>
                      {slot.roleLabel || "Approver"}: {String(slot.status || "pending").toLowerCase()}
                      {slot.decidedByName ? ` — ${slot.decidedByName}` : ""}
                      {slot.decidedByPosition ? ` (${slot.decidedByPosition})` : ""}
                      {slot.decidedAt ? ` on ${formatMaritimeUtcDateTime(slot.decidedAt)}` : ""}
                    </span>
                    {remark ? (
                      <div className="ml-2 max-w-xl whitespace-pre-wrap text-xs text-gray-600" data-testid="approval-slot-remark">
                        {remark}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {(rejection || requestRejected) && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-red-800" data-testid="approval-rejection-attribution">
          <div className="font-medium">Rejected{rejectionAttribution ? ` by ${rejectionAttribution}` : ""}</div>
          {rejectionReason && <div>{rejectionReason}</div>}
        </div>
      )}
    </div>
  );
}
