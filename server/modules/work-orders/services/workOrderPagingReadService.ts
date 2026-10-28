import { sql } from 'drizzle-orm';
import type { WorkOrderPageQuery } from '@shared/workOrdersPagination';
import type { WorkOrderReadScope } from '../repositories/workOrderPagingScope';
import { workOrderScopePredicate } from '../repositories/workOrderPagingScope';
import { withWorkOrderReadSnapshot } from '../repositories/workOrderPagingRepository';
import { getDb } from '../../../db';

/** Complete queue metadata: transfer only identifiers, never hydrated records.
 * Batches have no total-row cap and share one snapshot and reference time.
 */
export async function readWorkOrderQueue(scope: WorkOrderReadScope, q: WorkOrderPageQuery) {
  return withWorkOrderReadSnapshot(scope, q, async ({ tx, projection, where, order }) => {
    const ids: string[] = [];
    for (let offset = 0; ; offset += 200) {
      const batch = await tx.execute(sql`${projection}
        SELECT COALESCE(NULLIF(id,''),wouuid) AS queue_id FROM projection
        WHERE ${where} ORDER BY ${order} LIMIT 200 OFFSET ${offset}`);
      ids.push(...batch.rows.map(row => String(row.queue_id)));
      if (batch.rows.length < 200) break;
    }
    return { ids };
  });
}

/** The screen needs availability, not a full Jobs dataset on mount. */
export async function readComponentJobsAvailability(scope: WorkOrderReadScope) {
  const db = await getDb();
  const result = await db.execute(sql`SELECT count(*)::int AS count FROM jobs w
    WHERE w.data_scope='vessel' AND w.is_deleted IS DISTINCT FROM TRUE
      AND ${workOrderScopePredicate(scope)}`);
  return { count: Number(result.rows[0].count) };
}
