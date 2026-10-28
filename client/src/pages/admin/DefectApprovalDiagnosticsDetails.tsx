import React from "react";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatDiagnosticsMissingWorkflow,
  formatDiagnosticsOrphan,
  formatDiagnosticsReturnedVerificationStillVerified,
  formatDiagnosticsStalled,
  projectDiagnosticsSummary,
  projectDiagnosticsUnresolvedBlocks,
} from "../defects/defectApprovalPresentation";

export type DefectApprovalDiagnostics = {
  generatedAt: string;
  available: boolean;
  healthy: boolean;
  consequence: string;
  queryPlan: { expectedQueries?: number; description?: string } | string;
  workflowMatrix?: Array<{
    scope: string;
    classification: string;
    configured: boolean;
    consequence: string;
  }>;
  summary: {
    vesselsWithDefects?: number;
    openDefectsWithRequestedExtensions?: number;
    activeWorkflows?: number;
    pendingRequests?: number;
    unresolvedApprovers?: number;
    orphanRequestedExtensions?: number;
    stalledRequests?: number;
    workflowGaps?: number;
    missingWorkflows?: number;
    returnedVerificationStillVerified?: number;
  };
  missingActiveWorkflows?: Array<{ screenId: string; classification: string; consequence: string }>;
  unresolvedApprovers: Array<{
    vesselId: string;
    vesselName: string;
    roles: Array<{ roleId: string; roleName: string; issue: "missing-workflow-role" | "missing-vessel-membership" }>;
    workflowScopes?: string[];
    consequence: string;
  }>;
  orphanRequestedExtensions: Array<{
    defectId: string;
    defectReportId: string;
    vesselId: string;
    vesselName: string;
    entryId: string;
    requestedAt: string;
    newTargetDate: string;
    consequence: string;
  }>;
  stalledRequests: Array<{
    requestUuid: string;
    defectId: string;
    defectReportId: string;
    vesselId: string;
    vesselName: string;
    screenId: string;
    submittedAt: string;
    daysPending: number;
    consequence: string;
  }>;
  returnedVerificationStillVerified: Array<{
    requestUuid: string;
    defectId: string;
    defectReportId: string;
    vesselId: string;
    vesselName: string;
    finalizedAt: string;
    consequence: string;
  }>;
};

type DefectApprovalDiagnosticsBodyProps = {
  data?: DefectApprovalDiagnostics;
  isLoading: boolean;
  error?: unknown;
};

const panelStyle: React.CSSProperties = {
  minWidth: 0,
  border: "1px solid #d9e2df",
  borderRadius: 12,
  background: "#fbfcf8",
  padding: "15px 17px",
};

const categories = [
  { key: "returnedVerificationStillVerified", label: "Defects with an incorrect verification state" },
  { key: "stalledRequests", label: "Requests without an available approver" },
  { key: "orphanRequestedExtensions", label: "Extensions never submitted for approval" },
  { key: "workflowGaps", label: "Missing approval workflows" },
  { key: "unresolvedApprovers", label: "Vessels with unresolved approvers" },
] as const;

export function DefectApprovalDiagnosticsBody({
  data,
  isLoading,
  error,
}: DefectApprovalDiagnosticsBodyProps) {
  if (isLoading) {
    return (
      <div role="status" aria-live="polite" style={{ display: "grid", gap: 12 }}>
        <div style={{ ...panelStyle, color: "#38524e" }}>Checking Defects approval readiness…</div>
        <div aria-hidden="true" style={{ height: 76, borderRadius: 12, background: "#edf2ee" }} />
        <div aria-hidden="true" style={{ height: 76, borderRadius: 12, background: "#edf2ee" }} />
      </div>
    );
  }

  if (error || data?.available === false) {
    return (
      <div role="alert" style={{ ...panelStyle, borderColor: "#d7b97e", background: "#fff8e8" }}>
        <strong style={{ display: "block", color: "#533d13", marginBottom: 5 }}>Diagnostics are unavailable</strong>
        <span style={{ color: "#665735" }}>The readiness check could not be completed. Try again later or contact your SAIL administrator.</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div role="status" style={panelStyle}>
        <strong style={{ display: "block", color: "#294a42", marginBottom: 5 }}>No diagnostics to show</strong>
        <span style={{ color: "#52665f" }}>Defects approval readiness information is not currently available.</span>
      </div>
    );
  }

  const projection = projectDiagnosticsSummary(data.summary);
  if (projection.healthy) {
    return (
      <div role="status" style={{ ...panelStyle, borderColor: "#b5d4c5", background: "#eff7f1" }}>
        <strong style={{ display: "block", color: "#204b3b", marginBottom: 5 }}>Defects approval setup is ready</strong>
        <span style={{ color: "#456357" }}>No approval readiness problems were found in this check.</span>
      </div>
    );
  }

  const returnedRows = data.returnedVerificationStillVerified ?? [];
  const stalledRows = data.stalledRequests ?? [];
  const extensionRows = data.orphanRequestedExtensions ?? [];
  const workflowRows = data.missingActiveWorkflows ?? [];
  const unresolvedRows = data.unresolvedApprovers ?? [];
  const hasRows = returnedRows.length + stalledRows.length + extensionRows.length + workflowRows.length + unresolvedRows.length > 0;
  if (!hasRows) {
    return (
      <div role="status" style={panelStyle}>
        <strong style={{ display: "block", color: "#294a42", marginBottom: 5 }}>Issue details are unavailable</strong>
        <span style={{ color: "#52665f" }}>The summary reports approval issues, but no affected records were returned. Reload the page or contact your administrator.</span>
      </div>
    );
  }

  const countFor = (key: (typeof categories)[number]["key"]) =>
    projection.chips.find((chip) => chip.key === key)?.count ?? 0;

  return (
    <div style={{ display: "grid", gap: 22, minWidth: 0 }}>
      <section aria-label="Issue counts" style={{ border: "1px solid #d9e2df", borderRadius: 12, padding: "14px 16px", background: "#f2f6f1", minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#61746b", marginBottom: 10 }}>
          Defects readiness overview
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {categories.map((category) => {
            const count = countFor(category.key);
            return (
              <div key={category.key} data-testid={`defects-diagnostics-count-${category.key}`}
                style={{ display: "flex", alignItems: "baseline", gap: 8, border: "1px solid #d5dfd9", borderRadius: 9, padding: "8px 11px", background: "#fff", minWidth: 0, maxWidth: "100%" }}>
                <strong style={{ color: count ? "#9a4d32" : "#52665f", fontSize: 16, fontVariantNumeric: "tabular-nums" }}>{count}</strong>
                <span style={{ color: "#40564e", fontSize: 12, overflowWrap: "anywhere" }}>{category.label}</span>
              </div>
            );
          })}
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.45, color: "#66766f" }}>
          Counts follow the diagnostics summary: unresolved approvers count affected vessels; other categories count their reported issues.
        </p>
      </section>

      {returnedRows.length > 0 && (
        <IssueSection title="Defects still marked verified after verification was rejected" count={countFor("returnedVerificationStillVerified")}>
          <Guidance
            impact="These defects are still marked verified after verification was rejected."
            instruction="Reconcile these defects in SAILERP under Defects before relying on their closure status."
          />
          <div style={issueListStyle}>
            {returnedRows.map((row, index) => (
              <IssueCard key={`${row.requestUuid}-${index}`} problem={formatDiagnosticsReturnedVerificationStillVerified(row)}>
                <TechnicalDetails>
                  Request: {row.requestUuid}<br />Defect: {row.defectId}<br />Vessel: {row.vesselId}<br />Finalized: {row.finalizedAt || "unknown"}
                </TechnicalDetails>
              </IssueCard>
            ))}
          </div>
        </IssueSection>
      )}

      {stalledRows.length > 0 && (
        <IssueSection title="Approvals waiting with nobody able to approve them" count={countFor("stalledRequests")}>
          <Guidance
            impact="These approval requests cannot advance because nobody can approve them."
            instruction="Open each defect as a Super Admin and use its approval decision controls to approve or return the stalled request. Then correct its workflow role in the Approval Engine builder or its users’ vessel access in the SAILERP identity or profile source before the next request."
          />
          <div style={issueListStyle}>
            {stalledRows.map((row, index) => (
              <IssueCard key={`${row.requestUuid}-${index}`} problem={formatDiagnosticsStalled(row)}>
                <TechnicalDetails>
                  Request: {row.requestUuid}<br />Defect: {row.defectId}<br />Vessel: {row.vesselId}<br />Scope: {row.screenId}
                </TechnicalDetails>
              </IssueCard>
            ))}
          </div>
        </IssueSection>
      )}

      {extensionRows.length > 0 && (
        <IssueSection title="Extension requests that were never sent for approval" count={countFor("orphanRequestedExtensions")}>
          <Guidance
            impact="These extension requests were never sent for approval."
            instruction="Review them in SAILERP under Defects and either submit them for approval or remove them."
          />
          <div style={issueListStyle}>
            {extensionRows.map((row, index) => (
              <IssueCard key={`${row.entryId}-${index}`} problem={formatDiagnosticsOrphan(row)}>
                <TechnicalDetails>
                  Extension: {row.entryId}<br />Defect: {row.defectId}<br />Vessel: {row.vesselId}
                </TechnicalDetails>
              </IssueCard>
            ))}
          </div>
        </IssueSection>
      )}

      {workflowRows.length > 0 && (
        <IssueSection title="Approval steps not yet set up" count={countFor("workflowGaps")}>
          <Guidance
            impact="These approval steps are not set up."
            instruction="Configure them in the Approval Engine builder on this page."
          />
          <div style={issueListStyle}>
            {workflowRows.map((row, index) => (
              <IssueCard key={`${row.screenId}-${row.classification}-${index}`} problem={formatDiagnosticsMissingWorkflow(row)}>
                <TechnicalDetails>Scope: {row.screenId}<br />Classification: {row.classification}</TechnicalDetails>
              </IssueCard>
            ))}
          </div>
        </IssueSection>
      )}

      {unresolvedRows.length > 0 && (
        <UnresolvedApproversSection rows={unresolvedRows} count={countFor("unresolvedApprovers")} />
      )}
    </div>
  );
}

function IssueSection({ title, count, countLabel = "issue", children }: { title: string; count: number; countLabel?: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "grid", gap: 11, minWidth: 0 }} aria-label={title}>
      <header style={{ borderBottom: "1px solid #dce4df", paddingBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 9 }}>
          <h3 style={{ margin: 0, fontSize: 16, lineHeight: 1.3, color: "#253f38", overflowWrap: "anywhere" }}>{title}</h3>
          <span style={{ fontSize: 12, color: "#566e64", background: "#edf2ee", borderRadius: 999, padding: "3px 8px" }}>
            {count} {countLabel}{count === 1 ? "" : "s"}
          </span>
        </div>
      </header>
      {children}
    </section>
  );
}

function Guidance({ impact, instruction }: { impact: string; instruction: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))", gap: 9, minWidth: 0 }}>
      <div style={panelStyle}>
        <div style={eyebrowStyle}>Impact</div>
        <p style={guidanceTextStyle}>{impact}</p>
      </div>
      <div style={{ ...panelStyle, background: "#f2f6f1" }}>
        <div style={eyebrowStyle}>What to do</div>
        <p style={guidanceTextStyle}>{instruction}</p>
      </div>
    </div>
  );
}

function IssueCard({ problem, children }: { problem: string; children: React.ReactNode }) {
  return (
    <article style={{ minWidth: 0, border: "1px solid #dce4df", borderLeft: "3px solid #9b6248", borderRadius: 10, background: "#fff", padding: "13px 15px" }}>
      <div style={eyebrowStyle}>Problem</div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, fontWeight: 600, color: "#2e413a", overflowWrap: "anywhere", wordBreak: "break-word" }}>{problem}</p>
      {children}
    </article>
  );
}

function TechnicalDetails({ children }: { children: React.ReactNode }) {
  return (
    <details style={{ marginTop: 10, borderTop: "1px solid #edf0ed", paddingTop: 8, color: "#586a62", fontSize: 12 }}>
      <summary style={{ cursor: "pointer", width: "fit-content", fontWeight: 650 }}>Technical details</summary>
      <div style={{ marginTop: 8, paddingLeft: 2, lineHeight: 1.65, overflowWrap: "anywhere", wordBreak: "break-word" }}>{children}</div>
    </details>
  );
}

function UnresolvedApproversSection({ rows, count }: { rows: DefectApprovalDiagnostics["unresolvedApprovers"]; count: number }) {
  const blocks = projectDiagnosticsUnresolvedBlocks(rows);
  return (
    <IssueSection title="Vessels with no approver assigned" count={count} countLabel="vessel">
      <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
        {blocks.map((block) => (
          <article key={block.key} style={{ minWidth: 0, border: "1px solid #dce4df", borderLeft: "3px solid #9b6248", borderRadius: 10, background: "#fff", padding: "13px 15px" }}>
            <div style={eyebrowStyle}>Affected vessels</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, fontWeight: 600, color: "#2e413a", overflowWrap: "anywhere", wordBreak: "break-word" }}>{block.vesselNames.join(", ")}</p>
            <Guidance impact={block.consequence} instruction={block.instructions.map((instruction, index) => (
              <span key={instruction} style={{ display: "block", marginTop: index ? 8 : 0 }}>
                {instruction.replace(/^What to do:\s*/, "")}
              </span>
            ))} />
            <details style={{ marginTop: 10, borderTop: "1px solid #edf0ed", paddingTop: 8, color: "#586a62", fontSize: 12 }}>
              <summary style={{ cursor: "pointer", width: "fit-content", fontWeight: 650 }}>Technical details</summary>
              <div style={{ display: "grid", gap: 9, marginTop: 8, paddingLeft: 2, lineHeight: 1.65, overflowWrap: "anywhere", wordBreak: "break-word" }}>
                {block.rows.map((row) => (
                  <div key={row.vesselId}>
                    <strong>{row.vesselName}</strong><br />
                    Vessel: {row.vesselId}<br />
                    Roles: {row.roles.map((role) => `${role.roleName} (${role.roleId}) — ${role.issue === "missing-workflow-role" ? "role missing from workflow" : "users missing vessel membership"}`).join(", ")}<br />
                    Scopes: {(row.workflowScopes ?? []).join(", ") || "none"}
                  </div>
                ))}
              </div>
            </details>
          </article>
        ))}
      </div>
    </IssueSection>
  );
}

const issueListStyle: React.CSSProperties = { display: "grid", gap: 8, minWidth: 0 };
const eyebrowStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#75847c",
  marginBottom: 5,
};
const guidanceTextStyle: React.CSSProperties = {
  margin: 0,
  lineHeight: 1.55,
  color: "#354e45",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

export function DefectApprovalDiagnosticsDetails({
  open,
  onOpenChange,
  data,
  isLoading,
  error,
  returnFocus,
}: DefectApprovalDiagnosticsBodyProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus?: () => void;
}) {
  return (
    <div data-open={open ? "true" : "false"}>
      <DialogContent
        className="flex max-h-[88dvh] w-[calc(100vw-24px)] max-w-5xl flex-col gap-0 overflow-hidden border-[#d7e0da] bg-[#f8faf6] p-0 text-[#2d443b] shadow-[0_24px_80px_rgba(35,56,47,0.22)] sm:rounded-2xl"
        onEscapeKeyDown={() => onOpenChange(false)}
        onCloseAutoFocus={returnFocus ? (event) => {
          event.preventDefault();
          returnFocus();
        } : undefined}
        style={{ height: "min(820px, calc(100dvh - 32px))" }}
      >
        <div style={{ flex: "0 0 auto", padding: "23px 58px 18px 24px", borderBottom: "1px solid #dce4df", background: "#f8faf6" }}>
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-xl font-semibold tracking-[-0.02em] text-[#253f38]">Defects approval diagnostics</DialogTitle>
            <DialogDescription className="max-w-3xl text-sm leading-6 text-[#60736a]">
              Understand what is affecting Defects approvals, what the impact is, and the next step to take.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div tabIndex={0} aria-label="Defects approval diagnostic details" className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]" style={{ padding: "20px 24px 28px", overflowWrap: "anywhere" }}>
          <DefectApprovalDiagnosticsBody
            data={error || data?.available === false ? undefined : data}
            isLoading={isLoading}
            error={error || (data?.available === false ? new Error("Diagnostics unavailable") : undefined)}
          />
        </div>
      </DialogContent>
    </div>
  );
}
