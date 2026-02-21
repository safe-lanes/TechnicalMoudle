import * as repo from '../repositories/workOrderRepository';
import { ValidationError } from '../../shared/errors';
import { WORK_ORDER_THRESHOLDS } from '@shared/workOrders/constants';
import { shouldGenerateWorkOrder } from '@shared/dateUtils';

// ── Auto-Generate Work Orders ──

export async function autoGenerate(vesselId: string) {
  if (!vesselId) {
    throw new ValidationError('vesselId is required');
  }

  // Fetch vessel-specific PMS settings (lead times & grace periods)
  const vesselSettings = await repo.findPmsVesselSettings(vesselId);

  // Default lead times if vessel settings not configured
  const calendarLeadDaysCritical = vesselSettings?.calendarLeadDaysCritical ?? WORK_ORDER_THRESHOLDS.CALENDAR_LEAD_TIME_DAYS_CRITICAL;
  const calendarLeadDaysNonCritical = vesselSettings?.calendarLeadDaysNonCritical ?? WORK_ORDER_THRESHOLDS.CALENDAR_LEAD_TIME_DAYS_NON_CRITICAL;
  const rhLeadHoursCritical = vesselSettings?.rhLeadHoursCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_CRITICAL;
  const rhLeadHoursNonCritical = vesselSettings?.rhLeadHoursNonCritical ?? WORK_ORDER_THRESHOLDS.RH_LEAD_TIME_HOURS_NON_CRITICAL;

  console.log(`[AUTO-GEN] Using lead times for vessel ${vesselId}: Calendar (C: ${calendarLeadDaysCritical}d, NC: ${calendarLeadDaysNonCritical}d), RH (C: ${rhLeadHoursCritical}hrs, NC: ${rhLeadHoursNonCritical}hrs)`);

  // Get all active jobs for the vessel
  const allJobs = await repo.findJobs(vesselId);
  const calendarJobs = allJobs.filter((job: any) =>
    job.maintenanceBasis === 'Calendar' &&
    job.nextDueDate &&
    job.isActive !== false
  );
  const rhJobs = allJobs.filter((job: any) =>
    job.maintenanceBasis === 'Running Hours' &&
    job.nextDueRH &&
    job.isActive !== false
  );

  // Fetch all work orders ONCE to avoid O(n²) performance
  const allWorkOrders = await repo.findWorkOrders(vesselId);

  // Build a Set of active work order keys for fast lookup
  // Key format: "componentCode|jobNo" to uniquely identify a job's work order
  const activeWorkOrderKeys = new Set(
    allWorkOrders
      .filter((wo: any) => ['Active', 'Due', 'Due (Grace P)', 'Overdue', 'Pending Approval'].includes(wo.status))
      .map((wo: any) => `${wo.componentCode}|${wo.jobTitle}`)
  );

  const results = {
    checked: calendarJobs.length + rhJobs.length,
    generated: 0,
    workOrders: [] as any[],
    vesselSettingsUsed: vesselSettings ? true : false
  };

  // Fetch all components to get currentRH for RH-based jobs
  const allComponents = await repo.findComponents(vesselId);
  const componentsMap = new Map(allComponents.map((c: any) => [c.id, c]));
  const storage = repo.getStorage();

  // Process Calendar-based jobs
  for (const job of calendarJobs) {
    // Determine lead time based on job criticality
    const isCritical = (job as any).criticality === 'Yes' || (job as any).jobPriority === 'Critical';
    const leadTimeDays = isCritical ? calendarLeadDaysCritical : calendarLeadDaysNonCritical;

    const shouldGen = shouldGenerateWorkOrder((job as any).nextDueDate, new Date(), leadTimeDays);

    if (shouldGen) {
      // O(1) duplicate check using Set
      const workOrderKey = `${(job as any).componentCode}|${(job as any).jobTitle}`;

      if (!activeWorkOrderKeys.has(workOrderKey)) {
        // Generate spec-compliant work order number
        const { generatePlannedWorkOrderNumber } = await import('../../../utils/workOrderNumbering');
        const jobCode = (job as any).jobNo || 'JOB-UNKNOWN';
        // Get component code from job, fallback to component record
        let componentCode = (job as any).componentCode;
        if (!componentCode && (job as any).componentId) {
          const component = componentsMap.get((job as any).componentId);
          componentCode = component?.componentCode;
        }
        if (!componentCode) {
          console.warn(`⚠️ No component code for calendar job ${(job as any).jobNo} - skipping WO generation`);
          continue;
        }
        const workOrderNo = await generatePlannedWorkOrderNumber(storage, jobCode, componentCode, vesselId);

        const workOrderData = {
          vesselId: (job as any).vesselId,
          component: (job as any).componentId,
          componentCode: componentCode,
          jobId: (job as any).id, // Store job ID for reliable lead time hydration
          workOrderNo: workOrderNo,
          workOrderType: 'Planned' as const,
          templateCode: workOrderNo,
          jobTitle: (job as any).jobTitle,
          assignedTo: (job as any).assignedTo || 'Unassigned',
          dueDate: (job as any).nextDueDate,
          status: 'Active',
          taskType: (job as any).maintenanceType,
          maintenanceBasis: (job as any).maintenanceBasis,
          frequencyValue: (job as any).frequencyValue?.toString(),
          frequencyUnit: (job as any).frequencyUnit,
          jobPriority: (job as any).jobPriority,
          classRelated: (job as any).classRelated,
          briefWorkDescription: (job as any).briefWorkDescription,
          department: (job as any).department,
          requiredSpareParts: (job as any).requiredSpareParts || [],
          requiredTools: (job as any).requiredTools || [],
          safetyRequirements: (job as any).safetyRequirements || { ppeRequirements: [], permitRequirements: [], otherRequirements: [] }
        };

        const createdWO = await repo.create(workOrderData);
        results.generated++;
        results.workOrders.push(createdWO);

        // Add to Set to prevent duplicate generation in same run
        activeWorkOrderKeys.add(workOrderKey);

        console.log(`✅ Auto-generated work order ${workOrderNo} for job ${(job as any).jobNo} (${(job as any).jobTitle})`);
      }
    }
  }

  // Process Running Hours-based jobs
  for (const job of rhJobs) {
    // Get component to check current RH
    const component = componentsMap.get((job as any).componentId);
    if (!component) {
      console.warn(`⚠️  Component ${(job as any).componentId} not found for RH job ${(job as any).jobNo} - skipping`);
      continue;
    }

    const currentRH = parseInt(component.currentCumulativeRH || '0');
    const dueRH = parseInt((job as any).nextDueRH || '0');

    // Determine lead time based on job criticality - use vessel settings
    const isCritical = (job as any).criticality === 'Yes' || (job as any).jobPriority === 'Critical';
    const leadTimeHours = isCritical ? rhLeadHoursCritical : rhLeadHoursNonCritical;

    // Check if we should generate (current RH >= due RH - lead time)
    const shouldGen = currentRH >= (dueRH - leadTimeHours);

    if (shouldGen) {
      // O(1) duplicate check using Set
      const workOrderKey = `${(job as any).componentCode}|${(job as any).jobTitle}`;

      if (!activeWorkOrderKeys.has(workOrderKey)) {
        // Generate spec-compliant work order number
        const { generatePlannedWorkOrderNumber } = await import('../../../utils/workOrderNumbering');
        const jobCode = (job as any).jobNo || 'JOB-UNKNOWN';
        // Get component code from job, fallback to component record
        const componentCode = (job as any).componentCode || component?.componentCode;
        if (!componentCode) {
          console.warn(`⚠️ No component code for RH job ${(job as any).jobNo} - skipping WO generation`);
          continue;
        }
        const workOrderNo = await generatePlannedWorkOrderNumber(storage, jobCode, componentCode, vesselId);

        const workOrderData = {
          vesselId: (job as any).vesselId,
          component: (job as any).componentId,
          componentCode: componentCode, // Use resolved componentCode
          jobId: (job as any).id, // Store job ID for reliable lead time hydration
          workOrderNo: workOrderNo,
          workOrderType: 'Planned' as const,
          templateCode: workOrderNo,
          jobTitle: (job as any).jobTitle,
          assignedTo: (job as any).assignedTo || 'Unassigned',
          dueDate: null, // RH-based jobs don't have calendar due dates
          status: 'Active',
          taskType: (job as any).maintenanceType,
          maintenanceBasis: (job as any).maintenanceBasis,
          frequencyValue: (job as any).frequencyValue?.toString(),
          frequencyUnit: 'Hours', // RH-based jobs use hours
          jobPriority: (job as any).jobPriority,
          classRelated: (job as any).classRelated,
          briefWorkDescription: (job as any).briefWorkDescription,
          department: (job as any).department,
          requiredSpareParts: (job as any).requiredSpareParts || [],
          requiredTools: (job as any).requiredTools || [],
          safetyRequirements: (job as any).safetyRequirements || { ppeRequirements: [], permitRequirements: [], otherRequirements: [] }
        };

        const createdWO = await repo.create(workOrderData);
        results.generated++;
        results.workOrders.push(createdWO);

        // Add to Set to prevent duplicate generation in same run
        activeWorkOrderKeys.add(workOrderKey);

        console.log(`✅ Auto-generated RH-based work order ${workOrderNo} for job ${(job as any).jobNo} (${(job as any).jobTitle}) - Current RH: ${currentRH}, Due RH: ${dueRH}`);
      }
    }
  }

  return results;
}

// ── Backfill Job IDs ──

export async function backfillJobIds(vesselId?: string) {
  // Get all work orders (optionally filtered by vessel)
  const allWorkOrders = await repo.findWorkOrders(vesselId);
  const workOrdersNeedingJobId = allWorkOrders.filter((wo: any) => !wo.jobId && wo.component && wo.jobTitle);

  if (workOrdersNeedingJobId.length === 0) {
    return {
      checked: allWorkOrders.length,
      updated: 0,
      message: "All work orders already have jobId or lack required fields (component, jobTitle)"
    };
  }

  // Get all jobs for efficient lookup
  const allJobs = await repo.findJobs(vesselId);

  let updated = 0;
  const updateResults: Array<{ workOrderId: string; jobId: string | null; reason: string }> = [];

  for (const wo of workOrdersNeedingJobId) {
    // Try to match job by component and jobTitle
    const matchingJob = allJobs.find((j: any) =>
      j.componentId === wo.component &&
      j.jobTitle === wo.jobTitle &&
      (!vesselId || j.vesselId === wo.vesselId)
    );

    if (matchingJob) {
      await repo.update(wo.id, { jobId: (matchingJob as any).id });
      updated++;
      updateResults.push({
        workOrderId: wo.id,
        jobId: (matchingJob as any).id,
        reason: `Matched by component (${wo.component}) + jobTitle ("${wo.jobTitle}")`
      });
      console.log(`✅ Backfilled jobId ${(matchingJob as any).id} for work order ${wo.id}`);
    } else {
      updateResults.push({
        workOrderId: wo.id,
        jobId: null,
        reason: `No matching job found for component (${wo.component}) + jobTitle ("${wo.jobTitle}")`
      });
    }
  }

  return {
    checked: allWorkOrders.length,
    needingBackfill: workOrdersNeedingJobId.length,
    updated,
    skipped: workOrdersNeedingJobId.length - updated,
    details: updateResults.slice(0, 100) // Return first 100 for review
  };
}

// ── Recalculate Statuses ──

export async function recalculateStatuses() {
  const { workOrderStatusRecalculator } = await import('../../../services/workOrderStatusRecalculator');
  return workOrderStatusRecalculator.forceRecalculation();
}

// ── Check Postponements ──

export async function checkPostponements(vesselId?: string) {
  return repo.checkAndRevertPostponedWorkOrders(vesselId);
}
