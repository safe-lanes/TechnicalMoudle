import { z } from "zod";
import type { ApprovalProcess } from "@/components/approvals/ApprovalProcessSection";
import { formatMaritimeUtcDateTime } from "./defectApprovalPresentation";

const eventSchema = z.object({
  type: z.string(), label: z.string(),
  byName: z.string().nullable(), byPosition: z.string().nullable(),
  at: z.string().nullable(), remarks: z.string().nullable(),
});
const processSchema = z.object({
  subjectType: z.string(),
  attempts: z.array(z.object({ number: z.number(), events: z.array(eventSchema) })),
});
const historySchema = z.object({ extension: processSchema, verification: processSchema });

export interface DefectPdfApprovalHistory {
  extension: ApprovalProcess;
  verification: ApprovalProcess;
}

/** Read a new, authorized snapshot; a failed read must never masquerade as empty history. */
export async function loadDefectPdfApprovalHistory(
  defectId: string | number | null | undefined,
  headers: Record<string, string>,
  request: typeof fetch = fetch,
): Promise<DefectPdfApprovalHistory | undefined> {
  if (defectId === null || defectId === undefined || String(defectId) === "") return undefined;
  let response: Response;
  try {
    response = await request(`/technical/api/defects/${encodeURIComponent(String(defectId))}/approval-process`, {
      method: "GET", credentials: "include", cache: "no-store", headers,
    });
  } catch {
    throw new Error("Approval history could not be loaded. Check your connection and retry Export.");
  }
  if (!response.ok) throw new Error(`Approval history could not be loaded (${response.status}). Check your access and retry Export.`);
  const parsed = historySchema.safeParse(await response.json().catch(() => undefined));
  if (!parsed.success) throw new Error("The approval history response was incomplete. Refresh the page and retry Export.");
  return parsed.data;
}

export function formatPdfApprovalTime(value?: string | null): string {
  if (!value) return "Not Recorded";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (iso || dmy) {
    const [, day, month, year] = iso ? [iso[0], iso[3], iso[2], iso[1]] : dmy!;
    const monthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1];
    return `${day} ${monthName ?? month} ${year} (time Not Recorded)`;
  }
  return formatMaritimeUtcDateTime(value) || "Not Recorded";
}

export function formatPdfApprovalActor(name?: string | null, position?: string | null): string {
  return `${name?.trim() || "Not Recorded"} (${position?.trim() || "position Not Recorded"})`;
}

/** Only persisted entry metadata can establish submission; no attempt/index/date matching. */
export function extensionSubmissionForPdf(
  id: string,
  savedEntries: Array<{ id?: string; requestedByName?: string | null; requestedByPosition?: string | null; requestedAt?: string | null }> = [],
) {
  const saved = savedEntries.find(entry => Boolean(entry.id) && entry.id === id);
  return {
    submittedBy: formatPdfApprovalActor(saved?.requestedByName, saved?.requestedByPosition),
    submittedAt: formatPdfApprovalTime(saved?.requestedAt),
  };
}
