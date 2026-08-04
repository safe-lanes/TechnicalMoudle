/**
 * Catalogue push ledger (Stage 3, plan §4) — raw SQL over shipskart_catalogue_links
 * (mig 152; NO_SYNC by omission, absent from schema.ts like the mig-149 link tables).
 *
 * Contract with the pusher (Stage C):
 *  - ensurePending() before each push attempt (idempotent upsert; never downgrades
 *    'pushed' back to 'pending' — a re-run must not re-push delivered entities)
 *  - markPushed() on success OR on their duplicate answer (their catalogue is ours
 *    alone, so "already exists" IS our earlier push)
 *  - markFailed() with the error text; re-runs retry failures automatically
 */
import { getPool } from '../../../db';

export type CatalogueEntityType = 'category' | 'product' | 'sku' | 'catalogue';
export type CataloguePushStatus = 'pending' | 'pushed' | 'failed';

export interface CatalogueLink {
  id: number;
  entityType: CatalogueEntityType;
  localKey: string;
  vesselId: string | null;
  remoteCode: string | null;
  remoteId: string | null;
  pushStatus: CataloguePushStatus;
  lastError: string | null;
  pushedAt: Date | null;
}

async function pool() {
  const p = await getPool();
  if (!p) throw Object.assign(new Error('Database not initialized'), { statusCode: 503 });
  return p;
}

function rowToLink(r: any): CatalogueLink {
  return {
    id: r.id, entityType: r.entity_type, localKey: r.local_key, vesselId: r.vessel_id,
    remoteCode: r.remote_code, remoteId: r.remote_id, pushStatus: r.push_status,
    lastError: r.last_error, pushedAt: r.pushed_at,
  };
}

/** Idempotent upsert to 'pending'. NEVER downgrades an existing 'pushed' row. */
export async function ensurePending(
  entityType: CatalogueEntityType, localKey: string, vesselId: string | null, remoteCode?: string,
): Promise<CatalogueLink> {
  const p = await pool();
  // Two-step (select→insert) instead of ON CONFLICT because the uniqueness lives in two
  // partial indexes (NULL vessel_id normalisation) which ON CONFLICT cannot target as one.
  const existing = await p.query(
    `SELECT * FROM shipskart_catalogue_links
      WHERE entity_type=$1 AND local_key=$2 AND vessel_id IS NOT DISTINCT FROM $3`,
    [entityType, localKey, vesselId],
  );
  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    if (remoteCode && row.remote_code !== remoteCode) {
      await p.query(`UPDATE shipskart_catalogue_links SET remote_code=$2, updated_at=now() WHERE id=$1`, [row.id, remoteCode]);
      row.remote_code = remoteCode;
    }
    return rowToLink(row);
  }
  const ins = await p.query(
    `INSERT INTO shipskart_catalogue_links (entity_type, local_key, vessel_id, remote_code)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [entityType, localKey, vesselId, remoteCode ?? null],
  );
  return rowToLink(ins.rows[0]);
}

export async function markPushed(id: number, remoteId?: string | null): Promise<void> {
  const p = await pool();
  await p.query(
    `UPDATE shipskart_catalogue_links
        SET push_status='pushed', last_error=NULL, pushed_at=now(), updated_at=now(),
            remote_id = COALESCE($2, remote_id)
      WHERE id=$1`,
    [id, remoteId ?? null],
  );
}

/** 'pushed' but with a preserved warning in last_error (e.g. category NAME-MISMATCH). */
export async function markPushedWithWarning(id: number, remoteId: string | null, warning: string): Promise<void> {
  const p = await pool();
  await p.query(
    `UPDATE shipskart_catalogue_links
        SET push_status='pushed', last_error=$3, pushed_at=now(), updated_at=now(),
            remote_id = COALESCE($2, remote_id)
      WHERE id=$1`,
    [id, remoteId, String(warning).slice(0, 500)],
  );
}

export async function markFailed(id: number, error: string): Promise<void> {
  const p = await pool();
  await p.query(
    `UPDATE shipskart_catalogue_links
        SET push_status='failed', last_error=$2, updated_at=now()
      WHERE id=$1`,
    [id, String(error).slice(0, 500)],
  );
}

/** Push-state lookup for a batch of local keys (the pusher's skip-pushed check). */
export async function getStatusMap(
  entityType: CatalogueEntityType, vesselId: string | null, localKeys: string[],
): Promise<Map<string, CatalogueLink>> {
  if (localKeys.length === 0) return new Map();
  const p = await pool();
  const r = await p.query(
    `SELECT * FROM shipskart_catalogue_links
      WHERE entity_type=$1 AND vessel_id IS NOT DISTINCT FROM $2 AND local_key = ANY($3)`,
    [entityType, vesselId, localKeys],
  );
  return new Map(r.rows.map((row: any) => [row.local_key, rowToLink(row)]));
}

/**
 * SKU COLLISION GUARD (mapper contract): is this skuCode already pushed/attempted under
 * a DIFFERENT vessel? Complete locally — we are the tenant catalogue's only writer.
 */
export async function findSkuCodeOtherVessel(skuCode: string, vesselId: string): Promise<CatalogueLink | null> {
  const p = await pool();
  const r = await p.query(
    `SELECT * FROM shipskart_catalogue_links
      WHERE entity_type='sku' AND remote_code=$1 AND vessel_id IS DISTINCT FROM $2
      LIMIT 1`,
    [skuCode, vesselId],
  );
  return r.rows.length ? rowToLink(r.rows[0]) : null;
}

/** Per-vessel/per-entity counts for the status console. */
export async function statusSummary(): Promise<any[]> {
  const p = await pool();
  const r = await p.query(
    `SELECT l.vessel_id, v.name AS vessel_name, l.entity_type, l.push_status,
            count(*)::int AS n, max(l.updated_at) AS last_activity
       FROM shipskart_catalogue_links l
       LEFT JOIN vessels v ON v.vuuid = l.vessel_id
      GROUP BY l.vessel_id, v.name, l.entity_type, l.push_status
      ORDER BY v.name NULLS FIRST, l.entity_type, l.push_status`,
  );
  return r.rows;
}

/** Recent failures with errors, for the console. */
export async function recentFailures(limit = 20): Promise<any[]> {
  const p = await pool();
  const r = await p.query(
    `SELECT entity_type, local_key, vessel_id, remote_code, last_error, updated_at
       FROM shipskart_catalogue_links
      WHERE push_status='failed'
      ORDER BY updated_at DESC LIMIT $1`,
    [limit],
  );
  return r.rows;
}
