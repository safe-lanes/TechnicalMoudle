/**
 * Approval process (29-Sep-2026, Jeevan): who submitted / approved / rejected / acknowledged / withdrew,
 * and when — every attempt in order, in the Defects approval display style (name (position) on
 * "29 Sep 2026, 1432 Z"). "Not Recorded" where an older record never captured who or when.
 * Used on the Work Order form, the postponement dialogs and the Modify PMS change request dialog.
 */
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { formatMaritimeUtcDateTime } from "@/pages/defects/defectApprovalPresentation";

export interface ProcessEvent {
  type: string; label: string;
  byName: string | null; byPosition: string | null; at: string | null; remarks: string | null;
}
export interface ApprovalProcess { subjectType: string; attempts: Array<{ number: number; events: ProcessEvent[] }> }
export interface WorkOrderApprovalProcess { completion: ApprovalProcess; postponement: ApprovalProcess; rePostponement: ApprovalProcess }

const NOT_RECORDED = "Not Recorded";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Same format as the Defects screen; a date without a time says so. */
export function formatProcessTime(at: string | null): string {
  if (!at) return NOT_RECORDED;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(at);
  if (iso) return `${iso[3]} ${MONTHS[Number(iso[2]) - 1]} ${iso[1]} (time ${NOT_RECORDED})`;
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(at);
  if (dmy) return `${dmy[1]} ${MONTHS[Number(dmy[2]) - 1]} ${dmy[3]} (time ${NOT_RECORDED})`;
  return formatMaritimeUtcDateTime(at) || NOT_RECORDED;
}

export function formatProcessActor(e: Pick<ProcessEvent, "byName" | "byPosition">): string {
  if (e.byName && e.byPosition) return `${e.byName} (${e.byPosition})`;
  if (e.byName) return e.byName;
  if (e.byPosition) return `${NOT_RECORDED} (${e.byPosition})`;
  return NOT_RECORDED;
}

const DOT: Record<string, string> = {
  submitted: "#2e90fa", approved: "#12b76a", completed: "#12b76a", forwarded: "#12b76a", "ts-acknowledged": "#12b76a",
  rejected: "#f04438", "ts-rejected": "#f04438", "withdrawal-too-late": "#f79009", reopened: "#f79009",
  "withdrawal-requested": "#98a2b3", withdrawn: "#98a2b3",
};

function ProcessBlock({ title, process }: { title: string; process: ApprovalProcess }) {
  const multi = process.attempts.length > 1;
  return (
    <div data-testid={`approval-process-${process.subjectType}`} style={{ marginBottom: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: "#1e3a5f", marginBottom: 4 }}>{title}</div>
      {process.attempts.map((attempt) => (
        <div key={attempt.number} style={{ marginBottom: 6 }}>
          {multi && <div style={{ fontSize: 12, color: "#667085", margin: "2px 0" }}>Attempt {attempt.number}</div>}
          {attempt.events.map((e, i) => (
            <div key={i} className="flex flex-col items-start" style={{ marginLeft: multi ? 10 : 0, marginBottom: 3 }}>
              <span className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 ${e.type.includes("rejected") ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-700"}`} style={{ fontSize: 12 }}
                data-testid="approval-process-event">
                <span style={{ width: 8, height: 8, borderRadius: 4, background: DOT[e.type] ?? "#98a2b3", display: "inline-block" }} />
                <strong style={{ fontWeight: 600 }}>{e.label}</strong>
                <span>— {formatProcessActor(e)} on {formatProcessTime(e.at)}</span>
              </span>
              {e.remarks && <div className="ml-4 max-w-xl whitespace-pre-wrap text-xs text-gray-600">{e.remarks}</div>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Renders nothing when there is no approval activity yet. */
export function ApprovalProcessSection({ blocks }: { blocks: Array<{ title: string; process: ApprovalProcess | null | undefined }> }) {
  const shown = blocks.filter((b): b is { title: string; process: ApprovalProcess } => !!b.process && b.process.attempts.length > 0);
  if (shown.length === 0) return null;
  return (
    <div style={{ border: "1px solid #e4e7ec", borderRadius: 8, padding: 10, margin: "8px 0", fontSize: 13, background: "#fff" }} data-testid="approval-process-section">
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Approval process</div>
      {shown.map((b) => <ProcessBlock key={b.title} title={b.title} process={b.process} />)}
    </div>
  );
}

export const workOrderApprovalProcessKey = (id: string | null | undefined) => ["/technical/api/work-orders", id ?? null, "approval-process"] as const;
export const changeRequestApprovalProcessKey = (id: number | string | null | undefined) => ["/technical/api/change-requests", id ?? null, "approval-process"] as const;

export function useWorkOrderApprovalProcess(id: string | null | undefined) {
  return useQuery<WorkOrderApprovalProcess | null>({
    queryKey: workOrderApprovalProcessKey(id),
    enabled: !!id,
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/technical/api/work-orders/${encodeURIComponent(String(id))}/approval-process`);
      return res.ok ? res.json() : null;
    },
  });
}

export function useChangeRequestApprovalProcess(id: number | string | null | undefined) {
  return useQuery<ApprovalProcess | null>({
    queryKey: changeRequestApprovalProcessKey(id),
    enabled: id !== null && id !== undefined && String(id) !== "",
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/technical/api/change-requests/${encodeURIComponent(String(id))}/approval-process`);
      return res.ok ? res.json() : null;
    },
  });
}
