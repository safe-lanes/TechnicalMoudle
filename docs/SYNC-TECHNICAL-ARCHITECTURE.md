# Ship-Shore Sync — Technical Architecture

> **Version:** 1.6  
> **Last Updated:** 2026-05-15  
> **Domain Sign-Off:** Jeevan Naik, Rahul Singh Sisodiya, Sahil Puri (24-Apr-2026)  
> **Source of Truth:** `shared/syncConfig.ts`

---

## 1. Executive Summary

The Ship-Shore Sync system enables bidirectional data synchronization between a shore-based PMS server (managing the entire fleet) and ship-based PMS servers (one per vessel, operating offline). The same codebase runs on both sides — the `SYNC_INSTANCE_ID` environment variable (prefix `SHIP-` or `SHORE-`) determines the server's role.

**Approach:** Hybrid Delta Sync (Approach C)
- **ONE_WAY tables** use full-row snapshots (shore overwrites ship)
- **BOTH_EDITABLE tables** use field-level deltas via `sync_field_log` with conflict detection
- **SHIP_ONLY tables** use full-row push (ship overwrites shore)

**Key numbers:**
- 108 tables classified across 4 sync categories
- 41 ONE_WAY_SHORE_TO_SHIP tables
- 33 BOTH_EDITABLE tables (planner_dates reclassified in v1.3, locations + superintendent_notifications in v1.6)
- 6 SHIP_ONLY tables
- 28 NO_SYNC tables
- 33 API endpoints across 8 functional groups

---

## 2. Architecture Overview

```
┌─────────────────────────────────┐          ┌─────────────────────────────────┐
│         SHORE SERVER            │          │         SHIP SERVER             │
│  (SYNC_INSTANCE_ID=SHORE-XXX)  │          │  (SYNC_INSTANCE_ID=SHIP-XXX)   │
│                                 │          │                                 │
│  ┌──────────────┐               │          │               ┌──────────────┐ │
│  │ SyncEngine   │◄──HTTP/JSON──►│          │◄──HTTP/JSON──►│ SyncEngine   │ │
│  │ (singleton)  │               │          │               │ (singleton)  │ │
│  └──────┬───────┘               │          │               └──────┬───────┘ │
│         │                       │          │                      │         │
│  ┌──────▼───────┐               │          │               ┌──────▼───────┐ │
│  │ SyncService  │               │          │               │ SyncService  │ │
│  │ (protocol)   │               │          │               │ (protocol)   │ │
│  └──────┬───────┘               │          │               └──────┬───────┘ │
│         │                       │          │                      │         │
│  ┌──────▼───────┐               │          │               ┌──────▼───────┐ │
│  │ Repository   │               │          │               │ Repository   │ │
│  │ (sync tables)│               │          │               │ (sync tables)│ │
│  └──────┬───────┘               │          │               └──────┬───────┘ │
│         │                       │          │                      │         │
│  ┌──────▼───────┐               │          │               ┌──────▼───────┐ │
│  │  PostgreSQL  │               │          │               │  PostgreSQL  │ │
│  └──────────────┘               │          │               └──────────────┘ │
└─────────────────────────────────┘          └─────────────────────────────────┘
```

### Module Structure

All sync code lives under `server/modules/sync/`:

| File | Purpose |
|------|---------|
| `syncEngine.ts` | Orchestrates a complete sync cycle (INITIATE → PUSH → PULL → COMPLETE). Pull field-log section runs inside a trigger-bypass transaction (v1.4). |
| `service.ts` | Business logic for each protocol step. `receivePushData()` runs field-log apply inside a trigger-bypass transaction (v1.4). |
| `repository.ts` | Database operations for sync infrastructure tables |
| `controller.ts` | Express request handlers (22 endpoints) |
| `routes.ts` | Route registration with middleware |
| `fieldLogger.ts` | Logs field-level changes for BOTH_EDITABLE tables |
| `oneWayApplier.ts` | Upserts rows by UUID for one-way sync. `applyFieldLogInserts()` accepts optional `externalClient` for trigger-bypass transactions (v1.4). |
| `syncDiagLogger.ts` | Persistent diagnostic logging — writes to console AND daily files at `.private/sync-logs/sync-diag-YYYY-MM-DD.log` (v1.3) |
| `fileSyncProcessor.ts` | Chunked binary file transfer (256KB chunks, SHA-256 verification) |
| `provisioningService.ts` | Generates/imports vessel data bundles for initial ship deployment |
| `pruningService.ts` | Automated cleanup of sync infrastructure tables |
| `healthMonitor.ts` | Detects sync health issues (stale syncs, stuck files, etc.) |
| `conflictReviewRepository.ts` | Queries both conflict tables, apply/dismiss logic, audit trail (v1.5) |
| `conflictReviewController.ts` | 6 HTTP handlers for conflict review API (v1.5) |
| `middleware.ts` | Role-based access control (`requireOfflineAdmin`) |

### Shared Configuration

| File | Purpose |
|------|---------|
| `shared/syncConfig.ts` | Central registry of all 108 tables with sync classification |

### Frontend Components

| File | Route | Purpose |
|------|-------|---------|
| `client/src/pages/admin/SyncDashboard.tsx` | `/admin/sync-dashboard` | Sync status, manual trigger, batch history, conflicts |
| `client/src/pages/admin/SyncProvisioning.tsx` | `/admin/sync-provisioning` | Ship provisioning bundle generation/import |
| `client/src/pages/admin/SyncConflictReview.tsx` | `/admin/sync-conflicts` | Conflict review: unified view, apply/dismiss, bulk actions |
| `client/src/pages/admin/SyncFleetOverview.tsx` | `/admin/sync-fleet` | Shore-only: fleet-wide sync overview + settings |
| `client/src/hooks/useSyncInstanceInfo.ts` | — | Hook: caches ship/shore detection |

---

## 3. Table Classification

Every database table is classified in `shared/syncConfig.ts` into one of four categories.

### 3.1 ONE_WAY_SHORE_TO_SHIP (41 tables)

Shore is the authoritative source. Ship receives read-only copies. No conflict possible.

#### Global Tables (no vessel scope)

| Table | Identity Column | Notes |
|-------|----------------|-------|
| `makers` | `muuid` | Maker/manufacturer registry |
| `master_data` | `mduuid` | Global reference data |
| `master_lists` | `mluuid` | Master list values |
| `master_list_types` | `mltuuid` | Master list type registry |
| `equipment_categories` | `ecuuid` | Equipment categorization |
| `sfi_details` | `sfuuid` | SFI code hierarchy |
| `admn_role_master` | `aruuid` | Role definitions |
| `adm_menumaster_ac` | `amuuid` | Menu access config |
| `adm_role_menu_access` | `armuuid` | Role-menu mappings |
| `adm_available_ranks` | `aaruuid` | Available rank definitions |
| `fleet_classes` | `fcuuid` | Fleet class definitions |
| `fleet_groups` | `fguuid` | Fleet group definitions |
| `fleet_components` | `fleet_components_uuid` | Fleet component templates |
| `fleet_jobs` | `fleet_jobs_uuid` | Fleet job templates |
| `fleet_spares` | `fleet_spares_uuid` | Fleet spare templates |
| `fleet_component_mapping` | `fleet_component_mapping_uuid` | Fleet→vessel component mappings |
| `fleet_job_vessel_mapping` | `fleet_job_vessel_mapping_uuid` | Fleet→vessel job mappings |
| `fleet_spare_vessel_mapping` | `fleet_spare_vessel_mapping_uuid` | Fleet→vessel spare mappings |
| `fleet_vessel_mapping` | `fleet_vessel_mapping_uuid` | Fleet→vessel assignments |
| `defect_categories` | `dcuuid` | Defect classification |
| `defect_types` | `dtuuid` | Defect type definitions |
| `form_definitions` | `fduuid` | Dynamic form definitions |
| `form_versions` | `fvuuid` | Form version records |
| `alert_config` | `acuuid` | Alert configuration |
| `alert_policies` | `apuuid` | Alert policy rules |
| `ship_certificates_master` | `scmuuid` | Certificate master definitions |
| `ship_surveys_master` | `ssuuid` | Survey master definitions |
| `ship_certificates_labels_config` | `scluuid` | Certificate label config |
| `ship_surveys_labels_config` | `ssluuid` | Survey label config |
| `pms_vessel_settings` | `pvsuuid` | PMS settings per vessel |
| `company_standard_grace_settings` | `csguuid` | Grace period settings |
| `sync_settings` | `ssuuid` | Sync configuration settings |

#### Vessel-Scoped Tables

| Table | Identity Column | Vessel Scope Column | Notes |
|-------|----------------|-------------------|-------|
| `components` | `cuuid` | `vessel_id` | Component tree (ship reads only) |
| `jobs` | `juuid` | `vessel_id` | Job definitions (ship uses change_request) |
| `job_component_links` | — | `vessel_id` | Job↔component associations |
| `spares` | `suuid` | `vessel_id` | Spare part definitions |
| `spare_component_links` | — | `vessel_id` | Spare↔component associations |
| `stores_items` | `siuuid` | `vessel_id` | Store item definitions |
| `vessel_certificate_applicability` | `vcauuid` | `vessel_id` | Certificate applicability |
| `vessel_survey_applicability` | `vsauuid` | `vessel_id` | Survey applicability |
| `adm_vessel_org_chart` | `avocuuid` | `vessel_id` | Vessel org chart |

### 3.2 BOTH_EDITABLE (33 tables)

Both ship and shore can edit these tables. Uses field-level delta sync via `sync_field_log`. Conflicts are detected when both sides change the same field on the same row.

#### Work Order Domain

| Table | Identity Column | Vessel Scope | Notes |
|-------|----------------|-------------|-------|
| `work_orders` | `wouuid` | `vessel_id` | Core work orders |
| `work_order_executions` | `woeuuid` | `vessel_id` | WO execution records |
| `work_order_execution_details` | `woeduuid` | `vessel_id` | Execution detail entries |
| `work_order_postponements` | `wopuuid` | `vessel_id` | Postponement records |
| `work_order_documents` | — | `vessel_id` | Attached documents (binary file sync) |

#### Defect Domain

| Table | Identity Column | Vessel Scope | Notes |
|-------|----------------|-------------|-------|
| `defects` | `duuid` | `vessel_id` | Defect records. Business rule: only shore can set status='verified' |
| `defect_actions` | `dauuid` | Join via `defects` | Defect action items |
| `defect_attachments` | `datuuid` | Join via `defects` | URL-only references (no binary sync) |
| `defect_sequences` | `dsuuid` | `vessel_id` | Defect numbering sequences |

#### Spare Parts & Stores

| Table | Identity Column | Vessel Scope | Notes |
|-------|----------------|-------------|-------|
| `spares_history` | `shuuid` | `vessel_id` | Spare part transaction history |
| `spare_location_stock` | `slsuuid` | `vessel_id` | Stock levels by location |
| `stores_ledger` | `sluuid` | `vessel_id` | Stores ledger entries |
| `inventory_transactions` | `ituuid` | `vessel_id` | Inventory transaction log |

#### Change Request

| Table | Identity Column | Vessel Scope | Notes |
|-------|----------------|-------------|-------|
| `change_request` | `cruuid` | `vessel_id` | Modify PMS change requests |
| `change_request_attachment` | `crauuid` | Join via `change_request` | URL-only references |
| `change_request_comment` | `crcuuid` | Join via `change_request` | CR discussion comments |

#### Certificates & Surveys

| Table | Identity Column | Vessel Scope | Notes |
|-------|----------------|-------------|-------|
| `certificates` | — | `vessel_id` | Certificate records (text PK) |
| `surveys` | — | `vessel_id` | Survey records (text PK) |
| `vessel_certificate_data` | `vcduuid` | `vessel_id` | Vessel-specific cert dates |
| `vessel_survey_data` | `vsduuid` | `vessel_id` | Vessel-specific survey dates |

#### Running Hours & Maintenance

| Table | Identity Column | Vessel Scope | Notes |
|-------|----------------|-------------|-------|
| `running_hours_audit` | `rhauuid` | `vessel_id` | Running hours audit trail |
| `component_running_hours_log` | `crhluuid` | `vessel_code` | Component RH log (uses vessel_code) |
| `component_maintenance_history` | `cmhuuid` | `vessel_code` | INSERT-only immutable table |

#### Documents & Requisitions

| Table | Identity Column | Vessel Scope | Notes |
|-------|----------------|-------------|-------|
| `component_documents` | — | `vessel_code` | Component docs (binary file sync) |
| `component_requisitions` | — | `vessel_code` | Component spare requisitions |

#### IHM (Inventory of Hazardous Materials)

| Table | Identity Column | Vessel Scope | Notes |
|-------|----------------|-------------|-------|
| `ihm_items` | — | `vessel_id` | IHM items (integer PK) |
| `ihm_maintenance_log` | — | `vessel_id` | IHM maintenance log |

#### Planning (added v1.3)

| Table | Identity Column | Vessel Scope | Notes |
|-------|----------------|-------------|-------|
| `planner_dates` | `pduuid` | `vessel_id` | Maintenance planner dates. Shore sets planned dates, ship can adjust. Reclassified from NO_SYNC in v1.3 (fix 21, commit `05b87ed3`). Field logging wired to all 4 write paths in `workOrderPlannerService.ts`. |

#### Operational (added v1.6)

| Table | Identity Column | Vessel Scope | Notes |
|-------|----------------|-------------|-------|
| `locations` | `luuid` | `vessel_id` | Storage/equipment locations. Reclassified from NO_SYNC to BOTH_EDITABLE in v1.6 (fix 34, commit `ee8c9abf`). |
| `superintendent_notifications` | `snuuid` | `vessel_id` | WO approval notifications. Reclassified from NO_SYNC to BOTH_EDITABLE in v1.6 (fix 34, commit `ee8c9abf`). |

### 3.3 SHIP_ONLY (6 tables)

Ship is the authoritative source. Shore receives overwrites. All are noon report tables.

| Table | Identity Column | Vessel Scope | Notes |
|-------|----------------|-------------|-------|
| `nr_noon_reports` | `nruuid` | `vessel_id` | Noon reports |
| `nr_bunker_records` | `nbruuid` | `vessel_id` | Bunkering delivery records |
| `nr_alerts` | `nauuid` | `vessel_id` | Noon report threshold alerts |
| `nr_cii_tracking` | `nctuuid` | `vessel_id` | CII tracking per vessel |
| `nr_fuel_rob` | `nfruuid` | `vessel_id` | Fuel ROB per vessel/fuel type |
| `nr_voyage_legs` | `nvluuid` | `vessel_id` | Voyage leg tracking |

### 3.4 NO_SYNC (28 tables)

Never synced. Instance-local data only.

**Platform-provisioned (managed by SAILERP):**
`users`, `master_users`, `vessels`, `fleets`, `vessel_types`, `additional_groups`, `ports`

**Sync engine internal:**
`sync_metadata`, `sync_field_log`, `sync_conflicts`, `sync_file_queue`, `sync_batches`

**Local audit/import/reporting:**
`audit_log`, `import_history`, `import_change_log`, `bulk_import_history`, `bulk_import_errors`, `report_snapshots`, `report_favorites`, `monthly_snapshots`

**Local alert state:**
`alert_events`, `alert_deliveries`, `alert_acknowledgements`

**Local computation/planning:**
`work_order_anomalies`, ~~`planner_dates`~~ *(moved to BOTH_EDITABLE in v1.3)*, `schema_migrations`, `form_version_usage`, `recurring_defects`, `recurring_defect_links`

---

## 4. Sync Protocol Flow

The sync protocol follows a 5-step request-response pattern. The ship's `SyncEngine` drives the cycle.

```
Ship SyncEngine                           Shore API
     │                                        │
     │  1. POST /sync/initiate                │
     │  { instanceId, vesselId,               │
     │    lastCheckpoint }                    │
     │──────────────────────────────────────► │
     │                     { batchUuid }      │
     │◄────────────────────────────────────── │
     │                                        │
     │  2. POST /sync/push                    │
     │  { batchUuid, vesselId,                │
     │    oneWayRows[SHIP_ONLY],              │
     │    fieldLogs[BOTH_EDITABLE] }          │
     │──────────────────────────────────────► │
     │              { received, fieldLogsStored } │
     │◄────────────────────────────────────── │
     │                                        │
     │  3. POST /sync/pull                    │
     │  { batchUuid, vesselId,                │
     │    instanceId, lastCheckpoint }        │
     │──────────────────────────────────────► │
     │  { oneWayRows[ONE_WAY_SHORE_TO_SHIP], │
     │    fieldLogs[BOTH_EDITABLE],           │
     │    conflicts[] }                       │
     │◄────────────────────────────────────── │
     │                                        │
     │  4. POST /sync/resolve-conflict        │
     │  { conflictUuid, resolution,           │
     │    resolvedValue, resolvedBy }         │
     │──────────────────────────────────────► │
     │                    { resolved: true }  │
     │◄────────────────────────────────────── │
     │                                        │
     │  5. POST /sync/complete                │
     │  { batchUuid, vesselId, instanceId }   │
     │──────────────────────────────────────► │
     │     { newCheckpoint, durationMs }      │
     │◄────────────────────────────────────── │
     │                                        │
     │  6. File Sync (post field data)        │
     │  POST /sync/file/upload-chunk          │
     │  { queueUuid, chunkIndex,              │
     │    totalChunks, data, fileHash }       │
     │──────────────────────────────────────► │
     │                                        │
```

### Step Details

**1. INITIATE** (`service.ts → initiateSyncSession`)
- Auto-registers the ship instance in `sync_metadata` if not yet known
- Creates a new `sync_batches` row with status `in_progress`
- Returns `batchUuid` for all subsequent steps

**2. PUSH** (`service.ts → receivePushData`)
- Ship sends its SHIP_ONLY table rows (full snapshots) — applied via `oneWayApplier.ts`
- Ship sends its BOTH_EDITABLE field logs (unsynced changes) — stored in shore's `sync_field_log`
- Business rules enforced: e.g., defect verification from ship is rejected
- **Stale-log guard (v1.2):** UPDATE field logs are skipped if `changedAt < row.updated_at` to prevent old re-pushed logs from overwriting newer local edits
- **Trigger bypass (v1.4):** Field log apply (Phase 1 INSERTs + Phase 2 UPDATE passthrough) runs inside a `BEGIN / SET LOCAL sync.bypass_trigger = 'true' / COMMIT` transaction using a dedicated `pool.connect()` client. This prevents the `set_updated_at()` trigger from overriding `updated_at` with `NOW()`, preserving the original `changedAt` timestamp from the field log. See §4.1.
- Data sent in chunks of 200 records (`CHUNK_SIZE` in `syncEngine.ts`)

**3. PULL** (`service.ts → preparePullData` + `syncEngine.ts → executePull`)
- **Vessel-code resolution (v1.3):** Resolves `vesselId` (UUID) → `vesselCode` (e.g. "V001") via `getVesselCodeForUuid()`. Tables with `vesselScopeColumn='vessel_code'` (e.g. `fleet_vessel_mapping`, `master_data`) use the resolved code for queries. Field log queries use `IN (vesselId, vesselCode)` to match logs stored with either identifier.
- Shore gathers ONE_WAY_SHORE_TO_SHIP rows changed since checkpoint (`gatherOneWayShoreRows`)
- Shore gathers its own BOTH_EDITABLE field logs (excluding ship's own changes)
- **Conflict detection:** If both ship and shore changed the same field on the same row, a `sync_conflicts` record is created
- Non-conflicting shore changes are sent as field logs for ship to apply
- **Trigger bypass (v1.4):** Ship's `executePull()` applies received field logs inside a `BEGIN / SET LOCAL sync.bypass_trigger = 'true' / COMMIT` transaction. Both `applyFieldLogInserts()` and `applyFieldLog()` receive the transactional client so all UPDATEs preserve `changedAt` as the row's `updated_at`. See §4.1.

**4. RESOLVE** (`service.ts → resolveConflictAction`)
- Resolution options: `ship_wins`, `shore_wins`, `manual` (custom value)
- Auto-resolution: if both sides changed to the same value → `auto_same_value`
- Winning value is applied to the data table via direct SQL UPDATE

**5. COMPLETE** (`service.ts → completeSyncSession`)
- Marks all transferred field logs as synced (`is_synced = true`) on the shore DB
- **Ship-side marking (v1.2):** After COMPLETE succeeds, the engine marks pushed logUuids as synced in the ship's local DB. Without this, field logs would be re-pushed every sync cycle.
- **Vessel-code aware (v1.3):** Resolves vesselCode and passes to field log queries so logs stored with vessel_code are also found and marked as synced.
- Advances the checkpoint timestamp in `sync_metadata`
- Updates batch status to `completed` with duration

**6. FILE SYNC** (`fileSyncProcessor.ts`)
- Runs after field data sync is complete (non-fatal if it fails)
- `SyncEngine` passes `shoreBaseUrl` to `FileSyncProcessor` constructor (v1.3)
- Processes `sync_file_queue` entries for the vessel
- Files chunked into 256KB pieces, base64-encoded, **with file metadata in each chunk** (v1.3 — `fileKey`, `tableName`, `fileName`, `fileSizeBytes`, `vesselId`)
- Chunks sent via `POST {shoreUrl}/sync/file/upload-chunk`
- **Receiver creates mirror queue entry** via `queueFileWithUuid()` (v1.3 — ON CONFLICT DO NOTHING)
- SHA-256 hash verification on reassembly
- Assembled file saved to correct storage directory via `saveLocalFile()` using chunk metadata
- Resume from last successful chunk on interrupted transfer

### Retry & Error Handling

From `syncEngine.ts`:
- `MAX_RETRIES = 3`
- `RETRY_DELAYS = [5000, 15000, 45000]` (exponential backoff)
- `REQUEST_TIMEOUT = 30000` (30 seconds per API call)
- If batch fails, status is updated to `failed` with error message
- File sync failure is non-fatal — field data is already synced

### Local Mode

When `SYNC_LOCAL_MODE=true` or `SYNC_SHORE_URL` is empty, the `SyncEngine` calls service functions directly (no HTTP). This enables development and testing on a single server.

---

## 4.1 Database Trigger Bypass (v1.4)

**Migration:** `migrations/110_sync_trigger_bypass.sql`  
**Commit:** `cc193830`

### Problem

All 108 tables have a `BEFORE UPDATE` trigger calling `set_updated_at()`, which unconditionally sets `NEW.updated_at = NOW()`. This was created in migrations 099/100/101 for sync change detection. However, when the sync apply pipeline writes field logs to data tables, it needs to preserve the original `changedAt` timestamp as the row's `updated_at` — otherwise the trigger overrides it with the current server time.

This caused a critical failure in multi-field UPDATE batches: when a batch contains multiple field logs for the same row (e.g., `rob`, `robLocationA`, `robLocationB` on `stores_items`), applying field A triggers `updated_at = NOW()`. When field B is applied next, the stale-skip guard compares `log.changedAt < row.updated_at` — since `NOW()` is always newer than the original `changedAt`, field B is incorrectly skipped as stale.

### Solution

The `set_updated_at()` trigger function was updated to check a PostgreSQL session variable:

```sql
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('sync.bypass_trigger', true) = 'true' THEN
        RETURN NEW;  -- preserve application-supplied updated_at
    END IF;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

The second argument `true` in `current_setting('sync.bypass_trigger', true)` means "return NULL instead of error if the variable doesn't exist" — so normal (non-sync) operations are completely unaffected.

### Apply Path Transaction Pattern

All three sync apply paths use the same pattern:

```typescript
const pool = await getPool();
const client = await pool.connect();
try {
    await client.query('BEGIN');
    await client.query("SET LOCAL sync.bypass_trigger = 'true'");

    // Phase 1: applyFieldLogInserts(acceptedLogs, client)
    // Phase 2: applyFieldLog(log, client) for each UPDATE log

    await client.query('COMMIT');
} catch (err) {
    await client.query('ROLLBACK');
    throw err;
} finally {
    client.release();
}
```

**Safety guarantees:**
- `SET LOCAL` only affects the current transaction — it is automatically discarded on `COMMIT` or `ROLLBACK`
- The bypass never leaks to other sessions, other queries, or even other transactions on the same connection (since `client.release()` returns it to the pool)
- Normal application writes (outside sync apply) never set this variable, so the trigger behaves exactly as before

### Files Modified

| File | Change |
|------|--------|
| `service.ts` | `receivePushData()` — Phase 1 + Phase 2 wrapped in bypass transaction using `pool.connect()` client |
| `syncEngine.ts` | `executePull()` — field log section wrapped in bypass transaction; `applyFieldLog()` accepts optional `client` parameter |
| `oneWayApplier.ts` | `applyFieldLogInserts()` accepts optional `externalClient` parameter, uses it for all queries when provided |

### Derived Running Hours Propagation (v1.6, Bug B — RESOLVED)

The `components` table is classified as `ONE_WAY_SHORE_TO_SHIP` in `syncConfig.ts`. When the Running Hours module on ship updates `components.currentCumulativeRH` (in `runningHoursService.ts`), this change doesn't sync directly because one-way tables only flow from shore to ship.

**Solution (fix 39, commit `31c2d729`):** The `running_hours_audit` table IS `BOTH_EDITABLE` and its INSERT records sync successfully. Post-apply derived updates in all 3 sync paths read `new_rh` from the audit row and update the component's `current_cumulative_rh`, `rh_current_master`, `rh_master_updated_at` (fix 44), and `last_updated` (fix 45-46) on the receiving side:
- `oneWayApplier.ts` — after INSERT of `running_hours_audit` row
- `service.ts` — after UPDATE of `new_rh`/`cumulative_rh` fields in `receivePushData`
- `syncEngine.ts` — after UPDATE in `applyFieldLog` (PULL path)

**Date propagation chain:** `date_updated_local` (user-selected) → component `last_updated` (TEXT, highest API priority). Fixes 44-46 ensure shore displays the date the user picked, not a system timestamp.

---

## 5. Field Change Logging

**File:** `server/modules/sync/fieldLogger.ts`

The `logFieldChanges()` function is called by service/storage layers after every INSERT, UPDATE, or soft-DELETE on BOTH_EDITABLE tables.

### How It Works

```typescript
// After an INSERT:
await logFieldChanges('work_orders', newRow.wouuid, vesselId, null, newRow, userId);

// After an UPDATE:
const oldRow = await fetchExisting(id);
await updateRow(id, newData);
await logFieldChanges('work_orders', oldRow.wouuid, vesselId, oldRow, newRow, userId);

// After a soft-DELETE:
await logSoftDelete('work_orders', row.wouuid, vesselId, userId);
```

### Skip Fields

The following fields are never logged (system-managed, not user data):

```typescript
const SKIP_FIELDS = ['updated_at', 'updatedAt', 'created_at', 'createdAt', 'is_sync', 'isSync'];
```

> **Note (v1.2):** `'id'` was removed from SKIP_FIELDS in fix `0ee8b86c`. Many BOTH_EDITABLE tables (defects, work_orders, work_order_executions, work_order_documents, work_order_postponements) have `id` as a semantic TEXT PRIMARY KEY (e.g., `D019-26-0023`). Skipping it prevented INSERT replication on the receiving side. For tables with GENERATED ALWAYS integer `id`, the column is filtered by `getColumnMeta().identityAlwaysCols` in oneWayApplier.

### Logging Behavior

| Operation | Old Row | New Row | What Gets Logged |
|-----------|---------|---------|-----------------|
| INSERT | `null` | `{...}` | All non-null, non-skip fields with `old_value = null` |
| UPDATE | `{...}` | `{...}` | Only fields where `String(old) !== String(new)` |
| Soft-DELETE | `{is_deleted: false}` | `{is_deleted: true}` | Single entry for `is_deleted` field |
| Hard DELETE | `{...}` | `null` | Warning logged, no field log entry (system uses soft-delete) |

### Wiring Coverage (all 33 BOTH_EDITABLE tables)

Every BOTH_EDITABLE table has `logFieldChanges()` wired to all write paths. The table below shows where each table's logging calls live.

#### Work Order Domain

| Table | Identity Col | INSERT | UPDATE | DELETE | File(s) |
|-------|-------------|--------|--------|--------|---------|
| `work_orders` | `wouuid` | `workOrderService.ts` | `workOrderService.ts` | `workOrderService.ts` | WO module service |
| `work_order_executions` | `woeuuid` | `executionService.ts` | `executionService.ts` | — | WO module service |
| `work_order_execution_details` | `woeduuid` | `postgresStorage.ts` | `postgresStorage.ts` | — | Central storage |
| `work_order_postponements` | `wopuuid` | `workOrderService.ts` | — | — | WO module service |
| `work_order_documents` | `id` (text PK) | `woDocumentService.ts` | `woDocumentService.ts` | `woDocumentService.ts` | WO docs service |

#### Defect Domain

| Table | Identity Col | INSERT | UPDATE | DELETE | File(s) |
|-------|-------------|--------|--------|--------|---------|
| `defects` | `duuid` | `postgresStorage.ts` | `postgresStorage.ts` | — | Central storage |
| `defect_actions` | `dauuid` | `postgresStorage.ts` | `postgresStorage.ts` | — | Central storage |
| `defect_attachments` | `datuuid` | `postgresStorage.ts` | — | — | Central storage |
| `defect_sequences` | `dsuuid` | `postgresStorage.ts` | `postgresStorage.ts` | — | Central storage |

#### Spare Parts & Stores

| Table | Identity Col | INSERT | UPDATE | DELETE | File(s) |
|-------|-------------|--------|--------|--------|---------|
| `spares` | `suuid` | `postgresStorage.ts` | `postgresStorage.ts` | — | Central storage (single + bulk) |
| `stores_items` | `stuuid` | `postgresStorage.ts` | `postgresStorage.ts` | — | Central storage |
| `spares_history` | `shuuid` | `postgresStorage.ts` | — | — | Immutable ledger (INSERT-only) |
| `spare_location_stock` | `slsuuid` | `postgresStorage.ts` | `postgresStorage.ts` | — | Central storage |
| `stores_ledger` | `sluuid` | `postgresStorage.ts` | — | — | Immutable ledger (INSERT-only) |
| `inventory_transactions` | `ituuid` | `postgresStorage.ts` | — | — | Immutable ledger (INSERT-only) |

#### Change Request

| Table | Identity Col | INSERT | UPDATE | DELETE | File(s) |
|-------|-------------|--------|--------|--------|---------|
| `change_request` | `cruuid` | `postgresStorage.ts` | `postgresStorage.ts` | — | Central storage |
| `change_request_attachment` | `crauuid` | `postgresStorage.ts` | — | — | Central storage |
| `change_request_comment` | `crcuuid` | `postgresStorage.ts` | — | — | Central storage |

#### Certificates & Surveys

| Table | Identity Col | INSERT | UPDATE | DELETE | File(s) |
|-------|-------------|--------|--------|--------|---------|
| `certificates` | text PK `id` | `postgresStorage.ts` | `postgresStorage.ts` | — | Central storage |
| `surveys` | text PK `id` | `postgresStorage.ts` | `postgresStorage.ts` | — | Central storage |
| `vessel_certificate_data` | `vcduuid` | `postgresStorage.ts` | `postgresStorage.ts` | — | Central storage |
| `vessel_survey_data` | `vsduuid` | `postgresStorage.ts` | `postgresStorage.ts` | — | Central storage |

#### Running Hours & Maintenance

| Table | Identity Col | INSERT | UPDATE | DELETE | File(s) |
|-------|-------------|--------|--------|--------|---------|
| `running_hours_audit` | `rhauuid` | `postgresStorage.ts` | — | — | Immutable ledger (INSERT-only, 4 paths) |
| `component_running_hours_log` | `crhluuid` | — | — | — | No write paths in codebase |
| `component_maintenance_history` | `cmhuuid` | `postgresStorage.ts` | — | — | Immutable ledger (INSERT-only) |

#### Documents & Requisitions

| Table | Identity Col | INSERT | UPDATE | DELETE | File(s) |
|-------|-------------|--------|--------|--------|---------|
| `component_documents` | text PK `id` | `postgresStorage.ts` | `postgresStorage.ts` | `postgresStorage.ts` | Central storage |
| `component_requisitions` | text PK `id` | `postgresStorage.ts` | `postgresStorage.ts` | — | Central storage |

#### IHM (Inventory of Hazardous Materials)

| Table | Identity Col | INSERT | UPDATE | DELETE | File(s) |
|-------|-------------|--------|--------|--------|---------|
| `ihm_items` | int PK `id` | `postgresStorage.ts` | `postgresStorage.ts` | — | Central storage |
| `ihm_maintenance_log` | int PK `id` | `postgresStorage.ts` | `postgresStorage.ts` | — | Central storage |

#### Planning (added v1.3)

| Table | Identity Col | INSERT | UPDATE | DELETE | File(s) |
|-------|-------------|--------|--------|--------|---------|
| `planner_dates` | `pduuid` | `workOrderPlannerService.ts` | `workOrderPlannerService.ts` | — | WO planner service (single + bulk, 4 paths total) |

#### Operational (added v1.6)

| Table | Identity Col | INSERT | UPDATE | DELETE | File(s) |
|-------|-------------|--------|--------|--------|---------|
| `locations` | `luuid` | `postgresStorage.ts` | `postgresStorage.ts` | — | Central storage |
| `superintendent_notifications` | `snuuid` | `postgresStorage.ts` | `postgresStorage.ts` | — | Central storage (INSERT wired in fix 40, ack UPDATE in fix 36) |

> **Note:** `component_running_hours_log` has no write paths anywhere in the server codebase. Data appears to be written externally or via a mechanism not yet implemented. When write paths are added, field logging must be wired.

### Field Log Entry Schema

Each log entry in `sync_field_log` contains:
- `table_name` — target table
- `row_uuid` — UUID identifying the row across instances
- `field_name` — which column changed
- `old_value` / `new_value` — string representation of before/after
- `vessel_id` — for vessel-scoped queries
- `changed_at` — timestamp of change
- `changed_by_user_id` — who made the change
- `instance_id` — which server made the change (e.g., `SHIP-VESSEL01`)
- `is_synced` — `false` until sync cycle marks it `true`

---

## 6. Conflict Detection & Resolution

Conflicts occur when both ship and shore edit the **same field on the same row** between sync cycles.

### Detection (in `service.ts → preparePullData`)

1. Shore receives ship's field logs during PUSH
2. During PULL, shore compares its own field logs against ship's
3. For each matching `tableName:rowUuid:fieldName` key, a `sync_conflicts` row is created
4. Non-conflicting shore changes are returned to ship normally

### Auto-Resolution (in `syncEngine.ts → executePull`)

If both sides changed to **the same value**, the conflict is auto-resolved as `auto_same_value`.

### Manual Resolution Options

| Resolution | Behavior |
|-----------|----------|
| `ship_wins` | Ship's value is applied to the data table |
| `shore_wins` | Shore's value is applied to the data table |
| `manual` | A custom `resolvedValue` is applied |

### Conflict Review UI (v1.5)

The admin page at `/admin/sync-conflicts` provides a unified view over both conflict sources:
- **`sync_conflicts`** — detected during PULL when both sides edit the same field on the same row
- **`sync_conflict_log`** — recorded by the per-field stale-skip guard when an incoming UPDATE is rejected

Both are queried by `conflictReviewRepository.ts` and merged into a common shape. Users can:
- **Apply incoming** — accept the sender's value, overwrite local, and create an audit trail in `sync_field_log`
- **Dismiss** — keep the local value, mark the conflict as resolved
- **Bulk dismiss** — resolve multiple conflicts at once
- **Filter** by status (pending/applied/dismissed), table name, or search by field/row UUID

The SyncDashboard Conflicts tile shows a live count from `getConflictStats()` and links to the review page. `sync_conflict_detected` alerts deep-link from the NotificationBell.

### Business Rules

From `shared/syncConfig.ts`, the `defects` table has a business rule:
- Only shore can set `status = 'verified'` — ship-side verification attempts are rejected during PUSH

---

## 7. File Sync

**File:** `server/modules/sync/fileSyncProcessor.ts`

### Tables with Binary Files

| Table | Storage | `queueFileForSync` Location | Notes |
|-------|---------|---------------------------|-------|
| `work_order_documents` | `fileKey` + `storageBackend` (`local` or `object`) | `woDocumentService.ts → uploadDocument()` | Real binary files |
| `component_documents` | `fileKey` + `storageBackend` | `postgresStorage.ts → createComponentDocument()` | Real binary files |

### Tables with URL References (conditional binary sync)

| Table | Column | `queueFileForSync` Location | Notes |
|-------|--------|---------------------------|-------|
| `defect_attachments` | `url` (text) | `postgresStorage.ts → createDefectAttachment()` | URL-only (base64 data URI or external URL). Binary sync queued only for `local://` or `.private/` paths (future-proofing). Field logging handles the URL string sync. |
| `change_request_attachment` | `url` (text) | `postgresStorage.ts → createChangeRequestAttachment()` | Same as defect_attachments. |

### Tables with JSON-Embedded File References (no separate binary sync needed)

| Table | Column | Notes |
|-------|--------|-------|
| `work_orders` | `uploaded_documents` (JSON) | Stores `{type, fileName, fileKey, uploadedAt, uploadedBy}` array. The actual binary files are uploaded via `POST /work-orders/:id/documents` which creates `work_order_documents` rows (already wired). The JSON metadata is synced via field logging. |
| `work_order_executions` | `uploaded_documents` (JSON) | Same pattern — references `work_order_documents` files. |

### Transfer Protocol

- **Chunk size:** 256KB (`CHUNK_SIZE_BYTES = 256 * 1024`)
- **Max retries:** 3 per file
- **Priority:** Small files (<100KB) processed first, then by creation date
- **Hash verification:** SHA-256 of complete file checked after reassembly
- **Resume:** Tracks `chunk_offset` — interrupted transfers resume from last successful chunk
- **Direction:** Determined by `SYNC_INSTANCE_ID` prefix (SHIP → `ship_to_shore`, SHORE → `shore_to_ship`)
- **Chunk metadata:** Each `FileChunk` includes `fileKey`, `tableName`, `fileName`, `fileSizeBytes`, `vesselId` — so the receiving side knows where to save the file without needing the sender's queue entry (FIX 22)
- **Mirror queue entry:** `receiveChunk()` creates a tracking record on the receiving side via `queueFileWithUuid()` (ON CONFLICT DO NOTHING) for status monitoring and backward compatibility
- **Shore URL:** `FileSyncProcessor` constructor accepts `shoreUrl` from `SyncEngine` (DB-loaded settings via `sync_settings` table, not just `SYNC_SHORE_URL` env var)

### Storage Directories

| Directory | Table(s) | Mapped via |
|-----------|----------|-----------|
| `.private/wo-docs/` | `work_order_documents` (default fallback) | `getStorageDir()` |
| `.private/component-docs/` | `component_documents` | `getStorageDir()` |
| `.private/defect-docs/` | `defect_attachments` | `getStorageDir()` |
| `.private/cr-docs/` | `change_request_attachment` | `getStorageDir()` |
| `.private/sync-temp/` | — | Temporary chunk storage during reassembly |

The `getStorageDir(tableName)` helper in `fileSyncProcessor.ts` maps each table name to its local storage directory.

### Queue Lifecycle

```
pending → in_progress → completed
                     → failed (after 3 retries)
```

---

## 8. Provisioning

**File:** `server/modules/sync/provisioningService.ts`

Provisioning creates a vessel-specific data bundle for initial ship server deployment.

### Bundle Generation (Shore Side)

`generateProvisioningBundle(vesselId, generatedBy)` exports data in dependency order using `getSyncPhaseOrder()`:

| Phase | Content | Category Label |
|-------|---------|---------------|
| 1 | Global ONE_WAY tables (no vessel FK) | `ONE_WAY (global)` |
| 2 | Vessel-scoped ONE_WAY tables | `ONE_WAY (vessel)` |
| 3 | Primary BOTH_EDITABLE entities (parent rows) | `BOTH_EDITABLE (parent)` |
| 4 | Child BOTH_EDITABLE entities (FK to Phase 3) | `BOTH_EDITABLE (child)` |
| — | Vessel identity row from `vessels` table | `IDENTITY (vessel self)` |

**Phase 3 parent tables:**
`work_orders`, `defects`, `spares`, `stores_items`, `change_request`, `certificates`, `surveys`, `vessel_certificate_data`, `vessel_survey_data`, `running_hours_audit`, `component_running_hours_log`, `component_maintenance_history`, `ihm_items`, `defect_sequences`

**Phase 4 child tables:**
`work_order_executions`, `work_order_execution_details`, `work_order_postponements`, `work_order_documents`, `defect_actions`, `defect_attachments`, `spares_history`, `spare_location_stock`, `spare_component_links`, `stores_ledger`, `inventory_transactions`, `change_request_attachment`, `change_request_comment`, `ihm_maintenance_log`, `component_documents`, `component_requisitions`

### Bundle Import (Ship Side)

`importProvisioningBundle(bundle)`:
- Processes tables in the order they appear in the bundle (dependency order)
- Uses `ON CONFLICT DO UPDATE` when table has a unique identity column
- Uses `ON CONFLICT DO NOTHING` otherwise
- Stringify JSON/JSONB values for parameterized queries
- Sets up `sync_metadata` with initial checkpoint timestamp
- Returns counts of tables imported, rows imported, and errors

### Verification

`verifyProvisioning(manifest)`:
- For each table in the manifest, checks that `count(*) >= expected`
- Ship may have created new rows (actual >= expected is OK)
- Actual < expected indicates a provisioning issue

### Bundle Format

```json
{
  "manifest": {
    "vesselId": "...",
    "vesselName": "...",
    "vesselCode": "...",
    "generatedAt": "2026-04-25T12:00:00.000Z",
    "generatedBy": "admin-user-uuid",
    "instanceId": "SHORE-DEV",
    "tables": [
      { "tableName": "makers", "rowCount": 45, "category": "ONE_WAY (global)" },
      ...
    ],
    "totalRows": 12345,
    "version": "1.0"
  },
  "data": [
    { "tableName": "makers", "rows": [...] },
    ...
  ]
}
```

---

## 9. Pruning & Health Monitoring

### Pruning Service

**File:** `server/modules/sync/pruningService.ts`

Automated cleanup of sync infrastructure tables. Runs every 24 hours via `SyncPruningScheduler`.

| Table | Default Retention | Safety Rule |
|-------|------------------|-------------|
| `sync_field_log` | 90 days | NEVER delete where `is_synced = false` |
| `sync_batches` | 365 days | NEVER delete where `status = 'in_progress'` |
| `sync_file_queue` | 90 days | NEVER delete where `status IN ('pending', 'in_progress')` |
| `sync_conflicts` | 180 days | NEVER delete where `resolution IS NULL` |

**Configuration precedence:** DB settings (`sync_settings` table) → Environment variables → Defaults

| Setting | DB Key | Env Variable | Default |
|---------|--------|-------------|---------|
| Field log retention | `field_log_retention_days` | `SYNC_PRUNE_FIELD_LOG_DAYS` | 90 |
| Batch retention | `batch_retention_days` | `SYNC_PRUNE_BATCH_DAYS` | 365 |
| File queue retention | — | `SYNC_PRUNE_FILE_QUEUE_DAYS` | 90 |
| Conflict retention | — | `SYNC_PRUNE_CONFLICT_DAYS` | 180 |

**Scheduler:** Initial prune deferred 2 minutes after boot (to allow DB/migrations to complete), then every 24 hours.

### Health Monitor

**File:** `server/modules/sync/healthMonitor.ts`

Four health checks, each returning `ok`, `warning`, or `critical`:

| Check | Threshold | Warning | Critical |
|-------|-----------|---------|----------|
| Stale Sync | 48 hours | No successful sync in threshold period | — |
| Unresolved Conflicts | 7 days | 1-10 old conflicts | >10 old conflicts |
| Stuck Files | 24 hours | 1-5 stuck transfers | >5 stuck transfers |
| Log Overflow | 100,000 | Count exceeds threshold | Count exceeds 2× threshold |

**Overall status:** Worst of all checks (healthy → warning → critical).

**Scheduler:** Initial check deferred 60 seconds after boot, then every 6 hours.

---

## 10. Sync Settings

### Database Table: `sync_settings`

10 default settings seeded by migration `103_sync_settings_seed.sql`:

| Key | Default | Type | Description |
|-----|---------|------|-------------|
| `shore_url` | _(empty)_ | `string` | Shore server base URL |
| `instance_id` | `SHORE-DEV` | `string` | This instance's unique ID |
| `sync_interval_minutes` | `60` | `number` | Sync cycle interval |
| `auto_sync_enabled` | `false` | `boolean` | Enable automatic sync |
| `local_mode` | `true` | `boolean` | Use direct function calls (no HTTP) |
| `max_retries` | `3` | `number` | Max retry attempts per API call |
| `chunk_size` | `200` | `number` | Records per sync chunk |
| `request_timeout_seconds` | `30` | `number` | HTTP request timeout |
| `field_log_retention_days` | `90` | `number` | Pruning: field log retention |
| `batch_retention_days` | `365` | `number` | Pruning: batch retention |

### Settings Loading

The `SyncEngine.loadSettings()` method reads from DB on the first sync cycle, with env var fallback:
```
DB sync_settings → Environment variables → Hard-coded defaults
```

`engine.reloadSettings()` forces a reload on the next cycle (called when settings are updated via the API).

---

## 11. UI Components

### Sync Dashboard (`/admin/sync-dashboard`)

Available on both ship and shore. Provides:
- **Sync Status:** Current instance info, last sync timestamp, pending changes
- **Manual Trigger:** Button to trigger a sync cycle for the selected vessel
- **Batch History:** Table showing recent sync batches with status, records, conflicts, duration
- **Conflict Resolution:** View and resolve unresolved conflicts (ship_wins / shore_wins / manual)
- **File Queue:** View pending file transfers

### Ship Provisioning (`/admin/sync-provisioning`)

Available on both ship and shore. Provides:
- **Vessel Selector:** Dropdown to pick a vessel
- **Manifest Preview:** Table showing what will be provisioned (table names, row counts, categories)
- **Generate & Download:** Creates JSON bundle for vessel deployment
- **Import:** Upload a JSON bundle on the ship side
- **Verify:** Check that provisioned data matches expected row counts

### Fleet Sync Overview (`/admin/sync-fleet`)

**Shore-only** (hidden on ship via `useSyncInstanceInfo` hook). Provides:
- **Summary Cards:** Total vessels, synced count, vessels with issues
- **Vessel Table:** All vessels with last sync time, status, pending changes, conflicts, pending files
- **Settings Panel:** Collapsible panel showing all 10 sync settings with inline editing
- **Test Connection:** Button to test shore URL connectivity with latency display

### Ship/Shore Detection

The `useSyncInstanceInfo()` hook (`client/src/hooks/useSyncInstanceInfo.ts`) calls `GET /sync/instance-info` once and caches the result with `staleTime: Infinity`:
- Used by `SideMenuBar.tsx` to conditionally show "Fleet Overview" menu item (shore-only)
- Returns `{ isShip, isShore, instanceId, instanceType }`

---

## 12. Database Schema — Sync Infrastructure Tables

### sync_field_log

Tracks individual field changes for BOTH_EDITABLE tables.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | Auto-increment |
| `sfl_uuid` | uuid | Unique identifier |
| `table_name` | text | Target table |
| `row_uuid` | text | Row identity (e.g., wouuid value) |
| `field_name` | text | Changed column name |
| `old_value` | text | Previous value (null for INSERT) |
| `new_value` | text | New value |
| `vessel_id` | text | Vessel scope |
| `changed_at` | timestamp | When the change occurred |
| `changed_by_user_id` | text | Who made the change |
| `instance_id` | text | Which server (SHIP-xxx or SHORE-xxx) |
| `is_synced` | boolean | False until sync cycle completes |
| `synced_batch_uuid` | text | Batch that synced this entry |
| `is_deleted` | boolean | Soft delete flag |

### sync_batches

Tracks each sync cycle.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | Auto-increment |
| `batch_uuid` | uuid | Unique batch identifier |
| `initiated_by_instance` | text | Which instance started the sync |
| `vessel_id` | text | Target vessel |
| `status` | text | `in_progress`, `completed`, `failed` |
| `started_at` | timestamp | Batch start time |
| `completed_at` | timestamp | Batch end time |
| `checkpoint_before` | timestamp | Checkpoint at batch start |
| `checkpoint_after` | timestamp | New checkpoint after completion |
| `records_sent` | integer | Records sent to remote |
| `records_received` | integer | Records received from remote |
| `conflicts_found` | integer | Conflicts detected |
| `conflicts_resolved` | integer | Conflicts resolved |
| `duration_ms` | integer | Total cycle duration |
| `error_message` | text | Error details if failed |
| `is_deleted` | boolean | Soft delete flag |

### sync_conflicts

Records field-level conflicts for manual resolution.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | Auto-increment |
| `conflict_uuid` | uuid | Unique conflict identifier |
| `table_name` | text | Target table |
| `row_uuid` | text | Row identity |
| `field_name` | text | Conflicting field |
| `ship_value` | text | Ship's value |
| `ship_changed_at` | timestamp | When ship changed it |
| `ship_changed_by` | text | Who on ship changed it |
| `shore_value` | text | Shore's value |
| `shore_changed_at` | timestamp | When shore changed it |
| `shore_changed_by` | text | Who on shore changed it |
| `resolution` | text | `ship_wins`, `shore_wins`, `manual`, `auto_same_value`, or NULL |
| `resolved_value` | text | Final value applied |
| `resolved_at` | timestamp | When resolved |
| `resolved_by` | text | Who resolved it |
| `vessel_id` | text | Vessel scope |
| `sync_batch_id` | text | Batch that detected the conflict |
| `is_deleted` | boolean | Soft delete flag |

### sync_conflict_log (v1.5, migration 111)

Records per-field stale-skip rejections where the receiver wins. Created by the per-field guard (Option 2c) when an incoming UPDATE is rejected because the receiver has a newer edit on the same field.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | Auto-increment |
| `table_name` | text | Target table |
| `row_uuid` | text | Row identity |
| `field_name` | text | Conflicting field |
| `incoming_instance_id` | text | Sender instance (e.g., `SHIP-VESSEL01`) |
| `incoming_old_value` | text | Sender's old value |
| `incoming_new_value` | text | Sender's new value |
| `incoming_changed_at` | timestamp | When sender changed it |
| `incoming_changed_by` | text | Who on sender changed it |
| `local_instance_id` | text | Receiver instance |
| `local_value` | text | Receiver's current value |
| `local_changed_at` | timestamp | When receiver last changed it |
| `local_changed_by` | text | Who on receiver changed it |
| `status` | text | `pending`, `applied`, `dismissed` |
| `resolved_by` | text | Who resolved it (via Conflict Review UI) |
| `resolved_at` | timestamp | When resolved |
| `created_at` | timestamp | When conflict was logged |

**Indexes:**
- `idx_scl_recent` — `created_at DESC` (for recency queries)
- `idx_scl_unresolved` — `status` where `status = 'pending'` (for pending count)
- `idx_scl_table_row` — `(table_name, row_uuid)` (for per-row conflict lookup)

### sync_file_queue

Queues binary file transfers.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | Auto-increment |
| `queue_uuid` | uuid | Unique queue entry |
| `table_name` | text | Source table (work_order_documents, etc.) |
| `row_uuid` | text | Row identity |
| `file_key` | text | Storage key / path |
| `file_name` | text | Original filename |
| `file_size_bytes` | integer | File size |
| `file_hash` | text | SHA-256 hash |
| `direction` | text | `ship_to_shore` or `shore_to_ship` |
| `status` | text | `pending`, `in_progress`, `completed`, `failed` |
| `chunk_offset` | integer | Resume position (chunks completed) |
| `total_chunks` | integer | Total chunks expected |
| `retry_count` | integer | Retry attempts so far |
| `error_message` | text | Last error if any |
| `vessel_id` | text | Vessel scope |
| `instance_id` | text | Source instance |
| `priority` | integer | 10=high (<100KB), 5=medium, 1=low (>1MB) |
| `completed_at` | timestamp | When transfer completed |
| `is_deleted` | boolean | Soft delete flag |

### sync_metadata

Tracks sync state per instance.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | Auto-increment |
| `instance_id` | text | Unique instance identifier |
| `vessel_id` | text | Associated vessel |
| `last_sync_at` | timestamp | Last successful sync time |
| `last_sync_status` | text | `success`, `failed`, `in_progress`, `provisioned` |
| `last_sync_checkpoint` | timestamp | Data up to this point has been synced |
| `sync_direction` | text | `bidirectional`, `ship_to_shore`, `shore_to_ship` |
| `is_deleted` | boolean | Soft delete flag |

### sync_settings

Database-persisted sync configuration.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | Auto-increment |
| `ssuuid` | uuid | Unique setting identifier |
| `setting_key` | text | Setting name (unique) |
| `setting_value` | text | Current value |
| `setting_type` | text | `string`, `number`, `boolean` |
| `description` | text | Human-readable description |
| `is_editable` | boolean | Whether admin UI can modify it |
| `created_at` | timestamp | Creation time |
| `updated_at` | timestamp | Last modification time |
| `created_by_uuid` | text | Creator |
| `updated_by_uuid` | text | Last modifier |
| `is_deleted` | boolean | Soft delete flag |
| `is_sync` | boolean | Whether this setting itself syncs (currently false) |

---

## 13. API Reference

All endpoints are prefixed with `/technical/api` and registered in `server/modules/sync/routes.ts`.

### Sync Protocol (5 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/sync/initiate` | None | Start a sync batch |
| POST | `/sync/push` | None | Ship pushes its changes |
| POST | `/sync/pull` | None | Ship pulls shore's changes |
| POST | `/sync/resolve-conflict` | None | Resolve a field-level conflict |
| POST | `/sync/complete` | None | Complete batch, advance checkpoint |

### Sync Admin (3 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/sync/status` | None | Get sync status for a vessel/instance |
| GET | `/sync/batches` | None | Recent sync batches |
| GET | `/sync/conflicts` | None | Unresolved conflicts for a vessel |

### Sync Trigger (1 endpoint)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/sync/trigger` | None | Manually trigger a sync cycle |

### File Sync (2 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/sync/file/upload-chunk` | None | Upload a file chunk |
| GET | `/sync/file/queue` | None | View pending file transfers |

### Pruning & Health (3 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/sync/prune` | `requireOfflineAdmin` | Trigger manual pruning |
| GET | `/sync/health` | None | Run health check |
| GET | `/sync/table-stats` | None | Get sync table row counts |

### Settings & Fleet (5 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/sync/settings` | `requireOfflineAdmin` | Get all sync settings |
| PUT | `/sync/settings` | `requireOfflineAdmin` | Update sync settings |
| POST | `/sync/settings/test-connection` | `requireOfflineAdmin` | Test shore URL connectivity |
| GET | `/sync/fleet-overview` | `requireOfflineAdmin` | Fleet-wide sync status (shore) |
| GET | `/sync/instance-info` | None | Ship vs shore detection |

### Conflict Review (6 endpoints, v1.5)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/sync/conflicts/review/count` | None | Count conflicts by status |
| GET | `/sync/conflicts/review/tables` | None | Distinct table names for filter dropdown |
| GET | `/sync/conflicts/review` | None | Paginated list with filters (status, table, search) |
| GET | `/sync/conflicts/review/:id` | None | Single conflict detail |
| POST | `/sync/conflicts/review/:id/apply-incoming` | None | Accept incoming value, UPDATE data table, write audit trail |
| POST | `/sync/conflicts/review/:id/dismiss` | None | Reject incoming, mark resolved |

### Provisioning (5 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/sync/provision/:vesselId` | `requireOfflineAdmin` | Generate provisioning bundle |
| GET | `/sync/provision/manifest/:vesselId` | `requireOfflineAdmin` | Preview manifest |
| GET | `/sync/provision/download/:vesselId` | `requireOfflineAdmin` | Download full bundle as JSON |
| POST | `/sync/provision/import` | `requireOfflineAdmin` | Import bundle on ship |
| POST | `/sync/provision/verify` | `requireOfflineAdmin` | Verify provisioning integrity |

### Authentication: `requireOfflineAdmin`

From `server/modules/sync/middleware.ts`, the following roles are allowed:
- **Sail Admin** — Superadmin, always allowed
- **PMS Admin** — Office admin with full PMS access
- **Offline Admin** — Dedicated provisioning role

---

## 14. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SYNC_INSTANCE_ID` | `UNKNOWN` | Instance identity. Prefix determines type: `SHIP-` = ship, `SHORE-` = shore |
| `SYNC_SHORE_URL` | _(empty)_ | Shore server base URL (empty = local mode) |
| `SYNC_API_KEY` | _(empty)_ | API key for sync authentication |
| `SYNC_LOCAL_MODE` | `false` | Force local mode (direct function calls, no HTTP) |
| `SYNC_PRUNE_FIELD_LOG_DAYS` | `90` | Pruning retention for field logs |
| `SYNC_PRUNE_BATCH_DAYS` | `365` | Pruning retention for batches |
| `SYNC_PRUNE_FILE_QUEUE_DAYS` | `90` | Pruning retention for file queue |
| `SYNC_PRUNE_CONFLICT_DAYS` | `180` | Pruning retention for conflicts |
| `SYNC_HEALTH_STALE_HOURS` | `48` | Health: stale sync threshold |
| `SYNC_HEALTH_CONFLICT_DAYS` | `7` | Health: old conflict threshold |
| `SYNC_HEALTH_STUCK_FILE_HOURS` | `24` | Health: stuck file threshold |
| `SYNC_HEALTH_LOG_OVERFLOW` | `100000` | Health: unsynced log overflow threshold |

### Instance ID Convention

| Pattern | Example | Meaning |
|---------|---------|---------|
| `SHORE-*` | `SHORE-DEV`, `SHORE-PROD` | Shore/office server |
| `SHIP-*` | `SHIP-VESSEL01`, `SHIP-MV-ATLAS` | Ship server for a specific vessel |

---

## Appendix: Helper Functions in `shared/syncConfig.ts`

| Function | Returns | Purpose |
|----------|---------|---------|
| `getTablesByCategory(category)` | `TableSyncConfig[]` | All tables in a sync category |
| `getTableSyncConfig(tableName)` | `TableSyncConfig \| undefined` | Config for a specific table |
| `requiresFieldLogging(tableName)` | `boolean` | True if BOTH_EDITABLE |
| `getIdentityColumn(tableName)` | `string \| null` | UUID identity column name |
| `getConfigurableTables()` | `TableSyncConfig[]` | Tables that can be reclassified via admin UI |
| `getProvisioningTables()` | `TableSyncConfig[]` | All tables except NO_SYNC |
| `getTablesWithBusinessRules()` | `TableSyncConfig[]` | Tables with sync business rules |
| `getSyncPhaseOrder()` | `string[][]` | 6-phase dependency order for sync/provisioning |

---

## 15. Post-Merge Fix Log

All fixes applied after the initial sync system merge to `replit_dev` (2026-04-25), in chronological order.

### Round 1 — Ship Deployment & Runtime Fixes (2026-04-28 to 2026-05-01)

| # | Commit | Fix | Impact |
|---|--------|-----|--------|
| 1 | `06f85de0` | Skip Replit Object Storage on ship server | Prevented 504 timeout on ship startup |
| 2 | `4e99738e` | Diagnostic logging for import-stream endpoint | Debuggability |
| 3 | `d08a6431` | Migration 107 re-applies audit columns + PK conflict handling | Provisioning idempotency |
| 4 | `74f96ec1` | Split inline migrations 052/090/091 into per-statement execution | Fixed fresh-DB migration failures |
| 5 | `729e603c` | Remove apostrophe from migration 107 comment | Fixed SQL parse error |
| 6 | `0de153bc` | Clear seeded RBAC/rank data before import + JSON serialization | Fixed 261 FK constraint errors during provisioning |
| 7 | `3411c2d0` | Detailed error logging + RBAC cleanup in pull + batch error storage | Fixed sync pull RBAC FK failures |
| 8 | `a9feb236` | 5 sync apply defects: schema-aware id handling, JSON coercion, error counter, batch persistence | Fixed field log application pipeline |
| 9 | `44e2087f` | `receivePushData` applies field logs to actual tables | **THE critical fix** — field logs were stored but never applied to data tables |

### Round 2 — Data Integrity & Field Logger Fixes (2026-05-03 to 2026-05-05)

| # | Commit | Fix | Impact |
|---|--------|-----|--------|
| 10 | `c7a97477` | JSON-aware field value serialization in fieldLogger + defensive guards + data repair migration | Fixed `[object Object]` corruption in JSON/JSONB columns during field logging |
| 11 | `521d493e` | Disable immutability trigger before repairing component_maintenance_history JSON columns | Migration safety for immutable tables |
| 12 | `ed9c50c3` | Wrap component_maintenance_history repair in atomic DO block | Migration atomicity |

### Round 3 — Sync Engine Enhancement (2026-05-05)

| # | Commit | Fix | Impact |
|---|--------|-----|--------|
| 13 | `168c2602` | `applyFieldLogInserts()` in oneWayApplier — handles INSERT for new BOTH_EDITABLE rows via field logs | **Critical** — previously new rows created on ship could never be synced to shore because the apply pipeline only handled UPDATEs |

### Round 4 — Field Logging & File Sync Completeness (2026-05-06)

| # | Commit | Fix | Impact |
|---|--------|-----|--------|
| 14 | `7574cf11` | Wire `logFieldChanges` to 7 unlogged BOTH_EDITABLE tables + 3 missing INSERT paths | **20 new logging calls** across 10 tables that previously had zero field logging. Tables: `spares` (single + bulk), `stores_items`, `spares_history`, `spare_location_stock`, `stores_ledger`, `inventory_transactions`, `defect_sequences`, `running_hours_audit` (4 INSERT paths), `work_order_documents` (INSERT + UPDATE + DELETE). Without this, changes to these tables would never sync. |
| 15 | `11965179` | Wire `FileSyncProcessor.queueFileForSync()` for defect and CR attachments + extend `getStorageDir()` | Added file sync support for `defect_attachments` and `change_request_attachment` tables (conditional on `local://` paths). Added 2 new storage directories. Refactored 5 hardcoded storage dir lookups to use centralized `getStorageDir()` helper. |

### Round 5 — Sync Apply Pipeline Fixes (2026-05-07)

| # | Commit | Fix | Impact |
|---|--------|-----|--------|
| 16 | `ebb813b7` | `applyFieldLogInserts()` 23505 unique constraint fallback for cert/survey tables | `vessel_certificate_data` has a partial unique index on `(vessel_id, master_id) WHERE is_deleted = false`. When ship and shore independently create rows for the same logical entity, INSERT fails on this index (not the identity column ON CONFLICT). Fix: detect 23505, find existing row via progressive lookup, apply field-level UPDATEs, converge identity UUID. |
| 17 | `0ee8b86c` | Defect INSERT sync failure — remove `'id'` from fieldLogger SKIP_FIELDS | `defects`, `work_orders`, `work_order_executions`, `work_order_documents`, `work_order_postponements` all have TEXT PK `id` (e.g., `D019-26-0023`). Since `id` was skipped, `applyFieldLogInserts` built INSERTs missing the NOT NULL primary key → silent failure. Fix: removed `'id'` from SKIP_FIELDS. GENERATED ALWAYS integer ids are already handled by `getColumnMeta().identityAlwaysCols`. |
| 18 | `0ee8b86c` | Field log re-push causing data revert (category revert scenario) | After `executePush`, `completeSyncSession` marks logs as synced in SHORE's DB only. Ship's local DB kept them as `is_synced=false` → re-pushed every cycle → `receivePushData` blindly applied old values, overwriting newer shore edits. Fix A: engine marks local pushed logUuids as synced after COMPLETE. Fix B: `receivePushData` stale-log guard skips UPDATE logs where `changedAt < row.updated_at`. |

### Round 6 — QA Comprehensive Sync Fixes (2026-05-07)

| # | Commit | Fix | Impact |
|---|--------|-----|--------|
| 19 | `3bd0eb79` | Increase Express body parser limit from 10mb to 50mb | Large sync payloads (many ONE_WAY tables) were being rejected with HTTP 413 "Request Entity Too Large". |
| 20 | `05b87ed3` | Vessel-code scope mismatch — ONE_WAY tables with `vesselScopeColumn='vessel_code'` returned 0 rows | `gatherOneWayShoreRows()` always passed `vesselId` (UUID) regardless of whether the table used `vessel_code` or `vessel_id`. Tables like `fleet_vessel_mapping`, `master_data`, `component_class_regulatory` got 0 rows. Fix: resolve `vesselId→vesselCode` via new `getVesselCodeForUuid()` cached helper, pass correct value per table. Also updated `getUnsyncedFieldLogs`, `getFieldLogsSinceCheckpoint`, `getFieldLogCount` to accept optional `vesselCode` and query with `IN (vesselId, vesselCode)` for field logs stored with either identifier. Added `normalizeFieldLog()` helper for snake_case→camelCase from raw SQL. Threaded vesselCode through `preparePullData`, `completeSyncSession`, `executePush`. |
| 21 | `05b87ed3` | `planner_dates` not syncing (classified as NO_SYNC) | Reclassified from `NO_SYNC` to `BOTH_EDITABLE` with `direction: 'bidirectional'` in `syncConfig.ts`. Wired `logFieldChanges('planner_dates', ...)` to all 4 write paths in `workOrderPlannerService.ts`: `savePlannedDate` UPDATE + INSERT, `bulkSavePlannedDate` UPDATE + INSERT (bulk passes `tx` for transaction safety). |
| 22 | `876b8d18` | Binary file transfer — receiving side silently discarded assembled files | `receiveChunk()` called `getFileQueueEntry(chunk.queueUuid)` to find `fileKey`/`tableName` for saving, but the queue entry only exists in the SENDER's DB — the receiver had no matching row. `fileEntry` was `undefined`, so the file was assembled and hash-verified but never saved to disk. Fix: (a) extended `FileChunk` interface with file metadata (`fileKey`, `tableName`, `fileName`, `fileSizeBytes`, `vesselId`); (b) `processQueue()` populates metadata in every chunk; (c) `receiveChunk()` creates mirror queue entry via new `queueFileWithUuid()` (ON CONFLICT DO NOTHING); (d) resolves save location from chunk metadata first, queue entry fallback for backward compat; (e) `FileSyncProcessor` constructor accepts `shoreUrl` from `SyncEngine` (DB-loaded settings, not just env var). |

### Round 7 — QA Regression Sync Fixes (2026-05-08)

| # | Commit | Fix | Impact |
|---|--------|-----|--------|
| 23 | `1b3097cf` | Composite-key lookup for applicability tables + spare ROB field logging | `vessel_certificate_applicability` and `vessel_survey_applicability` use composite key `(vessel_id, master_id)` instead of integer `id`. Ship generates own sequence value for integer PK on INSERT. `performInventoryTransaction()` now calls `logFieldChanges` for `rob`/`robLocationA`/`robLocationB` updates. |

### Round 8 — SyncDiag Logging + 3-Bug QA Fix (2026-05-08)

| # | Commit | Fix | Impact |
|---|--------|-----|--------|
| 24 | `b944960f` | Persistent SyncDiag logging | New `syncDiagLogger.ts` writes to console AND daily files. New API endpoints for log retrieval. |
| 25 | `5de26eac` | 3-root-cause fix resolving 8 QA issues | (a) `getColumnMeta` identity detection: `attidentity IN ('a','d')` catches GENERATED BY DEFAULT. (b) `toSnakeCase` acronym-aware regex (16 fields across 7 tables). (c) Stale-skip uses `log.changedAt` instead of `NOW()` for `updated_at`. |

### Round 9 — Trigger Bypass (2026-05-10)

| # | Commit | Fix | Impact |
|---|--------|-----|--------|
| 26 | `cc193830` | Session-variable trigger bypass for sync apply paths | `set_updated_at()` trigger on all 108 tables unconditionally set `updated_at = NOW()`, overriding FIX 25c's `changedAt` value. Migration `110_sync_trigger_bypass.sql` adds `current_setting('sync.bypass_trigger', true)` check to trigger function. Three apply paths (`receivePushData`, `executePull`, `applyFieldLog`) wrapped in `BEGIN / SET LOCAL sync.bypass_trigger = 'true' / COMMIT` using dedicated `pool.connect()` client. `applyFieldLogInserts()` accepts optional `externalClient`. `SET LOCAL` scope ensures bypass never leaks. Resolves QA tests #2, #3. Bug B (components RH direction, QA #1, #8) remains open — see §4.1. |

### Round 10 — INSERT Stale-Skip Bypass (2026-05-11)

| # | Commit | Fix | Impact |
|---|--------|-----|--------|
| 27 | `58c33ad2` | INSERT-origin field logs bypass stale-skip guard in `receivePushData` | INSERT logs (`oldValue===null`) were incorrectly subject to `changedAt < localUpdatedAt` freshness check. When a row was created on ship and a subsequent local edit bumped `updated_at` before sync, ALL INSERT logs were stale-skipped — row never got its initial field values on receiver. Fix: INSERT logs always pass through; only UPDATE logs are subject to freshness check. |

### Round 11 — Per-Field Stale-Skip + Conflict Log (2026-05-11)

| # | Commit | Fix | Impact |
|---|--------|-----|--------|
| 28 | `eb880b4a` | Per-field stale-skip guard (Option 2c) + `sync_conflict_log` table | Row-level `updated_at` comparison mixed ALL field edits + trigger stamps. Scenario: ship edits `status`, shore edits `remarks` — shore's `updated_at` bump caused incoming `status` to appear stale even though shore never touched `status`. Fix: replace row-level comparison with per-field lookup in `sync_field_log` using receiver's `instance_id`. Migration `111_sync_conflict_log_and_field_index.sql` adds composite index + new `sync_conflict_log` table (17 cols) for recording true conflicts. |
| 29 | `787e66bc` | AsyncLocalStorage userId capture in `fieldLogger.ts` | 65 of 82 `logFieldChanges` callers hardcoded `'system'` as userId. New `server/middleware/requestContext.ts` uses AsyncLocalStorage to capture `req.user.id` per-request. fieldLogger resolves real userId when caller passes placeholder. |

### Round 12 — Conflict Review UI + Fixes (2026-05-11)

| # | Commit | Fix | Impact |
|---|--------|-----|--------|
| 30 | `5724708c` | Conflict Review feature — unified UI + backend + notifications | New `conflictReviewRepository.ts` (814 lines) queries both `sync_conflict_log` + `sync_conflicts`, merges into unified list. Apply logic: reads current value from data table, UPDATEs field, manually INSERTs audit trail into `sync_field_log` (raw SQL bypasses Drizzle middleware). Controller (6 routes), frontend page (`SyncConflictReview.tsx`, ~690 lines), NotificationBell deep-link, SyncDashboard live conflict count tile. Migration `112_sync_conflicts_menu_and_alert_policy.sql`. |
| 31 | `2175e514` | Remove LEGACY/NEW source badge and source filter | Internal table distinction confused end users. Removed `sourceFilter` state, dropdown, and badge from conflict cards. |
| 32 | `b709c2a8` | Migration 112 rewrite — name-based lookups | Original used hardcoded integer ids (`VALUES (34, ...)`, `ON CONFLICT (id)`, `WHERE id = 34`). Rewritten with computed `MAX(id)+1`, `WHERE name = 'admin-sync-conflicts'`, correct UUID columns (`muid`, `role_ruid`), explicit conflict targets. |
| 33 | `e2a9cf1a` | SyncDashboard Conflicts tile hardening | Added `role="link"`, `tabIndex={0}`, keyboard nav, hover feedback, `aria-label`, `data-testid`. |

### Round 13 — Bidirectional Sync Enablement + Field Logging Audit (2026-05-12)

| # | Commit | Fix | Impact |
|---|--------|-----|--------|
| 34 | `ee8c9abf` | Enable bidirectional sync for `locations` + `superintendent_notifications` | Both tables reclassified from NO_SYNC to BOTH_EDITABLE in `syncConfig.ts`. Enables ship↔shore edits on location names and notification ack states. |
| 35 | `bfb9373b` | Field logging for CR approval round-trip | `approveChangeRequest()` used direct `tx.update()` bypassing `updateChangeRequest()` which had `logFieldChanges`. Added logging to approval (status/reviewer/reviewedAt), and to applyWorkOrderChangesInTx, applySpareChangesInTx, applyStoreChangesInTx. Added per-table breakdown diag logging to `preparePullData`. |
| 36 | `3dd316c7` | Close 14 logFieldChanges gaps across 8 BOTH_EDITABLE tables | 10 gaps in `postgresStorage.ts` (addDefectNote, linkDefects, deleteCertificate, deleteSurvey, acknowledgeSuperintendentNotification, archiveWorkOrder, calculateAndUpdateRecurringDefects, checkAndRevertPostponedWorkOrders, updateLocation, inactivateStoresItem). 4 in external files (workOrderStatusRecalculator, adminController, importService, fleetAdminRepository). Deleted 4 dead-code methods: `bulkUpdateWorkOrders`, `bulkUpsertWorkOrders`, `archiveSparesByIds`, `bulkUpdateSparesByROB` (-79 lines). |
| 37 | `3dc5b41a` | Close all remaining logFieldChanges audit items | Added `logFieldChangesBatch()` helper — multi-row INSERT, 1000-row chunking. Fixed 3 bulk undo logging gaps in `bulkController.ts`. Only remaining deferred: `repairRhTracking` (adminController.ts) — needs arch restructure. |
| 38 | `b05c1901` | Wire `logFieldChangesBatch` into bulk import loop | `importService.ts` WO import loop restructured: collect entries during row processing, flush via one batch INSERT. Performance: O(rows × fields) round-trips → O(ceil(changed_fields / 1000)). |

### Round 14 — Running Hours Derived Propagation (2026-05-12, Bug B resolution)

| # | Commit | Fix | Impact |
|---|--------|-----|--------|
| 39 | `31c2d729` | Propagate running hours from audit row to component current-state on sync receive | **Resolves Bug B.** Ship RH updates write to both `components` (ONE_WAY) and `running_hours_audit` (BOTH_EDITABLE). Post-apply derived UPDATE in all 3 sync paths (oneWayApplier after INSERT, service.ts after UPDATE in receivePushData, syncEngine after UPDATE in applyFieldLog). Each reads `new_rh` from audit row and updates `current_cumulative_rh` + `rh_current_master`. |
| 40 | `59842c96` | Add `logFieldChanges` to superintendent notification creation | Ship-side WO approval creates superintendent_notifications rows, but INSERT had no logFieldChanges → never synced to shore. |
| 41 | `bc30e0ef` | Pass vesselId in anomaly detection superintendent notification creation | Anomaly-created notifications had null `vessel_id` → never matched sync queries (`WHERE vessel_id IN (...)`). |

### Round 15 — Serial Column Detection + SAVEPOINT Isolation (2026-05-13)

| # | Commit | Fix | Impact |
|---|--------|-----|--------|
| 42 | `61abd584` | Detect serial columns in `getColumnMeta` + SAVEPOINT isolation in INSERT pipeline | **Root cause:** `getColumnMeta` only checked `attidentity` — missed serial columns (`nextval(%)` DEFAULT). Ship's auto-increment `id` included in INSERT → shore PK conflict (23505). **Cascade:** 23505 error aborted PostgreSQL transaction → ALL subsequent UPDATE statements in same batch silently failed ("current transaction is aborted"). **Fix A:** query `pg_attrdef` for `nextval(%)` defaults. **Fix B:** Each INSERT group wrapped in SAVEPOINT/ROLLBACK TO SAVEPOINT. |
| 43 | `a05cc96c` | Skip field logging for serial id columns | Reduces wasted sync bandwidth — serial id values are auto-generated per-instance and shouldn't sync. |

### Round 16 — Running Hours Date Propagation (2026-05-13)

| # | Commit | Fix | Impact |
|---|--------|-----|--------|
| 44 | `1a51da23` | Propagate `rh_master_updated_at` in derived RH component update | Previous fix (39) only set `current_cumulative_rh` + `rh_current_master` but not `rh_master_updated_at` → "Last Updated Date" not showing on shore. |
| 45 | `9fae8097` | Set `last_updated` (TEXT) in derived RH component update | API reads `lastUpdated` first (highest priority), not `rhMasterUpdatedAt` → needed in derived update since components is ONE_WAY. |
| 46 | `6359429f` | Use `date_updated_local` for RH `last_updated` | Previous fix used `entered_at_utc` (system timestamp) → shore displayed UTC ISO string instead of user-selected date stored in `date_updated_local`. |

### Round 17 — Shore Deploy Safety + Identity Column Fixes (2026-05-14, Nilesh live testing)

| # | Commit | Fix | Impact |
|---|--------|-----|--------|
| 47 | `750be4ac` | Prevent shore LOCAL mode from marking field logs as synced before ship pulls | Shore's LOCAL mode test was marking its own field logs as `is_synced=true` before ship ever pulled them. |
| 48 | `f5ab3e08` | Remove destructive RBAC/ranks cleanup from every pull cycle | Pre-import RBAC cleanup was running on EVERY pull, not just provisioning — deleted and re-created RBAC data unnecessarily. |
| 49 | `6e0e10c3` | Identity column + composite key fixes for 17 tables + ship checkpoint local save | Extended identity column detection for tables with non-standard PK patterns. Ship now saves checkpoint locally after sync complete. |
| 50 | `fb860631` | Mixed INSERT+UPDATE field log groups silently dropped new rows | When a group of field logs for one row contained a mix of INSERT-origin (`oldValue=null`) and UPDATE-origin (`oldValue!=null`) logs, `applyFieldLogInserts` classified the entire group as UPDATE → skipped the INSERT → row never created. |
| 51 | `6b1d0da7` | Handle FK violation on field-log INSERT by nulling missing FK and retrying | When INSERT creates a row but references an FK that doesn't exist on receiver yet, nulls the FK column and retries. |

### Round 18 — 23505 Conflict Fallback + vesselId Fix (2026-05-14, Nilesh live testing round 2)

| # | Commit | Fix | Impact |
|---|--------|-----|--------|
| 52 | `97e3a2ea` | 23505 conflict fallback parse `err.detail` + diagnostic logging | Old 23505 fallback used ALL non-null fields to find conflicting row. Shore's existing row had different `survey_date` → 0 matches → "could not find existing row". Fix: parse PostgreSQL `err.detail` via regex `/Key \(([^)]+)\)=\(([^)]+)\)/` to extract exact constraint columns (Strategy 1). Added progressive count diagnostics in `getFieldLogsSinceCheckpoint`, enhanced fieldLogger output, `completeSyncSession` trace logging, SYNC_INSTANCE_ID mismatch detection. |
| 53 | `05a4f68a` | **THE CRITICAL FIX** — Missing `vesselId` in pulled field logs | In `preparePullData()`, `nonConflictingLogs.push({...})` built object with 9 fields but OMITTED `vesselId: shoreLog.vesselId`. On ship, `applyFieldLogInserts` reads `logs[0].vesselId` to set `vessel_id` in the INSERT → was `undefined` → NOT-NULL constraint violation. Affects ALL BOTH_EDITABLE tables. Single-line fix. Discovered from Nilesh's ship 5 logs showing `FIELD-LOG-INSERT FAIL: vessel_survey_data row=588f7548 — null value in column "vessel_id"`. |

### Round 19 — Derived Applicability for Ship-Created Certs/Surveys (2026-05-15)

| # | Commit | Fix | Impact |
|---|--------|-----|--------|
| 54 | `351bcc1a` | Derived applicability creation in `receivePushData()` after INSERT | When ship creates a new certificate/survey, the data row syncs (BOTH_EDITABLE) but the applicability row doesn't (ONE_WAY_SHORE_TO_SHIP). Shore UI queries applicability as entry point → data invisible. FIX: after `applyFieldLogInserts()`, scan INSERT-origin logs for `vessel_certificate_data`/`vessel_survey_data`, create derived applicability with ON CONFLICT DO NOTHING. **Superseded by fix 55 — INSERT-only check too narrow.** |
| 55 | *(pending)* | Ensure-applicability SQL after ALL field log processing + backfill migration 114 | FIX 54 only fired for INSERT-origin logs. Data rows synced BEFORE fix 54 deployment had no applicability (orphans). New approach: after BOTH insert and update phases, run `INSERT INTO ... SELECT` from data table where applicability is missing, scoped to the push vessel. Migration 114 backfills all existing orphans. Handles all cases: new inserts, pre-fix orphans, conflict-resolved rows. |

### Investigated & Confirmed No-Op

| Item | Investigation Result |
|------|---------------------|
| `work_orders.uploaded_documents` JSON column | Binary files are uploaded via `POST /work-orders/:id/documents` → `woDocumentService.uploadDocument()` which already calls `queueFileForSync()`. The JSON column stores metadata references only, synced via field logging. The legacy `WorkOrderForm.tsx` misc `/upload-document` path is dead code (never invoked with `onSubmit`). **No fix needed.** |
| `work_order_executions.uploaded_documents` JSON column | Same as above — references `work_order_documents` table files. **No fix needed.** |
| `component_running_hours_log` field logging | No write paths exist anywhere in the server codebase. Table is in `syncConfig.ts` as BOTH_EDITABLE but data is apparently written externally. **Logging must be wired when write paths are added.** |
