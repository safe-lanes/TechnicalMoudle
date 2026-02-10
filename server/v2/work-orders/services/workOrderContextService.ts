import * as repo from "../repositories/workOrderRepository";

export async function getWorkOrderContext(id: string) {
  const workOrder = await repo.getWorkOrder(id);
  if (!workOrder) return null;

  let component = await repo.getComponent(workOrder.component);

  if (!component && workOrder.componentCode && workOrder.vesselId) {
    component = await repo.getComponentByCode(workOrder.componentCode, workOrder.vesselId);
  }

  if (!component && workOrder.vesselId) {
    const allComponents = await repo.getComponents(workOrder.vesselId);
    component = allComponents.find(c =>
      c.name === workOrder.component ||
      c.componentCode === workOrder.component ||
      c.componentCode === workOrder.componentCode
    );
  }

  if (!component) return { workOrder, component: null, parentComponent: null, job: null, spares: [] };

  let parentComponent = null;
  if (component.parentId) {
    parentComponent = (await repo.getComponent(component.parentId)) ?? null;
  }

  let rhMasterComponent = null;
  const counterType = (component.rhCounterType || '').toUpperCase();
  if (counterType === 'INHERITED') {
    if (component.rhMasterComponentId) {
      rhMasterComponent = (await repo.getComponent(component.rhMasterComponentId)) ?? null;
    }
    if (!rhMasterComponent && component.rhCounterSource && workOrder.vesselId) {
      rhMasterComponent = (await repo.getComponentByCode(component.rhCounterSource, workOrder.vesselId)) ?? null;
    }
  }

  let job = null;
  if (workOrder.jobId) {
    job = (await repo.getJob(workOrder.jobId)) ?? null;
  }

  const convertToIsoDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    const monthMap: Record<string, string> = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
      'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    const match = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      const monthNum = monthMap[month];
      if (monthNum) return `${year}-${monthNum}-${day.padStart(2, '0')}`;
    }
    return dateStr;
  };

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
    requiredSpareParts: job.requiredSpareParts || [],
    requiredTools: job.requiredTools || [],
    safetyRequirements: job.safetyRequirements || { ppeRequirements: [], permitRequirements: [], otherRequirements: [] },
    vesselId: workOrder.vesselId,
  } : {
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
    vesselId: workOrder.vesselId,
  };

  const executionData = {
    riskAssessmentStatus: workOrder.riskAssessmentStatus || '',
    safetyChecklistsStatus: workOrder.safetyChecklistsStatus || '',
    operationalFormsStatus: workOrder.operationalFormsStatus || '',
    uploadedDocuments: workOrder.uploadedDocuments || [],
    startDateTime: workOrder.startDateTime || '',
    completionDateTime: workOrder.completionDateTime || '',
    executionAssignedTo: workOrder.executionAssignedTo || '',
    performedBy: workOrder.performedBy || '',
    noOfPersons: workOrder.noOfPersons || '',
    totalTimeHours: workOrder.totalTimeHours || '',
    manhours: workOrder.manhours || '',
    workCarriedOut: workOrder.workCarriedOut || '',
    jobExperienceNotes: workOrder.jobExperienceNotes || '',
    previousReading: workOrder.previousReading?.toString() || '',
    currentReading: workOrder.currentReading?.toString() || '',
    runningHoursDifference: workOrder.runningHoursDifference?.toString() || '',
    readingDate: workOrder.readingDate || '',
    runningHours: workOrder.runningHours || '',
    consumedSpareParts: workOrder.consumedSpareParts || [],
    woExecutionId: workOrder.woExecutionId || '',
    remarks: workOrder.remarks || '',
    dateCompleted: workOrder.dateCompleted || '',
    completionRemarks: workOrder.completionRemarks || '',
  };

  return {
    workOrder,
    templateData,
    executionData,
    job,
    component: {
      id: component.id,
      componentCode: component.componentCode,
      name: component.name,
      parentId: component.parentId,
      currentCumulativeRH: component.currentCumulativeRH,
      lastUpdated: component.lastUpdated,
      rhCounterType: component.rhCounterType,
      rhCounterSource: component.rhCounterSource,
    },
    parentComponent: parentComponent ? {
      id: parentComponent.id,
      componentCode: parentComponent.componentCode,
      name: parentComponent.name,
      currentCumulativeRH: parentComponent.currentCumulativeRH,
    } : null,
    rhMasterComponent: rhMasterComponent ? {
      id: rhMasterComponent.id,
      componentCode: rhMasterComponent.componentCode,
      name: rhMasterComponent.name,
      currentCumulativeRH: rhMasterComponent.currentCumulativeRH || (rhMasterComponent as any).rhCurrentMaster,
    } : null,
    maintenanceBasis: workOrder.maintenanceBasis || job?.maintenanceBasis,
  };
}
