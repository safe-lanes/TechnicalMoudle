import { eq, or, sql } from 'drizzle-orm';
import { componentMaintenanceHistory, components, vessels, workOrders, jobs,
  type InsertComponentMaintenanceHistory } from '@shared/schema';
import { normalizeDateToDDMMMYYYY } from '@shared/dateUtils';
import { isVisibleMaintenanceHistory } from '@shared/workOrders/maintenanceHistoryVisibility';
import { getDb } from '../../../db';
import { logFieldChanges } from '../../sync/fieldLogger';

/** SQL equivalent of the presentation predicate, also used for actual-completion lookup. */
export const visibleMaintenanceHistory = sql`coalesce(${componentMaintenanceHistory.isSkipped}, false) = false
  AND upper(trim(${componentMaintenanceHistory.status})) <> 'SKIPPED'`;

export function sameMaintenanceCycle(
  existing: { isSkipped?: boolean | null; status: string; runningHoursAtCompletion?: string | null;
    skippedCycleDate?: string | null; originalDueDate?: string | null; dateCompleted: string },
  incoming: InsertComponentMaintenanceHistory,
): boolean {
  if (isVisibleMaintenanceHistory(existing) || isVisibleMaintenanceHistory(incoming)) {
    return isVisibleMaintenanceHistory(existing) && isVisibleMaintenanceHistory(incoming);
  }
  // RH boundaries, not the local recording day, distinguish RH cycles.
  if (incoming.runningHoursAtCompletion != null) {
    return existing.runningHoursAtCompletion != null
      && Number(existing.runningHoursAtCompletion) === Number(incoming.runningHoursAtCompletion);
  }
  if (existing.runningHoursAtCompletion != null) return false;
  const day = (value: string | null | undefined) => value ? normalizeDateToDDMMMYYYY(value) : null;
  const target = day(incoming.skippedCycleDate || incoming.originalDueDate || incoming.dateCompleted);
  return target !== null
    && day(existing.skippedCycleDate || existing.originalDueDate || existing.dateCompleted) === target;
}

/** All affected local writers share the source WO row lock. No cross-instance guarantee. */
export async function persistMaintenanceHistory(history: InsertComponentMaintenanceHistory) {
  const db = await getDb();
  return db.transaction(async tx => {
    const [source] = await tx.select().from(workOrders)
      .where(eq(workOrders.wouuid, history.workOrderId)).for('update');
    if (!source) throw new Error('Maintenance history source Work Order not found');
    const [vessel] = source.vesselId ? await tx.select().from(vessels)
      .where(or(eq(vessels.vuuid, source.vesselId), eq(vessels.id, source.vesselId))).limit(1) : [];
    if (!vessel?.vCode) throw new Error('Maintenance history requires a resolved vessel code');
    const [component] = await tx.select().from(components)
      .where(eq(components.cuuid, history.componentId)).limit(1);
    if (!component?.componentCode || ![vessel.vuuid, vessel.id, vessel.vCode].includes(component.vesselId ?? '')) {
      throw new Error('Maintenance history component is missing or belongs to another vessel');
    }
    const [job] = source.jobId ? await tx.select().from(jobs)
      .where(eq(jobs.juuid, source.jobId)).limit(1) : [];
    if (job && ![vessel.vuuid, vessel.id, vessel.vCode].includes(job.vesselId ?? '')) {
      throw new Error('Maintenance history Job belongs to another vessel');
    }
    const existing = await tx.select().from(componentMaintenanceHistory)
      .where(or(eq(componentMaintenanceHistory.workOrderId, source.wouuid),
        eq(componentMaintenanceHistory.sourceWorkOrderId, source.wouuid)));
    if (!isVisibleMaintenanceHistory(history)) {
      // A competing writer may establish the basis after the caller's initial
      // read. Do not mix two bases within one source's immutable history.
      const basisOf = (row: { remarks?: string | null }) => {
        try { return JSON.parse(row.remarks || '{}').skippedCycleBasis; } catch { return undefined; }
      };
      const incomingBasis = basisOf(history);
      const establishedBasis = existing.filter(row => !isVisibleMaintenanceHistory(row))
        .map(basisOf).find(basis => basis?.kind === incomingBasis?.kind);
      if (incomingBasis && establishedBasis && JSON.stringify(incomingBasis) !== JSON.stringify(establishedBasis)) {
        throw new Error('Skipped cycle basis changed during creation; retry using the persisted source basis');
      }
    }
    const match = existing.find(row => sameMaintenanceCycle(row, history));
    if (match) return match; // Never rewrite immutable legacy rows or log a retry.
    const [inserted] = await tx.insert(componentMaintenanceHistory).values({
      ...history,
      componentCode: component.componentCode,
      vesselCode: vessel.vCode,
      jobId: job?.juuid ?? null,
      jobCode: job?.jobNo ?? null,
      sourceWorkOrderId: isVisibleMaintenanceHistory(history) ? history.sourceWorkOrderId : source.wouuid,
    }).returning();
    // Passing tx makes logger errors propagate: both the row and its logs roll back.
    await logFieldChanges('component_maintenance_history', inserted.cmhuuid,
      inserted.vesselCode, null, inserted, 'system', tx);
    return inserted;
  });
}
