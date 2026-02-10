import { v4 as uuidv4 } from "uuid";
import * as repo from "../repositories/workOrderRepository";
import {
  generatePlannedWorkOrderNumber,
  generateUnplannedWorkOrderNumber,
  generateExecutionId,
  isBlockingStatus,
} from "../utils/workOrderNumbering";
import { getEnrichedWorkOrder } from "./workOrderListService";

function normalizeDateToISO(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.split('T')[0];
  const ddmmyyyyMatch = dateStr.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return null;
}

export async function createWorkOrderHandler(body: any) {
  const id = body.id || uuidv4();

  if (!body.vesselId) {
    throw new Error('Vessel ID is required');
  }
  if (!body.jobTitle) {
    throw new Error('Job title is required');
  }

  let data: any = { ...body, id };

  if (body.jobId) {
    const existingWOs = await repo.getWorkOrdersByVessel(body.vesselId);
    const newComponentCode = body.componentCode || null;

    const existingActiveWO = existingWOs.find(wo => {
      if (wo.jobId !== body.jobId) return false;
      if (!isBlockingStatus(wo.status)) return false;
      const existingComponentCode = wo.componentCode || null;
      return existingComponentCode === newComponentCode;
    });

    if (existingActiveWO) {
      throw new Error(`Work Order already exists for this job and component: ${existingActiveWO.workOrderNo}. Only one active work order is allowed per job-component combination.`);
    }

    const job = await repo.getJob(body.jobId);
    if (job) {
      if (!data.maintenanceBasis) data.maintenanceBasis = job.maintenanceBasis;
      if (!data.frequencyValue) data.frequencyValue = job.frequencyValue;
      if (!data.frequencyUnit) data.frequencyUnit = job.frequencyUnit;
      if (!data.maintenanceType) data.maintenanceType = job.maintenanceType;
      if (!data.taskType) data.taskType = job.maintenanceType;
      if (!data.jobPriority) data.jobPriority = job.jobPriority;
      if (!data.classRelated) data.classRelated = job.classRelated;
      if (!data.department) data.department = job.department;
      if (!data.approver) data.approver = job.approver;
      if (!data.briefWorkDescription) data.briefWorkDescription = job.briefWorkDescription || job.jobDescription;

      if (!data.workOrderNo) {
        const componentCode = data.componentCode || '';
        if (componentCode) {
          data.workOrderNo = await generatePlannedWorkOrderNumber(job.jobNo, componentCode, body.vesselId);
        }
      }
      if (!data.templateCode) data.templateCode = data.workOrderNo || job.jobNo;

      data.workOrderType = 'Planned';

      if (job.maintenanceBasis === 'Running Hours') {
        data.driverType = 'RH';
        if (job.nextDueRH) data.cycleDueRhSnapshot = job.nextDueRH;
        if (job.lastDoneRH) data.rhLastDoneSnapshot = job.lastDoneRH;
      } else {
        data.driverType = 'CALENDAR';
        if (job.nextDueDate) {
          data.cycleDueDateSnapshot = job.nextDueDate;
          if (!data.dueDate) data.dueDate = job.nextDueDate;
        }
        if (job.lastDoneDate) data.lastDoneDateSnapshot = job.lastDoneDate;
      }
    }
  } else {
    data.workOrderType = data.workOrderType || 'Unplanned';
    if (!data.workOrderNo) {
      const componentCode = data.componentCode || '';
      if (componentCode && data.vesselId) {
        data.workOrderNo = await generateUnplannedWorkOrderNumber(data.vesselId, componentCode);
      }
    }
    if (!data.templateCode) data.templateCode = data.workOrderNo;
  }

  if (!data.workOrderNo) {
    const randomDigits = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
    data.workOrderNo = `WO-${randomDigits}`;
  }

  if (data.vesselId && (data.component || data.componentCode)) {
    let resolvedComponent = null;
    if (data.component) resolvedComponent = await repo.getComponent(data.component);
    if (!resolvedComponent && data.componentCode) {
      resolvedComponent = await repo.getComponentByCode(data.componentCode, data.vesselId);
    }
    if (!resolvedComponent && data.component) {
      const vesselComponents = await repo.getComponents(data.vesselId);
      resolvedComponent = vesselComponents.find((c: any) => c.name === data.component);
    }
    if (resolvedComponent) {
      data.componentCode = resolvedComponent.componentCode;
    }
  }

  delete data.dateOfCompletion;

  const result = await repo.createWorkOrder(data);
  return result;
}

export async function updateWorkOrderHandler(id: string, body: any) {
  const existingWO = await repo.getWorkOrder(id);
  if (!existingWO) return null;

  const isCompleted = existingWO.status === 'Completed' || existingWO.status === 'Approved';
  if (isCompleted) {
    const allowedFields = ['remarks', 'completionRemarks', 'jobExperienceNotes', 'approverRemarks'];
    const requestedFields = Object.keys(body);
    const disallowed = requestedFields.filter(f => !allowedFields.includes(f));
    if (disallowed.length > 0) {
      return {
        error: 'Cannot modify completed work order',
        message: `Work Order ${existingWO.workOrderNo} is completed and cannot be modified. Only remarks can be added.`,
        disallowedFields: disallowed,
      };
    }
  }

  let updateData: any = { ...body };
  Object.keys(updateData).forEach(key => {
    if (updateData[key] === undefined) delete updateData[key];
  });

  if (updateData.dateOfCompletion) {
    const normalized = normalizeDateToISO(updateData.dateOfCompletion);
    if (normalized) {
      const isoTimestamp = `${normalized}T00:00:00.000Z`;
      updateData.completionDateTime = isoTimestamp;
      updateData.dateCompleted = isoTimestamp;
    }
  }

  const hasCompletionData = !!(updateData.completionDateTime || updateData.dateOfCompletion);
  const hasExplicitStatus = updateData.status !== undefined;

  const isBeingRejected = updateData.approvalAction === 'rejected' || updateData.status?.toLowerCase() === 'rejected';
  if (isBeingRejected) {
    updateData.completionDateTime = null;
    updateData.dateCompleted = null;
    updateData.rejectionDate = new Date().toISOString();
    updateData.wasRejected = true;
    updateData.status = 'Due';
  }

  if (updateData.approvalAction === 'approved' && updateData.status === 'Completed') {
    await processApproval(existingWO, updateData);
  }

  if (!isBeingRejected && hasCompletionData && !hasExplicitStatus) {
    if (existingWO.status !== 'Approved' && existingWO.status !== 'Completed') {
      updateData.status = 'Pending Approval';
      if (!existingWO.submittedDate) {
        updateData.submittedDate = new Date().toISOString();
      }
    }
  }

  if (existingWO.wasRejected && hasCompletionData && !hasExplicitStatus) {
    updateData.status = 'Pending Approval';
    updateData.rejectionComments = null;
    updateData.rejectionDate = null;
    updateData.approvalAction = null;
    updateData.submittedDate = new Date().toISOString();
  }

  delete updateData.dateOfCompletion;

  const result = await repo.updateWorkOrder(id, updateData);
  return getEnrichedWorkOrder(id);
}

async function processApproval(existingWO: any, updateData: any) {
  let component = await repo.getComponent(existingWO.component);
  if (!component && existingWO.componentCode && existingWO.vesselId) {
    component = await repo.getComponentByCode(existingWO.componentCode, existingWO.vesselId);
  }
  if (!component && existingWO.vesselId) {
    const vesselComponents = await repo.getComponents(existingWO.vesselId);
    component = vesselComponents.find((c: any) => c.name === existingWO.component) ?? null;
  }

  if (component) {
    try {
      const rawDate = existingWO.completionDateTime || existingWO.dateCompleted || updateData.completionDateTime;
      const dateOfCompletion = rawDate ? normalizeDateToISO(rawDate) : new Date().toISOString().split('T')[0];

      if (dateOfCompletion) {
        await repo.createMaintenanceHistory({
          componentId: component.id,
          componentCode: existingWO.componentCode || component.componentCode,
          vesselCode: existingWO.vesselId,
          workOrderId: existingWO.id,
          workOrderNo: existingWO.workOrderNo || `WO-${existingWO.id}`,
          jobTitle: existingWO.jobTitle,
          maintenanceType: existingWO.maintenanceType || existingWO.taskType || 'Servicing',
          dateCompleted: dateOfCompletion,
          runningHoursAtCompletion: existingWO.runningHours || null,
          performedBy: existingWO.performedBy || existingWO.executionAssignedTo || 'Unknown',
          approvedBy: existingWO.approver || null,
          approvalDate: dateOfCompletion,
          status: 'Approved',
          workDescription: existingWO.workCarriedOut || existingWO.briefWorkDescription || null,
          sparesUsed: existingWO.consumedSpareParts ? JSON.stringify(existingWO.consumedSpareParts) : null,
          remarks: existingWO.remarks || existingWO.jobExperienceNotes || null,
          isComponentReplaced: false,
        });
      }
    } catch (err) {
      console.error('Failed to create maintenance history during approval:', err);
    }

    if (existingWO.runningHours) {
      const rhValue = parseFloat(existingWO.runningHours);
      if (!isNaN(rhValue)) {
        const counterType = (component.rhCounterType || '').toUpperCase();

        if (counterType === 'MASTER' && existingWO.vesselId) {
          await repo.updateComponent(component.id, {
            currentCumulativeRH: rhValue.toString(),
            rhCurrentMaster: rhValue.toString(),
            lastUpdated: new Date().toISOString(),
          });

          const allComponents = await repo.getComponents(existingWO.vesselId);
          const inheritedChildren = allComponents.filter(c => {
            const ct = (c.rhCounterType || '').toUpperCase();
            return ct === 'INHERITED' && (
              c.rhMasterComponentId === component!.id ||
              c.rhCounterSource === component!.componentCode
            );
          });
          for (const child of inheritedChildren) {
            await repo.updateComponent(child.id, {
              currentCumulativeRH: rhValue.toString(),
              lastUpdated: new Date().toISOString(),
            });
          }
        } else {
          await repo.updateComponent(component.id, {
            currentCumulativeRH: rhValue.toString(),
            lastUpdated: new Date().toISOString(),
          });
        }
      }
    }

    try {
      await updateJobCycleDates(existingWO, updateData);
    } catch (err) {
      console.error('Failed to update job cycle dates during approval:', err);
    }
  }
}

async function updateJobCycleDates(wo: any, updateData: any) {
  let job = null;
  if (wo.jobId) job = await repo.getJob(wo.jobId);
  if (!job) return;

  const rawDate = wo.completionDateTime || wo.dateCompleted || updateData.completionDateTime;
  const completionDate = rawDate ? normalizeDateToISO(rawDate) : null;
  const runningHours = wo.runningHours;

  const jobUpdate: any = {};

  if (completionDate) {
    jobUpdate.lastDoneDate = completionDate;
    if (job.frequencyValue && job.frequencyUnit) {
      const freq = parseInt(job.frequencyValue);
      if (!isNaN(freq)) {
        const baseDate = new Date(completionDate);
        switch (job.frequencyUnit) {
          case 'Months': baseDate.setMonth(baseDate.getMonth() + freq); break;
          case 'Years': baseDate.setFullYear(baseDate.getFullYear() + freq); break;
          case 'Weeks': baseDate.setDate(baseDate.getDate() + freq * 7); break;
          case 'Days': baseDate.setDate(baseDate.getDate() + freq); break;
        }
        jobUpdate.nextDueDate = baseDate.toISOString().split('T')[0];
      }
    }
  }

  if (runningHours && job.maintenanceBasis === 'Running Hours') {
    jobUpdate.lastDoneRH = runningHours.toString();
    if (job.frequencyValue) {
      const freq = parseFloat(job.frequencyValue);
      const rh = parseFloat(runningHours);
      if (!isNaN(freq) && !isNaN(rh)) {
        jobUpdate.nextDueRH = (rh + freq).toString();
      }
    }
  }

  if (Object.keys(jobUpdate).length > 0) {
    await repo.updateJob(job.id, jobUpdate);
  }
}

export async function deleteWorkOrderHandler(id: string) {
  const wo = await repo.getWorkOrder(id);
  if (!wo) return false;
  await repo.deleteWorkOrder(id);
  return true;
}
