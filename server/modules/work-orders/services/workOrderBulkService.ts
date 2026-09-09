import * as repo from '../repositories/workOrderRepository';
import { ValidationError } from '../../shared/errors';
import { calculateMissedCycles, calculateNextDueDate, calculateMissedCyclesRH } from '@shared/dateUtils';
import { resolveHodForDepartment } from '../../ranks/hodResolutionService';
import { invalidateComplianceCache } from './complianceAnomalyService';
import { logFieldChanges } from '../../sync';
import { finalizeWorkOrderCompletion } from './workOrderCompletionService';
import { isSuperintendentLockEnabled } from './workOrderService';

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

  const remarks = (approverRemarks || '').trim();

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
      } else if (existingWO.maintenanceBasis === "Running Hours" && ((existingWO as any).woCompletionRh || existingWO.currentReading)) {
        // R1 (migration 139): next due derives from the stored WO Completion RH
        // (fallback: current reading = pre-feature behaviour).
        const bulkCycleRH = (existingWO as any).woCompletionRh ?? existingWO.currentReading;
        nextDueReading = (parseInt(String(bulkCycleRH)) + parseInt(existingWO.frequencyValue || "0")).toString();
      }

      const completionDateForCalc = actualCompletionDate || existingWO.completionDateTime || existingWO.dateCompleted;
      // Real missed-cycle computation per maintenance basis — the RH branch was
      // previously hardcoded to 0, which let late RH WOs bypass the justification
      // gate on the bulk path. Mirrors workOrderCompletionService.
      let missedCycles: number;
      if (existingWO.maintenanceBasis === 'Running Hours') {
        // R1 (migration 139): missed-cycles measures intervals at the moment the
        // work was done — WO Completion RH first, stored completion reading fallback.
        const completionRHValue = (existingWO as any).woCompletionRh ?? existingWO.completionRH;
        const dueRH = existingWO.nextDueReading ?? null;
        let jobIntervalRH: number | string | null = null;
        if (existingWO.jobId) {
          try {
            const jobForRH = await repo.findJob(existingWO.jobId);
            if (jobForRH?.intervalRunningHour) jobIntervalRH = jobForRH.intervalRunningHour;
          } catch { /* fall through to frequencyValue */ }
        }
        if (!jobIntervalRH && existingWO.frequencyValue) jobIntervalRH = existingWO.frequencyValue;
        missedCycles = calculateMissedCyclesRH(dueRH, completionRHValue, jobIntervalRH);
      } else {
        missedCycles = calculateMissedCycles(
          existingWO.nextDueDate || existingWO.dueDate,
          completionDateForCalc,
          existingWO.frequencyValue,
          existingWO.frequencyUnit
        );
      }
      if (missedCycles > 0) {
        console.log(`⚠️ Skipped cycle detection (bulk): ${missedCycles} cycle(s) missed for WO ${workOrderId}`);
      }

      // ── Layer 5 approval-tier gates (same rules as the single-approve path) ──
      const currentTier = existingWO.approvalTier || 'standard';
      // A bulk request can contain several vessels, so resolve this policy for
      // each work order instead of using one fleet-wide setting.
      const lockEnabled = await isSuperintendentLockEnabled(existingWO.vesselId);

      if (currentTier === 'superintendent_locked' && lockEnabled) {
        results.failed.push({
          id: workOrderId,
          error: 'Work order is LOCKED pending Superintendent acknowledgment and cannot be bulk-approved.'
        });
        continue;
      }
      // locked-with-lock-disabled behaves as the notification tier (min 20 chars).
      const tierMinRemarks =
        (currentTier === 'superintendent_locked' || currentTier === 'superintendent_notification') ? 20
        : currentTier === 'ce_with_justification' ? 10
        : 0;
      if (tierMinRemarks > 0 && remarks.length < tierMinRemarks) {
        results.failed.push({
          id: workOrderId,
          error: `Work order approval tier requires detailed approver remarks (minimum ${tierMinRemarks} characters).`
        });
        continue;
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

      // Check if linked job requires Level 2 Office Review
      let requiresLevel2Review = false;
      if (existingWO.jobId) {
        try {
          const linkedJob = await repo.findJob(existingWO.jobId);
          if (linkedJob && (linkedJob as any).level2ReviewerRankId) {
            requiresLevel2Review = true;
          }
        } catch (err) {
          console.warn(`[Bulk Approve] Could not load linked job ${existingWO.jobId}:`, err);
        }
      }

      const updateData: Record<string, any> = {
        status: requiresLevel2Review ? "Pending Office Review" : "Completed",
        approvalAction: "approved",
        approver: resolvedApprover,
        approverRemarks,
        // Parity with the single-approve path: tiered approvals persist the
        // mandatory remarks in ceApprovalRemarks for the audit trail.
        ceApprovalRemarks: tierMinRemarks > 0 ? remarks : null,
        skippedCyclesJustification: (missedCycles >= 1 && skippedCyclesJustification) ? skippedCyclesJustification : null,
        approvalDate: new Date().toISOString(),
        wasRejected: false,
        // Save as Draft (Task #402): approval supersedes any stashed draft.
        draftExecutionData: null
      };

      if (!requiresLevel2Review) {
        updateData.nextDueDate = nextDueDate;
        updateData.nextDueReading = nextDueReading;
        updateData.missedCycles = missedCycles;
        updateData.originalDueDate = originalDueDate;
      }

      if (actualCompletionDate) {
        updateData.dateCompleted = actualCompletionDate;
      }

      await repo.update(workOrderId, updateData);

      // Sync field logging — bulk approve
      try {
        await logFieldChanges('work_orders', existingWO.wouuid, existingWO.vesselId || null, existingWO, { ...existingWO, ...updateData }, approver || 'system');
      } catch (err) { console.error('[FieldLogger] WO bulkApprove:', err); }

      if (!requiresLevel2Review && missedCycles >= 1 && existingWO.maintenanceBasis === 'Calendar') {
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

// ── Reviewer Approve (Level 2 Office Review → Completed) ──

export async function reviewerApprove(workOrderId: string, reviewerComments?: string, reviewedByUuid?: string) {
  const existingWO = await repo.findById(workOrderId);
  if (!existingWO) {
    throw new ValidationError('Work order not found');
  }
  if (existingWO.status !== 'Pending Office Review') {
    throw new ValidationError(`Work order is not pending office review (status: ${existingWO.status})`);
  }

  // Phase 0 / P0.2 (defect D1): the office step must not complete a WO that is still held by
  // the superintendent lock. The HOD step now gates before the L2 hand-off, but a WO that
  // reached "Pending Office Review" before that fix (or any future path) must still be
  // refused here — same code the HOD step uses, same live policy read.
  if (existingWO.approvalTier === 'superintendent_locked' && !existingWO.superintendentAcknowledged) {
    // Merge note (21-Aug): Jeevan's vessel-settings refactor made isSuperintendentLockEnabled
    // per-vessel (required vesselId). P0.2 was written against the old no-arg global signature;
    // pass existingWO.vesselId so the office-step lock read matches the HOD-step read (the gate
    // in updateWorkOrder already reads per-vessel). Same P0.2 intent, now vessel-scoped.
    if (await isSuperintendentLockEnabled(existingWO.vesselId)) {
      throw new ValidationError(
        'This work order has high severity issues (3+ missed cycles, 21+ days late, or 7+ days backdating). It is locked pending Superintendent acknowledgment. The office reviewer cannot complete it until the Superintendent has acknowledged.',
        { code: 'SUPERINTENDENT_LOCKED' }
      );
    }
  }

  const actualCompletionDate = existingWO.completionDateTime || existingWO.dateCompleted;
  const originalDueDate = existingWO.nextDueDate || existingWO.dueDate || null;

  let nextDueDate: string | undefined;
  let nextDueReading: string | undefined;

  if (existingWO.maintenanceBasis === 'Calendar' && actualCompletionDate) {
    if (existingWO.frequencyValue && existingWO.frequencyUnit) {
      const { calculateNextDueDate } = await import('@shared/dateUtils');
      const computed = calculateNextDueDate(actualCompletionDate, existingWO.frequencyValue, existingWO.frequencyUnit, originalDueDate);
      if (computed) nextDueDate = computed;
    }
  } else if (existingWO.maintenanceBasis === 'Running Hours' && ((existingWO as any).woCompletionRh || existingWO.currentReading)) {
    // R1 (migration 139): same source switch as the bulk path above.
    const cycleRHSrc = (existingWO as any).woCompletionRh ?? existingWO.currentReading;
    nextDueReading = (parseInt(String(cycleRHSrc)) + parseInt(existingWO.frequencyValue || '0')).toString();
  }

  const { calculateMissedCycles } = await import('@shared/dateUtils');
  const completionDateForCalc = actualCompletionDate || existingWO.completionDateTime || existingWO.dateCompleted;
  const missedCycles = existingWO.maintenanceBasis === 'Running Hours'
    ? 0
    : calculateMissedCycles(existingWO.nextDueDate || existingWO.dueDate, completionDateForCalc, existingWO.frequencyValue, existingWO.frequencyUnit);

  const updateData: Record<string, any> = {
    status: 'Completed',
    reviewerComments: reviewerComments || null,
    reviewedByUuid: reviewedByUuid || null,
    nextDueDate,
    nextDueReading,
    missedCycles,
    originalDueDate,
    // Save as Draft (Task #402): Level-2 approval supersedes any stashed draft.
    draftExecutionData: null,
  };
  if (actualCompletionDate) {
    updateData.dateCompleted = actualCompletionDate;
  }

  await repo.update(workOrderId, updateData);

  try {
    await logFieldChanges('work_orders', existingWO.wouuid, existingWO.vesselId || null, existingWO, { ...existingWO, ...updateData }, reviewedByUuid || 'system');
  } catch (err) { console.error('[FieldLogger] WO reviewerApprove:', err); }

  try {
    await repo.createAuditLog({
      entityType: 'work_order',
      entityId: existingWO.wouuid || workOrderId,
      actionType: 'reviewer_approve',
      userId: reviewedByUuid || 'system',
      source: 'web_ui',
      vesselCode: existingWO.vesselId || null,
      componentCode: existingWO.componentCode || null,
      fieldName: null,
      oldValue: null,
      newValue: null,
      payload: {
        workOrderNo: existingWO.workOrderNo,
        status: 'Completed',
        approvedAt: new Date().toISOString(),
        reviewerComments: reviewerComments || null,
      },
    });
  } catch (auditError) {
    console.error('Failed to create audit log for reviewer approve:', auditError);
  }

  if (missedCycles >= 1 && existingWO.maintenanceBasis === 'Calendar') {
    try {
      const { createSkippedCycleRecords } = await import('../utils/skippedCycleBackfill');
      await createSkippedCycleRecords({
        workOrderId: existingWO.wouuid || workOrderId,
        componentId: existingWO.component || '',
        componentCode: existingWO.componentCode || null,
        vesselCode: existingWO.vesselId || null,
        jobId: existingWO.jobId || null,
        jobCode: existingWO.templateCode || null,
        jobTitle: existingWO.jobTitle || null,
        originalDueDate,
        missedCycles,
        frequencyValue: existingWO.frequencyValue || '0',
        frequencyUnit: existingWO.frequencyUnit || ''
      });
    } catch (err) {
      console.error('[BACKFILL ERROR] Reviewer approve skipped cycle records:', err);
    }
  }

  // Run completion side-effects: maintenance history, job cycle dates, spare consumption.
  // The WO row is now Completed in the DB so finalizeWorkOrderCompletion reads fresh state.
  try {
    await finalizeWorkOrderCompletion(workOrderId);
  } catch (finalizeErr) {
    console.error('[ReviewerApprove] finalizeWorkOrderCompletion failed (non-blocking):', finalizeErr);
  }

  invalidateComplianceCache();
  console.log(`✅ Reviewer approved work order: ${workOrderId}`);
  return { message: 'Work order approved by reviewer', workOrderId };
}

// ── Reviewer Reopen (Level 2 Office Review → send back for rework) ──

export async function reviewerReopen(workOrderId: string, reviewerComments?: string, reviewedByUuid?: string) {
  const existingWO = await repo.findById(workOrderId);
  if (!existingWO) {
    throw new ValidationError('Work order not found');
  }
  if (existingWO.status !== 'Pending Office Review') {
    throw new ValidationError(`Work order is not pending office review (status: ${existingWO.status})`);
  }

  const updateData: Record<string, any> = {
    status: 'Reopened',
    approvalAction: 'rejected',
    wasRejected: true,
    reviewerComments: reviewerComments || null,
    reviewedByUuid: reviewedByUuid || null,
    rejectionDate: new Date().toISOString(),
    rejectionComments: reviewerComments || null,
    // Intentionally preserve completionDateTime and dateCompleted so the vessel
    // form loads pre-populated and hasCompletionData evaluates true on resubmit.
    // wasRejected=true (set above) is the permanent guard in computeWorkOrderStatus:
    // it prevents the status engine from returning 'Completed' for this WO on any
    // recalculation cycle, regardless of completionDateTime being present.
    // status='Reopened' provides the initial guard for cycle 1; wasRejected covers
    // all subsequent cycles after the recalculator transitions Reopened → Due.
  };

  await repo.update(workOrderId, updateData);

  try {
    await logFieldChanges('work_orders', existingWO.wouuid, existingWO.vesselId || null, existingWO, { ...existingWO, ...updateData }, reviewedByUuid || 'system');
  } catch (err) { console.error('[FieldLogger] WO reviewerReopen:', err); }

  try {
    await repo.createAuditLog({
      entityType: 'work_order',
      entityId: existingWO.wouuid || workOrderId,
      actionType: 'reviewer_reopen',
      userId: reviewedByUuid || 'system',
      source: 'web_ui',
      vesselCode: existingWO.vesselId || null,
      componentCode: existingWO.componentCode || null,
      fieldName: null,
      oldValue: null,
      newValue: null,
      payload: {
        workOrderNo: existingWO.workOrderNo,
        status: 'Reopened',
        reopenedAt: new Date().toISOString(),
        reviewerComments: reviewerComments || null,
      },
    });
  } catch (auditError) {
    console.error('Failed to create audit log for reviewer reopen:', auditError);
  }

  invalidateComplianceCache();
  console.log(`🔄 Reviewer reopened work order: ${workOrderId}`);
  return { message: 'Work order sent back for rework by reviewer', workOrderId };
}

// ── Bulk Reject Work Orders ──

export async function bulkReject(workOrderIds: string[], approver?: string, rejectionComments?: string, actor?: string) {
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

      // Sync field logging — bulk reject
      try {
        await logFieldChanges('work_orders', existingWO.wouuid, existingWO.vesselId || null, existingWO, { ...existingWO, ...updateData }, actor || rejectApprover || 'system');
      } catch (err) { console.error('[FieldLogger] WO bulkReject:', err); }

      // Audit Trail: capture the actual approver who rejected the work order so
      // rejection-history UIs do not fall back to "system".
      try {
        await repo.createAuditLog({
          entityType: 'work_order',
          entityId: existingWO.wouuid || workOrderId,
          actionType: 'reject',
          userId: actor || rejectApprover || approver || 'system',
          source: 'web_ui',
          vesselCode: existingWO.vesselId || null,
          componentCode: existingWO.componentCode || null,
          fieldName: null,
          oldValue: null,
          newValue: null,
          payload: {
            workOrderNo: existingWO.workOrderNo,
            status: 'Due',
            rejectedAt: updateData.rejectionDate,
            rejectionComments: rejectionComments || null,
            bulk: true,
          },
        });
      } catch (auditError) {
        console.error('Failed to create audit log entry for bulk reject:', auditError);
      }

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
