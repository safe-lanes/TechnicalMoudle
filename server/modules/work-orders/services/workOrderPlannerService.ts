import * as jobRepo from '../../jobs/repositories/jobRepository';
import { WORK_ORDER_THRESHOLDS } from '@shared/workOrders/constants';
import { ValidationError } from '../../shared/errors';
import { getDb } from '../../../db';
import { plannerDates, type Job, type Component, type WorkOrder, type PmsVesselSettings } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface WorkOrderPlannerFilters {
  vesselId: string;
  days?: number;
  rank?: string;
  search?: string;
}

export interface PlannerItem {
  jobId: string;
  jobCode: string;
  jobTitle: string;
  jobType: 'CALENDAR' | 'RH';
  componentId: string;
  componentCode: string;
  componentName: string;
  assignedTo: string;
  maintenanceBasis: string;
  frequency: string;
  dueInfo: string;
  status: string;
  woNo: string | null;
  woStatus: string | null;
  plannedDate: string | null;
}

interface VesselGraceSettings {
  calendarGraceMode: 'COMPANY_STANDARD' | 'CUSTOM_DAYS';
  calendarGraceDays: number;
  rhGraceHours: number;
}

const RH_PER_DAY = 24;

function buildVesselGraceSettings(vesselSettings: PmsVesselSettings | undefined): VesselGraceSettings {
  if (!vesselSettings) {
    return {
      calendarGraceMode: 'COMPANY_STANDARD',
      calendarGraceDays: WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
      rhGraceHours: WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
    };
  }
  return {
    calendarGraceMode: (vesselSettings.calendarGraceMode || 'COMPANY_STANDARD') as 'COMPANY_STANDARD' | 'CUSTOM_DAYS',
    calendarGraceDays: vesselSettings.calendarGraceDays ?? WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
    rhGraceHours: vesselSettings.rhGraceHours ?? WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
  };
}

export async function getWorkOrderPlannerData(filters: WorkOrderPlannerFilters) {
  const { vesselId, days = 30, rank, search } = filters;

  if (!vesselId) {
    throw new ValidationError('vesselId is required');
  }

  const vesselSettings = await jobRepo.findPmsVesselSettings(vesselId);
  const graceSettings = buildVesselGraceSettings(vesselSettings);

  const allJobs: Job[] = await jobRepo.findJobs(vesselId);
  const activeJobs = allJobs.filter(j => j.isActive !== false && j.dataScope === 'vessel');

  const allComponents: Component[] = await jobRepo.findComponents(vesselId);
  const componentMap = new Map(allComponents.map(c => [c.cuuid, c]));
  const componentCodeMap = new Map<string, Component>();
  for (const c of allComponents) {
    if (c.componentCode) {
      componentCodeMap.set(c.componentCode, c);
    }
  }

  const jobComponentLinks = await jobRepo.findJobComponentLinks(vesselId);
  const jobToComponentsMap = new Map<string, Set<string>>();
  for (const link of jobComponentLinks) {
    if (!jobToComponentsMap.has(link.jobId)) {
      jobToComponentsMap.set(link.jobId, new Set());
    }
    jobToComponentsMap.get(link.jobId)!.add(link.componentId);
  }

  const allWorkOrders: WorkOrder[] = await jobRepo.findWorkOrders(vesselId);

  const woByJobAndComponent = new Map<string, WorkOrder>();
  for (const wo of allWorkOrders) {
    if (wo.status === 'Completed' || wo.status === 'Rejected') continue;
    const key = `${wo.jobId}::${wo.componentCode || ''}`;
    if (!woByJobAndComponent.has(key)) {
      woByJobAndComponent.set(key, wo);
    }
  }

  const database = await getDb();
  const savedPlannerDates = await database.select().from(plannerDates).where(eq(plannerDates.vesselId, vesselId));
  const plannerDateMap = new Map<string, string>();
  for (const pd of savedPlannerDates) {
    plannerDateMap.set(`${pd.jobId}::${pd.componentId}`, pd.plannedDate || '');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const horizonDate = new Date(today);
  horizonDate.setDate(horizonDate.getDate() + days);

  const projectedRHIncrease = RH_PER_DAY * days;

  interface JobComponentPair {
    job: Job;
    componentId: string;
    component: Component | undefined;
  }

  const jobComponentPairs: JobComponentPair[] = [];

  for (const job of activeJobs) {
    const linkedComponentIds = jobToComponentsMap.get(job.juuid);
    if (linkedComponentIds && linkedComponentIds.size > 0) {
      for (const cid of Array.from(linkedComponentIds)) {
        const component = componentMap.get(cid);
        jobComponentPairs.push({ job, componentId: cid, component });
      }
    } else {
      const component = (job.componentId ? componentMap.get(job.componentId) : undefined)
        || (job.componentCode ? componentCodeMap.get(job.componentCode) : undefined);
      if (component) {
        jobComponentPairs.push({ job, componentId: component.cuuid, component });
      } else if (job.componentId || job.componentCode) {
        jobComponentPairs.push({ job, componentId: job.componentId || '', component: undefined });
      }
    }
  }

  const plannerItems: PlannerItem[] = [];

  for (const { job, componentId, component } of jobComponentPairs) {
    const isCalendarJob = job.maintenanceBasis === 'Calendar' || job.frequencyType === 'Calendar';
    const isRHJob = job.maintenanceBasis === 'Running Hours' || job.frequencyType === 'Running Hours';

    if (!isCalendarJob && !isRHJob) continue;

    if (rank && rank !== 'all') {
      const assignedRank = (job.assignedTo || '').trim();
      if (assignedRank !== rank) continue;
    }

    let status = 'Upcoming';
    let dueInfo = '-';
    let shouldInclude = false;

    if (isCalendarJob) {
      let nextDueDate: Date | null = null;

      if (job.nextDueDate) {
        nextDueDate = new Date(job.nextDueDate);
      } else if (job.lastDoneDate && job.frequencyValue && job.frequencyUnit) {
        const lastDone = new Date(job.lastDoneDate);
        const freqVal = parseInt(job.frequencyValue) || 0;
        nextDueDate = new Date(lastDone);
        switch (job.frequencyUnit) {
          case 'Days': nextDueDate.setDate(nextDueDate.getDate() + freqVal); break;
          case 'Weeks': nextDueDate.setDate(nextDueDate.getDate() + freqVal * 7); break;
          case 'Months': nextDueDate.setMonth(nextDueDate.getMonth() + freqVal); break;
          case 'Years': nextDueDate.setFullYear(nextDueDate.getFullYear() + freqVal); break;
        }
      }

      if (nextDueDate) {
        const dueDateTime = new Date(nextDueDate);
        dueDateTime.setHours(0, 0, 0, 0);
        const daysUntilDue = Math.floor((dueDateTime.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let graceEndDate: Date;
        if (graceSettings.calendarGraceMode === 'CUSTOM_DAYS') {
          graceEndDate = new Date(dueDateTime);
          graceEndDate.setDate(graceEndDate.getDate() + graceSettings.calendarGraceDays);
        } else {
          const endOfMonth = new Date(dueDateTime.getFullYear(), dueDateTime.getMonth() + 1, 0);
          endOfMonth.setHours(0, 0, 0, 0);
          const daysUntilEndOfMonth = endOfMonth.getDate() - dueDateTime.getDate();
          if (daysUntilEndOfMonth <= 7) {
            graceEndDate = new Date(dueDateTime);
            graceEndDate.setDate(graceEndDate.getDate() + WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS);
          } else {
            graceEndDate = endOfMonth;
          }
        }

        if (daysUntilDue < 0) {
          if (today > graceEndDate) {
            status = 'Overdue';
          } else {
            status = 'Due (Grace P)';
          }
          shouldInclude = true;
        } else if (dueDateTime <= horizonDate) {
          status = daysUntilDue === 0 ? 'Due' : 'Upcoming';
          shouldInclude = true;
        }

        dueInfo = nextDueDate.toISOString().split('T')[0];
      }
    } else if (isRHJob) {
      let rhSourceComponent: Component | undefined = component;
      if (component?.parentId) {
        rhSourceComponent = componentMap.get(component.parentId) || component;
      }

      const currentRH = parseFloat(String(rhSourceComponent?.currentCumulativeRH || '0')) || 0;
      const lastDoneRH = parseFloat(job.lastDoneRH || '0') || 0;
      const frequencyRH = parseInt(job.frequencyValue || '0') || job.intervalRunningHour || 0;

      const rhDue = lastDoneRH + frequencyRH;
      const rhRemaining = rhDue - currentRH;
      const projectedRH = currentRH + projectedRHIncrease;

      const graceHours = graceSettings.rhGraceHours;

      if (rhRemaining < -graceHours) {
        status = 'Overdue';
        shouldInclude = true;
      } else if (rhRemaining < 0) {
        status = 'Due (Grace P)';
        shouldInclude = true;
      } else if (rhDue <= projectedRH) {
        status = rhRemaining <= 0 ? 'Due' : 'Upcoming';
        shouldInclude = true;
      }

      dueInfo = `${rhDue.toLocaleString()} RH`;
    }

    if (!shouldInclude) continue;

    if (search) {
      const searchLower = search.toLowerCase();
      const jobTitle = (job.jobTitle || '').toLowerCase();
      const jobCode = (job.jobNo || '').toLowerCase();
      const compName = (component?.name || '').toLowerCase();
      const compCode = (component?.componentCode || '').toLowerCase();
      if (!jobTitle.includes(searchLower) && !jobCode.includes(searchLower) &&
          !compName.includes(searchLower) && !compCode.includes(searchLower)) {
        continue;
      }
    }

    const compCodeForLookup = component?.componentCode || job.componentCode || '';
    const woKey = `${job.juuid}::${compCodeForLookup}`;
    const relevantWO = woByJobAndComponent.get(woKey) || null;

    const savedDate = plannerDateMap.get(`${job.juuid}::${componentId}`) || null;

    const freq = job.frequencyValue
      ? `${job.frequencyValue} ${job.frequencyUnit || (isRHJob ? 'RH' : '')}`.trim()
      : '-';

    plannerItems.push({
      jobId: job.juuid,
      jobCode: job.jobNo || '-',
      jobTitle: job.jobTitle || '-',
      jobType: isCalendarJob ? 'CALENDAR' : 'RH',
      componentId,
      componentCode: component?.componentCode || job.componentCode || '-',
      componentName: component?.name || job.componentName || '-',
      assignedTo: job.assignedTo || 'Unassigned',
      maintenanceBasis: isCalendarJob ? 'Calendar' : 'Running Hours',
      frequency: freq,
      dueInfo,
      status,
      woNo: relevantWO?.workOrderNo || null,
      woStatus: relevantWO?.status || null,
      plannedDate: savedDate,
    });
  }

  const statusPriority: Record<string, number> = {
    'Overdue': 0,
    'Due (Grace P)': 1,
    'Due': 2,
    'Upcoming': 3,
  };

  plannerItems.sort((a, b) => {
    const sPri = (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99);
    if (sPri !== 0) return sPri;
    return 0;
  });

  return { items: plannerItems, total: plannerItems.length };
}

export async function savePlannedDate(vesselId: string, jobId: string, componentId: string, plannedDate: string | null) {
  if (!vesselId || !jobId || !componentId) {
    throw new ValidationError('vesselId, jobId, and componentId are required');
  }

  const database = await getDb();
  const existing = await database.select().from(plannerDates).where(
    and(
      eq(plannerDates.vesselId, vesselId),
      eq(plannerDates.jobId, jobId),
      eq(plannerDates.componentId, componentId)
    )
  );

  if (existing.length > 0) {
    await database.update(plannerDates)
      .set({ plannedDate: plannedDate || null, updatedAt: new Date() })
      .where(
        and(
          eq(plannerDates.vesselId, vesselId),
          eq(plannerDates.jobId, jobId),
          eq(plannerDates.componentId, componentId)
        )
      );
  } else {
    await database.insert(plannerDates).values({
      vesselId,
      jobId,
      componentId,
      plannedDate: plannedDate || null,
    });
  }

  return { success: true };
}

export async function exportPlannerExcel(filters: WorkOrderPlannerFilters) {
  const XLSX = await import('xlsx');
  const data = await getWorkOrderPlannerData(filters);

  const rows = data.items.map((item, idx) => ({
    'S.No': idx + 1,
    'Component': item.componentName,
    'Job Code': item.jobCode,
    'Job Title': item.jobTitle,
    'Maintenance Basis': item.maintenanceBasis,
    'Frequency': item.frequency,
    'Due Date / RH': item.dueInfo,
    'Status': item.status,
    'Assigned To': item.assignedTo,
    'Work Order': item.woNo || '-',
    'WO Status': item.woStatus || '-',
    'Planned Date': item.plannedDate || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 }, { wch: 30 }, { wch: 20 }, { wch: 40 },
    { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
    { wch: 16 }, { wch: 25 }, { wch: 14 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Work Order Planner');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}
