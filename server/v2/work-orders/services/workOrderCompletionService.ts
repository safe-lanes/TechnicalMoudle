import * as repo from "../repositories/workOrderRepository";
import { generateExecutionId } from "../utils/workOrderNumbering";

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

export async function completeWorkOrder(id: string, body: any) {
  const wo = await repo.getWorkOrder(id);
  if (!wo) return { error: 'Work order not found' };

  let component = await repo.getComponent(wo.component);
  if (!component && wo.componentCode && wo.vesselId) {
    component = await repo.getComponentByCode(wo.componentCode, wo.vesselId);
  }
  if (!component && wo.vesselId) {
    const allComponents = await repo.getComponents(wo.vesselId);
    component = allComponents.find(c =>
      c.name === wo.component ||
      c.componentCode === wo.component ||
      c.componentCode === wo.componentCode
    ) ?? null;
  }

  const completionDate = normalizeDateToISO(body.completionDateTime || body.dateOfCompletion) || new Date().toISOString().split('T')[0];
  const runningHours = body.runningHours;

  if (component && runningHours) {
    const rhValue = parseFloat(runningHours);
    if (!isNaN(rhValue)) {
      const counterType = (component.rhCounterType || '').toUpperCase();

      if (counterType === 'MASTER') {
        await repo.updateComponent(component.cuuid, {
          currentCumulativeRH: rhValue.toString(),
          rhCurrentMaster: rhValue.toString(),
          lastUpdated: new Date().toISOString(),
        });

        if (wo.vesselId) {
          const allComponents = await repo.getComponents(wo.vesselId);
          const inheritedChildren = allComponents.filter(c => {
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
        }
      } else {
        await repo.updateComponent(component.cuuid, {
          currentCumulativeRH: rhValue.toString(),
          lastUpdated: new Date().toISOString(),
        });
      }
    }
  }

  if (component) {
    try {
      await repo.createMaintenanceHistory({
        componentId: component.cuuid,
        componentCode: wo.componentCode || component.componentCode,
        vesselId: wo.vesselId || '',
        workOrderId: wo.id,
        workOrderNo: wo.workOrderNo,
        jobTitle: wo.jobTitle,
        maintenanceType: wo.maintenanceType || body.maintenanceType || 'Servicing',
        dateCompleted: completionDate,
        runningHoursAtCompletion: runningHours || null,
        performedBy: body.performedBy || wo.performedBy || 'Unknown',
        approvedBy: body.approvedBy || wo.approver || null,
        approvalDate: completionDate,
        status: 'Approved',
        workDescription: body.workCarriedOut || wo.workCarriedOut || null,
        sparesUsed: body.consumedSpareParts ? JSON.stringify(body.consumedSpareParts) : null,
        remarks: body.remarks || wo.remarks || null,
        isComponentReplaced: false,
      });
    } catch (err) {
      console.error('Failed to create maintenance history during completion:', err);
    }
  }

  if (wo.jobId) {
    try {
      const job = await repo.getJob(wo.jobId);
      if (job) {
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
    } catch (err) {
      console.error('Failed to update job cycle dates during completion:', err);
    }
  }

  if (body.consumedSpareParts && Array.isArray(body.consumedSpareParts) && wo.vesselId) {
    for (const spare of body.consumedSpareParts) {
      try {
        await processSpareConsumption(wo, spare);
      } catch (err) {
        console.error('Failed to process spare consumption:', err);
      }
    }
  }

  const woUpdate: any = {
    status: body.status || 'Completed',
    completionDateTime: `${completionDate}T00:00:00.000Z`,
    dateCompleted: `${completionDate}T00:00:00.000Z`,
    performedBy: body.performedBy || wo.performedBy,
    workCarriedOut: body.workCarriedOut || wo.workCarriedOut,
    remarks: body.remarks || wo.remarks,
    runningHours: runningHours || wo.runningHours,
    woExecutionId: wo.woExecutionId || generateExecutionId(),
    consumedSpareParts: body.consumedSpareParts || wo.consumedSpareParts,
    startDateTime: body.startDateTime || wo.startDateTime,
    manhours: body.manhours || wo.manhours,
    totalTimeHours: body.totalTimeHours || wo.totalTimeHours,
    noOfPersons: body.noOfPersons || wo.noOfPersons,
    jobExperienceNotes: body.jobExperienceNotes || wo.jobExperienceNotes,
    approvalDate: completionDate,
  };

  const updatedWO = await repo.updateWorkOrder(id, woUpdate);
  return updatedWO;
}

async function processSpareConsumption(wo: any, spareData: any) {
  if (!wo.vesselId) return;

  const qty = parseInt(spareData.quantityConsumed || spareData.qty || '0');
  if (qty <= 0) return;

  let spare = spareData.partCode
    ? await repo.getSpareByPartCode(spareData.partCode, wo.vesselId)
    : null;
  if (!spare && spareData.partNo) {
    spare = await repo.getSpareByPartNo(spareData.partNo, wo.vesselId);
  }
  if (!spare) return;

  const newRob = Math.max(0, spare.rob - qty);
  await repo.updateSpare(spare.id, { rob: newRob });

  const locationName = spareData.location || 'Location A';
  let location = await repo.getLocationByName(locationName, wo.vesselId);
  if (!location) {
    location = await repo.createLocation({
      vesselId: wo.vesselId,
      locationName,
      createdBy: 'system',
    });
  }

  const stock = await repo.getSpareLocationStock(spare.id, location.id);
  if (stock) {
    const newStockQty = Math.max(0, stock.qty - qty);
    await repo.updateSpareLocationStock(stock.id, { qty: newStockQty });
  }

  await repo.createInventoryTransaction({
    vesselId: wo.vesselId,
    spareId: spare.id,
    locationId: location.id,
    eventType: 'CONSUME',
    qtyChange: -qty,
    robTotalBefore: spare.rob,
    robTotalAfter: newRob,
    robLocationBefore: stock?.qty ?? 0,
    robLocationAfter: Math.max(0, (stock?.qty ?? 0) - qty),
    referenceType: 'WORK_ORDER',
    referenceId: wo.workOrderNo || wo.id,
    referenceNote: `Consumed during WO completion: ${wo.workOrderNo}`,
    userId: 'system',
  });
}
