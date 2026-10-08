import { formatWorkOrderDateDDMMYYYY } from "@shared/dateUtils";

/** Job Form display only. Callers retain raw values for saving and calculations. */
export function formatJobFormDate(
  value: string | number | Date | null | undefined,
  fallback = "-",
): string {
  return formatWorkOrderDateDDMMYYYY(value, fallback);
}
