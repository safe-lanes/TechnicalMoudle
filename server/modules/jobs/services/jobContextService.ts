import * as repo from '../repositories/jobRepository';
import { NotFoundError } from '../../shared/errors';

// Helper: Convert DD-MMM-YYYY to ISO YYYY-MM-DD for HTML date inputs
function convertToIsoDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const monthMap: Record<string, string> = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
    'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };
  const match = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    const monthNum = monthMap[month];
    if (monthNum) {
      return `${year}-${monthNum}-${day.padStart(2, '0')}`;
    }
  }
  return dateStr;
}

export async function getJobContext(jobId: string) {
  const job = await repo.findById(jobId);
  if (!job) {
    throw new NotFoundError('Job not found');
  }

  // Get component data
  const component = job.componentId ? await repo.findComponent(job.componentId) : null;

  // Get parent component
  let parentComponent = null;
  if (component?.parentId) {
    parentComponent = await repo.findComponent(component.parentId as string);
  }

  // Fetch completed work orders for this job (Work History - Section A4)
  const allWorkOrdersForJob = await repo.findWorkOrdersByJobId(job.juuid);
  const completedWorkOrders = allWorkOrdersForJob.filter((wo: any) => wo.status === 'Completed');

  const workHistory: any[] = completedWorkOrders.map((wo: any) => {
    const formDataRemarks = (wo.formData as any)?.sectionB2?.remarks ||
                            (wo.formData as any)?.remarks || '';
    return {
      woNo: wo.workOrderNo || wo.woExecutionId || wo.id || '-',
      assignedTo: wo.assignedTo || '-',
      performedBy: wo.performedBy || wo.assignedTo || '-',
      workDate: wo.startDateTime || wo.dueDate || '',
      runDate: wo.runningHours?.toString() || '',
      completionDate: wo.completionDateTime || wo.dateCompleted || '',
      status: wo.status || 'Completed',
      description: wo.workCarriedOut || wo.jobTitle || 'Maintenance completed',
      remarks: wo.completionRemarks || wo.remarks || wo.jobExperienceNotes || formDataRemarks || '',
      missedCycles: wo.missedCycles || 0,
      originalDueDate: wo.originalDueDate || null,
      isSkipped: false,
      skippedCycleDate: null,
      sourceWorkOrderId: null,
      componentCode: wo.componentCode || (component as any)?.componentCode || (job as any).componentCode || ''
    };
  });

  // Also fetch from component_maintenance_history to pick up skipped cycles and
  // entries that may not have a corresponding work_orders row (mirrors WO Form logic)
  if (job.juuid) {
    try {
      const maintenanceHistoryRecords = await repo.findMaintenanceHistoryByJobId(job.juuid);
      const existingWoIds = new Set(completedWorkOrders.map((wo: any) => wo.wouuid).filter(Boolean));

      for (const h of maintenanceHistoryRecords) {
        if (h.isSkipped) {
          workHistory.push({
            woNo: '-',
            assignedTo: '-',
            performedBy: '-',
            workDate: h.skippedCycleDate || h.dateCompleted || '',
            runDate: '',
            completionDate: h.dateCompleted || h.skippedCycleDate || '',
            status: 'SKIPPED',
            description: h.workDescription || 'Cycle not performed',
            remarks: h.remarks || '',
            missedCycles: 0,
            originalDueDate: h.originalDueDate || null,
            isSkipped: true,
            skippedCycleDate: h.skippedCycleDate || null,
            sourceWorkOrderId: h.sourceWorkOrderId || null,
            componentCode: (h as any).componentCode || (component as any)?.componentCode || (job as any).componentCode || ''
          });
        } else if (h.workOrderId && !existingWoIds.has(h.workOrderId)) {
          existingWoIds.add(h.workOrderId);
          workHistory.push({
            woNo: h.workOrderNo || '-',
            assignedTo: '-',
            performedBy: h.performedBy || '-',
            workDate: h.dateCompleted || '',
            runDate: h.runningHoursAtCompletion?.toString() || '',
            completionDate: h.dateCompleted || '',
            status: h.status === 'Approved' ? 'Completed' : (h.status || 'Completed'),
            description: h.workDescription || h.jobTitle || 'Maintenance completed',
            remarks: h.remarks || '',
            missedCycles: h.missedCycles || 0,
            originalDueDate: h.originalDueDate || null,
            isSkipped: false,
            skippedCycleDate: null,
            sourceWorkOrderId: null,
            componentCode: (h as any).componentCode || (component as any)?.componentCode || (job as any).componentCode || ''
          });
        }
      }
    } catch (err) {
      console.error('[JOB CONTEXT] Failed to fetch maintenance history records:', err);
    }
  }

  // Sort descending by completion date
  workHistory.sort((a: any, b: any) => {
    const dateA = a.completionDate || a.workDate || '';
    const dateB = b.completionDate || b.workDate || '';
    return dateB.localeCompare(dateA);
  });

  // Get spare parts, tools, safety requirements
  const rawSpareParts = (job.requiredSpareParts || []) as any[];
  const tools = (job.requiredTools || []) as any[];
  const safetyReqs = job.safetyRequirements || { ppeRequirements: [], permitRequirements: [], otherRequirements: [] };

  // Enrich spare parts with ROB inventory data
  const partCodes = rawSpareParts.map((sp: any) => sp.partCode).filter(Boolean);
  const partNumbers = rawSpareParts.map((sp: any) => sp.partNo).filter(Boolean);

  const inventoryByPartCode = await repo.findSpareInventoryByPartCodes(job.vesselId as string, partCodes);
  const inventoryByPartNumber = partNumbers.length > 0
    ? await repo.findSpareInventoryByPartNumbers(job.vesselId as string, partNumbers)
    : new Map();

  const spareParts = rawSpareParts.map((sp: any) => {
    let inventory = sp.partCode ? inventoryByPartCode.get(sp.partCode) : null;
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

  // Build template data
  const templateData = {
    woTitle: job.jobTitle,
    jobTitle: job.jobTitle,
    jobNo: job.jobNo,
    component: job.componentId,
    componentCode: job.componentCode,
    componentName: job.componentName,
    sfiCode: job.sfiCode || job.componentCode,
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
    isActive: job.isActive === false ? 'No' : 'Yes',
    lastDoneDate: convertToIsoDate(job.lastDoneDate),
    nextDueDate: convertToIsoDate(job.nextDueDate),
    lastDoneRH: job.lastDoneRH?.toString() || '',
    nextDueRH: job.nextDueRH?.toString() || '',
    briefWorkDescription: job.briefWorkDescription || job.jobDescription,
    jobDescription: job.jobDescription,
    requiredSpareParts: spareParts,
    requiredTools: tools,
    safetyRequirements: safetyReqs,
    vesselId: job.vesselId,
    workHistory: workHistory
  };

  return {
    job,
    templateData,
    component: component ? {
      id: component.cuuid,
      componentCode: component.componentCode,
      name: component.name,
      parentId: component.parentId,
      currentCumulativeRH: component.currentCumulativeRH,
      lastUpdated: component.lastUpdated
    } : null,
    parentComponent: parentComponent ? {
      id: parentComponent.id,
      componentCode: parentComponent.componentCode,
      name: parentComponent.name,
      currentCumulativeRH: parentComponent.currentCumulativeRH
    } : null,
    maintenanceBasis: job.maintenanceBasis
  };
}
