import { formatWorkOrderDateDDMMYYYY, parseWorkOrderDateDDMMYYYYInput, workOrderDateInputValue } from "@shared/dateUtils";

/** Grid presentation only: raw dueInfo remains available for sorting and exports. */
export function formatPlannerDueInfo(jobType: string, dueInfo: string): string {
  return jobType === "RH" ? dueInfo : formatWorkOrderDateDDMMYYYY(dueInfo, dueInfo);
}

/** Undefined is an invalid draft, whereas an empty string is an intentional clear. */
export function plannerDateDraftValue(draft: string): string | undefined {
  if (!draft) return "";
  return parseWorkOrderDateDDMMYYYYInput(draft) ?? undefined;
}

/** Never send display strings, invalid calendar days or duplicate commits to autosave. */
export function plannerDateCommitValue(
  original: string | null | undefined,
  selectedISO: string,
  lastCommittedISO = workOrderDateInputValue(original),
): string | undefined {
  if (selectedISO && (!/^\d{4}-\d{2}-\d{2}$/.test(selectedISO) || workOrderDateInputValue(selectedISO) !== selectedISO)) return undefined;
  return selectedISO === lastCommittedISO ? undefined : selectedISO;
}
