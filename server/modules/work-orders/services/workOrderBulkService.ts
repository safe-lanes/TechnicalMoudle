import * as repo from '../repositories/workOrderRepository';
import { ValidationError } from '../../shared/errors';
import { calculateMissedCycles, calculateNextDueDate } from '@shared/dateUtils';
import { resolveHodForDepartment } from '../../ranks/hodResolutionService';
import { invalidateComplianceCache } from './complianceAnomalyService';

// ── Bulk Approve Work Orders ──

export async function bulkApprove(workOrderIds: string[], approver?: string, approverRemarks?: string, skippedCyclesJustification?: string) {
  if (!Array.isArray(workOrderIds) || workOrderIds.length === 0) {
    throw new ValidationError('workOrderIds array is required');
  }

  console.log(`📋 Bulk approving ${workOrderIds.length} work orders`);

  const results: { success: string[]; failed: { id: string; error: string }[] } = {
    success: [],
    failed: []
  };

  for (const workOrderId of workOrderIds) {
    try {
      const existingWO = await repo.findById(workOrderId);
      if (!existingWO) {
        results.failed.push({ id: workOrderId, error: "Work order not found" });
        continue;
      }

      // Only approve work orders in 'Pending Approval' status
      if (existingWO.status !== 'Pending Approval' &&
          (existingWO as any).computedStatus !== 'Pending Approval') {
        results.failed.push({ id: workOrderId, error: `Work order is not pending approval (status: ${existingWO.status})` });
        continue;
      }

      const hodResolution = await resolveHodForDepartment(
        existingWO.vesselId,
        existingWO.department,
        existingWO.approver
      );
      let resolvedApprover = hodResolution.rankName;
      if (approver && approver !== hodResolution.rankName && hodResolution.source !== 'fallback') {
        console.warn(`[Bulk Approve] Caller approver "${approver}" differs from org chart HOD "${hodResolution.rankName}" for dept "${existingWO.department}". Using org chart value.`);
      } else if (approver && hodResolution.source === 'fallback') {
        resolvedApprover = approver;
      }

      // Calculate next due date/reading based on actual completion date
      const actualCompletionDate = existingWO.completionDateTime || existingWO.dateCompleted;
      let nextDueDate = undefined;
      let nextDueReading = undefined;

      const originalDueDate = existingWO.nextDueDate || existingWO.dueDate || null;

      if (existingWO.maintenanceBasis === "Calendar" && actualCompletionDate) {
        if (existingWO.frequencyValue && existingWO.frequencyUnit) {
          const computed = calculateNextDueDate(actualCompletionDate, existingWO.frequencyValue, existingWO.frequencyUnit, originalDueDate);
          if (computed) {
            nextDueDate = computed;
          }
        }
      } else if (existingWO.maintenanceBasis === "Running Hours" && existingWO.currentReading) {
        nextDueReading = (parseInt(existingWO.currentReading) + parseInt(existingWO.frequencyValue || "0")).toString();
      }

      const completionDateForCalc = actualCompletionDate || existingWO.completionDateTime || existingWO.dateCompleted;
      const missedCycles = existingWO.maintenanceBasis === 'Running Hours'
        ? 0
        : calculateMissedCycles(
            existingWO.nextDueDate || existingWO.dueDate,
            completionDateForCalc,
            existingWO.frequencyValue,
            existingWO.frequencyUnit
          );
      if (missedCycles > 0) {
        console.log(`⚠️ Skipped cycle detection (bulk): ${missedCycles} cycle(s) missed for WO ${workOrderId}`);
      }

      if (missedCycles >= 1) {
        const justification = (skippedCyclesJustification || '').trim();
        if (!justification || justification.length < 30) {
          results.failed.push({
            id: workOrderId,
            error: `Work order has ${missedCycles} skipped cycle(s) and requires a written justification (minimum 30 characters) before approval.`
          });
          continue;
        }
      }

      const updateData: Record<string, any> = {
        status: "Completed",
        approvalAction: "approved",
        approver: resolvedApprover,
        approverRemarks,
        skippedCyclesJustification: (missedCycles >= 1 && skippedCyclesJustification) ? skippedCyclesJustification : null,
        approvalDate: new Date().toISOString(),
        nextDueDate,
        nextDueReading,
        missedCycles,
        originalDueDate,
        wasRejected: false
      };

      if (actualCompletionDate) {
        updateData.dateCompleted = actualCompletionDate;
      }

      await repo.update(workOrderId, updateData);

      if (missedCycles >= 1 && existingWO.maintenanceBasis === 'Calendar') {
        try {
          const { createSkippedCycleRecords } = await import('../utils/skippedCycleBackfill');
          await createSkippedCycleRecords({
            workOrderId: existingWO.wouuid || workOrderId,
            componentId: existingWO.componentId || '',
            componentCode: existingWO.componentCode || null,
            vesselCode: existingWO.vesselId || null,
            jobId: existingWO.jobId || null,
            jobCode: existingWO.jobCode || null,
            jobTitle: existingWO.jobTitle || null,
            originalDueDate,
            missedCycles,
            frequencyValue: existingWO.frequencyValue || '0',
            frequencyUnit: existingWO.frequencyUnit || ''
          });
        } catch (err) {
          console.error('[BACKFILL ERROR] Failed to create skipped cycle records (bulk):', err);
        }
      }

      results.success.push(workOrderId);
      console.log(`✅ Approved work order: ${workOrderId}`);
    } catch (err: any) {
      console.error(`❌ Failed to approve work order ${workOrderId}:`, err.message);
      results.failed.push({ id: workOrderId, error: err.message });
    }
  }

  if (results.success.length > 0) {
    invalidateComplianceCache();
  }

  return {
    message: `Bulk approval completed: ${results.success.length} approved, ${results.failed.length} failed`,
    results
  };
}

// ── Bulk Reject Work Orders ──

export async function bulkReject(workOrderIds: string[], approver?: string, rejectionComments?: string) {
  if (!Array.isArray(workOrderIds) || workOrderIds.length === 0) {
    throw new ValidationError('workOrderIds array is required');
  }

  console.log(`📋 Bulk rejecting ${workOrderIds.length} work orders`);

  const results: { success: string[]; failed: { id: string; error: string }[] } = {
    success: [],
    failed: []
  };

  for (const workOrderId of workOrderIds) {
    try {
      const existingWO = await repo.findById(workOrderId);
      if (!existingWO) {
        results.failed.push({ id: workOrderId, error: "Work order not found" });
        continue;
      }

      // Only reject work orders in 'Pending Approval' status
      if (existingWO.status !== 'Pending Approval' &&
          (existingWO as any).computedStatus !== 'Pending Approval') {
        results.failed.push({ id: workOrderId, error: `Work order is not pending approval (status: ${existingWO.status})` });
        continue;
      }

      const rejectHod = await resolveHodForDepartment(
        existingWO.vesselId,
        existingWO.department,
        existingWO.approver
      );
      let rejectApprover = rejectHod.rankName;
      if (approver && approver !== rejectHod.rankName && rejectHod.source !== 'fallback') {
        console.warn(`[Bulk Reject] Caller approver "${approver}" differs from org chart HOD "${rejectHod.rankName}" for dept "${existingWO.department}". Using org chart value.`);
      } else if (approver && rejectHod.source === 'fallback') {
        rejectApprover = approver;
      }
      const updateData = {
        status: "Due" as const,
        approvalAction: "rejected",
        approver: rejectApprover,
        rejectionComments,
        rejectionDate: new Date().toISOString(),
        wasRejected: true, // Mark for red font display
        // Clear completion data for rework
        completionDateTime: null,
        dateCompleted: null
      };

      await repo.update(workOrderId, updateData);
      results.success.push(workOrderId);
      console.log(`❌ Rejected work order: ${workOrderId}`);
    } catch (err: any) {
      console.error(`❌ Failed to reject work order ${workOrderId}:`, err.message);
      results.failed.push({ id: workOrderId, error: err.message });
    }
  }

  if (results.success.length > 0) {
    invalidateComplianceCache();
  }

  return {
    message: `Bulk rejection completed: ${results.success.length} rejected, ${results.failed.length} failed`,
    results
  };
}
