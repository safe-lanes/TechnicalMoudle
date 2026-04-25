/**
 * Sync Pruning Service — Automated cleanup of sync infrastructure tables
 *
 * Prevents unbounded growth of:
 *   - sync_field_log  (default: 90 days for synced entries)
 *   - sync_batches    (default: 365 days for completed batches)
 *   - sync_file_queue (default: 90 days for completed transfers)
 *   - sync_conflicts  (default: 180 days for resolved conflicts)
 *
 * Safety rules:
 *   - NEVER delete unsynced field logs (is_synced = false)
 *   - NEVER delete in-progress batches (status = 'in_progress')
 *   - NEVER delete unresolved conflicts (resolution IS NULL)
 *   - NEVER delete pending/in-progress file queue entries
 *
 * Pattern follows PmsAlertEngine: class with start()/stop()/runPruning()
 * Registered in server/routes.ts alongside other schedulers.
 */

import { getPool } from '../../db';
import * as syncRepo from './repository';

export interface PruneConfig {
  fieldLogDays: number;
  batchDays: number;
  fileQueueDays: number;
  conflictDays: number;
}

export interface PruneResult {
  fieldLogsDeleted: number;
  batchesDeleted: number;
  fileQueueDeleted: number;
  conflictsDeleted: number;
  totalDeleted: number;
  durationMs: number;
  timestamp: string;
}

async function getRetentionConfig(): Promise<PruneConfig> {
  // Try DB settings first, then env vars, then defaults
  let dbFieldLogDays: string | null = null;
  let dbBatchDays: string | null = null;
  try {
    const settings = await syncRepo.getAllSettings();
    dbFieldLogDays = settings['field_log_retention_days'] || null;
    dbBatchDays = settings['batch_retention_days'] || null;
  } catch {
    // DB not ready — use env/defaults
  }

  return {
    fieldLogDays: parseInt(dbFieldLogDays || process.env.SYNC_PRUNE_FIELD_LOG_DAYS || '90', 10),
    batchDays: parseInt(dbBatchDays || process.env.SYNC_PRUNE_BATCH_DAYS || '365', 10),
    fileQueueDays: parseInt(process.env.SYNC_PRUNE_FILE_QUEUE_DAYS || '90', 10),
    conflictDays: parseInt(process.env.SYNC_PRUNE_CONFLICT_DAYS || '180', 10),
  };
}

/**
 * Prune synced field logs older than retention period.
 * Safety: only deletes rows where is_synced = true AND changed_at < cutoff.
 */
async function pruneFieldLogs(config: PruneConfig): Promise<number> {
  const pool = await getPool();
  if (!pool) return 0;

  const result = await pool.query(
    `DELETE FROM sync_field_log
     WHERE is_synced = true
       AND changed_at < NOW() - INTERVAL '1 day' * $1
     RETURNING id`,
    [config.fieldLogDays]
  );
  return result.rowCount ?? 0;
}

/**
 * Prune completed/failed batches older than retention period.
 * Safety: only deletes rows where status IN ('completed', 'failed') AND started_at < cutoff.
 */
async function pruneBatches(config: PruneConfig): Promise<number> {
  const pool = await getPool();
  if (!pool) return 0;

  const result = await pool.query(
    `DELETE FROM sync_batches
     WHERE status IN ('completed', 'failed')
       AND started_at < NOW() - INTERVAL '1 day' * $1
     RETURNING id`,
    [config.batchDays]
  );
  return result.rowCount ?? 0;
}

/**
 * Prune completed/failed file queue entries older than retention period.
 * Safety: only deletes rows where status IN ('completed', 'failed') AND completed_at < cutoff.
 */
async function pruneFileQueue(config: PruneConfig): Promise<number> {
  const pool = await getPool();
  if (!pool) return 0;

  const result = await pool.query(
    `DELETE FROM sync_file_queue
     WHERE status IN ('completed', 'failed')
       AND completed_at IS NOT NULL
       AND completed_at < NOW() - INTERVAL '1 day' * $1
     RETURNING id`,
    [config.fileQueueDays]
  );
  return result.rowCount ?? 0;
}

/**
 * Prune resolved conflicts older than retention period.
 * Safety: only deletes rows where resolution IS NOT NULL AND resolved_at < cutoff.
 */
async function pruneConflicts(config: PruneConfig): Promise<number> {
  const pool = await getPool();
  if (!pool) return 0;

  const result = await pool.query(
    `DELETE FROM sync_conflicts
     WHERE resolution IS NOT NULL
       AND resolved_at IS NOT NULL
       AND resolved_at < NOW() - INTERVAL '1 day' * $1
     RETURNING id`,
    [config.conflictDays]
  );
  return result.rowCount ?? 0;
}

/**
 * Run full pruning cycle across all 4 sync tables.
 */
export async function runPruning(overrideConfig?: Partial<PruneConfig>): Promise<PruneResult> {
  const start = Date.now();
  const baseConfig = await getRetentionConfig();
  const config = { ...baseConfig, ...overrideConfig };

  console.log(`[SyncPruning] Starting prune cycle — retention: fieldLog=${config.fieldLogDays}d, batches=${config.batchDays}d, fileQueue=${config.fileQueueDays}d, conflicts=${config.conflictDays}d`);

  const fieldLogsDeleted = await pruneFieldLogs(config);
  const batchesDeleted = await pruneBatches(config);
  const fileQueueDeleted = await pruneFileQueue(config);
  const conflictsDeleted = await pruneConflicts(config);

  const totalDeleted = fieldLogsDeleted + batchesDeleted + fileQueueDeleted + conflictsDeleted;
  const durationMs = Date.now() - start;

  const result: PruneResult = {
    fieldLogsDeleted,
    batchesDeleted,
    fileQueueDeleted,
    conflictsDeleted,
    totalDeleted,
    durationMs,
    timestamp: new Date().toISOString(),
  };

  console.log(`[SyncPruning] Prune complete in ${durationMs}ms — deleted: fieldLogs=${fieldLogsDeleted}, batches=${batchesDeleted}, fileQueue=${fileQueueDeleted}, conflicts=${conflictsDeleted}, total=${totalDeleted}`);

  return result;
}

// ═══════════════════════════════════════════════════════════════
// Scheduler class — follows PmsAlertEngine pattern
// ═══════════════════════════════════════════════════════════════

export class SyncPruningScheduler {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private pruneIntervalMs = 24 * 60 * 60 * 1000; // 24 hours

  start(intervalMs?: number): void {
    if (this.isRunning) {
      console.log('[SyncPruning] Scheduler already running');
      return;
    }

    if (intervalMs) {
      this.pruneIntervalMs = intervalMs;
    }

    console.log(`[SyncPruning] Starting scheduler (interval: ${this.pruneIntervalMs / 1000 / 60 / 60} hours)`);

    // Defer initial prune to allow DB and migrations to complete (2 minutes after boot)
    setTimeout(() => {
      runPruning().catch(err => {
        console.error('[SyncPruning] Error during initial prune:', err);
      });
    }, 120_000);

    this.intervalId = setInterval(() => {
      runPruning().catch(err => {
        console.error('[SyncPruning] Error during scheduled prune:', err);
      });
    }, this.pruneIntervalMs);

    this.isRunning = true;
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[SyncPruning] Scheduler stopped');
  }
}

export const syncPruningScheduler = new SyncPruningScheduler();
