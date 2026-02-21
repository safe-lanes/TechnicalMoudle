import * as repo from '../repositories/workOrderRepository';
import { NotFoundError } from '../../shared/errors';

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
  if (!spareParts || spareParts.length === 0) return spareParts;

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

  // Build templateData from job data (Part A - immutable from job definition)
  // This ensures Section A is populated from the job template
  const rawSpareParts = job?.requiredSpareParts || [];
  const enrichedSpareParts = await enrichSparePartsWithROB(rawSpareParts as any[], workOrder.vesselId as string);

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
    assignedTo: job.assignedTo,
    approver: job.approver,
    department: job.department,
    jobPriority: job.jobPriority,
    classRelated: job.classRelated,
    criticality: job.criticality,
    lastDoneDate: convertToIsoDate(job.lastDoneDate),
    nextDueDate: convertToIsoDate(job.nextDueDate),
    lastDoneRH: job.lastDoneRH?.toString() || '',
    nextDueRH: job.nextDueRH?.toString() || '',
    briefWorkDescription: job.briefWorkDescription || job.jobDescription,
    jobDescription: job.jobDescription,
    requiredSpareParts: enrichedSpareParts,
    requiredTools: job.requiredTools || [],
    safetyRequirements: job.safetyRequirements || { ppeRequirements: [], permitRequirements: [], otherRequirements: [] },
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
    briefWorkDescription: workOrder.briefWorkDescription,
    jobDescription: workOrder.briefWorkDescription,
    requiredSpareParts: [],
    requiredTools: [],
    safetyRequirements: { ppeRequirements: [], permitRequirements: [], otherRequirements: [] },
    vesselId: workOrder.vesselId
  };

  // Build executionData from work order (Part B - editable execution record)
  const executionData = {
    // B1 - Risk Assessment, Checklists & Records
    riskAssessmentStatus: workOrder.riskAssessmentStatus || '',
    safetyChecklistsStatus: workOrder.safetyChecklistsStatus || '',
    operationalFormsStatus: workOrder.operationalFormsStatus || '',
    uploadedDocuments: workOrder.uploadedDocuments || [],
    // B2 - Work Duration
    startDateTime: workOrder.startDateTime || '',
    completionDateTime: workOrder.completionDateTime || '',
    executionAssignedTo: workOrder.executionAssignedTo || '',
    performedBy: workOrder.performedBy || '',
    noOfPersons: workOrder.noOfPersons || '',
    totalTimeHours: workOrder.totalTimeHours || '',
    manhours: workOrder.manhours || '',
    workCarriedOut: workOrder.workCarriedOut || '',
    jobExperienceNotes: workOrder.jobExperienceNotes || '',
    // B3 - Running Hours
    previousReading: workOrder.previousReading?.toString() || '',
    currentReading: workOrder.currentReading?.toString() || '',
    runningHoursDifference: workOrder.runningHoursDifference?.toString() || '',
    readingDate: workOrder.readingDate || '',
    runningHours: workOrder.runningHours || '',
    // B4 - Spare Parts Consumed
    consumedSpareParts: workOrder.consumedSpareParts || [],
    // Metadata
    woExecutionId: workOrder.woExecutionId || '',
    remarks: workOrder.remarks || '',
    dateCompleted: workOrder.dateCompleted || '',
    completionRemarks: workOrder.completionRemarks || ''
  };

  // Use actual database data - no dummy data overrides
  const finalTemplateData: any = { ...templateData };

  return {
    workOrder,
    templateData: finalTemplateData,
    executionData,
    job,
    component: {
      id: component.id,
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
