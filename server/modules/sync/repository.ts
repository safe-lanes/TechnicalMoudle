/**
 * Sync Repository — Database operations for the 5 sync tables
 *
 * Tables: sync_metadata, sync_field_log, sync_conflicts, sync_file_queue, sync_batches
 */

import { eq, and, ne, gt, desc, asc, inArray, isNull, sql } from 'drizzle-orm';
import { getDb } from '../../db';
import {
  syncMetadata, syncFieldLog, syncConflicts, syncFileQueue, syncBatches,
  type InsertSyncMetadata, type SyncMetadata,
  type SyncFieldLog,
  type InsertSyncConflict, type SyncConflict,
  type InsertSyncFileQueue, type SyncFileQueue,
  type InsertSyncBatch, type SyncBatch,
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
  limit: number = 1000
): Promise<SyncFieldLog[]> {
  const db = await getDb();
  return db.select().from(syncFieldLog)
    .where(and(
      eq(syncFieldLog.instanceId, instanceId),
      eq(syncFieldLog.vesselId, vesselId),
      eq(syncFieldLog.isSynced, false),
    ))
    .orderBy(asc(syncFieldLog.changedAt))
    .limit(limit);
}

export async function getFieldLogsSinceCheckpoint(
  vesselId: string,
  sinceTimestamp: Date | null,
  excludeInstanceId: string,
  limit: number = 5000
): Promise<SyncFieldLog[]> {
  const db = await getDb();
  const conditions = [
    eq(syncFieldLog.vesselId, vesselId),
    ne(syncFieldLog.instanceId, excludeInstanceId),
    eq(syncFieldLog.isSynced, false),
  ];
  if (sinceTimestamp) {
    conditions.push(gt(syncFieldLog.changedAt, sinceTimestamp));
  }
  return db.select().from(syncFieldLog)
    .where(and(...conditions))
    .orderBy(asc(syncFieldLog.changedAt))
    .limit(limit);
}

export async function markFieldLogsSynced(logUuids: string[], batchId: string): Promise<number> {
  if (logUuids.length === 0) return 0;
  const db = await getDb();
  const result = await db.update(syncFieldLog)
    .set({ isSynced: true, syncBatchId: batchId, updatedAt: new Date() })
    .where(inArray(syncFieldLog.logUuid, logUuids));
  return logUuids.length;
}

export async function getFieldLogCount(vesselId: string, isSynced: boolean): Promise<number> {
  const db = await getDb();
  const result = await db.select({ count: sql<number>`count(*)::int` })
    .from(syncFieldLog)
    .where(and(
      eq(syncFieldLog.vesselId, vesselId),
      eq(syncFieldLog.isSynced, isSynced),
    ));
  return result[0]?.count ?? 0;
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
}): Promise<SyncFileQueue> {
  const db = await getDb();
  const result = await db.insert(syncFileQueue).values(data).returning();
  return result[0];
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
