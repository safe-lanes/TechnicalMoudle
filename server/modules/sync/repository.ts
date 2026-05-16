/**
 * Sync Repository — Database operations for the 5 sync tables
 *
 * Tables: sync_metadata, sync_field_log, sync_conflicts, sync_file_queue, sync_batches
 */

import { eq, and, ne, gt, desc, asc, inArray, isNull, sql } from 'drizzle-orm';
import { getDb } from '../../db';
import { getPool } from '../../db';
import { syncDiag } from './syncDiagLogger';
import {
  syncMetadata, syncFieldLog, syncConflicts, syncFileQueue, syncBatches, syncSettings,
  type InsertSyncMetadata, type SyncMetadata,
  type SyncFieldLog,
  type InsertSyncConflict, type SyncConflict,
  type InsertSyncFileQueue, type SyncFileQueue,
  type InsertSyncBatch, type SyncBatch,
  type SyncSettings,
} from '@shared/schema';

// ═══════════════════════════════════════════════════════════════
// sync_metadata
// ═══════════════════════════════════════════════════════════════

export async function getInstanceMetadata(instanceId: string): Promise<SyncMetadata | undefined> {
  const db = await getDb();
  const rows = await db.select().from(syncMetadata)
    .where(eq(syncMetadata.instanceId, instanceId))
    .limit(1);
  return rows[0];
}

export async function upsertInstanceMetadata(data: {
  instanceId: string;
  vesselId?: string | null;
  lastSyncCheckpoint?: Date | null;
  lastSyncStatus?: string | null;
  lastSyncAt?: Date | null;
  syncDirection?: string | null;
}): Promise<SyncMetadata> {
  const db = await getDb();
  const existing = await getInstanceMetadata(data.instanceId);
  if (existing) {
    const result = await db.update(syncMetadata)
      .set({
        ...(data.vesselId !== undefined ? { vesselId: data.vesselId } : {}),
        ...(data.lastSyncCheckpoint !== undefined ? { lastSyncCheckpoint: data.lastSyncCheckpoint } : {}),
        ...(data.lastSyncStatus !== undefined ? { lastSyncStatus: data.lastSyncStatus } : {}),
        ...(data.lastSyncAt !== undefined ? { lastSyncAt: data.lastSyncAt } : {}),
        ...(data.syncDirection !== undefined ? { syncDirection: data.syncDirection } : {}),
        updatedAt: new Date(),
      })
      .where(eq(syncMetadata.instanceId, data.instanceId))
      .returning();
    return result[0];
  }
  const result = await db.insert(syncMetadata)
    .values({
      instanceId: data.instanceId,
      vesselId: data.vesselId ?? null,
      lastSyncCheckpoint: data.lastSyncCheckpoint ?? null,
      lastSyncStatus: data.lastSyncStatus ?? null,
      lastSyncAt: data.lastSyncAt ?? null,
      syncDirection: data.syncDirection ?? null,
    })
    .returning();
  return result[0];
}

export async function getAllInstanceMetadata(): Promise<SyncMetadata[]> {
  const db = await getDb();
  return db.select().from(syncMetadata)
    .where(eq(syncMetadata.isDeleted, false))
    .orderBy(desc(syncMetadata.updatedAt));
}

// ═══════════════════════════════════════════════════════════════
// sync_field_log
// ═══════════════════════════════════════════════════════════════

export async function getUnsyncedFieldLogs(
  instanceId: string,
  vesselId: string,
  vesselCode?: string | null,
  limit: number = 1000
): Promise<SyncFieldLog[]> {
  // Some tables log vesselCode (e.g. "V001") instead of vesselId (UUID) in the
  // vesselId column. Query for both to capture all unsynced logs for this vessel.
  const pool = await getPool();
  const vesselValues = [vesselId];
  if (vesselCode && vesselCode !== vesselId) vesselValues.push(vesselCode);

  const placeholders = vesselValues.map((_, i) => `$${i + 2}`).join(', ');
  const result = await pool.query(
    `SELECT * FROM sync_field_log
     WHERE instance_id = $1
       AND vessel_id IN (${placeholders})
       AND is_synced = false
     ORDER BY changed_at ASC
     LIMIT ${limit}`,
    [instanceId, ...vesselValues]
  );
  return result.rows;
}

export async function getFieldLogsSinceCheckpoint(
  vesselId: string,
  sinceTimestamp: Date | null,
  excludeInstanceId: string,
  vesselCode?: string | null,
  limit: number = 5000
): Promise<SyncFieldLog[]> {
  // Match both vesselId (UUID) and vesselCode (e.g. "V001") since some tables
  // log vessel_code in the vessel_id column of sync_field_log.
  const pool = await getPool();
  const vesselValues = [vesselId];
  if (vesselCode && vesselCode !== vesselId) vesselValues.push(vesselCode);

  const vesselPlaceholders = vesselValues.map((_, i) => `$${i + 1}`).join(', ');
  let paramIdx = vesselValues.length;

  let query = `SELECT * FROM sync_field_log
     WHERE vessel_id IN (${vesselPlaceholders})
       AND instance_id != $${++paramIdx}
       AND is_synced = false`;
  const params: any[] = [...vesselValues, excludeInstanceId];

  if (sinceTimestamp) {
    query += ` AND changed_at > $${++paramIdx}`;
    params.push(sinceTimestamp);
  }
  query += ` ORDER BY changed_at ASC LIMIT ${limit}`;

  const result = await pool.query(query, params);

  // Diagnostic: if 0 results, run progressively relaxed counts to pinpoint which filter eliminates rows
  if (result.rows.length === 0) {
    try {
      const vp = vesselValues.map((_, i) => `$${i + 1}`).join(', ');

      // Count ALL logs for this vessel (no filters except vessel_id)
      const totalCount = await pool.query(
        `SELECT count(*)::int AS c FROM sync_field_log WHERE vessel_id IN (${vp})`,
        vesselValues
      );
      const total = totalCount.rows[0]?.c || 0;

      if (total > 0) {
        // There ARE logs for this vessel — find which filter eliminates them
        const unsyncedCount = await pool.query(
          `SELECT count(*)::int AS c FROM sync_field_log WHERE vessel_id IN (${vp}) AND is_synced = false`,
          vesselValues
        );
        const instanceCount = await pool.query(
          `SELECT count(*)::int AS c FROM sync_field_log WHERE vessel_id IN (${vp}) AND is_synced = false AND instance_id != $${vesselValues.length + 1}`,
          [...vesselValues, excludeInstanceId]
        );
        // Sample instance_ids to see what's actually stored
        const instanceSample = await pool.query(
          `SELECT DISTINCT instance_id, count(*)::int AS c FROM sync_field_log WHERE vessel_id IN (${vp}) AND is_synced = false GROUP BY instance_id LIMIT 10`,
          vesselValues
        );
        const instanceInfo = instanceSample.rows.map((r: any) => `${r.instance_id}:${r.c}`).join(', ');

        syncDiag(`PREPARE-PULL DIAG: vessel=${vesselId} total_logs=${total} unsynced=${unsyncedCount.rows[0]?.c || 0} after_instance_filter=${instanceCount.rows[0]?.c || 0} exclude=${excludeInstanceId} since=${sinceTimestamp?.toISOString() || 'NONE'} instances=[${instanceInfo}]`);
      }
    } catch (diagErr) {
      // Non-fatal diagnostic
    }
  }

  return result.rows;
}

export async function markFieldLogsSynced(logUuids: string[], batchId: string): Promise<number> {
  if (logUuids.length === 0) return 0;
  const db = await getDb();
  const result = await db.update(syncFieldLog)
    .set({ isSynced: true, syncBatchId: batchId, updatedAt: new Date() })
    .where(inArray(syncFieldLog.logUuid, logUuids));
  return logUuids.length;
}

export async function getFieldLogCount(vesselId: string, isSynced: boolean, vesselCode?: string | null): Promise<number> {
  const pool = await getPool();
  const vesselValues = [vesselId];
  if (vesselCode && vesselCode !== vesselId) vesselValues.push(vesselCode);
  const placeholders = vesselValues.map((_, i) => `$${i + 1}`).join(', ');
  const result = await pool.query(
    `SELECT count(*)::int AS count FROM sync_field_log WHERE vessel_id IN (${placeholders}) AND is_synced = $${vesselValues.length + 1}`,
    [...vesselValues, isSynced]
  );
  return result.rows[0]?.count ?? 0;
}

export async function insertFieldLogs(entries: Array<{
  tableName: string;
  rowUuid: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  vesselId: string | null;
  changedAt: Date;
  changedByUserId: string | null;
  instanceId: string;
}>): Promise<number> {
  if (entries.length === 0) return 0;
  const db = await getDb();
  await db.insert(syncFieldLog).values(entries);
  return entries.length;
}

// ═══════════════════════════════════════════════════════════════
// sync_conflicts
// ═══════════════════════════════════════════════════════════════

export async function createConflict(data: {
  tableName: string;
  rowUuid: string;
  fieldName: string;
  shipValue: string | null;
  shipChangedAt: Date | null;
  shipChangedBy: string | null;
  shoreValue: string | null;
  shoreChangedAt: Date | null;
  shoreChangedBy: string | null;
  vesselId: string | null;
  syncBatchId: string | null;
}): Promise<SyncConflict> {
  const db = await getDb();
  const result = await db.insert(syncConflicts).values(data).returning();
  return result[0];
}

export async function getUnresolvedConflicts(vesselId: string): Promise<SyncConflict[]> {
  const db = await getDb();
  return db.select().from(syncConflicts)
    .where(and(
      eq(syncConflicts.vesselId, vesselId),
      isNull(syncConflicts.resolution),
    ))
    .orderBy(desc(syncConflicts.createdAt));
}

export async function resolveConflict(
  conflictUuid: string,
  resolution: string,
  resolvedValue: string | null,
  resolvedBy: string
): Promise<SyncConflict> {
  const db = await getDb();
  const result = await db.update(syncConflicts)
    .set({
      resolution,
      resolvedValue,
      resolvedAt: new Date(),
      resolvedBy,
      updatedAt: new Date(),
    })
    .where(eq(syncConflicts.conflictUuid, conflictUuid))
    .returning();
  if (result.length === 0) {
    throw Object.assign(new Error(`Conflict ${conflictUuid} not found`), { statusCode: 404 });
  }
  return result[0];
}

export async function getConflictsByBatch(batchId: string): Promise<SyncConflict[]> {
  const db = await getDb();
  return db.select().from(syncConflicts)
    .where(eq(syncConflicts.syncBatchId, batchId))
    .orderBy(desc(syncConflicts.createdAt));
}

export async function getConflict(conflictUuid: string): Promise<SyncConflict | undefined> {
  const db = await getDb();
  const rows = await db.select().from(syncConflicts)
    .where(eq(syncConflicts.conflictUuid, conflictUuid))
    .limit(1);
  return rows[0];
}

// ═══════════════════════════════════════════════════════════════
// sync_file_queue
// ═══════════════════════════════════════════════════════════════

export async function queueFile(data: {
  tableName: string;
  rowUuid: string;
  fileKey: string;
  fileName?: string | null;
  fileSizeBytes?: number | null;
  fileHash?: string | null;
  direction: string;
  vesselId?: string | null;
  instanceId: string;
  syncBatchId?: string | null;
  totalChunks?: number | null;
  priority?: number | null;
}): Promise<SyncFileQueue> {
  const db = await getDb();
  const result = await db.insert(syncFileQueue).values(data).returning();
  return result[0];
}

/**
 * Queue a file with a specific queueUuid (used by the RECEIVING side to create
 * a mirror entry matching the sender's queue UUID for tracking).
 */
export async function queueFileWithUuid(data: {
  queueUuid: string;
  tableName: string;
  rowUuid: string;
  fileKey: string;
  fileName?: string | null;
  fileSizeBytes?: number | null;
  fileHash?: string | null;
  direction: string;
  vesselId?: string | null;
  instanceId: string;
  syncBatchId?: string | null;
  totalChunks?: number | null;
  priority?: number | null;
}): Promise<SyncFileQueue> {
  const pool = await getPool();
  // Use raw SQL with ON CONFLICT to handle duplicates gracefully
  const result = await pool.query(
    `INSERT INTO sync_file_queue (queue_uuid, table_name, row_uuid, file_key, file_name, file_size_bytes, file_hash, direction, vessel_id, instance_id, total_chunks, priority, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'in_progress')
     ON CONFLICT (queue_uuid) DO NOTHING
     RETURNING *`,
    [data.queueUuid, data.tableName, data.rowUuid, data.fileKey, data.fileName ?? null,
     data.fileSizeBytes ?? null, data.fileHash ?? null, data.direction, data.vesselId ?? null,
     data.instanceId, data.totalChunks ?? null, data.priority ?? 0]
  );
  return result.rows[0];
}

export async function getFileQueueEntry(queueUuid: string): Promise<SyncFileQueue | undefined> {
  const db = await getDb();
  const rows = await db.select().from(syncFileQueue)
    .where(eq(syncFileQueue.queueUuid, queueUuid))
    .limit(1);
  return rows[0];
}

export async function incrementRetryCount(queueUuid: string): Promise<void> {
  const db = await getDb();
  await db.update(syncFileQueue)
    .set({
      retryCount: sql`COALESCE("retry_count", 0) + 1`,
      updatedAt: new Date(),
    })
    .where(eq(syncFileQueue.queueUuid, queueUuid));
}

export async function getPendingFiles(
  vesselId: string,
  direction: string,
  limit: number = 100
): Promise<SyncFileQueue[]> {
  const db = await getDb();
  return db.select().from(syncFileQueue)
    .where(and(
      eq(syncFileQueue.vesselId, vesselId),
      eq(syncFileQueue.direction, direction),
      eq(syncFileQueue.status, 'pending'),
    ))
    .orderBy(desc(syncFileQueue.priority), asc(syncFileQueue.createdAt))
    .limit(limit);
}

export async function updateFileStatus(
  queueUuid: string,
  status: string,
  chunkOffset?: number,
  lastError?: string
): Promise<void> {
  const db = await getDb();
  await db.update(syncFileQueue)
    .set({
      status,
      ...(chunkOffset !== undefined ? { chunkOffset } : {}),
      ...(lastError !== undefined ? { lastError } : {}),
      updatedAt: new Date(),
    })
    .where(eq(syncFileQueue.queueUuid, queueUuid));
}

export async function markFileCompleted(queueUuid: string): Promise<void> {
  const db = await getDb();
  await db.update(syncFileQueue)
    .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
    .where(eq(syncFileQueue.queueUuid, queueUuid));
}

export async function getPendingFileCount(vesselId: string): Promise<number> {
  const db = await getDb();
  const result = await db.select({ count: sql<number>`count(*)::int` })
    .from(syncFileQueue)
    .where(and(
      eq(syncFileQueue.vesselId, vesselId),
      eq(syncFileQueue.status, 'pending'),
    ));
  return result[0]?.count ?? 0;
}

// ═══════════════════════════════════════════════════════════════
// sync_batches
// ═══════════════════════════════════════════════════════════════

export async function createBatch(data: {
  initiatedByInstance: string;
  vesselId: string | null;
  checkpointBefore: Date | null;
}): Promise<SyncBatch> {
  const db = await getDb();
  const result = await db.insert(syncBatches)
    .values({
      initiatedByInstance: data.initiatedByInstance,
      vesselId: data.vesselId,
      checkpointBefore: data.checkpointBefore,
      status: 'in_progress',
    })
    .returning();
  return result[0];
}

export async function updateBatch(batchUuid: string, updates: Partial<{
  status: string;
  recordsSent: number;
  recordsReceived: number;
  conflictsFound: number;
  conflictsResolved: number;
  filesQueued: number;
  filesCompleted: number;
  checkpointAfter: Date;
  completedAt: Date;
  durationMs: number;
  errorMessage: string | null;
}>): Promise<SyncBatch> {
  const db = await getDb();
  const result = await db.update(syncBatches)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(syncBatches.batchUuid, batchUuid))
    .returning();
  if (result.length === 0) {
    throw Object.assign(new Error(`Batch ${batchUuid} not found`), { statusCode: 404 });
  }
  return result[0];
}

export async function getBatch(batchUuid: string): Promise<SyncBatch | undefined> {
  const db = await getDb();
  const rows = await db.select().from(syncBatches)
    .where(eq(syncBatches.batchUuid, batchUuid))
    .limit(1);
  return rows[0];
}

export async function getRecentBatches(vesselId: string, limit: number = 10): Promise<SyncBatch[]> {
  const db = await getDb();
  const conditions = vesselId && vesselId !== 'all'
    ? [eq(syncBatches.vesselId, vesselId)]
    : [];
  return db.select().from(syncBatches)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(syncBatches.startedAt))
    .limit(limit);
}

// ═══════════════════════════════════════════════════════════════
// sync_settings
// ═══════════════════════════════════════════════════════════════

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.select().from(syncSettings)
    .where(eq(syncSettings.isDeleted, false));
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.settingKey] = row.settingValue ?? '';
  }
  return map;
}

export async function getAllSettingsFull(): Promise<SyncSettings[]> {
  const db = await getDb();
  return db.select().from(syncSettings)
    .where(eq(syncSettings.isDeleted, false))
    .orderBy(asc(syncSettings.settingKey));
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select().from(syncSettings)
    .where(and(
      eq(syncSettings.settingKey, key),
      eq(syncSettings.isDeleted, false),
    ))
    .limit(1);
  return rows[0]?.settingValue ?? null;
}

export async function updateSetting(key: string, value: string, userId?: string): Promise<void> {
  const db = await getDb();
  await db.update(syncSettings)
    .set({
      settingValue: value,
      updatedAt: new Date(),
      ...(userId ? { updatedByUuid: userId } : {}),
    })
    .where(eq(syncSettings.settingKey, key));
}

export async function updateSettings(settings: Record<string, string>, userId?: string): Promise<void> {
  for (const [key, value] of Object.entries(settings)) {
    await updateSetting(key, value, userId);
  }
}

// ═══════════════════════════════════════════════════════════════
// sync_connectivity_log
// ═══════════════════════════════════════════════════════════════

export interface ConnectivityLogEntry {
  instanceId: string;
  vesselId: string | null;
  outcome: 'success' | 'network_unreachable' | 'timeout' | 'server_error' | 'client_error' | 'unknown_error' | 'skipped_reentrant' | 'skipped_disabled';
  errorMessage?: string | null;
  errorCategory?: string | null;
  latencyMs?: number | null;
  batchUuid?: string | null;
  recordsPushed?: number;
  recordsPulled?: number;
  catchUpCycle?: number;
  triggerType?: 'auto' | 'manual' | 'catch_up';
}

export async function insertConnectivityLog(entry: ConnectivityLogEntry): Promise<void> {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO sync_connectivity_log
       (instance_id, vessel_id, outcome, error_message, error_category, latency_ms,
        batch_uuid, records_pushed, records_pulled, catch_up_cycle, trigger_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      entry.instanceId,
      entry.vesselId,
      entry.outcome,
      entry.errorMessage ?? null,
      entry.errorCategory ?? null,
      entry.latencyMs ?? null,
      entry.batchUuid ?? null,
      entry.recordsPushed ?? 0,
      entry.recordsPulled ?? 0,
      entry.catchUpCycle ?? 0,
      entry.triggerType ?? 'auto',
    ]
  );
}

export async function getConnectivityLogs(
  vesselId: string,
  limit: number = 100,
  sinceHoursAgo?: number,
): Promise<any[]> {
  const pool = await getPool();
  let query = `SELECT * FROM sync_connectivity_log WHERE vessel_id = $1`;
  const params: any[] = [vesselId];
  if (sinceHoursAgo) {
    query += ` AND attempted_at >= NOW() - interval '${sinceHoursAgo} hours'`;
  }
  query += ` ORDER BY attempted_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);
  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Count unsynced field logs for a vessel — used by catch-up logic to decide
 * whether another consecutive sync cycle is needed.
 */
export async function getUnsyncedFieldLogCount(
  instanceId: string,
  vesselId: string,
  vesselCode?: string | null,
): Promise<number> {
  const pool = await getPool();
  const vesselValues = [vesselId];
  if (vesselCode && vesselCode !== vesselId) vesselValues.push(vesselCode);
  const placeholders = vesselValues.map((_, i) => `$${i + 2}`).join(', ');
  const result = await pool.query(
    `SELECT count(*)::int AS c FROM sync_field_log
     WHERE instance_id = $1
       AND vessel_id IN (${placeholders})
       AND is_synced = false`,
    [instanceId, ...vesselValues]
  );
  return result.rows[0]?.c ?? 0;
}
