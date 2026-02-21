import * as repo from '../repositories/workOrderRepository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { computeWorkOrderStatus } from '@shared/workOrders/status';
import { WORK_ORDER_THRESHOLDS } from '@shared/workOrders/constants';

// ── List Work Orders with Enrichment ──

export async function listWorkOrders(vesselId?: string) {
  const workOrders = await repo.findWorkOrders(vesselId);

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
  const jobsMap = new Map(allJobs.map((job: any) => [job.id, job]));

  // Fetch components per-vessel
  const componentsByCodeMap = new Map<string, any>();
  const componentsMap = new Map<string, any>();
  if (isAllVessels) {
    for (const vid of uniqueVesselIds) {
      const vesselComponents = await repo.findComponents(vid);
      for (const comp of vesselComponents) {
        componentsByCodeMap.set(`${vid}:${comp.componentCode}`, comp);
        componentsMap.set(comp.id, comp);
      }
    }
  } else {
    const components = await repo.findComponents(vesselId);
    for (const comp of components) {
      componentsByCodeMap.set(`${vesselId}:${comp.componentCode}`, comp);
      componentsMap.set(comp.id, comp);
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

    const dueRH = wo.maintenanceBasis === 'Running Hours'
      ? (parseRH(job?.nextDueRH) ?? parseRH(wo.nextDueReading))
      : undefined;
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
        rhLeadTimeHours
      }),
      leadTimeValue: job?.leadTimeValue ?? null,
      leadTimeUnit: job?.leadTimeUnit ?? null,
      dueRH: dueRH ?? null,
      currentRH: currentRH ?? null
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
  const workOrder = await repo.findById(id);
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
      ? jobs.find((j: any) => j.id === workOrder.jobId)
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

  const dueRH = workOrder.maintenanceBasis === 'Running Hours'
    ? (parseRH(job?.nextDueRH) ?? parseRH(workOrder.nextDueReading))
    : undefined;
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
      rhLeadTimeHours
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
      console.warn(`⚠️ Attempted to modify completed WO ${existingWO.workOrderNo}: ${disallowedFields.join(', ')}`);
      throw new ValidationError(
        'Cannot modify completed work order',
        {
          message: `Work Order ${existingWO.workOrderNo} is completed and cannot be modified. Only remarks can be added.`,
          disallowedFields
        }
      );
    }
  }

  let updateData = { ...body };

  // Remove any undefined values
  Object.keys(updateData).forEach((key: string) => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

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

  // Map dateOfCompletion to completionDateTime and dateCompleted
  if (updateData.dateOfCompletion) {
    const normalizedDate = normalizeDateToISO(updateData.dateOfCompletion);
    if (normalizedDate) {
      const isoTimestamp = `${normalizedDate}T00:00:00.000Z`;
      updateData.completionDateTime = isoTimestamp;
      console.log(`📅 Mapped dateOfCompletion "${updateData.dateOfCompletion}" to completionDateTime: ${isoTimestamp}`);
      updateData.dateCompleted = isoTimestamp;
    }
  }

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
    updateData.dateOfCompletion = null;
    updateData.rejectionDate = new Date().toISOString();
    updateData.wasRejected = true;
    updateData.status = 'Due';
    console.log('📝 Work order rejected - setting status to Due, wasRejected=true for rework');
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

  const workOrder = await repo.update(id, updateData);

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
        // Create maintenance history record
        try {
          const existingHistory = await repo.findMaintenanceHistoryByWorkOrderId(freshWorkOrder.id);
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
                  componentId: component.id,
                  componentCode: freshWorkOrder.componentCode || component.componentCode,
                  vesselCode: freshWorkOrder.vesselId,
                  workOrderId: freshWorkOrder.id,
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
                  remarks: freshWorkOrder.remarks || freshWorkOrder.jobExperienceNotes || null,
                  isComponentReplaced: false
                };

                await repo.createMaintenanceHistory(historyPayload);
                console.log(`✅ Created maintenance history for work order ${freshWorkOrder.id} (componentId: ${component.id})`);
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
                const nextDue = calculateNextDueDate(dateOfCompletionNorm, job.frequencyValue, job.frequencyUnit);
                if (nextDue) {
                  calendarUpdates.nextDueDate = nextDue;
                  linkUpdates.nextDueDate = nextDue;
                  console.log(`✅ Updated job ${job.jobNo} nextDueDate: ${nextDue}`);
                }
              }

              const updateVesselId = freshWorkOrder.vesselId || job.vesselId;
              if (component.id && updateVesselId) {
                await repo.updateJobComponentLinkTracking(updateVesselId, job.id, component.id, linkUpdates);
                console.log(`✅ Updated component-specific tracking for vessel ${updateVesselId}, job ${job.jobNo} + component ${component.id} with lastDoneDate: ${dateOfCompletionNorm}`);
              }

              await repo.updateJob(job.id, calendarUpdates);
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
                if (component.id && rhUpdateVesselId) {
                  await repo.updateJobComponentLinkTracking(rhUpdateVesselId, job.id, component.id, rhLinkUpdates);
                  console.log(`✅ Updated component-specific RH tracking for vessel ${rhUpdateVesselId}, job ${job.jobNo} + component ${component.id} with lastDoneRH: ${currentRH}`);
                }

                await repo.updateJob(job.id, rhUpdates);

                // UPDATE COMPONENT RUNNING HOURS on work order approval
                try {
                  const counterType = (component.rhCounterType || '').toUpperCase();
                  const isInherited = counterType === 'INHERITED';
                  const isMaster = counterType === 'MASTER';

                  if (isInherited) {
                    await repo.setComponentRunningHours({
                      componentId: component.id,
                      newRHValue: currentRH,
                      updateSource: 'WO_COMPLETION',
                      userId: freshWorkOrder.performedBy || freshWorkOrder.approver || 'System',
                      lastUpdatedDate: dateOfCompletionNorm || new Date().toISOString().split('T')[0]
                    });
                    console.log(`✅ Updated INHERITED component ${component.componentCode} RH to ${currentRH} (Section B update only, master unchanged)`);
                  } else if (isMaster || !counterType) {
                    await repo.setComponentRunningHours({
                      componentId: component.id,
                      newRHValue: currentRH,
                      updateSource: 'WO_COMPLETION',
                      userId: freshWorkOrder.performedBy || freshWorkOrder.approver || 'System',
                      lastUpdatedDate: dateOfCompletionNorm || new Date().toISOString().split('T')[0]
                    });
                    console.log(`✅ Updated component ${component.componentCode} RH to ${currentRH}`);
                  }
                } catch (rhUpdateError) {
                  console.error(`Failed to update component running hours:`, rhUpdateError);
                }
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
    if (workOrder && workOrder.consumedSpareParts && Array.isArray(workOrder.consumedSpareParts)) {
      const consumedSpares = workOrder.consumedSpareParts as Array<{
        partNo: string;
        partCode?: string;
        description?: string;
        quantityConsumed: number | string;
        locationId?: number | null;
        location?: string;
        comments?: string;
      }>;

      console.log(`🔧 [PATCH Approval] Processing ${consumedSpares.length} consumed spares for WO ${workOrder.workOrderNo}`);

      for (const consumedSpare of consumedSpares) {
        const qtyConsumed = typeof consumedSpare.quantityConsumed === 'string'
          ? parseFloat(consumedSpare.quantityConsumed)
          : consumedSpare.quantityConsumed;

        if (qtyConsumed && qtyConsumed > 0) {
          try {
            const woVesselId = workOrder.vesselId || 'V001';
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

              if ((!resolvedLocationId || isNaN(resolvedLocationId as number)) && consumedSpare.location) {
                const locationObj = await repo.findOrCreateLocation(woVesselId, consumedSpare.location, workOrder.approver || 'system');
                if (locationObj) {
                  resolvedLocationId = locationObj.id;
                  console.log(`📍 [PATCH Approval] Resolved location name "${consumedSpare.location}" to ID ${resolvedLocationId}`);
                }
              }

              if (resolvedLocationId && !isNaN(resolvedLocationId as number)) {
                try {
                  await repo.performInventoryTransaction({
                    vesselId: woVesselId,
                    spareId: spare.id,
                    locationId: resolvedLocationId,
                    eventType: 'CONSUME',
                    qtyChange: -Math.abs(qtyConsumed),
                    referenceType: 'WORK_ORDER',
                    referenceId: workOrder.id,
                    referenceNote: `WO Approval: ${workOrder.workOrderNo} - ${consumedSpare.comments || 'Consumed during work approval'}`,
                    userId: workOrder.approver || 'system'
                  });
                  console.log(`✅ [PATCH Approval] Consumed ${qtyConsumed} units of ${consumedSpare.partCode || consumedSpare.partNo} from location ${resolvedLocationId} (WO: ${workOrder.workOrderNo})`);
                } catch (txnError: any) {
                  if (txnError.message?.includes('INSUFFICIENT_STOCK') || txnError.message?.includes('NEGATIVE_STOCK_PREVENTED')) {
                    throw new Error(`INSUFFICIENT_STOCK: Cannot consume ${qtyConsumed} units of ${consumedSpare.partCode || consumedSpare.partNo}. ${txnError.message}`);
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
