/**
 * Sync Health Monitor — Detects sync infrastructure health issues
 *
 * Health checks:
 *   1. Stale sync — no successful sync in > 48 hours
 *   2. Unresolved conflicts — conflicts older than 7 days
 *   3. Stuck file transfers — pending files older than 24 hours
 *   4. Log overflow — more than 100,000 unsynced field log entries
 *
 * Pattern follows PmsAlertEngine: class with start()/stop()/runHealthCheck()
 * Registered in server/routes.ts alongside other schedulers.
 */

import { getPool } from '../../db';

export interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'critical';
  checks: {
    staleSync: HealthCheckItem;
    unresolvedConflicts: HealthCheckItem;
    stuckFiles: HealthCheckItem;
    logOverflow: HealthCheckItem;
  };
  timestamp: string;
  durationMs: number;
}

export interface HealthCheckItem {
  status: 'ok' | 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
}

interface HealthThresholds {
  staleSyncHours: number;
  unresolvedConflictDays: number;
  stuckFileHours: number;
  logOverflowCount: number;
}

function getThresholds(): HealthThresholds {
  return {
    staleSyncHours: parseInt(process.env.SYNC_HEALTH_STALE_HOURS || '48', 10),
    unresolvedConflictDays: parseInt(process.env.SYNC_HEALTH_CONFLICT_DAYS || '7', 10),
    stuckFileHours: parseInt(process.env.SYNC_HEALTH_STUCK_FILE_HOURS || '24', 10),
    logOverflowCount: parseInt(process.env.SYNC_HEALTH_LOG_OVERFLOW || '100000', 10),
  };
}

/**
 * Check for stale sync — no successful sync batch completed in threshold hours.
 */
async function checkStaleSync(thresholds: HealthThresholds): Promise<HealthCheckItem> {
  const pool = await getPool();
  if (!pool) {
    return { status: 'warning', message: 'Database not available', value: 0, threshold: thresholds.staleSyncHours };
  }

  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM sync_batches
     WHERE status = 'completed'
       AND completed_at > NOW() - INTERVAL '1 hour' * $1`,
    [thresholds.staleSyncHours]
  );
  const recentCount = result.rows[0]?.count ?? 0;

  if (recentCount > 0) {
    return {
      status: 'ok',
      message: `${recentCount} sync(s) completed in last ${thresholds.staleSyncHours}h`,
      value: recentCount,
      threshold: thresholds.staleSyncHours,
    };
  }

  // Check if there are ANY batches at all (fresh install has none — not an error)
  const totalResult = await pool.query(`SELECT COUNT(*)::int AS count FROM sync_batches`);
  const totalBatches = totalResult.rows[0]?.count ?? 0;

  if (totalBatches === 0) {
    return {
      status: 'ok',
      message: 'No sync batches yet (fresh installation)',
      value: 0,
      threshold: thresholds.staleSyncHours,
    };
  }

  return {
    status: 'warning',
    message: `No successful sync in the last ${thresholds.staleSyncHours} hours`,
    value: 0,
    threshold: thresholds.staleSyncHours,
  };
}

/**
 * Check for unresolved conflicts older than threshold days.
 */
async function checkUnresolvedConflicts(thresholds: HealthThresholds): Promise<HealthCheckItem> {
  const pool = await getPool();
  if (!pool) {
    return { status: 'warning', message: 'Database not available', value: 0, threshold: thresholds.unresolvedConflictDays };
  }

  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM sync_conflicts
     WHERE resolution IS NULL
       AND is_deleted = false
       AND created_at < NOW() - INTERVAL '1 day' * $1`,
    [thresholds.unresolvedConflictDays]
  );
  const oldConflicts = result.rows[0]?.count ?? 0;

  if (oldConflicts === 0) {
    return {
      status: 'ok',
      message: 'No old unresolved conflicts',
      value: 0,
      threshold: thresholds.unresolvedConflictDays,
    };
  }

  return {
    status: oldConflicts > 10 ? 'critical' : 'warning',
    message: `${oldConflicts} unresolved conflict(s) older than ${thresholds.unresolvedConflictDays} days`,
    value: oldConflicts,
    threshold: thresholds.unresolvedConflictDays,
  };
}

/**
 * Check for stuck file transfers — pending files older than threshold hours.
 */
async function checkStuckFiles(thresholds: HealthThresholds): Promise<HealthCheckItem> {
  const pool = await getPool();
  if (!pool) {
    return { status: 'warning', message: 'Database not available', value: 0, threshold: thresholds.stuckFileHours };
  }

  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM sync_file_queue
     WHERE status IN ('pending', 'in_progress')
       AND is_deleted = false
       AND created_at < NOW() - INTERVAL '1 hour' * $1`,
    [thresholds.stuckFileHours]
  );
  const stuckFiles = result.rows[0]?.count ?? 0;

  if (stuckFiles === 0) {
    return {
      status: 'ok',
      message: 'No stuck file transfers',
      value: 0,
      threshold: thresholds.stuckFileHours,
    };
  }

  return {
    status: stuckFiles > 5 ? 'critical' : 'warning',
    message: `${stuckFiles} file transfer(s) stuck for over ${thresholds.stuckFileHours} hours`,
    value: stuckFiles,
    threshold: thresholds.stuckFileHours,
  };
}

/**
 * Check for log overflow — too many unsynced field log entries.
 */
async function checkLogOverflow(thresholds: HealthThresholds): Promise<HealthCheckItem> {
  const pool = await getPool();
  if (!pool) {
    return { status: 'warning', message: 'Database not available', value: 0, threshold: thresholds.logOverflowCount };
  }

  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM sync_field_log
     WHERE is_synced = false`
  );
  const unsyncedCount = result.rows[0]?.count ?? 0;

  if (unsyncedCount < thresholds.logOverflowCount) {
    return {
      status: 'ok',
      message: `${unsyncedCount.toLocaleString()} unsynced log entries (threshold: ${thresholds.logOverflowCount.toLocaleString()})`,
      value: unsyncedCount,
      threshold: thresholds.logOverflowCount,
    };
  }

  return {
    status: unsyncedCount > thresholds.logOverflowCount * 2 ? 'critical' : 'warning',
    message: `${unsyncedCount.toLocaleString()} unsynced log entries exceeds threshold of ${thresholds.logOverflowCount.toLocaleString()}`,
    value: unsyncedCount,
    threshold: thresholds.logOverflowCount,
  };
}

/**
 * Run full health check across all 4 dimensions.
 */
export async function runHealthCheck(): Promise<HealthCheckResult> {
  const start = Date.now();
  const thresholds = getThresholds();

  console.log('[SyncHealth] Running health check...');

  const [staleSync, unresolvedConflicts, stuckFiles, logOverflow] = await Promise.all([
    checkStaleSync(thresholds),
    checkUnresolvedConflicts(thresholds),
    checkStuckFiles(thresholds),
    checkLogOverflow(thresholds),
  ]);

  const checks = { staleSync, unresolvedConflicts, stuckFiles, logOverflow };
  const durationMs = Date.now() - start;

  // Overall status: worst of all checks
  const allStatuses = Object.values(checks).map(c => c.status);
  let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (allStatuses.includes('critical')) {
    overallStatus = 'critical';
  } else if (allStatuses.includes('warning')) {
    overallStatus = 'warning';
  }

  const result: HealthCheckResult = {
    status: overallStatus,
    checks,
    timestamp: new Date().toISOString(),
    durationMs,
  };

  console.log(`[SyncHealth] Health check complete in ${durationMs}ms — status: ${overallStatus}`);

  return result;
}

/**
 * Get table statistics for sync infrastructure tables.
 */
export async function getTableStats(): Promise<Record<string, { total: number; active: number }>> {
  const pool = await getPool();
  if (!pool) return {};

  const queries = [
    pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_synced = false)::int AS active FROM sync_field_log`),
    pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'in_progress')::int AS active FROM sync_batches`),
    pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress'))::int AS active FROM sync_file_queue`),
    pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE resolution IS NULL AND is_deleted = false)::int AS active FROM sync_conflicts`),
  ];

  const [fieldLog, batches, fileQueue, conflicts] = await Promise.all(queries);

  return {
    sync_field_log: { total: fieldLog.rows[0]?.total ?? 0, active: fieldLog.rows[0]?.active ?? 0 },
    sync_batches: { total: batches.rows[0]?.total ?? 0, active: batches.rows[0]?.active ?? 0 },
    sync_file_queue: { total: fileQueue.rows[0]?.total ?? 0, active: fileQueue.rows[0]?.active ?? 0 },
    sync_conflicts: { total: conflicts.rows[0]?.total ?? 0, active: conflicts.rows[0]?.active ?? 0 },
  };
}

// ═══════════════════════════════════════════════════════════════
// Scheduler class — follows PmsAlertEngine pattern
// ═══════════════════════════════════════════════════════════════

export class SyncHealthScheduler {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private checkIntervalMs = 6 * 60 * 60 * 1000; // 6 hours

  start(intervalMs?: number): void {
    if (this.isRunning) {
      console.log('[SyncHealth] Scheduler already running');
      return;
    }

    if (intervalMs) {
      this.checkIntervalMs = intervalMs;
    }

    console.log(`[SyncHealth] Starting scheduler (interval: ${this.checkIntervalMs / 1000 / 60 / 60} hours)`);

    // Defer initial health check to allow DB and migrations to complete (60s after boot)
    setTimeout(() => {
      runHealthCheck().catch(err => {
        console.error('[SyncHealth] Error during initial health check:', err);
      });
    }, 60_000);

    this.intervalId = setInterval(() => {
      runHealthCheck().catch(err => {
        console.error('[SyncHealth] Error during scheduled health check:', err);
      });
    }, this.checkIntervalMs);

    this.isRunning = true;
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[SyncHealth] Scheduler stopped');
  }
}

export const syncHealthScheduler = new SyncHealthScheduler();
