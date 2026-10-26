import { mergeSpareClassification } from '@shared/spareClassification';
import { evaluateInsertOriginGuard, evaluateStaleSkipGuard } from './oneWayApplier';
import { RESOLUTION_ACTOR } from './dualCompletionResolver';

export const isSparePairLog = (log: any) => log.tableName === 'spares' &&
  ['spareCategory', 'optimumQty', 'spare_category', 'optimum_qty'].includes(log.fieldName);

export function classificationPatch(row: Record<string, any>) {
  const patch: Record<string, any> = {};
  if (Object.hasOwn(row, 'spare_category')) patch.spareCategory = row.spare_category;
  else if (Object.hasOwn(row, 'spareCategory')) patch.spareCategory = row.spareCategory;
  if (Object.hasOwn(row, 'optimum_qty')) patch.optimumQty = row.optimum_qty;
  else if (Object.hasOwn(row, 'optimumQty')) patch.optimumQty = row.optimumQty;
  return patch;
}

export async function validateIncomingSparePair(conn: any, row: Record<string, any>, saved?: any) {
  const pair = mergeSpareClassification(saved ? {
    spareCategory: saved.spare_category, optimumQty: saved.optimum_qty,
  } : undefined, classificationPatch(row));
  // Validate identities against the local registry before applying a new key.
  if (pair.spareCategory && pair.spareCategory !== saved?.spare_category) {
    const found = await conn.query(
      `SELECT 1 FROM master_lists WHERE list_type = 'spareCategory' AND list_key = $1 AND is_deleted IS NOT TRUE`,
      [pair.spareCategory],
    );
    if (!found.rows.length) throw new Error(`Unknown Spare Category '${pair.spareCategory}'; synchronize Master Lists first.`);
  }
  return pair;
}

/**
 * Apply classification fragments as one pair per row, in existing receive transactions.
 * A stale half holds BOTH halves for Conflict Resolve. Invalid/missing-schema pairs
 * remain unacknowledged for retry. Incoming writes deliberately create no local logs.
 */
export async function applySparePairLogs(conn: any, logs: any[], instanceId: string, batchUuid: string) {
  const groups = new Map<string, any[]>();
  for (const log of logs.filter(isSparePairLog)) {
    // Never assemble a pair from different edits or different sending installations.
    const key = JSON.stringify([log.rowUuid, new Date(log.changedAt).getTime(), log.instanceId]);
    const group = groups.get(key) || [];
    group.push(log);
    groups.set(key, group);
  }
  const failedRows = new Set<string>();
  const errors: string[] = [];
  let applied = 0;
  let index = 0;
  for (const group of Array.from(groups.values()).sort((a, b) =>
    new Date(a[0].changedAt).getTime() - new Date(b[0].changedAt).getTime())) {
    const uuid = group[0].rowUuid;
    const sp = `spare_pair_${index++}`;
    await conn.query(`SAVEPOINT ${sp}`);
    try {
      const current = await conn.query('SELECT * FROM spares WHERE suuid = $1 FOR UPDATE', [uuid]);
      const saved = current.rows[0];
      if (!saved) throw new Error(`Spare ${uuid} missing on receiver; classification kept pending.`);
      if (group.some(l => l.vesselId && l.vesselId !== saved.vessel_id)) {
        throw new Error('Spare classification vessel scope does not match canonical spare identity.');
      }
      group.sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
      const patch: any = {};
      const resolution = group.every(log => log.changedByUserId === RESOLUTION_ACTOR);
      if (resolution && !['spare_category', 'optimum_qty'].every(column =>
          group.some(log => (/category/i.test(log.fieldName) ? 'spare_category' : 'optimum_qty') === column))) {
        throw new Error('Classification resolution requires the complete category/quantity pair; keep pending.');
      }
      const pairLocal = resolution ? { rows: [] } : await conn.query(
        `SELECT field_name FROM sync_field_log WHERE table_name='spares' AND row_uuid=$1
          AND field_name IN ('spareCategory','optimumQty','spare_category','optimum_qty')
          AND instance_id=$2 AND changed_at>$3 LIMIT 1`,
        [uuid, instanceId, group[0].changedAt]);
      let held = pairLocal.rows.length > 0;
      for (const log of group) {
        const guarded = { ...log, changedAt: new Date(log.changedAt) };
        const decision = resolution ? { skip: false } : log.oldValue == null
          ? await evaluateInsertOriginGuard(conn, log)
          : await evaluateStaleSkipGuard(conn, guarded, instanceId, { batchUuid });
        // An identical duplicate is harmless even if the creation guard skips it.
        const col = /category/i.test(log.fieldName) ? 'spare_category' : 'optimum_qty';
        if (decision.skip && String(saved[col] ?? '') !== String(log.newValue ?? '')) held = true;
        patch[col] = log.newValue;
      }
      if (!held) {
        const pair = await validateIncomingSparePair(conn, patch, saved);
        const latest = group[group.length - 1];
        await conn.query(
          'UPDATE spares SET spare_category = $1, optimum_qty = $2, updated_at = $3 WHERE suuid = $4 AND vessel_id IS NOT DISTINCT FROM $5',
          [pair.spareCategory, pair.optimumQty, latest.changedAt, uuid, saved.vessel_id],
        );
        if (resolution) {
          await conn.query(`UPDATE sync_conflict_log SET is_resolved=true,resolved_at=NOW(),
            resolved_by=$1,resolved_action='REMOTE_RESOLUTION' WHERE table_name='spares' AND row_uuid=$2
            AND is_resolved=false AND field_name IN ('spareCategory','optimumQty','spare_category','optimum_qty')`,
            [RESOLUTION_ACTOR, uuid]);
          await conn.query(`UPDATE sync_conflicts SET resolution='remote_resolution',resolved_at=NOW(),
            resolved_by=$1,updated_at=NOW(),resolved_value=CASE WHEN field_name IN ('spareCategory','spare_category') THEN $3 ELSE $4 END
            WHERE table_name='spares' AND row_uuid=$2 AND resolution IS NULL
            AND field_name IN ('spareCategory','optimumQty','spare_category','optimum_qty')`,
            [RESOLUTION_ACTOR, uuid, pair.spareCategory, pair.optimumQty == null ? null : String(pair.optimumQty)]);
        }
        applied += group.length;
      } else {
        // Keep the companion visible too, so choosing incoming can resolve a valid
        // whole pair rather than forcing an impossible sequence of invalid halves.
        for (const log of group) {
          const col = /category/i.test(log.fieldName) ? 'spare_category' : 'optimum_qty';
          await conn.query(
            `INSERT INTO sync_conflict_log
              (batch_uuid,table_name,row_uuid,field_name,incoming_sender_instance,incoming_changed_at,
               incoming_old_value,incoming_new_value,receiver_winner_instance,receiver_winner_changed_at,receiver_current_value)
             SELECT $1,'spares',$2,$3,$4,$5,$6,$7,$8,NOW(),$9
             WHERE NOT EXISTS (SELECT 1 FROM sync_conflict_log WHERE table_name='spares' AND row_uuid=$2
               AND field_name=$3 AND incoming_changed_at=$5 AND is_resolved=false)`,
            [batchUuid, uuid, log.fieldName, log.instanceId, log.changedAt, log.oldValue, log.newValue,
              instanceId, saved[col] == null ? null : String(saved[col])],
          );
        }
      }
      await conn.query(`RELEASE SAVEPOINT ${sp}`);
    } catch (error: any) {
      await conn.query(`ROLLBACK TO SAVEPOINT ${sp}`);
      await conn.query(`RELEASE SAVEPOINT ${sp}`);
      failedRows.add(uuid);
      errors.push(`spares.${uuid}: ${error.message}`);
    }
  }
  return { failedRows, errors, applied };
}

// Preserve the incoming branch's event-level APIs on the same pair-safe implementation.
export const isSpareClassificationLog = isSparePairLog;
export function classificationEvent(log: any, logs: any[]) {
  return logs.filter(other => isSparePairLog(other) && other.rowUuid === log.rowUuid &&
    new Date(other.changedAt).getTime() === new Date(log.changedAt).getTime() && other.instanceId === log.instanceId);
}
export async function applyClassificationEvent(
  conn: any, log: any, logs: any[], receiver: string, batchUuid: string, _staleGuard?: any,
) {
  if (!isSparePairLog(log)) return false;
  const event = classificationEvent(log, logs);
  if (event[0] !== log) return true;
  const result = await applySparePairLogs(conn, event, receiver, batchUuid);
  if (result.errors.length) throw new Error(result.errors.join('; '));
  return true;
}
export async function resolveClassificationConflict(pool: any, conflict: any, userId: string, incoming: boolean) {
  const { resolveSparePairConflict } = await import('./spareClassificationConflict');
  return resolveSparePairConflict(pool, conflict, 'log', userId, incoming);
}
export async function validateFullRowClassification(conn: any, table: string, incoming: any, saved?: any) {
  const { hasClassification } = await import('@shared/spareClassification');
  if (!['spares', 'fleet_spares'].includes(table) || !hasClassification(incoming)) return;
  const result = await conn.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public'
    AND table_name=$1 AND column_name IN ('spare_category','optimum_qty')`, [table]);
  if (result.rows.length !== 2) throw new Error(`Retryable classification schema missing on ${table}; run migration 184.`);
  await validateIncomingSparePair(conn, incoming, saved);
}
