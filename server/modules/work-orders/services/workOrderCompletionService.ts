import * as repo from '../repositories/workOrderRepository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { calculateMissedCycles as calcMissedCyclesShared, calculateMissedCyclesRH } from '@shared/dateUtils';
import { detectAndLogAnomalies } from './anomalyDetectionService';
import { validateRHEntry } from '../../running-hours/services/rhTimelineValidationService';

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

  // === Layer 7: RH Validation & Isolation ===
  // Work orders NEVER write back to the RH Module. They only store snapshots.
  let rhValidationDetails: any = null;
  let completionRHSource = 'MANUAL_ENTRY';

  if (runningHours) {
    const newRH = parseInt(runningHours);
    const completionDateForValidation = dateOfCompletion || new Date().toISOString().split('T')[0];
    const componentVesselId = workOrder.vesselId || component.vesselId || 'V001';
    const previousRH = parseInt(component.currentCumulativeRH || '0');

    // Validate against parent (sub-component RH must never exceed parent RH)
    if (component.parentId) {
      const parentComponent = await repo.findComponent(component.parentId as string);
      if (parentComponent) {
        const parentRH = parseInt(parentComponent.currentCumulativeRH);
        if (newRH > parentRH) {
          throw new ValidationError(`Sub-component running hours (${newRH}) cannot exceed parent component's running hours (${parentRH})`);
        }
      }
    }

    const rhSource = component.rhCounterType === 'INHERITED'
      ? (component.rhCurrentInheritedCached || component.currentCumulativeRH)
      : (component.rhCurrentMaster || component.currentCumulativeRH);
    const componentActualRH = rhSource !== null && rhSource !== undefined
      ? parseInt(rhSource)
      : null;
    if (componentActualRH !== null && !isNaN(componentActualRH) && newRH > componentActualRH) {
      throw new ValidationError(
        `Current Reading (${newRH} hours) exceeds component's actual running hours (${componentActualRH} hours). ` +
        `You cannot complete maintenance at a running hour that the component has not reached yet. ` +
        `Please update the component's running hours in the Running Hours module first, then return to complete this work order. ` +
        `Or enter a Current Reading value ≤ ${componentActualRH} hours.`,
        {
          code: 'INVALID_RUNNING_HOURS',
          enteredValue: newRH,
          componentActualRH,
          maxAllowed: componentActualRH,
          componentId: component.cuuid || component.id,
          componentCode: component.componentCode || workOrder.componentCode,
          componentName: component.description || component.componentCode || workOrder.componentCode,
          rhCounterType: component.rhCounterType || 'MASTER'
        }
      );
    }

    // Use timeline-based validation (forward + backward checks, 24 hrs/day max)
    const validation = await validateRHEntry(component.cuuid, completionDateForValidation, newRH);

    if (!validation.isValid) {
      throw new ValidationError(validation.errorMessage, {
        code: validation.validationStatus,
        validRange: validation.validRange,
        previousEntry: validation.previousEntry,
        nextEntry: validation.nextEntry,
        utilizationRate: validation.utilizationRate,
        daysBetweenPrevious: validation.daysBetweenPrevious,
        daysBetweenNext: validation.daysBetweenNext,
        maxPossibleIncrease: validation.maxPossibleIncrease,
        actualIncrease: validation.actualIncrease
      });
    }

    // If high utilization, require justification
    if (validation.requiresJustification && !body.rhJustification) {
      throw new ValidationError(
        `High machinery utilization detected (${validation.utilizationRate.toFixed(1)} hrs/day). Justification is required.`,
        {
          code: 'HIGH_UTILIZATION',
          validRange: validation.validRange,
          utilizationRate: validation.utilizationRate,
          requiresJustification: true
        }
      );
    }

    rhValidationDetails = {
      isValid: validation.isValid,
      validationDate: new Date().toISOString(),
      validRange: validation.validRange,
      utilizationRate: validation.utilizationRate,
      requiresJustification: validation.requiresJustification,
      validationErrors: validation.anomalyFlags
    };

    // Determine RH source
    if (body.completionRHSource) {
      completionRHSource = body.completionRHSource;
    }

    // ISOLATION: Do NOT call repo.setComponentRunningHours() — work orders never modify RH Module

    // Record audit trail entry for historical tracking (read-only snapshot, source = 'workorder')
    await repo.createRunningHoursAudit({
      componentId: component.cuuid,
      vesselId: componentVesselId,
      previousRH: previousRH.toString(),
      newRH: newRH.toString(),
      cumulativeRH: newRH.toString(),
      dateUpdatedLocal: completionDateForValidation,
      dateUpdatedTZ: 'UTC',
      enteredAtUTC: new Date(),
      userId: executionData.performedBy || 'System',
      source: 'workorder',
      notes: `RH snapshot via work order completion: ${workOrder.templateCode} (ISOLATED - does not modify RH Module)`,
      meterReplaced: false
    });
  }

  let missedCycles: number;
  if (workOrder.maintenanceBasis === 'Running Hours' && runningHours) {
    const completionRHValue = parseInt(runningHours);
    const dueRH = workOrder.nextDueReading ? parseFloat(workOrder.nextDueReading) : null;
    let jobIntervalRH: number | null = null;
    if (workOrder.jobId) {
      const jobForRH = await repo.findJob(workOrder.jobId);
      if (jobForRH?.intervalRunningHour) {
        jobIntervalRH = jobForRH.intervalRunningHour;
      }
    }
    if (!jobIntervalRH && workOrder.frequencyValue) {
      jobIntervalRH = parseInt(String(workOrder.frequencyValue));
    }
    missedCycles = calculateMissedCyclesRH(dueRH, completionRHValue, jobIntervalRH);
    if (missedCycles > 0) {
      console.log(`⚠️ Skipped cycle detection (RH): ${missedCycles} cycle(s) missed for WO ${workOrder.workOrderNo} (dueRH: ${dueRH}, completionRH: ${completionRHValue}, interval: ${jobIntervalRH})`);
    }
  } else {
    let calendarDueDate = workOrder.nextDueDate || workOrder.dueDate || null;
    // Legacy WOs may have no nextDueDate stored on the record — fall back to the job's current nextDueDate
    if (!calendarDueDate && workOrder.jobId) {
      const jobForDueDate = await repo.findJob(workOrder.jobId);
      if (jobForDueDate?.nextDueDate) {
        calendarDueDate = jobForDueDate.nextDueDate;
        console.log(`[MissedCycles] WO ${workOrder.workOrderNo} has no nextDueDate — falling back to job nextDueDate: ${calendarDueDate}`);
      }
    }
    missedCycles = calcMissedCyclesShared(
        calendarDueDate,
        dateOfCompletion,
        workOrder.frequencyValue,
        workOrder.frequencyUnit
      );
    if (missedCycles > 0) {
      console.log(`⚠️ Skipped cycle detection: ${missedCycles} cycle(s) missed for WO ${workOrder.workOrderNo} (due: ${calendarDueDate}, completed: ${dateOfCompletion})`);
    }
    // Overwrite so originalDueDate below picks up the resolved due date
    if (calendarDueDate && !workOrder.nextDueDate) {
      (workOrder as any).nextDueDate = calendarDueDate;
    }
  }

  const originalDueDate = workOrder.nextDueDate || workOrder.dueDate || null;

  const updatedWorkOrder = await repo.update(workOrderId, {
    ...executionData,
    runningHoursAtCompletion: runningHours ? parseInt(runningHours) : undefined,
    dateCompleted: dateOfCompletion,
    status: 'Completed',
    missedCycles,
    originalDueDate,
    completionRH: runningHours ? runningHours : undefined,
    completionRHValidated: runningHours ? true : undefined,
    completionRHSource: runningHours ? completionRHSource : undefined,
    completionRHValidationDetails: rhValidationDetails || undefined,
    rhJustification: body.rhJustification || undefined,
    rhJustificationProvidedBy: body.rhJustification ? (executionData.performedBy || 'System') : undefined,
    rhJustificationDate: body.rhJustification ? new Date() : undefined
  });

  // Auto-populate component_maintenance_history
  try {
    const existingHistory = await repo.findMaintenanceHistoryByWorkOrderId(workOrder.wouuid);
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
        jobId: parentJob?.juuid || parentJob?.id || workOrder.jobId || null,
        jobCode: parentJobNo || null,
        workOrderId: workOrder.wouuid,
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
        remarks: missedCycles >= 1
          ? `${missedCycles} cycles skipped — completed late${executionData.remarks ? '. ' + executionData.remarks : ''}`
          : (executionData.remarks || 'Completed on time'),
        isComponentReplaced: false,
        missedCycles,
        originalDueDate
      };

      await repo.createMaintenanceHistory(historyPayload);
      console.log(`✅ Auto-populated maintenance history for work order ${workOrder.id} (componentId: ${component.cuuid}, jobId: ${historyPayload.jobId}, jobCode: ${historyPayload.jobCode})`);
    }
  } catch (historyError) {
    console.error('Failed to create maintenance history record:', historyError);
  }

  if (missedCycles >= 1 && component) {
    try {
      if (workOrder.maintenanceBasis === 'Running Hours' && runningHours) {
        const { createSkippedCycleRecordsRH } = await import('../utils/skippedCycleBackfill');
        const completionRHValue = parseInt(runningHours);
        const dueRH = workOrder.nextDueReading ? parseFloat(workOrder.nextDueReading) : 0;
        let jobIntervalRH = 0;
        if (workOrder.jobId) {
          const jobForBackfill = await repo.findJob(workOrder.jobId);
          if (jobForBackfill?.intervalRunningHour) {
            jobIntervalRH = jobForBackfill.intervalRunningHour;
          }
        }
        if (!jobIntervalRH && workOrder.frequencyValue) {
          jobIntervalRH = parseInt(String(workOrder.frequencyValue));
        }
        await createSkippedCycleRecordsRH({
          workOrderId: workOrder.wouuid || workOrder.id,
          workOrderNo: workOrder.workOrderNo || null,
          componentId: component.cuuid,
          componentCode: workOrder.componentCode || component.componentCode || null,
          vesselCode: workOrder.vesselId || component.vesselId || null,
          jobId: workOrder.jobId || null,
          jobCode: workOrder.jobCode || null,
          jobTitle: workOrder.jobTitle || null,
          dueRH,
          completionRH: completionRHValue,
          intervalRH: jobIntervalRH,
          missedCycles
        });
      } else if (workOrder.maintenanceBasis === 'Calendar') {
        const { createSkippedCycleRecords } = await import('../utils/skippedCycleBackfill');
        await createSkippedCycleRecords({
          workOrderId: workOrder.wouuid || workOrder.id,
          componentId: component.cuuid,
          componentCode: workOrder.componentCode || component.componentCode || null,
          vesselCode: workOrder.vesselId || component.vesselId || null,
          jobId: workOrder.jobId || null,
          jobCode: workOrder.jobCode || null,
          jobTitle: workOrder.jobTitle || null,
          originalDueDate,
          missedCycles,
          frequencyValue: workOrder.frequencyValue,
          frequencyUnit: workOrder.frequencyUnit
        });
      }
    } catch (err) {
      console.error('[BACKFILL ERROR] Failed to create skipped cycle records:', err);
    }
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
          const nextDue = calculateNextDueDate(dateOfCompletion, job.frequencyValue, job.frequencyUnit, originalDueDate);
          if (nextDue) {
            linkUpdates.nextDueDate = nextDue;
            jobUpdates.nextDueDate = nextDue;
            console.log(`✅ Auto-calculated next due date for job ${job.jobNo}: ${nextDue} (last done: ${dateOfCompletion}, interval: ${job.frequencyValue} ${job.frequencyUnit})`);
          }
        }

        const updateVesselId = workOrder.vesselId || job.vesselId;
        if (woComponentId && updateVesselId) {
          await repo.updateJobComponentLinkTracking(updateVesselId, job.juuid, woComponentId, linkUpdates);
          console.log(`✅ Updated component-specific tracking for vessel ${updateVesselId}, job ${job.jobNo} + component ${woComponentId} with lastDoneDate: ${dateOfCompletion}`);
        }

        await repo.updateJob(job.juuid, jobUpdates);
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
            await repo.updateJobComponentLinkTracking(rhUpdateVesselId, job.juuid, woComponentId, linkUpdates);
            console.log(`✅ Updated component-specific RH tracking for vessel ${rhUpdateVesselId}, job ${job.jobNo} + component ${woComponentId} with lastDoneRH: ${currentRH}`);
          }

          await repo.updateJob(job.juuid, jobUpdates);
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
      locationName?: string;
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

            const locationNameFallback = consumedSpare.location || consumedSpare.locationName;
            if ((!resolvedLocationId || isNaN(resolvedLocationId as number)) && locationNameFallback) {
              const locationObj = await repo.findOrCreateLocation(vesselId, locationNameFallback, 'system');
              if (locationObj) {
                resolvedLocationId = locationObj.id;
                console.log(`📍 [POST Complete] Resolved location name "${locationNameFallback}" to ID ${resolvedLocationId}`);
              }
            }

            if (resolvedLocationId && !isNaN(resolvedLocationId as number)) {
              try {
                await repo.performInventoryTransaction({
                  vesselId: vesselId,
                  spareId: spare.id,
                  spareUuid: spare.suuid,
                  locationId: resolvedLocationId,
                  eventType: 'CONSUME',
                  qtyChange: -Math.abs(qtyConsumed),
                  referenceType: 'WORK_ORDER',
                  referenceId: workOrder.wouuid,
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

  try {
    await detectAndLogAnomalies(updatedWorkOrder, body, missedCycles);
  } catch (anomalyError) {
    console.error('[WorkOrderCompletion] Anomaly detection failed (non-blocking):', anomalyError);
  }

  return {
    success: true,
    workOrder: updatedWorkOrder,
    runningHoursUpdated: !!runningHours,
    missedCycles
  };
}
