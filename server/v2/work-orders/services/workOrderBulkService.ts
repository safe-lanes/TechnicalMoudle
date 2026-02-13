import * as repo from "../repositories/workOrderRepository";

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

export async function bulkApprove(body: any) {
  const { workOrderIds, approvedBy, approver, approvalRemarks } = body;
  const resolvedApprover = approvedBy || approver;
  if (!Array.isArray(workOrderIds) || workOrderIds.length === 0) {
    return { error: 'workOrderIds array is required' };
  }

  const success: string[] = [];
  const failed: { id: string; reason: string }[] = [];

  for (const woId of workOrderIds) {
    try {
      const wo = await repo.getWorkOrder(woId);
      if (!wo) {
        failed.push({ id: woId, reason: 'Work order not found' });
        continue;
      }

      const rawDate = wo.completionDateTime || wo.dateCompleted;
      const completionDate = rawDate ? normalizeDateToISO(rawDate) : new Date().toISOString().split('T')[0];

      await repo.updateWorkOrder(woId, {
        status: 'Completed',
        approvalAction: 'approved',
        approver: resolvedApprover || wo.approver,
        approvalDate: completionDate,
        approverRemarks: approvalRemarks || null,
      });

      let component = await repo.getComponent(wo.component);
      if (!component && wo.componentCode && wo.vesselId) {
        component = await repo.getComponentByCode(wo.componentCode, wo.vesselId);
      }

      if (component && completionDate) {
        try {
          await repo.createMaintenanceHistory({
            componentId: component.cuuid,
            componentCode: wo.componentCode || component.componentCode,
            vesselId: wo.vesselId || '',
            workOrderId: wo.wouuid,
            workOrderNo: wo.workOrderNo,
            jobTitle: wo.jobTitle,
            maintenanceType: wo.maintenanceType || 'Servicing',
            dateCompleted: completionDate,
            runningHoursAtCompletion: wo.runningHours || null,
            performedBy: wo.performedBy || wo.executionAssignedTo || 'Unknown',
            approvedBy: resolvedApprover || wo.approver || null,
            approvalDate: completionDate,
            status: 'Approved',
            workDescription: wo.workCarriedOut || wo.briefWorkDescription || null,
            sparesUsed: wo.consumedSpareParts ? JSON.stringify(wo.consumedSpareParts) : null,
            remarks: wo.remarks || null,
            isComponentReplaced: false,
          });
        } catch (err) {
          console.error(`Failed to create maintenance history for WO ${woId}:`, err);
        }

        if (wo.runningHours) {
          const rhValue = parseFloat(wo.runningHours);
          if (!isNaN(rhValue)) {
            const counterType = (component.rhCounterType || '').toUpperCase();

            if (counterType === 'MASTER' && wo.vesselId) {
              await repo.updateComponent(component.cuuid, {
                currentCumulativeRH: rhValue.toString(),
                rhCurrentMaster: rhValue.toString(),
                lastUpdated: new Date().toISOString(),
              });

              const allComponents = await repo.getComponents(wo.vesselId);
              const inheritedChildren = allComponents.filter((c: any) => {
                const ct = (c.rhCounterType || '').toUpperCase();
                return ct === 'INHERITED' && (
                  c.rhMasterComponentId === component!.id ||
                  c.rhCounterSource === component!.componentCode
                );
              });
              for (const child of inheritedChildren) {
                await repo.updateComponent(child.cuuid, {
                  currentCumulativeRH: rhValue.toString(),
                  lastUpdated: new Date().toISOString(),
                });
              }
            } else {
              await repo.updateComponent(component.cuuid, {
                currentCumulativeRH: rhValue.toString(),
                lastUpdated: new Date().toISOString(),
              });
            }
          }
        }
      }

      if (wo.jobId) {
        try {
          const job = await repo.getJob(wo.jobId);
          if (job && completionDate) {
            const jobUpdate: any = { lastDoneDate: completionDate };
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
            if (wo.runningHours && job.maintenanceBasis === 'Running Hours') {
              jobUpdate.lastDoneRH = wo.runningHours.toString();
              if (job.frequencyValue) {
                const freq = parseFloat(job.frequencyValue);
                const rh = parseFloat(wo.runningHours);
                if (!isNaN(freq) && !isNaN(rh)) {
                  jobUpdate.nextDueRH = (rh + freq).toString();
                }
              }
            }
            await repo.updateJob(job.juuid, jobUpdate);
          }
        } catch (err) {
          console.error(`Failed to update job cycle dates for WO ${woId}:`, err);
        }
      }

      success.push(woId);
    } catch (err: any) {
      failed.push({ id: woId, reason: err.message || 'Unknown error' });
    }
  }

  return { success, failed };
}

export async function bulkReject(body: any) {
  const { workOrderIds, rejectedBy, approver, rejectionComments } = body;
  if (!Array.isArray(workOrderIds) || workOrderIds.length === 0) {
    return { error: 'workOrderIds array is required' };
  }

  const success: string[] = [];
  const failed: { id: string; reason: string }[] = [];

  for (const woId of workOrderIds) {
    try {
      const wo = await repo.getWorkOrder(woId);
      if (!wo) {
        failed.push({ id: woId, reason: 'Work order not found' });
        continue;
      }

      await repo.updateWorkOrder(woId, {
        status: 'Due',
        approvalAction: 'rejected',
        wasRejected: true,
        completionDateTime: null,
        dateCompleted: null,
        rejectionDate: new Date().toISOString(),
        rejectionComments: rejectionComments || null,
      });

      success.push(woId);
    } catch (err: any) {
      failed.push({ id: woId, reason: err.message || 'Unknown error' });
    }
  }

  return { success, failed };
}
