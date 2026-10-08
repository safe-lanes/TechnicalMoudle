import { formatWorkOrderDateDDMMYYYY, workOrderDateInputValue } from "@shared/dateUtils";

/** Component-only presentation. Never write this display string into API data. */
export function formatComponentDate(
  value: string | number | Date | null | undefined,
  fallback = "—",
): string {
  return formatWorkOrderDateDDMMYYYY(value, fallback);
}

/** Selecting the original calendar day must not normalize its saved representation. */
export function componentDateChangeValue(original: string | null | undefined, selectedISO: string): string {
  return original && selectedISO && workOrderDateInputValue(original) === selectedISO
    ? original
    : selectedISO;
}

const componentDateFields = new Set([
  "installation", "installationDate", "commissionedDate", "lastUpdated",
  "rhLastUpdated", "lastDoneDate", "nextDueDate", "initialNextDue",
  "dateCompleted", "completionDate", "raisedOn", "reqDate",
  "lastClassSurvey", "nextClassSurvey", "nextSurveyDue",
  "lastSurveyDate", "lastDataSurvey", "nextDataSurvey",
]);

/** Review text only; change-request old/new values remain their original data. */
export function formatComponentChangeValue(path: string, value: unknown): string {
  const field = path.split(".").pop() || "";
  const fallback = String(value) || "-";
  if (componentDateFields.has(field) && (typeof value === "string" || value instanceof Date)) {
    return formatComponentDate(value, fallback);
  }
  return fallback;
}
