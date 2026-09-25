/**
 * Phase 2 / W4 — routes the GENERIC engine admin screen (Sahil's builder) into Technical's
 * admin area. Office-only (menu hides it for vessel roles; the API refuses config writes for
 * non-office callers) and shore-only (the engine does not mount on ships). The legacy
 * ApprovalWorkflow screen stays untouched and reachable until cutover.
 */
import React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ApprovalEngineAdmin from "../../../../server/modules/approval-engine/client/ApprovalEngineAdmin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  formatDiagnosticsOrphan,
  formatDiagnosticsMissingWorkflow,
  formatDiagnosticsStalled,
  formatDiagnosticsReturnedVerificationStillVerified,
  projectDiagnosticsUnresolvedBlocks,
  projectDiagnosticsSummary,
} from "../defects/defectApprovalPresentation";

type DefectApprovalDiagnostics = {
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
  unresolvedApprovers: Array<{ vesselId: string; vesselName: string; roles: Array<{ roleId: string; roleName: string; issue: "missing-workflow-role" | "missing-vessel-membership" }>; workflowScopes?: string[]; consequence: string }>;
  orphanRequestedExtensions: Array<{ defectId: string; defectReportId: string; vesselId: string; vesselName: string; entryId: string; requestedAt: string; newTargetDate: string; consequence: string }>;
  stalledRequests: Array<{ requestUuid: string; defectId: string; defectReportId: string; vesselId: string; vesselName: string; screenId: string; submittedAt: string; daysPending: number; consequence: string }>;
  returnedVerificationStillVerified: Array<{ requestUuid: string; defectId: string; defectReportId: string; vesselId: string; vesselName: string; finalizedAt: string; consequence: string }>;
};

function DefectApprovalDiagnosticsPanel() {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { data, isLoading, error } = useQuery<DefectApprovalDiagnostics>({
    queryKey: ["/technical/api/defects/approval-diagnostics"],
    staleTime: 60_000,
    retry: false,
  });
  return (
    <section
      aria-label="Defects approval diagnostics"
      data-testid="defects-approval-diagnostics"
      style={{ margin: "12px", padding: "14px", border: "1px solid #d0d5dd", borderRadius: 8, background: "#fff" }}
    >
      <h2 style={{ margin: 0, fontSize: 16, color: "#1e3a5f" }}>Defects approval diagnostics</h2>
      <p style={{ margin: "4px 0 12px", fontSize: 12, color: "#667085" }}>
        Read-only safety checks for configured Defects approval workflows.
      </p>
      {isLoading && <div style={{ fontSize: 13 }}>Loading diagnostics...</div>}
      {(error || data?.available === false) && <div style={{ color: "#b42318", fontSize: 13 }}>Diagnostics unavailable. Contact your administrator.</div>}
      {data && (
        <>
          {data.available !== false && (() => {
            const projection = projectDiagnosticsSummary(data.summary);
            return projection.healthy ? (
              <div style={{ fontSize: 12, color: "#067647", marginBottom: 8 }} data-testid="defects-diagnostics-healthy">
                Approvals are set up correctly and no issues were found.
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
                {projection.chips.map((chip) => (
                  <span key={chip.key} data-testid={`diagnostics-chip-${chip.key}`} style={{
                    padding: "5px 9px", borderRadius: 999, fontSize: 12,
                    border: "1px solid #fda29b",
                    background: "#fff1f0",
                    color: "#b42318",
                  }}><strong>{chip.count}</strong> {chip.label}</span>
                ))}
                <Button variant="outline" size="sm" onClick={() => setDetailsOpen(true)}>View details</Button>
              </div>
            );
          })()}
          <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Defects approval diagnostics</DialogTitle>
                <DialogDescription>Problems that need action before Defects approvals can work reliably.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <DiagnosticsGroup
                  title="Defects still marked verified after verification was rejected"
                  rows={data.returnedVerificationStillVerified ?? []}
                  format={formatDiagnosticsReturnedVerificationStillVerified}
                  consequence="These defects are still marked verified after verification was rejected."
                  instruction="What to do: reconcile these defects in SAILERP under Defects before relying on their closure status."
                  technical={(row) => <>Request: {row.requestUuid}<br />Defect: {row.defectId}<br />Vessel: {row.vesselId}<br />Finalized: {row.finalizedAt || "unknown"}</>}
                />
                <DiagnosticsGroup title="Approvals waiting with nobody able to approve them" rows={data.stalledRequests} format={formatDiagnosticsStalled}
                  consequence="These approval requests cannot advance because nobody can approve them."
                  instruction="What to do: open each defect as a Super Admin and use its approval decision controls to approve or return the stalled request. Then correct its workflow role in the Approval Engine builder or its users' vessel access in the SAILERP identity or profile source before the next request."
                  technical={(row) => <>Request: {row.requestUuid}<br />Defect: {row.defectId}<br />Vessel: {row.vesselId}<br />Scope: {row.screenId}</>} />
                <DiagnosticsGroup title="Extension requests that were never sent for approval" rows={data.orphanRequestedExtensions} format={formatDiagnosticsOrphan}
                  consequence="These extension requests were never sent for approval."
                  instruction="What to do: review them in SAILERP under Defects and either submit them for approval or remove them."
                  technical={(row) => <>Extension: {row.entryId}<br />Defect: {row.defectId}<br />Vessel: {row.vesselId}</>} />
                <DiagnosticsGroup title="Approval steps not yet set up" rows={data.missingActiveWorkflows ?? []}
                  format={formatDiagnosticsMissingWorkflow}
                  consequence="These approval steps are not set up."
                  instruction="What to do: configure them in the Approval Engine builder on this page."
                  technical={(row) => <>Scope: {row.screenId}<br />Classification: {row.classification}</>} />
                <UnresolvedApproversGroup rows={data.unresolvedApprovers} />
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </section>
  );
}

function DiagnosticsGroup<T>({ title, rows, format, consequence, instruction, technical }: {
  title: string;
  rows: T[];
  format: (row: T) => string;
  consequence: string;
  instruction: string;
  technical: (row: T) => React.ReactNode;
}) {
  if (!rows.length) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 13 }}>{title} ({rows.length})</h3>
      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: "#344054" }}>
        {rows.slice(0, 25).map((row, index) => (
          <li key={`${title}-${index}`}>{format(row)}</li>
        ))}
      </ul>
      <p className="mb-1 mt-2 text-xs text-slate-700">{consequence}</p>
      <p className="mb-1 text-xs text-slate-700">{instruction}</p>
      <details className="mt-1 text-xs text-slate-500">
        <summary className="cursor-pointer">Technical details</summary>
        <div className="mt-1 space-y-2 pl-2">
          {rows.slice(0, 25).map((row, index) => <div key={`${title}-technical-${index}`}>{technical(row)}</div>)}
        </div>
      </details>
    </div>
  );
}

function UnresolvedApproversGroup({ rows }: { rows: DefectApprovalDiagnostics["unresolvedApprovers"] }) {
  if (!rows.length) return null;
  const blocks = projectDiagnosticsUnresolvedBlocks(rows);
  return (
    <div style={{ marginTop: 10 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 13 }}>Vessels with no approver assigned ({rows.length})</h3>
      <div className="space-y-3 text-xs text-slate-700">
        {blocks.map((block) => (
          <div key={block.key}>
            <div>{block.vesselNames.join(", ")}</div>
            <p className="mb-1 mt-2">{block.consequence}</p>
            {block.instructions.map((instruction) => <p key={instruction} className="mb-1">{instruction}</p>)}
            <details className="mt-1 text-slate-500">
              <summary className="cursor-pointer">Technical details</summary>
              <div className="mt-1 space-y-2 pl-2">
                {block.rows.map((row) => (
                  <div key={row.vesselId}>
                    {row.vesselName}<br />
                    Vessel: {row.vesselId}<br />
                    Roles: {row.roles.map((role) => `${role.roleName} (${role.roleId})`).join(", ")}<br />
                    Scopes: {(row.workflowScopes ?? []).join(", ") || "none"}
                  </div>
                ))}
              </div>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}

// F4: admin-visible email delivery status + the per-tenant ON/OFF toggle (mig 172). When
// SES is unconfigured the notifier sends in-app only; this banner is the least-intrusive
// place an admin actually looks (the Approval Engine screen) to see and control email.
function EmailStatusBanner() {
  const queryClient = useQueryClient();
  const { data } = useQuery<{ configured: boolean; mode: string; from: string | null; emailEnabled: boolean }>({
    queryKey: ["/technical/api/approvals/email-config"],
    queryFn: async () => {
      const res = await fetch("/technical/api/approvals/email-config");
      if (!res.ok) return { configured: false, mode: "unconfigured", from: null, emailEnabled: true };
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });
  const toggle = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch("/technical/api/approvals/email-config", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error(res.status === 403 ? "Only an admin can change this setting." : `Save failed (HTTP ${res.status})`);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/technical/api/approvals/email-config"] }),
  });
  if (!data) return null;
  const ok = data.configured;
  const on = data.emailEnabled !== false;
  const effectiveOn = ok && on;
  return (
    <div
      data-testid="approval-email-status"
      style={{
        margin: "8px 12px 0", padding: "8px 12px", borderRadius: 8, fontSize: 13,
        border: `1px solid ${effectiveOn ? "#a6f4c5" : "#fda29b"}`,
        background: effectiveOn ? "#ecfdf3" : "#fffaeb",
        color: effectiveOn ? "#067647" : "#b54708",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}
    >
      <span>
        {!ok
          ? "Warning: approval emails are not configured — approvers receive in-app notifications only. To enable email, set AWS_SES_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and APPROVAL_EMAIL_FROM on the server."
          : !on
            ? "Warning: approval emails are switched OFF by an admin — approvers receive in-app notifications only. Turn the toggle on to resume email."
            : `Approval emails are on${data.mode === "json-test" ? " (test mode — no real send)" : data.from ? ` (from ${data.from})` : ""}. Approvers receive in-app + email notifications.`}
      </span>
      <label
        title={!ok ? "Email is not configured on this server — the toggle has no effect until SES is set up." : on ? "Switch approval emails off (in-app notifications continue)" : "Switch approval emails on"}
        style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", cursor: ok ? "pointer" : "not-allowed", opacity: ok ? 1 : 0.55 }}
      >
        <input
          type="checkbox"
          data-testid="approval-email-toggle"
          checked={on}
          disabled={!ok || toggle.isPending}
          onChange={(e) => toggle.mutate(e.target.checked)}
        />
        Send approval emails
      </label>
      {toggle.isError && <span style={{ color: "#b42318" }}>{(toggle.error as Error).message}</span>}
    </div>
  );
}

export default function ApprovalEngineAdminPage() {
  return (
    <div>
      <EmailStatusBanner />
      <DefectApprovalDiagnosticsPanel />
      <ApprovalEngineAdmin basePath="/technical/api/approval-engine" />
    </div>
  );
}
