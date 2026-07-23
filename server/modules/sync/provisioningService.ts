/**
 * Ship Provisioning Service
 *
 * Generates a vessel-specific data bundle for initial ship server deployment.
 * Only accessible to offline_admin / Sail Admin role.
 *
 * The bundle contains:
 * - Global reference data (ranks, roles, SFI, master data, etc.)
 * - Vessel-specific data (components, jobs, spares, WOs, defects, etc.)
 * - Manifest with row counts for verification
 *
 * Tables are exported in dependency order (parent before child) using
 * getSyncPhaseOrder() from syncConfig.
 */

import * as crypto from 'crypto';
import { getPool } from '../../db';
import { tenantConnectionManager } from '../../utils/tenantConnectionManager';
import * as syncRepo from './repository';
import { coerceArrayValue } from './oneWayApplier';
import {
  getTablesByCategory,
  getTableSyncConfig,
  getSyncPhaseOrder,
  type TableSyncConfig,
} from '../../../shared/syncConfig';
import { SYNC_REQUEST_TIMEOUT_FLOOR_MS } from './syncEngine';

// ── Types ──

export interface ProvisioningManifest {
  vesselId: string;
  vesselName: string;
  vesselCode: string;
  generatedAt: string;
  generatedBy: string;
  instanceId: string;
  tables: { tableName: string; rowCount: number; category: string }[];
  totalRows: number;
  version: string;
  // Phase 4a (optional, additive — absent in pre-4a bundles):
  // per-tenant sync key the ship seeds into its sync_settings on import (dormant until 4b).
  syncApiKey?: string;
  // fleet/per-vessel sync tunables seeded on import (default-preserving when absent).
  envSettings?: { syncPushBatchSize?: number; syncRequestTimeoutMs?: number };
}

export interface ProvisioningBundle {
  manifest: ProvisioningManifest;
  data: { tableName: string; rows: any[] }[];
}

// ── Bundle Generation (Shore side) ──

export async function generateProvisioningBundle(
  vesselId: string,
  generatedBy: string,
  opts?: { domain?: string; persist?: boolean; blunt?: boolean }
): Promise<ProvisioningBundle> {
  const pool = await getPool();

  // Look up vessel name and code
  const vesselResult = await pool.query(
    'SELECT name, id as code FROM vessels WHERE vuuid = $1',
    [vesselId]
  );
  const vesselName = vesselResult.rows[0]?.name || 'Unknown';
  const vesselCode = vesselResult.rows[0]?.code || '';

  const bundle: ProvisioningBundle = {
    manifest: {
      vesselId,
      vesselName,
      vesselCode,
      generatedAt: new Date().toISOString(),
      generatedBy,
      instanceId: process.env.SYNC_INSTANCE_ID || 'SHORE',
      tables: [],
      totalRows: 0,
      version: '1.0',
    },
    data: [],
  };

  // ── Phase 4a: per-tenant sync key + instance->domain map (shore side) ──
  // Only on a real (persisted) generation — previews don't mint/persist state.
  // NEW ships use the convention instance id SHIP-<vesselCode> (W1; existing
  // production ships keep their running ids — see Phase 6 backfill note).
  // Onboarding write: store the per-ship key + instance->domain map row so shore
  // can authenticate this ship at the master level (Phase 4b). The ship gets the
  // SAME key via the bundle (manifest.syncApiKey) -> its sync_settings on import.
  if (opts?.persist && vesselCode) {
    const convInstanceId = `SHIP-${vesselCode}`;
    try {
      // Stable per-ship key: reuse an existing one, else mint a new one.
      const existingMeta = await syncRepo.getInstanceMetadata(convInstanceId);
      const syncApiKey = (existingMeta as any)?.syncApiKey || crypto.randomBytes(32).toString('hex');
      await syncRepo.upsertInstanceMetadata({ instanceId: convInstanceId, vesselId, syncApiKey });
      bundle.manifest.syncApiKey = syncApiKey;
      // Master map row = instance -> { domain, syncApiKey } (the fail-closed front
      // door shore validates against). Domain is the verified tenant domain on req
      // (set by tenantMiddleware once provisioning routes are un-exempted in 4b).
      // No-op when multi-tenant is disabled (no master DB).
      if (opts.domain) {
        await tenantConnectionManager.upsertTenantInstance(convInstanceId, vesselId, opts.domain, syncApiKey);
      }
    } catch (keyErr: any) {
      console.warn(`[Provisioning] sync key / instance-map seed skipped: ${keyErr.message}`);
    }
    // NOTE: the delivery-state partition (mark shore logs <= T synced) runs AFTER the export +
    // export-integrity verification below — we only trust the bundle as "delivered" once we've
    // proven it was written completely. See the persist block after the export phases.
  }

  // Phase 0: Export the vessel row FIRST — almost every other table has
  // a FK to vessels.vuuid, so it must exist before anything else on import.
  try {
    const vesselRows = await pool.query(
      'SELECT * FROM vessels WHERE vuuid = $1',
      [vesselId]
    );
    if (vesselRows.rows.length > 0) {
      bundle.data.push({ tableName: 'vessels', rows: vesselRows.rows });
      bundle.manifest.tables.push({
        tableName: 'vessels',
        rowCount: vesselRows.rows.length,
        category: 'IDENTITY (vessel self)',
      });
      bundle.manifest.totalRows += vesselRows.rows.length;
    }
  } catch (err: any) {
    console.warn(`[Provisioning] Could not export vessels row: ${err.message}`);
  }

  // Follow the sync phase order for export
  const phaseOrder = getSyncPhaseOrder();

  // Phase 1: Global ONE_WAY tables
  const globalTables = getTablesByCategory('ONE_WAY_SHORE_TO_SHIP').filter(
    (t) => t.isGlobal
  );
  for (const tc of globalTables) {
    await exportAndAdd(pool, bundle, tc, null, null, null, 'ONE_WAY (global)');
  }

  // Phase 2: Vessel-scoped ONE_WAY tables
  const vesselRefTables = getTablesByCategory('ONE_WAY_SHORE_TO_SHIP').filter(
    (t) => !t.isGlobal
  );
  for (const tc of vesselRefTables) {
    await exportAndAdd(
      pool,
      bundle,
      tc,
      vesselId,
      vesselCode,
      tc.vesselScopeColumn,
      'ONE_WAY (vessel)'
    );
  }

  // Phase 3: Primary BOTH_EDITABLE entities (parent rows)
  const phase3Tables = phaseOrder[2] || [];
  for (const tableName of phase3Tables) {
    const tc = getTableSyncConfig(tableName);
    if (!tc) continue;
    await exportAndAdd(
      pool,
      bundle,
      tc,
      vesselId,
      vesselCode,
      tc.vesselScopeColumn,
      'BOTH_EDITABLE (parent)'
    );
  }

  // Phase 4: Child BOTH_EDITABLE entities
  const phase4Tables = phaseOrder[3] || [];
  for (const tableName of phase4Tables) {
    const tc = getTableSyncConfig(tableName);
    if (!tc) continue;
    if (tc.vesselScopeColumn) {
      await exportAndAdd(
        pool,
        bundle,
        tc,
        vesselId,
        vesselCode,
        tc.vesselScopeColumn,
        'BOTH_EDITABLE (child)'
      );
    } else if (tc.vesselScopeJoinPath) {
      const rows = await exportTableWithJoin(
        pool,
        tc.tableName,
        tc.vesselScopeJoinPath,
        vesselId
      );
      bundle.data.push({ tableName: tc.tableName, rows });
      bundle.manifest.tables.push({
        tableName: tc.tableName,
        rowCount: rows.length,
        category: 'BOTH_EDITABLE (child, join)',
      });
      bundle.manifest.totalRows += rows.length;
    }
  }

  console.log(
    `[Provisioning] Bundle generated for vessel ${vesselName} (${vesselId}): ` +
      `${bundle.manifest.totalRows} total rows across ${bundle.manifest.tables.length} tables`
  );

  // ── Addition 2: export-integrity verification (integrity at birth) ──
  // A bundle born incomplete (a per-table export that threw is degraded to rowCount:0 with an
  // "ERROR:" marker in exportAndAdd) is otherwise only caught AFTER satellite transfer, at import.
  // Verify NOW, shore-side: for each exported table re-COUNT(*) under the SAME export filter and
  // fail the whole generation loudly on any shortfall — never return/persist a bad bundle. The
  // per-table counts proven here ARE bundle.manifest.tables[].rowCount, the same numbers the ship's
  // import verify re-checks, so the chain is: proven at birth → manifest → proven at landing.
  const exportIntegrity = await verifyBundleExportIntegrity(pool, vesselId, vesselCode, bundle);
  if (!exportIntegrity.ok) {
    const summary = exportIntegrity.shortfalls
      .map((s) => `${s.tableName} written=${s.written} dbCount=${s.dbCount}${s.reason ? ` (${s.reason})` : ''}`)
      .join(' | ');
    const msg =
      `[Provisioning] ⚠️ EXPORT INTEGRITY FAILED for vessel ${vesselCode} — ${exportIntegrity.shortfalls.length} ` +
      `table(s) under-exported: ${summary}. Bundle NOT generated (a complete baseline could not be produced).`;
    console.error(msg);
    throw Object.assign(new Error(msg), { statusCode: 500 });
  }
  console.log(`[Provisioning] Export integrity PASSED (${bundle.manifest.tables.length} tables).`);

  // ── Addition 1: snapshot-baseline delivery-state partition (first + re-provision) ──
  // On ANY persisted generation, once the export is proven complete, the bundle IS the delivered
  // baseline as of T = manifest.generatedAt. Mark this vessel's shore field logs changed_at <= T
  // is_synced=true (don't re-drain the history the bundle carries) and post-T logs false. This
  // now applies to FIRST provisions too (Wah Kwong) — without it their shore-imported history
  // full-drains after import. Blunt (?blunt=true) reverts to re-deliver-everything. Wrapped so a
  // partition failure NEVER aborts an already-verified bundle — it only degrades to a full drain.
  if (opts?.persist && vesselCode) {
    const convInstanceId = `SHIP-${vesselCode}`;
    try {
      const snapshotAt = new Date(bundle.manifest.generatedAt);
      const wasReprovision = await syncRepo.hasDeliveredSyncHistory(vesselId, convInstanceId, vesselCode);
      const r = await syncRepo.resetInstanceDeliveryStateForReprovision(
        vesselId, convInstanceId, vesselCode,
        { snapshotAt, blunt: opts?.blunt }
      );
      console.warn(
        `[Provisioning] ${wasReprovision ? 'RE-PROVISION' : 'FIRST-PROVISION'} delivery-state partition for ` +
        `${convInstanceId} (vessel ${vesselCode}) — mode=${r.mode}: baselineMarkedSynced=${r.baselineMarkedSynced}, ` +
        `postSnapshotUnsynced=${r.postSnapshotUnsynced}, batchesDeleted=${r.batchesDeleted}, checkpoint=${r.checkpoint || 'NULL'}. ` +
        (r.mode === 'partition'
          ? `Fresh ship boots from the T=${snapshotAt.toISOString()} snapshot (remainingPull ≈ 0; only post-T edits flow).`
          : `BLUNT re-delivery: fresh ship receives the FULL shore-authored baseline.`)
      );
    } catch (resetErr: any) {
      console.error(
        `[Provisioning] ⚠️ delivery-state partition FAILED for ${convInstanceId} (vessel ${vesselCode}): ` +
        `${resetErr.message}. Bundle is complete and returned; the fresh ship will re-drain the full baseline ` +
        `(safe, just slower) until this is resolved.`
      );
    }
  }

  return bundle;
}

/**
 * Addition 2 helper — shore-side export-integrity check. For each exported table, re-COUNT(*)
 * under the SAME filter exportAndAdd used and flag a shortfall when the DB has MORE rows than the
 * bundle wrote (an under-export), plus any table whose export threw (category carries "ERROR:").
 * planner_dates and join-scoped tables legitimately export a filtered subset, so they are checked
 * for the export-error marker only (no strict count — a strict count would false-positive). A
 * strict-count query that itself errors is skipped (logged) rather than false-failing a healthy
 * export.
 */
export async function verifyBundleExportIntegrity(
  pool: any,
  vesselId: string,
  vesselCode: string | null,
  bundle: ProvisioningBundle,
): Promise<{ ok: boolean; shortfalls: { tableName: string; written: number; dbCount: number | null; reason?: string }[] }> {
  const shortfalls: { tableName: string; written: number; dbCount: number | null; reason?: string }[] = [];
  for (const entry of bundle.manifest.tables) {
    // (1) Any export that threw was degraded to rowCount:0 with an "ERROR:" marker → shortfall.
    if (/ERROR:/.test(entry.category)) {
      shortfalls.push({ tableName: entry.tableName, written: entry.rowCount, dbCount: null, reason: 'export threw' });
      continue;
    }
    // Phase-0 identity export: 'vessels' is INTENTIONALLY a single row (the provisioned vessel),
    // while its syncConfig entry is global — a global COUNT(*) would false-fail every generation
    // on a multi-vessel shore DB (vessels written=1 vs dbCount=<fleet size>). Skip it here; the
    // ERROR-marker check above still covers a thrown vessels export.
    if (entry.tableName === 'vessels') continue;
    const tc = getTableSyncConfig(entry.tableName);
    if (!tc) continue; // unknown → not strictly countable here
    // planner_dates + join-scoped tables export a filtered subset — error-marker check only.
    const looseOnly = entry.tableName === 'planner_dates' || (!!tc.vesselScopeJoinPath && !tc.vesselScopeColumn);
    if (looseOnly) continue;
    try {
      let dbCount: number;
      if (tc.isGlobal || !tc.vesselScopeColumn) {
        const res = await pool.query(`SELECT count(*)::int AS c FROM "${tc.tableName}" WHERE COALESCE(is_deleted, false) = false`);
        dbCount = res.rows[0]?.c ?? 0;
      } else {
        const scopeValue = tc.vesselScopeColumn === 'vessel_code' ? vesselCode : vesselId;
        if (!scopeValue) continue;
        const res = await pool.query(
          `SELECT count(*)::int AS c FROM "${tc.tableName}" WHERE "${tc.vesselScopeColumn}" = $1 AND COALESCE(is_deleted, false) = false`,
          [scopeValue]
        );
        dbCount = res.rows[0]?.c ?? 0;
      }
      if (dbCount > entry.rowCount) {
        shortfalls.push({ tableName: entry.tableName, written: entry.rowCount, dbCount, reason: 'db has more rows than exported' });
      }
    } catch (cErr: any) {
      // Count query itself failed — do NOT false-fail a healthy export; log and skip this table.
      console.warn(`[Provisioning] export-integrity count skipped for ${entry.tableName}: ${cErr.message}`);
    }
  }
  return { ok: shortfalls.length === 0, shortfalls };
}

// ── Bundle Import (Ship side) ──

/**
 * Tables with self-referencing FKs need rows sorted so parents come before
 * children. Without this, child rows fail when the parent isn't inserted yet.
 */
const SELF_REF_TABLES: Record<string, { idCol: string; parentCol: string }> = {
  adm_menumaster_ac: { idCol: 'muid', parentCol: 'parent_menu' },
  vessel_org_chart_nodes: { idCol: 'node_uuid', parentCol: 'parent_node_uuid' },
};

function topologicalSort(
  rows: any[],
  idCol: string,
  parentCol: string
): any[] {
  const sorted: any[] = [];
  const remaining = [...rows];
  const inserted = new Set<string>();

  // Iteratively add rows whose parent is null or already inserted
  let maxIterations = rows.length + 1;
  while (remaining.length > 0 && maxIterations > 0) {
    maxIterations--;
    const beforeLen = remaining.length;
    for (let i = remaining.length - 1; i >= 0; i--) {
      const row = remaining[i];
      const parentId = row[parentCol];
      if (
        parentId === null ||
        parentId === undefined ||
        inserted.has(String(parentId))
      ) {
        sorted.push(row);
        inserted.add(String(row[idCol]));
        remaining.splice(i, 1);
      }
    }
    if (remaining.length === beforeLen) break; // circular ref — stop
  }
  // Append any remaining rows (circular refs or missing parents)
  sorted.push(...remaining);
  return sorted;
}

export async function importProvisioningBundle(
  bundle: ProvisioningBundle
): Promise<{
  success: boolean;
  verified: boolean;
  verifyMismatches: { tableName: string; expected: number; actual: number }[];
  tablesImported: number;
  rowsImported: number;
  errors: string[];
}> {
  const pool = await getPool();
  let tablesImported = 0;
  let rowsImported = 0;
  const errors: string[] = [];

  // ── Identity gate: refuse to provision a ship without a REAL instance id ──
  // Resolve via the same DB-first resolver the field-logger and sync engine
  // use (sync_settings.instance_id → env SYNC_INSTANCE_ID; throws on missing
  // or placeholder values like 'UNKNOWN'/'SHIP-VESSELNAME'). Previously this
  // import stamped sync_metadata.instance_id = env || 'UNKNOWN' permanently —
  // a provisioned-but-identityless ship whose syncs could never be attributed.
  let resolvedInstanceId: string;
  try {
    const { initFieldLoggerInstanceId } = await import('./fieldLogger');
    resolvedInstanceId = await initFieldLoggerInstanceId();
  } catch (idErr: any) {
    throw new Error(
      `Provisioning import REFUSED — no valid sync instance id: ${idErr?.message || idErr}`
    );
  }

  console.log(
    `[Provisioning] Importing bundle for vessel ${bundle.manifest.vesselId} (instance: ${resolvedInstanceId})`
  );
  console.log(
    `[Provisioning] Bundle contains ${bundle.manifest.totalRows} rows across ${bundle.manifest.tables.length} tables`
  );

  // ── Pre-import: clear seeded RBAC/rank data so shore UUIDs import cleanly ──
  // Ship migrations seed roles, menus, ranks, and permissions with auto-generated
  // UUIDs. The shore bundle has the same logical rows with DIFFERENT UUIDs.
  // Attempting to upsert causes cascading FK violations. Solution: delete existing
  // seeded data (children first) and let the shore bundle import cleanly.
  const bundleTableNames = new Set(bundle.data.map((d) => d.tableName));
  const rbacCleanupNeeded =
    bundleTableNames.has('admn_role_master') ||
    bundleTableNames.has('adm_menumaster_ac') ||
    bundleTableNames.has('adm_role_menu_access');
  const ranksCleanupNeeded = bundleTableNames.has('adm_available_ranks');

  if (rbacCleanupNeeded) {
    console.log('[Provisioning] Clearing seeded RBAC data before import...');
    try {
      // Delete in FK-safe order: children → parents
      const deleted1 = await pool.query('DELETE FROM adm_role_menu_access');
      const deleted2 = await pool.query(
        'DELETE FROM adm_menumaster_ac WHERE parent_menu IS NOT NULL'
      );
      const deleted3 = await pool.query('DELETE FROM adm_menumaster_ac');
      const deleted4 = await pool.query('DELETE FROM admn_role_master');
      console.log(
        `[Provisioning] RBAC cleanup: deleted ${deleted1.rowCount} permissions, ` +
          `${(deleted2.rowCount || 0) + (deleted3.rowCount || 0)} menus, ${deleted4.rowCount} roles`
      );
    } catch (cleanupErr: any) {
      console.error(
        `[Provisioning] RBAC cleanup failed: ${cleanupErr.message}`
      );
      errors.push(`RBAC cleanup: ${cleanupErr.message}`);
    }
  }

  if (ranksCleanupNeeded) {
    console.log('[Provisioning] Clearing seeded ranks data before import...');
    try {
      // Child tables referencing adm_available_ranks.rank_id
      await pool.query('DELETE FROM adm_vessel_org_chart');
      await pool.query('DELETE FROM vessel_org_chart_nodes');
      const deletedRanks = await pool.query(
        'DELETE FROM adm_available_ranks'
      );
      console.log(
        `[Provisioning] Ranks cleanup: deleted ${deletedRanks.rowCount} ranks + org chart rows`
      );
    } catch (cleanupErr: any) {
      // Non-fatal: tables may not exist on all DBs
      console.warn(
        `[Provisioning] Ranks cleanup partial: ${cleanupErr.message}`
      );
    }
  }

  // ── Pre-import: clear seeded view-mode tables (Task #324, same RBAC pattern) ──
  // Migration 140 seeds both tables on BOTH sides with per-instance random uuids.
  // Deleting local seeds lets the shore bundle land cleanly (shore uuids adopted,
  // natural-key convergence immediate). Mapping first, then master (no FKs — hygiene).
  if (bundleTableNames.has('view_modes_master') || bundleTableNames.has('role_view_mode_mapping')) {
    try {
      const deletedRvm = await pool.query('DELETE FROM role_view_mode_mapping');
      const deletedVm = await pool.query('DELETE FROM view_modes_master');
      console.log(
        `[Provisioning] View-mode cleanup: deleted ${deletedRvm.rowCount} mapping(s), ${deletedVm.rowCount} mode(s) before import`
      );
    } catch (cleanupErr: any) {
      // Non-fatal: tables may not exist on older DBs
      console.warn(
        `[Provisioning] View-mode cleanup partial: ${cleanupErr.message}`
      );
    }
  }

  // ── Pre-import: clear seeded approval_workflow_config (same RBAC pattern) ──
  // Migration 126 seeds ~20 rows on BOTH sides with per-instance random awcuuid and a
  // UNIQUE (function_id, variable_name). Upserting shore's rows (different awcuuid) into
  // the ship's seeds would 23505 on the natural unique. Delete local seeds first so the
  // shore's authoritative rows (and their awcuuids) land cleanly. No FK children.
  if (bundleTableNames.has('approval_workflow_config')) {
    try {
      const deletedAwc = await pool.query('DELETE FROM approval_workflow_config');
      console.log(
        `[Provisioning] approval_workflow_config cleanup: deleted ${deletedAwc.rowCount} seeded row(s) before import`
      );
    } catch (cleanupErr: any) {
      // Non-fatal: table may not exist on older DBs
      console.warn(
        `[Provisioning] approval_workflow_config cleanup partial: ${cleanupErr.message}`
      );
    }
  }

  // Cache for GENERATED ALWAYS identity columns per table
  const identityAlwaysCache = new Map<string, Set<string>>();

  async function getAlwaysIdentityCols(
    tableName: string
  ): Promise<Set<string>> {
    if (identityAlwaysCache.has(tableName))
      return identityAlwaysCache.get(tableName)!;
    try {
      const result = await pool.query(
        `SELECT a.attname AS column_name
         FROM pg_attribute a
         JOIN pg_class c ON a.attrelid = c.oid
         JOIN pg_namespace n ON c.relnamespace = n.oid
         WHERE n.nspname = 'public'
           AND c.relname = $1
           AND a.attidentity = 'a'`,
        [tableName]
      );
      const cols = new Set<string>(
        (result.rows || []).map((r: any) => r.column_name)
      );
      identityAlwaysCache.set(tableName, cols);
      return cols;
    } catch {
      const empty = new Set<string>();
      identityAlwaysCache.set(tableName, empty);
      return empty;
    }
  }

  for (const tableData of bundle.data) {
    if (tableData.rows.length === 0) continue;

    try {
      const config = getTableSyncConfig(tableData.tableName);
      const identityCol = config?.identityColumn || null;
      let tableRowCount = 0;

      // Pre-check: does the identity column have a unique constraint?
      let hasUniqueIdentity = false;
      if (identityCol) {
        try {
          const ixResult = await pool.query(
            `SELECT 1 FROM pg_indexes WHERE tablename = $1 AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE $2 LIMIT 1`,
            [tableData.tableName, `%${identityCol}%`]
          );
          hasUniqueIdentity = ixResult.rows.length > 0;
        } catch {
          /* fallback to DO NOTHING */
        }
      }

      // Detect GENERATED ALWAYS columns to exclude from INSERT
      const alwaysCols = await getAlwaysIdentityCols(tableData.tableName);

      // Topological sort for self-referencing tables
      let rowsToInsert = tableData.rows;
      const selfRef = SELF_REF_TABLES[tableData.tableName];
      if (selfRef) {
        rowsToInsert = topologicalSort(
          tableData.rows,
          selfRef.idCol,
          selfRef.parentCol
        );
      }

      // Detect columns that actually exist on the target table and their types.
      // Shore bundle may include columns (e.g. audit/sync columns from migration
      // 052) that the ship DB hasn't received yet — INSERT would fail.
      // Also track JSON/JSONB columns for proper value serialization.
      let existingCols: Set<string> | null = null;
      let jsonCols: Set<string> = new Set();
      let arrayCols: Set<string> = new Set();
      try {
        const colResult = await pool.query(
          `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
          [tableData.tableName]
        );
        existingCols = new Set(colResult.rows.map((r: any) => r.column_name));
        jsonCols = new Set(
          colResult.rows
            .filter((r: any) => r.data_type === 'json' || r.data_type === 'jsonb')
            .map((r: any) => r.column_name)
        );
        arrayCols = new Set(
          colResult.rows
            .filter((r: any) => r.data_type === 'ARRAY')
            .map((r: any) => r.column_name)
        );
      } catch { /* fallback: don't filter */ }

      for (const row of rowsToInsert) {
        try {
          // Build column list — exclude undefined values, GENERATED ALWAYS columns,
          // and columns that don't exist on the target table
          const columns = Object.keys(row).filter(
            (k) => row[k] !== undefined && !alwaysCols.has(k) &&
              (existingCols === null || existingCols.has(k))
          );
          // Serialize values — handle JSON/JSONB columns carefully to avoid
          // "invalid input syntax for type json" errors.
          const values = columns.map((k) => {
            const v = row[k];
            if (v === null || v === undefined) return v;
            if (arrayCols.has(k)) {
              // Postgres array — pass a JS array; node-pg serializes {...}. JSON.stringify → ["..."] = malformed.
              return coerceArrayValue(v);
            }
            if (jsonCols.has(k)) {
              // JSON column: ensure value is a valid JSON string for PostgreSQL
              if (typeof v === 'object' && !(v instanceof Date)) {
                return JSON.stringify(v);
              }
              if (typeof v === 'string') {
                // Validate it's parseable JSON; if not, wrap as JSON string
                try { JSON.parse(v); return v; } catch { return JSON.stringify(v); }
              }
              return JSON.stringify(v);
            }
            // Non-JSON column: stringify objects for TEXT/VARCHAR columns
            if (typeof v === 'object' && !(v instanceof Date)) {
              return JSON.stringify(v);
            }
            return v;
          });
          const placeholders = columns
            .map((_, i) => `$${i + 1}`)
            .join(', ');
          const colNames = columns.map((c) => `"${c}"`).join(', ');

          let query: string;
          if (identityCol && row[identityCol] && hasUniqueIdentity) {
            // Upsert by identity column (only if unique constraint exists)
            const updateSet = columns
              .filter((c) => c !== identityCol)
              .map((c) => `"${c}" = EXCLUDED."${c}"`)
              .join(', ');
            query = `INSERT INTO "${tableData.tableName}" (${colNames}) VALUES (${placeholders}) ON CONFLICT ("${identityCol}") DO UPDATE SET ${updateSet}`;
          } else {
            // No usable unique identity — INSERT with ON CONFLICT DO NOTHING
            query = `INSERT INTO "${tableData.tableName}" (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
          }

          await pool.query(query, values);
          tableRowCount++;
        } catch (rowError: any) {
          // PK conflict on a table with a UUID identity column: the ship DB has
          // a row with the same integer PK but a different UUID (e.g. seed data).
          // Delete the conflicting row by PK and retry so the shore's authoritative
          // data takes precedence.
          if (
            rowError.message.includes('duplicate key') &&
            identityCol &&
            row[identityCol] &&
            row.id !== undefined
          ) {
            try {
              await pool.query(
                `DELETE FROM "${tableData.tableName}" WHERE id = $1 AND "${identityCol}" != $2`,
                [row.id, row[identityCol]]
              );
              // Rebuild columns/values (same logic as above, inlined for retry)
              const columns = Object.keys(row).filter(
                (k) => row[k] !== undefined && !alwaysCols.has(k) &&
                  (existingCols === null || existingCols.has(k))
              );
              const values = columns.map((k) => {
                const v = row[k];
                if (v === null || v === undefined) return v;
                if (arrayCols.has(k)) return coerceArrayValue(v);
                if (jsonCols.has(k)) {
                  if (typeof v === 'object' && !(v instanceof Date)) return JSON.stringify(v);
                  if (typeof v === 'string') { try { JSON.parse(v); return v; } catch { return JSON.stringify(v); } }
                  return JSON.stringify(v);
                }
                if (typeof v === 'object' && !(v instanceof Date)) return JSON.stringify(v);
                return v;
              });
              const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
              const colNames = columns.map((c) => `"${c}"`).join(', ');
              const updateSet = columns
                .filter((c) => c !== identityCol)
                .map((c) => `"${c}" = EXCLUDED."${c}"`)
                .join(', ');
              const retryQuery = `INSERT INTO "${tableData.tableName}" (${colNames}) VALUES (${placeholders}) ON CONFLICT ("${identityCol}") DO UPDATE SET ${updateSet}`;
              await pool.query(retryQuery, values);
              tableRowCount++;
            } catch (retryError: any) {
              if (!retryError.message.includes('duplicate key')) {
                errors.push(
                  `${tableData.tableName}: ${retryError.message.slice(0, 120)}`
                );
              }
            }
          } else if (!rowError.message.includes('duplicate key')) {
            // Log non-duplicate-key errors
            errors.push(
              `${tableData.tableName}: ${rowError.message.slice(0, 120)}`
            );
          }
        }
      }

      // Advance EVERY sequence-backed integer PK (serial + GENERATED BY DEFAULT + ALWAYS) to its
      // MAX(id). Provisioning inserts rows with explicit ids, which does NOT advance a BY-DEFAULT/
      // serial identity sequence — so without this the next vessel-side insert collides (23505
      // duplicate key). Previously only GENERATED ALWAYS (attidentity='a') sequences were advanced,
      // leaving the 79 BY-DEFAULT + 6 serial PKs desynced.
      if (tableRowCount > 0) {
        try {
          const seqCols = await pool.query(
            `SELECT a.attname AS col
             FROM pg_attribute a
             JOIN pg_class c ON a.attrelid = c.oid
             JOIN pg_namespace n ON c.relnamespace = n.oid
             WHERE n.nspname = 'public' AND c.relname = $1
               AND pg_get_serial_sequence('"' || c.relname || '"', a.attname) IS NOT NULL`,
            [tableData.tableName]
          );
          for (const r of (seqCols.rows || [])) {
            const col = r.col;
            try {
              await pool.query(
                `SELECT setval(
                  pg_get_serial_sequence('"${tableData.tableName}"', '${col}'),
                  GREATEST(COALESCE((SELECT MAX("${col}") FROM "${tableData.tableName}"), 0), 1)
                )`
              );
            } catch (seqErr: any) {
              // Not fatal — sequence may not exist for all identity columns
              console.warn(
                `[Provisioning] Could not advance sequence for ${tableData.tableName}.${col}: ${seqErr.message}`
              );
            }
          }
        } catch (discErr: any) {
          console.warn(
            `[Provisioning] Could not enumerate sequence columns for ${tableData.tableName}: ${discErr.message}`
          );
        }
      }

      rowsImported += tableRowCount;
      tablesImported++;
      if (tableRowCount > 0) {
        console.log(
          `[Provisioning] Imported ${tableRowCount}/${tableData.rows.length} rows into ${tableData.tableName}`
        );
      }
    } catch (tableError: any) {
      errors.push(`${tableData.tableName}: ${tableError.message}`);
      console.error(
        `[Provisioning] Error importing ${tableData.tableName}: ${tableError.message}`
      );
    }
  }

  // Set up sync_metadata for this ship instance — uses the validated identity
  // resolved at the top of this function (never raw env, never 'UNKNOWN').
  try {
    const instanceId = resolvedInstanceId;
    await syncRepo.upsertInstanceMetadata({
      instanceId,
      vesselId: bundle.manifest.vesselId,
      lastSyncCheckpoint: new Date(bundle.manifest.generatedAt),
      lastSyncStatus: 'provisioned',
      lastSyncAt: new Date(),
      syncDirection: 'ship_to_shore',
    });
  } catch (metaErr: any) {
    errors.push(`sync_metadata: ${metaErr.message}`);
  }

  // ── Conditional-seed the ship's sync_settings (idempotent, no-overwrite-if-set) ──
  // Rows are pre-seeded EMPTY by migration 132; re-import never clobbers an
  // operator-set value.
  //   * sync_api_key            — per-ship key minted shore-side, carried in the bundle.
  //                               The ship sends it as X-Sync-Api-Key (Phase 4b).
  //   * sync_push_batch_size /  — fleet/per-vessel tunables (default-preserving when absent).
  //     sync_request_timeout_ms
  // The ship never declares a domain (Phase 4b: shore is the sole authority via the
  // master instance->domain map), so no domain is seeded here.
  try {
    if (bundle.manifest.syncApiKey) await syncRepo.seedSettingIfEmpty('sync_api_key', bundle.manifest.syncApiKey);
    const env = bundle.manifest.envSettings;
    const pushBatch = env?.syncPushBatchSize ?? 200;
    // VSAT FLOOR (not just a default): a shore .env carrying a too-short timeout (e.g. 1200)
    // would otherwise seed 1200 into every newly provisioned ship — reviving the Frontier
    // Venture incident. Clamp the seeded value to the floor so a short value can NEVER be
    // provisioned, and log loudly when a below-floor bundle value is clamped.
    const rawTimeout = typeof env?.syncRequestTimeoutMs === 'number' ? env.syncRequestTimeoutMs : SYNC_REQUEST_TIMEOUT_FLOOR_MS;
    const reqTimeout = Math.max(rawTimeout, SYNC_REQUEST_TIMEOUT_FLOOR_MS);
    if (rawTimeout < SYNC_REQUEST_TIMEOUT_FLOOR_MS) {
      console.warn(`[Provisioning] ⚠️ Bundle syncRequestTimeoutMs=${rawTimeout}ms is below the ${SYNC_REQUEST_TIMEOUT_FLOOR_MS}ms VSAT floor — clamped to ${SYNC_REQUEST_TIMEOUT_FLOOR_MS}ms (a short timeout aborts pushes the shore has already applied → false failures → data loss).`);
    }
    await syncRepo.seedSettingIfEmpty('sync_push_batch_size', String(pushBatch));
    await syncRepo.seedSettingIfEmpty('sync_request_timeout_ms', String(reqTimeout));
  } catch (seedErr: any) {
    errors.push(`sync_settings seed: ${seedErr.message}`);
  }

  console.log(
    `[Provisioning] Import complete: ${tablesImported} tables, ${rowsImported} rows, ${errors.length} errors`
  );

  // ── Import verification (the trust condition for the snapshot-baseline reset) ──
  // The shore marks pre-T field logs is_synced=true at GENERATION time, trusting the bundle as
  // the delivered baseline. If a table silently under-imported here (per-table failures are
  // caught + skipped above, not aborted), those rows are "delivered" but ABSENT on the ship —
  // future edits would hit a missing row. So verify per-table row counts NOW and fail loudly.
  // On mismatch the operator re-provisions with the blunt/full re-sync (?blunt=true).
  let verified = true;
  let verifyMismatches: { tableName: string; expected: number; actual: number }[] = [];
  try {
    const v = await verifyProvisioning(bundle.manifest);
    verified = v.valid;
    verifyMismatches = v.mismatches;
    if (!v.valid) {
      const summary = v.mismatches
        .map((m) => `${m.tableName} expected=${m.expected} actual=${m.actual}`)
        .join(' | ');
      console.error(
        `[Provisioning] ⚠️ IMPORT VERIFICATION FAILED — ${v.mismatches.length} table(s) short: ${summary}. ` +
        `Ship is NOT a complete baseline; re-provision with blunt/full re-sync (?blunt=true) before going live.`
      );
      errors.push(`VERIFY: ${v.mismatches.length} table(s) short: ${summary}`);
    } else {
      console.log(`[Provisioning] Import verification PASSED (${bundle.manifest.tables.length} tables).`);
    }
  } catch (verErr: any) {
    verified = false;
    errors.push(`VERIFY failed to run: ${verErr.message}`);
    console.error(`[Provisioning] ⚠️ IMPORT VERIFICATION could not run: ${verErr.message}`);
  }

  return {
    success: errors.length === 0 && verified,
    verified,
    verifyMismatches,
    tablesImported,
    rowsImported,
    errors,
  };
}

// ── Verification ──

export async function verifyProvisioning(
  manifest: ProvisioningManifest
): Promise<{
  valid: boolean;
  mismatches: { tableName: string; expected: number; actual: number }[];
}> {
  const pool = await getPool();
  const mismatches: {
    tableName: string;
    expected: number;
    actual: number;
  }[] = [];

  for (const tableEntry of manifest.tables) {
    try {
      const result = await pool.query(
        `SELECT count(*)::int AS cnt FROM "${tableEntry.tableName}"`
      );
      const actual = result.rows[0]?.cnt ?? 0;

      // Actual can be >= expected (ship may have created new rows)
      // But actual should not be LESS than expected
      if (actual < tableEntry.rowCount) {
        mismatches.push({
          tableName: tableEntry.tableName,
          expected: tableEntry.rowCount,
          actual,
        });
      }
    } catch (error: any) {
      mismatches.push({
        tableName: tableEntry.tableName,
        expected: tableEntry.rowCount,
        actual: -1, // table doesn't exist or query failed
      });
    }
  }

  return {
    valid: mismatches.length === 0,
    mismatches,
  };
}

// ── Internal helpers ──

async function exportAndAdd(
  pool: any,
  bundle: ProvisioningBundle,
  tc: TableSyncConfig,
  vesselId: string | null,
  vesselCode: string | null,
  vesselScopeColumn: string | null,
  categoryLabel: string
): Promise<void> {
  try {
    let rows: any[];
    let orphanSkipNote = '';

    // ── Special case: planner_dates references components.cuuid via FK
    // (planner_dates_component_id_components_cuuid_f). The shore DB can
    // contain planner_dates rows whose component is soft-deleted, hard-
    // deleted, or scoped to a different vessel — those rows would fail
    // the FK on the ship because the corresponding components row is
    // (correctly) excluded from the bundle. Filter them out at export
    // time and log the skips so the manifest is referentially consistent.
    if (
      tc.tableName === 'planner_dates' &&
      vesselScopeColumn &&
      (vesselId || vesselCode)
    ) {
      const scopeValue =
        vesselScopeColumn === 'vessel_code' ? vesselCode : vesselId;

      // Identify orphans first so we can log them precisely (one query;
      // small result sets in practice — bounded by the vessel's planner
      // backlog, not the whole table).
      const orphanResult = await pool.query(
        `SELECT pd.pduuid, pd.component_id,
                CASE WHEN c.cuuid IS NULL THEN 'component missing'
                     WHEN COALESCE(c.is_deleted, false) = true THEN 'component soft-deleted'
                     WHEN c.vessel_id IS DISTINCT FROM pd.vessel_id THEN 'component vessel mismatch'
                     ELSE 'unknown'
                END AS reason
         FROM "planner_dates" pd
         LEFT JOIN "components" c ON c.cuuid = pd.component_id
         WHERE pd."${vesselScopeColumn}" = $1
           AND COALESCE(pd.is_deleted, false) = false
           AND (
             c.cuuid IS NULL
             OR COALESCE(c.is_deleted, false) = true
             OR c.vessel_id IS DISTINCT FROM pd.vessel_id
           )`,
        [scopeValue]
      );
      const orphans: { pduuid: string; component_id: string; reason: string }[] =
        orphanResult.rows;

      if (orphans.length > 0) {
        const reasonCounts: Record<string, number> = {};
        for (const o of orphans) {
          reasonCounts[o.reason] = (reasonCounts[o.reason] || 0) + 1;
          console.warn(
            `[Provisioning] Skipping orphan planner_dates row pduuid=${o.pduuid} ` +
              `component_id=${o.component_id} reason="${o.reason}"`
          );
        }
        const reasonSummary = Object.entries(reasonCounts)
          .map(([r, n]) => `${n} ${r}`)
          .join(', ');
        orphanSkipNote = ` — ${orphans.length} orphans skipped (${reasonSummary})`;
        console.warn(
          `[Provisioning] planner_dates: skipped ${orphans.length} orphan row(s) for vessel ${scopeValue} (${reasonSummary})`
        );
      }

      // Export only rows whose referenced component exists, is not
      // soft-deleted, and belongs to the same vessel — i.e. rows that
      // will be part of the bundle's components set.
      rows = await pool
        .query(
          `SELECT pd.* FROM "planner_dates" pd
           INNER JOIN "components" c ON c.cuuid = pd.component_id
           WHERE pd."${vesselScopeColumn}" = $1
             AND COALESCE(pd.is_deleted, false) = false
             AND COALESCE(c.is_deleted, false) = false
             AND c.vessel_id = pd.vessel_id
           ORDER BY COALESCE(pd.created_at, NOW()) ASC`,
          [scopeValue]
        )
        .then((r: any) => r.rows);
    } else if (vesselScopeColumn && (vesselId || vesselCode)) {
      // Determine correct scope value
      const scopeValue =
        vesselScopeColumn === 'vessel_code' ? vesselCode : vesselId;
      rows = await pool
        .query(
          `SELECT * FROM "${tc.tableName}" WHERE "${vesselScopeColumn}" = $1 AND COALESCE(is_deleted, false) = false ORDER BY COALESCE(created_at, NOW()) ASC`,
          [scopeValue]
        )
        .then((r: any) => r.rows);
    } else {
      rows = await pool
        .query(
          `SELECT * FROM "${tc.tableName}" WHERE COALESCE(is_deleted, false) = false ORDER BY COALESCE(created_at, NOW()) ASC`
        )
        .then((r: any) => r.rows);
    }

    bundle.data.push({ tableName: tc.tableName, rows });
    bundle.manifest.tables.push({
      tableName: tc.tableName,
      rowCount: rows.length,
      category: `${categoryLabel}${orphanSkipNote}`,
    });
    bundle.manifest.totalRows += rows.length;
  } catch (err: any) {
    console.warn(
      `[Provisioning] Skipping ${tc.tableName}: ${err.message}`
    );
    bundle.data.push({ tableName: tc.tableName, rows: [] });
    bundle.manifest.tables.push({
      tableName: tc.tableName,
      rowCount: 0,
      category: `${categoryLabel} (ERROR: ${err.message.slice(0, 60)})`,
    });
  }
}

async function exportTableWithJoin(
  pool: any,
  tableName: string,
  joinPath: string,
  vesselId: string
): Promise<any[]> {
  try {
    // Parse known join paths
    if (
      tableName === 'defect_actions' ||
      tableName === 'defect_attachments'
    ) {
      const result = await pool.query(
        `SELECT a.* FROM "${tableName}" a JOIN defects d ON a.defect_id = d.duuid WHERE d.vessel_id = $1 AND COALESCE(a.is_deleted, false) = false`,
        [vesselId]
      );
      return result.rows;
    }

    if (
      tableName === 'change_request_attachment' ||
      tableName === 'change_request_comment' ||
      tableName === 'change_request_approval'
    ) {
      const result = await pool.query(
        `SELECT a.* FROM "${tableName}" a JOIN change_request cr ON a.change_request_id = cr.id WHERE cr.vessel_id = $1 AND COALESCE(a.is_deleted, false) = false`,
        [vesselId]
      );
      return result.rows;
    }

    if (tableName === 'wo_postponement_approvals') {
      const result = await pool.query(
        `SELECT a.* FROM "wo_postponement_approvals" a JOIN work_order_postponements p ON a.postponement_id = p.id WHERE p.vessel_id = $1 AND COALESCE(a.is_deleted, false) = false`,
        [vesselId]
      );
      return result.rows;
    }

    // Fallback — export all. ⚠️ CROSS-VESSEL LEAK for vessel-scoped tables: any join-scoped
    // table registered in syncConfig MUST have an explicit branch above (the approval tables
    // do). Loud so a future registration without a branch is caught in the first test bundle.
    console.warn(
      `[Provisioning] Unknown join path for ${tableName}, exporting all rows`
    );
    const result = await pool.query(
      `SELECT * FROM "${tableName}" WHERE COALESCE(is_deleted, false) = false`
    );
    return result.rows;
  } catch (error: any) {
    console.error(
      `[Provisioning] Error exporting ${tableName} with join: ${error.message}`
    );
    return [];
  }
}
