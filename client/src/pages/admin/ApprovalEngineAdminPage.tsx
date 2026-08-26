/**
 * Phase 2 / W4 — routes the GENERIC engine admin screen (Sahil's builder) into Technical's
 * admin area. Office-only (menu hides it for vessel roles; the API refuses config writes for
 * non-office callers) and shore-only (the engine does not mount on ships). The legacy
 * ApprovalWorkflow screen stays untouched and reachable until cutover.
 */
import React from "react";
import { useQuery } from "@tanstack/react-query";
import ApprovalEngineAdmin from "../../../../server/modules/approval-engine/client/ApprovalEngineAdmin";

// F4: admin-visible email delivery status. When SMTP is unconfigured the notifier silently
// sends in-app only; this banner is the least-intrusive place an admin actually looks (the
// Approval Engine screen) to see that emails are not going out.
function EmailStatusBanner() {
  const { data } = useQuery<{ configured: boolean; mode: string; from: string | null }>({
    queryKey: ["/technical/api/approvals/email-config"],
    queryFn: async () => {
      const res = await fetch("/technical/api/approvals/email-config");
      if (!res.ok) return { configured: false, mode: "unconfigured", from: null };
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });
  if (!data) return null;
  const ok = data.configured;
  return (
    <div
      data-testid="approval-email-status"
      style={{
        margin: "8px 12px 0", padding: "8px 12px", borderRadius: 8, fontSize: 13,
        border: `1px solid ${ok ? "#a6f4c5" : "#fda29b"}`,
        background: ok ? "#ecfdf3" : "#fffaeb",
        color: ok ? "#067647" : "#b54708",
      }}
    >
      {ok
        ? `✓ Approval emails are configured${data.mode === "json-test" ? " (test mode — no real send)" : data.from ? ` (from ${data.from})` : ""}. Approvers receive in-app + email notifications.`
        : "⚠ Approval emails are not configured — approvers receive in-app notifications only. To enable email, set APPROVAL_SMTP_HOST / _USER / _PASS / _FROM (or the NR_SMTP_* fallback) on the server."}
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
