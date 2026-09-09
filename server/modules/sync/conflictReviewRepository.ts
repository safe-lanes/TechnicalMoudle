/**
 * Conflict Review Repository
 *
 * Provides unified query/action layer over TWO conflict tables:
 *   1. sync_conflict_log  — new per-field stale-skip rejections (migration 111)
 *   2. sync_conflicts     — older pull/resolve-phase conflicts (Drizzle-modeled)
 *
 * Both are combined into a single "enriched" shape for the Conflict Review UI.
 */

import { getPool } from '../../db';
import { SYNC_CONFIG, getIdentityColumn } from '../../../shared/syncConfig';
import { syncDiag } from './syncDiagLogger';
import { isShipInstanceId } from './syncRole';
import { RESOLUTION_ACTOR, DUAL_COMPLETION_KIND, findWouuidsWithOpenDualConflicts } from './dualCompletionResolver';

/**
 * Task #399: after a dual-completion conflict on a work order is resolved locally,
 * run completion learning for that WO (it was HELD OUT while the conflict was open
 * so job tracking wouldn't advance from an interim value). Shore-only, best-effort.
 */
async function runPostResolutionLearning(pool: any, wouuid: string): Promise<void> {
  const instanceId = process.env.SYNC_INSTANCE_ID || 'UNKNOWN';
  if (isShipInstanceId(instanceId)) return; // learner is shore-only
  // Only learn once the ENTIRE completion is settled — sibling field conflicts still
  // open mean the WO is still showing interim values.
  const stillOpen = await findWouuidsWithOpenDualConflicts(pool, [wouuid]);
  if (stillOpen.has(wouuid)) {
    syncDiag(`DUAL-COMPLETION POST-RESOLUTION LEARNING DEFERRED: wouuid=${wouuid} — sibling field conflicts still open`);
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL sync.bypass_trigger = 'true'`);
    const { learnFromShipCompletions } = await import('./shipCompletionLearner');
    await learnFromShipCompletions(client, [wouuid]);
    await client.query('COMMIT');
    syncDiag(`DUAL-COMPLETION POST-RESOLUTION LEARNING: wouuid=${wouuid}`);
  } catch (err: any) {
    try { await client.query('ROLLBACK'); } catch { /* non-fatal */ }
    syncDiag(`DUAL-COMPLETION POST-RESOLUTION LEARNING FAILED (non-fatal): wouuid=${wouuid}: ${String(err?.message || err).substring(0, 150)}`);
  } finally {
    client.release();
  }
}

// ── Types ──

export interface ConflictSide {
  value: string | null;
  changedAt: string | null;
  instanceId: string;
  userId: string | null;
  userName: string;
  locationLabel: string;
}

export interface EnrichedConflict {
  id: number;
  source: 'log' | 'old';
  detectedAt: string;
  batchUuid: string | null;
  tableName: string;
  tableDisplayName: string;
  rowUuid: string;
  recordDisplay: string;
  fieldName: string;
  fieldDisplayName: string;
  winner: ConflictSide;
  rejected: ConflictSide;
  isResolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolvedAction: string | null;
  /** 'dual_completion' when the same record was completed independently on both sides (Task #399). */
  conflictKind?: string | null;
}

export interface ConflictCount {
  total: number;
  fromLog: number;
  fromOld: number;
}

export interface ListConflictsFilters {
  resolved?: boolean;
  tableName?: string;
  vesselId?: string;
  dateFrom?: string;
  dateTo?: string;
  source?: 'log' | 'old' | 'all';
  limit?: number;
  offset?: number;
}

// ── Helpers ──

/** Human-readable table name */
function getTableDisplayName(tableName: string): string {
  const map: Record<string, string> = {
    work_orders: 'Work Orders',
    work_order_executions: 'WO Executions',
    work_order_documents: 'WO Documents',
    work_order_postponements: 'WO Postponements',
    defects: 'Defects',
    defect_actions: 'Defect Actions',
    defect_attachments: 'Defect Attachments',
    defect_sequences: 'Defect Sequences',
    spares: 'Spares',
    spares_history: 'Spares History',
    spare_location_stock: 'Spare Location Stock',
    stores_items: 'Stores Items',
    stores_ledger: 'Stores Ledger',
    inventory_transactions: 'Inventory Transactions',
    change_request: 'Change Requests',
    change_request_approval: 'CR Approvals',
    change_request_comment: 'CR Comments',
    running_hours_audit: 'Running Hours Audit',
    component_running_hours_log: 'Running Hours Log',
    component_maintenance_history: 'Maintenance History',
    vessel_certificate_data: 'Vessel Certificates',
    vessel_survey_data: 'Vessel Surveys',
    planner_dates: 'Planner Dates',
    components: 'Components',
    jobs: 'Jobs',
  };
  return map[tableName] || tableName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Human-readable field name from camelCase or snake_case */
export function getFieldDisplayName(fieldName: string): string {
  // Special acronyms
  const acronymMap: Record<string, string> = {
    rh: 'RH', rob: 'ROB', utc: 'UTC', tz: 'TZ', uuid: 'UUID',
    wo: 'WO', cr: 'CR', coc: 'CoC', id: 'ID', url: 'URL',
    html: 'HTML', sfi: 'SFI', viq: 'VIQ', pms: 'PMS',
  };

  // Normalize to space-separated words
  let words: string;
  if (fieldName.includes('_')) {
    words = fieldName; // already snake_case
  } else {
    // camelCase → space-separated
    words = fieldName
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  }

  return words
    .replace(/_/g, ' ')
    .split(' ')
    .map(w => {
      const lower = w.toLowerCase();
      if (acronymMap[lower]) return acronymMap[lower];
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/** Location label from instance ID */
export function getInstanceLabel(instanceId: string, vesselName?: string | null): string {
  if (!instanceId) return 'Unknown';
  if (isShipInstanceId(instanceId)) {
    return vesselName ? `Ship — ${vesselName}` : `Ship (${instanceId})`;
  }
  if (instanceId.toUpperCase().startsWith('SHORE')) {
    return 'Shore — Office';
  }
  return instanceId;
}

/** Fetch a display label for a specific record */
async function getRecordLabel(pool: any, tableName: string, rowUuid: string): Promise<string> {
  const labelConfigs: Record<string, { cols: string[]; format: (...vals: string[]) => string }> = {
    work_orders: {
      cols: ['job_title', 'component_code'],
      format: (a, b) => b ? `WO: ${a} (${b})` : `WO: ${a}`,
    },
    defects: {
      cols: ['id', 'description'],
      format: (a, b) => `Defect ${a}: ${(b || '').substring(0, 60)}`,
    },
    spares: {
      cols: ['part_name', 'part_code'],
      format: (a, b) => b ? `Spare: ${a} (${b})` : `Spare: ${a}`,
    },
    stores_items: {
      cols: ['item_name', 'item_code'],
      format: (a, b) => b ? `Store: ${a} (${b})` : `Store: ${a}`,
    },
    change_request: {
      cols: ['title'],
      format: (a) => `CR: ${a}`,
    },
    running_hours_audit: {
      cols: ['component_name', 'component_code'],
      format: (a, b) => b ? `RH: ${a} (${b})` : `RH: ${a}`,
    },
    work_order_executions: {
      cols: ['id'],
      format: (a) => `WO Exec: ${a}`,
    },
    work_order_documents: {
      cols: ['document_name'],
      format: (a) => `WO Doc: ${a}`,
    },
    defect_actions: {
      cols: ['action_description'],
      format: (a) => `Action: ${(a || '').substring(0, 60)}`,
    },
    vessel_certificate_data: {
      cols: ['certificate_name'],
      format: (a) => `Cert: ${a}`,
    },
    vessel_survey_data: {
      cols: ['survey_name'],
      format: (a) => `Survey: ${a}`,
    },
    components: {
      cols: ['component_name', 'component_code'],
      format: (a, b) => b ? `${a} (${b})` : `${a}`,
    },
    jobs: {
      cols: ['job_title', 'job_code'],
      format: (a, b) => b ? `${a} (${b})` : `${a}`,
    },
  };

  const config = labelConfigs[tableName];
  if (!config) return `${tableName} ${rowUuid.substring(0, 8)}`;

  const identityCol = getIdentityColumn(tableName) || 'id';
  const selectCols = config.cols.map(c => `"${c}"`).join(', ');

  try {
    const result = await pool.query(
      `SELECT ${selectCols} FROM "${tableName}" WHERE "${identityCol}" = $1 LIMIT 1`,
      [rowUuid]
    );
    if (result.rows.length === 0) return `${tableName} ${rowUuid.substring(0, 8)}`;
    const vals = config.cols.map(c => result.rows[0][c] ?? '');
    return config.format(...vals) || `${tableName} ${rowUuid.substring(0, 8)}`;
  } catch {
    return `${tableName} ${rowUuid.substring(0, 8)}`;
  }
}

/** Safely resolve user name from user ID. Returns "System" for non-numeric / unmatchable IDs. */
async function resolveUserName(pool: any, userId: string | null): Promise<string> {
  if (!userId || userId === 'system' || userId === 'System' || userId === 'admin') return 'System';
  const parsed = parseInt(userId, 10);
  if (isNaN(parsed)) return userId; // non-numeric string — return as-is
  try {
    const result = await pool.query(
      `SELECT full_name FROM users WHERE id = $1 LIMIT 1`,
      [parsed]
    );
    return result.rows[0]?.full_name || `User ${userId}`;
  } catch {
    return `User ${userId}`;
  }
}

// ── Core Functions ──

/**
 * 1.1 List conflicts — unified from both tables, paginated
 */
export async function listConflicts(filters: ListConflictsFilters): Promise<{ rows: EnrichedConflict[]; total: number }> {
  const pool = await getPool();
  const limit = Math.min(filters.limit || 50, 200);
  const offset = filters.offset || 0;
  const source = filters.source || 'all';
  const resolved = filters.resolved ?? false;

  const logRows: EnrichedConflict[] = [];
  const oldRows: EnrichedConflict[] = [];
  let totalLog = 0;
  let totalOld = 0;

  // ── Query sync_conflict_log (new) ──
  if (source === 'all' || source === 'log') {
    const conditions: string[] = [`cl.is_resolved = $1`];
    const params: any[] = [resolved];
    let paramIdx = 2;

    if (filters.tableName) {
      conditions.push(`cl.table_name = $${paramIdx++}`);
      params.push(filters.tableName);
    }
    if (filters.vesselId) {
      // Join via sync_field_log to get vessel_id
      conditions.push(`EXISTS (SELECT 1 FROM sync_field_log sfl WHERE sfl.table_name = cl.table_name AND sfl.row_uuid = cl.row_uuid AND sfl.vessel_id = $${paramIdx++} LIMIT 1)`);
      params.push(filters.vesselId);
    }
    if (filters.dateFrom) {
      conditions.push(`cl.detected_at >= $${paramIdx++}`);
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      conditions.push(`cl.detected_at <= $${paramIdx++}`);
      params.push(filters.dateTo);
    }

    const whereClause = conditions.join(' AND ');

    // Count
    const countResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM sync_conflict_log cl WHERE ${whereClause}`,
      params
    );
    totalLog = parseInt(countResult.rows[0].cnt, 10);

    // Fetch rows
    const dataResult = await pool.query(
      `SELECT cl.*
       FROM sync_conflict_log cl
       WHERE ${whereClause}
       ORDER BY cl.detected_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    // Enrich each row
    for (const row of dataResult.rows) {
      // Resolve user names from sync_field_log
      let incomingUserId: string | null = null;
      let winnerUserId: string | null = null;

      try {
        const incomingUser = await pool.query(
          `SELECT changed_by_user_id FROM sync_field_log
           WHERE table_name = $1 AND row_uuid = $2 AND field_name = $3
             AND instance_id = $4
           ORDER BY changed_at DESC LIMIT 1`,
          [row.table_name, row.row_uuid, row.field_name, row.incoming_sender_instance]
        );
        incomingUserId = incomingUser.rows[0]?.changed_by_user_id || null;
      } catch { /* best effort */ }

      try {
        const winnerUser = await pool.query(
          `SELECT changed_by_user_id FROM sync_field_log
           WHERE table_name = $1 AND row_uuid = $2 AND field_name = $3
             AND instance_id = $4
           ORDER BY changed_at DESC LIMIT 1`,
          [row.table_name, row.row_uuid, row.field_name, row.receiver_winner_instance]
        );
        winnerUserId = winnerUser.rows[0]?.changed_by_user_id || null;
      } catch { /* best effort */ }

      const recordDisplay = await getRecordLabel(pool, row.table_name, row.row_uuid);
      const incomingUserName = await resolveUserName(pool, incomingUserId);
      const winnerUserName = await resolveUserName(pool, winnerUserId);

      logRows.push({
        id: row.id,
        source: 'log',
        detectedAt: row.detected_at?.toISOString?.() || String(row.detected_at),
        batchUuid: row.batch_uuid,
        tableName: row.table_name,
        tableDisplayName: getTableDisplayName(row.table_name),
        rowUuid: row.row_uuid,
        recordDisplay,
        fieldName: row.field_name,
        fieldDisplayName: getFieldDisplayName(row.field_name),
        winner: {
          value: row.receiver_current_value,
          changedAt: row.receiver_winner_changed_at?.toISOString?.() || null,
          instanceId: row.receiver_winner_instance || '',
          userId: winnerUserId,
          userName: winnerUserName,
          locationLabel: getInstanceLabel(row.receiver_winner_instance || ''),
        },
        rejected: {
          value: row.incoming_new_value,
          changedAt: row.incoming_changed_at?.toISOString?.() || null,
          instanceId: row.incoming_sender_instance || '',
          userId: incomingUserId,
          userName: incomingUserName,
          locationLabel: getInstanceLabel(row.incoming_sender_instance || ''),
        },
        isResolved: row.is_resolved,
        resolvedAt: row.resolved_at?.toISOString?.() || null,
        resolvedBy: row.resolved_by,
        resolvedAction: row.resolved_action,
        conflictKind: row.conflict_kind ?? null,
      });
    }
  }

  // ── Query sync_conflicts (old) ──
  if (source === 'all' || source === 'old') {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (resolved) {
      conditions.push(`sc.resolution IS NOT NULL`);
    } else {
      conditions.push(`sc.resolution IS NULL`);
    }
    if (filters.tableName) {
      conditions.push(`sc.table_name = $${paramIdx++}`);
      params.push(filters.tableName);
    }
    if (filters.vesselId) {
      conditions.push(`sc.vessel_id = $${paramIdx++}`);
      params.push(filters.vesselId);
    }
    if (filters.dateFrom) {
      conditions.push(`sc.created_at >= $${paramIdx++}`);
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      conditions.push(`sc.created_at <= $${paramIdx++}`);
      params.push(filters.dateTo);
    }
    conditions.push(`(sc.is_deleted = false OR sc.is_deleted IS NULL)`);

    const whereClause = conditions.join(' AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM sync_conflicts sc WHERE ${whereClause}`,
      params
    );
    totalOld = parseInt(countResult.rows[0].cnt, 10);

    const dataResult = await pool.query(
      `SELECT sc.*
       FROM sync_conflicts sc
       WHERE ${whereClause}
       ORDER BY sc.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    for (const row of dataResult.rows) {
      const recordDisplay = await getRecordLabel(pool, row.table_name, row.row_uuid);
      const shipUserName = await resolveUserName(pool, row.ship_changed_by);
      const shoreUserName = await resolveUserName(pool, row.shore_changed_by);

      oldRows.push({
        id: row.id,
        source: 'old',
        detectedAt: row.created_at?.toISOString?.() || String(row.created_at),
        batchUuid: row.sync_batch_id,
        tableName: row.table_name,
        tableDisplayName: getTableDisplayName(row.table_name),
        rowUuid: row.row_uuid,
        recordDisplay,
        fieldName: row.field_name,
        fieldDisplayName: getFieldDisplayName(row.field_name),
        winner: {
          value: row.shore_value,
          changedAt: row.shore_changed_at?.toISOString?.() || null,
          instanceId: 'SHORE',
          userId: row.shore_changed_by,
          userName: shoreUserName,
          locationLabel: 'Shore — Office',
        },
        rejected: {
          value: row.ship_value,
          changedAt: row.ship_changed_at?.toISOString?.() || null,
          instanceId: 'SHIP',
          userId: row.ship_changed_by,
          userName: shipUserName,
          locationLabel: 'Ship',
        },
        isResolved: row.resolution !== null,
        resolvedAt: row.resolved_at?.toISOString?.() || null,
        resolvedBy: row.resolved_by,
        resolvedAction: row.resolution,
      });
    }
  }

  // Merge and sort by detected_at DESC
  const allRows = [...logRows, ...oldRows]
    .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
    .slice(0, limit);

  return { rows: allRows, total: totalLog + totalOld };
}

/**
 * 1.2 Count unresolved conflicts across both tables
 */
export async function countUnresolvedConflicts(vesselId?: string): Promise<ConflictCount> {
  const pool = await getPool();

  let logQuery = `SELECT COUNT(*) as cnt FROM sync_conflict_log WHERE is_resolved = false`;
  let oldQuery = `SELECT COUNT(*) as cnt FROM sync_conflicts WHERE resolution IS NULL AND (is_deleted = false OR is_deleted IS NULL)`;
  const logParams: any[] = [];
  const oldParams: any[] = [];

  if (vesselId) {
    logQuery += ` AND EXISTS (SELECT 1 FROM sync_field_log sfl WHERE sfl.table_name = sync_conflict_log.table_name AND sfl.row_uuid = sync_conflict_log.row_uuid AND sfl.vessel_id = $1 LIMIT 1)`;
    logParams.push(vesselId);
    oldQuery += ` AND vessel_id = $1`;
    oldParams.push(vesselId);
  }

  const [logResult, oldResult] = await Promise.all([
    pool.query(logQuery, logParams),
    pool.query(oldQuery, oldParams),
  ]);

  const fromLog = parseInt(logResult.rows[0].cnt, 10);
  const fromOld = parseInt(oldResult.rows[0].cnt, 10);

  return { total: fromLog + fromOld, fromLog, fromOld };
}

/**
 * 1.3 Get single conflict by id + source
 */
export async function getConflict(id: number, source: 'log' | 'old'): Promise<EnrichedConflict | null> {
  // Use listConflicts with filters that match a specific ID
  // More efficient: direct query
  const pool = await getPool();

  if (source === 'log') {
    const result = await pool.query(
      `SELECT * FROM sync_conflict_log WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];

    // Enrich
    let incomingUserId: string | null = null;
    let winnerUserId: string | null = null;
    try {
      const r = await pool.query(
        `SELECT changed_by_user_id FROM sync_field_log
         WHERE table_name=$1 AND row_uuid=$2 AND field_name=$3 AND instance_id=$4
         ORDER BY changed_at DESC LIMIT 1`,
        [row.table_name, row.row_uuid, row.field_name, row.incoming_sender_instance]
      );
      incomingUserId = r.rows[0]?.changed_by_user_id || null;
    } catch {}
    try {
      const r = await pool.query(
        `SELECT changed_by_user_id FROM sync_field_log
         WHERE table_name=$1 AND row_uuid=$2 AND field_name=$3 AND instance_id=$4
         ORDER BY changed_at DESC LIMIT 1`,
        [row.table_name, row.row_uuid, row.field_name, row.receiver_winner_instance]
      );
      winnerUserId = r.rows[0]?.changed_by_user_id || null;
    } catch {}

    const recordDisplay = await getRecordLabel(pool, row.table_name, row.row_uuid);

    return {
      id: row.id,
      source: 'log',
      detectedAt: row.detected_at?.toISOString?.() || String(row.detected_at),
      batchUuid: row.batch_uuid,
      tableName: row.table_name,
      tableDisplayName: getTableDisplayName(row.table_name),
      rowUuid: row.row_uuid,
      recordDisplay,
      fieldName: row.field_name,
      fieldDisplayName: getFieldDisplayName(row.field_name),
      winner: {
        value: row.receiver_current_value,
        changedAt: row.receiver_winner_changed_at?.toISOString?.() || null,
        instanceId: row.receiver_winner_instance || '',
        userId: winnerUserId,
        userName: await resolveUserName(pool, winnerUserId),
        locationLabel: getInstanceLabel(row.receiver_winner_instance || ''),
      },
      rejected: {
        value: row.incoming_new_value,
        changedAt: row.incoming_changed_at?.toISOString?.() || null,
        instanceId: row.incoming_sender_instance || '',
        userId: incomingUserId,
        userName: await resolveUserName(pool, incomingUserId),
        locationLabel: getInstanceLabel(row.incoming_sender_instance || ''),
      },
      isResolved: row.is_resolved,
      resolvedAt: row.resolved_at?.toISOString?.() || null,
      resolvedBy: row.resolved_by,
      resolvedAction: row.resolved_action,
      conflictKind: row.conflict_kind ?? null,
    };
  } else {
    // source === 'old'
    const result = await pool.query(
      `SELECT * FROM sync_conflicts WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    const recordDisplay = await getRecordLabel(pool, row.table_name, row.row_uuid);

    return {
      id: row.id,
      source: 'old',
      detectedAt: row.created_at?.toISOString?.() || String(row.created_at),
      batchUuid: row.sync_batch_id,
      tableName: row.table_name,
      tableDisplayName: getTableDisplayName(row.table_name),
      rowUuid: row.row_uuid,
      recordDisplay,
      fieldName: row.field_name,
      fieldDisplayName: getFieldDisplayName(row.field_name),
      winner: {
        value: row.shore_value,
        changedAt: row.shore_changed_at?.toISOString?.() || null,
        instanceId: 'SHORE',
        userId: row.shore_changed_by,
        userName: await resolveUserName(pool, row.shore_changed_by),
        locationLabel: 'Shore — Office',
      },
      rejected: {
        value: row.ship_value,
        changedAt: row.ship_changed_at?.toISOString?.() || null,
        instanceId: 'SHIP',
        userId: row.ship_changed_by,
        userName: await resolveUserName(pool, row.ship_changed_by),
        locationLabel: 'Ship',
      },
      isResolved: row.resolution !== null,
      resolvedAt: row.resolved_at?.toISOString?.() || null,
      resolvedBy: row.resolved_by,
      resolvedAction: row.resolution,
    };
  }
}

/**
 * Task #399: WO-LEVEL ATOMIC RESOLUTION for dual-completion conflicts.
 *
 * A dual completion is ONE decision, not per-field picks: resolving ANY field of the
 * group applies the chosen SIDE to EVERY open dual-completion field of that work order
 * in a single transaction — otherwise the two sides could retain a mixed completion
 * that neither side actually entered.
 *   choice='incoming' → the other side's completion wins everywhere (Apply incoming)
 *   choice='current'  → this side's current values are kept everywhere (Dismiss)
 * Every field gets a RESOLUTION_ACTOR sync_field_log so the other instance
 * force-applies the full set and closes all its mirror conflicts.
 */
async function resolveDualCompletionGroup(
  pool: any,
  conflict: any,
  choice: 'incoming' | 'current',
  userId: string,
): Promise<void> {
  const identityCol = getIdentityColumn(conflict.table_name) || 'id';
  const instanceId = process.env.SYNC_INSTANCE_ID || 'UNKNOWN';
  const resolvedAction = choice === 'incoming' ? 'APPLY_INCOMING' : 'DISMISS';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL sync.bypass_trigger = 'true'`);
    const siblings = (await client.query(
      `SELECT * FROM sync_conflict_log
        WHERE conflict_kind = $1 AND table_name = $2 AND row_uuid = $3 AND is_resolved = false
        FOR UPDATE`,
      [DUAL_COMPLETION_KIND, conflict.table_name, conflict.row_uuid]
    )).rows;
    const vesselRow = await client.query(
      `SELECT vessel_id FROM "${conflict.table_name}" WHERE "${identityCol}" = $1`,
      [conflict.row_uuid]
    );
    const vesselId = vesselRow.rows[0]?.vessel_id ?? null;

    for (const sib of siblings) {
      const fieldSnake = toSnakeCase(sib.field_name);
      const cur = await client.query(
        `SELECT "${fieldSnake}" AS v FROM "${conflict.table_name}" WHERE "${identityCol}" = $1`,
        [conflict.row_uuid]
      );
      const currentValue = cur.rows[0]?.v ?? null;
      const chosenValue = choice === 'incoming' ? sib.incoming_new_value : (currentValue !== null ? String(currentValue) : null);
      const rejectedValue = choice === 'incoming' ? (currentValue !== null ? String(currentValue) : null) : sib.incoming_new_value;

      if (choice === 'incoming') {
        await client.query(
          `UPDATE "${conflict.table_name}" SET "${fieldSnake}" = $1, "updated_at" = NOW()
            WHERE "${identityCol}" = $2`,
          [chosenValue, conflict.row_uuid]
        );
      }
      // Resolution log — RESOLUTION_ACTOR makes the other side force-apply it and close
      // its mirror conflict; the human resolver is kept in sync_conflict_log.resolved_by.
      await client.query(
        `INSERT INTO sync_field_log
          (table_name, row_uuid, field_name, old_value, new_value, vessel_id,
           changed_by_user_id, instance_id, is_synced, is_sync)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, false)`,
        [conflict.table_name, conflict.row_uuid, sib.field_name,
         rejectedValue, chosenValue, vesselId, RESOLUTION_ACTOR, instanceId]
      );
      await client.query(
        `UPDATE sync_conflict_log
            SET is_resolved = true, resolved_at = NOW(), resolved_by = $1, resolved_action = $2
          WHERE id = $3`,
        [userId, resolvedAction, sib.id]
      );
    }
    await client.query('COMMIT');
    syncDiag(`DUAL-COMPLETION GROUP RESOLVED: row=${conflict.row_uuid} choice=${choice} fields=${siblings.length} by=${userId} — resolution logs queued for propagation`);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* non-fatal */ }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 1.4 Apply incoming — overwrite the winner's value with the rejected (incoming) value
 */
export async function applyIncomingConflict(
  id: number,
  source: 'log' | 'old',
  userId: string
): Promise<EnrichedConflict | null> {
  const pool = await getPool();

  if (source === 'log') {
    // Read the conflict
    const conflictResult = await pool.query(
      `SELECT * FROM sync_conflict_log WHERE id = $1`,
      [id]
    );
    if (conflictResult.rows.length === 0) return null;
    const conflict = conflictResult.rows[0];

    if (conflict.is_resolved) {
      throw Object.assign(new Error('Conflict is already resolved'), { statusCode: 409 });
    }

    // Task #399: a dual-completion conflict is ONE WO-level decision — applying the
    // incoming side resolves EVERY open dual-completion field of this work order
    // atomically with the other side's values, and propagates the full set.
    const isDualCompletion = conflict.conflict_kind === DUAL_COMPLETION_KIND;
    if (isDualCompletion) {
      await resolveDualCompletionGroup(pool, conflict, 'incoming', userId);
      syncDiag(`CONFLICT RESOLVED: id=${id} source=log action=APPLY_INCOMING by=${userId} table=${conflict.table_name}.${conflict.field_name} kind=dual_completion (whole completion group)`);
      if (conflict.table_name === 'work_orders') {
        await runPostResolutionLearning(pool, conflict.row_uuid);
      }
      return getConflict(id, source);
    }

    // Get the identity column for this table
    const identityCol = getIdentityColumn(conflict.table_name) || 'id';

    // Convert camelCase field to snake_case for DB column
    const fieldNameSnake = toSnakeCase(conflict.field_name);

    // Read the current value + vessel_id before we overwrite (for audit trail)
    const currentRow = await pool.query(
      `SELECT "${fieldNameSnake}", vessel_id FROM "${conflict.table_name}" WHERE "${identityCol}" = $1`,
      [conflict.row_uuid]
    );
    const oldValue = currentRow.rows[0]?.[fieldNameSnake] ?? null;
    const vesselId = currentRow.rows[0]?.vessel_id ?? null;

    // Apply the incoming value to the data table
    // Raw SQL bypasses Drizzle fieldLogger middleware, so we manually
    // insert a sync_field_log entry below for audit trail.
    await pool.query(
      `UPDATE "${conflict.table_name}"
       SET "${fieldNameSnake}" = $1, "updated_at" = NOW()
       WHERE "${identityCol}" = $2`,
      [conflict.incoming_new_value, conflict.row_uuid]
    );

    // Create audit trail in sync_field_log (raw SQL bypasses Drizzle middleware)
    const instanceId = process.env.SYNC_INSTANCE_ID || 'UNKNOWN';
    await pool.query(
      `INSERT INTO sync_field_log
        (table_name, row_uuid, field_name, old_value, new_value, vessel_id,
         changed_by_user_id, instance_id, is_synced, is_sync)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, false)`,
      [
        conflict.table_name,
        conflict.row_uuid,
        conflict.field_name,
        oldValue !== null ? String(oldValue) : null,
        conflict.incoming_new_value,
        vesselId,
        userId,
        instanceId,
      ]
    );

    // Mark resolved
    await pool.query(
      `UPDATE sync_conflict_log
       SET is_resolved = true, resolved_at = NOW(), resolved_by = $1, resolved_action = 'APPLY_INCOMING'
       WHERE id = $2`,
      [userId, id]
    );

    syncDiag(`CONFLICT RESOLVED: id=${id} source=log action=APPLY_INCOMING by=${userId} table=${conflict.table_name}.${conflict.field_name}`);

    return getConflict(id, source);
  } else {
    // source === 'old'
    const conflictResult = await pool.query(
      `SELECT * FROM sync_conflicts WHERE id = $1`,
      [id]
    );
    if (conflictResult.rows.length === 0) return null;
    const conflict = conflictResult.rows[0];

    if (conflict.resolution !== null) {
      throw Object.assign(new Error('Conflict is already resolved'), { statusCode: 409 });
    }

    const identityCol = getIdentityColumn(conflict.table_name) || 'id';
    const fieldNameSnake = toSnakeCase(conflict.field_name);

    // Read current value + vessel_id for audit trail
    const currentOldRow = await pool.query(
      `SELECT "${fieldNameSnake}", vessel_id FROM "${conflict.table_name}" WHERE "${identityCol}" = $1`,
      [conflict.row_uuid]
    );
    const oldValOld = currentOldRow.rows[0]?.[fieldNameSnake] ?? null;
    const vesselIdOld = currentOldRow.rows[0]?.vessel_id ?? null;

    // For old conflicts, the "rejected" side is ship_value
    await pool.query(
      `UPDATE "${conflict.table_name}"
       SET "${fieldNameSnake}" = $1, "updated_at" = NOW()
       WHERE "${identityCol}" = $2`,
      [conflict.ship_value, conflict.row_uuid]
    );

    // Create audit trail in sync_field_log
    const instanceIdOld = process.env.SYNC_INSTANCE_ID || 'UNKNOWN';
    await pool.query(
      `INSERT INTO sync_field_log
        (table_name, row_uuid, field_name, old_value, new_value, vessel_id,
         changed_by_user_id, instance_id, is_synced, is_sync)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, false)`,
      [
        conflict.table_name,
        conflict.row_uuid,
        conflict.field_name,
        oldValOld !== null ? String(oldValOld) : null,
        conflict.ship_value,
        vesselIdOld,
        userId,
        instanceIdOld,
      ]
    );

    await pool.query(
      `UPDATE sync_conflicts
       SET resolution = 'ship_wins', resolved_value = $1, resolved_at = NOW(), resolved_by = $2
       WHERE id = $3`,
      [conflict.ship_value, userId, id]
    );

    syncDiag(`CONFLICT RESOLVED: id=${id} source=old action=APPLY_INCOMING(ship_wins) by=${userId} table=${conflict.table_name}.${conflict.field_name}`);

    return getConflict(id, source);
  }
}

/**
 * 1.5 Dismiss conflict — mark resolved, no data change
 */
export async function dismissConflict(
  id: number,
  source: 'log' | 'old',
  userId: string
): Promise<EnrichedConflict | null> {
  const pool = await getPool();

  if (source === 'log') {
    const conflictResult = await pool.query(
      `SELECT * FROM sync_conflict_log WHERE id = $1`,
      [id]
    );
    if (conflictResult.rows.length === 0) return null;
    const conflict = conflictResult.rows[0];
    if (conflict.is_resolved) {
      throw Object.assign(new Error('Conflict is already resolved'), { statusCode: 409 });
    }

    // Task #399: dismissing a dual-completion conflict means "keep THIS side's completion" —
    // one WO-level decision. All open dual-completion fields of the work order are resolved
    // atomically and the kept values are re-asserted as RESOLUTION_ACTOR field logs so the
    // other side force-applies them and closes its mirror conflicts (otherwise the two
    // instances would stay diverged).
    const isDualDismiss = conflict.conflict_kind === DUAL_COMPLETION_KIND;
    if (isDualDismiss) {
      await resolveDualCompletionGroup(pool, conflict, 'current', userId);
      syncDiag(`CONFLICT DISMISSED: id=${id} source=log by=${userId} kind=dual_completion (whole completion group kept + re-asserted for propagation)`);
      if (conflict.table_name === 'work_orders') {
        await runPostResolutionLearning(pool, conflict.row_uuid);
      }
      return getConflict(id, source);
    }

    await pool.query(
      `UPDATE sync_conflict_log
       SET is_resolved = true, resolved_at = NOW(), resolved_by = $1, resolved_action = 'DISMISS'
       WHERE id = $2`,
      [userId, id]
    );

    syncDiag(`CONFLICT DISMISSED: id=${id} source=log by=${userId}`);

    return getConflict(id, source);
  } else {
    const conflictResult = await pool.query(
      `SELECT * FROM sync_conflicts WHERE id = $1`,
      [id]
    );
    if (conflictResult.rows.length === 0) return null;
    if (conflictResult.rows[0].resolution !== null) {
      throw Object.assign(new Error('Conflict is already resolved'), { statusCode: 409 });
    }

    await pool.query(
      `UPDATE sync_conflicts
       SET resolution = 'dismissed', resolved_value = shore_value, resolved_at = NOW(), resolved_by = $1
       WHERE id = $2`,
      [userId, id]
    );

    syncDiag(`CONFLICT DISMISSED: id=${id} source=old by=${userId}`);
    return getConflict(id, source);
  }
}

/**
 * Get list of distinct table names that have unresolved conflicts
 * (for filter dropdown)
 */
export async function getConflictTableNames(): Promise<string[]> {
  const pool = await getPool();
  const result = await pool.query(`
    SELECT DISTINCT table_name FROM (
      SELECT table_name FROM sync_conflict_log WHERE is_resolved = false
      UNION
      SELECT table_name FROM sync_conflicts WHERE resolution IS NULL AND (is_deleted = false OR is_deleted IS NULL)
    ) combined ORDER BY table_name
  `);
  return result.rows.map((r: any) => r.table_name);
}

// ── Private helpers ──

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}
