import { v4 as uuidv4 } from "uuid";
import { computeWorkOrderStatus } from "@shared/workOrders/status";
import { WORK_ORDER_THRESHOLDS } from "@shared/workOrders/constants";
import * as repo from "../repositories/workOrderRepository";
import { generateWorkOrderNumber } from "../utils/workOrderNumbering";

export async function autoGenerate(body: any) {
  const { vesselId } = body;
  if (!vesselId) return { error: 'vesselId is required' };

  const [vesselSettings, allJobs, existingWOs, allComponents] = await Promise.all([
    repo.getPmsVesselSettings(vesselId),
    repo.getJobs(vesselId),
    repo.getWorkOrdersByVessel(vesselId),
    repo.getComponents(vesselId),
  ]);

  const componentMap = new Map(allComponents.map(c => [c.id, c]));
  const terminalStatuses = ['Completed', 'Approved'];
  const activeWOsByJobId = new Map<string, any[]>();
  for (const wo of existingWOs) {
    if (wo.jobId && !terminalStatuses.includes(wo.status || '')) {
      if (!activeWOsByJobId.has(wo.jobId)) activeWOsByJobId.set(wo.jobId, []);
      activeWOsByJobId.get(wo.jobId)!.push(wo);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const generated: any[] = [];
  const skipped: any[] = [];

  for (const job of allJobs) {
    if (job.dataScope !== 'vessel') continue;
    if (!job.maintenanceBasis) continue;

    const activeWOs = activeWOsByJobId.get(job.id) || [];
    if (activeWOs.length > 0) {
      skipped.push({ jobId: job.id, reason: 'Active WO already exists' });
      continue;
    }

    const component = job.componentId ? componentMap.get(job.componentId) : null;

    if (job.maintenanceBasis === 'Calendar') {
      if (!job.nextDueDate) continue;
      const dueDate = parseFlexibleDate(job.nextDueDate);
      if (!dueDate) continue;

      const leadDays = (job.jobPriority === 'Critical' || job.classRelated === 'Yes')
        ? (vesselSettings?.calendarLeadDaysCritical ?? WORK_ORDER_THRESHOLDS.CALENDAR_LEAD_TIME_DAYS_CRITICAL)
        : (vesselSettings?.calendarLeadDaysNonCritical ?? WORK_ORDER_THRESHOLDS.CALENDAR_LEAD_TIME_DAYS_NON_CRITICAL);

      const generateDate = new Date(dueDate);
      generateDate.setDate(generateDate.getDate() - leadDays);

      if (today >= generateDate) {
        const hasCycleDuplicate = existingWOs.some(wo =>
          wo.jobId === job.id &&
          wo.cycleDueDateSnapshot === job.nextDueDate &&
          !terminalStatuses.includes(wo.status || '')
        );
        if (hasCycleDuplicate) {
          skipped.push({ jobId: job.id, reason: 'Cycle duplicate exists' });
          continue;
        }

        const woData = buildWorkOrderFromJob(job, vesselId, component);
        woData.driverType = 'CALENDAR';
        woData.cycleDueDateSnapshot = job.nextDueDate;
        woData.generateDateSnapshot = generateDate.toISOString().split('T')[0];
        woData.dueDateSnapshot = job.nextDueDate;
        woData.lastDoneDateSnapshot = job.lastDoneDate;
        woData.dueDate = job.nextDueDate;

        const result = await repo.createWorkOrder(woData);
        generated.push(result);
      }
    } else if (job.maintenanceBasis === 'Running Hours') {
      if (!job.nextDueRH || !component) continue;
      const dueRH = parseFloat(job.nextDueRH);
      const currentRH = parseFloat(component.currentCumulativeRH || '0');
      if (isNaN(dueRH) || isNaN(currentRH)) continue;

      const leadHours = (job.jobPriority === 'Critical' || job.classRelated === 'Yes')
        ? (vesselSettings?.rhLeadHoursCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL)
        : (vesselSettings?.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_NON_CRITICAL);

      const generateRH = dueRH - leadHours;

      if (currentRH >= generateRH) {
        const hasCycleDuplicate = existingWOs.some(wo =>
          wo.jobId === job.id &&
          wo.cycleDueRhSnapshot !== null &&
          parseFloat(wo.cycleDueRhSnapshot) === dueRH &&
          !terminalStatuses.includes(wo.status || '')
        );
        if (hasCycleDuplicate) {
          skipped.push({ jobId: job.id, reason: 'Cycle duplicate exists' });
          continue;
        }

        const woData = buildWorkOrderFromJob(job, vesselId, component);
        woData.driverType = 'RH';
        woData.cycleDueRhSnapshot = dueRH.toString();
        woData.generateRhSnapshot = generateRH.toString();
        woData.dueRhSnapshot = dueRH.toString();
        woData.effectiveRhAtGeneration = currentRH.toString();
        woData.rhLastDoneSnapshot = job.lastDoneRH;

        const result = await repo.createWorkOrder(woData);
        generated.push(result);
      }
    }
  }

  return { generated, skipped, totalGenerated: generated.length, totalSkipped: skipped.length };
}

function buildWorkOrderFromJob(job: any, vesselId: string, component: any) {
  return {
    id: uuidv4(),
    vesselId,
    component: job.componentId || job.componentName || '',
    componentCode: component?.componentCode || job.componentCode || '',
    jobId: job.id,
    workOrderNo: generateWorkOrderNumber(),
    workOrderType: 'Planned',
    templateCode: job.jobNo,
    jobTitle: job.jobTitle,
    assignedTo: job.assignedTo || 'Unassigned',
    status: 'Active',
    maintenanceBasis: job.maintenanceBasis,
    maintenanceType: job.maintenanceType,
    frequencyValue: job.frequencyValue,
    frequencyUnit: job.frequencyUnit,
    jobPriority: job.jobPriority,
    classRelated: job.classRelated,
    department: job.department,
    approver: job.approver,
    briefWorkDescription: job.briefWorkDescription || job.jobDescription,
    criticality: job.criticality,
    dataScope: 'vessel',
    requiredSpareParts: job.requiredSpareParts || [],
    requiredTools: job.requiredTools || [],
    safetyRequirements: job.safetyRequirements || { ppeRequirements: [], permitRequirements: [], otherRequirements: [] },
  };
}

function parseFlexibleDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return new Date(dateStr);

  const monthNames: Record<string, number> = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };

  const dmmyMatch = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (dmmyMatch) {
    const [, day, mon, year] = dmmyMatch;
    const m = monthNames[mon];
    if (m !== undefined) return new Date(parseInt(year), m, parseInt(day));
  }

  const ddmmMatch = dateStr.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);
  if (ddmmMatch) {
    const [, day, month, year] = ddmmMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export async function recalculateStatuses(body: any) {
  const { vesselId } = body;
  const terminalStatuses = ['Completed', 'Approved'];

  const [workOrdersList, jobsList, componentsList] = await Promise.all([
    repo.getWorkOrders(vesselId),
    repo.getJobs(vesselId),
    repo.getComponents(vesselId),
  ]);

  const jobsMap = new Map(jobsList.map(j => [j.id, j]));
  const componentsByCodeMap = new Map(componentsList.map(c => [c.componentCode, c]));
  const componentsMap = new Map(componentsList.map(c => [c.id, c]));

  const vesselSettings = vesselId ? await repo.getPmsVesselSettings(vesselId) : undefined;
  const vesselGraceSettings = vesselSettings ? {
    calendarGraceMode: (vesselSettings.calendarGraceMode || 'COMPANY_STANDARD') as 'COMPANY_STANDARD' | 'CUSTOM_DAYS',
    calendarGraceDays: vesselSettings.calendarGraceDays ?? WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
    rhGraceHours: vesselSettings.rhGraceHours ?? WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
    rhLeadTimeHours: vesselSettings.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS,
  } : undefined;

  const parseRH = (value: string | number | null | undefined): number | undefined => {
    if (value == null || value === '') return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  };

  let updated = 0;
  for (const wo of workOrdersList) {
    if (terminalStatuses.includes(wo.status || '')) continue;
    if (wo.status === 'Pending Approval') continue;
    if (wo.status === 'Postponed') continue;

    const job = wo.jobId ? jobsMap.get(wo.jobId) : null;
    const component = wo.componentCode
      ? componentsByCodeMap.get(wo.componentCode)
      : (wo.component ? componentsMap.get(wo.component) : null);

    const dueRH = wo.maintenanceBasis === 'Running Hours'
      ? (parseRH(wo.cycleDueRhSnapshot) ?? parseRH(job?.nextDueRH))
      : undefined;
    const currentRH = wo.maintenanceBasis === 'Running Hours'
      ? (parseRH(component?.currentCumulativeRH))
      : undefined;

    const isJobCritical = job?.jobPriority === 'Critical' || job?.classRelated === 'true' || (job?.classRelated as any) === true;
    const rhLeadTimeHours = wo.maintenanceBasis === 'Running Hours'
      ? (isJobCritical
          ? (vesselSettings?.rhLeadHoursCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL)
          : (vesselSettings?.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_NON_CRITICAL))
      : undefined;

    const newStatus = computeWorkOrderStatus({
      dueDate: wo.dueDate,
      dueRH,
      currentRH,
      isExecution: wo.isExecution,
      status: wo.status,
      completionDateTime: wo.dateCompleted,
      maintenanceBasis: wo.maintenanceBasis || job?.maintenanceBasis || undefined,
      vesselGraceSettings,
      rhLeadTimeHours,
    });

    if (newStatus !== wo.status) {
      await repo.updateWorkOrder(wo.id, { status: newStatus });
      updated++;
    }
  }

  return { updated, total: workOrdersList.length };
}

export async function checkPostponements(body: any) {
  const { vesselId } = body;
  const workOrdersList = await repo.getWorkOrders(vesselId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let reverted = 0;
  for (const wo of workOrdersList) {
    if (wo.status !== 'Postponed') continue;
    if (!wo.postponementEndDate) continue;

    const endDate = new Date(wo.postponementEndDate);
    if (isNaN(endDate.getTime())) continue;
    endDate.setHours(0, 0, 0, 0);

    if (today > endDate) {
      await repo.updateWorkOrder(wo.id, { status: 'Due' });
      reverted++;
    }
  }

  return { reverted };
}
