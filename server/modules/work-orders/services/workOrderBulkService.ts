import * as repo from '../repositories/workOrderRepository';
import { ValidationError } from '../../shared/errors';

// ── Bulk Approve Work Orders ──

export async function bulkApprove(workOrderIds: string[], approver?: string, approverRemarks?: string) {
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

      // Calculate next due date/reading based on actual completion date
      const actualCompletionDate = existingWO.completionDateTime || existingWO.dateCompleted;
      let nextDueDate = undefined;
      let nextDueReading = undefined;

      if (existingWO.maintenanceBasis === "Calendar" && actualCompletionDate) {
        const completionDate = new Date(actualCompletionDate);
        if (!isNaN(completionDate.getTime())) {
          const freq = parseInt(existingWO.frequencyValue || "0");
          if (existingWO.frequencyUnit === "Days") {
            completionDate.setDate(completionDate.getDate() + freq);
          } else if (existingWO.frequencyUnit === "Weeks") {
            completionDate.setDate(completionDate.getDate() + (freq * 7));
          } else if (existingWO.frequencyUnit === "Months") {
            completionDate.setMonth(completionDate.getMonth() + freq);
          } else if (existingWO.frequencyUnit === "Years") {
            completionDate.setFullYear(completionDate.getFullYear() + freq);
          }
          nextDueDate = completionDate.toISOString().split('T')[0];
        }
      } else if (existingWO.maintenanceBasis === "Running Hours" && existingWO.currentReading) {
        nextDueReading = (parseInt(existingWO.currentReading) + parseInt(existingWO.frequencyValue || "0")).toString();
      }

      const updateData: Record<string, any> = {
        status: "Completed",
        approvalAction: "approved",
        approver: approver || "Head of Dept",
        approverRemarks: approverRemarks,
        approvalDate: new Date().toISOString(),
        nextDueDate,
        nextDueReading,
        // Clear wasRejected flag on successful approval
        wasRejected: false
      };

      if (actualCompletionDate) {
        updateData.dateCompleted = actualCompletionDate;
      }

      await repo.update(workOrderId, updateData);
      results.success.push(workOrderId);
      console.log(`✅ Approved work order: ${workOrderId}`);
    } catch (err: any) {
      console.error(`❌ Failed to approve work order ${workOrderId}:`, err.message);
      results.failed.push({ id: workOrderId, error: err.message });
    }
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

      const updateData = {
        status: "Due", // Rejected WOs go back to Due
        approvalAction: "rejected",
        approver: approver || "Head of Dept",
        rejectionComments: rejectionComments,
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

  return {
    message: `Bulk rejection completed: ${results.success.length} rejected, ${results.failed.length} failed`,
    results
  };
}
