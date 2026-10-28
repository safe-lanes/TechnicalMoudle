import React from "react";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type SharedDiagnostics = {
  available: boolean;
  healthy: boolean;
  groups: Array<{
    key: string;
    title: string;
    consequence: string;
    instruction: string;
    rows: Array<{ text: string; detail?: string; requuid?: string }>;
  }>;
};

type ApprovalDiagnosticsBodyProps = {
  data?: SharedDiagnostics;
  isLoading: boolean;
  error?: unknown;
  messages: Record<string, string>;
  isPending: boolean;
  pendingRequestId?: string;
  onReapply: (id: string) => void;
};

const categories = [
  { key: "blockedActions", label: "Missing or disabled approval chains" },
  { key: "rolesWithoutApprover", label: "Roles without an approver" },
  { key: "stalled", label: "Requests without an available approver" },
  { key: "failedUpdates", label: "Completed approvals not applied to their record" },
];

const panelStyle: React.CSSProperties = {
  border: "1px solid #d9e2df",
  borderRadius: 12,
  background: "#fbfcf8",
  padding: "15px 17px",
  minWidth: 0,
};

export function ApprovalDiagnosticsBody({
  data,
  isLoading,
  error,
  messages,
  isPending,
  pendingRequestId,
  onReapply,
}: ApprovalDiagnosticsBodyProps) {
  if (isLoading) {
    return (
      <div role="status" aria-live="polite" style={{ display: "grid", gap: 12 }}>
        <div style={{ ...panelStyle, color: "#38524e" }}>Checking approval readiness…</div>
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
        <span style={{ color: "#52665f" }}>Approval readiness information is not currently available.</span>
      </div>
    );
  }

  if (data.healthy) {
    return (
      <div role="status" style={{ ...panelStyle, borderColor: "#b5d4c5", background: "#eff7f1" }}>
        <strong style={{ display: "block", color: "#204b3b", marginBottom: 5 }}>Approval setup is ready</strong>
        <span style={{ color: "#456357" }}>No approval readiness problems were found in this check.</span>
      </div>
    );
  }

  const groups = data.groups ?? [];
  const totalRows = groups.reduce((total, group) => total + group.rows.length, 0);
  if (!totalRows) {
    return (
      <div role="status" style={panelStyle}>
        <strong style={{ display: "block", color: "#294a42", marginBottom: 5 }}>No current issue rows</strong>
        <span style={{ color: "#52665f" }}>The latest check returned no items requiring action.</span>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 22, minWidth: 0 }}>
      <section aria-label="Issue counts" style={{ border: "1px solid #d9e2df", borderRadius: 12, padding: "14px 16px", background: "#f2f6f1" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#61746b", marginBottom: 10 }}>
          Readiness overview
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {categories.map((category) => {
            const count = groups.find((group) => group.key === category.key)?.rows.length ?? 0;
            return (
              <div key={category.key} data-testid={`approval-diagnostics-count-${category.key}`}
                style={{ display: "flex", alignItems: "baseline", gap: 8, border: "1px solid #d5dfd9", borderRadius: 9, padding: "8px 11px", background: "#fff", minWidth: 0, maxWidth: "100%" }}>
                <strong style={{ color: count ? "#9a4d32" : "#52665f", fontSize: 16, fontVariantNumeric: "tabular-nums" }}>{count}</strong>
                <span style={{ color: "#40564e", fontSize: 12, overflowWrap: "anywhere" }}>{category.label}</span>
              </div>
            );
          })}
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.45, color: "#66766f" }}>
          Counts are issue rows in this check, not unique vessels or people.
        </p>
      </section>

      {groups.map((group) => (
        <section key={group.key} data-testid={`approval-diagnostics-group-${group.key}`} aria-labelledby={`approval-diagnostics-title-${group.key}`}
          style={{ display: "grid", gap: 11, minWidth: 0 }}>
          <header style={{ borderBottom: "1px solid #dce4df", paddingBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 9 }}>
              <h3 id={`approval-diagnostics-title-${group.key}`} style={{ margin: 0, fontSize: 16, lineHeight: 1.3, color: "#253f38", overflowWrap: "anywhere" }}>
                {group.title}
              </h3>
              <span style={{ fontSize: 12, color: "#566e64", background: "#edf2ee", borderRadius: 999, padding: "3px 8px" }}>
                {group.rows.length} {group.rows.length === 1 ? "issue" : "issues"}
              </span>
            </div>
          </header>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))", gap: 9 }}>
            <div style={panelStyle}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#687b72", marginBottom: 5 }}>Impact</div>
              <p style={{ margin: 0, lineHeight: 1.55, color: "#354e45", overflowWrap: "anywhere" }}>{group.consequence}</p>
            </div>
            <div style={{ ...panelStyle, background: "#f2f6f1" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#687b72", marginBottom: 5 }}>What to do</div>
              <p style={{ margin: 0, lineHeight: 1.55, color: "#354e45", overflowWrap: "anywhere" }}>{group.instruction}</p>
            </div>
          </div>
          <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
            {group.rows.map((row, index) => {
              const eligible = group.key === "failedUpdates" && Boolean(row.requuid);
              const pending = Boolean(isPending && row.requuid && pendingRequestId === row.requuid);
              const message = row.requuid ? messages[row.requuid] : undefined;
              return (
                <article key={`${group.key}-${row.requuid ?? index}`} style={{ minWidth: 0, border: "1px solid #dce4df", borderLeft: "3px solid #9b6248", borderRadius: 10, background: "#fff", padding: "13px 15px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#75847c", marginBottom: 5 }}>Problem</div>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, fontWeight: 600, color: "#2e413a", overflowWrap: "anywhere", wordBreak: "break-word" }}>{row.text}</p>
                  {row.detail && (
                    <div style={{ marginTop: 10, paddingTop: 9, borderTop: "1px solid #edf0ed" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#75847c", marginBottom: 4 }}>Details</div>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "#586a62", overflowWrap: "anywhere", wordBreak: "break-word" }}>{row.detail}</p>
                    </div>
                  )}
                  {eligible && row.requuid && (
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 9, marginTop: 12 }}>
                      <button type="button" onClick={() => onReapply(row.requuid!)} disabled={isPending}
                        data-testid={`button-reapply-${row.requuid}`}
                        style={{ border: "1px solid #53786b", borderRadius: 7, padding: "7px 11px", background: isPending ? "#edf2ee" : "#f6faf6", color: "#294a40", font: "inherit", fontSize: 12, fontWeight: 650, cursor: isPending ? "wait" : "pointer" }}>
                        {pending ? "Applying…" : "Apply again"}
                      </button>
                      {message && <span role="status" aria-live="polite" style={{ fontSize: 12, color: message === "Applied." ? "#35634e" : "#8a3d30", overflowWrap: "anywhere" }}>{message}</span>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function ApprovalDiagnosticsDetails({
  open,
  onOpenChange,
  data,
  isLoading,
  error,
  messages,
  isPending,
  pendingRequestId,
  onReapply,
  returnFocus,
}: ApprovalDiagnosticsBodyProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus?: () => void;
}) {
  return (
    <div data-open={open ? "true" : "false"}>
      {/* Root is owned by the caller; this wrapper is the dialog content and its fixed header/body. */}
      {open && (
        <DialogContent
          aria-describedby="approval-diagnostics-description"
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
              <DialogTitle className="text-xl font-semibold tracking-[-0.02em] text-[#253f38]">Approval diagnostics</DialogTitle>
              <DialogDescription id="approval-diagnostics-description" className="max-w-3xl text-sm leading-6 text-[#60736a]">
                Understand what may prevent approvals from moving forward, who or what is affected, and the next step to take.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div tabIndex={0} aria-label="Approval diagnostic details" className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]" style={{ padding: "20px 24px 28px", overflowWrap: "anywhere" }}>
            <ApprovalDiagnosticsBody
              data={error || data?.available === false ? undefined : data}
              isLoading={isLoading}
              error={error || (data?.available === false ? new Error("Diagnostics unavailable") : undefined)}
              messages={messages}
              isPending={isPending}
              pendingRequestId={pendingRequestId}
              onReapply={onReapply}
            />
          </div>
        </DialogContent>
      )}
    </div>
  );
}
