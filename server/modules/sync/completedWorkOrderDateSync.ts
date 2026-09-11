import {
  isCompletedWorkOrderStatus,
  isValidCompletedWorkOrderDate,
} from '../work-orders/utils/completedWorkOrderDate';

export const COMPLETED_DATE_SYNC_ERROR = 'COMPLETED_WORK_ORDER_DATE_REQUIRED';

function toSnakeCase(fieldName: string): string {
  return fieldName.includes('_')
    ? fieldName
    : fieldName.replace(/([A-Z])/g, (m) => '_' + m.toLowerCase());
}

/**
 * Field logs are replayed independently. Before a synced status=Completed is
 * applied, make sure the receiving row already has a valid date_completed.
 * Existing sync date precedence is preserved: final date first, then the
 * stored execution timestamp, then the companion date from this batch.
 */
export async function ensureDateBeforeSyncedCompletedStatus(
  client: { query: (sql: string, params?: any[]) => Promise<any> },
  log: { tableName: string; rowUuid: string; fieldName: string; newValue: string | null | undefined },
  incomingCompletionDate?: string | null,
): Promise<void> {
  if (
    log.tableName !== 'work_orders'
    || toSnakeCase(log.fieldName) !== 'status'
    || !isCompletedWorkOrderStatus(log.newValue)
  ) {
    return;
  }

  const rowResult = await client.query(
    `SELECT date_completed, completion_date_time FROM work_orders WHERE wouuid = $1 LIMIT 1`,
    [log.rowUuid],
  );
  if (rowResult.rows.length === 0) return;

  const row = rowResult.rows[0];
  if (isValidCompletedWorkOrderDate(row.date_completed)) return;

  const fallback = isValidCompletedWorkOrderDate(row.completion_date_time)
    ? row.completion_date_time
    : isValidCompletedWorkOrderDate(incomingCompletionDate)
      ? incomingCompletionDate
      : null;

  if (!fallback) {
    const error: any = new Error(
      `Synced work order ${log.rowUuid} cannot be marked Completed without a valid completion date.`,
    );
    error.code = COMPLETED_DATE_SYNC_ERROR;
    throw error;
  }

  await client.query(
    `UPDATE work_orders SET date_completed = $1 WHERE wouuid = $2`,
    [fallback, log.rowUuid],
  );
}