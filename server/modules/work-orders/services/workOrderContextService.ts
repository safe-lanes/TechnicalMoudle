import * as repo from '../repositories/workOrderRepository';
import { NotFoundError } from '../../shared/errors';
import { ensureArray, ensureJsonObject } from '../../shared/jsonHelpers';

// Helper: Convert DD-MMM-YYYY to ISO YYYY-MM-DD for HTML date inputs
function convertToIsoDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const monthMap: Record<string, string> = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
    'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };
  // Handle DD-MMM-YYYY format (e.g., "04-Dec-2025")
  const match = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    const monthNum = monthMap[month];
    if (monthNum) {
      return `${year}-${monthNum}-${day.padStart(2, '0')}`;
    }
  }
  // If already in ISO format or other format, return as-is
  return dateStr;
}

// Enrich spare parts with ROB (Remaining On Board) inventory data
async function enrichSparePartsWithROB(spareParts: any[], vesselId: string) {
  if (!Array.isArray(spareParts) || spareParts.length === 0) return [];

  const partCodes = spareParts.map((sp: any) => sp.partCode).filter(Boolean);
  const partNumbers = spareParts.map((sp: any) => sp.partNo).filter(Boolean);

  const inventoryByPartCode = await repo.findSpareInventoryByPartCodes(vesselId, partCodes);
  const inventoryByPartNumber = partNumbers.length > 0
    ? await repo.findSpareInventoryByPartNumbers(vesselId, partNumbers)
    : new Map();

  return spareParts.map((sp: any) => {
    // Primary lookup: by Part Code (correct design)
    let inventory = sp.partCode ? inventoryByPartCode.get(sp.partCode) : null;
    // Fallback: by Part Number for legacy data compatibility
    if (!inventory && sp.partNo) {
      inventory = inventoryByPartNumber.get(sp.partNo);
    }
    return {
      ...sp,
      rob: inventory ? inventory.rob : null,
      robLocationA: inventory ? inventory.robLocationA : null,
      robLocationB: inventory ? inventory.robLocationB : null
    };
  });
}

export async function getWorkOrderContext(workOrderId: string) {
  const workOrder = await repo.findById(workOrderId);
  if (!workOrder) {
    throw new NotFoundError('Work order not found');
  }

  // Get component data - work orders may store component ID, componentCode, or component name
  // Try multiple lookup methods to ensure compatibility
  let component = await repo.findComponent(workOrder.component);

  // Fallback: Try by componentCode if ID lookup fails
  if (!component && workOrder.componentCode && workOrder.vesselId) {
    component = await repo.findComponentByCode(workOrder.componentCode, workOrder.vesselId);
  }

  // Fallback: Search by component name if still not found
  if (!component) {
    const allComponents = await repo.findComponents(workOrder.vesselId ?? undefined);
    component = allComponents.find((c: any) =>
      c.name === workOrder.component ||
      c.componentCode === workOrder.component ||
      c.componentCode === workOrder.componentCode
    ) ?? undefined;
  }

  if (!component) {
    throw new NotFoundError('Component not found');
  }

  // Get parent component data if exists
  let parentComponent = null;
  if (component.parentId) {
    parentComponent = await repo.findComponent(component.parentId as string);
  }

  // Get RH master component for INHERITED components (different from hierarchical parent)
  // This is used for running hours validation - inherited components cannot exceed master RH
  let rhMasterComponent = null;
  const counterType = (component.rhCounterType || '').toUpperCase();
  if (counterType === 'INHERITED') {
    // Try by rhMasterComponentId first, then fall back to rhCounterSource
    if (component.rhMasterComponentId) {
      rhMasterComponent = await repo.findComponent(component.rhMasterComponentId);
    }
    if (!rhMasterComponent && component.rhCounterSource && workOrder.vesselId) {
      rhMasterComponent = await repo.findComponentByCode(component.rhCounterSource, workOrder.vesselId);
    }
  }

  // Get latest running hours audit for this component
  const audits = await repo.findRunningHoursAudits(workOrder.component);
  const latestAudit = audits.length > 0 ? audits[0] : null;

  // Get linked job data for Part A hydration
  let job = null;
  if (workOrder.jobId) {
    job = await repo.findJob(workOrder.jobId);
  }

  let workHistoryWOs: any[] = [];
  if (job) {
    const allJobWOs = await repo.findWorkOrdersByJobId(job.juuid);
    workHistoryWOs = allJobWOs.filter((wo: any) =>
      wo.status === 'Completed' && wo.wouuid !== workOrder.wouuid && wo.id !== workOrder.id
    );
  } else {
    const componentLookup = workOrder.componentCode || workOrder.component;
    if (componentLookup && workOrder.vesselId) {
      const componentWOs = await repo.findWorkOrdersByComponent(componentLookup, workOrder.vesselId);
      workHistoryWOs = componentWOs.filter((wo: any) =>
        wo.status === 'Completed' && wo.wouuid !== workOrder.wouuid && wo.id !== workOrder.id
      );
    }
  }

  workHistoryWOs.sort((a: any, b: any) => {
    const dateA = a.completionDateTime || a.dateCompleted || a.startDateTime || '';
    const dateB = b.completionDateTime || b.dateCompleted || b.startDateTime || '';
    return dateB.localeCompare(dateA);
  });

  const workHistory: any[] = workHistoryWOs.map((wo: any) => ({
    woNo: wo.workOrderNo || wo.woExecutionId || wo.id || '-',
    assignedTo: wo.assignedTo || '-',
    performedBy: wo.performedBy || wo.assignedTo || '-',
    workDate: wo.startDateTime || wo.dueDate || '',
    runDate: wo.runningHours?.toString() || '',
    completionDate: wo.completionDateTime || wo.dateCompleted || '',
    status: wo.status || 'Completed',
    description: wo.workCarriedOut || wo.jobTitle || 'Maintenance completed',
    remarks: wo.completionRemarks || wo.remarks || wo.jobExperienceNotes || '',
    missedCycles: wo.missedCycles || 0,
    originalDueDate: wo.originalDueDate || null,
    isSkipped: false,
    skippedCycleDate: null,
    sourceWorkOrderId: null,
    componentCode: wo.componentCode || workOrder.componentCode || (component as any)?.componentCode || ''
  }));

  const existingWoIds = new Set(workHistoryWOs.map((wo: any) => wo.wouuid).filter(Boolean));

  if (workOrder.wouuid && workOrder.status === 'Completed') {
    try {
      const ownHistory = await repo.findMaintenanceHistoryByWorkOrderId(workOrder.wouuid);
      if (ownHistory && !existingWoIds.has(workOrder.wouuid)) {
        existingWoIds.add(workOrder.wouuid);
        workHistory.push({
          woNo: ownHistory.workOrderNo || workOrder.workOrderNo || '-',
          assignedTo: '-',
          performedBy: ownHistory.performedBy || workOrder.performedBy || '-',
          approvedBy: ownHistory.approvedBy || null,
          workDate: ownHistory.dateCompleted || '',
          runDate: ownHistory.runningHoursAtCompletion?.toString() || '',
          completionDate: ownHistory.dateCompleted || '',
          status: ownHistory.status === 'Approved' ? 'Completed' : (ownHistory.status || 'Completed'),
          description: ownHistory.workDescription || ownHistory.jobTitle || 'Maintenance completed',
          remarks: ownHistory.remarks || '',
          sparesUsed: (ownHistory.sparesUsed as any[]) || [],
          missedCycles: ownHistory.missedCycles || 0,
          originalDueDate: ownHistory.originalDueDate || null,
          isSkipped: false,
          skippedCycleDate: null,
          sourceWorkOrderId: null,
          componentCode: workOrder.componentCode || (component as any)?.componentCode || ''
        });
      }
    } catch (err) {
      console.error('[CONTEXT] Failed to fetch own maintenance history record:', err);
    }
  }

  if (job?.juuid) {
    try {
      const maintenanceHistoryRecords = await repo.findMaintenanceHistoryByJobId(job.juuid);

      for (const h of maintenanceHistoryRecords) {
        if (h.isSkipped) {
          workHistory.push({
            woNo: '-',
            assignedTo: '-',
            performedBy: '-',
            approvedBy: null,
            workDate: h.skippedCycleDate || h.dateCompleted || '',
            runDate: '',
            completionDate: h.dateCompleted || h.skippedCycleDate || '',
            status: 'SKIPPED',
            description: h.workDescription || 'Cycle not performed',
            remarks: h.remarks || '',
            sparesUsed: [],
            missedCycles: 0,
            originalDueDate: h.originalDueDate || null,
            isSkipped: true,
            skippedCycleDate: h.skippedCycleDate || null,
            sourceWorkOrderId: h.sourceWorkOrderId || null,
            componentCode: (h as any).componentCode || workOrder.componentCode || (component as any)?.componentCode || ''
          });
        } else if (h.workOrderId && !existingWoIds.has(h.workOrderId)) {
          existingWoIds.add(h.workOrderId);
          workHistory.push({
            woNo: h.workOrderNo || '-',
            assignedTo: '-',
            performedBy: h.performedBy || '-',
            approvedBy: h.approvedBy || null,
            workDate: h.dateCompleted || '',
            runDate: h.runningHoursAtCompletion?.toString() || '',
            completionDate: h.dateCompleted || '',
            status: h.status === 'Approved' ? 'Completed' : (h.status || 'Completed'),
            description: h.workDescription || h.jobTitle || 'Maintenance completed',
            remarks: h.remarks || '',
            sparesUsed: (h.sparesUsed as any[]) || [],
            missedCycles: h.missedCycles || 0,
            originalDueDate: h.originalDueDate || null,
            isSkipped: false,
            skippedCycleDate: null,
            sourceWorkOrderId: null,
            componentCode: (h as any).componentCode || workOrder.componentCode || (component as any)?.componentCode || ''
          });
        }
      }
    } catch (err) {
      console.error('[CONTEXT] Failed to fetch maintenance history records:', err);
    }
  }

  workHistory.sort((a: any, b: any) => {
    const dateA = a.completionDate || a.workDate || '';
    const dateB = b.completionDate || b.workDate || '';
    return dateB.localeCompare(dateA);
  });

  const latestCompletedEntry = workHistory.find((h: any) => !h.isSkipped && (h.status === 'Completed' || h.status === 'completed'));

  let lastCompletedDate: string = '';
  let lastCompletedRH: string = '';
  let lastCompletedDateForRH: string = '';
  let lastCompletedCurrentReading: string = '';

  const sameComponentWOs = workHistoryWOs.filter((wo: any) =>
    (wo.componentCode === workOrder.componentCode || wo.component === workOrder.component)
  );
  sameComponentWOs.sort((a: any, b: any) => {
    const dateA = a.completionDateTime || a.dateCompleted || '';
    const dateB = b.completionDateTime || b.dateCompleted || '';
    return dateB.localeCompare(dateA);
  });
  const latestSameComponentWO = sameComponentWOs[0];
  if (latestSameComponentWO) {
    lastCompletedCurrentReading = latestSameComponentWO.currentReading?.toString() || latestSameComponentWO.runningHours?.toString() || '';
  }

  if (latestCompletedEntry) {
    lastCompletedDate = latestCompletedEntry.completionDate || latestCompletedEntry.workDate || '';
    lastCompletedRH = latestCompletedEntry.runDate || '';
    lastCompletedDateForRH = lastCompletedDate;
  } else {
    if (job?.lastDoneDate) {
      lastCompletedDate = convertToIsoDate(job.lastDoneDate);
    }
    if (job?.lastDoneRH) {
      lastCompletedRH = String(job.lastDoneRH);
    }
    if (lastCompletedDate) {
      lastCompletedDateForRH = lastCompletedDate;
    }
  }

  if (!lastCompletedCurrentReading && lastCompletedRH) {
    lastCompletedCurrentReading = lastCompletedRH;
  }

  // Build templateData from job data (Part A - immutable from job definition)
  // This ensures Section A is populated from the job template
  const rawSpareParts = ensureArray(job?.requiredSpareParts);
  const enrichedSpareParts = await enrichSparePartsWithROB(rawSpareParts, workOrder.vesselId as string);

  const templateData = job ? {
    woTitle: job.jobTitle,
    jobTitle: job.jobTitle,
    jobNo: job.jobNo,
    component: workOrder.component,
    componentCode: workOrder.componentCode || component.componentCode,
    componentName: component.name,
    sfiCode: job.sfiCode || job.componentCode || component.componentCode,
    maintenanceBasis: job.maintenanceBasis,
    maintenanceType: job.maintenanceType,
    frequencyValue: job.frequencyValue?.toString() || '',
    frequencyUnit: job.frequencyUnit || 'Months',
    intervalRunningHour: job.intervalRunningHour?.toString() || '',
    assignedTo: job.assignedTo || workOrder.assignedTo,
    approver: job.approver,
    level2ReviewerRankId: (job as any).level2ReviewerRankId || null,
    department: job.department,
    jobPriority: job.jobPriority,
    classRelated: job.classRelated,
    criticality: job.criticality,
    lastDoneDate: convertToIsoDate(job.lastDoneDate),
    nextDueDate: convertToIsoDate(job.nextDueDate),
    lastDoneRH: job.lastDoneRH?.toString() || '',
    nextDueRH: job.nextDueRH?.toString() || '',
    lastCompletedDate,
    lastCompletedRH,
    lastCompletedDateForRH,
    lastCompletedCurrentReading,
    briefWorkDescription: job.briefWorkDescription || job.jobDescription,
    jobDescription: job.jobDescription,
    requiredSpareParts: enrichedSpareParts,
    requiredTools: ensureArray(job.requiredTools),
    safetyRequirements: ensureJsonObject(job.safetyRequirements, { ppeRequirements: [], permitRequirements: [], otherRequirements: [] }),
    workHistory,
    vesselId: workOrder.vesselId
  } : {
    // Fallback: use work order fields if job not found (for unplanned WOs)
    woTitle: workOrder.jobTitle,
    jobTitle: workOrder.jobTitle,
    jobNo: workOrder.templateCode,
    component: workOrder.component,
    componentCode: component.componentCode,
    componentName: component.name,
    sfiCode: component.componentCode,
    maintenanceBasis: workOrder.maintenanceBasis || 'Calendar',
    maintenanceType: workOrder.maintenanceType,
    frequencyValue: workOrder.frequencyValue?.toString() || '',
    frequencyUnit: workOrder.frequencyUnit || 'Months',
    intervalRunningHour: '',
    assignedTo: workOrder.assignedTo,
    approver: workOrder.approver,
    department: workOrder.department,
    jobPriority: workOrder.jobPriority,
    classRelated: workOrder.classRelated,
    criticality: workOrder.criticality,
    lastDoneDate: '',
    nextDueDate: convertToIsoDate(workOrder.dueDate),
    lastDoneRH: '',
    nextDueRH: '',
    lastCompletedDate,
    lastCompletedRH,
    lastCompletedDateForRH,
    lastCompletedCurrentReading,
    briefWorkDescription: workOrder.briefWorkDescription,
    jobDescription: workOrder.briefWorkDescription,
    requiredSpareParts: [],
    requiredTools: [],
    safetyRequirements: { ppeRequirements: [], permitRequirements: [], otherRequirements: [] },
    workHistory,
    vesselId: workOrder.vesselId
  };

  // CORRECTIVE: Detect stuck rejected WOs (wasRejected=true + approvalAction='rejected' but status still 'Pending Approval')
  // This can happen if the rejection PATCH didn't fully persist the status change.
  // Correct the status in-memory so the form treats it as 'Due' and fix the DB asynchronously.
  const correctedWorkOrder = { ...workOrder } as any;
  let wasStuckRejection = false;
  if (correctedWorkOrder.wasRejected === true &&
      correctedWorkOrder.approvalAction === 'rejected' &&
      correctedWorkOrder.status === 'Pending Approval') {
    console.warn(`⚠️ CORRECTIVE: WO ${correctedWorkOrder.workOrderNo || correctedWorkOrder.id} has wasRejected=true but status is still 'Pending Approval'. Correcting to 'Due'.`);
    correctedWorkOrder.status = 'Due';
    correctedWorkOrder.completionDateTime = null;
    correctedWorkOrder.dateCompleted = null;
    correctedWorkOrder.approvalTier = null;
    wasStuckRejection = true;
    // Fire-and-forget DB correction
    repo.update(workOrder.id || (workOrder as any).wouuid, {
      status: 'Due',
      completionDateTime: null,
      dateCompleted: null,
      approvalTier: null,
      daysLate: null,
      approvalBlockReason: null,
    }).catch(err => console.error('⚠️ Failed to auto-correct stuck rejected WO status:', err));
  }

  // Build executionData from work order (Part B - editable execution record)
  const executionData = {
    // B1 - Risk Assessment, Checklists & Records
    riskAssessmentStatus: correctedWorkOrder.riskAssessmentStatus || '',
    safetyChecklistsStatus: correctedWorkOrder.safetyChecklistsStatus || '',
    operationalFormsStatus: correctedWorkOrder.operationalFormsStatus || '',
    uploadedDocuments: ensureArray(correctedWorkOrder.uploadedDocuments),
    // B2 - Work Duration
    startDateTime: correctedWorkOrder.startDateTime || '',
    completionDateTime: correctedWorkOrder.completionDateTime || '',
    executionAssignedTo: correctedWorkOrder.executionAssignedTo || '',
    performedBy: correctedWorkOrder.performedBy || '',
    noOfPersons: correctedWorkOrder.noOfPersons || '',
    totalTimeHours: correctedWorkOrder.totalTimeHours || '',
    manhours: correctedWorkOrder.manhours || '',
    workCarriedOut: correctedWorkOrder.workCarriedOut || '',
    jobExperienceNotes: correctedWorkOrder.jobExperienceNotes || '',
    // B3 - Running Hours
    previousReading: correctedWorkOrder.previousReading?.toString() || '',
    currentReading: correctedWorkOrder.currentReading?.toString() || '',
    runningHoursDifference: correctedWorkOrder.runningHoursDifference?.toString() || '',
    readingDate: correctedWorkOrder.readingDate || '',
    runningHours: correctedWorkOrder.runningHours || '',
    rhBackdatedEntry: !!(correctedWorkOrder as any).rhBackdatedEntry,
    // B4 - Spare Parts Consumed
    consumedSpareParts: ensureArray(correctedWorkOrder.consumedSpareParts),
    // Metadata
    woExecutionId: correctedWorkOrder.woExecutionId || '',
    remarks: correctedWorkOrder.remarks || '',
    dateCompleted: correctedWorkOrder.dateCompleted || '',
    completionRemarks: correctedWorkOrder.completionRemarks || ''
  };

  // Use actual database data - no dummy data overrides
  const finalTemplateData: any = { ...templateData };

  return {
    workOrder: correctedWorkOrder,
    templateData: finalTemplateData,
    executionData,
    job,
    component: {
      id: component.cuuid,
      componentCode: component.componentCode,
      name: component.name,
      parentId: component.parentId,
      currentCumulativeRH: component.currentCumulativeRH,
      lastUpdated: (latestAudit as any)?.dateUpdatedLocal || component.lastUpdated,
      rhCounterType: component.rhCounterType,
      rhCounterSource: component.rhCounterSource
    },
    parentComponent: parentComponent ? {
      id: parentComponent.id,
      componentCode: parentComponent.componentCode,
      name: parentComponent.name,
      currentCumulativeRH: parentComponent.currentCumulativeRH
    } : null,
    // RH Master component for INHERITED components (used for validation)
    // Inherited components cannot have RH greater than their master component
    rhMasterComponent: rhMasterComponent ? {
      id: rhMasterComponent.id,
      componentCode: rhMasterComponent.componentCode,
      name: rhMasterComponent.name,
      currentCumulativeRH: rhMasterComponent.currentCumulativeRH || (rhMasterComponent as any).rhCurrentMaster
    } : null,
    maintenanceBasis: workOrder.maintenanceBasis || job?.maintenanceBasis
  };
}
