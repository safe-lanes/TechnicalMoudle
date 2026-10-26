import { classificationColumns, hasClassification, mergeSpareClassification } from '../../../shared/spareClassification';
import { RESOLUTION_ACTOR } from './dualCompletionResolver';

type Connection = { query: (sql: string, params?: any[]) => Promise<any> };
const column = (field: string) => field.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
export const isSpareClassificationLog = (log: any) =>
  log.tableName === 'spares' && (classificationColumns as readonly string[]).includes(column(log.fieldName));

/** A field-logged mutation has one timestamp. Never blend separate edits into one pair. */
export function classificationEvent(log: any, logs: any[]) {
  return logs.filter(other => isSpareClassificationLog(other) && other.rowUuid === log.rowUuid &&
    new Date(other.changedAt).getTime() === new Date(log.changedAt).getTime() &&
    other.instanceId === log.instanceId);
}

/**
 * Called inside the receiver's existing savepoint/transaction. Read and write the pair
 * together, preserving omitted fields. No outgoing logs for an incoming sync event.
 * Repeated companion events are harmless/idempotent; all source log IDs remain ACKed.
 */
export async function applyClassificationEvent(
  conn: Connection, log: any, logs: any[], receiver: string, batchUuid: string,
  _staleGuard: (conn: any, log: any, receiver: string, opts: any) => Promise<{ skip: boolean }>,
): Promise<boolean> {
  if (!isSpareClassificationLog(log)) return false;
  const event = classificationEvent(log, logs);
  if (event[0] !== log) return true;
  const resolution = event.every(member => member.changedByUserId === RESOLUTION_ACTOR);
  if (resolution && !classificationColumns.every(key =>
      event.some(member => column(member.fieldName) === key))) {
    throw new Error('Classification resolution requires the complete category/quantity pair; keep pending.');
  }
  const row = (await conn.query(
    'SELECT spare_category, optimum_qty FROM spares WHERE suuid=$1 FOR UPDATE', [log.rowUuid],
  )).rows[0];
  if (!row) throw new Error(`Spare ${log.rowUuid} missing; classification remains pending.`);
  // Pair-level collision detection includes edits to the OTHER member of the pair.
  const local = resolution ? { rows: [] } : await conn.query(
    `SELECT field_name FROM sync_field_log WHERE table_name='spares' AND row_uuid=$1
      AND field_name IN ('spareCategory','optimumQty','spare_category','optimum_qty')
      AND instance_id=$2 AND changed_at>$3 LIMIT 1`,
    [log.rowUuid, receiver, log.changedAt],
  );
  if (local.rows.length) {
    // Record every incoming member as a conflict, even when a different member changed locally.
    for (const member of event) {
      const saved = row[column(member.fieldName)];
      await conn.query(
        `INSERT INTO sync_conflict_log
          (batch_uuid,table_name,row_uuid,field_name,incoming_sender_instance,incoming_changed_at,
           incoming_old_value,incoming_new_value,receiver_winner_instance,receiver_winner_changed_at,receiver_current_value)
         VALUES ($1,'spares',$2,$3,$4,$5,$6,$7,$8,NOW(),$9)`,
        [batchUuid, log.rowUuid, member.fieldName, log.instanceId, log.changedAt,
          member.oldValue, member.newValue, receiver, saved == null ? null : String(saved)],
      );
    }
    return true;
  }
  const patch = Object.fromEntries(event.map(member => [column(member.fieldName), member.newValue]));
  const pair = mergeSpareClassification(row, patch);
  const result = await conn.query(
    'UPDATE spares SET spare_category=$1, optimum_qty=$2, updated_at=$3 WHERE suuid=$4',
    [pair.spareCategory, pair.optimumQty, log.changedAt, log.rowUuid],
  );
  if (!result.rowCount) throw new Error(`Spare ${log.rowUuid} disappeared during classification sync.`);
  if (resolution) {
    // The chosen pair is authoritative, just like a dual-completion resolution.
    // Close local mirrors only AFTER its valid pair has actually been written.
    await conn.query(
      `UPDATE sync_conflict_log SET is_resolved=true,resolved_at=NOW(),
         resolved_by=$1,resolved_action='REMOTE_RESOLUTION'
       WHERE table_name='spares' AND row_uuid=$2 AND is_resolved=false
         AND field_name IN ('spareCategory','optimumQty','spare_category','optimum_qty')`,
      [RESOLUTION_ACTOR, log.rowUuid],
    );
    await conn.query(
      `UPDATE sync_conflicts SET resolution='remote_resolution',resolved_at=NOW(),
         resolved_by=$1,updated_at=NOW(),
         resolved_value=CASE WHEN field_name IN ('spareCategory','spare_category') THEN $3 ELSE $4 END
       WHERE table_name='spares' AND row_uuid=$2 AND resolution IS NULL
         AND field_name IN ('spareCategory','optimumQty','spare_category','optimum_qty')`,
      [RESOLUTION_ACTOR, log.rowUuid, pair.spareCategory, pair.optimumQty == null ? null : String(pair.optimumQty)],
    );
  }
  return true;
}

/** Resolve one classification decision, including its companion conflict, in one transaction. */
export async function resolveClassificationConflict(
  pool: any, conflict: any, userId: string, incoming: boolean,
) {
  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');
    const result = await conn.query(
      `SELECT * FROM sync_conflict_log WHERE table_name='spares' AND row_uuid=$1
       AND incoming_changed_at=$2 AND incoming_sender_instance IS NOT DISTINCT FROM $3
       AND field_name IN ('spareCategory','optimumQty','spare_category','optimum_qty')
       AND is_resolved=false FOR UPDATE`,
      [conflict.row_uuid, conflict.incoming_changed_at, conflict.incoming_sender_instance],
    );
    if (!result.rows.length) throw Object.assign(new Error('Classification conflict is already resolved.'), { statusCode: 409 });
    const saved = (await conn.query('SELECT * FROM spares WHERE suuid=$1 FOR UPDATE', [conflict.row_uuid])).rows[0];
    if (!saved) throw new Error('Spare not found for conflict resolution.');
    const patch = incoming ? Object.fromEntries(result.rows.map((row: any) =>
      [column(row.field_name), row.incoming_new_value])) : {};
    const pair = mergeSpareClassification(saved, patch);
    const updated = await conn.query(
      'UPDATE spares SET spare_category=$1,optimum_qty=$2,updated_at=NOW() WHERE suuid=$3 RETURNING *',
      [pair.spareCategory, pair.optimumQty, conflict.row_uuid],
    );
    // Propagate the complete chosen pair together. Even an unchanged member is intentional
    // resolution evidence and prevents the opposite end reassembling a mixed pair.
    const now = new Date();
    for (const key of classificationColumns) {
      await conn.query(
        `INSERT INTO sync_field_log (table_name,row_uuid,field_name,old_value,new_value,vessel_id,
          changed_by_user_id,instance_id,is_synced,is_sync,changed_at,changed_by_display)
         VALUES ('spares',$1,$2,$3,$4,$5,$6,$7,false,false,$8,$9)`,
        [conflict.row_uuid, key, saved[key] == null ? null : String(saved[key]),
          updated.rows[0][key] == null ? null : String(updated.rows[0][key]),
          saved.vessel_id, RESOLUTION_ACTOR, process.env.SYNC_INSTANCE_ID || 'UNKNOWN', now, userId],
      );
    }
    await conn.query(
      `UPDATE sync_conflict_log SET is_resolved=true,resolved_at=NOW(),resolved_by=$1,resolved_action=$2
       WHERE id=ANY($3::int[])`,
      [userId, incoming ? 'APPLY_INCOMING' : 'DISMISS', result.rows.map((row: any) => row.id)],
    );
    await conn.query('COMMIT');
  } catch (error: any) {
    await conn.query('ROLLBACK');
    throw Object.assign(error, { statusCode: error.statusCode || 400 });
  } finally {
    conn.release();
  }
}

/** Legacy scalar conflicts may resolve only when the resulting saved pair is valid. */
export async function resolveLegacyClassification(
  pool: any, conflict: any, winningValue: string | null, resolution: string, userId: string,
) {
  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');
    const locked = (await conn.query(
      'SELECT * FROM sync_conflicts WHERE conflict_uuid=$1 FOR UPDATE', [conflict.conflictUuid || conflict.conflict_uuid],
    )).rows[0];
    if (!locked || locked.resolution) throw new Error('Classification conflict is missing or already resolved.');
    const rowUuid = locked.row_uuid;
    const saved = (await conn.query('SELECT * FROM spares WHERE suuid=$1 FOR UPDATE', [rowUuid])).rows[0];
    if (!saved) throw new Error('Spare not found for conflict resolution.');
    const pair = mergeSpareClassification(saved, { [column(locked.field_name)]: winningValue });
    await conn.query('UPDATE spares SET spare_category=$1,optimum_qty=$2,updated_at=NOW() WHERE suuid=$3',
      [pair.spareCategory, pair.optimumQty, rowUuid]);
    const now = new Date();
    for (const [key, next] of [['spare_category', pair.spareCategory], ['optimum_qty', pair.optimumQty]] as const) {
      await conn.query(
        `INSERT INTO sync_field_log(table_name,row_uuid,field_name,old_value,new_value,vessel_id,
          changed_by_user_id,instance_id,is_synced,is_sync,changed_at,changed_by_display)
         VALUES('spares',$1,$2,$3,$4,$5,$6,$7,false,false,$8,$9)`,
        [rowUuid, key, saved[key] == null ? null : String(saved[key]), next == null ? null : String(next),
          saved.vessel_id, RESOLUTION_ACTOR, process.env.SYNC_INSTANCE_ID || 'UNKNOWN', now, userId]);
    }
    await conn.query(
      `UPDATE sync_conflicts SET resolution=$1,resolved_value=$2,resolved_at=NOW(),resolved_by=$3,updated_at=NOW()
       WHERE conflict_uuid=$4`,
      [resolution, winningValue, userId, locked.conflict_uuid]);
    await conn.query('COMMIT');
  } catch (error: any) {
    await conn.query('ROLLBACK');
    throw Object.assign(error, { statusCode: 400 });
  } finally { conn.release(); }
}

export async function validateFullRowClassification(
  conn: Connection, table: string, incoming: Record<string, any>, saved: Record<string, any> = {},
) {
  if (!['spares', 'fleet_spares'].includes(table) || !hasClassification(incoming)) return;
  // Never silently filter these columns on a pre-migration receiver.
  const result = await conn.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public'
      AND table_name=$1 AND column_name IN ('spare_category','optimum_qty')`, [table],
  );
  if (result.rows.length !== 2) throw new Error(`Retryable classification schema missing on ${table}; run migration 184.`);
  mergeSpareClassification(saved, incoming);
}
