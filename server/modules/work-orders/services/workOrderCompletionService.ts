import * as repo from '../repositories/workOrderRepository';
import { NotFoundError, ValidationError } from '../../shared/errors';

// ── Complete Work Order ──

export async function completeWorkOrder(
  workOrderId: string,
  body: {
    runningHours?: string;
    dateOfCompletion?: string;
    approverUserId?: string;
    performedBy?: string;
    approver?: string;
    approvalDate?: string;
    workDone?: string;
    sparesUsed?: any;
    remarks?: string;
    [key: string]: any;
  }
) {
  const { runningHours, dateOfCompletion, approverUserId, ...executionData } = body;

  // Get work order and component context
  const workOrder = await repo.findById(workOrderId);
  if (!workOrder) {
    throw new NotFoundError('Work order not found');
  }

  // Try multiple methods to find the component:
  // 1. By ID (workOrder.component might be an ID for some work orders)
  // 2. By component code + vessel (most reliable for auto-generated WOs)
  // 3. By component name + vessel (fallback for legacy WOs)
  let component = await repo.findComponent(workOrder.component);

  if (!component && workOrder.componentCode && workOrder.vesselId) {
    // Try lookup by component code
    const componentByCode = await repo.findComponentByCode(workOrder.componentCode, workOrder.vesselId);
    if (componentByCode) {
      // VALIDATION: Ensure component name matches to prevent wrong component linkage
      if (componentByCode.name === workOrder.component) {
        component = componentByCode;
        console.log(`📋 Found component by code ${workOrder.componentCode} for vessel ${workOrder.vesselId}`);
      } else {
        console.warn(`⚠️ Component code ${workOrder.componentCode} found but name mismatch: "${componentByCode.name}" vs "${workOrder.component}". Will try name lookup.`);
      }
    }
  }

  if (!component && workOrder.vesselId) {
    // Fallback: Search by component name
    const vesselComponents = await repo.findComponents(workOrder.vesselId);
    // Prioritize exact name match first
    component = vesselComponents.find((c: any) => c.name === workOrder.component) ?? undefined;
    // If no name match, try component code match
    if (!component) {
      component = vesselComponents.find((c: any) => c.componentCode === workOrder.componentCode) ?? undefined;
    }
    if (component) {
      console.log(`📋 Found component by name/code match: ${component.name}`);
    }
  }

  if (!component) {
    throw new NotFoundError(`Component not found: ${workOrder.component} (code: ${workOrder.componentCode})`);
  }

  // Rule #19: Multi-Department Approver Validation
  if (approverUserId && workOrder.jobId) {
    try {
      const job = await repo.findJob(workOrder.jobId);
      if (job && job.department) {
        const approver = await repo.findUser(approverUserId);
        if (approver && (approver as any).department && (approver as any).department !== job.department) {
          throw new ValidationError(
            `Approver department mismatch: Approver belongs to "${(approver as any).department}" but job requires "${job.department}" department authorization.`,
            { code: 'DEPARTMENT_MISMATCH' }
          );
        }
        console.log(`[RULE #19] Department validation passed: Approver (${(approver as any)?.department || 'no dept'}) can approve job in ${job.department} department`);
      }
    } catch (deptError: any) {
      if (deptError instanceof ValidationError) throw deptError;
      console.warn('[RULE #19] Department validation skipped due to error:', deptError);
    }
  }

  // Enforce running hours requirement for RH-based maintenance
  if (workOrder.maintenanceBasis === 'Running Hours' && !runningHours) {
    throw new ValidationError('Running hours is required for RH-based maintenance work orders');
  }

  // Backend validation and update
  if (runningHours) {
    const newRH = parseInt(runningHours);

    // CRITICAL: Validate this is a sub-component, not a parent
    if (!component.parentId) {
      throw new ValidationError('Work orders can only update sub-component running hours. Parent component RH must be updated through the Running Hours module.');
    }

    // CRITICAL: Capture original RH BEFORE updating
    const previousRH = parseInt(component.currentCumulativeRH);

    // Ensure complete metadata for audit
    const componentVesselId = workOrder.vesselId || component.vesselId || 'V001';

    // Validate against parent (sub-component RH must never exceed parent RH)
    const parentComponent = await repo.findComponent(component.parentId as string);
    if (parentComponent) {
      const parentRH = parseInt(parentComponent.currentCumulativeRH);
      if (newRH > parentRH) {
        throw new ValidationError(`Sub-component running hours (${newRH}) cannot exceed parent component's running hours (${parentRH})`);
      }
    }

    // Validate no decrease
    if (newRH < previousRH) {
      throw new ValidationError(`Running hours cannot decrease from ${previousRH} to ${newRH}`);
    }

    // Validate realistic delta (max 25 hrs/day)
    if (dateOfCompletion && component.lastUpdated) {
      const completionDate = new Date(dateOfCompletion);
      const lastUpdate = new Date(component.lastUpdated);
      const daysDiff = Math.max(1, (completionDate.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
      const hoursDelta = newRH - previousRH;
      const maxAllowed = daysDiff * 25;

      if (hoursDelta > maxAllowed) {
        throw new ValidationError(`Running hours increase of ${hoursDelta} hrs over ${daysDiff.toFixed(1)} days exceeds realistic limit (max ${maxAllowed.toFixed(0)} hrs at 25 hrs/day)`);
      }
    }

    // Update running hours using the CENTRALIZED function
    await repo.setComponentRunningHours({
      componentId: component.cuuid,
      newRHValue: newRH,
      updateSource: 'WO_COMPLETION',
      userId: executionData.performedBy || 'System',
      lastUpdatedDate: dateOfCompletion || new Date().toISOString().split('T')[0]
    });

    // Record running hours audit entry
    await repo.createRunningHoursAudit({
      componentId: component.cuuid,
      vesselId: componentVesselId,
      previousRH: previousRH.toString(),
      newRH: newRH.toString(),
      cumulativeRH: newRH.toString(),
      dateUpdatedLocal: dateOfCompletion || new Date().toISOString().split('T')[0],
      dateUpdatedTZ: 'UTC',
      enteredAtUTC: new Date(),
      userId: executionData.performedBy || 'System',
      source: 'workorder',
      notes: `Updated via work order completion: ${workOrder.templateCode}`,
      meterReplaced: false
    });
  }

  // Update work order execution data
  const updatedWorkOrder = await repo.update(workOrderId, {
    ...executionData,
    runningHoursAtCompletion: runningHours ? parseInt(runningHours) : undefined,
    dateCompleted: dateOfCompletion,
    status: 'Completed'
  });

  // Auto-populate component_maintenance_history
  try {
    const existingHistory = await repo.findMaintenanceHistoryByWorkOrderId(workOrder.id);
    if (existingHistory) {
      console.log(`⚠️ Maintenance history already exists for work order ${workOrder.id}, skipping duplicate creation`);
    } else {
      const normalizeToISO = (isoDate: string | undefined): string => {
        if (!isoDate) return new Date().toISOString().split('T')[0];
        const date = new Date(isoDate);
        return date.toISOString().split('T')[0];
      };

      // Get job information for proper job linkage
      let parentJob: any = null;
      let parentJobNo: string | null = null;

      if (workOrder.jobId) {
        parentJob = await repo.findJob(workOrder.jobId);
        if (parentJob) parentJobNo = parentJob.jobNo;
      }

      // Fallback: Extract jobNo from work order number
      if (!parentJobNo && workOrder.workOrderNo) {
        const woNumber = workOrder.workOrderNo;
        const newFormatMatch = woNumber.match(/^(.+?)-\d+\.\d+.*-\d{4}-\d+$/);
        if (newFormatMatch) {
          parentJobNo = newFormatMatch[1];
        }
        if (!parentJobNo) {
          const oldFormatMatch = woNumber.match(/^(.+)-\d{4}-\d+$/);
          if (oldFormatMatch) {
            parentJobNo = oldFormatMatch[1];
          }
        }
        if (parentJobNo && !parentJob) {
          const allJobs = await repo.findJobsByVessel(workOrder.vesselId as string);
          parentJob = allJobs.find((j: any) => j.jobNo === parentJobNo) || null;
        }
      }

      const historyPayload = {
        componentId: component.cuuid,
        componentCode: workOrder.componentCode || component.componentCode,
        vesselCode: workOrder.vesselId,
        jobId: parentJob?.id || workOrder.jobId || null,
        jobCode: parentJobNo || null,
        workOrderId: workOrder.id,
        workOrderNo: workOrder.templateCode || `WO-${workOrder.id}`,
        jobTitle: workOrder.jobTitle,
        maintenanceType: workOrder.taskType || 'Servicing',
        dateCompleted: normalizeToISO(dateOfCompletion),
        runningHoursAtCompletion: runningHours || null,
        performedBy: executionData.performedBy || 'Unknown',
        approvedBy: executionData.approver || null,
        approvalDate: executionData.approvalDate ? normalizeToISO(executionData.approvalDate) : null,
        status: 'Approved' as const,
        workDescription: executionData.workDone || workOrder.briefWorkDescription || null,
        sparesUsed: executionData.sparesUsed || null,
        remarks: executionData.remarks || null,
        isComponentReplaced: false
      };

      await repo.createMaintenanceHistory(historyPayload);
      console.log(`✅ Auto-populated maintenance history for work order ${workOrder.id} (componentId: ${component.cuuid}, jobId: ${historyPayload.jobId}, jobCode: ${historyPayload.jobCode})`);
    }
  } catch (historyError) {
    console.error('Failed to create maintenance history record:', historyError);
  }

  // Auto-update parent job's cycle fields
  try {
    let job: any = null;

    if (workOrder.jobId) {
      job = await repo.findJob(workOrder.jobId);
    }

    // Fallback: Extract jobNo from work order number
    if (!job && workOrder.workOrderNo) {
      const woNumber = workOrder.workOrderNo;
      let extractedJobNo: string | null = null;

      const newFormatMatch = woNumber.match(/^(.+?)-\d+\.\d+.*-\d{4}-\d+$/);
      if (newFormatMatch) {
        extractedJobNo = newFormatMatch[1];
      }

      if (!extractedJobNo) {
        const oldFormatMatch = woNumber.match(/^(.+)-\d{4}-\d+$/);
        if (oldFormatMatch) {
          extractedJobNo = oldFormatMatch[1];
        }
      }

      if (extractedJobNo) {
        const vesselId = workOrder.vesselId || component.vesselId;
        if (vesselId) {
          const jobs = await repo.findJobs(vesselId as string);
          job = jobs.find((j: any) => j.jobNo === extractedJobNo);
          if (job) {
            console.log(`📋 Found job ${job.jobNo} via work order number extraction (jobId was not linked)`);
          }
        }
      }
    }

    if (job) {
      const jobUpdates: any = {};
      const linkUpdates: any = { updatedAt: new Date() };

      const woComponentId = (workOrder as any).componentId || component.cuuid;

      // Calendar-based job cycle update
      if (workOrder.maintenanceBasis === 'Calendar' && dateOfCompletion) {
        const { calculateNextDueDate } = await import('@shared/dateUtils');
        linkUpdates.lastDoneDate = dateOfCompletion;
        jobUpdates.lastDoneDate = dateOfCompletion;

        if (job.frequencyValue && job.frequencyUnit) {
          const nextDue = calculateNextDueDate(dateOfCompletion, job.frequencyValue, job.frequencyUnit);
          if (nextDue) {
            linkUpdates.nextDueDate = nextDue;
            jobUpdates.nextDueDate = nextDue;
            console.log(`✅ Auto-calculated next due date for job ${job.jobNo}: ${nextDue} (last done: ${dateOfCompletion}, interval: ${job.frequencyValue} ${job.frequencyUnit})`);
          }
        }

        const updateVesselId = workOrder.vesselId || job.vesselId;
        if (woComponentId && updateVesselId) {
          await repo.updateJobComponentLinkTracking(updateVesselId, job.id, woComponentId, linkUpdates);
          console.log(`✅ Updated component-specific tracking for vessel ${updateVesselId}, job ${job.jobNo} + component ${woComponentId} with lastDoneDate: ${dateOfCompletion}`);
        }

        await repo.updateJob(job.id, jobUpdates);
        console.log(`✅ Updated calendar job ${job.jobNo} with lastDoneDate: ${dateOfCompletion}`);
      }

      // Running Hours-based job cycle update
      if (workOrder.maintenanceBasis === 'Running Hours' && runningHours) {
        const currentRH = parseInt(runningHours);
        if (!isNaN(currentRH)) {
          linkUpdates.lastDoneRH = currentRH.toString();
          jobUpdates.lastDoneRH = currentRH;

          const rhInterval = job.intervalRunningHour || (job.frequencyValue ? parseInt(job.frequencyValue) : null);
          if (rhInterval && !isNaN(rhInterval)) {
            const nextDueRH = currentRH + rhInterval;
            linkUpdates.nextDueRH = nextDueRH.toString();
            jobUpdates.nextDueRH = nextDueRH;
            console.log(`✅ Auto-calculated next due RH for job ${job.jobNo}: ${nextDueRH} (last done: ${currentRH}, interval: ${rhInterval} hours)`);
          }

          const rhUpdateVesselId = workOrder.vesselId || job.vesselId;
          if (woComponentId && rhUpdateVesselId) {
            await repo.updateJobComponentLinkTracking(rhUpdateVesselId, job.id, woComponentId, linkUpdates);
            console.log(`✅ Updated component-specific RH tracking for vessel ${rhUpdateVesselId}, job ${job.jobNo} + component ${woComponentId} with lastDoneRH: ${currentRH}`);
          }

          await repo.updateJob(job.id, jobUpdates);
          console.log(`✅ Updated RH job ${job.jobNo} with lastDoneRH: ${currentRH}`);
        }
      }
    } else {
      console.warn(`⚠️ Could not find job to update for work order ${workOrder.workOrderNo}`);
    }
  } catch (jobUpdateError) {
    console.error('Failed to update job cycle fields:', jobUpdateError);
  }

  // Auto-deduct consumed spares from inventory
  if (workOrder.consumedSpareParts && Array.isArray(workOrder.consumedSpareParts)) {
    const consumedSpares = workOrder.consumedSpareParts as Array<{
      partNo: string;
      partCode?: string;
      description?: string;
      quantityConsumed: number | string;
      locationId?: number | null;
      location?: string;
      comments?: string;
    }>;

    for (const consumedSpare of consumedSpares) {
      const qtyConsumed = typeof consumedSpare.quantityConsumed === 'string'
        ? parseFloat(consumedSpare.quantityConsumed)
        : consumedSpare.quantityConsumed;

      if (qtyConsumed && qtyConsumed > 0) {
        try {
          const spares = await repo.findSpares(workOrder.vesselId || 'V001');

          let spare: any = null;

          // Step 1: Try partCode first
          if (consumedSpare.partCode) {
            spare = spares.find((s: any) => s.partCode === consumedSpare.partCode);
          }
          // Step 2: Try matching partNo against partCode
          if (!spare && consumedSpare.partNo) {
            spare = spares.find((s: any) => s.partCode === consumedSpare.partNo);
          }
          // Step 3: Try matching partNo against partNumber
          if (!spare && consumedSpare.partNo) {
            spare = spares.find((s: any) => s.partNumber === consumedSpare.partNo);
          }

          if (spare) {
            const vesselId = workOrder.vesselId || 'V001';
            let resolvedLocationId = consumedSpare.locationId ? parseInt(String(consumedSpare.locationId)) : null;

            if ((!resolvedLocationId || isNaN(resolvedLocationId as number)) && consumedSpare.location) {
              const locationObj = await repo.findOrCreateLocation(vesselId, consumedSpare.location, 'system');
              if (locationObj) {
                resolvedLocationId = locationObj.id;
                console.log(`📍 [POST Complete] Resolved location name "${consumedSpare.location}" to ID ${resolvedLocationId}`);
              }
            }

            if (resolvedLocationId && !isNaN(resolvedLocationId as number)) {
              try {
                await repo.performInventoryTransaction({
                  vesselId: vesselId,
                  spareId: spare.id,
                  locationId: resolvedLocationId,
                  eventType: 'CONSUME',
                  qtyChange: -Math.abs(qtyConsumed),
                  referenceType: 'WORK_ORDER',
                  referenceId: workOrder.id,
                  referenceNote: `WO: ${workOrder.workOrderNo} - ${consumedSpare.comments || 'Consumed during work completion'}`
                });
                console.log(`✅ [Inventory Transaction] Consumed ${qtyConsumed} units of ${consumedSpare.partNo} from location ${resolvedLocationId} (WO: ${workOrder.workOrderNo})`);
              } catch (txnError: any) {
                if (txnError.message?.includes('INSUFFICIENT_STOCK') || txnError.message?.includes('NEGATIVE_STOCK_PREVENTED')) {
                  throw new Error(`INSUFFICIENT_STOCK: Cannot consume ${qtyConsumed} units of ${consumedSpare.partNo} from location ${resolvedLocationId}. Insufficient stock.`);
                }
                throw txnError;
              }
            } else {
              throw new Error(`LOCATION_REQUIRED: Spare part ${consumedSpare.partNo} requires a storage location for inventory tracking. Please select a location in the work order form.`);
            }
          } else {
            throw new Error(`SPARE_NOT_FOUND: Spare part ${consumedSpare.partCode || consumedSpare.partNo} was not found in inventory. Searched: partCode="${consumedSpare.partCode}", partNo="${consumedSpare.partNo}". Please verify the spare exists in the inventory.`);
          }
        } catch (spareError: any) {
          if (spareError.message?.includes('LOCATION_REQUIRED') ||
              spareError.message?.includes('SPARE_NOT_FOUND') ||
              spareError.message?.includes('INSUFFICIENT_STOCK') ||
              spareError.message?.includes('NEGATIVE_STOCK_PREVENTED')) {
            throw spareError;
          }
          console.error(`Failed to deduct spare ${consumedSpare.partNo}:`, spareError);
        }
      }
    }
  }

  return {
    success: true,
    workOrder: updatedWorkOrder,
    runningHoursUpdated: !!runningHours
  };
}
