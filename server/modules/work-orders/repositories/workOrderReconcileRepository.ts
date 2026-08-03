/**
 * WO reconciler — DB access. All SQL for the reconciler lives here (plan §9.3–9.6);
 * the SERVICE owns the rules and every logFieldChanges call. Raw SQL (not Drizzle)
 * because work_order_reconcile_archive is deliberately absent from shared/schema.ts —
 * NO_SYNC bookkeeping, same pattern as the Shipskart link tables.
 */
import { randomUUID } from 'crypto';
import { getPool } from '../../../db';

async function pool() {
  const p = await getPool();
  if (!p) throw Object.assign(new Error('Database not initialized'), { statusCode: 503 });
  return p;
}

export interface DuplicateGroup {
  vesselId: string;
  workOrderNo: string;
  rows: any[]; // full work_orders rows, ascending created_at
}

/** Duplicate (vessel, number) groups over live rows. Cap bounds one run's work. */
export async function findDuplicateGroups(vesselId: string, cap: number): Promise<DuplicateGroup[]> {
  const p = await pool();
  const groups = await p.query(
    `SELECT work_order_no
       FROM work_orders
      WHERE vessel_id = $1 AND data_scope = 'vessel' AND is_deleted = false
      GROUP BY work_order_no
     HAVING count(*) > 1
      ORDER BY work_order_no
      LIMIT $2`,
    [vesselId, cap],
  );
  const out: DuplicateGroup[] = [];
  for (const g of groups.rows) {
    const rows = await p.query(
      `SELECT * FROM work_orders
        WHERE vessel_id = $1 AND work_order_no = $2 AND data_scope = 'vessel' AND is_deleted = false
        ORDER BY created_at ASC`,
      [vesselId, g.work_order_no],
    );
    out.push({ vesselId, workOrderNo: g.work_order_no, rows: rows.rows });
  }
  return out;
}

/** Count of remaining duplicate groups (for the "more next run" log line). */
export async function countDuplicateGroups(vesselId: string): Promise<number> {
  const p = await pool();
  const r = await p.query(
    `SELECT count(*)::int AS n FROM (
       SELECT 1 FROM work_orders
        WHERE vessel_id = $1 AND data_scope = 'vessel' AND is_deleted = false
        GROUP BY work_order_no HAVING count(*) > 1) t`,
    [vesselId],
  );
  return r.rows[0]?.n ?? 0;
}

/**
 * Origin instance id of a WO row = instance_id on its earliest INSERT-origin field log
 * (old_value IS NULL). Plan §9.1 — proven on the pilot 2026-08-03. Null when the logs
 * are absent (pruned / pre-dates logging): caller falls back to created_at order.
 */
export async function getInsertOriginInstanceId(wouuid: string): Promise<string | null> {
  const p = await pool();
  const r = await p.query(
    `SELECT instance_id
       FROM sync_field_log
      WHERE table_name = 'work_orders' AND row_uuid = $1
        AND old_value IS NULL AND is_deleted = false
      ORDER BY changed_at ASC
      LIMIT 1`,
    [wouuid],
  );
  return r.rows[0]?.instance_id ?? null;
}

/** The vessel's ship instance ids (any row in sync_metadata = a ship instance; plan §4). */
export async function getShipInstanceIds(vesselId: string): Promise<Set<string>> {
  const p = await pool();
  const r = await p.query(
    `SELECT instance_id FROM sync_metadata WHERE vessel_id = $1 AND is_deleted = false`,
    [vesselId],
  );
  return new Set(r.rows.map((x: any) => x.instance_id));
}

/** Does the WO have live attached documents? (part of the "touched" test) */
export async function hasDocuments(wouuid: string): Promise<boolean> {
  const p = await pool();
  const r = await p.query(
    `SELECT 1 FROM work_order_documents WHERE work_order_id = $1 AND is_deleted = false LIMIT 1`,
    [wouuid],
  );
  return r.rows.length > 0;
}

/** Repoint one child table loser→survivor. Returns the moved rows' log identities. */
export async function repointChildren(
  table: string,
  fkColumn: string,
  idColumn: string,
  loserWouuid: string,
  survivorWouuid: string,
): Promise<string[]> {
  const p = await pool();
  const r = await p.query(
    `UPDATE "${table}" SET "${fkColumn}" = $1, updated_at = now()
      WHERE "${fkColumn}" = $2 AND is_deleted = false
      RETURNING "${idColumn}" AS log_id`,
    [survivorWouuid, loserWouuid],
  );
  return r.rows.map((x: any) => String(x.log_id));
}

/** Left-in-place child rows (ihm §9.4, immutable history) — counted for the archive only. */
export async function countChildRows(table: string, fkColumn: string, loserWouuid: string): Promise<number> {
  const p = await pool();
  const r = await p.query(
    `SELECT count(*)::int AS n FROM "${table}" WHERE "${fkColumn}" = $1 AND is_deleted = false`,
    [loserWouuid],
  );
  return r.rows[0]?.n ?? 0;
}

/** Soft-delete the losing WO. The SERVICE writes the field log for this flip. */
export async function softDeleteWorkOrder(wouuid: string): Promise<void> {
  const p = await pool();
  await p.query(`UPDATE work_orders SET is_deleted = true, updated_at = now() WHERE wouuid = $1`, [wouuid]);
}

export async function insertArchiveRow(row: {
  vesselId: string;
  workOrderNo: string;
  loserWouuid: string;
  survivorWouuid: string;
  resolutionCase: 1 | 2 | 3;
  loserRowSnapshot: any;
  childMoves: any;
  notes: string | null;
}): Promise<boolean> {
  const p = await pool();
  const r = await p.query(
    `INSERT INTO work_order_reconcile_archive
       (archive_uuid, vessel_id, work_order_no, loser_wouuid, survivor_wouuid,
        resolution_case, loser_row_snapshot, child_moves, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (loser_wouuid) DO NOTHING`,
    [randomUUID(), row.vesselId, row.workOrderNo, row.loserWouuid, row.survivorWouuid,
     row.resolutionCase, JSON.stringify(row.loserRowSnapshot), JSON.stringify(row.childMoves), row.notes],
  );
  return (r.rowCount ?? 0) > 0;
}

/** Archive aggregates for the status endpoint. */
export async function archiveSummary(): Promise<any[]> {
  const p = await pool();
  const r = await p.query(
    `SELECT a.vessel_id, v.name AS vessel_name, a.resolution_case, count(*)::int AS resolved,
            max(a.reconciled_at) AS last_reconciled_at
       FROM work_order_reconcile_archive a
       LEFT JOIN vessels v ON v.vuuid = a.vessel_id
      GROUP BY a.vessel_id, v.name, a.resolution_case
      ORDER BY v.name, a.resolution_case`,
  );
  return r.rows;
}

/** Provisioned vessels = the dual-writer set the daily sweep covers (plan §9.7). */
export async function getProvisionedVesselIds(): Promise<string[]> {
  const p = await pool();
  const r = await p.query(
    `SELECT DISTINCT v.vuuid
       FROM vessels v
       JOIN sync_metadata sm ON sm.vessel_id = v.vuuid AND sm.is_deleted = false
      WHERE v.is_deleted = false`,
  );
  return r.rows.map((x: any) => x.vuuid);
}
