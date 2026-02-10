import { computeWorkOrderStatus } from "@shared/workOrders/status";
import { WORK_ORDER_THRESHOLDS } from "@shared/workOrders/constants";
import * as repo from "../repositories/workOrderRepository";
import type { WorkOrder, Job, Component, PmsVesselSettings } from "../schema";

function parseRH(value: string | number | null | undefined): number | undefined {
  if (value == null || value === '') return undefined;
  const num = Number(value);
  return isNaN(num) ? undefined : num;
}

function buildVesselGraceSettings(vesselSettings: PmsVesselSettings | undefined) {
  if (!vesselSettings) return undefined;
  return {
    calendarGraceMode: (vesselSettings.calendarGraceMode || 'COMPANY_STANDARD') as 'COMPANY_STANDARD' | 'CUSTOM_DAYS',
    calendarGraceDays: vesselSettings.calendarGraceDays ?? WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
    rhGraceHours: vesselSettings.rhGraceHours ?? WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
    rhLeadTimeHours: vesselSettings.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS,
  };
}

function enrichWorkOrder(
  wo: WorkOrder,
  job: Job | null | undefined,
  component: Component | null | undefined,
  vesselSettings: PmsVesselSettings | undefined
) {
  const vesselGraceSettings = buildVesselGraceSettings(vesselSettings);

  const dueRH = wo.maintenanceBasis === 'Running Hours'
    ? (parseRH(wo.cycleDueRhSnapshot) ?? parseRH(job?.nextDueRH) ?? parseRH((wo as any).nextDueReading))
    : undefined;
  const currentRH = wo.maintenanceBasis === 'Running Hours'
    ? (parseRH(component?.currentCumulativeRH) ?? parseRH((component as any)?.rhCurrentMaster) ?? parseRH((wo as any).currentReading))
    : undefined;

  const isJobCritical = job?.jobPriority === 'Critical' || job?.classRelated === 'true' || (job?.classRelated as any) === true;
  const rhLeadTimeHours = wo.maintenanceBasis === 'Running Hours'
    ? (isJobCritical
        ? (vesselSettings?.rhLeadHoursCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL)
        : (vesselSettings?.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_NON_CRITICAL))
    : undefined;

  return {
    ...wo,
    assignedTo: (wo.assignedTo && wo.assignedTo !== 'Unassigned')
      ? wo.assignedTo
      : (job?.assignedTo || 'Unassigned'),
    criticality: wo.criticality || job?.criticality || null,
    computedStatus: computeWorkOrderStatus({
      dueDate: wo.dueDate,
      dueRH,
      currentRH,
      isExecution: wo.isExecution,
      status: wo.status,
      completionDateTime: wo.dateCompleted,
      maintenanceBasis: wo.maintenanceBasis || job?.maintenanceBasis || undefined,
      vesselGraceSettings,
      rhLeadTimeHours,
    }),
    leadTimeValue: job?.leadTimeValue ?? null,
    leadTimeUnit: job?.leadTimeUnit ?? null,
    dueRH: dueRH ?? null,
    currentRH: currentRH ?? null,
  };
}

const STATUS_PRIORITY: Record<string, number> = {
  'Overdue': 1,
  'Due (Grace P)': 2,
  'Due': 3,
  'Due Soon': 4,
  'Planned': 5,
  'Postponed': 6,
  'Pending Approval': 7,
  'Active': 8,
  'Completed': 9,
  'Rejected': 10,
};

export async function listWorkOrders(vesselId?: string) {
  const [workOrdersList, jobsList, componentsList] = await Promise.all([
    repo.getWorkOrders(vesselId),
    repo.getJobs(vesselId),
    repo.getComponents(vesselId),
  ]);

  const jobsMap = new Map(jobsList.map(j => [j.id, j]));
  const componentsByCodeMap = new Map(componentsList.map(c => [c.componentCode, c]));
  const componentsMap = new Map(componentsList.map(c => [c.id, c]));

  const vesselSettings = vesselId ? await repo.getPmsVesselSettings(vesselId) : undefined;

  const enriched = workOrdersList.map(wo => {
    const job = wo.jobId
      ? jobsMap.get(wo.jobId)
      : wo.templateCode
        ? jobsList.find(j => j.jobNo === wo.templateCode)
        : null;

    const component = wo.componentCode
      ? componentsByCodeMap.get(wo.componentCode)
      : (wo.component ? componentsMap.get(wo.component) : null);

    return enrichWorkOrder(wo, job, component, vesselSettings);
  });

  enriched.sort((a, b) => {
    const aPriority = STATUS_PRIORITY[a.computedStatus] ?? 99;
    const bPriority = STATUS_PRIORITY[b.computedStatus] ?? 99;
    if (aPriority !== bPriority) return aPriority - bPriority;
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    return 0;
  });

  return enriched;
}

export async function getEnrichedWorkOrder(id: string) {
  const wo = await repo.getWorkOrder(id);
  if (!wo) return null;

  let job: Job | null = null;
  if (wo.vesselId) {
    const jobsList = await repo.getJobs(wo.vesselId);
    job = wo.jobId
      ? jobsList.find(j => j.id === wo.jobId) ?? null
      : wo.templateCode
        ? jobsList.find(j => j.jobNo === wo.templateCode) ?? null
        : null;
  }

  let component: Component | null = null;
  if (wo.componentCode && wo.vesselId) {
    component = (await repo.getComponentByCode(wo.componentCode, wo.vesselId)) ?? null;
  }
  if (!component && wo.component) {
    component = (await repo.getComponent(wo.component)) ?? null;
  }

  const vesselSettings = wo.vesselId ? await repo.getPmsVesselSettings(wo.vesselId) : undefined;

  return enrichWorkOrder(wo, job, component, vesselSettings);
}
