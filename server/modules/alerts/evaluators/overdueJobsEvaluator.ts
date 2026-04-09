/**
 * UC1: Critical Job Overdue Evaluator
 *
 * Scans work_orders where:
 *   - status = 'Overdue'
 *   - jobPriority IN ('Critical', 'High') OR component.critical = true
 *   - dataScope = 'vessel'
 *
 * Creates one alert_event per unique overdue work order (dedupe by WO uuid).
 */

import type { AlertPolicy } from '@shared/schema';

export interface OverdueJobAlert {
  dedupeKey: string;
  objectType: string;
  objectId: string;
  vesselId: string;
  state: string;
  priority: string;
  payload: Record<string, any>;
}

interface WorkOrderRow {
  wouuid: string;
  workOrderNo: string;
  jobTitle: string;
  jobPriority: string | null;
  status: string;
  dueDate: string | null;
  vesselId: string | null;
  componentCode: string | null;
  component: string;
  criticality: string | null;
  missedCycles: number | null;
}

export function evaluateOverdueJobs(
  workOrders: WorkOrderRow[],
  policy: AlertPolicy,
  existingDedupeKeys: Set<string>
): OverdueJobAlert[] {
  const alerts: OverdueJobAlert[] = [];
  const thresholds = JSON.parse(policy.thresholds || '{}');
  const overdueDays = thresholds.overdueDays ?? 0;

  for (const wo of workOrders) {
    // Must be Overdue status
    if (wo.status !== 'Overdue') continue;
    // Must be vessel-scoped work order with a vesselId
    if (!wo.vesselId) continue;

    // Check priority filter: Critical or High job priority
    const priority = (wo.jobPriority || '').toLowerCase();
    const isCriticalPriority = priority === 'critical' || priority === 'high';
    // Also check component criticality
    const isCriticalComponent = wo.criticality === 'Yes' || wo.criticality === 'Critical';

    if (!isCriticalPriority && !isCriticalComponent) continue;

    // Check overdue days threshold if > 0
    if (overdueDays > 0 && wo.dueDate) {
      const dueDate = new Date(wo.dueDate);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < overdueDays) continue;
    }

    // Dedupe key: one alert per WO
    const dedupeKey = `critical_job_overdue:${wo.wouuid}`;
    if (existingDedupeKeys.has(dedupeKey)) continue;

    alerts.push({
      dedupeKey,
      objectType: 'work_order',
      objectId: wo.wouuid,
      vesselId: wo.vesselId,
      state: 'overdue',
      priority: policy.priority,
      payload: {
        workOrderNo: wo.workOrderNo,
        jobTitle: wo.jobTitle,
        jobPriority: wo.jobPriority,
        dueDate: wo.dueDate,
        componentCode: wo.componentCode,
        component: wo.component,
        alertMessage: `Critical/High priority job "${wo.jobTitle}" (${wo.workOrderNo}) is overdue`,
      },
    });
  }

  return alerts;
}
