import { formatProfessionalDate } from "@/lib/dateUtils";

type ExportWorkOrderDue = {
  maintenanceBasis?: string | null;
  nextDueHour?: number | null;
  dueDate?: string | null;
};

/** Shared by Excel and PDF exports; RH uses the same per-WO target as the list. */
export function formatWorkOrderExportDueValue(wo: ExportWorkOrderDue): string {
  if (wo.maintenanceBasis === 'Running Hours') {
    const rh = wo.nextDueHour;
    return rh != null && Number.isFinite(rh) ? `${rh.toLocaleString()} RH` : '-';
  }
  return wo.dueDate ? formatProfessionalDate(wo.dueDate) : '-';
}