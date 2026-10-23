export type PeriodDateDisplayFormat = "DD MMM YYYY" | "DD-MM-YYYY";

export interface PeriodValue {
  mode: "yearQuarterMonth" | "dateRange";
  year?: number;
  quarter?: number;
  month?: number;
  dateFrom?: Date;
  dateTo?: Date;
}

export const PERIOD_MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Calendar selections are local Date objects: do not convert them to UTC. */
export function formatPeriodDate(date: Date | undefined, displayFormat: PeriodDateDisplayFormat = "DD MMM YYYY"): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return displayFormat === "DD-MM-YYYY"
    ? `${day}-${String(date.getMonth() + 1).padStart(2, "0")}-${year}`
    : `${day} ${MONTH_NAMES[date.getMonth()]} ${year}`;
}

export function formatPeriodDisplayValue(
  value: PeriodValue | null | undefined,
  displayFormat: PeriodDateDisplayFormat = "DD MMM YYYY",
): string {
  if (!value) return "";
  if (value.mode === "yearQuarterMonth") {
    if (value.month !== undefined && value.year) return `${PERIOD_MONTHS[value.month]}-${value.year}`;
    if (value.quarter !== undefined && value.year) return `Q${value.quarter}-${value.year}`;
    return value.year ? `${value.year}` : "";
  }
  if (value.dateFrom && value.dateTo) {
    return `${formatPeriodDate(value.dateFrom, displayFormat)} - ${formatPeriodDate(value.dateTo, displayFormat)}`;
  }
  if (value.dateFrom) return `From ${formatPeriodDate(value.dateFrom, displayFormat)}`;
  return "";
}
