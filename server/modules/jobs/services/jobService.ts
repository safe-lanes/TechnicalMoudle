import * as repo from '../repositories/jobRepository';
import { NotFoundError, ValidationError, ForbiddenError } from '../../shared/errors';

interface UserInfo {
  username: string;
  role: string;
  vesselId?: string;
}

// ── Job Listing with Enrichment ──

export async function listJobs(vesselId?: string, componentId?: string) {
  const jobs = await repo.findJobs(vesselId, componentId);

  // PERFORMANCE OPTIMIZATION: Batch fetch all job-component links
  let jobLinksMap = new Map<string, string[]>();
  let jobLinkTrackingMap = new Map<string, any>();

  if (vesselId && vesselId !== 'all') {
    const allLinks = await repo.findJobComponentLinks(vesselId);
    for (const link of allLinks) {
      const existing = jobLinksMap.get(link.jobId) || [];
      existing.push((link as any).componentCode);
      jobLinksMap.set(link.jobId, existing);
      jobLinkTrackingMap.set(`${link.jobId}:${link.componentId}`, link);
    }
  } else if (jobs.length > 0) {
    const vesselIds = Array.from(new Set(jobs.map(j => j.vesselId).filter((v): v is string => v != null)));
    for (const vid of vesselIds) {
      const links = await repo.findJobComponentLinks(vid);
      for (const link of links) {
        const existing = jobLinksMap.get(link.jobId) || [];
        existing.push((link as any).componentCode);
        jobLinksMap.set(link.jobId, existing);
        jobLinkTrackingMap.set(`${link.jobId}:${link.componentId}`, link);
      }
    }
  }

  // PERFORMANCE OPTIMIZATION: Cache component lookups
  const componentCacheById = new Map<string, any>();
  const componentCacheByCode = new Map<string, any>();

  const getComponentCached = async (compId: string) => {
    if (!componentCacheById.has(compId)) {
      componentCacheById.set(compId, await repo.findComponent(compId));
    }
    return componentCacheById.get(compId);
  };

  const getComponentByCodeCached = async (code: string, vesselId: string) => {
    const key = `${vesselId}:${code}`;
    if (!componentCacheByCode.has(key)) {
      componentCacheByCode.set(key, await repo.findComponentByCode(code, vesselId));
    }
    return componentCacheByCode.get(key);
  };

  // Hydrate jobs
  const hydratedJobs = await Promise.all(jobs.map(async (job) => {
    const linkedComponentCodes = jobLinksMap.get(job.juuid) || [];

    if (job.componentCode && !linkedComponentCodes.includes(job.componentCode)) {
      linkedComponentCodes.push(job.componentCode);
    }

    const componentTracking: Record<string, any> = {};
    for (const [linkKey, link] of Array.from(jobLinkTrackingMap.entries())) {
      if (linkKey.startsWith(`${job.juuid}:`)) {
        const compCode = (link as any).componentCode;
        if (compCode) {
          componentTracking[compCode] = {
            lastDoneDate: (link as any).lastDoneDate || null,
            nextDueDate: (link as any).nextDueDate || null,
            lastDoneRH: (link as any).lastDoneRH || null,
            nextDueRH: (link as any).nextDueRH || null,
          };
        }
      }
    }

    let hydratedJob: any = {
      ...job,
      linkedComponentCodes,
      componentTracking,
    };

    const hasMultipleComponents = Object.keys(componentTracking).length > 1;
    if (hasMultipleComponents) {
      hydratedJob.lastDoneDate = null;
      hydratedJob.nextDueDate = null;
      hydratedJob.lastDoneRH = null;
      hydratedJob.nextDueRH = null;
    } else if (componentId) {
      const linkKey = `${job.juuid}:${componentId}`;
      const componentLink = jobLinkTrackingMap.get(linkKey);
      if (componentLink) {
        if (componentLink.lastDoneDate) hydratedJob.lastDoneDate = componentLink.lastDoneDate;
        if (componentLink.nextDueDate) hydratedJob.nextDueDate = componentLink.nextDueDate;
        if (componentLink.lastDoneRH) hydratedJob.lastDoneRH = componentLink.lastDoneRH;
        if (componentLink.nextDueRH) hydratedJob.nextDueRH = componentLink.nextDueRH;
      }
    }

    if (job.maintenanceBasis === 'Running Hours' && job.componentId) {
      const component = await getComponentCached(job.componentId);
      if (component) {
        let currentRH = parseFloat(component.currentCumulativeRH || component.runningHours || '0');
        if (component.parentId && job.vesselId) {
          const parentComponent = await getComponentByCodeCached(component.parentId, job.vesselId);
          if (parentComponent) {
            currentRH = parseFloat(parentComponent.currentCumulativeRH || parentComponent.runningHours || '0');
          }
        }
        hydratedJob.componentCurrentRH = currentRH.toFixed(2);
      }
    }
    return hydratedJob;
  }));

  return hydratedJobs;
}

export async function getJob(id: string) {
  return repo.findById(id);
}

// ── Job Creation with Validation ──

export async function createJob(body: any) {
  const { insertJobSchema } = await import('@shared/schema');
  const { calculateNextDueDate, normalizeDateToDDMMMYYYY } = await import('@shared/dateUtils');
  const { z } = await import('zod');

  const jobCreateSchema = insertJobSchema.extend({ juuid: z.string().optional() });
  let jobData = jobCreateSchema.parse(body);

  // Component validation
  let component: any = null;
  if (jobData.componentId) {
    component = await repo.findComponent(jobData.componentId);

    if (!component && jobData.componentCode && jobData.vesselId) {
      component = await repo.findComponentByCode(jobData.componentCode, jobData.vesselId);
      if (component) {
        jobData = { ...jobData, componentId: component.cuuid };
      }
    }

    if (!component) {
      throw new ValidationError('Component not found');
    }
    if (!component.parentId) {
      throw new ValidationError('Jobs can only be assigned to sub-components. Parent components cannot have jobs directly assigned to them. Please select a sub-component.');
    }

    // Auto-correct componentCode
    if (component.componentCode) {
      if (jobData.componentCode && jobData.componentCode !== component.componentCode) {
        console.warn(`⚠️ AUTO-CORRECTING job componentCode mismatch: passed "${jobData.componentCode}" but component "${component.name}" has code "${component.componentCode}"`);
      }
      jobData = { ...jobData, componentCode: component.componentCode };
      console.log(`✅ Auto-resolved job componentCode: ${component.componentCode} for component "${component.name}"`);
    }

    // D3: Block Dual Frequency unless component RH Counter Type is MASTER or INHERITED
    if (jobData.maintenanceBasis === 'Dual Frequency') {
      const rhType = component.rhCounterType;
      if (rhType !== 'MASTER' && rhType !== 'INHERITED') {
        throw new ValidationError(
          `Dual Frequency maintenance basis requires a component with RH Counter Type set to Master or Inherited. ` +
          `Component "${component.name}" has RH Counter Type "${rhType || 'not set'}". ` +
          `Please update the component's RH Counter Type first, or choose Calendar or Running Hours basis.`
        );
      }
    }
  }

  // Auto-generate job number
  if (!jobData.jobNo) {
    const { generateJobNumber } = await import('../../../utils/workOrderNumbering');
    const { storage } = await import('../../../storage');
    const taskType = (jobData as any).taskType;
    const generatedJobNo = await generateJobNumber(storage, taskType);
    jobData = { ...jobData, jobNo: generatedJobNo };
  }

  // Calendar next-due calculation
  if (jobData.maintenanceBasis === 'Calendar' && !jobData.nextDueDate) {
    const rawLastDone = jobData.lastDoneDate || (component?.installationDate);
    if (rawLastDone && jobData.frequencyValue && jobData.frequencyUnit) {
      const lastDone = normalizeDateToDDMMMYYYY(rawLastDone);
      if (lastDone) {
        const calculatedNextDue = calculateNextDueDate(lastDone, jobData.frequencyValue, jobData.frequencyUnit);
        if (calculatedNextDue) {
          jobData = { ...jobData, nextDueDate: calculatedNextDue };
        }
      }
    }
  }

  // Running Hours validation and calculation
  if (jobData.maintenanceBasis === 'Running Hours') {
    const intervalRH = Number(jobData.intervalRunningHour);
    if (isNaN(intervalRH) || intervalRH <= 0) {
      throw new ValidationError('Running Hours jobs require a valid numeric intervalRunningHour greater than 0');
    }

    const userProvidedLastDoneRH = jobData.lastDoneRH !== null && jobData.lastDoneRH !== undefined && jobData.lastDoneRH !== '';
    const rawLastDoneRH = userProvidedLastDoneRH ? jobData.lastDoneRH : (component?.runningHours != null ? String(component.runningHours) : null);
    if (!rawLastDoneRH) {
      throw new ValidationError('Running Hours jobs require lastDoneRH or component must have runningHours to calculate nextDueRH');
    }

    const lastRH = Number(rawLastDoneRH);
    if (isNaN(lastRH)) {
      throw new ValidationError('lastDoneRH must be a valid number');
    }

    const calculatedNextDueRH = String(lastRH + intervalRH);
    jobData = {
      ...jobData,
      nextDueRH: calculatedNextDueRH,
      lastDoneRH: String(lastRH)
    };

    if (!userProvidedLastDoneRH && component) {
      try {
        await repo.createAuditLog({
          timestamp: new Date().toISOString(),
          userId: 'system',
          vesselCode: jobData.vesselId || '',
          componentCode: component.componentCode || '',
          entityType: 'job',
          entityId: jobData.jobNo || '',
          actionType: 'rh_default',
          fieldName: 'lastDoneRH',
          oldValue: null,
          newValue: String(lastRH),
          source: 'job_creation_default',
          payload: {
            componentId: component.cuuid || component.id,
            componentName: component.name,
            componentRunningHours: component.runningHours,
            defaultedFrom: 'component.runningHours',
            intervalRH,
            calculatedNextDueRH
          }
        });
      } catch (auditErr) {
        console.warn('[Job Create] Failed to log lastDoneRH default audit:', auditErr);
      }
    }
  }

  // Dual Frequency: requires BOTH calendar fields AND RH interval, plus RH calculation
  if (jobData.maintenanceBasis === 'Dual Frequency') {
    // Calendar leg validation
    if (!jobData.frequencyValue || !jobData.frequencyUnit) {
      throw new ValidationError('Dual Frequency jobs require frequencyValue and frequencyUnit for the calendar leg');
    }
    // RH leg validation and calculation (mirrors Running Hours logic above)
    const intervalRH = Number(jobData.intervalRunningHour);
    if (isNaN(intervalRH) || intervalRH <= 0) {
      throw new ValidationError('Dual Frequency jobs require a valid numeric intervalRunningHour greater than 0 for the running hours leg');
    }

    const userProvidedLastDoneRH = jobData.lastDoneRH !== null && jobData.lastDoneRH !== undefined && jobData.lastDoneRH !== '';
    const rawLastDoneRH = userProvidedLastDoneRH ? jobData.lastDoneRH : (component?.runningHours != null ? String(component.runningHours) : null);
    if (rawLastDoneRH) {
      const lastRH = Number(rawLastDoneRH);
      if (!isNaN(lastRH)) {
        jobData = {
          ...jobData,
          nextDueRH: String(lastRH + intervalRH),
          lastDoneRH: String(lastRH)
        };
      }
    }

    // Calendar leg calculation
    if (!jobData.nextDueDate) {
      const { normalizeDateToDDMMMYYYY: normDate, calculateNextDueDate: calcNext } = await import('@shared/dateUtils');
      const rawLastDone = jobData.lastDoneDate || (component?.installationDate);
      if (rawLastDone && jobData.frequencyValue && jobData.frequencyUnit) {
        const lastDone = normDate(rawLastDone);
        if (lastDone) {
          const calculatedNextDue = calcNext(lastDone, jobData.frequencyValue, jobData.frequencyUnit);
          if (calculatedNextDue) {
            jobData = { ...jobData, nextDueDate: calculatedNextDue };
          }
        }
      }
    }
  }

  const job = await repo.create(jobData);
  return job;
}

// ── Job Update with Recalculation ──

export async function updateJob(id: string, body: any) {
  const { calculateNextDueDate, normalizeDateToDDMMMYYYY } = await import('@shared/dateUtils');

  let updateData = { ...body };

  if (updateData.isActive === 'Yes') updateData.isActive = true;
  if (updateData.isActive === 'No') updateData.isActive = false;

  // Component validation if changed
  let component: any = null;
  if (body.componentId) {
    component = await repo.findComponent(body.componentId);
    if (!component) {
      throw new ValidationError('Component not found');
    }
    if (!component.parentId) {
      throw new ValidationError('Jobs can only be assigned to sub-components. Parent components cannot have jobs directly assigned to them. Please select a sub-component.');
    }
  }

  const existingJob = await repo.findById(id);
  if (!existingJob) {
    throw new NotFoundError('Job not found');
  }

  // D3: Block Dual Frequency if component RH Counter Type is not MASTER/INHERITED
  const effectiveBasis = updateData.maintenanceBasis ?? existingJob.maintenanceBasis;
  const effectiveComponentId = updateData.componentId ?? existingJob.componentId;
  const basisChangingToDual = updateData.maintenanceBasis === 'Dual Frequency' && existingJob.maintenanceBasis !== 'Dual Frequency';
  const componentChangingOnDual = effectiveBasis === 'Dual Frequency' && updateData.componentId !== undefined && updateData.componentId !== existingJob.componentId;

  if (basisChangingToDual || componentChangingOnDual) {
    // Ensure we have the component for D3 check
    if (!component && effectiveComponentId) {
      component = await repo.findComponent(effectiveComponentId);
    }
    if (component) {
      const rhType = component.rhCounterType;
      if (rhType !== 'MASTER' && rhType !== 'INHERITED') {
        throw new ValidationError(
          `Dual Frequency maintenance basis requires a component with RH Counter Type set to Master or Inherited. ` +
          `Component "${component.name}" has RH Counter Type "${rhType || 'not set'}". ` +
          `Please update the component's RH Counter Type first, or choose Calendar or Running Hours basis.`
        );
      }
    }
  }

  const mergedData = { ...existingJob, ...updateData };

  // Calendar recalculation
  const calendarFieldsChanged =
    updateData.lastDoneDate !== undefined ||
    updateData.frequencyValue !== undefined ||
    updateData.frequencyUnit !== undefined ||
    updateData.maintenanceBasis !== undefined;

  if (mergedData.maintenanceBasis === 'Calendar' && calendarFieldsChanged) {
    if (!component && mergedData.componentId) {
      component = await repo.findComponent(mergedData.componentId);
    }
    const rawLastDone = mergedData.lastDoneDate || (component?.installationDate);
    if (rawLastDone && mergedData.frequencyValue && mergedData.frequencyUnit) {
      const lastDone = normalizeDateToDDMMMYYYY(rawLastDone);
      if (lastDone) {
        const calculatedNextDue = calculateNextDueDate(lastDone, mergedData.frequencyValue, mergedData.frequencyUnit);
        if (calculatedNextDue) {
          updateData.nextDueDate = calculatedNextDue;
        }
      }
    }
  } else if (updateData.maintenanceBasis === 'Running Hours' && existingJob.maintenanceBasis === 'Calendar') {
    updateData.nextDueDate = null;
  }

  // RH recalculation
  const rhFieldsChanged =
    updateData.lastDoneRH !== undefined ||
    updateData.intervalRunningHour !== undefined ||
    updateData.maintenanceBasis !== undefined;

  if (mergedData.maintenanceBasis === 'Running Hours') {
    const intervalRH = Number(mergedData.intervalRunningHour);
    if (isNaN(intervalRH) || intervalRH <= 0) {
      throw new ValidationError('Running Hours jobs require a valid numeric intervalRunningHour greater than 0');
    }

    if (!component && mergedData.componentId) {
      component = await repo.findComponent(mergedData.componentId);
    }

    const rawLastDoneRH = mergedData.lastDoneRH || (component?.runningHours ? String(component.runningHours) : null);
    if (!rawLastDoneRH) {
      throw new ValidationError('Running Hours jobs require lastDoneRH or component must have runningHours to calculate nextDueRH');
    }

    const lastRH = Number(rawLastDoneRH);
    if (isNaN(lastRH)) {
      throw new ValidationError('lastDoneRH must be a valid number');
    }

    if (rhFieldsChanged) {
      updateData.nextDueRH = String(lastRH + intervalRH);
      if (!mergedData.lastDoneRH) {
        updateData.lastDoneRH = String(lastRH);
      }
    }
  } else if (updateData.maintenanceBasis === 'Calendar' && existingJob.maintenanceBasis === 'Running Hours') {
    updateData.nextDueRH = null;
  }

  const job = await repo.update(id, updateData);
  return job;
}

// ── Job Deletion ──

export async function deleteJob(id: string) {
  await repo.remove(id);
}

// ── Job Inactivation (Soft Delete) ──

export async function inactivateJob(id: string, vesselId: string) {
  const job = await repo.findById(id);
  if (!job) {
    throw new NotFoundError('Job not found');
  }
  if (job.vesselId !== vesselId) {
    throw new ForbiddenError('Job does not belong to this vessel');
  }
  if (job.isActive === false) {
    throw new ValidationError('Job is already inactive');
  }

  await repo.update(id, { isActive: false });

  const allWOs = await repo.findWorkOrdersByJobId(id);
  const activeWOCount = allWOs.filter((wo: any) =>
    wo.status !== 'Completed' && wo.status !== 'Cancelled'
  ).length;

  let message = 'Job has been deactivated successfully.';
  if (activeWOCount > 0) {
    message += ` ${activeWOCount} active work order(s) will continue to completion. No new work orders will be generated.`;
  }

  return { message, activeWorkOrders: activeWOCount };
}

// ── Job Maintenance History ──

export async function getJobMaintenanceHistory(jobId: string, user: UserInfo) {
  const job = await repo.findById(jobId);
  if (!job) {
    throw new NotFoundError('Job not found');
  }

  if (user.role === 'Ship' && user.vesselId) {
    if (job.vesselId !== user.vesselId) {
      throw new ForbiddenError('Cannot access maintenance history for jobs from other vessels');
    }
  }

  let history = await repo.findMaintenanceHistoryByJobId(jobId);
  if (history.length === 0 && job.jobNo) {
    history = await repo.findMaintenanceHistoryByJobCode(job.jobNo);
  }
  return history;
}

// ── Generate Work Order ──

export async function generateWorkOrder(jobId: string, reason: string, activeComponentCode?: string) {
  if (!reason || !['Planning', 'Breakdown', 'Other'].includes(reason)) {
    throw new ValidationError("Invalid reason. Must be 'Planning', 'Breakdown', or 'Other'");
  }

  const job = await repo.findById(jobId);
  if (!job) {
    throw new NotFoundError('Job not found');
  }
  if (job.isActive === false) {
    throw new ValidationError('Cannot generate work orders for an inactive job');
  }

  const { jobDueScanner } = await import('../../../services/jobDueScanner');
  return jobDueScanner.generateWorkOrderForJob(jobId, reason as 'Planning' | 'Breakdown' | 'Other', activeComponentCode);
}
