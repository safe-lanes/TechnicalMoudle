/**
 * Phase 2 / W4 — routes the GENERIC engine admin screen (Sahil's builder) into Technical's
 * admin area. Office-only (menu hides it for vessel roles; the API refuses config writes for
 * non-office callers) and shore-only (the engine does not mount on ships). The legacy
 * ApprovalWorkflow screen stays untouched and reachable until cutover.
 */
import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ApprovalEngineAdmin from "../../../../server/modules/approval-engine/client/ApprovalEngineAdmin";

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
          ? "⚠ Approval emails are not configured — approvers receive in-app notifications only. To enable email, set AWS_SES_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and APPROVAL_EMAIL_FROM on the server."
          : !on
            ? "⚠ Approval emails are switched OFF by an admin — approvers receive in-app notifications only. Turn the toggle on to resume email."
            : `✓ Approval emails are on${data.mode === "json-test" ? " (test mode — no real send)" : data.from ? ` (from ${data.from})` : ""}. Approvers receive in-app + email notifications.`}
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
      <ApprovalEngineAdmin basePath="/technical/api/approval-engine" />
    </div>
  );
}
