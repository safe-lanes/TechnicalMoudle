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

import { getPool } from '../../db';
import * as syncRepo from './repository';
import {
  getTablesByCategory,
  getTableSyncConfig,
  getSyncPhaseOrder,
  type TableSyncConfig,
} from '../../../shared/syncConfig';

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
}

export interface ProvisioningBundle {
  manifest: ProvisioningManifest;
  data: { tableName: string; rows: any[] }[];
}

// ── Bundle Generation (Shore side) ──

export async function generateProvisioningBundle(
  vesselId: string,
  generatedBy: string
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

  return bundle;
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
  tablesImported: number;
  rowsImported: number;
  errors: string[];
}> {
  const pool = await getPool();
  let tablesImported = 0;
  let rowsImported = 0;
  const errors: string[] = [];

  console.log(
    `[Provisioning] Importing bundle for vessel ${bundle.manifest.vesselId}`
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

      // Advance sequences for tables where GENERATED ALWAYS columns were skipped
      if (alwaysCols.size > 0 && tableRowCount > 0) {
        const alwaysColNames = Array.from(alwaysCols);
        for (let ci = 0; ci < alwaysColNames.length; ci++) {
          const col = alwaysColNames[ci];
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

  // Set up sync_metadata for this ship instance
  try {
    const instanceId = process.env.SYNC_INSTANCE_ID || 'UNKNOWN';
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

  console.log(
    `[Provisioning] Import complete: ${tablesImported} tables, ${rowsImported} rows, ${errors.length} errors`
  );

  return {
    success: errors.length === 0,
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
      tableName === 'change_request_comment'
    ) {
      const result = await pool.query(
        `SELECT a.* FROM "${tableName}" a JOIN change_request cr ON a.change_request_id = cr.id WHERE cr.vessel_id = $1 AND COALESCE(a.is_deleted, false) = false`,
        [vesselId]
      );
      return result.rows;
    }

    // Fallback — export all
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
