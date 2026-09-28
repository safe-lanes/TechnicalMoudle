/**
 * Shared panels of the combined Admin → Approval Workflow screen (25-Sep-2026, Sahil's PDF):
 * the approval-email status banner and the approval diagnostics panel. Formerly the separate
 * "Approval Engine" admin page, which is removed — its builder now opens inside the
 * Approval Workflow tree (ApprovalWorkflow.tsx).
 */
import React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
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

export function DefectApprovalDiagnosticsPanel() {
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Wait for the signed-in identity: the endpoint is permission-checked, and a request sent
  // before the identity headers exist is refused (and not retried).
  const { currentUser } = useAuth();
  const { data, isLoading, error } = useQuery<DefectApprovalDiagnostics>({
    queryKey: ["/technical/api/defects/approval-diagnostics"],
    enabled: !!currentUser,
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
export function EmailStatusBanner() {
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

// 25-Sep-2026 — Sahil built the Defects approval settings API (0065/0066) with no screen. Shown on
// the combined Approval Workflow screen when a Defects action is selected. Edit follows Access
// Control (Approval Workflow → Defects); the server enforces the same.
export function DefectApprovalSettingsPanel({ readOnly }: { readOnly: boolean }) {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const key = ["/technical/api/defects/approval-settings"];
  const { data, error } = useQuery<{ longExtensionDays: number; showRejectedClosuresOnReport: boolean }>({
    queryKey: key,
    enabled: !!currentUser,
    queryFn: async () => {
      const res = await fetch("/technical/api/defects/approval-settings");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    retry: false,
  });
  const [days, setDays] = useState<string>("");
  const [showRejected, setShowRejected] = useState<boolean | null>(null);
  const effDays = days !== "" ? days : String(data?.longExtensionDays ?? "");
  const effShow = showRejected ?? data?.showRejectedClosuresOnReport ?? false;
  const save = useMutation({
    mutationFn: async () => {
      const n = Number(effDays);
      if (!Number.isInteger(n) || n < 1 || n > 3650) throw new Error("Enter whole days between 1 and 3650.");
      const res = await fetch("/technical/api/defects/approval-settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ long_extension_days: n, show_rejected_closures_on_report: effShow }),
      });
      if (!res.ok) throw new Error(res.status === 403 ? "You do not have permission to change these settings." : `Save failed (HTTP ${res.status})`);
      return res.json();
    },
    onSuccess: () => { setDays(""); setShowRejected(null); queryClient.invalidateQueries({ queryKey: key }); },
  });
  if (error) return null; // no view permission → the box is simply not shown
  if (!data) return null;
  const dirty = effDays !== String(data.longExtensionDays) || effShow !== data.showRejectedClosuresOnReport;
  return (
    <section data-testid="defects-approval-settings"
      style={{ margin: "12px 0", padding: "12px 14px", border: "1px solid #d0d5dd", borderRadius: 8, background: "#fff", fontSize: 13 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "#1e3a5f" }}>Defects approval settings</h3>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        An extension longer than
        <input type="number" min={1} max={3650} value={effDays} disabled={readOnly}
          onChange={(e) => setDays(e.target.value)} style={{ width: 80, padding: "2px 6px", border: "1px solid #d0d5dd", borderRadius: 4 }}
          data-testid="input-long-extension-days" />
        days (from the current target date) is treated as Critical Equipment / COC Related.
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <input type="checkbox" checked={effShow} disabled={readOnly} onChange={(e) => setShowRejected(e.target.checked)}
          data-testid="checkbox-show-rejected-closures" />
        Show rejected closure attempts on the printed defect report
      </label>
      {!readOnly && (
        <button onClick={() => save.mutate()} disabled={!dirty || save.isPending}
          style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #2e90fa", background: dirty ? "#2e90fa" : "#fff", color: dirty ? "#fff" : "#667085", cursor: dirty ? "pointer" : "not-allowed" }}
          data-testid="button-save-defect-approval-settings">
          {save.isPending ? "Saving…" : "Save settings"}
        </button>
      )}
      {save.isError && <span style={{ color: "#b42318", marginLeft: 8 }}>{(save.error as Error).message}</span>}
      {save.isSuccess && !dirty && <span style={{ color: "#067647", marginLeft: 8 }}>Saved.</span>}
    </section>
  );
}

// 28-Sep-2026 (Sahil C3/C4/C5) — shared approval diagnostics: Technical checks + failed updates across
// modules, each group in plain language with one instruction. "Apply again" re-delivers a finished
// approval to the change request / work order / defect that did not update (server checks the
// module's Access Control edit permission).
type SharedDiagnostics = {
  available: boolean;
  healthy: boolean;
  groups: Array<{ key: string; title: string; consequence: string; instruction: string;
    rows: Array<{ text: string; detail?: string; requuid?: string }> }>;
};

/** Short chip text per diagnostics group (the full title shows in View details). */
const CHIP_LABEL: Record<string, [string, string]> = {
  blockedActions: ["action without an approval chain", "actions without an approval chain"],
  rolesWithoutApprover: ["role nobody holds", "roles nobody holds"],
  stalled: ["request nobody can approve", "requests nobody can approve"],
  failedUpdates: ["approval not applied to its record", "approvals not applied to their records"],
};
const chipLabel = (key: string, count: number, fallback: string) =>
  CHIP_LABEL[key]?.[count === 1 ? 0 : 1] ?? fallback;

export function ApprovalDiagnosticsPanel() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const key = ["/technical/api/approvals/diagnostics"];
  const { data, isLoading, error } = useQuery<SharedDiagnostics>({
    queryKey: key,
    enabled: !!currentUser,
    queryFn: async () => {
      const res = await fetch("/technical/api/approvals/diagnostics");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });
  const [message, setMessage] = useState<Record<string, string>>({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const reapply = useMutation({
    mutationFn: async (requuid: string) => {
      const res = await fetch(`/technical/api/approvals/diagnostics/${encodeURIComponent(requuid)}/reapply`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(res.status === 403 ? "You do not have permission to apply this approval." : (body?.error || `Failed (HTTP ${res.status})`));
      return requuid;
    },
    onSuccess: (requuid) => { setMessage((m) => ({ ...m, [requuid]: "Applied." })); queryClient.invalidateQueries({ queryKey: key }); },
    onError: (e: Error, requuid) => setMessage((m) => ({ ...m, [requuid]: e.message })),
  });
  return (
    <section aria-label="Approval diagnostics" data-testid="approval-diagnostics"
      style={{ margin: "12px", padding: "14px", border: "1px solid #d0d5dd", borderRadius: 8, background: "#fff" }}>
      <h2 style={{ margin: 0, fontSize: 16, color: "#1e3a5f" }}>Approval diagnostics</h2>
      <p style={{ margin: "4px 0 12px", fontSize: 12, color: "#667085" }}>
        Read-only checks for Technical approvals, and approvals of any module that finished without updating their record.
      </p>
      {isLoading && <div style={{ fontSize: 13 }}>Loading diagnostics...</div>}
      {(error || data?.available === false) && <div style={{ color: "#b42318", fontSize: 13 }}>Diagnostics unavailable. Contact your administrator.</div>}
      {data?.available && data.healthy && <div style={{ color: "#067647", fontSize: 12 }} data-testid="approval-diagnostics-healthy">No problems found.</div>}
      {data?.available && !data.healthy && (
        // Compact summary like the Defects box (Sahil's design): one chip per problem, details on request.
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
          {data.groups.map((g) => (
            <span key={g.key} data-testid={`approval-diagnostics-chip-${g.key}`} style={{
              padding: "5px 9px", borderRadius: 999, fontSize: 12,
              border: "1px solid #fda29b", background: "#fff1f0", color: "#b42318",
            }}><strong>{g.rows.length}</strong> {chipLabel(g.key, g.rows.length, g.title)}</span>
          ))}
          <Button variant="outline" size="sm" onClick={() => setDetailsOpen(true)} data-testid="button-approval-diagnostics-details">View details</Button>
        </div>
      )}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Approval diagnostics</DialogTitle>
            <DialogDescription>Problems that stop Technical approvals, and approvals of any module that finished without updating their record.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            {(data?.groups ?? []).map((g) => (
              <div key={g.key} data-testid={`approval-diagnostics-group-${g.key}`}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#b42318" }}>{g.title} ({g.rows.length})</div>
                <div style={{ fontSize: 12, color: "#475467", margin: "2px 0" }}>{g.consequence}</div>
                <div style={{ fontSize: 12, color: "#1e3a5f", marginBottom: 6 }}><strong>What to do:</strong> {g.instruction}</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {g.rows.map((r, i) => (
                    <li key={`${g.key}-${i}`} style={{ marginBottom: 4 }}>
                      <span>{r.text}</span>
                      {r.detail && <span style={{ color: "#667085" }}> — {r.detail}</span>}
                      {g.key === "failedUpdates" && r.requuid && (
                        <>
                          {" "}
                          <button onClick={() => reapply.mutate(r.requuid!)} disabled={reapply.isPending}
                            data-testid={`button-reapply-${r.requuid}`}
                            style={{ marginLeft: 6, padding: "1px 8px", borderRadius: 5, border: "1px solid #2e90fa", background: "#fff", color: "#2e90fa", cursor: "pointer", fontSize: 12 }}>
                            Apply again
                          </button>
                          {message[r.requuid] && <span style={{ marginLeft: 6, fontSize: 12 }}>{message[r.requuid]}</span>}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
