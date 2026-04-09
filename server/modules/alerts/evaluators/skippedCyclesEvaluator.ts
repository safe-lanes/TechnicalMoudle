/**
 * UC3: Critical Job Cycle Skipped Evaluator
 *
 * Scans work_orders where:
 *   - missed_cycles >= threshold (default 1)
 *   - jobPriority IN ('Critical', 'High') OR criticality = 'Yes'/'Critical'
 *   - dataScope = 'vessel'
 *
 * Creates one alert_event per unique WO with skipped cycles (dedupe by WO uuid + missed count).
 * These alerts require co-acknowledgement (Ship CE + Office superintendent).
 */

import type { AlertPolicy } from '@shared/schema';

export interface SkippedCycleAlert {
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
  vesselId: string | null;
  componentCode: string | null;
  component: string;
  criticality: string | null;
  missedCycles: number | null;
}

export function evaluateSkippedCycles(
  workOrders: WorkOrderRow[],
  policy: AlertPolicy,
  existingDedupeKeys: Set<string>
): SkippedCycleAlert[] {
  const alerts: SkippedCycleAlert[] = [];
  const thresholds = JSON.parse(policy.thresholds || '{}');
  const missedCyclesMin = thresholds.missedCyclesMin ?? 1;

  for (const wo of workOrders) {
    if (!wo.vesselId) continue;

    // Must have missed cycles above threshold
    const missed = wo.missedCycles ?? 0;
    if (missed < missedCyclesMin) continue;

    // Check priority filter: Critical or High job priority
    const priority = (wo.jobPriority || '').toLowerCase();
    const isCriticalPriority = priority === 'critical' || priority === 'high';
    const isCriticalComponent = wo.criticality === 'Yes' || wo.criticality === 'Critical';

    if (!isCriticalPriority && !isCriticalComponent) continue;

    // Dedupe key: one alert per WO per missed-cycle count (re-fires if count increases)
    const dedupeKey = `critical_job_cycle_skipped:${wo.wouuid}:${missed}`;
    if (existingDedupeKeys.has(dedupeKey)) continue;

    alerts.push({
      dedupeKey,
      objectType: 'work_order',
      objectId: wo.wouuid,
      vesselId: wo.vesselId,
      state: 'skipped',
      priority: policy.priority,
      payload: {
        workOrderNo: wo.workOrderNo,
        jobTitle: wo.jobTitle,
        jobPriority: wo.jobPriority,
        componentCode: wo.componentCode,
        component: wo.component,
        missedCycles: missed,
        requiresCoAck: true,
        coAckRoles: ['Chief Engineer', 'Technical Superintendent'],
        alertMessage: `Critical job "${wo.jobTitle}" (${wo.workOrderNo}) has ${missed} skipped cycle(s) — requires co-acknowledgement`,
      },
    });
  }

  return alerts;
}
