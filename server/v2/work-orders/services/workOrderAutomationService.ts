import { v4 as uuidv4 } from "uuid";
import { computeWorkOrderStatus } from "@shared/workOrders/status";
import { WORK_ORDER_THRESHOLDS } from "@shared/workOrders/constants";
import * as repo from "../repositories/workOrderRepository";
import {
  generatePlannedWorkOrderNumber,
  isBlockingStatus,
  isJobCritical,
  extractJobNoFromWorkOrderNo,
} from "../utils/workOrderNumbering";

export async function autoGenerate(body: any) {
  const { vesselId } = body;
  if (!vesselId) return { error: 'vesselId is required' };

  const [vesselSettings, allJobs, existingWOs, allComponents, allJobComponentLinks] = await Promise.all([
    repo.getPmsVesselSettings(vesselId),
    repo.getJobs(vesselId),
    repo.getWorkOrdersByVessel(vesselId),
    repo.getComponents(vesselId),
    repo.getAllJobComponentLinks(),
  ]);

  const componentMap = new Map(allComponents.map(c => [c.id, c]));
  const componentByCodeMap = new Map(allComponents.map(c => [c.componentCode, c]));

  const jobLinksMap = new Map<string, Array<{ componentId: string; componentCode: string; componentName: string }>>();
  for (const link of allJobComponentLinks) {
    if (!jobLinksMap.has(link.jobId)) jobLinksMap.set(link.jobId, []);
    const comp = componentMap.get(link.componentId);
    if (comp) {
      jobLinksMap.get(link.jobId)!.push({
        componentId: comp.id,
        componentCode: comp.componentCode || '',
        componentName: comp.name || '',
      });
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const generated: any[] = [];
  const skipped: any[] = [];

  function getCalendarLeadDays(job: any): number {
    if (!vesselSettings) return 0;
    return isJobCritical(job)
      ? vesselSettings.calendarLeadDaysCritical
      : vesselSettings.calendarLeadDaysNonCritical;
  }

  function getRhLeadHours(job: any): number {
    if (!vesselSettings) return 0;
    return isJobCritical(job)
      ? vesselSettings.rhLeadHoursCritical
      : vesselSettings.rhLeadHoursNonCritical;
  }

  for (const job of allJobs) {
    if (job.dataScope !== 'vessel') continue;
    if (!job.maintenanceBasis) continue;
    if (job.isActive === false) continue;

    if (job.maintenanceBasis === 'Calendar') {
      if (!job.nextDueDate) continue;

      const dueDate = parseFlexibleDate(job.nextDueDate);
      if (!dueDate) continue;

      const leadDays = getCalendarLeadDays(job);
      const generateDate = new Date(dueDate);
      generateDate.setDate(generateDate.getDate() - leadDays);

      if (today < generateDate) continue;

      const dueDateStr = dueDate.toISOString().split('T')[0];
      const generateDateStr = generateDate.toISOString().split('T')[0];

      let linkedComponents = jobLinksMap.get(job.id) || [];
      if (linkedComponents.length === 0 && job.componentId) {
        const primaryComp = componentMap.get(job.componentId);
        if (primaryComp) {
          linkedComponents = [{
            componentId: primaryComp.id,
            componentCode: primaryComp.componentCode || '',
            componentName: primaryComp.name || '',
          }];
        }
      }

      if (linkedComponents.length === 0) {
        skipped.push({ jobId: job.id, reason: 'No linked components' });
        continue;
      }

      for (const linkedComp of linkedComponents) {
        if (!linkedComp.componentCode) continue;

        const existingActiveWO = existingWOs.find(wo =>
          wo.jobId === job.id &&
          wo.componentCode === linkedComp.componentCode &&
          isBlockingStatus(wo.status)
        );
        if (existingActiveWO) {
          skipped.push({ jobId: job.id, componentCode: linkedComp.componentCode, reason: 'Active WO already exists' });
          continue;
        }

        const componentCycleKey = existingWOs.find(wo =>
          wo.jobId === job.id &&
          wo.componentCode === linkedComp.componentCode &&
          wo.cycleDueDateSnapshot === dueDateStr &&
          !isCompletedCancelled(wo.status)
        );
        if (componentCycleKey) {
          skipped.push({ jobId: job.id, componentCode: linkedComp.componentCode, reason: 'Cycle duplicate exists' });
          continue;
        }

        const workOrderNo = await generatePlannedWorkOrderNumber(job.jobNo, linkedComp.componentCode, vesselId);

        const woData: any = {
          id: uuidv4(),
          vesselId,
          component: linkedComp.componentName,
          componentCode: linkedComp.componentCode,
          jobId: job.id,
          workOrderNo,
          workOrderType: 'Planned',
          templateCode: workOrderNo,
          jobTitle: job.jobTitle,
          assignedTo: job.assignedTo || 'Unassigned',
          dueDate: job.nextDueDate,
          status: 'Due',
          taskType: job.maintenanceType,
          maintenanceBasis: job.maintenanceBasis,
          maintenanceType: job.maintenanceType,
          frequencyValue: job.frequencyValue?.toString(),
          frequencyUnit: job.frequencyUnit,
          jobPriority: job.jobPriority,
          classRelated: job.classRelated,
          department: job.department,
          briefWorkDescription: job.briefWorkDescription,
          criticality: job.criticality,
          approver: job.approver,
          dataScope: 'vessel',
          requiredSpareParts: job.requiredSpareParts || [],
          requiredTools: job.requiredTools || [],
          safetyRequirements: job.safetyRequirements || { ppeRequirements: [], permitRequirements: [], otherRequirements: [] },
          driverType: 'CALENDAR',
          cycleDueDateSnapshot: dueDateStr,
          generateDateSnapshot: generateDateStr,
          dueDateSnapshot: dueDateStr,
          lastDoneDateSnapshot: job.lastDoneDate || null,
        };

        try {
          const result = await repo.createWorkOrder(woData);
          generated.push(result);
          existingWOs.push(result);
        } catch (err: any) {
          skipped.push({ jobId: job.id, componentCode: linkedComp.componentCode, reason: err.message });
        }
      }
    } else if (job.maintenanceBasis === 'Running Hours') {
      if (!job.nextDueRH) continue;

      let linkedComponents = jobLinksMap.get(job.id) || [];
      if (linkedComponents.length === 0 && job.componentId) {
        const primaryComp = componentMap.get(job.componentId);
        if (primaryComp) {
          linkedComponents = [{
            componentId: primaryComp.id,
            componentCode: primaryComp.componentCode || '',
            componentName: primaryComp.name || '',
          }];
        }
      }

      if (linkedComponents.length === 0) {
        skipped.push({ jobId: job.id, reason: 'No linked components for RH job' });
        continue;
      }

      for (const linkedComp of linkedComponents) {
        const component = componentMap.get(linkedComp.componentId);
        if (!component) continue;

        const dueRH = parseFloat(job.nextDueRH);
        const currentRH = parseFloat(component.currentCumulativeRH || '0');
        if (isNaN(dueRH) || isNaN(currentRH)) continue;

        const leadHours = getRhLeadHours(job);
        const generateRH = dueRH - leadHours;

        if (currentRH < generateRH) continue;

        const existingActiveWO = existingWOs.find(wo =>
          wo.jobId === job.id &&
          wo.componentCode === linkedComp.componentCode &&
          isBlockingStatus(wo.status)
        );
        if (existingActiveWO) {
          skipped.push({ jobId: job.id, componentCode: linkedComp.componentCode, reason: 'Active WO already exists' });
          continue;
        }

        const hasCycleDuplicate = existingWOs.find(wo =>
          wo.jobId === job.id &&
          wo.componentCode === linkedComp.componentCode &&
          wo.cycleDueRhSnapshot !== null &&
          parseFloat(wo.cycleDueRhSnapshot || '0') === dueRH &&
          !isCompletedCancelled(wo.status)
        );
        if (hasCycleDuplicate) {
          skipped.push({ jobId: job.id, componentCode: linkedComp.componentCode, reason: 'Cycle duplicate exists' });
          continue;
        }

        const workOrderNo = await generatePlannedWorkOrderNumber(job.jobNo, linkedComp.componentCode, vesselId);

        const woData: any = {
          id: uuidv4(),
          vesselId,
          component: linkedComp.componentName,
          componentCode: linkedComp.componentCode,
          jobId: job.id,
          workOrderNo,
          workOrderType: 'Planned',
          templateCode: workOrderNo,
          jobTitle: job.jobTitle,
          assignedTo: job.assignedTo || 'Unassigned',
          status: 'Due',
          taskType: job.maintenanceType,
          maintenanceBasis: job.maintenanceBasis,
          maintenanceType: job.maintenanceType,
          frequencyValue: job.frequencyValue?.toString(),
          frequencyUnit: job.frequencyUnit,
          jobPriority: job.jobPriority,
          classRelated: job.classRelated,
          department: job.department,
          briefWorkDescription: job.briefWorkDescription,
          criticality: job.criticality,
          approver: job.approver,
          dataScope: 'vessel',
          requiredSpareParts: job.requiredSpareParts || [],
          requiredTools: job.requiredTools || [],
          safetyRequirements: job.safetyRequirements || { ppeRequirements: [], permitRequirements: [], otherRequirements: [] },
          driverType: 'RH',
          cycleDueRhSnapshot: dueRH.toString(),
          generateRhSnapshot: generateRH.toString(),
          dueRhSnapshot: dueRH.toString(),
          effectiveRhAtGeneration: currentRH.toString(),
          rhLastDoneSnapshot: job.lastDoneRH,
        };

        try {
          const result = await repo.createWorkOrder(woData);
          generated.push(result);
          existingWOs.push(result);
        } catch (err: any) {
          skipped.push({ jobId: job.id, componentCode: linkedComp.componentCode, reason: err.message });
        }
      }
    }
  }

  return { generated, skipped, totalGenerated: generated.length, totalSkipped: skipped.length };
}

function isCompletedCancelled(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return s === 'cancelled' || s === 'canceled';
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
    if (wo.status === 'Completed' || wo.status === 'Approved') continue;
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

    const jobCritical = job ? isJobCritical(job) : false;
    const classRelatedYes = job?.classRelated === 'Yes' || job?.classRelated === 'true' || (job?.classRelated as any) === true;
    const effectiveCritical = jobCritical || classRelatedYes;

    const rhLeadTimeHours = wo.maintenanceBasis === 'Running Hours'
      ? (effectiveCritical
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
