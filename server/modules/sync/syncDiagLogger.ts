/**
 * Sync Diagnostic Logger — Persistent file + console logging for sync operations.
 *
 * Writes to both console.log AND a daily log file under .private/sync-logs/.
 * Log files are named sync-diag-YYYY-MM-DD.log and auto-rotate daily.
 *
 * Usage:
 *   import { syncDiag } from './syncDiagLogger';
 *   syncDiag('PUSH START: gathering field logs', { count: 42 });
 */

import fs from 'fs';
import path from 'path';

const LOG_DIR = process.env.SYNC_LOG_DIR || path.resolve(process.cwd(), '.private', 'sync-logs');

function getLogFile(): string {
  return path.join(LOG_DIR, `sync-diag-${new Date().toISOString().split('T')[0]}.log`);
}

// Ensure log directory exists on module load
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}

/**
 * Write a diagnostic log line to both console and persistent file.
 *
 * @param message - Human-readable log message
 * @param data - Optional structured data (object, string, or number)
 */
export function syncDiag(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const line = data !== undefined
    ? `[${timestamp}] [SyncDiag] ${message} ${typeof data === 'string' ? data : JSON.stringify(data)}`
    : `[${timestamp}] [SyncDiag] ${message}`;

  // Console
  console.log(line);

  // File — append (best-effort, never throw)
  try {
    fs.appendFileSync(getLogFile(), line + '\n');
  } catch {}
}

/** Get the path to today's log file (for the download API) */
export function getSyncLogPath(): string {
  return getLogFile();
}

/** Get the log directory path (for listing available logs) */
export function getSyncLogDir(): string {
  return LOG_DIR;
}
