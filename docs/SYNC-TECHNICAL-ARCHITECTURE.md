# Ship-Shore Sync — Technical Architecture

> **Version:** 1.0  
> **Last Updated:** 2026-04-25  
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
- 30 BOTH_EDITABLE tables
- 6 SHIP_ONLY tables
- 31 NO_SYNC tables
- 22 API endpoints across 6 functional groups

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
| `syncEngine.ts` | Orchestrates a complete sync cycle (INITIATE → PUSH → PULL → COMPLETE) |
| `service.ts` | Business logic for each protocol step |
| `repository.ts` | Database operations for sync infrastructure tables |
| `controller.ts` | Express request handlers (22 endpoints) |
| `routes.ts` | Route registration with middleware |
| `fieldLogger.ts` | Logs field-level changes for BOTH_EDITABLE tables |
| `oneWayApplier.ts` | Upserts rows by UUID for one-way sync |
| `fileSyncProcessor.ts` | Chunked binary file transfer (256KB chunks, SHA-256 verification) |
| `provisioningService.ts` | Generates/imports vessel data bundles for initial ship deployment |
| `pruningService.ts` | Automated cleanup of sync infrastructure tables |
| `healthMonitor.ts` | Detects sync health issues (stale syncs, stuck files, etc.) |
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

### 3.2 BOTH_EDITABLE (30 tables)

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

### 3.4 NO_SYNC (31 tables)

Never synced. Instance-local data only.

**Platform-provisioned (managed by SAILERP):**
`users`, `master_users`, `vessels`, `fleets`, `vessel_types`, `additional_groups`, `ports`, `locations`

**Sync engine internal:**
`sync_metadata`, `sync_field_log`, `sync_conflicts`, `sync_file_queue`, `sync_batches`

**Local audit/import/reporting:**
`audit_log`, `import_history`, `import_change_log`, `bulk_import_history`, `bulk_import_errors`, `report_snapshots`, `report_favorites`, `monthly_snapshots`, `superintendent_notifications`

**Local alert state:**
`alert_events`, `alert_deliveries`, `alert_acknowledgements`

**Local computation/planning:**
`work_order_anomalies`, `planner_dates`, `schema_migrations`, `form_version_usage`, `recurring_defects`, `recurring_defect_links`

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
- Data sent in chunks of 200 records (`CHUNK_SIZE` in `syncEngine.ts`)

**3. PULL** (`service.ts → preparePullData`)
- Shore gathers ONE_WAY_SHORE_TO_SHIP rows changed since checkpoint
- Shore gathers its own BOTH_EDITABLE field logs (excluding ship's own changes)
- **Conflict detection:** If both ship and shore changed the same field on the same row, a `sync_conflicts` record is created
- Non-conflicting shore changes are sent as field logs for ship to apply

**4. RESOLVE** (`service.ts → resolveConflictAction`)
- Resolution options: `ship_wins`, `shore_wins`, `manual` (custom value)
- Auto-resolution: if both sides changed to the same value → `auto_same_value`
- Winning value is applied to the data table via direct SQL UPDATE

**5. COMPLETE** (`service.ts → completeSyncSession`)
- Marks all transferred field logs as synced (`is_synced = true`)
- Advances the checkpoint timestamp in `sync_metadata`
- Updates batch status to `completed` with duration

**6. FILE SYNC** (`fileSyncProcessor.ts`)
- Runs after field data sync is complete (non-fatal if it fails)
- Processes `sync_file_queue` entries for the vessel
- Files chunked into 256KB pieces, base64-encoded
- SHA-256 hash verification on reassembly
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
const SKIP_FIELDS = ['updated_at', 'updatedAt', 'created_at', 'createdAt', 'is_sync', 'isSync', 'id'];
```

### Logging Behavior

| Operation | Old Row | New Row | What Gets Logged |
|-----------|---------|---------|-----------------|
| INSERT | `null` | `{...}` | All non-null, non-skip fields with `old_value = null` |
| UPDATE | `{...}` | `{...}` | Only fields where `String(old) !== String(new)` |
| Soft-DELETE | `{is_deleted: false}` | `{is_deleted: true}` | Single entry for `is_deleted` field |
| Hard DELETE | `{...}` | `null` | Warning logged, no field log entry (system uses soft-delete) |

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

### Business Rules

From `shared/syncConfig.ts`, the `defects` table has a business rule:
- Only shore can set `status = 'verified'` — ship-side verification attempts are rejected during PUSH

---

## 7. File Sync

**File:** `server/modules/sync/fileSyncProcessor.ts`

### Tables with Binary Files

| Table | Storage | Notes |
|-------|---------|-------|
| `work_order_documents` | `fileKey` + `storageBackend` (`local` or `object`) | Real binary files |
| `component_documents` | `fileKey` + `storageBackend` | Real binary files |

### Tables with URL References Only (no binary sync needed)

| Table | Column | Notes |
|-------|--------|-------|
| `defect_attachments` | `url` | Synced via field logging |
| `change_request_attachment` | `url` | Synced via field logging |

### Transfer Protocol

- **Chunk size:** 256KB (`CHUNK_SIZE_BYTES = 256 * 1024`)
- **Max retries:** 3 per file
- **Priority:** Small files (<100KB) processed first, then by creation date
- **Hash verification:** SHA-256 of complete file checked after reassembly
- **Resume:** Tracks `chunk_offset` — interrupted transfers resume from last successful chunk
- **Direction:** Determined by `SYNC_INSTANCE_ID` prefix (SHIP → `ship_to_shore`, SHORE → `shore_to_ship`)

### Storage Directories

```
.private/wo-docs/          — Work order documents
.private/component-docs/   — Component documents
.private/sync-temp/        — Temporary chunk storage during reassembly
```

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
