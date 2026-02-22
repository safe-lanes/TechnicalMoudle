import * as repo from '../repositories/jobRepository';
import { WORK_ORDER_THRESHOLDS } from '@shared/workOrders/constants';
import { ValidationError } from '../../shared/errors';

// ── Types ──

interface PlannerFilters {
  vesselId: string;
  jobType?: string;       // 'CALENDAR' | 'RH' | 'BOTH'
  fromDate?: string;
  toDate?: string;
  remainingHoursMin?: string;
  remainingHoursMax?: string;
  includeOverdue?: string; // boolean string
  includeGrace?: string;   // boolean string
  ranks?: string;          // comma-separated
  department?: string;
  criticalOnly?: string;   // boolean string
}

type PlannerStatus = 'OVERDUE' | 'DUE_GRACE' | 'DUE_SOON' | 'FUTURE';

// ── Main Planner Logic ──

export async function getMaintenancePlannerData(filters: PlannerFilters) {
  const {
    vesselId, jobType, fromDate, toDate,
    remainingHoursMin, remainingHoursMax,
    includeOverdue, includeGrace,
    ranks, department, criticalOnly
  } = filters;

  if (!vesselId) {
    throw new ValidationError('vesselId is required');
  }

  // Fetch vessel PMS settings for grace period configuration
  // This aligns with work order table status logic
  const vesselSettings = await repo.findPmsVesselSettings(vesselId);
  const vs = vesselSettings as any;
  const vesselGraceSettings = vesselSettings ? {
    calendarGraceMode: (vesselSettings.calendarGraceMode || 'COMPANY_STANDARD') as 'COMPANY_STANDARD' | 'CUSTOM_DAYS',
    calendarGraceDays: vesselSettings.calendarGraceDays ?? WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
    rhGraceHours: vesselSettings.rhGraceHours ?? WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
    rhLeadTimeHours: (vs.rhLeadTimeHours ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS) as number
  } : {
    calendarGraceMode: 'COMPANY_STANDARD' as const,
    calendarGraceDays: WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS,
    rhGraceHours: WORK_ORDER_THRESHOLDS.RH_GRACE_PERIOD_HOURS,
    rhLeadTimeHours: WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS
  };

  // Fetch all active jobs for the vessel
  const allJobs = await repo.findJobs(vesselId);
  const activeJobs = allJobs.filter(j => (j as any).isActive !== false && (j as any).dataScope === 'vessel');

  // Fetch all components for RH lookup
  const components = await repo.findComponents(vesselId);
  const componentMap = new Map(components.map(c => [c.cuuid, c]));
  const componentCodeMap = new Map(components.map(c => [(c as any).componentCode, c]));

  // Fetch job-component links (many-to-many relationships)
  // This is the PRIMARY source of truth for which components each job is linked to
  const jobComponentLinks = await repo.findJobComponentLinks(vesselId);

  // Build a map of jobId -> array of linked componentIds
  const jobToComponentsMap = new Map<string, Set<string>>();
  for (const link of jobComponentLinks) {
    if (!jobToComponentsMap.has(link.jobId)) {
      jobToComponentsMap.set(link.jobId, new Set());
    }
    jobToComponentsMap.get(link.jobId)!.add(link.componentId);
  }

  // Fetch all work orders to check for open WOs
  const allWorkOrders = await repo.findWorkOrders(vesselId);

  // Fetch spares for spare status calculation
  const allSpares = await repo.findSpares(vesselId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Process each job and compute planning data
  // IMPORTANT: A job can be linked to MULTIPLE components via jobComponentLinks
  // Each job-component pair is a separate planner row
  const plannerItems: any[] = [];

  // Build list of job-component pairs to process
  interface JobComponentPair {
    job: typeof activeJobs[0];
    componentId: string;
    component: typeof components[0] | undefined;
  }

  const jobComponentPairs: JobComponentPair[] = [];

  for (const job of activeJobs) {
    const linkedComponentIds = jobToComponentsMap.get(job.id);

    if (linkedComponentIds && linkedComponentIds.size > 0) {
      // Job has entries in jobComponentLinks - use those (many-to-many)
      for (const componentId of Array.from(linkedComponentIds)) {
        const component = componentMap.get(componentId);
        jobComponentPairs.push({ job, componentId, component });
      }
    } else {
      // Fallback: Use deprecated componentId/componentCode fields (backward compatibility)
      const component = componentMap.get(job.componentId as string) || componentCodeMap.get(job.componentCode);
      if (component) {
        jobComponentPairs.push({ job, componentId: component.cuuid, component });
      } else if (job.componentId || job.componentCode) {
        // Job references a component that doesn't exist - still include for visibility
        jobComponentPairs.push({ job, componentId: job.componentId || '', component: undefined });
      }
    }
  }

  // Now process each job-component pair
  for (const { job, componentId, component } of jobComponentPairs) {

    // Determine job type (Calendar vs Running Hours)
    const isCalendarJob = job.maintenanceBasis === 'Calendar' || (job as any).frequencyType === 'Calendar';
    const isRHJob = job.maintenanceBasis === 'Running Hours' || (job as any).frequencyType === 'Running Hours';

    // Apply job type filter
    const jobTypeFilter = jobType?.toUpperCase();
    if (jobTypeFilter === 'CALENDAR' && !isCalendarJob) continue;
    if (jobTypeFilter === 'RH' && !isRHJob) continue;

    // Apply department filter - check both job.department and component.department
    if (department && department !== 'all') {
      const jobDept = job.department || (component as any)?.department || '';
      if (jobDept !== department) continue;
    }

    // Apply rank filter - use exact match (case-insensitive) instead of substring includes
    if (ranks) {
      const rankList = ranks.split(',').map(r => r.trim().toLowerCase());
      const assignedRank = (job.assignedTo || '').trim().toLowerCase();
      // FIXED: Use exact match instead of substring includes to prevent "AB" matching "Cable"
      if (rankList.length > 0 && !rankList.some(r => r === assignedRank)) continue;
    }

    // Apply criticality filter
    if (criticalOnly === 'true') {
      const isCritical = job.criticality === 'Yes' || job.jobPriority === 'Critical' || (component as any)?.critical;
      if (!isCritical) continue;
    }

    // Calculate status and dates - ALIGNED WITH WORK ORDER TABLE LOGIC
    // Uses grace period configuration from vessel settings
    let nextDueDate: Date | null = null;
    let remainingHours: number | null = null;
    let status: PlannerStatus = 'FUTURE';
    let parentRH: number | null = null;

    if (isCalendarJob) {
      // Parse next due date
      if (job.nextDueDate) {
        nextDueDate = new Date(job.nextDueDate);
      } else if (job.lastDoneDate && job.frequencyValue && job.frequencyUnit) {
        // Calculate from last done
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

        // Calculate grace end date based on vessel settings (same as work order logic)
        let graceEndDate: Date;
        if (vesselGraceSettings.calendarGraceMode === 'CUSTOM_DAYS') {
          // Use custom fixed grace period
          graceEndDate = new Date(dueDateTime);
          graceEndDate.setDate(graceEndDate.getDate() + vesselGraceSettings.calendarGraceDays);
          graceEndDate.setHours(0, 0, 0, 0);
        } else {
          // COMPANY_STANDARD: If due date is in last 7 days of month → grace = 7 days
          // Otherwise → grace extends to end of the due month
          const endOfMonth = new Date(dueDateTime.getFullYear(), dueDateTime.getMonth() + 1, 0);
          endOfMonth.setHours(0, 0, 0, 0);
          const daysUntilEndOfMonth = endOfMonth.getDate() - dueDateTime.getDate();

          if (daysUntilEndOfMonth <= 7) {
            // Due date is in last 7 days of month - use fixed 7-day grace
            graceEndDate = new Date(dueDateTime);
            graceEndDate.setDate(graceEndDate.getDate() + WORK_ORDER_THRESHOLDS.CALENDAR_GRACE_PERIOD_DAYS);
            graceEndDate.setHours(0, 0, 0, 0);
          } else {
            // Grace extends to end of month
            graceEndDate = endOfMonth;
          }
        }

        // Status logic aligned with work order table:
        // - OVERDUE: today is past grace end date
        // - DUE_GRACE: past due date but within grace (today <= grace end date)
        // - DUE_SOON: approaching but not yet due (positive days within lead time)
        // - FUTURE: more than lead time away
        if (daysUntilDue < 0) {
          // Past due date - check if we're still in grace period
          if (today > graceEndDate) {
            status = 'OVERDUE';
          } else {
            status = 'DUE_GRACE';
          }
        } else if (daysUntilDue <= WORK_ORDER_THRESHOLDS.CALENDAR_LEAD_TIME_DAYS) {
          status = 'DUE_SOON';
        } else {
          status = 'FUTURE';
        }

        // Apply date range filter
        if (fromDate || toDate) {
          const from = fromDate ? new Date(fromDate) : new Date(0);
          const to = toDate ? new Date(toDate) : new Date('2099-12-31');

          // Skip overdue/grace items based on filter settings
          if (status === 'OVERDUE' && includeOverdue !== 'true') continue;
          if (status === 'DUE_GRACE' && includeOverdue !== 'true' && includeGrace !== 'true') continue;
          if (status !== 'OVERDUE' && status !== 'DUE_GRACE' && (nextDueDate < from || nextDueDate > to)) continue;
        }
      }
    } else if (isRHJob) {
      // Find parent component for RH
      // FIXED: Use componentMap (by ID) instead of componentCodeMap (by code)
      // since parentId contains an ID, not a component code
      let parentComponent: any = component;
      if ((component as any)?.parentId) {
        parentComponent = componentMap.get((component as any).parentId) || component;
      }

      parentRH = parseFloat(parentComponent?.currentCumulativeRH || '0') || 0;
      const lastDoneRH = parseFloat(job.lastDoneRH || '0') || 0;
      const frequencyRH = parseInt(job.frequencyValue || '0') || (job as any).intervalRunningHour || 0;

      // Calculate RH due and remaining using work order logic
      const rhDue = lastDoneRH + frequencyRH;
      const rhRemaining = rhDue - parentRH;
      remainingHours = Math.max(0, rhRemaining);

      // Get lead time from vessel settings or job-level settings
      const leadTimeHours = vesselGraceSettings.rhLeadTimeHours;
      const graceHours = vesselGraceSettings.rhGraceHours;

      // Status logic aligned with work order table (spec-compliant):
      // - OVERDUE: Past due RH AND past grace period (rhRemaining < -graceHours)
      // - DUE_GRACE: Past due RH but within grace period (-graceHours <= rhRemaining < 0)
      // - DUE_SOON: Within lead time (0 <= rhRemaining <= leadTimeHours)
      // - FUTURE: Beyond lead time (rhRemaining > leadTimeHours)
      if (rhRemaining < -graceHours) {
        status = 'OVERDUE';
      } else if (rhRemaining < 0) {
        status = 'DUE_GRACE';
      } else if (rhRemaining <= leadTimeHours) {
        status = 'DUE_SOON';
      } else {
        status = 'FUTURE';
      }

      // Apply RH range filter
      if (remainingHoursMin || remainingHoursMax) {
        const minRH = parseFloat(remainingHoursMin as string) || 0;
        const maxRH = parseFloat(remainingHoursMax as string) || Infinity;

        // Skip overdue/grace items based on filter settings
        if (status === 'OVERDUE' && includeOverdue !== 'true') continue;
        if (status === 'DUE_GRACE' && includeOverdue !== 'true' && includeGrace !== 'true') continue;
        if (status !== 'OVERDUE' && status !== 'DUE_GRACE' && (remainingHours < minRH || remainingHours > maxRH)) continue;
      }
    }

    // Skip overdue/grace items when filters exclude them
    if (status === 'OVERDUE' && includeOverdue !== 'true') {
      continue;
    }
    if (status === 'DUE_GRACE' && includeOverdue !== 'true' && includeGrace !== 'true') {
      continue;
    }

    // Find open/active work orders for this job only
    // Completed/Rejected WOs are historical and not relevant for planning the current cycle
    const jobWOs = allWorkOrders.filter(wo => wo.jobId === job.id);
    const relevantWO = jobWOs.find(wo =>
      wo.status !== 'Completed' &&
      wo.status !== 'Rejected'
    ) || null;

    // Calculate spare status
    let spareStatus: 'OK' | 'LOW' | 'ZERO' | 'NOT_SET' = 'NOT_SET';
    const requiredSpares = job.requiredSpareParts as any[] || [];

    if (requiredSpares.length > 0) {
      let hasZero = false;
      let hasLow = false;

      for (const reqSpare of requiredSpares) {
        // Primary match: by Part Code (correct design)
        // Fallback: by Part Number or description for legacy compatibility
        const spare = allSpares.find(s =>
          (reqSpare.partCode && (s as any).partCode === reqSpare.partCode) ||
          (reqSpare.partNo && (s as any).partCode === reqSpare.partNo) ||
          (s as any).partName === reqSpare.description
        );
        if (spare) {
          if ((spare as any).rob === 0) hasZero = true;
          else if ((spare as any).rob < (spare as any).min) hasLow = true;
        }
      }

      if (hasZero) spareStatus = 'ZERO';
      else if (hasLow) spareStatus = 'LOW';
      else spareStatus = 'OK';
    }

    // Build planner item using the component from the job-component pair
    // This ensures multi-component jobs appear as separate rows
    plannerItems.push({
      jobId: job.id,
      jobCode: job.jobNo,
      jobTitle: job.jobTitle,
      jobType: isCalendarJob ? 'CALENDAR' : 'RH',
      componentId: componentId,
      componentCode: (component as any)?.componentCode || job.componentCode || '',
      componentName: (component as any)?.name || job.componentName || '',
      department: job.department || (component as any)?.department || 'N/A',
      assignedRank: job.assignedTo || 'Unassigned',
      criticalFlag: job.criticality === 'Yes' || job.jobPriority === 'Critical' || (component as any)?.critical || false,
      classRelatedFlag: job.classRelated === 'Yes',
      estimatedManHours: parseFloat((job as any).estimatedManHours || '0') || 0,
      nextDueDate: nextDueDate ? nextDueDate.toISOString().split('T')[0] : null,
      remainingHours: remainingHours,
      parentRH: parentRH,
      status: status,
      woId: relevantWO?.id || null,
      woNo: (relevantWO as any)?.workOrderNo || null,
      woStatus: relevantWO?.status || null,
      spareStatus: spareStatus,
      frequencyValue: job.frequencyValue,
      frequencyUnit: job.frequencyUnit,
      lastDoneDate: job.lastDoneDate,
      lastDoneRH: job.lastDoneRH
    });
  }

  // Sort by status priority and due date/remaining hours
  // Priority order aligned with work order table: OVERDUE > DUE_GRACE > DUE_SOON > FUTURE
  const statusPriority: Record<string, number> = {
    'OVERDUE': 0,
    'DUE_GRACE': 1,
    'DUE_SOON': 2,
    'FUTURE': 3
  };

  plannerItems.sort((a, b) => {
    // First by status
    const statusDiff = statusPriority[a.status] - statusPriority[b.status];
    if (statusDiff !== 0) return statusDiff;

    // Then by due date (nearest first) for calendar jobs
    if (a.jobType === 'CALENDAR' && b.jobType === 'CALENDAR') {
      if (a.nextDueDate && b.nextDueDate) {
        return new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime();
      }
    }

    // By remaining hours (lowest first) for RH jobs
    if (a.jobType === 'RH' && b.jobType === 'RH') {
      return (a.remainingHours || 0) - (b.remainingHours || 0);
    }

    return 0;
  });

  // Calculate summary metrics
  // Sum actual manhours from completed/approved work orders for the vessel
  const completedStatuses = ['Completed', 'completed', 'Approved', 'approved'];
  const totalManHours = allWorkOrders
    .filter(wo => completedStatuses.includes(wo.status || ''))
    .reduce((sum, wo) => {
      const manhours = parseFloat((wo as any).manhours || '0');
      return sum + (isNaN(manhours) ? 0 : manhours);
    }, 0);

  const byRank: Record<string, { jobs: number; manHours: number }> = {};
  for (const item of plannerItems) {
    const rank = item.assignedRank || 'Unassigned';
    if (!byRank[rank]) byRank[rank] = { jobs: 0, manHours: 0 };
    byRank[rank].jobs++;
    byRank[rank].manHours += item.estimatedManHours;
  }

  const byDepartment: Record<string, { jobs: number; manHours: number }> = {};
  for (const item of plannerItems) {
    const dept = item.department || 'N/A';
    if (!byDepartment[dept]) byDepartment[dept] = { jobs: 0, manHours: 0 };
    byDepartment[dept].jobs++;
    byDepartment[dept].manHours += item.estimatedManHours;
  }

  // byStatus now includes DUE_GRACE to align with work order table logic
  const byStatus: Record<string, number> = { OVERDUE: 0, DUE_GRACE: 0, DUE_SOON: 0, FUTURE: 0 };
  for (const item of plannerItems) {
    byStatus[item.status]++;
  }

  return {
    summary: {
      totalJobs: plannerItems.length,
      totalManHours: Math.round(totalManHours * 10) / 10,
      byRank: Object.entries(byRank).map(([rank, data]) => ({
        rank,
        jobs: data.jobs,
        manHours: Math.round(data.manHours * 10) / 10
      })),
      byDepartment: Object.entries(byDepartment).map(([dept, data]) => ({
        department: dept,
        jobs: data.jobs,
        manHours: Math.round(data.manHours * 10) / 10
      })),
      byStatus
    },
    jobs: plannerItems
  };
}

// ── Export ──

export async function exportMaintenancePlanner(
  filters: PlannerFilters,
  format: string
) {
  const XLSX = await import('xlsx');

  // Call the planner service directly (no self-fetch)
  const plannerData = await getMaintenancePlannerData(filters);

  if (format === 'excel') {
    // Generate Excel file
    const wb = XLSX.utils.book_new();

    // Jobs sheet
    const jobsData = plannerData.jobs.map((job: any) => ({
      'Job Code': job.jobCode,
      'Job Title': job.jobTitle,
      'Component Code': job.componentCode,
      'Component Name': job.componentName,
      'Department': job.department,
      'Assigned Rank': job.assignedRank,
      'Job Type': job.jobType,
      'Next Due Date': job.nextDueDate || '-',
      'Remaining Hours': job.remainingHours !== null ? job.remainingHours : '-',
      'Status': job.status,
      'Est. Man-Hours': job.estimatedManHours,
      'Spare Status': job.spareStatus,
      'WO No.': job.woNo || '-',
      'WO Status': job.woStatus || '-',
      'Critical': job.criticalFlag ? 'Yes' : 'No',
      'Class Related': job.classRelatedFlag ? 'Yes' : 'No'
    }));

    const ws = XLSX.utils.json_to_sheet(jobsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Maintenance Planner');

    // Summary sheet
    const summaryData = [
      { 'Metric': 'Total Jobs', 'Value': plannerData.summary.totalJobs },
      { 'Metric': 'Total Man-Hours', 'Value': plannerData.summary.totalManHours },
      { 'Metric': 'Overdue Jobs', 'Value': plannerData.summary.byStatus.OVERDUE },
      { 'Metric': 'Due Soon Jobs', 'Value': plannerData.summary.byStatus.DUE_SOON },
      { 'Metric': 'Future Jobs', 'Value': plannerData.summary.byStatus.FUTURE }
    ];
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // Workload by Rank sheet
    const rankData = plannerData.summary.byRank.map((r: any) => ({
      'Rank': r.rank,
      'Jobs': r.jobs,
      'Man-Hours': r.manHours
    }));
    const rankWs = XLSX.utils.json_to_sheet(rankData);
    XLSX.utils.book_append_sheet(wb, rankWs, 'Workload by Rank');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return {
      type: 'excel' as const,
      buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `maintenance-planner-${new Date().toISOString().split('T')[0]}.xlsx`
    };
  } else {
    // Return JSON for PDF generation (frontend will handle PDF rendering)
    return {
      type: 'json' as const,
      data: plannerData
    };
  }
}
