/**
 * Drift Detector — does each row still agree with its OWN newest field log?
 *
 * ORIGIN (Frontier Venture, 2026-07, the "39"): an 8-Jul completion save wrote 36 fields
 * to 39 work_orders rows. Every field whose log old_value was NULL landed. The only three
 * fields that already held a value — status / approval_tier / days_late — did not, and the
 * rows kept their pre-save values. The rows therefore contradicted their own newest field
 * log for 16 days and nothing noticed; it surfaced only because a client complained about
 * dashboard numbers. This scan reduces that to one day.
 *
 * SCOPE — read this before trusting it:
 *   DETECTS   local drift: a row's current column value vs that row's newest sync_field_log
 *             entry for the same field, on THIS instance. That is the CAUSE class — a write
 *             that logged one thing and stored another, or a later write that reverted a
 *             value without logging.
 *   DOES NOT  compare ship against shore. A divergence where both sides are internally
 *             consistent but disagree with each other is INVISIBLE here. Cross-instance
 *             reconciliation is Phase 3 and is a different mechanism (it needs both DBs).
 *
 * Read-only with respect to business data: it reports, it never repairs. Findings land in
 * sync_field_log_failures with kind='drift' (migration 143) so operators watch ONE list
 * alongside the Phase-0 lost-log records.
 *
 * Deliberate reporting decisions (these WILL appear in the first run — expected, not new bugs):
 *   - workOrderContextService's stuck-rejection corrective writes without a field log by
 *     design; rows it has touched are genuine local divergence and are reported.
 *   - adminController.repairRhTracking is likewise deliberately local-only and will report.
 *   Both are reported rather than allowlisted: they ARE divergence, and an allowlist would
 *   hide the same shape when it appears from a path we did not intend.
 */

import { getPool } from '../../db';
import { SYNC_CONFIG } from '@shared/syncConfig';
import { fieldNameToColumn } from './oneWayApplier';
import { syncDiag } from './syncDiagLogger';

/** Ignore logs newer than this — a row read mid-write would otherwise report false drift. */
const SETTLE_MINUTES = 5;
/** Only look at rows changed recently; a full-history scan is neither affordable nor useful. */
const DEFAULT_SINCE_DAYS = 30;
/** Per-table cap so one pathological table cannot starve the maintenance window. */
const DEFAULT_MAX_ROWS_PER_TABLE = 5000;

export interface DriftFinding {
  tableName: string;
  rowUuid: string;
  fieldName: string;
  expected: string | null;   // newest log's new_value
  actual: string | null;     // what the row holds now
  loggedAt: string;
  vesselId: string | null;
}

export interface DriftScanResult {
  tablesScanned: number;
  rowsCompared: number;
  fieldsCompared: number;
  findings: DriftFinding[];
  skippedTables: string[];
  durationMs: number;
  timestamp: string;
}

export interface DriftScanOptions {
  vesselId?: string;
  tables?: string[];
  sinceDays?: number;
  maxRowsPerTable?: number;
  /** Report only; do not write findings to sync_field_log_failures. */
  dryRun?: boolean;
}

/**
 * Date-SHAPED text only — ISO ("2026-07-20T09:33:25.400Z" / "2026-07-20 09:33:25") or the
 * JS Date.toString() form ("Mon Jul 20 2026 09:33:25 GMT+0530"). Deliberately strict: this
 * gates the date parse in valuesEqual, and a loose test would let `new Date("3")` equate
 * unrelated numeric strings.
 */
function looksLikeDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s) ||
         /^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{2} \d{4} \d{2}:\d{2}/.test(s);
}

/**
 * Compare a DB value against a field-log string value.
 *
 * The log stores everything as text, so every comparison is text-vs-typed and the
 * normalisation here IS the false-positive surface. Each rule below exists because the
 * naive String(a) === b comparison reports drift on a row that is perfectly correct.
 */
export function valuesEqual(dbValue: unknown, logValue: string | null): boolean {
  // NULL / empty-string equivalence. The logger writes '' for some cleared fields and
  // NULL for others; a row holding either is not drift.
  const dbEmpty = dbValue === null || dbValue === undefined || dbValue === '';
  const logEmpty = logValue === null || logValue === undefined || logValue === '';
  if (dbEmpty && logEmpty) return true;
  if (dbEmpty !== logEmpty) return false;

  const log = String(logValue);

  // Booleans: pg returns true/false, logs carry 'true'/'false' or 't'/'f'.
  if (typeof dbValue === 'boolean') {
    const l = log.toLowerCase();
    return dbValue === (l === 'true' || l === 't' || l === '1');
  }

  // Dates: pg returns Date objects; logs carry ISO or 'YYYY-MM-DD HH:MM:SS'. Compare by
  // instant, not by text, or every timestamp column reports drift forever.
  if (dbValue instanceof Date) {
    const parsed = new Date(log);
    if (!isNaN(parsed.getTime())) return dbValue.getTime() === parsed.getTime();
    return false;
  }

  // Numerics: 0 vs '0', 0.5 vs '0.50', numeric(10,2) '3.00' vs '3'.
  if (typeof dbValue === 'number') {
    const n = Number(log);
    return !isNaN(n) && n === dbValue;
  }

  // TEXT columns holding a timestamp. Found by the first full scan against a real DB:
  // spares_history.timestampUTC and spare_component_links.linkedAt store a JS
  // Date.toString() ("Mon Jul 20 2026 09:33:25 GMT+0530") while the log holds the ISO form
  // of the SAME instant. Text-compared these look like drift on every row forever.
  // BOTH sides must be date-SHAPED before we parse: `new Date("3")` is a valid Date in V8,
  // so an unguarded parse would silently equate unrelated numeric strings.
  if (typeof dbValue === 'string' && looksLikeDate(dbValue) && looksLikeDate(log)) {
    const a = new Date(dbValue).getTime(), b = new Date(log).getTime();
    if (!isNaN(a) && !isNaN(b)) return a === b;
  }
  if (typeof dbValue === 'string' && dbValue !== '' && log !== '') {
    const a = Number(dbValue), b = Number(log);
    if (!isNaN(a) && !isNaN(b) && String(dbValue).trim() !== '' && log.trim() !== '') {
      if (a === b) return true; // '3.00' vs '3' — equal as numbers, differ as text
    }
  }

  // Arrays / JSON: logs store these as JSON strings. Compare structurally so key order
  // and whitespace do not masquerade as drift.
  if (Array.isArray(dbValue) || (dbValue !== null && typeof dbValue === 'object')) {
    try {
      return JSON.stringify(dbValue) === JSON.stringify(JSON.parse(log));
    } catch {
      return JSON.stringify(dbValue) === log;
    }
  }

  return String(dbValue) === log;
}

/** Tables worth scanning: those that actually carry field logs. */
function scannableTables(): Array<{ tableName: string; identityColumn: string; vesselScopeColumn: string | null }> {
  const out: Array<{ tableName: string; identityColumn: string; vesselScopeColumn: string | null }> = [];
  for (const cfg of Object.values(SYNC_CONFIG)) {
    // Only BOTH_EDITABLE tables are field-log driven; ONE_WAY tables are full-row snapshots
    // and have no per-field log to compare against.
    if (cfg.category !== 'BOTH_EDITABLE') continue;
    if (!cfg.identityColumn) continue;
    out.push({
      tableName: cfg.tableName,
      identityColumn: cfg.identityColumn,
      vesselScopeColumn: cfg.vesselScopeColumn ?? null,
    });
  }
  return out;
}

export async function runDriftScan(opts: DriftScanOptions = {}): Promise<DriftScanResult> {
  const started = Date.now();
  const sinceDays = opts.sinceDays ?? DEFAULT_SINCE_DAYS;
  const maxRows = opts.maxRowsPerTable ?? DEFAULT_MAX_ROWS_PER_TABLE;
  const findings: DriftFinding[] = [];
  const skippedTables: string[] = [];
  let rowsCompared = 0, fieldsCompared = 0, tablesScanned = 0;

  const pool = await getPool();
  if (!pool) {
    return {
      tablesScanned: 0, rowsCompared: 0, fieldsCompared: 0, findings: [],
      skippedTables: ['(no database)'], durationMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    };
  }

  const targets = scannableTables().filter(t => !opts.tables || opts.tables.includes(t.tableName));

  for (const t of targets) {
    try {
      // Newest log per (row, field) inside the window, excluding anything still settling.
      const latest = await pool.query(
        `SELECT DISTINCT ON (row_uuid, field_name)
                row_uuid, field_name, new_value, changed_at, vessel_id
           FROM sync_field_log
          WHERE table_name = $1
            AND changed_at >= NOW() - ($2::int * INTERVAL '1 day')
            AND changed_at <= NOW() - ($3::int * INTERVAL '1 minute')
            AND COALESCE(is_deleted, false) = false
            ${opts.vesselId ? 'AND vessel_id = $4' : ''}
          ORDER BY row_uuid, field_name, changed_at DESC`,
        opts.vesselId ? [t.tableName, sinceDays, SETTLE_MINUTES, opts.vesselId]
                      : [t.tableName, sinceDays, SETTLE_MINUTES]
      );
      if (latest.rows.length === 0) { tablesScanned++; continue; }

      // Cap by ROW, not by log line, so a row is never half-compared.
      const byRow = new Map<string, typeof latest.rows>();
      for (const r of latest.rows) {
        if (!byRow.has(r.row_uuid)) {
          if (byRow.size >= maxRows) continue;
          byRow.set(r.row_uuid, [] as any);
        }
        byRow.get(r.row_uuid)!.push(r);
      }
      const uuids = Array.from(byRow.keys());
      if (uuids.length === 0) { tablesScanned++; continue; }

      const rows = await pool.query(
        `SELECT * FROM "${t.tableName}" WHERE "${t.identityColumn}" = ANY($1::text[])`,
        [uuids]
      );
      const rowByUuid = new Map<string, any>();
      for (const r of rows.rows) rowByUuid.set(String(r[t.identityColumn]), r);

      for (const [uuid, logs] of Array.from(byRow.entries())) {
        const row = rowByUuid.get(uuid);
        // Row absent entirely is a different class (deleted, or never applied) — the
        // self-heal path owns that. Not drift; do not report it here.
        if (!row) continue;
        rowsCompared++;
        for (const log of logs) {
          const col = fieldNameToColumn(log.field_name);
          if (!(col in row)) continue;   // unmapped/renamed column — not drift
          fieldsCompared++;
          if (!valuesEqual(row[col], log.new_value)) {
            findings.push({
              tableName: t.tableName,
              rowUuid: uuid,
              fieldName: log.field_name,
              expected: log.new_value,
              actual: row[col] === null || row[col] === undefined ? null : String(row[col]),
              loggedAt: new Date(log.changed_at).toISOString(),
              vesselId: log.vessel_id ?? null,
            });
          }
        }
      }
      tablesScanned++;
    } catch (err: any) {
      // One bad table must never abort the sweep — record and continue.
      skippedTables.push(`${t.tableName}: ${err?.message || err}`);
    }
  }

  if (!opts.dryRun && findings.length > 0) {
    await recordFindings(findings);
  }

  const result: DriftScanResult = {
    tablesScanned, rowsCompared, fieldsCompared, findings,
    skippedTables, durationMs: Date.now() - started,
    timestamp: new Date().toISOString(),
  };

  const msg = `DRIFT SCAN: ${findings.length} finding(s) across ${tablesScanned} table(s) — ` +
    `${rowsCompared} rows / ${fieldsCompared} fields compared in ${result.durationMs}ms` +
    (skippedTables.length ? ` — skipped: ${skippedTables.join('; ')}` : '');
  if (findings.length > 0) console.warn(`[DriftDetector] ⚠️ ${msg}`);
  else console.log(`[DriftDetector] ${msg}`);
  syncDiag(msg);

  return result;
}

/**
 * Persist findings to the shared operator surface. One OPEN row per
 * (kind, table, row, field) — repeat observations bump last_seen_at rather than piling up
 * (unique index uq_sflf_open_finding, migration 143).
 */
async function recordFindings(findings: DriftFinding[]): Promise<void> {
  const pool = await getPool();
  if (!pool) return;
  for (const f of findings) {
    try {
      await pool.query(
        `INSERT INTO sync_field_log_failures
           (kind, table_name, row_uuid, field_name, vessel_id, failed_fields, error, details, occurred_at, last_seen_at, resolved)
         VALUES ('drift', $1, $2, $3, $4, 1, $5, $6::jsonb, NOW(), NOW(), false)
         ON CONFLICT (kind, table_name, row_uuid, COALESCE(field_name, '')) WHERE resolved = false
         DO UPDATE SET last_seen_at = NOW(), details = EXCLUDED.details, error = EXCLUDED.error`,
        [
          f.tableName, f.rowUuid, f.fieldName, f.vesselId,
          `row value disagrees with its own newest field log (expected "${f.expected}", found "${f.actual}")`,
          JSON.stringify({ expected: f.expected, actual: f.actual, loggedAt: f.loggedAt }),
        ]
      );
    } catch (err: any) {
      // Best-effort, exactly like the un-swallow recorder: never let bookkeeping break the sweep.
      console.error(`[DriftDetector] could not record finding ${f.tableName}.${f.rowUuid}.${f.fieldName}: ${err?.message || err}`);
    }
  }
}

/** Open findings for the admin surface. */
export async function getOpenDrift(limit = 500): Promise<any[]> {
  const pool = await getPool();
  if (!pool) return [];
  const res = await pool.query(
    `SELECT id, table_name, row_uuid, field_name, vessel_id, error, details, occurred_at, last_seen_at
       FROM sync_field_log_failures
      WHERE kind = 'drift' AND resolved = false
      ORDER BY occurred_at DESC
      LIMIT $1`,
    [limit]
  );
  return res.rows;
}
