import * as repo from '../repositories/workOrderRepository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { computeWorkOrderStatus, buildCompanyGraceConfig } from '@shared/workOrders/status';
import { WORK_ORDER_THRESHOLDS } from '@shared/workOrders/constants';
import { computeSpareConsumptionDelta, ConsumedSpareEntry } from '../utils/spareConsumptionDelta';
import { calculateMissedCycles, calculateMissedCyclesRH } from '@shared/dateUtils';
import { storage } from '../../../storage';
import { getDb } from '../../../db';
import { plannerDates } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function resolveRankIdFromLabel(assignedTo: string | null | undefined): Promise<string | null> {
  if (!assignedTo) return null;
  const { getAllRanks } = await import('../../ranks/service');
  const allRanks = await getAllRanks();
  const label = assignedTo.toLowerCase().trim();
  const match = allRanks.find(
    (r: any) => r.name?.toLowerCase().trim() === label || r.label?.toLowerCase().trim() === label
  );
  return match?.rankId ?? null;
}

function calculateBackdatingDaysForApproval(completionDate: string | null | undefined, submittedDate: string | null | undefined): number {
  if (!completionDate) return 0;
  const comp = new Date(completionDate);
  if (isNaN(comp.getTime())) return 0;
  const reference = submittedDate ? new Date(submittedDate) : new Date();
  if (isNaN(reference.getTime())) return 0;
  const diffMs = reference.getTime() - comp.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function calculateApprovalTier(
  dueDate: string | null | undefined,
  completionDate: string | null | undefined,
  missedCycles: number,
  backdatingDays: number = 0
) {
  let daysLate = 0;
  if (dueDate && completionDate) {
    const due = new Date(dueDate);
    const comp = new Date(completionDate);
    const diffMs = comp.getTime() - due.getTime();
    daysLate = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  let approvalTier = 'standard';
  let superintendentNotifiedAt: string | null = null;
  let superintendentAcknowledged = false;
  let approvalBlockReason: string | null = null;

  if (missedCycles >= 3 || daysLate >= 21 || backdatingDays >= 7) {
    approvalTier = 'superintendent_locked';
    superintendentAcknowledged = false;
    superintendentNotifiedAt = new Date().toISOString();
    approvalBlockReason = 'Awaiting Superintendent acknowledgment';
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
      daysLate,
      missedCycles,
      backdatingDays,
      approvalTier,
    });
    console.log(`📢 Superintendent notification created for WO ${wo.workOrderNo || wo.id} (tier: ${approvalTier}, vessel: ${vesselName})`);
  } catch (err: any) {
    console.error(`⚠️ Failed to create superintendent notification: ${err.message}`);
  }
}

// ── List Work Orders with Enrichment ──

export async function listWorkOrders(vesselId?: string) {
  const workOrders = await repo.findWorkOrders(vesselId);

  const companyGraceRow = await storage.getCompanyStandardGraceSettings();
  const companyGraceConfig = buildCompanyGraceConfig(companyGraceRow);

  // For "All Vessels" (no vesselId), we need per-vessel components, jobs, and settings
  const isAllVessels = !vesselId;
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

    return {
      ...wo,
      assignedTo: (wo.assignedTo && wo.assignedTo !== 'Unassigned')
        ? wo.assignedTo
        : (job?.assignedTo || 'Unassigned'),
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
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }

    return 0;
  });

  return sortedWorkOrders;
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

  if (workOrderData.assignedTo && !workOrderData.assignedToRankId) {
    const rankId = await resolveRankIdFromLabel(workOrderData.assignedTo);
    if (rankId) {
      workOrderData = { ...workOrderData, assignedToRankId: rankId };
    }
  }

  const workOrder = await repo.create(workOrderData);
  return workOrder;
}

// ── Update Work Order (MASSIVE handler with approval/completion flow) ──

export async function updateWorkOrder(id: string, body: any) {
  // Log incoming data for debugging
  console.log('📝 PATCH work order request body keys:', Object.keys(body));

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
        const parsedDue = new Date(dueDate);
        if (!isNaN(parsedDue.getTime()) && parsedDue < new Date()) {
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

  if (updateData.assignedTo && !updateData.assignedToRankId) {
    const rankId = await resolveRankIdFromLabel(updateData.assignedTo);
    if (rankId) {
      updateData.assignedToRankId = rankId;
    }
  }

  // Remove any undefined values
  Object.keys(updateData).forEach((key: string) => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

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

  // REJECTED WO RESUBMISSION
  const isRejectedWO = existingWO.wasRejected === true;
  if (isRejectedWO && hasCompletionData && !hasExplicitStatus) {
    updateData.status = 'Pending Approval';
    updateData.rejectionComments = null;
    updateData.rejectionDate = null;
    updateData.approvalAction = null;
    updateData.submittedDate = new Date().toISOString();
    console.log('📝 Previously rejected WO resubmitted - transitioning to Pending Approval');
  }

  // AUDIT TRAIL: Capture submittedDate
  const isSubmissionAction = updateData.approvalAction === 'submitted' ||
                              updateData.approvalAction === 'submit' ||
                              updateData.status === 'Pending Approval';
  if (isSubmissionAction && !existingWO.submittedDate) {
    updateData.submittedDate = new Date().toISOString();
    console.log('📝 Capturing submittedDate for audit trail on submission/Pending Approval');
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
    const tierResult = calculateApprovalTier(tierDueDate, tierCompDate, tierMissedCycles, tierBackdatingDays);
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
  }

  console.log('📝 Cleaned update data keys:', Object.keys(updateData));

  // VALIDATION: For INHERITED components, check that RH doesn't exceed master component RH
  if (updateData.approvalAction === 'approved' && updateData.status === 'Completed') {
    const runningHours = existingWO.runningHours || updateData.runningHours;
    if (runningHours) {
      let componentForValidation = await repo.findComponent(existingWO.component);
      if (!componentForValidation && existingWO.componentCode && existingWO.vesselId) {
        componentForValidation = await repo.findComponentByCode(existingWO.componentCode, existingWO.vesselId);
      }

      if (componentForValidation) {
        const counterType = (componentForValidation.rhCounterType || '').toUpperCase();
        if (counterType === 'INHERITED') {
          let rhMasterComponent: any = null;
          if (componentForValidation.rhMasterComponentId) {
            rhMasterComponent = await repo.findComponent(componentForValidation.rhMasterComponentId);
          }
          if (!rhMasterComponent && componentForValidation.rhCounterSource && existingWO.vesselId) {
            rhMasterComponent = await repo.findComponentByCode(componentForValidation.rhCounterSource, existingWO.vesselId);
          }

          if (rhMasterComponent) {
            const enteredRH = parseFloat(runningHours);
            const masterRH = parseFloat(rhMasterComponent.currentCumulativeRH || rhMasterComponent.rhCurrentMaster || '0');

            if (!isNaN(enteredRH) && !isNaN(masterRH) && enteredRH > masterRH) {
              console.error(`❌ RH validation failed: Entered RH (${enteredRH}) exceeds master component ${rhMasterComponent.componentCode} RH (${masterRH})`);
              throw new ValidationError(
                `Running hours (${enteredRH}) cannot exceed master component "${rhMasterComponent.name}" (${rhMasterComponent.componentCode}) running hours of ${masterRH}. Please update the master component's running hours first.`,
                { code: 'RH_EXCEEDS_MASTER' }
              );
            }
          }
        }
      }
    }
  }

  const isApprovalTransition = (updateData.approvalAction === 'approved' && updateData.status === 'Completed') ||
    (updateData.status === 'Completed' && existingWO.status === 'Pending Approval');
  if (isApprovalTransition) {
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
          `This work order has ${woMissedCycles} skipped maintenance cycle(s). The Chief Engineer must provide a written justification (minimum 30 characters) explaining why these cycles were missed before approval can be granted.`,
          { code: 'JUSTIFICATION_REQUIRED', missedCycles: woMissedCycles }
        );
      }
    }

    // Layer 5: Approval gate logic based on approvalTier
    const currentTier = existingWO.approvalTier || 'standard';
    const ceRemarks = (updateData.ceApprovalRemarks || '').trim();

    if (currentTier === 'superintendent_locked') {
      throw new ValidationError(
        'This work order has high severity issues (3+ missed cycles, 21+ days late, or 7+ days backdating). It is locked pending Superintendent acknowledgment. The CE cannot approve until the Superintendent has acknowledged.',
        { code: 'SUPERINTENDENT_LOCKED' }
      );
    }

    if (currentTier === 'superintendent_notification') {
      if (!ceRemarks || ceRemarks.length < 20) {
        throw new ValidationError(
          'This work order has medium severity issues (2 missed cycles, 14–20 days late, or 3–6 days backdating). You must enter detailed remarks (minimum 20 characters) before approving.',
          { code: 'CE_REMARKS_REQUIRED', minLength: 20 }
        );
      }
    }

    if (currentTier === 'ce_with_justification') {
      if (!ceRemarks || ceRemarks.length < 10) {
        throw new ValidationError(
          'This work order has low severity issues (1 missed cycle, 7–13 days late, or 1–2 days backdating). Approval remarks are mandatory (minimum 10 characters).',
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

  const workOrder = await repo.update(id, updateData);

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
        const orig = new Date(originalDueDate);
        const next = new Date(newDueDate);
        if (!isNaN(orig.getTime()) && !isNaN(next.getTime())) {
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
  if (!isApprovalAction && !isBeingRejected && !woIsCompleted) {
    const currentConsumed = (updateData.consumedSpareParts || []) as ConsumedSpareEntry[];
    const previousConsumed = (existingWO.consumedSpareParts || []) as ConsumedSpareEntry[];

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

        if (missedCycles >= 1 && freshWorkOrder.maintenanceBasis === 'Calendar') {
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
            const runningHours = freshWorkOrder.runningHours;

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
          }
        } catch (jobError) {
          console.error('Failed to update job cycle dates:', jobError);
        }
      } else {
        console.warn(`⚠️ Could not find component for work order ${freshWorkOrder.id}`);
      }
    }
  }

  // ========== SPARE CONSUMPTION ON APPROVAL ==========
  if (updateData.approvalAction === 'approved' && updateData.status === 'Completed') {
    const freshWO = await repo.findById(id);
    const woForSpares = freshWO || workOrder;

    if (woForSpares && woForSpares.consumedSpareParts && Array.isArray(woForSpares.consumedSpareParts)) {
      const consumedSpares = woForSpares.consumedSpareParts as Array<{
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

  return workOrder;
}

// ── Delete Work Order ──

export async function deleteWorkOrder(id: string) {
  await repo.remove(id);
}

// ── Save Overdue Reason ──

export async function saveOverdueReason(id: string, overdueReason: string, overdueReasonDetails: string | null) {
  const workOrder = await repo.findById(id);
  if (!workOrder) {
    throw new NotFoundError('Work order not found');
  }

  const updated = await repo.update(id, { overdueReason, overdueReasonDetails });
  return updated;
}

function filterWorkOrdersByRankId(
  workOrders: any[],
  scopeRankIds: Set<string>
): any[] {
  return workOrders.filter((wo: any) => {
    const rankId = wo.assignedToRankId;
    if (!rankId) return false;
    return scopeRankIds.has(rankId);
  });
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
  userVesselId?: string
) {
  const vesselWideAccessGranted = hasVesselWideAccess(userRole, userVesselId, vesselId);

  if (!userRankId) {
    return {
      workOrders: [],
      scopeMeta: {
        hasMapping: false,
        hasDescendants: false,
        mode,
        appliedRankIds: [] as string[],
        vesselWideAccessGranted,
      },
    };
  }

  const { resolveHierarchyScopeByRankId } = await import('../../ranks/service');

  const scope = await resolveHierarchyScopeByRankId(vesselId, userRankId);

  if (!scope.hasMapping) {
    return {
      workOrders: [],
      scopeMeta: {
        hasMapping: false,
        hasDescendants: false,
        mode,
        appliedRankIds: [] as string[],
        vesselWideAccessGranted,
      },
    };
  }

  const bucket = mode === 'me' ? scope.me : scope.myTeam;
  const scopeRankIdSet = new Set(bucket.rankIds);

  const allWOs = await listWorkOrders(vesselId);
  const filteredWOs = filterWorkOrdersByRankId(allWOs, scopeRankIdSet);

  return {
    workOrders: filteredWOs,
    scopeMeta: {
      hasMapping: true,
      hasDescendants: scope.hasDescendants,
      mode,
      appliedRankIds: bucket.rankIds,
      vesselWideAccessGranted,
    },
  };
}
