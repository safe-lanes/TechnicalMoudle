# Ship-Shore Sync — Technical Design (Approach C: Hybrid)

**Date:** 2026-04-23
**Author:** Ghazi Anwer + Claude
**Status:** Design approved, pending implementation
**Branch:** To be created: `feature/ship-shore-sync`

---

## Design Decisions (from brainstorming)

| # | Question | Decision |
|---|----------|----------|
| 1 | Deployment topology | One PostgreSQL DB per ship. Shore (AWS) has all vessels |
| 2 | Conflict resolution | Field-level merge — conflict only if both sides change the same field on the same record |
| 3 | File attachments | Separate file sync queue (lower priority than field data) |
| 4 | VSAT bandwidth pattern | Intermittent connectivity windows |
| 5 | Sync trigger | Manual "Sync Now" + resume from checkpoint |
| 6 | Who edits what | See editability matrix below |
| 7 | Initial provisioning | Full DB dump for first ship load |
| 8 | Sync scope | Vessel-specific data only (not all vessels) |

### Editability Matrix (from domain expert)

| # | Activity | Ship | Office |
|---|----------|------|--------|
| 1 | Create/complete/close Work Order | BOTH | BOTH |
| 2 | Approve Work Order | BOTH | BOTH |
| 3 | Postpone Work Order | BOTH | BOTH |
| 4 | Update Running Hours | BOTH | BOTH |
| 5 | Raise a new Defect | BOTH | BOTH |
| 6 | Update defect status | BOTH | BOTH |
| 7 | Verify/close defect from office | — | OFFICE ONLY |
| 8 | Update Spare Parts stock | BOTH | BOTH |
| 9 | Update Stores inventory | BOTH | BOTH |
| 10 | Add new Component | — | OFFICE ONLY |
| 11 | Edit component details | — | OFFICE ONLY |
| 12 | Change Job schedule/frequency | — | OFFICE ONLY |
| 13 | Submit Change Request | BOTH | BOTH |
| 14 | Approve/reject Change Request | — | OFFICE ONLY |
| 15 | Update Certificates & Surveys data | BOTH | BOTH |
| 16 | Manage Fleet templates | — | OFFICE ONLY |
| 17 | Manage Ranks, Org Chart, Access Control | — | OFFICE ONLY |
| 18 | Submit Noon Reports | SHIP ONLY | — |
| 19 | Upload documents/photos | BOTH | BOTH |
| 20 | View Reports & Dashboards | BOTH | BOTH |

### Domain Expert Validation (2026-04-23)

Domain expert responses received via document (`sync related questions.docx`). All 20 activities classified. Table classification confirmed as matching the architecture design.

| # | Activity | Domain Expert Answer | Sync Category |
|---|----------|---------------------|---------------|
| 1 | Create/complete/close Work Order | BOTH | BOTH_EDITABLE |
| 2 | Approve Work Order (as superintendent) | BOTH | BOTH_EDITABLE |
| 3 | Postpone Work Order | BOTH | BOTH_EDITABLE |
| 4 | Update Running Hours (daily readings) | BOTH | BOTH_EDITABLE |
| 5 | Raise a new Defect | BOTH | BOTH_EDITABLE |
| 6 | Update defect status (In-Progress, Closed) | BOTH | BOTH_EDITABLE |
| 7 | Verify/close defect from office side | OFFICE ONLY | BOTH_EDITABLE (with business rule — see below) |
| 8 | Update Spare Parts stock (consume, receive) | BOTH | BOTH_EDITABLE |
| 9 | Update Stores inventory (consume, receive) | BOTH | BOTH_EDITABLE |
| 10 | Add new Component (equipment) | OFFICE ONLY | ONE_WAY_SHORE_TO_SHIP |
| 11 | Edit component details (maker, model, criticality) | OFFICE ONLY | ONE_WAY_SHORE_TO_SHIP |
| 12 | Change Job schedule or frequency | OFFICE ONLY | ONE_WAY_SHORE_TO_SHIP |
| 13 | Submit Modify PMS / Change Request | BOTH | BOTH_EDITABLE |
| 14 | Approve/reject Change Request | OFFICE ONLY | ONE_WAY_SHORE_TO_SHIP (approval action) |
| 15 | Update Certificates & Surveys data | BOTH | BOTH_EDITABLE |
| 16 | Manage Fleet templates | OFFICE ONLY | ONE_WAY_SHORE_TO_SHIP |
| 17 | Manage Ranks, Org Chart, Access Control | OFFICE ONLY | ONE_WAY_SHORE_TO_SHIP |
| 18 | Submit Noon Reports | SHIP ONLY | SHIP_ONLY (per maritime standard practice, confirmed by domain expert omission) |
| 19 | Upload documents/photos to WO or defects | BOTH | BOTH_EDITABLE + sync_file_queue |
| 20 | View Reports & Dashboards | BOTH (read-only) | NO_SYNC (generated locally from synced data) |

#### Business Rule: Defect Verify/Close (Activity #7)

The `defects` table remains classified as **BOTH_EDITABLE** because both ship and office can raise defects, update status, and add actions. However, **verify/close is office-only**:

- **Rule:** During sync merge (Phase 4.5), if a `defects` row has a `status` field change to `'Verified'` or `'Closed'`, the sync engine must check the `instance_id` of the originating change.
  - If `instance_id` starts with `SHORE` → accept the status change
  - If `instance_id` starts with `SHIP` → **reject** the status change, log a sync warning, and revert the field to its previous value
- **Enforcement:** This rule is enforced at the sync merge layer, not at the application UI layer. The ship application may optionally also hide the Verify/Close buttons in the UI, but the sync engine is the authoritative gate.
- **Rationale:** Domain expert confirmed verify/close is an office-only supervisory action. Ship crew raises and works on defects; office verifies and closes them.

#### Noon Reports Confirmation (Activity #18)

Domain expert left #18 blank. Classified as **SHIP_ONLY** per standard maritime practice — noon reports are submitted by the vessel's master or duty officer while at sea. Shore/office staff view them (read-only via synced data) but never create or edit them.

---

## Architecture: Approach C (Hybrid)

### Why Hybrid?

- ~70% of tables are one-way (office→ship) — they don't need conflict machinery
- No PostgreSQL triggers — triggers on 96 tables would add write overhead and maintenance burden
- Bandwidth-optimal — one-way tables send only `updated_at` deltas, BOTH-editable tables send compact field logs
- Conflict resolution is focused — only applies to ~10 table groups where it's actually needed

### Three Sync Paths

1. **ONE_WAY_SHORE_TO_SHIP** — Shore is master. Ship receives overwrites. No conflict logic.
2. **BOTH_EDITABLE** — Field-level merge with conflict detection via `sync_field_log`.
3. **SHIP_ONLY** — Ship is master. Shore receives overwrites. No conflict logic.

---

## Phase 0: Schema Foundation

| # | Task | Description |
|---|------|-------------|
| 0.1 | Add `instance_id` to config | Each deployment gets a unique identity string (e.g., `SHIP-V003`, `SHORE-AWS`). Stored in env var `SYNC_INSTANCE_ID`. Used to tag which instance originated a change |
| 0.2 | Create `sync_metadata` table | Tracks per-instance sync state: `instance_id`, `last_sync_checkpoint` (timestamp), `last_sync_status`, `last_sync_at`, `sync_direction` (ship/shore) |
| 0.3 | Create `sync_field_log` table | Core change tracking for BOTH-editable tables: `id`, `log_uuid`, `table_name`, `row_uuid`, `field_name`, `old_value` (text), `new_value` (text), `changed_at` (timestamp), `changed_by_user_id`, `instance_id`, `sync_batch_id` (nullable), `is_synced` (boolean, default false) |
| 0.4 | Create `sync_conflicts` table | Stores unresolved conflicts: `id`, `conflict_uuid`, `table_name`, `row_uuid`, `field_name`, `ship_value`, `ship_changed_at`, `ship_changed_by`, `shore_value`, `shore_changed_at`, `shore_changed_by`, `resolution` (null / 'ship_wins' / 'shore_wins' / 'manual'), `resolved_at`, `resolved_by` |
| 0.5 | Create `sync_file_queue` table | File transfer queue: `id`, `queue_uuid`, `table_name`, `row_uuid`, `file_key`, `file_size_bytes`, `direction` (ship_to_shore / shore_to_ship), `status` (pending / in_progress / completed / failed), `chunk_offset`, `total_chunks`, `created_at`, `completed_at`, `instance_id`, `retry_count` |
| 0.6 | Create `sync_batches` table | Audit trail per sync session: `id`, `batch_uuid`, `initiated_by_instance`, `started_at`, `completed_at`, `status`, `records_sent`, `records_received`, `conflicts_found`, `files_queued`, `checkpoint_before`, `checkpoint_after`, `error_message` |
| 0.7 | Classify all 96 tables | Create `shared/syncConfig.ts` with table classification (see Phase 1) |
| 0.8 | Add `updated_at` indexes | Add `idx_{table}_updated_at` index on every syncable table missing one |
| 0.9 | Audit UUID coverage | Verify every syncable table has a stable UUID identity column. Tables with integer-only PK need a UUID column added |

---

## Phase 1: Table Classification Config

Create `shared/syncConfig.ts`:

### ONE_WAY_SHORE_TO_SHIP
`components`, `jobs`, `job_component_links`, `fleet_components`, `fleet_jobs`, `fleet_spares`, `fleet_vessel_mapping`, `fleet_component_mapping`, `fleet_job_vessel_mapping`, `fleet_spare_vessel_mapping`, `adm_available_ranks`, `adm_vessel_org_chart`, `vessel_org_chart_nodes`, `vessel_department_config`, `admn_role_master`, `adm_menumaster_ac`, `adm_role_menu_access`, `equipment_categories`, `sfi_details`, `master_data`, `defect_categories`, `defect_types`, `form_definitions`, `form_versions`, `alert_policies`, `company_standard_grace_settings`, `pms_vessel_settings`, `ship_certificates_master`, `ship_certificates_labels_config`, `ship_surveys_master`, `ship_surveys_labels_config`, `vessel_certificate_applicability`, `vessel_survey_applicability`, `maker_list`, `master_list_types`

### BOTH_EDITABLE
`work_orders`, `work_order_executions`, `work_order_execution_details`, `work_order_postponements`, `work_order_documents`, `defects`, `defect_actions`, `defect_attachments`, `spares`, `spares_history`, `spare_location_stock`, `spare_component_links`, `stores_items`, `stores_ledger`, `inventory_transactions`, `change_request`, `change_request_attachment`, `change_request_comment`, `certificates`, `surveys`, `vessel_certificate_data`, `vessel_survey_data`, `running_hours_audit`, `component_running_hours_log`, `component_maintenance_history`

### SHIP_ONLY
Noon report tables (all), `defect_sequences`

### NO_SYNC
`users`, `sync_metadata`, `sync_field_log`, `sync_conflicts`, `sync_file_queue`, `sync_batches`, `audit_log`, `import_history`, `import_change_log`, `bulk_import_history`, `bulk_import_errors`, `report_snapshots`, `report_favorites`, `monthly_snapshots`, `superintendent_notifications`, `alert_events`, `alert_deliveries`, `alert_acknowledgements`, `alert_config`, `work_order_anomalies`, `master_users`, `vessels`, `fleets`, `fleet_classes`, `vessel_types`, `additional_groups`, `ports`, `fleet_groups`, `locations`, `planner_dates`

| # | Task |
|---|------|
| 1.1 | Write `shared/syncConfig.ts` with table classification, UUID column mapping, vessel-scoping column per table |
| 1.2 | Add `syncDirection` field per table |
| 1.3 | Add `identityColumn` field per table mapping to its UUID column |
| 1.4 | Add `vesselScopeColumn` field per table |

---

## Phase 2: Field Change Logging (BOTH-editable tables only)

| # | Task | Description |
|---|------|-------------|
| 2.1 | Create `server/modules/sync/fieldLogger.ts` | Utility: `logFieldChanges(tableName, rowUuid, oldRow, newRow, userId)` — diffs two row objects, writes one `sync_field_log` entry per changed field. Ignores `updated_at`, `created_at`, `is_sync` |
| 2.2 | Instrument Work Order service | Add `logFieldChanges()` calls for: create, update, complete, postpone, approve |
| 2.3 | Instrument Defects service | Add for: create, update status, add action, verify/close |
| 2.4 | Instrument Spares service | Add for: consume, receive, adjust ROB, update details |
| 2.5 | Instrument Stores service | Add for: consume, receive, update |
| 2.6 | Instrument Change Request service | Add for: submit, update, approve, reject, add comment |
| 2.7 | Instrument Cert/Survey service | Add for: update certificate data, update survey data |
| 2.8 | Instrument Running Hours service | Add for: daily RH updates, audit log entries |
| 2.9 | Instrument Component Maintenance History | Add for: new maintenance records (INSERT only) |
| 2.10 | Instrument WO Document / Defect Attachment services | Add for: upload, delete — also queue to `sync_file_queue` |

---

## Phase 3: Sync Protocol — API Endpoints

| # | Task | Description |
|---|------|-------------|
| 3.1 | Create `server/modules/sync/` module | routes, controller, service, repository |
| 3.2 | `POST /sync/initiate` | Ship starts sync session. Sends: `instance_id`, `vessel_id`, `last_checkpoint`, `batch_uuid` |
| 3.3 | `POST /sync/push` | Ship pushes changes. Payload: `{ batch_uuid, one_way_rows, field_logs }` |
| 3.4 | `POST /sync/pull` | Ship requests shore's changes since last checkpoint |
| 3.5 | `POST /sync/resolve-conflict` | Ship sends conflict resolution decisions |
| 3.6 | `POST /sync/complete` | Both sides advance checkpoint |
| 3.7 | `GET /sync/status` | Current sync state, pending counts |
| 3.8 | Sync authentication | API key per ship, validated against vessel_id |

---

## Phase 4: Sync Engine — Core Logic

| # | Task | Description |
|---|------|-------------|
| 4.1 | Create `syncEngine.ts` | Orchestrator: initiate → push → pull → resolve → complete |
| 4.2 | Delta extractor | Query rows with `updated_at > last_checkpoint AND vessel_id = X` |
| 4.3 | One-way applier (shore→ship) | Upsert by UUID. Overwrite all fields |
| 4.4 | One-way applier (ship→shore) | Same logic for SHIP_ONLY tables |
| 4.5 | Field-level merger | Compare field logs. Different fields → auto-merge. Same field → conflict. **Business rule:** Defect `status` changes to `Verified`/`Closed` only accepted from shore instance (`instance_id` prefix `SHORE`); ship-originated verify/close is rejected and reverted — see Domain Expert Validation §Business Rule above |
| 4.6 | Conflict queue manager | Present conflicts in UI, allow resolution |
| 4.7 | Checkpoint manager | Track and advance `last_sync_checkpoint`. Partial sync preserves old checkpoint |
| 4.8 | Payload compression | Gzip all sync payloads (60-70% compression on JSON) |
| 4.9 | Batch chunking | Split >500 rows into chunks of 200. Checkpoint per chunk |
| 4.10 | Retry and timeout handling | 30s timeout, 3 retries with exponential backoff |

---

## Phase 5: File Sync Queue

| # | Task | Description |
|---|------|-------------|
| 5.1 | File queue processor | Background worker, runs after field sync completes |
| 5.2 | Chunked file upload | Split files >256KB into chunks. Track offset for resume |
| 5.3 | `POST /sync/file/upload-chunk` | Receives chunk, reassembles on completion |
| 5.4 | `GET /sync/file/download-chunk` | Ship downloads shore files in chunks |
| 5.5 | File storage adapter | Interface: `saveFile`, `readFile`, `deleteFile`. Ship=local FS, Shore=S3/GCS |
| 5.6 | File integrity verification | SHA-256 hash per file, verify after reassembly |
| 5.7 | Priority queue | Small files first, large files by creation date |

---

## Phase 6: Initial Ship Provisioning

| # | Task | Description |
|---|------|-------------|
| 6.1 | `POST /sync/provision/:vesselId` | Generate full data dump for a vessel |
| 6.2 | Export script | Compressed SQL/JSON bundle filtered to vessel_id |
| 6.3 | Import script | Load provisioning bundle into fresh ship PostgreSQL |
| 6.4 | Provisioning verification | FK consistency, UUID uniqueness, row count checks |
| 6.5 | Delta provisioning | For re-provisioning after ship DB corruption |

---

## Phase 7: Ship-Side Sync UI

| # | Task | Description |
|---|------|-------------|
| 7.1 | Sync Dashboard page | `/admin/sync` — last sync time, pending counts, conflicts, connection status |
| 7.2 | "Sync Now" button | Triggers sync with real-time progress |
| 7.3 | Sync history table | Past batches with stats |
| 7.4 | Conflict resolution UI | Side-by-side comparison, pick winner |
| 7.5 | File queue viewer | Pending transfers with progress bars |
| 7.6 | Connection test | Ping shore, report latency |
| 7.7 | Sync indicator in header | Status icon always visible |

---

## Phase 8: Shore-Side Sync Admin

| # | Task | Description |
|---|------|-------------|
| 8.1 | Fleet sync overview | All vessels: last sync, pending, conflicts |
| 8.2 | Per-vessel sync log | Drill into vessel sync history |
| 8.3 | Conflict resolution (shore side) | Shore can also resolve conflicts |
| 8.4 | Provisioning management | Generate/track provisioning bundles |
| 8.5 | Sync API key management | Generate/revoke keys per vessel |

---

## Phase 9: Pruning & Maintenance

| # | Task | Description |
|---|------|-------------|
| 9.1 | Changelog pruning | `sync_field_log` entries >90 days with `is_synced=true` deleted |
| 9.2 | File queue cleanup | Completed entries pruned after 30 days |
| 9.3 | Batch history retention | `sync_batches` kept 1 year, then archived |
| 9.4 | Conflict auto-escalation | Unresolved >7 days → alert notification |
| 9.5 | Sync health monitor | No sync in >48 hours → shore alert |

---

## Timeline

| Phase | What | Duration |
|-------|------|----------|
| Phase 0 | Schema foundation | ~1 week |
| Phase 1 | Table classification | ~2-3 days |
| Phase 2 | Field change logging | ~2 weeks |
| Phase 3 | Sync API endpoints | ~1.5 weeks |
| Phase 4 | Sync engine core | ~3 weeks |
| Phase 5 | File sync queue | ~2 weeks |
| Phase 6 | Initial provisioning | ~1 week |
| Phase 7 | Ship-side UI | ~1.5 weeks |
| Phase 8 | Shore-side admin | ~1 week |
| Phase 9 | Pruning & maintenance | ~3-4 days |
| **Total** | | **~12-14 weeks** |
