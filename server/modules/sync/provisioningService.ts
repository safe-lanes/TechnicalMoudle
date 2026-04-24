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

  // Also include the vessel row itself (NO_SYNC but needed for ship to know its own identity)
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

  console.log(
    `[Provisioning] Bundle generated for vessel ${vesselName} (${vesselId}): ` +
      `${bundle.manifest.totalRows} total rows across ${bundle.manifest.tables.length} tables`
  );

  return bundle;
}

// ── Bundle Import (Ship side) ──

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
        } catch { /* fallback to DO NOTHING */ }
      }

      for (const row of tableData.rows) {
        try {
          // Build column list — include ALL columns (provisioning preserves exact data)
          const columns = Object.keys(row).filter((k) => row[k] !== undefined);
          // Stringify JSON/JSONB values (objects/arrays become strings for pg parameterized queries)
          const values = columns.map((k) => {
            const v = row[k];
            if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
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
          // Log but continue
          if (!rowError.message.includes('duplicate key')) {
            errors.push(
              `${tableData.tableName}: ${rowError.message.slice(0, 120)}`
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
    if (vesselScopeColumn && (vesselId || vesselCode)) {
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
      category: categoryLabel,
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
