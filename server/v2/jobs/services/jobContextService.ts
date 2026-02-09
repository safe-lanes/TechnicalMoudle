import { JobRepository } from '../repositories/jobRepository';

export class JobContextService {
  constructor(private repo: JobRepository) {}

  async getJobContext(jobId: string) {
    const job = await this.repo.findById(jobId);
    if (!job) return null;

    const component = job.componentId ? await this.repo.findComponentById(job.componentId) : null;

    let parentComponent = null;
    if (component?.parentId) {
      parentComponent = await this.repo.findComponentById(component.parentId);
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
        if (monthNum) {
          return `${year}-${monthNum}-${day.padStart(2, '0')}`;
        }
      }
      return dateStr;
    };

    const allWorkOrders = await this.repo.findWorkOrdersByJobId(jobId);
    const completedWorkOrders = allWorkOrders.filter(wo => wo.status === 'Completed');

    const workHistory = completedWorkOrders.map(wo => {
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
        remarks: wo.completionRemarks || wo.remarks || wo.jobExperienceNotes || formDataRemarks || ''
      };
    });

    const rawSpareParts = (job.requiredSpareParts as any[]) || [];
    const tools = (job.requiredTools as any[]) || [];
    const safetyReqs = (job.safetyRequirements as any) || { ppeRequirements: [], permitRequirements: [], otherRequirements: [] };

    const partCodes = rawSpareParts.map((sp: any) => sp.partCode).filter(Boolean);
    const partNumbers = rawSpareParts.map((sp: any) => sp.partNo).filter(Boolean);

    const inventoryByPartCode = await this.repo.findSpareInventoryByCodes(job.vesselId!, partCodes);
    const inventoryByPartNumber = partNumbers.length > 0
      ? await this.repo.findSpareInventoryByNumbers(job.vesselId!, partNumbers)
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
        id: component.id,
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
}
