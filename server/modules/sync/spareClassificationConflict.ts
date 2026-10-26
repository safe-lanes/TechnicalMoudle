import { validateIncomingSparePair } from './spareClassificationSync';
import { initFieldLoggerInstanceId } from './fieldLogger';
import { RESOLUTION_ACTOR } from './dualCompletionResolver';

export const isSpareClassificationConflict = (conflict: any) => conflict.table_name === 'spares' &&
  ['spareCategory', 'optimumQty', 'spare_category', 'optimum_qty'].includes(conflict.field_name);

/** Existing conflict workflow, resolved as a pair with row/write/log/resolution atomicity. */
export async function resolveSparePairConflict(pool: any, conflict: any, source: 'log' | 'old', userId: string, incoming: boolean, side: 'ship' | 'shore' = 'ship') {
  const client = await pool.connect();
  const table = source === 'log' ? 'sync_conflict_log' : 'sync_conflicts';
  try {
    await client.query('BEGIN');
    const savedResult = await client.query('SELECT * FROM spares WHERE suuid=$1 FOR UPDATE', [conflict.row_uuid]);
    const saved = savedResult.rows[0];
    if (!saved) throw Object.assign(new Error('Spare no longer exists.'), { statusCode: 404 });
    const open = source === 'log'
      ? await client.query(`SELECT * FROM sync_conflict_log WHERE table_name='spares' AND row_uuid=$1 AND is_resolved=false
          AND incoming_changed_at IS NOT DISTINCT FROM $2
          AND incoming_sender_instance IS NOT DISTINCT FROM $3
          AND field_name IN ('spareCategory','optimumQty','spare_category','optimum_qty') ORDER BY id FOR UPDATE`,
        [conflict.row_uuid, conflict.incoming_changed_at, conflict.incoming_sender_instance])
      : await client.query(`SELECT * FROM sync_conflicts WHERE table_name='spares' AND row_uuid=$1 AND resolution IS NULL
          AND sync_batch_id IS NOT DISTINCT FROM $2
          AND ${side === 'ship' ? 'ship_changed_at' : 'shore_changed_at'} IS NOT DISTINCT FROM $3
          AND field_name IN ('spareCategory','optimumQty','spare_category','optimum_qty') ORDER BY id FOR UPDATE`,
        [conflict.row_uuid, conflict.sync_batch_id, side === 'ship' ? conflict.ship_changed_at : conflict.shore_changed_at]);
    if (!open.rows.length) throw Object.assign(new Error('Conflict is already resolved.'), { statusCode: 409 });
    const patch: any = {};
    for (const field of open.rows) {
      const key = /category/i.test(field.field_name) ? 'spare_category' : 'optimum_qty';
      patch[key] = incoming ? (source === 'log' ? field.incoming_new_value : field[`${side}_value`]) : saved[key];
    }
    const pair = await validateIncomingSparePair(client, patch, saved);
    if (incoming) {
      await client.query('UPDATE spares SET spare_category=$1,optimum_qty=$2,updated_at=NOW() WHERE suuid=$3',
        [pair.spareCategory, pair.optimumQty, conflict.row_uuid]);
    }
    const instanceId = await initFieldLoggerInstanceId();
    const resolutionTime = new Date();
    // Full authoritative pair, including unchanged members, uses the existing
    // resolution actor so the other installation force-applies and closes mirrors.
    for (const key of ['spare_category', 'optimum_qty'] as const) {
      const value = key === 'spare_category' ? pair.spareCategory : pair.optimumQty;
      await client.query(`INSERT INTO sync_field_log
        (table_name,row_uuid,field_name,old_value,new_value,vessel_id,changed_by_user_id,changed_by_display,
         instance_id,is_synced,is_sync,changed_at)
        VALUES('spares',$1,$2,$3,$4,$5,$6,$7,$8,false,false,$9)`,
        [conflict.row_uuid, key, saved[key] == null ? null : String(saved[key]),
          value == null ? null : String(value), saved.vessel_id, RESOLUTION_ACTOR, userId, instanceId, resolutionTime]);
    }
    for (const field of open.rows) {
      const col = /category/i.test(field.field_name) ? 'spare_category' : 'optimum_qty';
      const value = col === 'spare_category' ? pair.spareCategory : pair.optimumQty;
      // Existing propagation mechanism; clearing is an explicit NULL value.
      if (source === 'log') {
        await client.query(`UPDATE ${table} SET is_resolved=true,resolved_at=NOW(),resolved_by=$1,resolved_action=$2 WHERE id=$3`,
          [userId, incoming ? 'apply_incoming' : 'keep_current', field.id]);
      } else {
        await client.query(`UPDATE ${table} SET resolution=$1,resolved_value=$2,resolved_at=NOW(),resolved_by=$3 WHERE id=$4`,
          [incoming ? `${side}_wins` : (side === 'ship' ? 'shore_wins' : 'ship_wins'), value, userId, field.id]);
      }
    }
    await client.query('COMMIT');
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (!error.statusCode) error.statusCode = 400;
    throw error;
  } finally { client.release(); }
}
