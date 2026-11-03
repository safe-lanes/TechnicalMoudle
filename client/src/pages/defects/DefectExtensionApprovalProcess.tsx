import {
  DefectChainProgress,
  type DefectApprovalChain,
} from "@/components/approvals/ApprovalChainProgress";
import {
  formatProcessTime,
  type ApprovalProcess,
} from "@/components/approvals/ApprovalProcessSection";
import { formatDefectProcessActor } from "./defectApprovalPresentation";

const EVENT_COLOR: Record<string, string> = {
  submitted: "#2e90fa",
  approved: "#12b76a",
  completed: "#12b76a",
  forwarded: "#12b76a",
  "ts-acknowledged": "#12b76a",
  rejected: "#f04438",
  "ts-rejected": "#f04438",
  "withdrawal-too-late": "#f79009",
  reopened: "#f79009",
  "withdrawal-requested": "#98a2b3",
  withdrawn: "#98a2b3",
};

export interface DefectExtensionApprovalProcessProps {
  /** Identifies which approval history is being rendered; defaults to the B5 extension scope. */
  scope?: "extension" | "verification";
  process?: ApprovalProcess | null;
  isLoading?: boolean;
  chain?: DefectApprovalChain | null;
  chainStatus?: "loading" | "error" | "resolved";
  /** Quietly omit engine-unavailable notices for already verified vessel records. */
  quietWhenUnavailable?: boolean;
}

/** One compact process history with current pending-step context when available. */
export function DefectExtensionApprovalProcess({
  scope = "extension",
  process,
  isLoading = false,
  chain,
  chainStatus = "resolved",
  quietWhenUnavailable = false,
}: DefectExtensionApprovalProcessProps) {
  const scopePrefix = scope === "verification" ? "verification" : "extension";
  const attempts = Array.isArray(process?.attempts) ? process.attempts : [];
  const hasEvents = attempts.some((attempt) => (attempt.events ?? []).length > 0);
  // A workflow preview is not an approval request and must not be presented as process history.
  const hasPersistedRequest = Boolean(chain?.requestUuid);
  const processChain = quietWhenUnavailable || (scope === "verification" && !hasPersistedRequest) ? null : chain;
  const pendingStep = hasEvents && processChain && String(processChain.requestStatus).toLowerCase() === "pending"
    ? processChain.steps.find((step) => processChain.currentStepKey && (step.key || step.stepKey || step.nodeKey) === processChain.currentStepKey)
      ?? processChain.steps.find((step) => String(step.status).toLowerCase() === "active")
      ?? processChain.steps.find((step) => (step.slots ?? []).some((slot) => String(slot.status).toLowerCase() === "active"))
      ?? processChain.steps.find((step) => String(step.status).toLowerCase() === "pending")
    : undefined;
  const pendingSlots = pendingStep?.slots ?? [];

  // On a vessel the approval engine can be absent even though the saved verification is authoritative.
  // Keep known events, but do not add a second, unconfirmed-state message (or an empty panel).
  if (quietWhenUnavailable && attempts.length === 0 && !processChain) return null;

  return (
    <section className="min-w-0 rounded border border-slate-200 bg-white p-3 text-sm" data-testid={`defect-${scopePrefix}-approval-process`}>
      <h4 className="mb-2 font-semibold text-slate-800">Approval process</h4>
      {attempts.length > 0 ? attempts.map((attempt, attemptIndex) => {
        const events = Array.isArray(attempt.events) ? attempt.events : [];
        return (
        <div key={attempt.number ?? attemptIndex} className="mb-2 last:mb-0">
          <div className="mb-1 text-xs font-medium text-slate-500">
            Attempt {attempt.number ?? "number not recorded"}
          </div>
          {events.length > 0 ? (
            <div className="space-y-1">
              {events.map((event, index) => (
                <div key={`${attempt.number}-${index}`} className="grid min-w-0 grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-[minmax(9rem,35%)_minmax(0,1fr)]">
                  <div className="flex min-w-0 items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-1 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: EVENT_COLOR[event.type] ?? "#98a2b3" }}
                    />
                    <strong className="min-w-0 font-semibold text-slate-800 [overflow-wrap:anywhere]">
                      {event.label}
                    </strong>
                  </div>
                  <div className="min-w-0 text-xs text-slate-600 [overflow-wrap:anywhere]">
                    {formatDefectProcessActor(event)} on {formatProcessTime(event.at)}
                  </div>
                  {event.remarks && (
                    <div className="min-w-0 whitespace-pre-wrap text-xs text-slate-600 [overflow-wrap:anywhere] sm:col-start-2">
                      {event.remarks}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500">No events recorded for this attempt.</div>
          )}
        </div>
        );
      }) : isLoading ? (
        <>
          <p className="text-xs text-slate-600" data-testid={`${scopePrefix}-process-loading`}>
            Loading approval process...
          </p>
          {processChain && <DefectChainProgress chain={processChain} title="" actorDetail="role" />}
          {scope === "verification" && !processChain && chainStatus === "error" && !quietWhenUnavailable && (
            <p className="mt-2 text-xs text-slate-600" data-testid={`${scopePrefix}-current-chain-unresolved`}>
              Current approval-chain status could not be confirmed.
            </p>
          )}
        </>
      ) : processChain ? (
        <DefectChainProgress chain={processChain} title="" actorDetail="role" />
      ) : (
        <p className="text-xs text-slate-600 [overflow-wrap:anywhere]" data-testid={`${scopePrefix}-process-unavailable`}>
          {chainStatus === "loading"
            ? "Approval process history is unavailable. Current approval-chain status is still loading."
            : chainStatus === "error"
              ? "Approval process history is unavailable. Current approval-chain status could not be confirmed."
              : process
                ? scope === "verification"
                  ? "No verification process events are recorded, and no persisted approval request is available."
                  : "No approval process events are recorded, and no current approval chain was returned."
                : scope === "verification"
                  ? "Verification process history is unavailable. No persisted approval request was returned; historical approval data was not inferred."
                  : "Approval process history is unavailable. No current approval chain was returned; historical approval data was not inferred."}
        </p>
      )}
      {attempts.length > 0 && !hasEvents && processChain && (
        <DefectChainProgress chain={processChain} title="" actorDetail="role" />
      )}
      {attempts.length > 0 && !hasEvents && !processChain && chainStatus !== "resolved" && !quietWhenUnavailable && (
        <p className="mt-2 text-xs text-slate-600">
          {chainStatus === "loading"
            ? "Current approval-step status is still loading."
            : "Current approval-step status could not be confirmed."}
        </p>
      )}
      {hasEvents && chainStatus !== "resolved" && !quietWhenUnavailable && (
        <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-600" data-testid={`${scopePrefix}-current-chain-unresolved`}>
          {chainStatus === "loading"
            ? "Current approval-step status is still loading."
            : "Current approval-step status could not be confirmed."}
        </p>
      )}
      {pendingStep && (
        <div className="mt-2 border-t border-slate-100 pt-2" data-testid={`${scopePrefix}-current-pending-step`}>
          <div className="text-xs font-medium text-slate-700">
            Current pending step{pendingStep.label || pendingStep.name ? `: ${pendingStep.label || pendingStep.name}` : ""}
          </div>
          {pendingSlots.map((slot, index) => (
            <div key={slot.slotId || index} className="mt-1 min-w-0 text-xs text-slate-600 [overflow-wrap:anywhere]">
              {slot.roleLabel ? `${slot.roleLabel}: ` : ""}{String(slot.status || "pending").toLowerCase()}
              {slot.decidedByName || slot.decidedByRole || ["approved", "rejected"].includes(String(slot.status).toLowerCase())
                ? ` — ${formatDefectProcessActor({ byName: slot.decidedByName, byRole: slot.decidedByRole })}` : ""}
              {slot.decidedAt ? ` on ${formatProcessTime(slot.decidedAt)}` : ""}
              {slot.remarks ? (
                <div className="ml-3 whitespace-pre-wrap [overflow-wrap:anywhere]">{slot.remarks}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
