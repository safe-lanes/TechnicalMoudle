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
  formatDiagnosticsStalled,
  formatDiagnosticsUnresolved,
  formatDiagnosticsReturnedVerificationStillVerified,
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
  unresolvedApprovers: Array<{ vesselId: string; roleId: string; roleLabel: string; workflowScopes?: string[]; consequence: string }>;
  orphanRequestedExtensions: Array<{ defectId: string; vesselId: string; entryId: string; requestedAt: string; newTargetDate: string; consequence: string }>;
  stalledRequests: Array<{ requestUuid: string; defectId: string; vesselId: string; screenId: string; submittedAt: string; daysPending: number; consequence: string }>;
  returnedVerificationStillVerified: Array<{ requestUuid: string; defectId: string; vesselId: string; finalizedAt: string; consequence: string }>;
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
                Healthy: all configured Defects approval checks are resolved.
                <Button variant="link" size="sm" className="ml-2 h-auto p-0" onClick={() => setDetailsOpen(true)}>View details</Button>
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
                {projection.chips.map((chip) => (
                  <span key={chip.key} data-testid={`diagnostics-chip-${chip.key}`} style={{
                    padding: "5px 9px", borderRadius: 999, fontSize: 12,
                    border: `1px solid ${chip.count ? "#fda29b" : "#d0d5dd"}`,
                    background: chip.count ? "#fff1f0" : "#f8fafc",
                    color: chip.count ? "#b42318" : "#667085",
                  }}><strong>{chip.count}</strong> {chip.label.toLowerCase()}</span>
                ))}
                <Button variant="outline" size="sm" onClick={() => setDetailsOpen(true)}>View details</Button>
              </div>
            );
          })()}
          <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Defects approval diagnostics</DialogTitle>
                <DialogDescription>Generated and read-only diagnostic detail.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="rounded border bg-slate-50 p-3">
                  <div><strong>Generated:</strong> {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : "unknown"}</div>
                  <div><strong>Query plan:</strong> {typeof data.queryPlan === "string" ? data.queryPlan : data.queryPlan?.description ?? `Bounded diagnostic queries: ${data.queryPlan?.expectedQueries ?? "n/a"}.`}</div>
                  <div className="mt-2">{data.consequence}</div>
                </div>
                {data.workflowMatrix && <div><h3 className="font-semibold">Workflow coverage</h3><ul className="list-disc pl-5">{data.workflowMatrix.map((item) => <li key={`${item.scope}-${item.classification}`}><strong>{item.scope} / {item.classification}</strong>: {item.configured ? "configured" : "missing"} — {item.consequence}</li>)}</ul></div>}
                <DiagnosticsGroup title="Unresolved approvers" rows={data.unresolvedApprovers} format={formatDiagnosticsUnresolved} />
                <DiagnosticsGroup title="Stalled requests" rows={data.stalledRequests} format={formatDiagnosticsStalled} />
                <DiagnosticsGroup title="Orphan requested extensions" rows={data.orphanRequestedExtensions} format={formatDiagnosticsOrphan} />
                <DiagnosticsGroup
                  title="Returned verifications still verified"
                  rows={data.returnedVerificationStillVerified ?? []}
                  format={formatDiagnosticsReturnedVerificationStillVerified}
                  warning
                />
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </section>
  );
}

function DiagnosticsGroup<T>({ title, rows, format, warning = false }: {
  title: string; rows: T[]; format: (row: T) => string; warning?: boolean;
}) {
  return (
    <div style={{ marginTop: 10, ...(warning ? { borderLeft: "3px solid #d97706", background: "#fffbeb", padding: "8px 10px" } : {}) }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 13, color: warning ? "#92400e" : undefined }}>{title} ({rows.length})</h3>
      {rows.length ? (
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: "#344054" }}>
          {rows.slice(0, 25).map((row, index) => <li key={`${title}-${index}`}>{format(row)}</li>)}
        </ul>
      ) : <div style={{ fontSize: 12, color: "#667085" }}>None detected.</div>}
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
