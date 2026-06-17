/**
 * Retention & Disposition service (Audit Phase 4).
 *
 * Records-management model:
 *   - The configured period is a MINIMUM keep-time, NOT an auto-delete timer.
 *   - Business/audit categories NEVER auto-delete. Only sync-scratch auto-prunes (pruningService).
 *   - When records pass their minimum they become ELIGIBLE; an admin makes a logged disposition
 *     decision. "Dispose" = reversible SOFT-dispose (set disposed_at, keep the row). "Revert"
 *     restores. No physical deletion of business records anywhere in this module.
 *   - Protected categories enforce a HARD FLOOR (cannot be set below the committed minimum).
 */
import { getPool } from '../../db';
import { storage } from '../../storage';

export interface RetentionSettingRow {
  id: number;
  category: string;
  label: string;
  retentionValue: number;
  retentionUnit: string;
  enabled: boolean;
  isProtected: boolean;
  minValue: number;
  minUnit: string;
  description: string | null;
  updatedAt: string;
  updatedByUuid: string | null;
}

interface CategoryTarget {
  table: 'audit_log' | 'component_maintenance_history' | 'work_order_postponements';
  ageColumn: string;
  entityTypes?: string[];      // entity_type = ANY(...)
  entityTypesNotIn?: string[]; // entity_type <> ALL(...)
}

// Which physical rows each disposition category governs. running_hours_history (forever) and
// sync_logs (auto-prune only) are intentionally absent — they have no disposition flow.
const CATEGORY_TARGETS: Record<string, CategoryTarget[]> = {
  maintenance: [
    { table: 'audit_log', ageColumn: 'timestamp', entityTypes: ['work_order'] },
    { table: 'component_maintenance_history', ageColumn: 'created_at' },
  ],
  approval: [
    { table: 'work_order_postponements', ageColumn: 'created_at' },
  ],
  audit_general: [
    { table: 'audit_log', ageColumn: 'timestamp', entityTypesNotIn: ['work_order', 'role_permission', 'rank', 'retention_setting', 'retention_disposition'] },
  ],
  user_access: [
    { table: 'audit_log', ageColumn: 'timestamp', entityTypes: ['role_permission', 'rank', 'retention_setting', 'retention_disposition'] },
  ],
};

const VALID_UNITS = ['days', 'months', 'years', 'forever'];

export function periodToDays(value: number, unit: string): number | null {
  if (unit === 'forever') return null;
  if (unit === 'days') return value;
  // Average month length so 12 months === 365 days (avoids being shorter than a 1-year threshold).
  if (unit === 'months') return Math.round(value * 30.44);
  if (unit === 'years') return value * 365;
  return null;
}

function rowToSetting(r: any): RetentionSettingRow {
  return {
    id: r.id, category: r.category, label: r.label,
    retentionValue: r.retention_value, retentionUnit: r.retention_unit,
    enabled: r.enabled, isProtected: r.is_protected,
    minValue: r.min_value, minUnit: r.min_unit,
    description: r.description,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    updatedByUuid: r.updated_by_uuid,
  };
}

export async function getAllSettings(): Promise<RetentionSettingRow[]> {
  const pool = await getPool();
  const r = await pool.query('SELECT * FROM retention_settings ORDER BY id');
  return r.rows.map(rowToSetting);
}

async function getSetting(category: string): Promise<RetentionSettingRow | null> {
  const pool = await getPool();
  const r = await pool.query('SELECT * FROM retention_settings WHERE category = $1 LIMIT 1', [category]);
  return r.rows[0] ? rowToSetting(r.rows[0]) : null;
}

/** Build the WHERE fragment + params for "rows in this target older than `days`, not yet disposed". */
function buildEligibleWhere(t: CategoryTarget, days: number, startIdx: number): { sql: string; params: any[] } {
  const params: any[] = [];
  const conds: string[] = ['disposed_at IS NULL', `${t.ageColumn} < NOW() - INTERVAL '1 day' * $${startIdx + params.push(days)}`];
  if (t.entityTypes) conds.push(`entity_type = ANY($${startIdx + params.push(t.entityTypes)})`);
  if (t.entityTypesNotIn) conds.push(`entity_type <> ALL($${startIdx + params.push(t.entityTypesNotIn)})`);
  return { sql: conds.join(' AND '), params };
}

/** Count records past the configured minimum (eligible for disposal review), per category. */
export async function getEligibility(): Promise<Record<string, { eligible: number; disposed: number }>> {
  const pool = await getPool();
  const settings = await getAllSettings();
  const out: Record<string, { eligible: number; disposed: number }> = {};
  for (const s of settings) {
    const targets = CATEGORY_TARGETS[s.category];
    if (!targets) { out[s.category] = { eligible: 0, disposed: 0 }; continue; }
    const days = periodToDays(s.retentionValue, s.retentionUnit);
    let eligible = 0, disposed = 0;
    for (const t of targets) {
      if (days !== null && s.enabled) {
        const w = buildEligibleWhere(t, days, 0);
        const er = await pool.query(`SELECT count(*)::int n FROM ${t.table} WHERE ${w.sql}`, w.params);
        eligible += Number(er.rows[0]?.n ?? 0);
      }
      const dParams: any[] = [];
      let dWhere = 'disposed_at IS NOT NULL';
      if (t.entityTypes) dWhere += ` AND entity_type = ANY($${dParams.push(t.entityTypes)})`;
      else if (t.entityTypesNotIn) dWhere += ` AND entity_type <> ALL($${dParams.push(t.entityTypesNotIn)})`;
      const dr = await pool.query(`SELECT count(*)::int n FROM ${t.table} WHERE ${dWhere}`, dParams);
      disposed += Number(dr.rows[0]?.n ?? 0);
    }
    out[s.category] = { eligible, disposed };
  }
  return out;
}

export class RetentionError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) { super(message); this.statusCode = statusCode; }
}

/** Update a category's period/unit/enabled. Hard floor on protected categories. Audited. */
export async function updateSetting(
  category: string,
  patch: { retentionValue?: number; retentionUnit?: string; enabled?: boolean },
  actorUuid: string | null,
): Promise<RetentionSettingRow> {
  const existing = await getSetting(category);
  if (!existing) throw new RetentionError(`Unknown retention category: ${category}`, 404);

  const newValue = patch.retentionValue ?? existing.retentionValue;
  const newUnit = patch.retentionUnit ?? existing.retentionUnit;
  const newEnabled = patch.enabled ?? existing.enabled;

  if (!VALID_UNITS.includes(newUnit)) throw new RetentionError(`Invalid unit: ${newUnit}`);
  if (newUnit !== 'forever' && (!Number.isInteger(newValue) || newValue < 0)) {
    throw new RetentionError('Retention value must be a non-negative integer');
  }

  // HARD FLOOR — protected categories cannot go below the committed minimum.
  if (existing.isProtected && newUnit !== 'forever') {
    const minDays = periodToDays(existing.minValue, existing.minUnit);
    const newDays = periodToDays(newValue, newUnit);
    if (minDays !== null && newDays !== null && newDays < minDays) {
      throw new RetentionError(
        `'${existing.label}' is a protected category — its retention cannot be set below the committed minimum of ${existing.minValue} ${existing.minUnit}.`,
      );
    }
  }

  const pool = await getPool();
  await pool.query(
    `UPDATE retention_settings SET retention_value=$1, retention_unit=$2, enabled=$3, updated_at=NOW(), updated_by_uuid=$4 WHERE category=$5`,
    [newValue, newUnit, newEnabled, actorUuid, category],
  );

  await safeAudit({
    actionType: 'retention_change',
    entityType: 'retention_setting',
    entityId: category,
    payload: {
      subject: { category, label: existing.label },
      from: { value: existing.retentionValue, unit: existing.retentionUnit, enabled: existing.enabled },
      to: { value: newValue, unit: newUnit, enabled: newEnabled },
    },
  });

  return (await getSetting(category))!;
}

/** Soft-dispose: mark past-minimum, not-yet-disposed rows as disposed. Reversible. Audited. */
export async function dispose(category: string, actorUuid: string | null): Promise<{ count: number }> {
  const setting = await getSetting(category);
  if (!setting) throw new RetentionError(`Unknown retention category: ${category}`, 404);
  const targets = CATEGORY_TARGETS[category];
  if (!targets) throw new RetentionError(`Category '${category}' has no disposition flow (forever / auto-prune).`);
  const days = periodToDays(setting.retentionValue, setting.retentionUnit);
  if (days === null) throw new RetentionError(`Category '${setting.label}' is retained forever and cannot be disposed.`);

  const pool = await getPool();
  let count = 0;
  for (const t of targets) {
    // The WHERE clause enforces "past minimum only" — records within period can never be disposed.
    const w = buildEligibleWhere(t, days, 1); // $1 reserved for disposed_by_uuid
    const res = await pool.query(
      `UPDATE ${t.table} SET disposed_at = NOW(), disposed_by_uuid = $1 WHERE ${w.sql}`,
      [actorUuid, ...w.params],
    );
    count += res.rowCount ?? 0;
  }

  await safeAudit({
    actionType: 'dispose',
    entityType: 'retention_disposition',
    entityId: category,
    payload: { subject: { category, label: setting.label }, decision: 'dispose', count, periodAtDecision: `${setting.retentionValue} ${setting.retentionUnit}` },
  });
  return { count };
}

/** Log a Retain decision (no row change). Audited. */
export async function retain(category: string, _actorUuid: string | null): Promise<{ ok: true }> {
  const setting = await getSetting(category);
  if (!setting) throw new RetentionError(`Unknown retention category: ${category}`, 404);
  await safeAudit({
    actionType: 'retain',
    entityType: 'retention_disposition',
    entityId: category,
    payload: { subject: { category, label: setting.label }, decision: 'retain', periodAtDecision: `${setting.retentionValue} ${setting.retentionUnit}` },
  });
  return { ok: true };
}

/** Revert: restore previously soft-disposed rows in a category. Audited. */
export async function revert(category: string, _actorUuid: string | null): Promise<{ count: number }> {
  const setting = await getSetting(category);
  if (!setting) throw new RetentionError(`Unknown retention category: ${category}`, 404);
  const targets = CATEGORY_TARGETS[category];
  if (!targets) throw new RetentionError(`Category '${category}' has no disposition flow.`);

  const pool = await getPool();
  let count = 0;
  for (const t of targets) {
    const params: any[] = [];
    let where = 'disposed_at IS NOT NULL';
    if (t.entityTypes) where += ` AND entity_type = ANY($${params.push(t.entityTypes)})`;
    else if (t.entityTypesNotIn) where += ` AND entity_type <> ALL($${params.push(t.entityTypesNotIn)})`;
    const res = await pool.query(`UPDATE ${t.table} SET disposed_at = NULL, disposed_by_uuid = NULL WHERE ${where}`, params);
    count += res.rowCount ?? 0;
  }

  await safeAudit({
    actionType: 'revert',
    entityType: 'retention_disposition',
    entityId: category,
    payload: { subject: { category, label: setting.label }, decision: 'revert', count },
  });
  return { count };
}

async function safeAudit(data: { actionType: string; entityType: string; entityId: string; payload: any }): Promise<void> {
  try {
    await storage.createAuditLog({
      entityType: data.entityType,
      entityId: data.entityId,
      actionType: data.actionType,
      source: 'web_ui',
      vesselCode: null,
      componentCode: null,
      payload: data.payload,
    });
  } catch (e: any) {
    console.error(`[Audit] retention ${data.actionType} log failed:`, e?.message);
  }
}
