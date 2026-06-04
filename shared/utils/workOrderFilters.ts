// Shared Work Order list filtering / search / sort / tab logic.
//
// This module is the single source of truth for how the Work Orders module list
// is filtered, searched, counted per tab, and sorted. Both the server
// (paginated `GET /technical/api/work-orders?page=...` endpoint) and the client
// (`client/src/pages/pms/WorkOrders.tsx`, used for export building) import these
// pure functions so the two sides can never drift.

export type WorkOrderSortField =
  | "component" | "workOrderNo" | "jobTitle" | "assignedTo" | "dueDate"
  | "status" | "dateCompleted" | "plannedDate" | "postponeUntil"
  | "postponementReason" | "daysLate" | "approvalTier";

export type WorkOrderSortDir = "asc" | "desc";

export type WorkOrderPeriodMode = 'year-only' | 'year-quarter' | 'year-months' | 'date-range';

export interface WorkOrderPeriodFilter {
  mode: WorkOrderPeriodMode;
  year?: number;
  quarter?: 1 | 2 | 3 | 4;
  months?: number[];
  dateFrom?: Date | string;
  dateTo?: Date | string;
}

// Structural shape of the fields these predicates read. Enriched work orders on
// both server (loosely typed) and client (`WorkOrderWithHydratedData`) satisfy
// this interface structurally — extra fields are ignored.
export interface FilterableWorkOrder {
  isExecution?: boolean | null;
  workOrderType?: string | null;
  status?: string | null;
  computedStatus?: string | null;
  jobTitle?: string | null;
  workOrderNo?: string | null;
  templateCode?: string | null;
  executionId?: string | null;
  maintenanceBasis?: string | null;
  dueRH?: number | null;
  nextDueReading?: string | number | null;
  currentRH?: number | null;
  currentReading?: string | number | null;
  dueDate?: string | null;
  assignedTo?: string | null;
  criticality?: string | null;
  componentCritical?: boolean | null;
  postponementReason?: string | null;
  // sort-only fields
  component?: string | null;
  submittedDate?: string | null;
  dateCompleted?: string | null;
  plannedDate?: string | null;
  postponementEndDate?: string | null;
  daysLate?: number | null;
  approvalTier?: string | null;
}

export const WORK_ORDER_TABS = [
  "Planned", "Due", "Overdue", "Postponed", "Unplanned", "Pending Approval", "Completed",
] as const;

const FINALIZED_STATUSES = new Set(['completed', 'approved', 'closed', 'cancelled', 'canceled']);

export function isStoredCompleted(wo: FilterableWorkOrder): boolean {
  return !!wo.status && FINALIZED_STATUSES.has(wo.status.toLowerCase().trim());
}

// Used for TAB ROUTING — returns 'Unplanned' for all Unplanned WOs so they never
// bleed into Scheduled or Completed tabs regardless of their stored status.
export function getEffectiveStatus(wo: FilterableWorkOrder): string {
  if (wo.workOrderType === 'Unplanned') return 'Unplanned';
  if (isStoredCompleted(wo)) return 'Completed';
  return wo.computedStatus || wo.status || 'Active';
}

// Used for BADGE DISPLAY — shows the real status for Unplanned WOs.
export function getDisplayStatus(wo: FilterableWorkOrder): string {
  if (wo.workOrderType === 'Unplanned') {
    if (isStoredCompleted(wo)) return 'Completed';
    if (wo.status === 'Pending Approval') return 'Pending Approval';
    if (wo.status === 'Pending Office Review') return 'Awaiting Level 2 Review';
    if (wo.status === 'Draft') return 'Draft';
    return wo.status || 'Active';
  }
  const es = getEffectiveStatus(wo);
  if (es === 'Pending Office Review') return 'Awaiting Level 2 Review';
  return es;
}

export function matchesTab(wo: FilterableWorkOrder, activeTab: string): boolean {
  const effectiveStatus = getEffectiveStatus(wo);

  if (activeTab === "Planned") {
    if (wo.isExecution) return false;
    if (wo.workOrderType === 'Unplanned') return false;
    if (effectiveStatus !== "Active") return false;
  } else if (activeTab === "Due") {
    const isRejectedExecution = wo.isExecution && wo.status === 'Rejected';
    if (wo.isExecution && !isRejectedExecution) return false;
    if (effectiveStatus !== "Due" && effectiveStatus !== "Due (Grace P)") return false;
  } else if (activeTab === "Overdue") {
    const isRejectedExecution = wo.isExecution && wo.status === 'Rejected';
    if (wo.isExecution && !isRejectedExecution) return false;
    if (effectiveStatus !== "Overdue") return false;
  } else if (activeTab === "Completed") {
    if (wo.workOrderType === 'Unplanned') return false;
    if (effectiveStatus !== "Completed") return false;
  } else if (activeTab === "Pending Approval") {
    const ds = getDisplayStatus(wo);
    if (ds !== "Pending Approval" && ds !== "Awaiting Level 2 Review") return false;
  } else if (activeTab === "Postponed") {
    if (wo.isExecution) return false;
    // Include legacy "Postponed", new "Awaiting Office Approval", and "Postponement Approved".
    // Exclude "Postponement Rejected" — those revert to Due/Overdue and show in their tab.
    const postponedStatuses = new Set(["Postponed", "Awaiting Office Approval", "Postponement Approved"]);
    if (!postponedStatuses.has(effectiveStatus)) return false;
  } else if (activeTab === "Unplanned") {
    if (wo.workOrderType !== 'Unplanned') return false;
  }

  return true;
}

export function matchesSearch(wo: FilterableWorkOrder, searchTerm: string): boolean {
  if (!searchTerm) return true;
  const t = searchTerm.toLowerCase();
  if ((wo.jobTitle || '').toLowerCase().includes(t)) return true;
  if ((wo.workOrderNo || '').toLowerCase().includes(t)) return true;
  if (wo.templateCode && wo.templateCode.toLowerCase().includes(t)) return true;
  if (wo.executionId && wo.executionId.toLowerCase().includes(t)) return true;
  return false;
}

export function matchesPeriod(wo: FilterableWorkOrder, periodFilter: WorkOrderPeriodFilter | null | undefined): boolean {
  if (!periodFilter) return true;

  const isRhBased = wo.maintenanceBasis === "Running Hours";

  if (isRhBased) {
    const rhTarget = wo.dueRH ?? (wo.nextDueReading != null ? Number(wo.nextDueReading) : null);
    const rhCurrent = wo.currentRH ?? (wo.currentReading != null ? Number(wo.currentReading) : null);
    if (rhTarget == null || isNaN(rhTarget) || rhCurrent == null || isNaN(rhCurrent)) {
      return false;
    }
    const rhRemaining = rhTarget - rhCurrent;
    let periodDays = 0;
    if (periodFilter.mode === 'year-only' && periodFilter.year) {
      const isLeap = (periodFilter.year % 4 === 0 && periodFilter.year % 100 !== 0) || periodFilter.year % 400 === 0;
      periodDays = isLeap ? 366 : 365;
    } else if (periodFilter.mode === 'year-quarter' && periodFilter.year && periodFilter.quarter) {
      const qStart = new Date(periodFilter.year, (periodFilter.quarter - 1) * 3, 1);
      const qEnd = new Date(periodFilter.year, periodFilter.quarter * 3, 0);
      periodDays = Math.round((qEnd.getTime() - qStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    } else if (periodFilter.mode === 'year-months' && periodFilter.year && periodFilter.months && periodFilter.months.length > 0) {
      let totalDays = 0;
      for (const m of periodFilter.months) {
        const lastDay = new Date(periodFilter.year, m, 0).getDate();
        totalDays += lastDay;
      }
      periodDays = totalDays;
    } else if (periodFilter.mode === 'date-range' && periodFilter.dateFrom && periodFilter.dateTo) {
      const from = new Date(periodFilter.dateFrom);
      from.setHours(0, 0, 0, 0);
      const to = new Date(periodFilter.dateTo);
      to.setHours(0, 0, 0, 0);
      periodDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    const periodHours = periodDays * 24;
    if (rhRemaining > periodHours) return false;
  } else {
    const woDueDate = wo.dueDate ? new Date(wo.dueDate) : null;
    if (!woDueDate || isNaN(woDueDate.getTime())) {
      return false;
    }
    if (periodFilter.mode === 'year-only' && periodFilter.year) {
      if (woDueDate.getFullYear() !== periodFilter.year) return false;
    } else if (periodFilter.mode === 'year-quarter' && periodFilter.year && periodFilter.quarter) {
      if (woDueDate.getFullYear() !== periodFilter.year) return false;
      const woMonth = woDueDate.getMonth() + 1;
      const qStart = (periodFilter.quarter - 1) * 3 + 1;
      const qEnd = qStart + 2;
      if (woMonth < qStart || woMonth > qEnd) return false;
    } else if (periodFilter.mode === 'year-months' && periodFilter.year && periodFilter.months && periodFilter.months.length > 0) {
      if (woDueDate.getFullYear() !== periodFilter.year) return false;
      const woMonth = woDueDate.getMonth() + 1;
      if (!periodFilter.months.includes(woMonth)) return false;
    } else if (periodFilter.mode === 'date-range' && periodFilter.dateFrom && periodFilter.dateTo) {
      const from = new Date(periodFilter.dateFrom);
      from.setHours(0, 0, 0, 0);
      const to = new Date(periodFilter.dateTo);
      to.setHours(23, 59, 59, 999);
      const woTime = woDueDate.getTime();
      if (woTime < from.getTime() || woTime > to.getTime()) return false;
    }
  }

  return true;
}

export function matchesRank(wo: FilterableWorkOrder, selectedRank: string): boolean {
  if (!selectedRank || selectedRank === "all") return true;
  return (wo.assignedTo?.trim() ?? '') === selectedRank;
}

export function matchesCriticality(wo: FilterableWorkOrder, criticality: string[]): boolean {
  if (!criticality || criticality.length === 0) return true;
  const set = new Set(criticality);
  const woCriticality = wo.criticality?.toLowerCase();
  const isCompCritical = wo.componentCritical === true;
  let matchesAny = false;
  if (set.has("critical") && woCriticality === "yes") matchesAny = true;
  if (set.has("non-critical") && woCriticality !== "yes") matchesAny = true;
  if (set.has("critical-component") && isCompCritical) matchesAny = true;
  return matchesAny;
}

export function matchesPostponementReason(wo: FilterableWorkOrder, reason: string): boolean {
  if (!reason || reason === "all") return true;
  return wo.postponementReason === reason;
}

// Per-tab counts computed from the FULL list (independent of search / period /
// rank / criticality / postponement filters), mirroring the WorkOrders module's
// tab badges.
export function computeWorkOrderTabCounts(list: FilterableWorkOrder[]): Record<string, number> {
  const counts: Record<string, number> = {
    "Planned": 0, "Due": 0, "Overdue": 0, "Postponed": 0,
    "Unplanned": 0, "Pending Approval": 0, "Completed": 0,
  };

  for (const wo of list) {
    if (!wo.isExecution && wo.workOrderType !== 'Unplanned' && getEffectiveStatus(wo) === "Active") {
      counts["Planned"]++;
    }

    const isRejectedExecution = wo.isExecution && wo.status === 'Rejected';
    if (!(wo.isExecution && !isRejectedExecution)) {
      const es = getEffectiveStatus(wo);
      if (es === "Due" || es === "Due (Grace P)") counts["Due"]++;
      if (es === "Overdue") counts["Overdue"]++;
    }

    const postponedStatuses = new Set(["Postponed", "Awaiting Office Approval", "Postponement Approved"]);
    if (!wo.isExecution && postponedStatuses.has(getEffectiveStatus(wo))) counts["Postponed"]++;
    if (wo.workOrderType === 'Unplanned') counts["Unplanned"]++;
    const ds = getDisplayStatus(wo);
    if (ds === "Pending Approval" || ds === "Awaiting Level 2 Review") counts["Pending Approval"]++;
    if (wo.workOrderType !== 'Unplanned' && getEffectiveStatus(wo) === "Completed") counts["Completed"]++;
  }

  return counts;
}

export interface WorkOrderApprovalTierCounts {
  superintendent_locked: number;
  superintendent_notification: number;
  ce_with_justification: number;
  standard: number;
}

// Approval-tier breakdown used by the Pending Approval tab summary cards.
// Computed over the already filtered set.
export function computeApprovalTierCounts(list: FilterableWorkOrder[]): WorkOrderApprovalTierCounts {
  return {
    superintendent_locked: list.filter(wo => wo.approvalTier === "superintendent_locked").length,
    superintendent_notification: list.filter(wo => wo.approvalTier === "superintendent_notification").length,
    ce_with_justification: list.filter(wo => wo.approvalTier === "ce_with_justification").length,
    standard: list.filter(wo => !wo.approvalTier || wo.approvalTier === "standard").length,
  };
}

export function compareWorkOrders(
  a: FilterableWorkOrder,
  b: FilterableWorkOrder,
  field: WorkOrderSortField,
  dir: WorkOrderSortDir,
  activeTab = "",
): number {
  let cmp = 0;
  switch (field) {
    case "component": cmp = (a.component || "").localeCompare(b.component || ""); break;
    case "workOrderNo": {
      const getWoNo = (wo: FilterableWorkOrder) =>
        (activeTab === "Pending Approval" || activeTab === "Completed") && wo.executionId
          ? wo.executionId
          : wo.workOrderNo || wo.templateCode || "";
      cmp = getWoNo(a).localeCompare(getWoNo(b));
      break;
    }
    case "jobTitle": cmp = (a.jobTitle || "").localeCompare(b.jobTitle || ""); break;
    case "assignedTo": cmp = (a.assignedTo || "").localeCompare(b.assignedTo || ""); break;
    case "dueDate": {
      const useSubmitted = activeTab === "Pending Approval" || activeTab === "Completed";
      const aVal = useSubmitted ? (a.submittedDate || "") : (a.dueDate || "");
      const bVal = useSubmitted ? (b.submittedDate || "") : (b.dueDate || "");
      cmp = aVal.localeCompare(bVal);
      break;
    }
    case "status": {
      const STATUS_ORDER: Record<string, number> = {
        "Overdue": 0, "Due": 1, "Due (Grace P)": 2, "Active": 3,
        "Pending Approval": 4, "Postponed": 5, "Draft": 6, "Completed": 7,
      };
      const aS = a.computedStatus || a.status || "";
      const bS = b.computedStatus || b.status || "";
      cmp = (STATUS_ORDER[aS] ?? 99) - (STATUS_ORDER[bS] ?? 99);
      break;
    }
    case "dateCompleted":
      cmp = (a.dateCompleted || "9999").localeCompare(b.dateCompleted || "9999");
      break;
    case "plannedDate":
      cmp = (a.plannedDate || "9999").localeCompare(b.plannedDate || "9999");
      break;
    case "postponeUntil":
      cmp = (a.postponementEndDate || "9999").localeCompare(b.postponementEndDate || "9999");
      break;
    case "postponementReason":
      cmp = (a.postponementReason || "").localeCompare(b.postponementReason || "");
      break;
    case "daysLate":
      cmp = (a.daysLate || 0) - (b.daysLate || 0);
      break;
    case "approvalTier":
      cmp = (a.approvalTier || "").localeCompare(b.approvalTier || "");
      break;
  }
  return dir === "desc" ? -cmp : cmp;
}

export interface WorkOrderFilterParams {
  activeTab?: string;
  search?: string;
  period?: WorkOrderPeriodFilter | null;
  rank?: string;
  criticality?: string[];
  postponementReason?: string;
  sortField?: WorkOrderSortField | null;
  sortDir?: WorkOrderSortDir;
}

// Apply all list filters (tab + search + period + rank + criticality +
// postponement reason) then optionally sort. Order is preserved from the input
// list when no sort field is supplied.
export function filterAndSortWorkOrders<T extends FilterableWorkOrder>(
  list: T[],
  params: WorkOrderFilterParams,
): T[] {
  const activeTab = params.activeTab || "Planned";
  const result = list.filter(wo =>
    matchesTab(wo, activeTab) &&
    matchesSearch(wo, params.search || "") &&
    matchesPeriod(wo, params.period) &&
    matchesRank(wo, params.rank || "") &&
    matchesCriticality(wo, params.criticality || []) &&
    matchesPostponementReason(wo, params.postponementReason || "")
  );

  if (params.sortField) {
    const field = params.sortField;
    const dir = params.sortDir || "asc";
    return [...result].sort((a, b) => compareWorkOrders(a, b, field, dir, activeTab));
  }

  return result;
}
