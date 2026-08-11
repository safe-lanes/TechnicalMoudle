import * as repo from '../repositories/workOrderRepository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { ensureArray } from '../../shared/jsonHelpers';
import { computeWorkOrderStatus, buildCompanyGraceConfig } from '@shared/workOrders/status';
import { parseWorkOrderDate } from '@shared/workOrders/dateParse';
import { WORK_ORDER_THRESHOLDS } from '@shared/workOrders/constants';
import { computeSpareConsumptionDelta, ConsumedSpareEntry } from '../utils/spareConsumptionDelta';
import { calculateMissedCycles, calculateMissedCyclesRH } from '@shared/dateUtils';
import { invalidateComplianceCache } from './complianceAnomalyService';
import { storage } from '../../../storage';
import { getDb } from '../../../db';
import { plannerDates, jobs } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logFieldChanges } from '../../sync';
import {
  filterAndSortWorkOrders,
  computeWorkOrderTabCounts,
  computeApprovalTierCounts,
  type WorkOrderFilterParams,
} from '@shared/utils/workOrderFilters';

async function resolveRankIdFromLabel(assignedTo: string | null | undefined): Promise<string | null> {
  if (!assignedTo) return null;
  const { getAllRanks } = await import('../../ranks/service');
  const allRanks = await getAllRanks();
  const label = assignedTo.toLowerCase().trim();
  if (!label || label === 'unassigned') return null;
  const match = allRanks.find(
    (r: any) => r.name?.toLowerCase().trim() === label || r.label?.toLowerCase().trim() === label
  );
  return match?.rankId ?? null;
}

/**
 * Typed contract for any record that carries the work-order assignment
 * pair. Both fields are optional/nullable so this works for create
 * payloads, partial PATCH updates, and import rows alike.
 */
export interface AssignmentFields {
  assignedTo?: string | null;
  assignedToRankId?: string | null;
}

/**
 * Single source of truth for keeping `assignedTo` (rank-name text) and
 * `assignedToRankId` (rank UUID) in lock-step on every write path
 * (manual create/update, bulk import, auto-generated WOs).
 *
 * Bidirectional rule:
 *   - If `assignedTo` text is provided and resolves, `assignedToRankId`
 *     is set to that rank's id (overwriting any stale client value).
 *   - If `assignedTo` text is provided but is empty/Unassigned/
 *     unresolvable, `assignedToRankId` is cleared to null (so unassign
 *     transitions and typos can never leave a stale rank-id behind).
 *   - If only `assignedToRankId` is provided (no text), the rank is
 *     looked up and `assignedTo` is populated from its label (or name
 *     as fallback). This covers callers that only know the rank id.
 *
 * Mutates and returns the same object for convenience.
 */
export async function applyAssignmentSync<T extends AssignmentFields>(data: T): Promise<T> {
  const textKeyPresent = Object.prototype.hasOwnProperty.call(data, 'assignedTo');
  const isExplicitNullText = textKeyPresent && data.assignedTo === null;
  const hasText = typeof data.assignedTo === 'string';
  const hasRankId = typeof data.assignedToRankId === 'string' && data.assignedToRankId.length > 0;

  // Explicit null text means "unassign" — clear the rank-id too.
  if (isExplicitNullText) {
    data.assignedToRankId = null;
    return data;
  }

  if (hasText) {
    const trimmed = (data.assignedTo as string).trim();
    if (!trimmed || trimmed.toLowerCase() === 'unassigned') {
      data.assignedToRankId = null;
      return data;
    }
    const rankId = await resolveRankIdFromLabel(trimmed);
    data.assignedToRankId = rankId; // null when unresolvable, by design
    return data;
  }

  if (hasRankId) {
    const { getAllRanks } = await import('../../ranks/service');
    const allRanks = (await getAllRanks()) as Array<{ rankId: string; name?: string; label?: string }>;
    const match = allRanks.find((r) => r.rankId === data.assignedToRankId);
    if (match) {
      data.assignedTo = match.label || match.name || null;
    } else {
      // Rank id does not resolve to any known rank — clear both so the
      // record cannot drift from the rank dictionary.
      data.assignedTo = null;
      data.assignedToRankId = null;
    }
  }

  return data;
}

// Build a fast in-memory lookup of rank name/label → rankId.
// Used during listWorkOrders enrichment to backfill missing assignedToRankId.
async function buildRankLabelMap(): Promise<Map<string, string>> {
  const { getAllRanks } = await import('../../ranks/service');
  const allRanks = await getAllRanks();
  const map = new Map<string, string>();
  for (const r of allRanks as any[]) {
    if (!r?.rankId) continue;
    const name = r.name?.toLowerCase().trim();
    const label = r.label?.toLowerCase().trim();
    if (name && !map.has(name)) map.set(name, r.rankId);
    if (label && !map.has(label)) map.set(label, r.rankId);
  }
  return map;
}

function calculateBackdatingDaysForApproval(completionDate: string | null | undefined, submittedDate: string | null | undefined): number {
  // Dates parse via the SHARED format-complete parser (dateParse.ts contract):
  // stored date strings are mixed-format, and raw new Date() mis-parses
  // DD-MM-YYYY (month/day swap or Invalid → silently 0 days).
  const comp = parseWorkOrderDate(completionDate);
  if (!comp) return 0;
  const reference = submittedDate ? parseWorkOrderDate(submittedDate) : new Date();
  if (!reference) return 0;
  const diffMs = reference.getTime() - comp.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Company approval policy — superintendent lock toggle (migration 137).
 * Read LIVE at both tier assignment and the approval gate so flipping the
 * setting OFF unlocks already-stamped 'superintendent_locked' WOs immediately
 * (no data migration). Fail-safe: any read error resolves to TRUE (locked
 * stays locked) — never accidentally weaken the compliance gate.
 */
export async function isSuperintendentLockEnabled(): Promise<boolean> {
  try {
    const settings = await storage.getCompanyApprovalSettings();
    return settings?.superintendentLockEnabled ?? true;
  } catch (err: any) {
    console.warn(`[ApprovalPolicy] Could not read company approval settings (defaulting to lock ENABLED): ${err.message}`);
    return true;
  }
}

export function calculateApprovalTier(
  dueDate: string | null | undefined,
  completionDate: string | null | undefined,
  missedCycles: number,
  backdatingDays: number = 0,
  // Superintendent lock toggle: when FALSE the high-severity branch assigns
  // 'superintendent_notification' instead of 'superintendent_locked' — approval
  // allowed, Superintendent still notified, HOD remarks (>=20) still mandatory.
  superintendentLockEnabled: boolean = true
) {
  // SHARED parser (dateParse.ts contract): raw new Date() made DD-MM-YYYY due
  // dates Invalid (daysLate NaN) or month/day-swapped (daysLate 0) → WOs that
  // were months late computed tier 'standard' and never created the
  // superintendent notification (the Issue-02 "inconsistent" mechanism).
  let daysLate = 0;
  const due = parseWorkOrderDate(dueDate);
  const comp = parseWorkOrderDate(completionDate);
  if (due && comp) {
    const diffMs = comp.getTime() - due.getTime();
    daysLate = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  let approvalTier = 'standard';
  let superintendentNotifiedAt: string | null = null;
  let superintendentAcknowledged = false;
  let approvalBlockReason: string | null = null;

  if (missedCycles >= 3 || daysLate >= 21 || backdatingDays >= 7) {
    if (superintendentLockEnabled) {
      approvalTier = 'superintendent_locked';
      superintendentAcknowledged = false;
      superintendentNotifiedAt = new Date().toISOString();
      approvalBlockReason = 'Awaiting Superintendent acknowledgment';
    } else {
      // Lock disabled by company policy — notify-only downgrade. Notification
      // still fires (notification tier), remarks (>=20) still mandatory, no block.
      approvalTier = 'superintendent_notification';
      superintendentNotifiedAt = new Date().toISOString();
      superintendentAcknowledged = false;
    }
  } else if (missedCycles === 2 || (daysLate >= 14 && daysLate < 21) || (backdatingDays >= 3 && backdatingDays < 7)) {
    approvalTier = 'superintendent_notification';
    superintendentNotifiedAt = new Date().toISOString();
    superintendentAcknowledged = false;
  } else if (missedCycles === 1 || (daysLate >= 7 && daysLate < 14) || (backdatingDays >= 1 && backdatingDays < 3)) {
    approvalTier = 'ce_with_justification';
  } else {
    approvalTier = 'standard';
  }

  return { daysLate, backdatingDays, approvalTier, superintendentNotifiedAt, superintendentAcknowledged, approvalBlockReason };
}

async function resolveVesselName(vesselId: string | null | undefined): Promise<string> {
  if (!vesselId) return '';
  try {
    const vessels = await storage.getVessels();
    const vessel = vessels.find(v => v.id === vesselId || v.vuuid === vesselId);
    return vessel?.name || vesselId;
  } catch {
    return vesselId;
  }
}

export async function createSuperintendentNotificationForWO(wo: any, daysLate: number, missedCycles: number, approvalTier: string, backdatingDays: number = 0) {
  try {
    const existing = await storage.getAllSuperintendentNotifications();
    const woId = wo.wouuid || wo.id;
    const duplicate = existing.find((n: any) => n.workOrderId === woId && !n.isAcknowledged);
    if (duplicate) {
      console.log(`📢 Superintendent notification already exists for WO ${wo.workOrderNo || wo.id} (tier: ${approvalTier}), skipping`);
      return;
    }
    const vesselName = await resolveVesselName(wo.vesselId);
    await storage.createSuperintendentNotification({
      workOrderId: woId,
      workOrderCode: wo.workOrderNo || wo.id,
      jobTitle: wo.jobTitle || '',
      componentName: wo.componentCode || wo.component || '',
      vesselName,
      vesselId: wo.vesselId || null, // Populate vessel_id for sync vessel-scoping
      daysLate,
      missedCycles,
      backdatingDays,
      approvalTier,
    });
    console.log(`📢 Superintendent notification created for WO ${wo.workOrderNo || wo.id} (tier: ${approvalTier}, vessel: ${vesselName}, vesselId: ${wo.vesselId})`);
  } catch (err: any) {
    console.error(`⚠️ Failed to create superintendent notification: ${err.message}`);
  }
}

// ── List Work Orders with Enrichment ──

export async function listWorkOrders(vesselId?: string, vesselIds?: string[]) {
  const allRows = await repo.findWorkOrders(vesselId, vesselIds);

  // ARCHIVED ROWS ARE NOT LISTED (2026-08-04). The storage layer deliberately returns
  // soft-deleted rows (numbering must see them so archived numbers are never reused),
  // so every user-facing consumer must exclude them itself. This function feeds the
  // office AND vessel Work Orders screens, the paged list, and the computed-status
  // contract (reports/alerts) — without this filter, a reconciler-archived duplicate
  // stayed visible next to its survivor forever, which read as "the duplicate fix
  // doesn't work" (Jeevan, dev, 2026-08-04 — the merge itself was proven working).
  const workOrders = allRows.filter((wo: any) => wo.isDeleted !== true);

  const companyGraceRow = await storage.getCompanyStandardGraceSettings();
  const companyGraceConfig = buildCompanyGraceConfig(companyGraceRow);

  // For "All Vessels" (no vesselId or vesselId='all'), we need per-vessel components, jobs, and settings
  const isAllVessels = !vesselId || vesselId === 'all';
  const uniqueVesselIds = isAllVessels
    ? Array.from(new Set(workOrders.map((wo: any) => wo.vesselId).filter(Boolean))) as string[]
    : [vesselId as string];

  // Fetch jobs - for all vessels, fetch per-vessel to ensure complete coverage
  let allJobs: any[] = [];
  if (isAllVessels) {
    for (const vid of uniqueVesselIds) {
      const vesselJobs = await repo.findJobs(vid);
      allJobs.push(...vesselJobs);
    }
  } else {
    allJobs = await repo.findJobs(vesselId);
  }
  const jobsMap = new Map(allJobs.map((job: any) => [job.juuid, job]));

  // Fetch components per-vessel
  const componentsByCodeMap = new Map<string, any>();
  const componentsMap = new Map<string, any>();
  if (isAllVessels) {
    for (const vid of uniqueVesselIds) {
      const vesselComponents = await repo.findComponents(vid);
      for (const comp of vesselComponents) {
        componentsByCodeMap.set(`${vid}:${comp.componentCode}`, comp);
        componentsMap.set(comp.cuuid, comp);
      }
    }
  } else {
    const components = await repo.findComponents(vesselId);
    for (const comp of components) {
      componentsByCodeMap.set(`${vesselId}:${comp.componentCode}`, comp);
      componentsMap.set(comp.cuuid, comp);
    }
  }

  // Fetch vessel-specific grace settings
  const vesselSettingsMap = new Map<string, any>();
  if (isAllVessels) {
    const allSettings = await repo.findAllPmsVesselSettings();
    for (const s of allSettings) {
      vesselSettingsMap.set(s.vesselId, s);
    }
  } else {
    const vesselSettings = await repo.findPmsVesselSettings(vesselId as string);
    if (vesselSettings) {
      vesselSettingsMap.set(vesselId as string, vesselSettings);
    }
  }

  // Load job-component links for RH tracking data
  // Keyed by `${jobId}:${componentId}` for quick lookup
  const allLinks = await repo.findAllJobComponentLinks();
  const linksByJobComponent = new Map<string, { lastDoneRH: string | null; nextDueRH: string | null }>();
  for (const link of allLinks) {
    if (link.lastDoneRH || link.nextDueRH) {
      linksByJobComponent.set(`${link.jobId}:${link.componentId}`, {
        lastDoneRH: link.lastDoneRH,
        nextDueRH: link.nextDueRH,
      });
    }
  }

  // Build rank-name → rankId lookup once per call so we can backfill any
  // work orders whose assignedToRankId is missing or out of sync with assignedTo.
  // This is what keeps Dashboard Me/My Team scoping aligned with the
  // Work Orders module's "Assigned To" column.
  const rankLabelMap = await buildRankLabelMap();

  const database = await getDb();
  const plannerDateMap = new Map<string, string>();
  if (vesselId) {
    const savedPlannerDates = await database.select().from(plannerDates).where(eq(plannerDates.vesselId, vesselId));
    for (const pd of savedPlannerDates) {
      if (pd.plannedDate) {
        plannerDateMap.set(`${pd.jobId}::${pd.componentId}`, pd.plannedDate);
      }
    }
  } else {
    for (const vid of uniqueVesselIds) {
      const savedPlannerDates = await database.select().from(plannerDates).where(eq(plannerDates.vesselId, vid));
      for (const pd of savedPlannerDates) {
        if (pd.plannedDate) {
          plannerDateMap.set(`${pd.jobId}::${pd.componentId}`, pd.plannedDate);
        }
      }
    }
  }

  // Robust numeric parsing helper
  const parseRH = (value: string | number | null | undefined): number | undefined => {
    if (value == null || value === '') return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  };

  // Augment each work order with computed status and lead time data
  const enrichedWorkOrders = workOrders.map((wo: any) => {
    const woVesselId = wo.vesselId || vesselId;
    const vesselSettings = woVesselId ? vesselSettingsMap.get(woVesselId) : null;
    const vesselGraceSettings = vesselSettings ? {
      calendarGraceMode: (vesselSettings.calendarGraceMode || 'COMPANY_STANDARD') as 'COMPANY_STANDARD' | 'CUSTOM_DAYS',
      calendarGraceDays: vesselSettings.calendarGraceDays ?? WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
      rhGraceHours: vesselSettings.rhGraceHours ?? WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
      rhLeadTimeHours: vesselSettings.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS
    } : undefined;

    // Try to match by jobId first, then fall back to templateCode === jobNo
    const job = wo.jobId
      ? jobsMap.get(wo.jobId)
      : wo.templateCode
        ? allJobs.find((j: any) => j.jobNo === wo.templateCode)
        : null;

    // Get component to fetch currentCumulativeRH
    const component = wo.componentCode
      ? componentsByCodeMap.get(`${woVesselId}:${wo.componentCode}`)
      : (wo.component ? componentsMap.get(wo.component) : null);

    // Resolve dueRH: link.nextDueRH → wo.nextDueReading → computed(lastDoneRH + interval)
    // When wo.nextDueReading equals interval (likely stale from initial WO creation), prefer computed
    const componentId = component?.cuuid || component?.id;
    const linkKey = (wo.jobId && componentId) ? `${wo.jobId}:${componentId}` : null;
    const linkData = linkKey ? linksByJobComponent.get(linkKey) : null;
    let dueRH: number | undefined;
    if (wo.maintenanceBasis === 'Running Hours') {
      dueRH = parseRH(linkData?.nextDueRH);
      if (dueRH == null) {
        const woNextDue = parseRH(wo.nextDueReading);
        const lastDone = parseRH(linkData?.lastDoneRH) ?? parseRH(job?.lastDoneRH);
        const interval = parseRH(job?.intervalRunningHour);
        const computed = (lastDone != null && interval != null && interval > 0) ? lastDone + interval : undefined;
        if (woNextDue != null && computed != null && computed > woNextDue) {
          dueRH = computed;
        } else {
          dueRH = woNextDue ?? computed;
        }
      }
    }
    const currentRH = wo.maintenanceBasis === 'Running Hours'
      ? (parseRH(component?.currentCumulativeRH) ?? parseRH(wo.currentReading))
      : undefined;

    // Determine RH lead time based on job criticality
    const isJobCritical = job?.jobPriority === 'Critical' || job?.classRelated === 'true' || job?.classRelated === true;
    const rhLeadTimeHours = wo.maintenanceBasis === 'Running Hours'
      ? (isJobCritical
          ? (vesselSettings?.rhLeadHoursCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL)
          : (vesselSettings?.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_NON_CRITICAL))
      : undefined;

    // Determine calendar lead time for Planned → Due transition
    const calendarLeadTimeDays = wo.maintenanceBasis !== 'Running Hours' && vesselSettings
      ? (isJobCritical
          ? vesselSettings.calendarLeadDaysCritical
          : vesselSettings.calendarLeadDaysNonCritical)
      : undefined;

    const woComputedStatus = computeWorkOrderStatus({
      dueDate: wo.dueDate,
      dueRH,
      currentRH,
      isExecution: wo.isExecution,
      status: wo.status,
      completionDateTime: wo.dateCompleted,
      wasRejected: wo.wasRejected ?? false,
      maintenanceBasis: wo.maintenanceBasis || job?.maintenanceBasis || undefined,
      vesselGraceSettings,
      rhLeadTimeHours,
      calendarLeadTimeDays,
      companyGraceConfig
    });

    let liveMissedCycles = wo.missedCycles || 0;
    if (liveMissedCycles === 0 &&
        (woComputedStatus === 'Overdue' || woComputedStatus === 'Due' || woComputedStatus === 'Due (Grace P)')){
      if (wo.maintenanceBasis === 'Running Hours' && dueRH != null && currentRH != null) {
        const interval = parseRH(job?.intervalRunningHour);
        if (interval && interval > 0) {
          liveMissedCycles = calculateMissedCyclesRH(dueRH, currentRH, interval);
        }
      } else if (wo.maintenanceBasis !== 'Running Hours' && wo.dueDate && wo.frequencyValue && wo.frequencyUnit) {
        liveMissedCycles = calculateMissedCycles(wo.dueDate, new Date().toISOString(), wo.frequencyValue, wo.frequencyUnit);
      }
    }

    const plannerKey = (wo.jobId && componentId) ? `${wo.jobId}::${componentId}` : null;
    const plannedDate = plannerKey ? (plannerDateMap.get(plannerKey) || null) : null;

    const resolvedAssignedTo = (wo.assignedTo && wo.assignedTo !== 'Unassigned')
      ? wo.assignedTo
      : (job?.assignedTo || 'Unassigned');

    // Canonical rule: assignedTo (the rank-name text shown by the Work
    // Orders module) is the source of truth. Always re-resolve
    // assignedToRankId from that text so a stale OR missing rank-id can
    // never make a row disagree with what the Work Orders "Assigned To"
    // column shows. Only fall back to the stored rank-id when the text
    // does not resolve to any known rank (e.g. unassigned, or data-entry
    // typos that have no matching rank in adm_available_ranks).
    let resolvedAssignedToRankId: string | null = null;
    if (resolvedAssignedTo && resolvedAssignedTo !== 'Unassigned') {
      const key = resolvedAssignedTo.toLowerCase().trim();
      resolvedAssignedToRankId = rankLabelMap.get(key) ?? null;
    }
    if (!resolvedAssignedToRankId) {
      resolvedAssignedToRankId = wo.assignedToRankId ?? null;
    }

    return {
      ...wo,
      assignedTo: resolvedAssignedTo,
      assignedToRankId: resolvedAssignedToRankId,
      criticality: wo.criticality || job?.criticality || null,
      computedStatus: woComputedStatus,
      missedCycles: liveMissedCycles,
      leadTimeValue: job?.leadTimeValue ?? null,
      leadTimeUnit: job?.leadTimeUnit ?? null,
      componentCritical: component?.critical === true,
      dueRH: dueRH ?? null,
      currentRH: currentRH ?? null,
      plannedDate
    };
  });

  // Sort by spec-compliant priority
  const statusPriority: Record<string, number> = {
    'Overdue': 1,
    'Due (Grace P)': 2,
    'Due': 3,
    'Due Soon': 4,
    'Planned': 5,
    'Postponed': 6,
    'Pending Approval': 7,
    'Active': 8,
    'Completed': 9,
    'Rejected': 10
  };

  const sortedWorkOrders = enrichedWorkOrders.sort((a: any, b: any) => {
    const aPriority = statusPriority[a.computedStatus] ?? 99;
    const bPriority = statusPriority[b.computedStatus] ?? 99;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    if (a.dueDate && b.dueDate) {
      // shared parser (dateParse.ts contract); unparseable sorts as epoch 0
      return (parseWorkOrderDate(a.dueDate)?.getTime() ?? 0) - (parseWorkOrderDate(b.dueDate)?.getTime() ?? 0);
    }

    return 0;
  });

  return sortedWorkOrders;
}

/**
 * Same as listWorkOrders, but returns each row with `status` overwritten by the
 * computed lifecycle band (computedStatus). For readers that historically
 * filtered the persisted `status` column for the DERIVED band (Overdue / Due /
 * Active): now that no scheduler persists that band (it is computed on read),
 * those readers get a correct value with no downstream changes. Authored /
 * workflow statuses (Completed, Pending Approval, Postponed, Rejected, …) are
 * preserved because computeWorkOrderStatus passes them through unchanged.
 */
// CONTRACT: every overdue/due (derived-band) read MUST go through this helper —
// never a raw `WHERE status = 'Overdue'/'Due'`. Status is computed on read; the
// persisted column is not maintained for the derived band.
export async function getWorkOrdersWithComputedStatus(vesselId?: string, vesselIds?: string[]) {
  const enriched = await listWorkOrders(vesselId, vesselIds);
  return enriched.map((wo: any) => ({ ...wo, status: wo.computedStatus ?? wo.status }));
}

export interface ListWorkOrdersPagedParams extends WorkOrderFilterParams {
  page: number;
  pageSize: number;
}

export interface ListWorkOrdersPagedResult {
  items: any[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Record<string, number>;
  approvalTierCounts: ReturnType<typeof computeApprovalTierCounts>;
  rankOptions: string[];
}

/**
 * Paginated variant of listWorkOrders. Reuses the exact same enrichment as the
 * non-paged path, then applies the shared filter/search/sort logic (single
 * source of truth in @shared/utils/workOrderFilters) before slicing the
 * requested page. Tab counts and rank options are derived from the full
 * enriched set so the UI's tab badges and rank dropdown stay complete even
 * though only one page of rows is returned.
 */
export async function listWorkOrdersPaged(
  vesselId: string | undefined,
  vesselIds: string[] | undefined,
  params: ListWorkOrdersPagedParams,
): Promise<ListWorkOrdersPagedResult> {
  const enriched = await listWorkOrders(vesselId, vesselIds);

  const statusCounts = computeWorkOrderTabCounts(enriched);

  const rankOptions = Array.from(
    new Set(
      enriched
        .map((wo: any) => (typeof wo.assignedTo === 'string' ? wo.assignedTo.trim() : ''))
        .filter((rank: string) => rank.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const filtered = filterAndSortWorkOrders(enriched, params);
  const approvalTierCounts = computeApprovalTierCounts(filtered);

  const total = filtered.length;
  const pageSize = params.pageSize;
  const page = params.page;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return { items, total, page, pageSize, statusCounts, approvalTierCounts, rankOptions };
}

// ── Rejection History ──

export async function getRejectionHistory(id: string) {
  let workOrder = await repo.findById(id);
  if (!workOrder) {
    workOrder = await repo.findByCode(id);
  }
  if (!workOrder) {
    throw new NotFoundError('Work order not found');
  }

  const entityIds = Array.from(new Set([workOrder.wouuid, workOrder.id].filter(Boolean))) as string[];
  const logs: any[] = [];
  for (const eid of entityIds) {
    const entries = await repo.getAuditLogsByEntity('work_order', eid);
    logs.push(...entries);
  }

  const REJECTION_ACTION_TYPES = new Set(['reject', 'superintendent_reject_completion', 'superintendent_reopen_completion']);

  const rejections = logs
    .filter((entry: any) => REJECTION_ACTION_TYPES.has(entry.actionType))
    .map((entry: any) => {
      const payload = entry.payload || {};
      const isSuperintendentCompletion = entry.actionType === 'superintendent_reject_completion';
      const isSuperintendentReopen = entry.actionType === 'superintendent_reopen_completion';
      return {
        rejectedAt: isSuperintendentReopen
          ? (payload.reopenedAt || entry.timestamp)
          : (payload.rejectedAt || entry.timestamp),
        rejectedBy: (isSuperintendentCompletion || isSuperintendentReopen)
          ? (payload.rejectedByName || payload.reopenedByName || entry.userId)
          : entry.userId,
        rejectionComments: isSuperintendentCompletion
          ? (payload.rejectionRemarks ?? null)
          : isSuperintendentReopen
          ? (payload.reopenRemarks ?? null)
          : (payload.rejectionComments ?? null),
        rejectionType: isSuperintendentCompletion
          ? 'superintendent_completion_rejection'
          : isSuperintendentReopen
          ? 'superintendent_completion_reopen'
          : 'approver_rejection',
      };
    })
    .sort((a, b) => {
      const ta = new Date(a.rejectedAt).getTime();
      const tb = new Date(b.rejectedAt).getTime();
      return tb - ta;
    });

  return rejections;
}

// ── Get Single Work Order with Enrichment ──

export async function getWorkOrder(id: string) {
  const companyGraceRow = await storage.getCompanyStandardGraceSettings();
  const companyGraceConfig = buildCompanyGraceConfig(companyGraceRow);

  let workOrder = await repo.findById(id);
  if (!workOrder) {
    workOrder = await repo.findByCode(id);
  }
  if (!workOrder) {
    throw new NotFoundError('Work order not found');
  }

  // Fetch job to hydrate lead time data and RH fields
  let leadTimeValue = null;
  let leadTimeUnit = null;
  let job: any = null;
  if (workOrder.vesselId) {
    const jobs = await repo.findJobs(workOrder.vesselId);
    job = workOrder.jobId
      ? jobs.find((j: any) => j.juuid === workOrder.jobId)
      : workOrder.templateCode
        ? jobs.find((j: any) => j.jobNo === workOrder.templateCode)
        : null;
    leadTimeValue = job?.leadTimeValue ?? null;
    leadTimeUnit = job?.leadTimeUnit ?? null;
  }

  // Fetch component to hydrate currentRH
  let component: any = null;
  if (workOrder.componentCode && workOrder.vesselId) {
    component = await repo.findComponentByCode(workOrder.componentCode, workOrder.vesselId);
  }
  if (!component && workOrder.component) {
    component = await repo.findComponent(workOrder.component);
  }

  const parseRH = (value: string | number | null | undefined): number | undefined => {
    if (value == null || value === '') return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  };

  // Resolve dueRH: link.nextDueRH → wo.nextDueReading → computed(lastDoneRH + interval)
  // When wo.nextDueReading equals interval (likely stale from initial WO creation), prefer computed
  let linkNextDueRH: string | null = null;
  let linkLastDoneRH: string | null = null;
  const compId = component?.cuuid || component?.id;
  if (workOrder.maintenanceBasis === 'Running Hours' && workOrder.jobId && compId) {
    const links = await storage.getJobComponentLinksByJob(workOrder.jobId);
    const link = links.find((l: any) => l.componentId === compId);
    if (link?.nextDueRH) {
      linkNextDueRH = link.nextDueRH;
    }
    if (link?.lastDoneRH) {
      linkLastDoneRH = link.lastDoneRH;
    }
  }

  let dueRH: number | undefined;
  if (workOrder.maintenanceBasis === 'Running Hours') {
    dueRH = parseRH(linkNextDueRH);
    if (dueRH == null) {
      const woNextDue = parseRH(workOrder.nextDueReading);
      const lastDone = parseRH(linkLastDoneRH) ?? parseRH(job?.lastDoneRH);
      const interval = parseRH(job?.intervalRunningHour);
      const computed = (lastDone != null && interval != null && interval > 0) ? lastDone + interval : undefined;
      if (woNextDue != null && computed != null && computed > woNextDue) {
        dueRH = computed;
      } else {
        dueRH = woNextDue ?? computed;
      }
    }
  }
  const currentRH = workOrder.maintenanceBasis === 'Running Hours'
    ? (parseRH(component?.currentCumulativeRH) ?? parseRH(workOrder.currentReading))
    : undefined;

  // Fetch vessel-specific grace settings
  const vesselSettings = workOrder.vesselId ? await repo.findPmsVesselSettings(workOrder.vesselId) : null;
  const vesselGraceSettings = vesselSettings ? {
    calendarGraceMode: (vesselSettings.calendarGraceMode || 'COMPANY_STANDARD') as 'COMPANY_STANDARD' | 'CUSTOM_DAYS',
    calendarGraceDays: vesselSettings.calendarGraceDays ?? WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
    rhGraceHours: vesselSettings.rhGraceHours ?? WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
    rhLeadTimeHours: vesselSettings.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS
  } : undefined;

  const isJobCritical = job?.jobPriority === 'Critical' || job?.classRelated === 'true' || job?.classRelated === true;
  const rhLeadTimeHours = workOrder.maintenanceBasis === 'Running Hours'
    ? (isJobCritical
        ? (vesselSettings?.rhLeadHoursCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL)
        : (vesselSettings?.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_NON_CRITICAL))
    : undefined;

  // Determine calendar lead time for Planned → Due transition
  const calendarLeadTimeDays2 = workOrder.maintenanceBasis !== 'Running Hours' && vesselSettings
    ? (isJobCritical
        ? vesselSettings.calendarLeadDaysCritical
        : vesselSettings.calendarLeadDaysNonCritical)
    : undefined;

  return {
    ...workOrder,
    computedStatus: computeWorkOrderStatus({
      dueDate: workOrder.dueDate,
      dueRH,
      currentRH,
      isExecution: workOrder.isExecution,
      status: workOrder.status,
      completionDateTime: workOrder.dateCompleted,
      wasRejected: workOrder.wasRejected ?? false,
      maintenanceBasis: workOrder.maintenanceBasis || job?.maintenanceBasis || undefined,
      vesselGraceSettings,
      rhLeadTimeHours,
      calendarLeadTimeDays: calendarLeadTimeDays2,
      companyGraceConfig
    }),
    leadTimeValue,
    leadTimeUnit
  };
}

// ── Create Work Order ──

export async function createWorkOrder(body: any) {
  const { insertWorkOrderSchema } = await import('@shared/schema');
  let workOrderData = insertWorkOrderSchema.parse(body);

  // AUTO-CORRECT: Fetch correct componentCode from database
  if (workOrderData.vesselId && (workOrderData.component || workOrderData.componentCode)) {
    let resolvedComponent: any = null;

    // Try 1: Look up by ID
    if (workOrderData.component) {
      resolvedComponent = await repo.findComponent(workOrderData.component);
    }
    // Try 2: Look up by componentCode
    if (!resolvedComponent && workOrderData.componentCode) {
      resolvedComponent = await repo.findComponentByCode(workOrderData.componentCode, workOrderData.vesselId);
    }
    // Try 3: Look up by name
    if (!resolvedComponent && workOrderData.component) {
      const vesselComponents = await repo.findComponents(workOrderData.vesselId);
      resolvedComponent = vesselComponents.find((c: any) => c.name === workOrderData.component);
    }

    if (resolvedComponent) {
      if (workOrderData.componentCode && workOrderData.componentCode !== resolvedComponent.componentCode) {
        console.warn(`⚠️ AUTO-CORRECTING componentCode mismatch: passed "${workOrderData.componentCode}" but component "${resolvedComponent.name}" has code "${resolvedComponent.componentCode}"`);
      }
      workOrderData = { ...workOrderData, componentCode: resolvedComponent.componentCode };
      console.log(`✅ Auto-resolved componentCode: ${resolvedComponent.componentCode} for component "${resolvedComponent.name}"`);
    }
  }

  // Convert ISO date (YYYY-MM-DD) to DD-MM-YYYY if provided by frontend
  if (workOrderData.dueDate && workOrderData.dueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = workOrderData.dueDate.split('-');
    workOrderData.dueDate = `${day}-${month}-${year}`;
    console.log(`Converted dueDate from ISO to DD-MM-YYYY: ${workOrderData.dueDate}`);
  }

  // Auto-resolve jobId if not provided
  if (!workOrderData.jobId && workOrderData.component && workOrderData.jobTitle && workOrderData.vesselId) {
    try {
      const jobs = await repo.findJobs(workOrderData.vesselId);
      const matchingJob = jobs.find((j: any) =>
        j.componentId === workOrderData.component &&
        j.jobTitle === workOrderData.jobTitle
      );
      if (matchingJob) {
        workOrderData = { ...workOrderData, jobId: (matchingJob as any).id };
        console.log(`Auto-resolved jobId: ${(matchingJob as any).id} for component ${workOrderData.component} and job "${workOrderData.jobTitle}"`);
      }
    } catch (error) {
      console.error('Failed to auto-resolve jobId:', error);
    }
  }

  // Generate spec-compliant work order number if not provided
  if (!workOrderData.workOrderNo) {
    const {
      generatePlannedWorkOrderNumber,
      generateUnplannedWorkOrderNumber,
      determineWorkOrderType
    } = await import('../../../utils/workOrderNumbering');

    const storage = repo.getStorage();
    const woType = determineWorkOrderType(workOrderData.jobId, workOrderData.templateCode);
    workOrderData.workOrderType = woType;

    if (woType === 'Planned') {
      let jobCode = 'JOB-UNKNOWN';
      let componentCode = workOrderData.componentCode || '';
      if (workOrderData.jobId) {
        const job = await repo.findJob(workOrderData.jobId);
        if (job?.jobNo) {
          jobCode = job.jobNo;
        }
        if (job?.componentCode) {
          componentCode = job.componentCode;
        } else if (job?.componentId) {
          const component = await repo.findComponent(job.componentId);
          if (component?.componentCode) {
            componentCode = component.componentCode;
          }
        }
      }
      if (!componentCode && workOrderData.componentCode) {
        componentCode = workOrderData.componentCode;
      }
      if (!componentCode && workOrderData.vesselId) {
        console.warn(`No componentCode available for planned WO creation`);
      }
      if (!componentCode) {
        throw new ValidationError('Component code is required for planned work order numbering');
      }
      workOrderData.workOrderNo = await generatePlannedWorkOrderNumber(
        storage, jobCode, componentCode, workOrderData.vesselId || undefined
      );
    } else {
      const vesselId = workOrderData.vesselId || 'V001';
      let unplannedComponentCode = workOrderData.componentCode || '';
      if (!unplannedComponentCode && workOrderData.component) {
        const components = await repo.findComponents(vesselId);
        const matchedComponent = components.find((c: any) =>
          c.id === workOrderData.component ||
          c.name === workOrderData.component ||
          c.componentCode === workOrderData.component
        );
        if (matchedComponent?.componentCode) {
          unplannedComponentCode = matchedComponent.componentCode;
        }
      }
      if (!unplannedComponentCode) {
        throw new ValidationError('Component code is required for unplanned work order numbering');
      }
      workOrderData.workOrderNo = await generateUnplannedWorkOrderNumber(storage, vesselId, unplannedComponentCode);
    }

    console.log(`Generated ${woType} WO number: ${workOrderData.workOrderNo}`);
  }

  // Auto-generate template code if not provided
  if (!workOrderData.templateCode && workOrderData.componentCode) {
    const currentYear = new Date().getFullYear().toString();
    const vesselId = workOrderData.vesselId || 'V001';

    const existingWOs = await repo.findWorkOrders(vesselId);
    const componentYearWOs = existingWOs.filter((wo: any) =>
      wo.templateCode?.startsWith(`WO-${workOrderData.componentCode}-${currentYear}-`)
    );

    const maxSeq = componentYearWOs.length > 0
      ? Math.max(...componentYearWOs.map((wo: any) => {
          const match = wo.templateCode?.match(/-(\d+)$/);
          return match ? parseInt(match[1]) : 0;
        }))
      : 0;

    const nextSeq = maxSeq + 1;
    const generatedTemplateCode = `WO-${workOrderData.componentCode}-${currentYear}-${String(nextSeq).padStart(2, '0')}`;

    workOrderData = { ...workOrderData, templateCode: generatedTemplateCode };
  }

  // Auto-calculate due date if not provided
  if (!workOrderData.dueDate && workOrderData.componentCode) {
    try {
      const { calculateDueDate } = await import('@shared/utils/dateCalculations');
      const vesselId = workOrderData.vesselId || 'V001';

      const components = await repo.findComponents(vesselId);
      const component = components.find((c: any) => c.componentCode === workOrderData.componentCode);

      if (component?.installationDate) {
        const calculatedDueDate = calculateDueDate(
          component.installationDate,
          workOrderData.frequencyValue,
          workOrderData.frequencyUnit
        );

        if (calculatedDueDate) {
          workOrderData = { ...workOrderData, dueDate: calculatedDueDate };
          console.log(`Auto-calculated due date: ${calculatedDueDate} based on installation date: ${component.installationDate}`);
        }
      }
    } catch (error) {
      console.error('Failed to auto-calculate due date:', error);
    }
  }

  workOrderData = await applyAssignmentSync({ ...workOrderData });

  const workOrder = await repo.create(workOrderData);

  // Sync field logging — log INSERT
  try {
    await logFieldChanges('work_orders', workOrder.wouuid, workOrder.vesselId || null, null, workOrder, body.userId || body.performedBy || 'system');
  } catch (err) { console.error('[FieldLogger] WO create:', err); }

  // Audit Phase 3 — clean business audit row for WO creation (manual). Actor frozen by createAuditLog.
  try {
    await repo.createAuditLog({
      entityType: 'work_order',
      entityId: workOrder.wouuid,
      actionType: 'create',
      source: 'web_ui',
      vesselCode: workOrder.vesselId || null,
      componentCode: workOrder.componentCode || null,
      payload: {
        workOrderNo: workOrder.workOrderNo,
        status: workOrder.status,
        jobTitle: (workOrder as any).jobTitle ?? null,
        component: (workOrder as any).component ?? null,
      },
    });
  } catch (auditErr) { console.error('[Audit] WO create log failed:', auditErr); }

  return workOrder;
}

// ── Update Work Order (MASSIVE handler with approval/completion flow) ──

export async function updateWorkOrder(id: string, body: any) {
  // Log incoming data for debugging
  console.log('📝 PATCH work order request body keys:', Object.keys(body));
  // Tracks whether the approval RH sync was skipped due to a back-dated lower entry.
  let rhBackdatedApproval = false;
  let latestRHApproval: number | null = null;
  let latestRHDateApproval: string | null = null;

  // RULE: Completed WOs are immutable except for specific fields
  const existingWO = await repo.findById(id);
  if (!existingWO) {
    throw new NotFoundError('Work order not found');
  }

  // Check if WO is completed - if so, only allow limited updates
  const { isCompletedStatus } = await import('../../../utils/workOrderStatus');
  const woIsCompleted = isCompletedStatus(existingWO.status);

  if (woIsCompleted) {
    const allowedFieldsForCompletedWO = ['remarks', 'completionRemarks', 'jobExperienceNotes'];
    const requestedFields = Object.keys(body);
    const disallowedFields = requestedFields.filter((f: string) => !allowedFieldsForCompletedWO.includes(f));

    if (disallowedFields.length > 0) {
      const storedStatus = existingWO.status || 'Completed';
      const dueDate = existingWO.dueDate;
      if (dueDate) {
        const parsedDue = parseWorkOrderDate(dueDate); // shared parser (dateParse.ts contract)
        if (parsedDue && parsedDue < new Date()) {
          console.warn(
            `⚠️ Data inconsistency: WO ${existingWO.workOrderNo} has stored status "${storedStatus}" ` +
            `but due date ${dueDate} is in the past. This WO may have appeared as Overdue in the UI.`
          );
        }
      }
      console.warn(`⚠️ Attempted to modify completed WO ${existingWO.workOrderNo}: ${disallowedFields.join(', ')}`);
      throw new ValidationError(
        `Cannot modify work order: This work order is marked as "${storedStatus}" and cannot be modified. Only remarks can be added. If you need to re-complete this work order, please contact your administrator.`,
        {
          message: `Work Order ${existingWO.workOrderNo} is marked as "${storedStatus}" and cannot be modified.`,
          storedStatus,
          disallowedFields
        }
      );
    }
  }

  let updateData = { ...body };

  // Run the assignment-sync helper only when the request actually
  // touches the assignment fields, so a partial PATCH (e.g. remarks
  // only) does not inadvertently clear assignedToRankId. The helper
  // is bidirectional: text-only payloads resolve the rank-id, and
  // rank-id-only payloads resolve the text.
  if ('assignedTo' in updateData || 'assignedToRankId' in updateData) {
    await applyAssignmentSync(updateData);
  }

  // Remove any undefined values
  Object.keys(updateData).forEach((key: string) => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  // ── Save as Draft (migration 165, Task #402) ──────────────────────────────
  // A draft save sends ONLY draftExecutionData (a non-null JSON document) and
  // no status/completion fields. It writes exclusively to the draft column so
  // the stored status and every derivation input (completionDateTime, due
  // dates, RH readings) stay untouched — the WO keeps its current tab. All
  // completion mapping, auto-promotion, RH validation and job side effects
  // below are deliberately skipped. draftExecutionData:null (clearing) and
  // payloads that also carry status/completion fields fall through to the
  // normal path.
  const draftDoc = updateData.draftExecutionData;
  const isDraftOnlySave =
    draftDoc != null && typeof draftDoc === 'object' && !Array.isArray(draftDoc) &&
    updateData.status === undefined &&
    updateData.completionDateTime === undefined &&
    updateData.dateOfCompletion === undefined;
  if (isDraftOnlySave) {
    // Strict payload check: a draft save must not smuggle in live-column
    // writes. Anything beyond the draft doc + actor metadata is rejected
    // loudly rather than silently dropped.
    // userRole/userUuid are injected into the body by route middleware.
    const DRAFT_SAVE_ALLOWED_KEYS = new Set(['draftExecutionData', 'userId', 'performedBy', 'userRole', 'userUuid']);
    const strayKeys = Object.keys(updateData).filter((k: string) => !DRAFT_SAVE_ALLOWED_KEYS.has(k));
    if (strayKeys.length > 0) {
      throw new ValidationError(
        'Draft save must contain only draftExecutionData',
        { message: `Unexpected fields in draft save: ${strayKeys.join(', ')}. Send them via a normal update or include them inside draftExecutionData.`, strayKeys }
      );
    }
    const workOrder = await repo.update(id, { draftExecutionData: draftDoc });
    try {
      await logFieldChanges('work_orders', existingWO.wouuid, existingWO.vesselId || null, existingWO, workOrder, body.userId || body.performedBy || 'system');
    } catch (err) { console.error('[FieldLogger] WO draft save:', err); }
    console.log(`📝 Draft saved for WO ${existingWO.workOrderNo || id} (draft-only update, status/tab unchanged)`);
    return workOrder;
  }

  // VALIDATION: Numeric field precision
  const validateNumericField = (
    value: any,
    fieldName: string,
    opts: { maxDecimals?: number; maxValue?: number; integerOnly?: boolean } = {}
  ) => {
    if (value == null || value === '') return;
    const str = String(value).trim();
    if (str === '') return;
    const num = Number(str);
    if (isNaN(num)) {
      throw new ValidationError(`${fieldName} must be a valid number`, { field: fieldName, value: str });
    }
    if (opts.integerOnly && !Number.isInteger(num)) {
      throw new ValidationError(`${fieldName} must be a whole number (integer)`, { field: fieldName, value: str });
    }
    if (opts.integerOnly && num < 1) {
      throw new ValidationError(`${fieldName} must be a positive integer`, { field: fieldName, value: str });
    }
    if (opts.maxDecimals != null) {
      const parts = str.split('.');
      if (parts.length === 2 && parts[1].length > opts.maxDecimals) {
        throw new ValidationError(`${fieldName} must have at most ${opts.maxDecimals} decimal places`, { field: fieldName, value: str });
      }
    }
    if (opts.maxValue != null && num > opts.maxValue) {
      throw new ValidationError(`${fieldName} must not exceed ${opts.maxValue}`, { field: fieldName, value: str });
    }
  };

  if (updateData.totalTimeHours !== undefined) {
    validateNumericField(updateData.totalTimeHours, 'Total Time (Hours)', { maxDecimals: 2, maxValue: 720 });
  }
  if (updateData.manhours !== undefined) {
    validateNumericField(updateData.manhours, 'Manhours', { maxDecimals: 2 });
  }
  if (updateData.previousReading !== undefined) {
    validateNumericField(updateData.previousReading, 'Previous Reading', { maxDecimals: 2 });
  }
  if (updateData.runningHours !== undefined) {
    validateNumericField(updateData.runningHours, 'Running Hours', { maxDecimals: 2 });
  }
  if (updateData.runningHoursDifference !== undefined) {
    validateNumericField(updateData.runningHoursDifference, 'Running Hours Difference', { maxDecimals: 2 });
  }
  if (updateData.currentReading !== undefined) {
    validateNumericField(updateData.currentReading, 'Current Reading', { maxDecimals: 2 });
  }
  if (updateData.noOfPersons !== undefined) {
    validateNumericField(updateData.noOfPersons, 'Number of Persons', { integerOnly: true });
  }

  const TEXT_LIMITS: Record<string, { field: string; max: number }> = {
    workCarriedOut: { field: 'Work Carried Out', max: 2000 },
    jobExperienceNotes: { field: 'Job Experience / Notes', max: 2000 },
    remarks: { field: 'Remarks', max: 500 },
    completionRemarks: { field: 'Completion Remarks', max: 500 },
    rejectionComments: { field: 'Rejection Comments', max: 500 },
  };
  for (const [key, config] of Object.entries(TEXT_LIMITS)) {
    if (updateData[key] && typeof updateData[key] === 'string' && updateData[key].length > config.max) {
      throw new ValidationError(
        `${config.field} exceeds maximum length`,
        { message: `${config.field} must be ${config.max} characters or fewer (currently ${updateData[key].length} characters).` }
      );
    }
  }

  // AUTO-CORRECT: Fetch correct componentCode from database
  const componentRef = updateData.component || existingWO.component;
  const componentCodeRef = updateData.componentCode || existingWO.componentCode;
  const vesselId = updateData.vesselId || existingWO.vesselId;
  if (vesselId && (componentRef || componentCodeRef)) {
    let resolvedComponent: any = null;

    if (componentRef) {
      resolvedComponent = await repo.findComponent(componentRef);
    }
    if (!resolvedComponent && componentCodeRef) {
      resolvedComponent = await repo.findComponentByCode(componentCodeRef, vesselId);
    }
    if (!resolvedComponent && componentRef) {
      const vesselComponents = await repo.findComponents(vesselId);
      resolvedComponent = vesselComponents.find((c: any) => c.name === componentRef);
    }

    if (resolvedComponent) {
      if (componentCodeRef && componentCodeRef !== resolvedComponent.componentCode) {
        console.warn(`⚠️ AUTO-CORRECTING WO PATCH componentCode mismatch: current "${componentCodeRef}" but component "${resolvedComponent.name}" has code "${resolvedComponent.componentCode}"`);
      }
      updateData.componentCode = resolvedComponent.componentCode;
      console.log(`✅ Auto-resolved componentCode in PATCH: ${resolvedComponent.componentCode} for component "${resolvedComponent.name}"`);
    }
  }

  // SAFEGUARD: Auto-set 'Pending Approval' if completion data provided without explicit status
  const hasCompletionData = !!(updateData.completionDateTime || updateData.dateOfCompletion);
  const hasExplicitStatus = updateData.status !== undefined;

  // Helper: Normalize date formats to ISO
  const normalizeDateToISO = (dateStr: string | undefined | null): string | null => {
    if (!dateStr) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.split('T')[0];
    const ddmmyyyyMatch = dateStr.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})/);
    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch;
      return `${year}-${month}-${day}`;
    }
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    console.warn(`⚠️ Could not normalize date format: ${dateStr}`);
    return null;
  };

  // Map completion date/time fields to the database columns (completionDateTime, dateCompleted)
  // Priority: completionDateTime (has time component) > dateOfCompletion (date-only fallback)
  console.log(`📅 Incoming completion fields — completionDateTime: "${updateData.completionDateTime}", dateOfCompletion: "${updateData.dateOfCompletion}"`);
  if (updateData.completionDateTime) {
    if (!updateData.completionDateTime.includes('T')) {
      updateData.completionDateTime = `${updateData.completionDateTime}T00:00:00.000Z`;
    }
    updateData.dateCompleted = updateData.completionDateTime;
    console.log(`📅 Using completionDateTime: ${updateData.completionDateTime}`);
  } else if (updateData.dateOfCompletion) {
    const normalizedDate = normalizeDateToISO(updateData.dateOfCompletion);
    if (normalizedDate) {
      const isoTimestamp = `${normalizedDate}T00:00:00.000Z`;
      updateData.completionDateTime = isoTimestamp;
      updateData.dateCompleted = isoTimestamp;
      console.log(`📅 Fallback: mapped dateOfCompletion "${updateData.dateOfCompletion}" to completionDateTime: ${isoTimestamp}`);
    }
  }
  // Remove dateOfCompletion — it is not a database column, just a frontend convenience field
  delete updateData.dateOfCompletion;

  if (hasCompletionData && !hasExplicitStatus) {
    const currentWorkOrder = await repo.findById(id);
    if (currentWorkOrder && currentWorkOrder.status !== 'Approved' && currentWorkOrder.status !== 'Completed') {
      updateData.status = 'Pending Approval';
      if (!currentWorkOrder.submittedDate) {
        updateData.submittedDate = new Date().toISOString();
        console.log('📝 Auto-capturing submittedDate for audit trail');
      }
      console.log('📝 Auto-setting status to Pending Approval (completion data provided without explicit status)');
    }
  }

  // ── RH accuracy validations (migration 139) — PATCH path mirror of the
  // completion-service checks (the ship Part-B save submits via PATCH). ──
  if (updateData.woCompletionRh !== undefined && updateData.woCompletionRh !== null && String(updateData.woCompletionRh).trim() !== '') {
    const woRhNum = parseFloat(String(updateData.woCompletionRh));
    const readingRaw = updateData.runningHours ?? updateData.currentReading ?? existingWO.runningHours ?? existingWO.currentReading;
    const readingNum = readingRaw !== undefined && readingRaw !== null && String(readingRaw).trim() !== '' ? parseFloat(String(readingRaw)) : NaN;
    if (!isNaN(woRhNum) && !isNaN(readingNum) && woRhNum > readingNum) {
      throw new ValidationError(
        `WO Completion RH (${woRhNum}) cannot be greater than the Current Reading (${readingNum}). ` +
        `The completion reading is the hours at the time the work was done; the Current Reading is the latest meter value.`,
        { code: 'WO_COMPLETION_RH_EXCEEDS_READING' }
      );
    }
  }
  if (updateData.currentReadingDate) {
    const rdParsed = new Date(String(updateData.currentReadingDate));
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    if (isNaN(rdParsed.getTime())) {
      throw new ValidationError('Current Reading Date is not a valid date.', { code: 'INVALID_READING_DATE' });
    }
    if (rdParsed.getTime() > todayEnd.getTime()) {
      throw new ValidationError('Current Reading Date cannot be in the future.', { code: 'READING_DATE_IN_FUTURE' });
    }
  }

  // REJECTION WORKFLOW
  const isBeingRejected = updateData.status?.toLowerCase() === 'rejected';
  if (isBeingRejected) {
    updateData.completionDateTime = null;
    updateData.dateCompleted = null;
    updateData.rejectionDate = new Date().toISOString();
    updateData.wasRejected = true;
    updateData.status = 'Due';
    updateData.approvalTier = null;
    updateData.daysLate = null;
    updateData.approvalBlockReason = null;
    updateData.superintendentNotifiedAt = null;
    updateData.superintendentAcknowledged = null;
    console.log('📝 Work order rejected - setting status to Due, wasRejected=true, clearing approval tier for rework');
  }

  // REJECTED WO RESUBMISSION (handles both approval-path rejection and completion-rejection)
  const isRejectedWO = existingWO.wasRejected === true || existingWO.status === 'Rejected';
  if (isRejectedWO && hasCompletionData && !hasExplicitStatus) {
    updateData.status = 'Pending Approval';
    updateData.rejectionComments = null;
    updateData.rejectionDate = null;
    updateData.approvalAction = null;
    updateData.wasRejected = false;
    updateData.submittedDate = new Date().toISOString();
    // Clear superintendent rejection remarks when a completion-rejected WO is resubmitted
    if (existingWO.status === 'Rejected') {
      updateData.superintendentRejectionRemarks = null;
    }
    console.log('📝 Previously rejected WO resubmitted - transitioning to Pending Approval');
  }

  // When vessel explicitly sends status='Pending Approval' for a reviewer-reopened WO,
  // also clear the rejection flags so the banner doesn't reappear after the HOD approves.
  if (isRejectedWO && updateData.status === 'Pending Approval' && hasExplicitStatus) {
    updateData.wasRejected = false;
    updateData.rejectionComments = null;
    updateData.rejectionDate = null;
    updateData.approvalAction = null;
    if (!updateData.submittedDate) updateData.submittedDate = new Date().toISOString();
    console.log('📝 Reviewer-reopened WO explicitly resubmitted to Pending Approval - clearing rejection flags');
  }

  // AUDIT TRAIL: Capture submittedDate
  const isSubmissionAction = updateData.approvalAction === 'submitted' ||
                              updateData.approvalAction === 'submit' ||
                              updateData.status === 'Pending Approval';
  if (isSubmissionAction && !existingWO.submittedDate) {
    updateData.submittedDate = new Date().toISOString();
    console.log('📝 Capturing submittedDate for audit trail on submission/Pending Approval');
  }

  // Save as Draft (Task #402): a real submission supersedes any stashed draft —
  // clear it so the form no longer prefers stale drafted values after approval.
  if ((isSubmissionAction || hasCompletionData || updateData.status === 'Completed') &&
      updateData.draftExecutionData === undefined &&
      (existingWO as any).draftExecutionData != null) {
    updateData.draftExecutionData = null;
    console.log('📝 Clearing draftExecutionData on submission');
  }

  if (isSubmissionAction || updateData.status === 'Pending Approval') {
    const completionDateForCalc = updateData.completionDateTime || updateData.dateCompleted ||
      existingWO.completionDateTime || existingWO.dateCompleted;
    const dueDateForCalc = existingWO.nextDueDate || existingWO.dueDate;
    if (completionDateForCalc && dueDateForCalc && existingWO.maintenanceBasis !== 'Running Hours') {
      const preCalcMissed = calculateMissedCycles(
        dueDateForCalc,
        completionDateForCalc,
        existingWO.frequencyValue || updateData.frequencyValue,
        existingWO.frequencyUnit || updateData.frequencyUnit
      );
      updateData.missedCycles = preCalcMissed;
      updateData.originalDueDate = dueDateForCalc;
      console.log(`📝 Pre-calculated missedCycles at submission: ${preCalcMissed} (dueDate: ${dueDateForCalc}, completionDate: ${completionDateForCalc})`);
    }

    // Layer 5: Calculate approval tier when transitioning to Pending Approval
    const tierCompDate = updateData.completionDateTime || updateData.dateCompleted ||
      existingWO.completionDateTime || existingWO.dateCompleted;
    const tierDueDate = existingWO.nextDueDate || existingWO.dueDate;
    const tierMissedCycles = updateData.missedCycles ?? existingWO.missedCycles ?? 0;
    const tierBackdatingDays = calculateBackdatingDaysForApproval(
      tierCompDate,
      updateData.submittedDate || existingWO.submittedDate
    );
    const lockEnabledAtSubmit = await isSuperintendentLockEnabled();
    const tierResult = calculateApprovalTier(tierDueDate, tierCompDate, tierMissedCycles, tierBackdatingDays, lockEnabledAtSubmit);
    updateData.daysLate = tierResult.daysLate;
    updateData.approvalTier = tierResult.approvalTier;
    updateData.superintendentNotifiedAt = tierResult.superintendentNotifiedAt;
    updateData.superintendentAcknowledged = tierResult.superintendentAcknowledged;
    updateData.approvalBlockReason = tierResult.approvalBlockReason;
    console.log(`📝 Layer 5: approvalTier=${tierResult.approvalTier}, daysLate=${tierResult.daysLate}, missedCycles=${tierMissedCycles}, backdatingDays=${tierBackdatingDays}`);

    // Create superintendent notification if needed
    if (tierResult.approvalTier === 'superintendent_locked' || tierResult.approvalTier === 'superintendent_notification') {
      const woForNotification = { ...existingWO, ...updateData };
      await createSuperintendentNotificationForWO(woForNotification, tierResult.daysLate, tierMissedCycles, tierResult.approvalTier, tierBackdatingDays);
    }

    // Resolve and set approver from org chart at submission time
    const { resolveHodForDepartment: resolveHodAtSubmit } = await import('../../ranks/hodResolutionService');
    const submissionHod = await resolveHodAtSubmit(
      existingWO.vesselId,
      existingWO.department,
      updateData.approver || existingWO.approver
    );
    if (submissionHod.resolved) {
      if (updateData.approver && updateData.approver !== submissionHod.rankName && submissionHod.source !== 'fallback') {
        console.warn(`[Submission] Client approver "${updateData.approver}" differs from org chart HOD "${submissionHod.rankName}" for dept "${existingWO.department}". Using org chart value.`);
      }
      updateData.approver = submissionHod.rankName;
      console.log(`📝 Set approver from org chart: ${submissionHod.rankName} (source: ${submissionHod.source})`);
    }
  }

  console.log('📝 Cleaned update data keys:', Object.keys(updateData));

  // INHERITED RH no longer has a flat "cannot exceed master" ceiling. Per the Task #240 design,
  // an INHERITED component records its OWN maintenance cycle and is governed solely by timeline
  // validation (forward/backward ordering + 25 hrs/day utilization), mirroring the INHERITED
  // branch in workOrderCompletionService. The legacy RH_EXCEEDS_MASTER guard was removed here so
  // the two completion paths behave identically.

  const isApprovalTransition = (updateData.approvalAction === 'approved' && updateData.status === 'Completed') ||
    (updateData.status === 'Completed' && existingWO.status === 'Pending Approval');

  // ── Level 2 Review Interception ──────────────────────────────────────────
  // If the linked job requires a Level 2 Office reviewer, redirect the WO to
  // "Pending Office Review" instead of completing it. This gate covers the
  // direct-PATCH path; the bulk-approve path has its own identical check.
  let interceptedForL2Review = false;
  if (isApprovalTransition && existingWO.jobId) {
    try {
      const linkedJob = await repo.findJob(existingWO.jobId);
      if (linkedJob && (linkedJob as any).level2ReviewerRankId) {
        interceptedForL2Review = true;
        updateData.status = 'Pending Office Review';
        updateData.approvalDate = new Date().toISOString();
        console.log(`🔒 [L2 Review] WO ${existingWO.workOrderNo} intercepted — job requires Level 2 reviewer rank "${(linkedJob as any).level2ReviewerRankId}"`);
      }
    } catch (err) {
      console.warn(`[L2 Review] Could not load linked job ${existingWO.jobId} for L2 check — proceeding without interception:`, err);
    }
  }

  if (isApprovalTransition && !interceptedForL2Review) {
    const { resolveHodForDepartment, getHodShortLabel } = await import('../../ranks/hodResolutionService');
    const hodResolution = await resolveHodForDepartment(
      existingWO.vesselId,
      existingWO.department,
      existingWO.approver
    );
    const hodName = hodResolution.rankName;
    const hodShort = getHodShortLabel(hodName);

    if (hodResolution.resolved) {
      if (updateData.approver && updateData.approver !== hodName && hodResolution.source !== 'fallback') {
        console.warn(`[Approval] Client provided approver "${updateData.approver}" differs from org chart HOD "${hodName}" for dept "${existingWO.department}". Using org chart value.`);
      }
      updateData.approver = hodName;
    }

    let woMissedCycles = existingWO.missedCycles || 0;
    if (woMissedCycles === 0 && existingWO.maintenanceBasis !== 'Running Hours') {
      const approvalCompDate = existingWO.completionDateTime || existingWO.dateCompleted;
      const approvalDueDate = existingWO.nextDueDate || existingWO.dueDate;
      if (approvalCompDate && approvalDueDate && existingWO.frequencyValue && existingWO.frequencyUnit) {
        woMissedCycles = calculateMissedCycles(approvalDueDate, approvalCompDate, existingWO.frequencyValue, existingWO.frequencyUnit);
        if (woMissedCycles > 0) {
          updateData.missedCycles = woMissedCycles;
          updateData.originalDueDate = approvalDueDate;
          console.log(`📝 Recalculated missedCycles at approval: ${woMissedCycles}`);
        }
      }
    }
    if (woMissedCycles >= 1) {
      const justification = (updateData.skippedCyclesJustification || '').trim();
      if (!justification || justification.length < 30) {
        throw new ValidationError(
          `This work order has ${woMissedCycles} skipped maintenance cycle(s). The ${hodName} must provide a written justification (minimum 30 characters) explaining why these cycles were missed before approval can be granted.`,
          { code: 'JUSTIFICATION_REQUIRED', missedCycles: woMissedCycles }
        );
      }
    }

    // Layer 5: Approval gate logic based on approvalTier
    const currentTier = existingWO.approvalTier || 'standard';
    const ceRemarks = (updateData.ceApprovalRemarks || '').trim();

    if (currentTier === 'superintendent_locked') {
      // Live policy read: toggling the company setting OFF unlocks already-stamped
      // locked WOs immediately — they fall through to the notify-tier remarks rule.
      const lockEnabled = await isSuperintendentLockEnabled();
      if (lockEnabled) {
        throw new ValidationError(
          `This work order has high severity issues (3+ missed cycles, 21+ days late, or 7+ days backdating). It is locked pending Superintendent acknowledgment. The ${hodName} cannot approve until the Superintendent has acknowledged.`,
          { code: 'SUPERINTENDENT_LOCKED' }
        );
      }
      if (!ceRemarks || ceRemarks.length < 20) {
        throw new ValidationError(
          `This work order has high severity issues and the Superintendent lock is disabled by company policy. The ${hodName} must enter detailed remarks (minimum 20 characters) before approving.`,
          { code: 'CE_REMARKS_REQUIRED', minLength: 20 }
        );
      }
    }

    if (currentTier === 'superintendent_notification') {
      if (!ceRemarks || ceRemarks.length < 20) {
        throw new ValidationError(
          `This work order has medium severity issues (2 missed cycles, 14–20 days late, or 3–6 days backdating). The ${hodName} must enter detailed remarks (minimum 20 characters) before approving.`,
          { code: 'CE_REMARKS_REQUIRED', minLength: 20 }
        );
      }
    }

    if (currentTier === 'ce_with_justification') {
      if (!ceRemarks || ceRemarks.length < 10) {
        throw new ValidationError(
          `This work order has low severity issues (1 missed cycle, 7–13 days late, or 1–2 days backdating). ${hodShort} approval remarks are mandatory (minimum 10 characters).`,
          { code: 'CE_REMARKS_REQUIRED', minLength: 10 }
        );
      }
    }
  }

  // POSTPONEMENT VALIDATION: Require a non-empty trimmed reason when postponing
  const isBeingPostponed = updateData.status === 'Postponed';
  if (isBeingPostponed && !updateData.postponementReason?.trim()) {
    throw new ValidationError(
      'Postponement reason is required when postponing a work order.',
      { code: 'POSTPONEMENT_REASON_REQUIRED' }
    );
  }
  if (isBeingPostponed && updateData.postponementReason?.trim() === 'Other Reason' && !updateData.postponementRemarks?.trim()) {
    throw new ValidationError(
      'A custom postponement reason is required when selecting Other Reason.',
      { code: 'OTHER_REASON_REMARKS_REQUIRED' }
    );
  }

  // === Task #240: MASTER RH Reading Sync (live completion path) ===
  // The web UI completes a WO via this PATCH approval transition (not POST /complete), so the
  // counter-type branch must live here too. For MASTER components the completion reading is the
  // source of truth: route it through updateMasterRH() so the per-day rate cap + Sail Admin
  // override apply and the value cascades to INHERITED children.
  //   - Placed AFTER all approval gates (justification / tier / L2) and BEFORE the commit so the
  //     override-required error surfaces while the WO is still Pending (no half-completed state),
  //     and so blocked / intercepted WOs never advance the master counter.
  //   - INHERITED keeps the existing RH_EXCEEDS_MASTER guard above + its own jobs-row cycle write
  //     below; NOT_RH_DRIVEN never reaches this branch. Neither moves the master counter.
  //   - Double-sync guarded by existing rh_synced_at; the stamp persists in the same commit.
  //   - SHIP-ONLY (Jeevan): the master RH counter advances on the ship/HOD approval, NEVER
  //     office-side. The office L2 review completes via reviewerApprove() (which does not advance
  //     the counter); this PATCH approval path must not advance it on a shore instance either.
  //     updateMasterRH still runs on the ship, so the shore mirrors the value via the
  //     running_hours_audit sync + derived-RH-update (propagation untouched).
  const { isShipInstance: isShipInstanceForRH } = await import('../../sync/syncRole');
  // Task #394: the office may now advance the RH counter from WO completion, but ONLY
  // for vessels whose per-vessel office-RH-entry switch is ON (default OFF, fail closed).
  // Ship behaviour is unchanged. The receiving-side latest-reading-wins guards are
  // always on regardless of this switch.
  const isShipForRhWrite = await isShipInstanceForRH();
  let officeRhEntryAllowed = false;
  if (!isShipForRhWrite && existingWO.vesselId) {
    const { isOfficeRhEntryEnabled } = await import('./workOrderGenerationGate');
    officeRhEntryAllowed = await isOfficeRhEntryEnabled(existingWO.vesselId);
  }
  if (
    isApprovalTransition &&
    !interceptedForL2Review &&
    updateData.status === 'Completed' &&
    !(existingWO as any).rhSyncedAt &&
    (isShipForRhWrite || officeRhEntryAllowed)
  ) {
    const rhRaw = existingWO.runningHours || updateData.runningHours;
    if (rhRaw) {
      let rhComp = await repo.findComponent(existingWO.component);
      if (!rhComp && existingWO.componentCode && existingWO.vesselId) {
        rhComp = await repo.findComponentByCode(existingWO.componentCode, existingWO.vesselId);
      }
      const rhCounterType = (rhComp?.rhCounterType || 'MASTER').toUpperCase();
      const rhValue = parseInt(rhRaw);
      const normRhDate = (d?: string | null): string | undefined => {
        if (!d) return undefined;
        if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.split('T')[0];
        const m = d.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})/);
        if (m) return `${m[3]}-${m[2]}-${m[1]}`;
        const p = new Date(d);
        return !isNaN(p.getTime()) ? p.toISOString().split('T')[0] : undefined;
      };
      const completionDateNorm = normRhDate(existingWO.completionDateTime || existingWO.dateCompleted || updateData.completionDateTime);
      // R2 (migration 139): the RH module operates on the date the reading was
      // TAKEN (stored Current Reading Date); fallback to the completion date =
      // exact pre-feature behaviour.
      const readingDateNorm = normRhDate((existingWO as any).currentReadingDate || (updateData as any).currentReadingDate) || completionDateNorm;

      // Task #394: an OFFICE RH entry must carry an explicit observed reading date —
      // never default to "now" (a wrong reading date poisons the latest-reading-wins
      // comparator fleet-wide). Ship entries keep their existing fallback behaviour.
      if (!isShipForRhWrite && !readingDateNorm) {
        throw new ValidationError(
          'Office RH entry requires the reading date (Current Reading Date or Completion Date). Enter the date the counter was actually read.',
          { code: 'RH_READING_DATE_REQUIRED', workOrderNo: existingWO.workOrderNo }
        );
      }

      if (rhComp && rhCounterType === 'MASTER' && !isNaN(rhValue)) {
        // MASTER pre-flight: detect back-dated lower entry.
        // If the completion date predates the master's last RH update AND the entered RH is not
        // greater than the current master RH, skip the RH module write. The WO still completes.
        let rhBackdatedSkippedApproval = false;
        const masterCurrentRHApproval = parseFloat((rhComp.rhCurrentMaster ?? rhComp.currentCumulativeRH) || '0');
        if (rhValue <= masterCurrentRHApproval && readingDateNorm) {
          // Task #394: baseline from AUDIT HISTORY first (legacy component stamps may
          // be poisoned with entry/sync time from the old bug era) — component stamp
          // is only the fallback when no usable audit history exists.
          const { resolveRhBaselineDay } = await import('../../running-hours/rhEventComparator');
          const { getPool } = await import('../../../db');
          const stampFallbackApproval: any = rhComp.rhMasterUpdatedAt ?? (rhComp.lastUpdated ? new Date(rhComp.lastUpdated) : null);
          const stampFallbackDateApproval: Date | null = stampFallbackApproval instanceof Date ? stampFallbackApproval : (stampFallbackApproval ? new Date(stampFallbackApproval) : null);
          const masterUpdDateApproval: Date | null = await resolveRhBaselineDay(
            await getPool(), rhComp.cuuid,
            stampFallbackDateApproval && !isNaN(stampFallbackDateApproval.getTime()) ? stampFallbackDateApproval : null
          );
          if (masterUpdDateApproval && !isNaN(masterUpdDateApproval.getTime())) {
            const approvalCompletionDate = new Date(readingDateNorm!);
            const masterDay = Date.UTC(masterUpdDateApproval.getUTCFullYear(), masterUpdDateApproval.getUTCMonth(), masterUpdDateApproval.getUTCDate());
            const woDay = Date.UTC(approvalCompletionDate.getUTCFullYear(), approvalCompletionDate.getUTCMonth(), approvalCompletionDate.getUTCDate());
            if (woDay < masterDay) {
              rhBackdatedSkippedApproval = true;
              updateData.rhBackdatedEntry = true;
              rhBackdatedApproval = true;
              latestRHApproval = masterCurrentRHApproval;
              latestRHDateApproval = masterUpdDateApproval.toISOString().split('T')[0];
              console.warn(`⚠️ [RH Sync] Back-dated lower MASTER entry (approval path): WO ${existingWO.workOrderNo} entered RH ${rhValue} (reading date ${readingDateNorm}) is older and lower than master current ${masterCurrentRHApproval} (${latestRHDateApproval}). RH module NOT updated.`);
            }
          }
        }

        if (!rhBackdatedSkippedApproval) {
        // MASTER: completion reading is source of truth — advance master counter + cascade.
        // Task #394/#243: atomic compare-and-set claim on rh_synced_at — a concurrent or
        // replayed approval of the SAME WO sees 0 rows and skips (no double-advance).
        // Released on failure so a corrected retry can apply.
        const { claimWoRhSync, releaseWoRhSync } = await import('../../running-hours/rhEventComparator');
        const { getPool: getPoolForClaim } = await import('../../../db');
        const claimPool = await getPoolForClaim();
        if (!(await claimWoRhSync(claimPool, existingWO.wouuid))) {
          console.warn(`⚠️ [RH Sync] WO ${existingWO.workOrderNo} RH already claimed/applied by a concurrent completion — skipping duplicate RH advance`);
        } else {
        const { updateMasterRH } = await import('../../running-hours/services/runningHoursService');
        try {
          await updateMasterRH(rhComp.cuuid, {
            newRHValue: rhValue,
            updateSource: 'MANUAL',
            userId: body.userId || existingWO.performedBy || 'system',
            userUuid: body.userUuid,
            userRole: body.userRole || 'Ship',
            adminOverride: body.adminOverride || false,
            comments: `RH update via work order completion ${existingWO.workOrderNo}`,
            dateUpdated: readingDateNorm
          });
          updateData.rhSyncedAt = new Date();
          console.log(`✅ [RH Sync] MASTER component ${rhComp.componentCode || rhComp.cuuid} advanced to ${rhValue} via WO ${existingWO.workOrderNo} (cascaded to INHERITED children)`);
        } catch (masterErr: any) {
          // Release the claim so a corrected retry can apply RH (Task #243 contract).
          await releaseWoRhSync(claimPool, existingWO.wouuid);
          // Surface the per-day cap / override-required error so the UI can offer a Sail Admin override.
          if (masterErr instanceof ValidationError) {
            const det: any = masterErr.details || {};
            throw new ValidationError(masterErr.message, {
              code: 'RH_OVERRIDE_REQUIRED',
              ...det,
              requiresAdminOverride: det.validation?.requiresAdminOverride ?? true,
              canOverride: det.validation?.canOverride ?? false,
              componentId: rhComp.cuuid,
              componentCode: rhComp.componentCode || existingWO.componentCode,
              rhCounterType: 'MASTER'
            });
          }
          throw masterErr;
        }
        } // end claim else — MASTER branch
        } // end if (!rhBackdatedSkippedApproval) — MASTER branch
      } else if (rhComp && rhCounterType === 'INHERITED' && !isNaN(rhValue)) {
        // INHERITED: route through master propagation so the 25 hrs/day cap, cascade to all
        // sibling INHERITED components, and WO completion date stamp apply exactly as for MASTER.
        // Fallback: if the master link is missing or unresolvable, timeline-validate and record
        // on this child only — never block completion (safe fallback per design).
        const vesselIdForLookup = existingWO.vesselId || rhComp.vesselId;
        let masterComp: any = null;

        if (rhComp.rhMasterComponentId && vesselIdForLookup) {
          const allVesselComps = await repo.findComponents(vesselIdForLookup);
          masterComp = allVesselComps.find((c: any) =>
            c.rhCounterType === 'MASTER' && (
              c.cuuid === rhComp.rhMasterComponentId ||
              String(c.id) === rhComp.rhMasterComponentId ||
              c.componentCode === rhComp.rhMasterComponentId
            )
          ) ?? null;
        }

        if (masterComp) {
          // INHERITED pre-flight: detect back-dated lower entry against the master.
          let rhBackdatedSkippedInherited = false;
          const inhMasterCurrentRH = parseFloat((masterComp.rhCurrentMaster ?? masterComp.currentCumulativeRH) || '0');
          if (rhValue <= inhMasterCurrentRH && readingDateNorm) {
            // Task #394: audit-history baseline first; component stamp only as fallback.
            const { resolveRhBaselineDay } = await import('../../running-hours/rhEventComparator');
            const { getPool } = await import('../../../db');
            const inhMasterUpdRaw: any = masterComp.rhMasterUpdatedAt ?? (masterComp.lastUpdated ? new Date(masterComp.lastUpdated) : null);
            const inhStampFallback: Date | null = inhMasterUpdRaw instanceof Date ? inhMasterUpdRaw : (inhMasterUpdRaw ? new Date(inhMasterUpdRaw) : null);
            const inhMasterUpdDate: Date | null = await resolveRhBaselineDay(
              await getPool(), masterComp.cuuid,
              inhStampFallback && !isNaN(inhStampFallback.getTime()) ? inhStampFallback : null
            );
            if (inhMasterUpdDate && !isNaN(inhMasterUpdDate.getTime())) {
              const inhCompletionDate = new Date(readingDateNorm!);
              const masterDay = Date.UTC(inhMasterUpdDate.getUTCFullYear(), inhMasterUpdDate.getUTCMonth(), inhMasterUpdDate.getUTCDate());
              const woDay = Date.UTC(inhCompletionDate.getUTCFullYear(), inhCompletionDate.getUTCMonth(), inhCompletionDate.getUTCDate());
              if (woDay < masterDay) {
                rhBackdatedSkippedInherited = true;
                updateData.rhBackdatedEntry = true;
                rhBackdatedApproval = true;
                latestRHApproval = inhMasterCurrentRH;
                latestRHDateApproval = inhMasterUpdDate.toISOString().split('T')[0];
                console.warn(`⚠️ [RH Sync] Back-dated lower INHERITED entry (approval path): WO ${existingWO.workOrderNo} entered RH ${rhValue} (reading date ${readingDateNorm}) is older and lower than master ${masterComp.componentCode || masterComp.cuuid} current ${inhMasterCurrentRH} (${latestRHDateApproval}). RH module NOT updated.`);
              }
            }
          }

          if (!rhBackdatedSkippedInherited) {
          // Master resolved: advance its counter, cascading delta + completion date to all siblings.
          // Task #394/#243: atomic claim — same double-advance protection as the MASTER branch.
          const { claimWoRhSync: claimInh, releaseWoRhSync: releaseInh } = await import('../../running-hours/rhEventComparator');
          const { getPool: getPoolInh } = await import('../../../db');
          const claimPoolInh = await getPoolInh();
          if (!(await claimInh(claimPoolInh, existingWO.wouuid))) {
            console.warn(`⚠️ [RH Sync] WO ${existingWO.workOrderNo} RH already claimed/applied by a concurrent completion — skipping duplicate RH advance (INHERITED)`);
          } else {
          const { updateMasterRH } = await import('../../running-hours/services/runningHoursService');
          try {
            await updateMasterRH(masterComp.cuuid, {
              newRHValue: rhValue,
              updateSource: 'WORKORDER',
              userId: body.userId || existingWO.performedBy || 'system',
              userUuid: body.userUuid,
              userRole: body.userRole || 'Ship',
              adminOverride: body.adminOverride || false,
              comments: `WO ${existingWO.workOrderNo} (INHERITED → cascaded via master ${masterComp.componentCode || masterComp.cuuid})`,
              dateUpdated: readingDateNorm
            });
            updateData.rhSyncedAt = new Date();
            console.log(`✅ [RH Sync] INHERITED component ${rhComp.componentCode || rhComp.cuuid} routed through MASTER ${masterComp.componentCode || masterComp.cuuid}, cascaded to all siblings via WO ${existingWO.workOrderNo}`);
          } catch (masterErr: any) {
            // Release the claim so a corrected retry can apply RH (Task #243 contract).
            await releaseInh(claimPoolInh, existingWO.wouuid);
            if (masterErr instanceof ValidationError) {
              const det: any = masterErr.details || {};
              throw new ValidationError(masterErr.message, {
                code: 'RH_OVERRIDE_REQUIRED',
                ...det,
                requiresAdminOverride: det.validation?.requiresAdminOverride ?? true,
                canOverride: det.validation?.canOverride ?? false,
                componentId: masterComp.cuuid,
                componentCode: masterComp.componentCode || existingWO.componentCode,
                rhCounterType: 'INHERITED'
              });
            }
            throw masterErr;
          }
          } // end claim else — INHERITED branch
          } // end if (!rhBackdatedSkippedInherited) — INHERITED branch
        } else {
          // No valid master link: timeline-validate and record on this child only.
          if (readingDateNorm) {
            const { validateRHEntry } = await import('../../running-hours/services/rhTimelineValidationService');
            const backdateCheck = await validateRHEntry(rhComp.cuuid, readingDateNorm, rhValue);
            if (!backdateCheck.isValid && backdateCheck.validationStatus === 'INVALID_BACKDATED') {
              throw new ValidationError(backdateCheck.errorMessage, {
                code: 'INVALID_BACKDATED',
                validRange: backdateCheck.validRange,
                previousEntry: backdateCheck.previousEntry,
                nextEntry: backdateCheck.nextEntry,
                componentId: rhComp.cuuid,
                componentCode: rhComp.componentCode || existingWO.componentCode,
                rhCounterType: 'INHERITED'
              });
            }
          }
          try {
            const prevRH = parseInt(rhComp.currentCumulativeRH || '0');
            await repo.createRunningHoursAudit({
              componentId: rhComp.cuuid,
              vesselId: existingWO.vesselId || rhComp.vesselId || 'V001',
              previousRH: (isNaN(prevRH) ? 0 : prevRH).toString(),
              newRH: rhValue.toString(),
              cumulativeRH: rhValue.toString(),
              // Task #394 fix: stamp the READING date (not the completion date, and never
              // "today") — a wrong date here poisons the latest-reading-wins comparator.
              dateUpdatedLocal: readingDateNorm || completionDateNorm || new Date().toISOString().split('T')[0],
              dateUpdatedTZ: 'UTC',
              enteredAtUTC: new Date(),
              userId: body.userId || existingWO.performedBy || 'System',
              source: 'workorder',
              notes: `WO ${existingWO.workOrderNo} (INHERITED — no master link, child-only record)`,
              meterReplaced: false
            });
          } catch (auditErr) {
            console.error('[RH Sync] Failed to write INHERITED audit snapshot:', auditErr);
          }
          updateData.rhSyncedAt = new Date();
          console.warn(`⚠️ [RH Sync] INHERITED component ${rhComp.componentCode || rhComp.cuuid} has no valid master link — recorded on child only (WO ${existingWO.workOrderNo})`);
        }
      }
      // NOT_RH_DRIVEN: never write any RH value — fall through with no RH sync.
    }
  }

  const workOrder = await repo.update(id, updateData);

  // Sync field logging — log UPDATE (existingWO already fetched at top of function)
  try {
    await logFieldChanges('work_orders', existingWO.wouuid, existingWO.vesselId || null, existingWO, workOrder, body.userId || body.approver || body.performedBy || 'system');
  } catch (err) { console.error('[FieldLogger] WO update:', err); }

  // POSTPONEMENT AUDIT: Create a record in work_order_postponements when transitioning to Postponed
  if (isBeingPostponed && existingWO.status !== 'Postponed') {
    try {
      const existingCount = await storage.getWorkOrderPostponementCount(workOrder.wouuid);
      const postponementNumber = existingCount + 1;
      const postponementId = `pp-${workOrder.id}-${Date.now()}`;
      const originalDueDate = existingWO.dueDate || null;
      const newDueDate = workOrder.postponementEndDate || workOrder.dueDate || null;
      let durationDays: number | null = null;
      if (originalDueDate && newDueDate) {
        const orig = parseWorkOrderDate(originalDueDate); // shared parser (dateParse.ts contract)
        const next = parseWorkOrderDate(newDueDate);
        if (orig && next) {
          durationDays = Math.ceil((next.getTime() - orig.getTime()) / (1000 * 60 * 60 * 24));
        }
      }
      await storage.createWorkOrderPostponement({
        id: postponementId,
        workOrderId: workOrder.wouuid,
        vesselId: workOrder.vesselId || existingWO.vesselId || '',
        postponementNumber,
        originalDueDate,
        newDueDate,
        postponementReason: workOrder.postponementReason || '',
        postponementRemarks: workOrder.postponementRemarks || null,
        authorizedBy: workOrder.postponementAuthorizedBy || null,
        durationDays,
        status: 'Approved',
        informOffice: false,
      });
      console.log(`📝 [Postponement] Audit record #${postponementNumber} created for WO ${workOrder.workOrderNo}`);
    } catch (auditErr) {
      console.error(`⚠️ [Postponement] Failed to create audit record for WO ${workOrder.workOrderNo}:`, auditErr);
    }
  }

  // ========== SPARE CONSUMPTION ON SAVE (Real-time ROB update) ==========
  const isApprovalAction = updateData.approvalAction === 'approved' && updateData.status === 'Completed';
  if (!isApprovalAction && !isBeingRejected && !woIsCompleted && !interceptedForL2Review) {
    const currentConsumed = ensureArray(updateData.consumedSpareParts) as ConsumedSpareEntry[];
    const previousConsumed = ensureArray(existingWO.consumedSpareParts) as ConsumedSpareEntry[];

    const sparesToProcess = computeSpareConsumptionDelta(currentConsumed, previousConsumed);
    const woVesselId = existingWO.vesselId || 'V001';

    if (sparesToProcess.length > 0) {
      const allSpares = await repo.findSpares(woVesselId);
      const updatedConsumedSpareParts = [...currentConsumed];

      for (const item of sparesToProcess) {
        try {
          let spare = allSpares.find((s: any) => s.partCode === item.partKey);
          if (!spare) spare = allSpares.find((s: any) => s.partNumber === item.partKey);
          if (!spare) {
            console.warn(`⚠️ [Save Consumption] Spare ${item.partKey} not found in inventory, skipping ROB deduction`);
            continue;
          }

          let resolvedLocationId: number | null = null;
          const locationObj = await repo.findOrCreateLocation(woVesselId, item.locationName, updateData.userId || updateData.performedBy || 'system');
          if (locationObj) resolvedLocationId = locationObj.id;

          if (!resolvedLocationId) {
            console.warn(`⚠️ [Save Consumption] Could not resolve location "${item.locationName}" for spare ${item.partKey}`);
            continue;
          }

          if (item.reverseQty > 0) {
            await repo.performInventoryTransaction({
              vesselId: woVesselId,
              spareId: spare.id,
              locationId: resolvedLocationId,
              eventType: 'ADJUST',
              qtyChange: item.reverseQty,
              referenceType: 'WORK_ORDER',
              referenceId: existingWO.wouuid,
              referenceNote: `WO Save Reversal: ${existingWO.workOrderNo} - Qty adjusted due to work order re-save`,
              userId: updateData.userId || updateData.performedBy || 'system'
            });
            console.log(`🔄 [Save Consumption] Reversed ${item.reverseQty} units of ${item.partKey} at ${item.locationName} (WO: ${existingWO.workOrderNo})`);
          }

          if (item.qty > 0) {
            await repo.performInventoryTransaction({
              vesselId: woVesselId,
              spareId: spare.id,
              locationId: resolvedLocationId,
              eventType: 'CONSUME',
              qtyChange: -Math.abs(item.qty),
              referenceType: 'WORK_ORDER',
              referenceId: existingWO.wouuid,
              referenceNote: `WO Save: ${existingWO.workOrderNo} - ${item.spare.comments || 'Consumed on work order save'}`,
              userId: updateData.userId || updateData.performedBy || 'system'
            });
            console.log(`✅ [Save Consumption] Deducted ${item.qty} units of ${item.partKey} from ${item.locationName} (WO: ${existingWO.workOrderNo})`);
          }

          if (item.lineIndex >= 0 && item.lineIndex < updatedConsumedSpareParts.length) {
            const currentQty = typeof updatedConsumedSpareParts[item.lineIndex].quantityConsumed === 'string'
              ? parseFloat(updatedConsumedSpareParts[item.lineIndex].quantityConsumed as string) : updatedConsumedSpareParts[item.lineIndex].quantityConsumed as number;
            (updatedConsumedSpareParts[item.lineIndex] as any)._deductedQty = currentQty || 0;
          }
        } catch (consumeError: any) {
          if (consumeError.message?.includes('NEGATIVE_STOCK_PREVENTED') || consumeError.message?.includes('INSUFFICIENT_STOCK')) {
            console.error(`❌ [Save Consumption] STOCK_SYNC_ISSUE for ${item.partKey}: ${consumeError.message}. This may indicate spare_location_stock is out of sync with legacy ROB fields. The approval flow will attempt auto-sync.`);
          } else {
            console.error(`❌ [Save Consumption] Failed to process spare ${item.partKey}:`, consumeError);
          }
        }
      }

      try {
        await repo.update(id, { consumedSpareParts: updatedConsumedSpareParts });
        console.log(`✅ [Save Consumption] Updated _deductedQty flags for WO ${existingWO.workOrderNo}`);
      } catch (updateError) {
        console.error(`❌ [Save Consumption] Failed to update _deductedQty flags:`, updateError);
      }
    }
  }

  // ── Audit Trail: Log every WO save ──
  try {
    const auditActionType = isBeingRejected ? 'reject'
      : (updateData.approvalAction === 'approved' && updateData.status === 'Completed') ? 'approve'
      : 'update';

    const changedFields: Record<string, { old: any; new: any }> = {};
    for (const key of Object.keys(body)) {
      const oldVal = (existingWO as any)[key];
      const newVal = body[key];
      if (oldVal !== newVal && newVal !== undefined) {
        changedFields[key] = { old: oldVal ?? null, new: newVal };
      }
    }

    await repo.createAuditLog({
      entityType: 'work_order',
      entityId: existingWO.wouuid || id,
      actionType: auditActionType,
      userId: body.userId || body.approver || body.performedBy || 'system',
      source: 'web_ui',
      vesselCode: existingWO.vesselId || null,
      componentCode: existingWO.componentCode || null,
      fieldName: null,
      oldValue: null,
      newValue: null,
      payload: {
        workOrderNo: existingWO.workOrderNo,
        changedFields,
        status: updateData.status || existingWO.status,
        ...(auditActionType === 'approve' && { approvedAt: new Date().toISOString() }),
        ...(auditActionType === 'reject' && { rejectedAt: new Date().toISOString(), rejectionComments: body.rejectionComments || null }),
      },
    });
    console.log(`Audit log created for WO ${existingWO.workOrderNo} (action: ${auditActionType})`);
  } catch (auditError) {
    console.error('Failed to create audit log entry:', auditError);
  }

  // When work order is being approved/completed, create maintenance history and update job
  if (updateData.approvalAction === 'approved' && updateData.status === 'Completed') {
    console.log('📋 Work order approved - creating maintenance history and updating job cycle dates');

    const freshWorkOrder = workOrder;
    if (!freshWorkOrder) {
      console.error('Failed to get work order for completion processing');
    } else {
      // Find the component for maintenance history
      let component = await repo.findComponent(freshWorkOrder.component);

      if (!component && freshWorkOrder.componentCode && freshWorkOrder.vesselId) {
        const componentByCode = await repo.findComponentByCode(freshWorkOrder.componentCode, freshWorkOrder.vesselId);
        if (componentByCode) {
          if (componentByCode.name === freshWorkOrder.component) {
            component = componentByCode;
          } else {
            console.warn(`⚠️ Component code ${freshWorkOrder.componentCode} found but name mismatch: "${componentByCode.name}" vs "${freshWorkOrder.component}". Will try name lookup.`);
          }
        }
      }

      if (!component && freshWorkOrder.vesselId) {
        const vesselComponents = await repo.findComponents(freshWorkOrder.vesselId);
        component = vesselComponents.find((c: any) => c.name === freshWorkOrder.component) ?? undefined;
        if (!component) {
          component = vesselComponents.find((c: any) => c.componentCode === freshWorkOrder.componentCode) ?? undefined;
        }
      }

      if (component) {
        const missedCycles = freshWorkOrder.maintenanceBasis === 'Running Hours'
          ? 0
          : calculateMissedCycles(
              freshWorkOrder.nextDueDate || freshWorkOrder.dueDate,
              freshWorkOrder.completionDateTime || freshWorkOrder.dateCompleted || updateData.completionDateTime,
              freshWorkOrder.frequencyValue,
              freshWorkOrder.frequencyUnit
            );
        if (missedCycles > 0) {
          console.log(`⚠️ Skipped cycle detection: ${missedCycles} cycle(s) missed for WO ${freshWorkOrder.workOrderNo}`);
        }
        const originalDueDate = freshWorkOrder.nextDueDate || freshWorkOrder.dueDate || null;
        await repo.update(id, { missedCycles, originalDueDate });

        if (missedCycles >= 1 && (freshWorkOrder.maintenanceBasis === 'Calendar' || freshWorkOrder.maintenanceBasis === 'Dual Frequency')) {
          try {
            const { createSkippedCycleRecords } = await import('../utils/skippedCycleBackfill');
            await createSkippedCycleRecords({
              workOrderId: freshWorkOrder.wouuid || freshWorkOrder.id,
              componentId: component.cuuid,
              componentCode: freshWorkOrder.componentCode || component.componentCode || null,
              vesselCode: freshWorkOrder.vesselId || component.vesselId || null,
              jobId: freshWorkOrder.jobId || null,
              jobCode: freshWorkOrder.jobCode || null,
              jobTitle: freshWorkOrder.jobTitle || null,
              originalDueDate,
              missedCycles,
              frequencyValue: freshWorkOrder.frequencyValue,
              frequencyUnit: freshWorkOrder.frequencyUnit
            });
          } catch (err) {
            console.error('[BACKFILL ERROR] Failed to create skipped cycle records:', err);
          }
        }

        // Create maintenance history record
        try {
          const existingHistory = await repo.findMaintenanceHistoryByWorkOrderId(freshWorkOrder.wouuid);
          if (existingHistory) {
            console.log(`⚠️ Maintenance history already exists for work order ${freshWorkOrder.id}, skipping duplicate creation`);
          } else {
            const normalizeToISO = (dateStr: string): string | null => {
              if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.split('T')[0];
              const ddmmyyyyMatch = dateStr.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})/);
              if (ddmmyyyyMatch) {
                const [, day, month, year] = ddmmyyyyMatch;
                return `${year}-${month}-${day}`;
              }
              const parsed = new Date(dateStr);
              if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
              console.error(`❌ Cannot parse date: ${dateStr}. Expected YYYY-MM-DD or DD-MM-YYYY format.`);
              return null;
            };

            const rawCompletionDate = freshWorkOrder.completionDateTime || freshWorkOrder.dateCompleted || updateData.completionDateTime;
            if (!rawCompletionDate) {
              console.error(`❌ No completion date found for work order ${freshWorkOrder.id}. Maintenance history creation skipped.`);
            } else {
              const dateOfCompletion = normalizeToISO(rawCompletionDate);
              if (!dateOfCompletion) {
                console.error(`❌ Invalid completion date format for work order ${freshWorkOrder.id}: ${rawCompletionDate}. Maintenance history creation skipped.`);
              } else {
                console.log(`📅 Using completion date for maintenance history: ${dateOfCompletion} (raw: ${rawCompletionDate})`);

                const historyPayload = {
                  componentId: component.cuuid,
                  componentCode: freshWorkOrder.componentCode || component.componentCode,
                  vesselCode: freshWorkOrder.vesselId,
                  jobId: freshWorkOrder.jobId || null,
                  jobCode: freshWorkOrder.workOrderNo?.match(/^(.+?)-\d+\.\d+/)?.[1] || null,
                  workOrderId: freshWorkOrder.wouuid,
                  workOrderNo: freshWorkOrder.workOrderNo || `WO-${freshWorkOrder.id}`,
                  jobTitle: freshWorkOrder.jobTitle,
                  maintenanceType: freshWorkOrder.maintenanceType || freshWorkOrder.taskType || 'Servicing',
                  dateCompleted: dateOfCompletion,
                  runningHoursAtCompletion: freshWorkOrder.runningHours || null,
                  performedBy: freshWorkOrder.performedBy || freshWorkOrder.executionAssignedTo || 'Unknown',
                  approvedBy: freshWorkOrder.approver || null,
                  approvalDate: dateOfCompletion,
                  status: 'Approved' as const,
                  workDescription: freshWorkOrder.workCarriedOut || freshWorkOrder.briefWorkDescription || null,
                  sparesUsed: freshWorkOrder.consumedSpareParts ? JSON.stringify(freshWorkOrder.consumedSpareParts) : null,
                  remarks: missedCycles >= 1
                    ? `${missedCycles} cycles skipped — completed late${freshWorkOrder.remarks ? '. ' + freshWorkOrder.remarks : ''}`
                    : (freshWorkOrder.remarks || freshWorkOrder.jobExperienceNotes || 'Completed on time'),
                  isComponentReplaced: false,
                  missedCycles,
                  originalDueDate
                };

                await repo.createMaintenanceHistory(historyPayload);
                console.log(`✅ Created maintenance history for work order ${freshWorkOrder.id} (componentId: ${component.cuuid})`);
              }
            }
          }
        } catch (historyError) {
          console.error('Failed to create maintenance history record:', historyError);
        }

        // Update job cycle dates
        try {
          let job: any = null;

          if (freshWorkOrder.jobId) {
            job = await repo.findJob(freshWorkOrder.jobId);
          }

          // Fallback: Extract jobNo from work order number
          if (!job && freshWorkOrder.workOrderNo) {
            const woNumber = freshWorkOrder.workOrderNo;
            let extractedJobNo: string | null = null;

            const newFormatMatch = woNumber.match(/^(.+?)-\d+\.\d+.*-\d{4}-\d+$/);
            if (newFormatMatch) extractedJobNo = newFormatMatch[1];

            if (!extractedJobNo) {
              const oldFormatMatch = woNumber.match(/^(.+)-\d{4}-\d+$/);
              if (oldFormatMatch) extractedJobNo = oldFormatMatch[1];
            }

            if (extractedJobNo && freshWorkOrder.vesselId) {
              const jobs = await repo.findJobs(freshWorkOrder.vesselId);
              job = jobs.find((j: any) => j.jobNo === extractedJobNo);
            }
          }

          if (job) {
            const rawJobCompletionDate = freshWorkOrder.completionDateTime || freshWorkOrder.dateCompleted || updateData.completionDateTime;
            // R1 (migration 139): next-cycle math derives from the stored WO
            // Completion RH; fallback to the stored reading = pre-feature
            // behaviour for historical/in-flight WOs. The raw reading is still
            // used for display/logging where it denotes the meter value.
            const runningHours = (freshWorkOrder as any).woCompletionRh ?? freshWorkOrder.runningHours;

            const normalizeJobDate = (dateStr: string | undefined | null): string | null => {
              if (!dateStr) return null;
              if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.split('T')[0];
              const match = dateStr.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})/);
              if (match) return `${match[3]}-${match[2]}-${match[1]}`;
              const parsed = new Date(dateStr);
              return !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : null;
            };

            const dateOfCompletionNorm = normalizeJobDate(rawJobCompletionDate);
            console.log(`📅 Using completion date for job update: ${dateOfCompletionNorm} (raw: ${rawJobCompletionDate})`);

            // Handle Calendar-based jobs
            if (freshWorkOrder.maintenanceBasis === 'Calendar' && dateOfCompletionNorm) {
              const { calculateNextDueDate } = await import('@shared/dateUtils');
              const calendarUpdates: any = { lastDoneDate: dateOfCompletionNorm };
              const linkUpdates: any = { lastDoneDate: dateOfCompletionNorm, updatedAt: new Date() };

              if (job.frequencyValue && job.frequencyUnit) {
                const nextDue = calculateNextDueDate(dateOfCompletionNorm, job.frequencyValue, job.frequencyUnit, freshWorkOrder.nextDueDate || freshWorkOrder.dueDate);
                if (nextDue) {
                  calendarUpdates.nextDueDate = nextDue;
                  linkUpdates.nextDueDate = nextDue;
                  console.log(`✅ Updated job ${job.jobNo} nextDueDate: ${nextDue}`);
                }
              }

              const updateVesselId = freshWorkOrder.vesselId || job.vesselId;
              if (component.cuuid && updateVesselId) {
                await repo.updateJobComponentLinkTracking(updateVesselId, job.juuid, component.cuuid, linkUpdates);
                console.log(`✅ Updated component-specific tracking for vessel ${updateVesselId}, job ${job.jobNo} + component ${component.cuuid} with lastDoneDate: ${dateOfCompletionNorm}`);
              }

              await repo.updateJob(job.juuid, calendarUpdates);
            }

            // Handle Running Hours-based jobs
            if (freshWorkOrder.maintenanceBasis === 'Running Hours' && runningHours) {
              const currentRH = parseInt(runningHours);
              if (!isNaN(currentRH)) {
                const rhUpdates: any = { lastDoneRH: currentRH };
                const rhLinkUpdates: any = { lastDoneRH: currentRH.toString(), updatedAt: new Date() };
                const rhInterval = job.intervalRunningHour || (job.frequencyValue ? parseInt(job.frequencyValue) : null);
                if (rhInterval && !isNaN(rhInterval)) {
                  rhUpdates.nextDueRH = currentRH + rhInterval;
                  rhLinkUpdates.nextDueRH = (currentRH + rhInterval).toString();
                  console.log(`✅ Updated job ${job.jobNo} nextDueRH: ${rhUpdates.nextDueRH}`);
                }

                const rhUpdateVesselId = freshWorkOrder.vesselId || job.vesselId;
                if (component.cuuid && rhUpdateVesselId) {
                  await repo.updateJobComponentLinkTracking(rhUpdateVesselId, job.juuid, component.cuuid, rhLinkUpdates);
                  console.log(`✅ Updated component-specific RH tracking for vessel ${rhUpdateVesselId}, job ${job.jobNo} + component ${component.cuuid} with lastDoneRH: ${currentRH}`);
                }

                await repo.updateJob(job.juuid, rhUpdates);

                // Layer 7 ISOLATION: Work orders NEVER write back to the RH Module
                // Only create a read-only audit trail entry as a snapshot
                console.log(`📋 [Layer 7] RH snapshot ${currentRH} recorded for WO ${freshWorkOrder.workOrderNo || freshWorkOrder.id}. Component RH NOT modified (isolation).`);
              }
            }

            // Handle Dual Frequency jobs — Calendar ALWAYS, RH only if RH entered (D2)
            if (freshWorkOrder.maintenanceBasis === 'Dual Frequency' && dateOfCompletionNorm) {
              const { calculateNextDueDate } = await import('@shared/dateUtils');
              const dualUpdates: any = { lastDoneDate: dateOfCompletionNorm };
              const dualLinkUpdates: any = { lastDoneDate: dateOfCompletionNorm, updatedAt: new Date() };

              // Calendar leg: ALWAYS update
              if (job.frequencyValue && job.frequencyUnit) {
                const nextDue = calculateNextDueDate(dateOfCompletionNorm, job.frequencyValue, job.frequencyUnit, freshWorkOrder.nextDueDate || freshWorkOrder.dueDate);
                if (nextDue) {
                  dualUpdates.nextDueDate = nextDue;
                  dualLinkUpdates.nextDueDate = nextDue;
                  console.log(`✅ [Dual] Updated job ${job.jobNo} nextDueDate: ${nextDue}`);
                }
              }

              // RH leg: ONLY if runningHours entered (D2: if not entered, RH leg UNCHANGED)
              if (runningHours) {
                const dualCurrentRH = parseInt(runningHours);
                if (!isNaN(dualCurrentRH)) {
                  dualUpdates.lastDoneRH = dualCurrentRH;
                  dualLinkUpdates.lastDoneRH = dualCurrentRH.toString();

                  const dualRhInterval = job.intervalRunningHour || (job.frequencyValue ? parseInt(job.frequencyValue) : null);
                  if (dualRhInterval && !isNaN(dualRhInterval)) {
                    dualUpdates.nextDueRH = dualCurrentRH + dualRhInterval;
                    dualLinkUpdates.nextDueRH = (dualCurrentRH + dualRhInterval).toString();
                    console.log(`✅ [Dual] Updated job ${job.jobNo} nextDueRH: ${dualUpdates.nextDueRH}`);
                  }
                }
              } else {
                console.log(`ℹ️ [Dual] No RH entered for job ${job.jobNo} — RH leg stays unchanged (D2)`);
              }

              const dualUpdateVesselId = freshWorkOrder.vesselId || job.vesselId;
              if (component.cuuid && dualUpdateVesselId) {
                await repo.updateJobComponentLinkTracking(dualUpdateVesselId, job.juuid, component.cuuid, dualLinkUpdates);
                console.log(`✅ [Dual] Updated component tracking for vessel ${dualUpdateVesselId}, job ${job.jobNo} + component ${component.cuuid}`);
              }

              await repo.updateJob(job.juuid, dualUpdates);
              console.log(`✅ [Dual] Updated job ${job.jobNo} with lastDoneDate: ${dateOfCompletionNorm}${runningHours ? ', lastDoneRH: ' + runningHours : ' (RH unchanged)'}`);
            }
          }
        } catch (jobError) {
          console.error('Failed to update job cycle dates:', jobError);
        }
      } else {
        console.warn(`⚠️ Could not find component for work order ${freshWorkOrder.id}`);
      }
    }
  }

  // ========== EVENT-DRIVEN NEXT-CYCLE GENERATION ON APPROVAL (Issue 03) ==========
  // Domain-confirmed (Jeevan): the next WO must appear immediately once the
  // completion is approved, provided it falls within the generate window. The
  // job-tracking update above has just rolled lastDone/nextDue, so a
  // vessel-scoped scan now creates the next cycle without waiting for the daily
  // ship scan (mirrors the RH-entry hook in runningHoursService).
  // SHIP-ONLY: the L2-reviewer flow approves OFFICE-side — an ungated hook
  // there would generate the same cycle on both instances with different
  // wouuids (duplicate WOs across sync). Office-approved WOs get their next
  // cycle at the ship's next daily scan after the approval syncs down.
  // Fire-and-forget: a scan failure must never fail or slow the approval; the
  // scanner's job-level/cycle guards prevent same-instance duplicates, and the
  // daily scan remains the backstop if a concurrent run skips this one.
  if (updateData.approvalAction === 'approved' && updateData.status === 'Completed' && workOrder.vesselId) {
    try {
      const { isShipInstance } = await import('../../sync/syncRole');
      if (await isShipInstance()) {
        const { jobDueScanner } = await import('../../../services/jobDueScanner');
        console.log(`[NextCycleHook] Completion approved for WO ${workOrder.workOrderNo || id} — triggering vessel-scoped generation scan (${workOrder.vesselId})`);
        jobDueScanner.runScan(workOrder.vesselId).catch((err: any) => {
          console.error('[NextCycleHook] post-approval generation scan failed (non-blocking):', err?.message || err);
        });
      }
    } catch (hookErr: any) {
      console.error('[NextCycleHook] could not start post-approval generation scan (non-blocking):', hookErr?.message || hookErr);
    }
  }

  // ========== SPARE CONSUMPTION ON APPROVAL ==========
  if (updateData.approvalAction === 'approved' && updateData.status === 'Completed') {
    const freshWO = await repo.findById(id);
    const woForSpares = freshWO || workOrder;

    const approvalConsumedSpares = ensureArray(woForSpares?.consumedSpareParts);
    if (approvalConsumedSpares.length > 0) {
      const consumedSpares = approvalConsumedSpares as Array<{
        partNo: string;
        partCode?: string;
        description?: string;
        quantityConsumed: number | string;
        locationId?: number | null;
        location?: string;
        locationName?: string;
        comments?: string;
        _deductedQty?: number;
      }>;

      console.log(`🔧 [PATCH Approval] Processing ${consumedSpares.length} consumed spares for WO ${woForSpares.workOrderNo}`);

      for (const consumedSpare of consumedSpares) {
        const qtyConsumed = typeof consumedSpare.quantityConsumed === 'string'
          ? parseFloat(consumedSpare.quantityConsumed)
          : consumedSpare.quantityConsumed;

        const alreadyDeducted = consumedSpare._deductedQty || 0;
        const remainingToDeduct = (qtyConsumed || 0) - alreadyDeducted;

        console.log(`🔍 [PATCH Approval] Spare ${consumedSpare.partCode || consumedSpare.partNo}: qtyConsumed=${qtyConsumed}, _deductedQty=${alreadyDeducted}, remainingToDeduct=${remainingToDeduct}`);

        if (remainingToDeduct <= 0) {
          console.log(`⏭️ [PATCH Approval] Skipping ${consumedSpare.partCode || consumedSpare.partNo} - already deducted ${alreadyDeducted} units at save time`);
          continue;
        }

        if (remainingToDeduct > 0) {
          try {
            const woVesselId = woForSpares.vesselId || 'V001';
            const allSpares = await repo.findSpares(woVesselId);

            let spare: any = null;

            if (consumedSpare.partCode) {
              spare = allSpares.find((s: any) => s.partCode === consumedSpare.partCode);
            }
            if (!spare && consumedSpare.partNo) {
              spare = allSpares.find((s: any) => s.partCode === consumedSpare.partNo);
            }
            if (!spare && consumedSpare.partNo) {
              spare = allSpares.find((s: any) => s.partNumber === consumedSpare.partNo);
            }

            if (spare) {
              let resolvedLocationId = consumedSpare.locationId ? parseInt(String(consumedSpare.locationId)) : null;

              const locationNameFallback = consumedSpare.location || consumedSpare.locationName;
              if ((!resolvedLocationId || isNaN(resolvedLocationId as number)) && locationNameFallback) {
                const locationObj = await repo.findOrCreateLocation(woVesselId, locationNameFallback, woForSpares.approver || 'system');
                if (locationObj) {
                  resolvedLocationId = locationObj.id;
                  console.log(`📍 [PATCH Approval] Resolved location name "${locationNameFallback}" to ID ${resolvedLocationId}`);
                }
              }

              if (resolvedLocationId && !isNaN(resolvedLocationId as number)) {
                let currentStock = await repo.getSpareLocationStockItem(spare.id, resolvedLocationId);
                
                if (!currentStock) {
                  console.log(`⚠️ [PATCH Approval] No spare_location_stock record for spare ${spare.id} at location ${resolvedLocationId}. Attempting auto-sync from legacy ROB fields...`);
                  const locationObj = await repo.getLocationById(resolvedLocationId);
                  if (locationObj && spare) {
                    const locName = (locationObj.locationName || '').toLowerCase().trim();
                    const spareLegacyLocA = (spare.location || '').toLowerCase().trim();
                    const spareLegacyLocB = (spare.location2 || '').toLowerCase().trim();
                    
                    let seedQty: number | null = null;
                    if (spareLegacyLocA && locName === spareLegacyLocA) {
                      seedQty = spare.robLocationA ?? 0;
                    } else if (spareLegacyLocB && locName === spareLegacyLocB) {
                      seedQty = spare.robLocationB ?? 0;
                    } else if (spareLegacyLocA && !spareLegacyLocB) {
                      seedQty = spare.robLocationA ?? 0;
                    } else if (!spareLegacyLocA && spareLegacyLocB) {
                      seedQty = spare.robLocationB ?? 0;
                    } else if (!spareLegacyLocA && !spareLegacyLocB) {
                      seedQty = spare.rob ?? 0;
                    }
                    
                    if (seedQty !== null) {
                      console.log(`🔄 [PATCH Approval] AUTO-SYNC: Seeding spare_location_stock for spare ${spare.id} at location ${resolvedLocationId} with legacy ROB: ${seedQty}`);
                      await repo.upsertSpareLocationStock({
                        vesselId: woVesselId,
                        spareId: spare.id,
                        spareUuid: spare.suuid,
                        locationId: resolvedLocationId,
                        qty: seedQty,
                      });
                      currentStock = await repo.getSpareLocationStockItem(spare.id, resolvedLocationId);
                    }
                  }
                }
                
                const currentQty = currentStock?.qty ?? 0;
                console.log(`📊 [PATCH Approval] Current stock for spare ${spare.id} at location ${resolvedLocationId}: ${currentQty}`);

                const existingTxns = await repo.getInventoryTransactions(woVesselId, {
                  spareId: spare.id,
                  locationId: resolvedLocationId,
                  eventType: 'CONSUME',
                });
                const woRefId = woForSpares.wouuid;
                const priorDeductions = existingTxns.filter((t: any) => t.referenceId === woRefId);
                const priorDeductedTotal = priorDeductions.reduce((sum: number, t: any) => sum + Math.abs(t.qtyChange || 0), 0);

                console.log(`📊 [PATCH Approval] Prior WO transactions for ${consumedSpare.partCode || consumedSpare.partNo}: ${priorDeductions.length} txn(s), total deducted: ${priorDeductedTotal}, needed: ${qtyConsumed}`);

                const effectiveAlreadyDeducted = Math.max(alreadyDeducted, priorDeductedTotal);
                const effectiveRemaining = (qtyConsumed || 0) - effectiveAlreadyDeducted;

                if (effectiveRemaining <= 0) {
                  console.log(`⏭️ [PATCH Approval] Skipping ${consumedSpare.partCode || consumedSpare.partNo} - already fully deducted (${effectiveAlreadyDeducted} units via ${alreadyDeducted > 0 ? '_deductedQty' : 'prior transactions'})`);
                  continue;
                }

                try {
                  await repo.performInventoryTransaction({
                    vesselId: woVesselId,
                    spareId: spare.id,
                    locationId: resolvedLocationId,
                    eventType: 'CONSUME',
                    qtyChange: -Math.abs(effectiveRemaining),
                    referenceType: 'WORK_ORDER',
                    referenceId: woForSpares.wouuid,
                    referenceNote: `WO Approval: ${woForSpares.workOrderNo} - ${consumedSpare.comments || 'Consumed during work approval'}`,
                    userId: woForSpares.approver || 'system'
                  });
                  console.log(`✅ [PATCH Approval] Consumed ${effectiveRemaining} units of ${consumedSpare.partCode || consumedSpare.partNo} from location ${resolvedLocationId} (WO: ${woForSpares.workOrderNo})${effectiveAlreadyDeducted > 0 ? ` (${effectiveAlreadyDeducted} already deducted)` : ''}`);
                } catch (txnError: any) {
                  if (txnError.message?.includes('INSUFFICIENT_STOCK') || txnError.message?.includes('NEGATIVE_STOCK_PREVENTED')) {
                    throw new Error(`INSUFFICIENT_STOCK: Cannot consume ${effectiveRemaining} units of ${consumedSpare.partCode || consumedSpare.partNo}. Current stock at location ${resolvedLocationId}: ${currentQty}. Already deducted (_deductedQty: ${alreadyDeducted}, prior txns: ${priorDeductedTotal}). ${txnError.message}`);
                  } else {
                    console.error(`❌ [PATCH Approval] Transaction error for ${consumedSpare.partCode || consumedSpare.partNo}:`, txnError);
                    throw txnError;
                  }
                }
              } else {
                const errorMsg = `LOCATION_REQUIRED: Spare part ${consumedSpare.partCode || consumedSpare.partNo} requires a storage location for inventory tracking. Please select a location in the work order form.`;
                console.error(`❌ [PATCH Approval] ${errorMsg}`);
                throw new Error(errorMsg);
              }
            } else {
              const errorMsg = `SPARE_NOT_FOUND: Spare part ${consumedSpare.partCode || consumedSpare.partNo} was not found in inventory. Searched: partCode="${consumedSpare.partCode}", partNo="${consumedSpare.partNo}". Please verify the spare exists in the inventory.`;
              console.error(`❌ [PATCH Approval] ${errorMsg}`);
              throw new Error(errorMsg);
            }
          } catch (spareError: any) {
            if (spareError.message?.includes('LOCATION_REQUIRED') ||
                spareError.message?.includes('SPARE_NOT_FOUND') ||
                spareError.message?.includes('INSUFFICIENT_STOCK') ||
                spareError.message?.includes('NEGATIVE_STOCK_PREVENTED')) {
              throw spareError;
            }
            console.error(`❌ [PATCH Approval] Failed to process spare ${consumedSpare.partCode || consumedSpare.partNo}:`, spareError);
          }
        }
      }
    }
  }
  // ========== END SPARE CONSUMPTION ON APPROVAL ==========

  invalidateComplianceCache();

  return {
    workOrder,
    rhBackdated: rhBackdatedApproval,
    latestRH: latestRHApproval,
    latestRHDate: latestRHDateApproval
  };
}

// ── Delete Work Order ──

export async function deleteWorkOrder(id: string) {
  // Fetch before delete for sync logging
  const existingWO = await repo.findById(id);
  await repo.remove(id);
  // Sync field logging — log DELETE as soft-delete marker
  if (existingWO) {
    try {
      await logFieldChanges('work_orders', existingWO.wouuid, existingWO.vesselId || null, { is_deleted: false }, { is_deleted: true }, 'system');
    } catch (err) { console.error('[FieldLogger] WO delete:', err); }
  }
}

// ── Save Overdue Reason ──

export async function saveOverdueReason(id: string, overdueReason: string, overdueReasonDetails: string | null) {
  const workOrder = await repo.findById(id);
  if (!workOrder) {
    throw new NotFoundError('Work order not found');
  }

  const updated = await repo.update(id, { overdueReason, overdueReasonDetails });
  // Sync field logging
  try {
    await logFieldChanges('work_orders', workOrder.wouuid, workOrder.vesselId || null, workOrder, updated, 'system');
  } catch (err) { console.error('[FieldLogger] WO overdueReason:', err); }
  return updated;
}

function filterWorkOrdersByRankId(
  workOrders: any[],
  scopeRankIds: Set<string>,
  scopeRankNames?: Set<string>
): any[] {
  return workOrders.filter((wo: any) => {
    const rankId = wo.assignedToRankId;
    if (rankId && scopeRankIds.has(rankId)) return true;
    // Fallback: match by rank-name text so a row whose rank-id column is
    // still null is not silently excluded from the dashboard's scoped counts.
    if (scopeRankNames && wo.assignedTo) {
      const key = String(wo.assignedTo).toLowerCase().trim();
      if (key && key !== 'unassigned' && scopeRankNames.has(key)) return true;
    }
    return false;
  });
}

async function buildScopeRankNameSet(rankIds: string[]): Promise<Set<string>> {
  if (!rankIds.length) return new Set();
  const { getAllRanks } = await import('../../ranks/service');
  const allRanks = await getAllRanks();
  const idSet = new Set(rankIds);
  const names = new Set<string>();
  for (const r of allRanks as any[]) {
    if (!idSet.has(r.rankId)) continue;
    if (r.name) names.add(String(r.name).toLowerCase().trim());
    if (r.label) names.add(String(r.label).toLowerCase().trim());
  }
  return names;
}

function hasVesselWideAccess(
  userRole: string | undefined,
  userVesselId: string | undefined,
  targetVesselId: string
): boolean {
  if (!userRole) return false;
  const fleetWideRoles = ['PMS Admin', 'Sail Admin', 'Office'];
  if (fleetWideRoles.includes(userRole)) return true;
  if (userRole === 'Ship' && userVesselId === targetVesselId) return true;
  return false;
}

export async function getScopedOperationData(
  vesselId: string,
  userRankId: string | undefined,
  mode: 'me' | 'myTeam',
  userRole?: string,
  userVesselId?: string,
  userRankName?: string
) {
  const vesselWideAccessGranted = hasVesselWideAccess(userRole, userVesselId, vesselId);

  if (!userRankName) {
    return {
      workOrders: [],
      scopeMeta: {
        hasMapping: false,
        hasDescendants: false,
        mode,
        appliedRankIds: [] as string[],
        vesselWideAccessGranted,
        fallbackMode: vesselWideAccessGranted ? 'vessel-wide' as const : 'none' as const,
      },
    };
  }

  const { resolveHierarchyScopeByRankName } = await import('../../ranks/service');

  const scope = await resolveHierarchyScopeByRankName(vesselId, userRankName);

  if (!scope.hasMapping) {
    const allWOs = await listWorkOrders(vesselId);

    const isShipRole = userRole === 'Ship';

    // For "Me" mode, always restrict to the user's own rank — even when the
    // user has vessel-wide access. Vessel-wide fallback only applies to
    // "My Team" mode when no hierarchy mapping is configured.
    if (mode === 'me' || !vesselWideAccessGranted || isShipRole) {
      const ownRankIds: string[] = userRankId ? [userRankId] : [];
      const ownRankSet = new Set<string>(ownRankIds);
      const ownRankNameSet = new Set<string>();
      if (userRankName) ownRankNameSet.add(userRankName.toLowerCase().trim());
      const ownRankWOs = filterWorkOrdersByRankId(allWOs, ownRankSet, ownRankNameSet);
      return {
        workOrders: ownRankWOs,
        scopeMeta: {
          hasMapping: false,
          hasDescendants: false,
          mode,
          appliedRankIds: ownRankIds,
          vesselWideAccessGranted,
          fallbackMode: 'own-rank' as const,
        },
      };
    }

    return {
      workOrders: allWOs,
      scopeMeta: {
        hasMapping: false,
        hasDescendants: false,
        mode,
        appliedRankIds: [] as string[],
        vesselWideAccessGranted,
        fallbackMode: 'vessel-wide' as const,
      },
    };
  }

  const bucket = mode === 'me' ? scope.me : scope.myTeam;
  const scopeRankIdSet = new Set(bucket.rankIds);
  const scopeRankNameSet = await buildScopeRankNameSet(bucket.rankIds);

  const allWOs = await listWorkOrders(vesselId);
  const filteredWOs = filterWorkOrdersByRankId(allWOs, scopeRankIdSet, scopeRankNameSet);

  return {
    workOrders: filteredWOs,
    scopeMeta: {
      hasMapping: true,
      hasDescendants: scope.hasDescendants,
      mode,
      appliedRankIds: bucket.rankIds,
      vesselWideAccessGranted,
      fallbackMode: null,
    },
  };
}

// ── Superintendent Completion Rejection ──

/**
 * Reject a Completed work order from the Office/Superintendent side.
 *
 * - Status transitions: Completed → Rejected (completion data preserved)
 * - Remarks stored in superintendentRejectionRemarks
 * - Sibling WOs (same jobId, same vessel, Active/Due/Overdue, dueDate > rejected WO dueDate) are soft-deleted
 * - Job's nextDueDate is reset to the rejected WO's dueDate so the cycle restarts
 * - Sync field changes and audit log are emitted
 */
export async function rejectCompletedWorkOrder(
  id: string,
  remarks: string,
  actorUserUuid: string,
  actorName?: string
) {
  // 1. Resolve WO
  let existingWO = await repo.findById(id);
  if (!existingWO) existingWO = await repo.findByCode(id);
  if (!existingWO) throw new NotFoundError('Work order not found');

  // 2. Guard: only Completed WOs may be rejected via this path
  if (existingWO.status !== 'Completed') {
    throw new ValidationError(
      `Only Completed work orders can be rejected by the superintendent. Current status: ${existingWO.status}`
    );
  }

  // 2b. Guard: remarks are mandatory
  if (!remarks || !remarks.trim()) {
    throw new ValidationError('Superintendent rejection remarks are mandatory.');
  }

  const rejectedAt = new Date().toISOString();

  // 3. Update the WO — status → Rejected, wasRejected → true; all completion data preserved
  const updatePayload: any = {
    status: 'Rejected',
    wasRejected: true,
    superintendentRejectionRemarks: remarks.trim(),
    superintendentRejectedByName: actorName || actorUserUuid,
    rejectionDate: rejectedAt,
  };
  const updatedWO = await repo.update(id, updatePayload);

  // 4. Sync field-level change log — not wrapped: failures must surface for sync reliability
  await logFieldChanges(
    'work_orders',
    existingWO.wouuid,
    existingWO.vesselId || null,
    existingWO,
    updatedWO,
    actorUserUuid
  );

  // 5. Audit log entry — distinct type for superintendent completion rejection
  try {
    await repo.createAuditLog({
      entityType: 'work_order',
      entityId: existingWO.wouuid || id,
      actionType: 'superintendent_reject_completion',
      userId: actorUserUuid,
      source: 'web_ui',
      vesselCode: existingWO.vesselId || null,
      componentCode: existingWO.componentCode || null,
      fieldName: null,
      oldValue: null,
      newValue: null,
      payload: {
        workOrderNo: existingWO.workOrderNo,
        rejectedAt,
        rejectedByName: actorName || actorUserUuid,
        rejectionRemarks: remarks.trim(),
        rejectionType: 'superintendent_completion_rejection',
      },
    });
  } catch (err) {
    console.error('[AuditLog] Completed WO rejection:', err);
  }

  // 6. Cancel next-cycle sibling WOs:
  //    - Same jobId + vesselId
  //    - Status in: Active, Planned, Due, Due (Grace P), Overdue
  //    - Not already deleted
  //    - dueDate or nextDueDate is after the rejected WO's completionDateTime (or dueDate as fallback)
  if (existingWO.jobId && existingWO.vesselId) {
    try {
      const siblings = await repo.findWorkOrdersByJobId(existingWO.jobId);
      // Use completionDateTime as the reference point; fall back to dueDate
      const referenceDate = (existingWO as any).completionDateTime || existingWO.dueDate || '';
      const openStatuses = new Set(['Active', 'Planned', 'Due', 'Due (Grace P)', 'Overdue']);
      const toCancel = siblings.filter((wo: any) =>
        wo.id !== existingWO!.id &&
        wo.vesselId === existingWO!.vesselId &&
        openStatuses.has(wo.status) &&
        !wo.isDeleted &&
        referenceDate &&
        (
          (wo.dueDate && wo.dueDate > referenceDate) ||
          (wo.nextDueDate && wo.nextDueDate > referenceDate)
        )
      );
      for (const sibling of toCancel) {
        const cancelled = await repo.update(sibling.id, { isDeleted: true, isActive: false });
        try {
          await logFieldChanges(
            'work_orders',
            sibling.wouuid,
            sibling.vesselId || null,
            sibling,
            cancelled,
            actorUserUuid
          );
        } catch (err) {
          console.error('[FieldLogger] Sibling WO cancellation:', err);
        }
        console.log(`🗑️ [Rejection] Cancelled next-cycle sibling WO: ${sibling.workOrderNo}`);
      }
    } catch (err) {
      console.error('[Rejection] Error cancelling sibling WOs:', err);
    }
  }

  // 7. Reset job's nextDueDate to the rejected WO's dueDate so the cycle regenerates from the right point
  if (existingWO.jobId && existingWO.dueDate) {
    try {
      const db = await getDb();
      await db
        .update(jobs)
        .set({ nextDueDate: existingWO.dueDate })
        .where(eq(jobs.juuid, existingWO.jobId));
      console.log(`📅 [Rejection] Reset job nextDueDate to ${existingWO.dueDate} for job ${existingWO.jobId}`);
    } catch (err) {
      console.error('[Rejection] Error resetting job nextDueDate:', err);
    }
  }

  return updatedWO;
}

// ── Superintendent Reopen Completed Work Order ──

// ── Postponement Approval Workflow (Plan B) ──

/**
 * Ship submits a new postponement request.
 * Sets WO status → "Awaiting Office Approval" and creates a postponements audit row.
 */
// ── Classify a WO for the postponement approval workflow ─────────────────────

async function classifyWoForPostponement(wo: any): Promise<{
  classification: 'criticalEquipment' | 'critical' | 'normal';
  level1Enabled: boolean;
  level2Enabled: boolean;
}> {
  // WOs with no linked job always fall into normal — no config lookup needed
  if (!wo.jobId) {
    return { classification: 'normal', level1Enabled: false, level2Enabled: false };
  }

  let classification: 'criticalEquipment' | 'critical' | 'normal' = 'normal';

  const job = await repo.findJob(wo.jobId);
  if (job) {
    let isOnCriticalEquipment = false;
    if ((job as any).componentId) {
      const comp = await repo.findComponent((job as any).componentId);
      isOnCriticalEquipment = (comp as any)?.critical === true;
    }
    if (isOnCriticalEquipment) {
      classification = 'criticalEquipment';
    } else if ((job as any).criticality === 'Yes') {
      classification = 'critical';
    }
  }

  const variableNameMap: Record<'criticalEquipment' | 'critical' | 'normal', string> = {
    criticalEquipment: 'Critical Equipment WO',
    critical: 'Critical WO',
    normal: 'Normal WO',
  };

  const allConfigs = await storage.getApprovalWorkflowConfig();
  const config = allConfigs.find(
    (c: any) => c.functionId === 'pms-wo-postponement' && c.variableName === variableNameMap[classification] && !c.isDeleted
  );

  return {
    classification,
    level1Enabled: config?.level1Enabled ?? false,
    level2Enabled: config?.level2Enabled ?? false,
  };
}

export async function submitPostponeRequest(id: string, body: any) {
  let wo = await repo.findById(id);
  if (!wo) wo = await repo.findByCode(id);
  if (!wo) throw new NotFoundError('Work order not found');

  const today = new Date().toISOString().split('T')[0];

  // Update the work order
  const updatedWO = await repo.update(id, {
    status: 'Awaiting Office Approval',
    postponeRequestedDate: body.nextDueDate || body.postponeDate,
    postponementReason: body.reason || body.postponementReason,
    postponementRemarks: body.postponementRemarks,
    postponeApprover: body.approver || 'Office',
    // Clear any previous approval decision fields
    postponementApprovalDate: null,
    postponementApprovalRemarks: null,
  });

  // Sync field logging — log the work_orders UPDATE so the postpone request reaches
  // the office (status → 'Awaiting Office Approval' + postpone columns). storage.updateWorkOrder
  // does NOT field-log; the work_order_postponements INSERT below is logged in the storage layer.
  try {
    await logFieldChanges('work_orders', wo.wouuid, wo.vesselId || null, wo, updatedWO, body.userId || body.performedBy || 'system');
  } catch (err) { console.error('[FieldLogger] WO postpone-request:', err); }

  // Classify the WO and build the approval workflow snapshot
  const classification = await classifyWoForPostponement(wo);
  const approvalWorkflowSnapshot = {
    woClassification: classification.classification,
    level1Enabled: classification.level1Enabled,
    level2Enabled: classification.level2Enabled,
  };

  // Create a new postponement audit row (with snapshot)
  const prevMax = await repo.getMaxPostponementNumber(wo.wouuid);
  const postponementId = crypto.randomUUID();
  await repo.createPostponement({
    id: postponementId,
    workOrderId: wo.wouuid,
    vesselId: wo.vesselId!,
    postponementNumber: prevMax + 1,
    originalDueDate: wo.originalDueDate || wo.dueDate,
    newDueDate: body.nextDueDate || body.postponeDate,
    postponementReason: body.reason || body.postponementReason,
    postponementRemarks: body.postponementRemarks,
    approver: body.approver || 'Office',
    postponeDate: body.postponeDate,
    durationDays: body.duration ? parseInt(String(body.duration), 10) : null,
    submittedDate: today,
    status: 'Awaiting Approval',
    informOffice: true,
    approvalWorkflowSnapshot,
  });

  // Create level approval step rows
  if (classification.level1Enabled) {
    await repo.createWoPostponementApprovalStep({
      postponementId,
      workOrderId: wo.wouuid,
      approvalLevel: 'Level 1',
      status: 'Pending',
    });
  }
  if (classification.level2Enabled) {
    await repo.createWoPostponementApprovalStep({
      postponementId,
      workOrderId: wo.wouuid,
      approvalLevel: 'Level 2',
      status: 'Pending',
    });
  }

  return updatedWO;
}

/**
 * Ship edits and resubmits an existing postponement request.
 * Resets status to "Awaiting Office Approval" and inserts a NEW audit row
 * with an incremented postponementNumber — prior rows are never modified.
 */
export async function editPostponeRequest(id: string, body: any) {
  // Reuse the same logic as submitPostponeRequest (always creates a new audit row)
  return submitPostponeRequest(id, body);
}

/**
 * Office approves a postponement request.
 * Gates on multi-level approval steps if configured; finalises when all levels are satisfied.
 */
export async function approvePostponement(id: string, body: any) {
  let wo = await repo.findById(id);
  if (!wo) wo = await repo.findByCode(id);
  if (!wo) throw new NotFoundError('Work order not found');

  if (wo.status !== 'Awaiting Office Approval') {
    throw new ValidationError(
      `Only work orders with status "Awaiting Office Approval" can be approved. Current status: ${wo.status}`
    );
  }

  // ── Multi-level approval gate ────────────────────────────────────────────
  const awaitingPostponement = await repo.getLatestAwaitingPostponement(wo.wouuid);
  if (awaitingPostponement) {
    const steps = await repo.getWoPostponementApprovalSteps(awaitingPostponement.id);
    if (steps.length > 0) {
      const now = new Date();
      const activeStep = steps.find((s: any) => s.status === 'Pending');
      if (!activeStep) {
        throw new ValidationError('No pending approval step found — this request may have already been fully approved');
      }

      const isSailAdmin = body.sessionRole === 'Sail Admin' || body.role === 'Sail Admin';
      if (!isSailAdmin) {
        const reviewerId = body.userUuid || body.approvedBy;
        const isAuthorised = await repo.verifyApproverForLevel(reviewerId, activeStep.approvalLevel);
        if (!isAuthorised) {
          throw new ValidationError(`Not authorised to approve at ${activeStep.approvalLevel}`);
        }
      }

      const remaining = steps.filter((s: any) => s.id !== activeStep.id && s.status === 'Pending');
      await repo.updateWoPostponementApprovalStep(activeStep.id, {
        status: 'Approved',
        actionByUserId: body.approvedBy,
        actionAt: now,
        remarks: body.approvalRemarks || null,
      });

      if (remaining.length > 0) {
        console.log(`[WO_POSTPONE_WORKFLOW] WO ${wo.wouuid} — ${activeStep.approvalLevel} approved; awaiting ${remaining.length} more level(s)`);
        return (await repo.findById(id)) || wo;
      }
      console.log(`[WO_POSTPONE_WORKFLOW] WO ${wo.wouuid} — all approval levels satisfied, finalising`);
    }
  }
  // ── End gate — fall through to finalisation ──────────────────────────────

  const today = new Date().toISOString().split('T')[0];
  const newDueDate = wo.postponeRequestedDate || body.newDueDate;

  const updatedWO = await repo.update(id, {
    status: 'Postponement Approved',
    dueDate: newDueDate,
    postponementEndDate: newDueDate,
    postponeApprover: body.approvedBy || 'Office',
    postponementApprovalDate: today,
    postponementApprovalRemarks: body.approvalRemarks || null,
  });

  // Sync field logging — log the work_orders UPDATE so the office's approval reaches the vessel.
  try {
    await logFieldChanges('work_orders', wo.wouuid, wo.vesselId || null, wo, updatedWO, body.approvedBy || body.userId || 'system');
  } catch (err) { console.error('[FieldLogger] WO postpone-approve:', err); }

  // Insert a new immutable decision audit row (approve)
  const existingRows = await repo.findPostponementsByWorkOrderId(wo.wouuid);
  const prevMaxApprove = existingRows?.length
    ? existingRows.reduce((a: any, b: any) =>
        (b.postponementNumber || 1) > (a.postponementNumber || 1) ? b : a
      ).postponementNumber || 1
    : 1;
  const latestApprove = existingRows?.length
    ? existingRows.reduce((a: any, b: any) =>
        (b.postponementNumber || 1) > (a.postponementNumber || 1) ? b : a
      )
    : null;

  await repo.createPostponement({
    id: crypto.randomUUID(),
    workOrderId: wo.wouuid,
    vesselId: wo.vesselId!,
    postponementNumber: prevMaxApprove + 1,
    originalDueDate: latestApprove?.originalDueDate || wo.originalDueDate || wo.dueDate,
    newDueDate: newDueDate,
    postponementReason: latestApprove?.postponementReason || wo.postponementReason,
    postponementRemarks: latestApprove?.postponementRemarks || wo.postponementRemarks,
    authorizedBy: body.approvedBy || 'Office',
    approvedBy: body.approvedBy || 'Office',
    approvedDate: today,
    approvalRemarks: body.approvalRemarks || null,
    approver: body.approvedBy || 'Office',
    durationDays: latestApprove?.durationDays || null,
    submittedDate: today,
    status: 'Approved',
    informOffice: true,
  });

  return updatedWO;
}

/**
 * Office rejects a postponement request.
 * Records the rejection on the active approval step (if any), reverts WO status to Due/Overdue,
 * and inserts a NEW immutable decision row in work_order_postponements.
 */
export async function rejectPostponement(id: string, body: any) {
  let wo = await repo.findById(id);
  if (!wo) wo = await repo.findByCode(id);
  if (!wo) throw new NotFoundError('Work order not found');

  if (wo.status !== 'Awaiting Office Approval') {
    throw new ValidationError(
      `Only work orders with status "Awaiting Office Approval" can be rejected. Current status: ${wo.status}`
    );
  }

  // ── Mark the active approval step as Rejected (if steps exist) ──────────
  const awaitingPostponement = await repo.getLatestAwaitingPostponement(wo.wouuid);
  if (awaitingPostponement) {
    const steps = await repo.getWoPostponementApprovalSteps(awaitingPostponement.id);
    if (steps.length > 0) {
      const activeStep = steps.find((s: any) => s.status === 'Pending');
      if (activeStep) {
        const isSailAdmin = body.sessionRole === 'Sail Admin' || body.role === 'Sail Admin';
        if (!isSailAdmin) {
          const reviewerId = body.userUuid || body.approvedBy;
          const isAuthorised = await repo.verifyApproverForLevel(reviewerId, activeStep.approvalLevel);
          if (!isAuthorised) {
            throw new ValidationError(`Not authorised to reject at ${activeStep.approvalLevel}`);
          }
        }
        await repo.updateWoPostponementApprovalStep(activeStep.id, {
          status: 'Rejected',
          actionByUserId: body.approvedBy,
          actionAt: new Date(),
          remarks: body.approvalRemarks || null,
        });
      }
    }
  }
  // ── End step rejection — fall through to WO status revert ───────────────

  const today = new Date().toISOString().split('T')[0];

  // Compute revert status from the original due date
  const companyGraceRow = await storage.getCompanyStandardGraceSettings();
  const companyGraceConfig = buildCompanyGraceConfig(companyGraceRow);
  const vesselSettings = wo.vesselId ? await repo.findPmsVesselSettings(wo.vesselId) : null;
  const vesselGraceSettings = vesselSettings ? {
    calendarGraceMode: (vesselSettings.calendarGraceMode || 'COMPANY_STANDARD') as 'COMPANY_STANDARD' | 'CUSTOM_DAYS',
    calendarGraceDays: vesselSettings.calendarGraceDays ?? WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
    rhGraceHours: vesselSettings.rhGraceHours ?? WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
    rhLeadTimeHours: vesselSettings.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS,
  } : undefined;

  const revertDueDate = wo.originalDueDate || wo.dueDate;
  const revertedStatus = computeWorkOrderStatus({
    dueDate: revertDueDate,
    isExecution: wo.isExecution,
    status: 'Due', // force calendar path — let computeWorkOrderStatus decide
    maintenanceBasis: wo.maintenanceBasis || undefined,
    vesselGraceSettings,
    companyGraceConfig,
  });

  const updatedWO = await repo.update(id, {
    status: revertedStatus,
    postponeApprover: body.approvedBy || 'Office',
    postponementApprovalDate: today,
    postponementApprovalRemarks: body.approvalRemarks || null,
  });

  // Sync field logging — log the work_orders UPDATE so the office's rejection reaches the vessel.
  try {
    await logFieldChanges('work_orders', wo.wouuid, wo.vesselId || null, wo, updatedWO, body.approvedBy || body.userId || 'system');
  } catch (err) { console.error('[FieldLogger] WO postpone-reject:', err); }

  // Insert a new immutable decision audit row (reject)
  const rejectRows = await repo.findPostponementsByWorkOrderId(wo.wouuid);
  const prevMaxReject = rejectRows?.length
    ? rejectRows.reduce((a: any, b: any) =>
        (b.postponementNumber || 1) > (a.postponementNumber || 1) ? b : a
      ).postponementNumber || 1
    : 1;
  const latestReject = rejectRows?.length
    ? rejectRows.reduce((a: any, b: any) =>
        (b.postponementNumber || 1) > (a.postponementNumber || 1) ? b : a
      )
    : null;

  await repo.createPostponement({
    id: crypto.randomUUID(),
    workOrderId: wo.wouuid,
    vesselId: wo.vesselId!,
    postponementNumber: prevMaxReject + 1,
    originalDueDate: latestReject?.originalDueDate || wo.originalDueDate || wo.dueDate,
    newDueDate: latestReject?.newDueDate || wo.postponeRequestedDate,
    postponementReason: latestReject?.postponementReason || wo.postponementReason,
    postponementRemarks: latestReject?.postponementRemarks || wo.postponementRemarks,
    authorizedBy: body.approvedBy || 'Office',
    approvedBy: body.approvedBy || 'Office',
    approvedDate: today,
    approvalRemarks: body.approvalRemarks || null,
    approver: body.approvedBy || 'Office',
    durationDays: latestReject?.durationDays || null,
    submittedDate: today,
    status: 'Rejected',
    informOffice: true,
  });

  return updatedWO;
}

// ─────────────────────────────────────────────────────────────────────────────
// WO Re-Postponement
// Mirrors the base Postponement flow but uses pms-wo-re-postponement config,
// always reverts to 'Postponement Approved' on reject, and fails fast if the
// approval config has not yet arrived on this vessel via sync.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify a WO for Re-Postponement and look up the pms-wo-re-postponement
 * approval workflow config. Returns the classification and enabled levels.
 * Returns { level1Enabled: false, level2Enabled: false } for WOs without a
 * linked job (same behaviour as the base postponement classifier).
 *
 * Unlike the base classifier this function throws a ValidationError when the
 * config rows for pms-wo-re-postponement do not exist (they arrive via
 * ONE_WAY sync from shore after migration 150 runs). The caller must NOT
 * proceed if config is absent — a missing config produces a stuck WO that
 * cannot be approved or rejected through the normal UI.
 */
async function classifyWoForRePostponement(wo: any): Promise<{
  classification: 'criticalEquipment' | 'critical' | 'normal';
  level1Enabled: boolean;
  level2Enabled: boolean;
}> {
  // WOs with no linked job always fall into normal
  if (!wo.jobId) {
    // Still need to verify config exists even for normal WOs — fail fast if not
    const allConfigs = await storage.getApprovalWorkflowConfig();
    const cfg = allConfigs.find(
      (c: any) => c.functionId === 'pms-wo-re-postponement' && c.variableName === 'Normal WO' && !c.isDeleted
    );
    if (!cfg) {
      throw new ValidationError(
        'Re-Postponement approval configuration is not yet available on this vessel. ' +
        'Please sync and try again.'
      );
    }
    return { classification: 'normal', level1Enabled: cfg.level1Enabled ?? false, level2Enabled: cfg.level2Enabled ?? false };
  }

  let classification: 'criticalEquipment' | 'critical' | 'normal' = 'normal';

  const job = await repo.findJob(wo.jobId);
  if (job) {
    let isOnCriticalEquipment = false;
    if ((job as any).componentId) {
      const comp = await repo.findComponent((job as any).componentId);
      isOnCriticalEquipment = (comp as any)?.critical === true;
    }
    if (isOnCriticalEquipment) {
      classification = 'criticalEquipment';
    } else if ((job as any).criticality === 'Yes') {
      classification = 'critical';
    }
  }

  const variableNameMap: Record<'criticalEquipment' | 'critical' | 'normal', string> = {
    criticalEquipment: 'Critical Equipment WO',
    critical: 'Critical WO',
    normal: 'Normal WO',
  };

  const allConfigs = await storage.getApprovalWorkflowConfig();
  const config = allConfigs.find(
    (c: any) =>
      c.functionId === 'pms-wo-re-postponement' &&
      c.variableName === variableNameMap[classification] &&
      !c.isDeleted
  );

  if (!config) {
    throw new ValidationError(
      'Re-Postponement approval configuration is not yet available on this vessel. ' +
      'Please sync and try again.'
    );
  }

  return {
    classification,
    level1Enabled: config.level1Enabled ?? false,
    level2Enabled: config.level2Enabled ?? false,
  };
}

/**
 * Core logic for creating a re-postponement audit row and approval steps.
 * Shared by submit (new) and edit (resubmit) paths.
 *
 * @param wo           - Resolved work order record (pre-update)
 * @param body         - Request body
 * @param dueDateSnapshot - The due date to store as originalDueDate (pre-submission value)
 */
async function createRePostponementRecord(wo: any, body: any, dueDateSnapshot: string | null) {
  const today = new Date().toISOString().split('T')[0];

  const classification = await classifyWoForRePostponement(wo);
  const approvalWorkflowSnapshot = {
    woClassification: classification.classification,
    level1Enabled: classification.level1Enabled,
    level2Enabled: classification.level2Enabled,
  };

  // Update WO status to Awaiting Office Approval (idempotent on re-submit)
  const updatedWO = await repo.update(wo.wouuid, {
    status: 'Awaiting Office Approval',
    postponeRequestedDate: body.nextDueDate || body.postponeDate,
    postponementReason: body.reason || body.postponementReason,
    postponementRemarks: body.postponementRemarks,
    postponeApprover: body.approver || 'Office',
    postponementApprovalDate: null,
    postponementApprovalRemarks: null,
  });

  // Field-log the WO update so it reaches the office via sync
  try {
    await logFieldChanges('work_orders', wo.wouuid, wo.vesselId || null, wo, updatedWO, body.userId || body.performedBy || 'system');
  } catch (err) { console.error('[FieldLogger] WO re-postpone-request:', err); }

  // Create audit row — postponementNumber continues the same sequence across all types
  const prevMax = await repo.getMaxPostponementNumber(wo.wouuid);
  const postponementId = crypto.randomUUID();
  await repo.createPostponement({
    id: postponementId,
    workOrderId: wo.wouuid,
    vesselId: wo.vesselId!,
    postponementNumber: prevMax + 1,
    originalDueDate: dueDateSnapshot,   // snapshot: used by rejectRePostponement to restore date
    newDueDate: body.nextDueDate || body.postponeDate,
    postponementReason: body.reason || body.postponementReason,
    postponementRemarks: body.postponementRemarks,
    approver: body.approver || 'Office',
    postponeDate: body.postponeDate,
    durationDays: body.duration ? parseInt(String(body.duration), 10) : null,
    submittedDate: today,
    status: 'Awaiting Approval',
    informOffice: true,
    approvalWorkflowSnapshot,
    requestType: 'Re-Postponement',
  } as any);

  // Create level approval step rows
  if (classification.level1Enabled) {
    await repo.createWoPostponementApprovalStep({
      postponementId,
      workOrderId: wo.wouuid,
      approvalLevel: 'Level 1',
      status: 'Pending',
      requestType: 'Re-Postponement',
    } as any);
  }
  if (classification.level2Enabled) {
    await repo.createWoPostponementApprovalStep({
      postponementId,
      workOrderId: wo.wouuid,
      approvalLevel: 'Level 2',
      status: 'Pending',
      requestType: 'Re-Postponement',
    } as any);
  }

  return updatedWO;
}

/**
 * Ship submits a NEW Re-Postponement request.
 * Eligibility: WO status must be 'Postponement Approved'.
 * Snapshots wo.dueDate as originalDueDate for use by rejectRePostponement.
 */
export async function submitRePostponeRequest(id: string, body: any) {
  let wo = await repo.findById(id);
  if (!wo) wo = await repo.findByCode(id);
  if (!wo) throw new NotFoundError('Work order not found');

  if (wo.status !== 'Postponement Approved') {
    throw new ValidationError(
      `Only work orders with status "Postponement Approved" can submit a Re-Postponement. Current status: ${wo.status}`
    );
  }

  // Snapshot the current due date before the WO is updated — this is the date
  // that rejectRePostponement must restore if the request is rejected
  const dueDateSnapshot = wo.dueDate;

  return createRePostponementRecord(wo, body, dueDateSnapshot);
}

/**
 * Ship edits and resubmits a pending Re-Postponement request.
 * Eligibility: WO status must be 'Awaiting Office Approval' (a re-postponement
 * is in progress). Always creates a new audit row (same as base editPostponeRequest).
 *
 * The originalDueDate carried forward is sourced from the current pending
 * re-postponement record to preserve the pre-submission due date even across
 * multiple resubmits.
 */
export async function editRePostponeRequest(id: string, body: any) {
  let wo = await repo.findById(id);
  if (!wo) wo = await repo.findByCode(id);
  if (!wo) throw new NotFoundError('Work order not found');

  if (wo.status !== 'Awaiting Office Approval') {
    throw new ValidationError(
      `Only work orders with status "Awaiting Office Approval" can edit a Re-Postponement. Current status: ${wo.status}`
    );
  }

  // Recover the originalDueDate from the currently pending re-postponement record
  // so that on rejection the due date is always restored to the pre-submission value,
  // not to whatever the WO fields hold mid-flow.
  const pending = await repo.getLatestAwaitingPostponement(wo.wouuid);
  const dueDateSnapshot = pending?.originalDueDate ?? wo.dueDate;

  return createRePostponementRecord(wo, body, dueDateSnapshot);
}

/**
 * Office approves a Re-Postponement request.
 * Gates on multi-level approval steps if configured; finalises when all levels
 * are satisfied. Final WO status is always 'Postponement Approved'.
 */
export async function approveRePostponement(id: string, body: any) {
  let wo = await repo.findById(id);
  if (!wo) wo = await repo.findByCode(id);
  if (!wo) throw new NotFoundError('Work order not found');

  if (wo.status !== 'Awaiting Office Approval') {
    throw new ValidationError(
      `Only work orders with status "Awaiting Office Approval" can be approved. Current status: ${wo.status}`
    );
  }

  // ── Multi-level approval gate ────────────────────────────────────────────
  const awaitingPostponement = await repo.getLatestAwaitingPostponement(wo.wouuid);
  if (awaitingPostponement) {
    const steps = await repo.getWoPostponementApprovalSteps(awaitingPostponement.id);
    if (steps.length > 0) {
      const now = new Date();
      const activeStep = steps.find((s: any) => s.status === 'Pending');
      if (!activeStep) {
        throw new ValidationError('No pending approval step found — this request may have already been fully approved');
      }

      const isSailAdmin = body.sessionRole === 'Sail Admin' || body.role === 'Sail Admin';
      if (!isSailAdmin) {
        const reviewerId = body.userUuid || body.approvedBy;
        const isAuthorised = await repo.verifyApproverForLevel(reviewerId, activeStep.approvalLevel);
        if (!isAuthorised) {
          throw new ValidationError(`Not authorised to approve at ${activeStep.approvalLevel}`);
        }
      }

      const remaining = steps.filter((s: any) => s.id !== activeStep.id && s.status === 'Pending');
      await repo.updateWoPostponementApprovalStep(activeStep.id, {
        status: 'Approved',
        actionByUserId: body.approvedBy,
        actionAt: now,
        remarks: body.approvalRemarks || null,
      });

      if (remaining.length > 0) {
        console.log(`[WO_RE_POSTPONE_WORKFLOW] WO ${wo.wouuid} — ${activeStep.approvalLevel} approved; awaiting ${remaining.length} more level(s)`);
        return (await repo.findById(id)) || wo;
      }
      console.log(`[WO_RE_POSTPONE_WORKFLOW] WO ${wo.wouuid} — all approval levels satisfied, finalising`);
    }
  }
  // ── End gate — fall through to finalisation ──────────────────────────────

  const today = new Date().toISOString().split('T')[0];
  const newDueDate = wo.postponeRequestedDate || body.newDueDate;

  const updatedWO = await repo.update(id, {
    status: 'Postponement Approved',
    dueDate: newDueDate,
    postponementEndDate: newDueDate,
    postponeApprover: body.approvedBy || 'Office',
    postponementApprovalDate: today,
    postponementApprovalRemarks: body.approvalRemarks || null,
  });

  // Field-log so the approved due date syncs back to the vessel
  try {
    await logFieldChanges('work_orders', wo.wouuid, wo.vesselId || null, wo, updatedWO, body.approvedBy || body.userId || 'system');
  } catch (err) { console.error('[FieldLogger] WO re-postpone-approve:', err); }

  // Insert immutable decision audit row (approve)
  const existingRows = await repo.findPostponementsByWorkOrderId(wo.wouuid);
  const prevMaxApprove = existingRows?.length
    ? existingRows.reduce((a: any, b: any) =>
        (b.postponementNumber || 1) > (a.postponementNumber || 1) ? b : a
      ).postponementNumber || 1
    : 1;
  const latestApprove = existingRows?.length
    ? existingRows.reduce((a: any, b: any) =>
        (b.postponementNumber || 1) > (a.postponementNumber || 1) ? b : a
      )
    : null;

  await repo.createPostponement({
    id: crypto.randomUUID(),
    workOrderId: wo.wouuid,
    vesselId: wo.vesselId!,
    postponementNumber: prevMaxApprove + 1,
    originalDueDate: latestApprove?.originalDueDate || wo.originalDueDate || wo.dueDate,
    newDueDate: newDueDate,
    postponementReason: latestApprove?.postponementReason || wo.postponementReason,
    postponementRemarks: latestApprove?.postponementRemarks || wo.postponementRemarks,
    authorizedBy: body.approvedBy || 'Office',
    approvedBy: body.approvedBy || 'Office',
    approvedDate: today,
    approvalRemarks: body.approvalRemarks || null,
    approver: body.approvedBy || 'Office',
    durationDays: latestApprove?.durationDays || null,
    submittedDate: today,
    status: 'Approved',
    informOffice: true,
    requestType: 'Re-Postponement',
  } as any);

  return updatedWO;
}

/**
 * Office rejects a Re-Postponement request.
 * Records the rejection on the active approval step, then reverts the WO to
 * 'Postponement Approved' and restores the due date that was snapshotted at
 * submission time (the originalDueDate stored on the Awaiting Approval record).
 *
 * Unlike rejectPostponement, this function does NOT call computeWorkOrderStatus —
 * the WO was already in 'Postponement Approved' before the re-postponement was
 * submitted, and it must return to that state unconditionally.
 */
export async function rejectRePostponement(id: string, body: any) {
  let wo = await repo.findById(id);
  if (!wo) wo = await repo.findByCode(id);
  if (!wo) throw new NotFoundError('Work order not found');

  if (wo.status !== 'Awaiting Office Approval') {
    throw new ValidationError(
      `Only work orders with status "Awaiting Office Approval" can be rejected. Current status: ${wo.status}`
    );
  }

  // ── Mark the active approval step as Rejected ────────────────────────────
  const awaitingPostponement = await repo.getLatestAwaitingPostponement(wo.wouuid);
  let dueDateToRestore: string | null = null;

  if (awaitingPostponement) {
    // The originalDueDate on the pending record is the due date that was active
    // when the re-postponement was submitted — restore it on rejection
    dueDateToRestore = awaitingPostponement.originalDueDate || null;

    const steps = await repo.getWoPostponementApprovalSteps(awaitingPostponement.id);
    if (steps.length > 0) {
      const activeStep = steps.find((s: any) => s.status === 'Pending');
      if (activeStep) {
        const isSailAdmin = body.sessionRole === 'Sail Admin' || body.role === 'Sail Admin';
        if (!isSailAdmin) {
          const reviewerId = body.userUuid || body.approvedBy;
          const isAuthorised = await repo.verifyApproverForLevel(reviewerId, activeStep.approvalLevel);
          if (!isAuthorised) {
            throw new ValidationError(`Not authorised to reject at ${activeStep.approvalLevel}`);
          }
        }
        await repo.updateWoPostponementApprovalStep(activeStep.id, {
          status: 'Rejected',
          actionByUserId: body.approvedBy,
          actionAt: new Date(),
          remarks: body.approvalRemarks || null,
        });
      }
    }
  }
  // ── End step rejection — revert WO to Postponement Approved ─────────────

  const today = new Date().toISOString().split('T')[0];

  const updatedWO = await repo.update(id, {
    status: 'Postponement Approved',
    // Restore the due date that was active before the re-postponement was submitted
    ...(dueDateToRestore ? { dueDate: dueDateToRestore, postponementEndDate: dueDateToRestore } : {}),
    postponeApprover: body.approvedBy || 'Office',
    postponementApprovalDate: today,
    postponementApprovalRemarks: body.approvalRemarks || null,
  });

  // Field-log so the revert syncs to the vessel
  try {
    await logFieldChanges('work_orders', wo.wouuid, wo.vesselId || null, wo, updatedWO, body.approvedBy || body.userId || 'system');
  } catch (err) { console.error('[FieldLogger] WO re-postpone-reject:', err); }

  // Insert immutable decision audit row (reject)
  const rejectRows = await repo.findPostponementsByWorkOrderId(wo.wouuid);
  const prevMaxReject = rejectRows?.length
    ? rejectRows.reduce((a: any, b: any) =>
        (b.postponementNumber || 1) > (a.postponementNumber || 1) ? b : a
      ).postponementNumber || 1
    : 1;
  const latestReject = rejectRows?.length
    ? rejectRows.reduce((a: any, b: any) =>
        (b.postponementNumber || 1) > (a.postponementNumber || 1) ? b : a
      )
    : null;

  await repo.createPostponement({
    id: crypto.randomUUID(),
    workOrderId: wo.wouuid,
    vesselId: wo.vesselId!,
    postponementNumber: prevMaxReject + 1,
    originalDueDate: latestReject?.originalDueDate || wo.originalDueDate || wo.dueDate,
    newDueDate: latestReject?.newDueDate || wo.postponeRequestedDate,
    postponementReason: latestReject?.postponementReason || wo.postponementReason,
    postponementRemarks: latestReject?.postponementRemarks || wo.postponementRemarks,
    authorizedBy: body.approvedBy || 'Office',
    approvedBy: body.approvedBy || 'Office',
    approvedDate: today,
    approvalRemarks: body.approvalRemarks || null,
    approver: body.approvedBy || 'Office',
    durationDays: latestReject?.durationDays || null,
    submittedDate: today,
    status: 'Rejected',
    informOffice: true,
    requestType: 'Re-Postponement',
  } as any);

  return updatedWO;
}

export async function reopenCompletedWorkOrder(
  id: string,
  remarks: string,
  actorUserUuid: string,
  actorName?: string
) {
  // 1. Resolve WO
  let existingWO = await repo.findById(id);
  if (!existingWO) existingWO = await repo.findByCode(id);
  if (!existingWO) throw new NotFoundError('Work order not found');

  // 2. Guard: only Completed WOs may be reopened
  if (existingWO.status !== 'Completed') {
    throw new ValidationError(
      `Only Completed work orders can be reopened. Current status: ${existingWO.status}`
    );
  }

  // 3. Guard: remarks are mandatory
  if (!remarks || !remarks.trim()) {
    throw new ValidationError('Superintendent reopen remarks are mandatory.');
  }

  const reopenedAt = new Date().toISOString();

  // 4. Update: status → Reopened, wasReopened → true; all completion data preserved
  const updatePayload: any = {
    status: 'Reopened',
    wasReopened: true,
    superintendentReopenRemarks: remarks.trim(),
    superintendentReopenedByName: actorName || actorUserUuid,
    reopenedAt,
  };
  const updatedWO = await repo.update(id, updatePayload);

  // 5. Sync field-level change log
  await logFieldChanges(
    'work_orders',
    existingWO.wouuid,
    existingWO.vesselId || null,
    existingWO,
    updatedWO,
    actorUserUuid
  );

  // 6. Audit log entry
  try {
    await repo.createAuditLog({
      entityType: 'work_order',
      entityId: existingWO.wouuid || id,
      actionType: 'superintendent_reopen_completion',
      userId: actorUserUuid,
      source: 'web_ui',
      vesselCode: existingWO.vesselId || null,
      componentCode: existingWO.componentCode || null,
      fieldName: null,
      oldValue: null,
      newValue: null,
      payload: {
        workOrderNo: existingWO.workOrderNo,
        reopenedAt,
        reopenedByName: actorName || actorUserUuid,
        reopenRemarks: remarks.trim(),
        reopenType: 'superintendent_completion_reopen',
      },
    });
  } catch (err) {
    console.error('[AuditLog] Completed WO reopen:', err);
  }

  // 7. Cancel next-cycle sibling WOs (same logic as rejectCompletedWorkOrder)
  if (existingWO.jobId && existingWO.vesselId) {
    try {
      const siblings = await repo.findWorkOrdersByJobId(existingWO.jobId);
      const referenceDate = (existingWO as any).completionDateTime || existingWO.dueDate || '';
      const openStatuses = new Set(['Active', 'Planned', 'Due', 'Due (Grace P)', 'Overdue']);
      const toCancel = siblings.filter((wo: any) =>
        wo.id !== existingWO!.id &&
        wo.vesselId === existingWO!.vesselId &&
        openStatuses.has(wo.status) &&
        !wo.isDeleted &&
        referenceDate &&
        (
          (wo.dueDate && wo.dueDate > referenceDate) ||
          (wo.nextDueDate && wo.nextDueDate > referenceDate)
        )
      );
      for (const sibling of toCancel) {
        const cancelled = await repo.update(sibling.id, { isDeleted: true, isActive: false });
        try {
          await logFieldChanges(
            'work_orders',
            sibling.wouuid,
            sibling.vesselId || null,
            sibling,
            cancelled,
            actorUserUuid
          );
        } catch (err) {
          console.error('[FieldLogger] Sibling WO cancellation (reopen):', err);
        }
        console.log(`🗑️ [Reopen] Cancelled next-cycle sibling WO: ${sibling.workOrderNo}`);
      }
    } catch (err) {
      console.error('[Reopen] Error cancelling sibling WOs:', err);
    }
  }

  // 8. Reset job's nextDueDate to the reopened WO's dueDate so the cycle regenerates
  if (existingWO.jobId && existingWO.dueDate) {
    try {
      const db = await getDb();
      await db
        .update(jobs)
        .set({ nextDueDate: existingWO.dueDate })
        .where(eq(jobs.juuid, existingWO.jobId));
      console.log(`📅 [Reopen] Reset job nextDueDate to ${existingWO.dueDate} for job ${existingWO.jobId}`);
    } catch (err) {
      console.error('[Reopen] Error resetting job nextDueDate:', err);
    }
  }

  return updatedWO;
}
