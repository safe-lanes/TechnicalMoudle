# SYSTEM_OVERVIEW.md

Factual reference for the Seafarer Technical Management System (maritime PMS) as it exists in this codebase today. Generated from code analysis — describes only what is implemented.

---

## 1. TECH STACK

| Layer | Technology |
|---|---|
| Language | TypeScript (ESM), strict mode; acknowledged tsc error baseline of 290 |
| Frontend | React 18, Vite, Wouter (routing), TanStack React Query v5, React Context |
| UI | shadcn/ui (Radix primitives), Tailwind CSS, lucide-react icons, Framer Motion |
| Tables | AG Grid Enterprise **34.1.0 (pinned — license-capped, do not upgrade)** via shared `AgGridTable` components |
| Forms | React Hook Form + Zod (`@hookform/resolvers`) |
| Backend | Node.js + Express 4, `tsx` for dev, esbuild for production bundle |
| Database | PostgreSQL (Neon), Drizzle ORM, drizzle-kit migrations |
| Sessions | express-session + connect-pg-simple |
| Files | Multer (memory) → Replit Object Storage / GCS signed URLs |
| Exports | ExcelJS, jspdf, JSZip, xlsx (bulk import parsing) |
| Testing | Playwright E2E (`tests/`, targets localhost:5000), Vitest unit (`server/**/__tests__`) |

The 290-error figure is the measured count as at September 25, 2026 (approval-engine-phase2 after the Defects merge); any change to it must be stated explicitly in a task report rather than absorbed silently.

### Folder structure
```
client/src/
  pages/            # one folder per module (pms, defects, cert-surveys, admin, spares,
                    # stores, reports, noon-report, purchasing, modify-pms, _archived)
  components/       # feature components + AgGrid/ (shared table) + ui/ (shadcn)
  contexts/         # AuthContext, VesselContext, PermissionsContext, UIRoleContext,
                    # OfflineContext, ChangeRequestContext, ChangeModeContext, MarkerContext
  hooks/            # custom hooks (use-toast, useVessels, …)
  lib/              # queryClient.ts (apiRequest + default fetcher)
server/
  index.ts          # entry point; runs migrations then serves on port 5000
  routes.ts         # main route registration + middleware mounting
  modules/          # per-module: routes → controllers → services → repositories
  postgresStorage.ts# sole IStorage implementation (~9.7k lines)
  storageFactory.ts # fails fast without DATABASE_URL
  objectStorage.ts  # file storage service
  migrations.ts     # migration runner (applies, never generates)
shared/
  schema.ts         # Drizzle schema, 121 pgTable declarations (~4.4k lines)
  syncConfig.ts     # ship↔shore sync table classification (DO NOT MODIFY casually)
migrations/         # 4-digit drizzle-generated + 3-digit hand-written SQL
```

- Path aliases: `@/` → `client/src/`, `@shared/` → `shared/`, `@assets/` → `attached_assets/`.
- Single port (5000): Express serves the API and the Vite dev server / static build.
- Micro-frontend: `micro-frontend.config.js` (Module Federation) exposes `App`, `ElementCrewAppraisals`, `AppraisalForm`, `AdminModule`, `FormEditor`; React, React-DOM, TanStack Query shared as singletons. Built via `build:micro-frontend` script.

---

## 2. MODULES & SUB-MODULES

Top navigation (in `TopMenuBar`): **Technical · Cert. & Surveys · Defects · PMS · Admin · Purchasing** (+ Noon Report routes). All main screens render inside `TechnicalModule.tsx` (top bar + `SideMenuBar` + content switch). Forms/wizards are standalone full-screen routes registered in `App.tsx`.

### 2.1 PMS (Technical core)
| Screen | Route | File | Purpose | Status |
|---|---|---|---|---|
| Dashboard | `/`, `/pms` | `pages/pms/Dashboard.tsx` | Maintenance KPIs, overdue WOs, fleet trend charts | Production-ready |
| Components | `/pms/components` | `pages/pms/Components.tsx` | Hierarchical SFI component tree + detail panel | Production-ready |
| Work Orders | `/pms/work-orders` | `pages/pms/WorkOrders.tsx` | AG Grid of planned/unplanned WOs, status lifecycle | Production-ready |
| Running Hours | `/pms/running-hrs` | `pages/pms/RunningHours.tsx` | RH entry with cascade to child components | Production-ready |
| Spares | `/spares` | `pages/spares/SparesNew.tsx` | Spares inventory, ROB, adjust/consume/receive | Production-ready |
| Bulk Update Spares | `/spares/bulk-update` | `pages/spares/BulkUpdateSpares.tsx` | Grid-based mass stock update (standalone) | Production-ready |
| Stores | `/stores` | `pages/stores/Stores.tsx` | Stores/lubes/chemicals inventory with ledger | Production-ready |
| Bulk Update Stores | `/stores/bulk-update` | `pages/stores/BulkUpdateStores.tsx` | Mass store update (standalone) | Production-ready |
| Reports | `/reports` | `pages/reports/ReportsModule.tsx` | Tree selector for 20+ reports across 9 categories | Production-ready (some Excel exports stubbed) |
| Modify PMS | `/pms/modify-pms` | `components/modifyPms/ModifyPMS.tsx` | Change requests for components/jobs/spares/stores | Production-ready |
| Modify PMS Jobs selector | `/pms/modify-pms/jobs` | `pages/modify-pms/JobsSelector.tsx` | Job picker inside CR flow | Production-ready |
| Maintenance Records | `/pms/maintenance-records/:componentId` | `pages/pms/MaintenanceRecords.tsx` | Per-component maintenance history | Production-ready |
| Superintendent | `/pms/superintendent` | `pages/pms/SuperintendentPage.tsx` | Office acknowledgment of flagged WOs | Production-ready |
| PMS Admin | `/pms/admin` | `pages/pms/PMSAdmin.tsx` | Bulk import, form config, vessel settings | Production-ready |
| Work Order form | `/pms/work-order/new/:componentId`, `/pms/work-order/unplanned/new`, `/pms/work-order/:id` | `pages/pms/WorkOrderFormPage.tsx` | Create/execute WO (standalone, mode-driven) | Production-ready |
| Job form | `/pms/job/:id` | `pages/pms/JobsFormPage.tsx` | Job template editor (standalone) | Production-ready |
| Anomalies | `/pms/anomalies` | `pages/pms/AnomaliesPage.tsx` | WO anomaly detection review (standalone) | Production-ready |

### 2.2 Cert. & Surveys
| Screen | Route | File | Purpose | Status |
|---|---|---|---|---|
| Certificates | `/cert-surveys` | `pages/cert-surveys/CertificatesPage.tsx` | Vessel certificate tracking (issue/expiry/annuals) | Production-ready |
| Surveys | `/cert-surveys/surveys` | `pages/cert-surveys/SurveysPage.tsx` | Survey schedule with range dates | Production-ready |

### 2.3 Defects
| Screen | Route | File | Purpose | Status |
|---|---|---|---|---|
| Dashboard | `/defects` | `pages/defects/DefectsDashboard.tsx` | Defect KPIs, status/vessel charts | Production-ready |
| Defect Log | `/defects/active` | `pages/defects/DefectsLogWithTabs.tsx` | Active defects grid with linking, notes, actions | Production-ready |
| CoC | `/defects/coc` | `pages/defects/DefectsCoC.tsx` | Condition of Class defects | Production-ready |
| Recurring Defects | `/defects/recurring` | `pages/RecurringDefects.tsx` | **"Coming Soon" stub page** | Stub |
| Resolved | `/defects/resolved` | `pages/defects/DefectsResolved.tsx` | Closed defect history | Production-ready |
| Defect Reports | `/defects/reports` (hidden in sidebar) | `pages/defects/DefectsReports.tsx` | **"Coming Soon" placeholder** | Stub |
| Defect wizard | `/defects/new`, `/defects/edit/:id`, `/defects/view/:id`, `/defects/close/:id` | `pages/defects/DefectFormWizard.tsx` | Multi-step defect report/edit/close (standalone) | Production-ready |

### 2.4 Admin
| Screen | Route (`/admin/…`) | File | Purpose | Status |
|---|---|---|---|---|
| Data Masters | `masters` (default for `/admin`) | `pages/admin/DataMasters.tsx` | Master lists (vessels, types, ports, users, approvers…) | Production-ready |
| Ship's Certificates | `ships-certificates` | `pages/admin/ShipsCertificatesAdmin.tsx` | Master certificate definitions + applicability | Production-ready (hardcoded dropdown TODOs) |
| Ship's Surveys | `ships-surveys` | `pages/admin/ShipsSurveysAdmin.tsx` | Master survey definitions | Production-ready |
| Ranks | `ranks` | `pages/admin/RanksAdmin.tsx` | Rank master + vessel org chart | Production-ready |
| Access Control | `access-control` | `pages/admin/AccessControl.tsx` | Role → menu permission matrix (**Sail Admin only**) | Production-ready |
| Audit Trail | `audit-trail` | `pages/admin/AuditTrail.tsx` | Searchable business audit log (**Sail Admin only**) | Production-ready (React key warning) |
| Retention Settings | `retention-settings` | `pages/admin/RetentionSettings.tsx` | Data purge policies (**Sail Admin only**) | Production-ready |
| Sync Dashboard | `sync-dashboard` | `pages/admin/SyncDashboard.tsx` | Ship↔shore sync status/trigger/history | Production-ready (no sync history in this env) |
| Conflict Review | `sync-conflicts` | `pages/admin/SyncConflictReview.tsx` | Manual sync conflict resolution | Production-ready |
| Ship Provisioning | `sync-provisioning` | `pages/admin/SyncProvisioning.tsx` | Provision ship instances | Production-ready |
| Fleet Overview | `sync-fleet` (Sail Admin only) | `pages/admin/SyncFleetOverview.tsx` | Fleet-wide sync overview | Production-ready |
| Approval Workflow | `approval-workflow` | `pages/admin/ApprovalWorkflow.tsx` | Legacy level matrix still consumed by Modify PMS and WO postponement; its Defects rows are not consumed by live Defects approval code | Production-ready (legacy/dual-wired) |
| Approval Engine | `approval-engine` | `pages/admin/ApprovalEngineAdminPage.tsx` | Configure classification-specific engine workflows and view Defects approval diagnostics; shore-only and restricted to PMS Admin, Sail Admin, and Super Admin | Production-ready |
| Fleet Component Editor | `fleet-component-editor/:id?` | `pages/admin/AddEditFleetComponent.tsx` | Fleet-level component template editor | Production-ready |

### 2.5 Purchasing
| Screen | Route | File | Purpose | Status |
|---|---|---|---|---|
| Shipskart embed | `/purchasing` | `pages/purchasing/PurchasingPage.tsx` | Iframe SSO into external Shipskart platform | Code complete; **non-functional without SHIPSKART_* env vars** (unset here) |

### 2.6 Noon Report
| Screen | Route | File | Purpose | Status |
|---|---|---|---|---|
| Daily Entry | `/noon-report`, `/noon-report/entry/:id` | `pages/noon-report/NoonEntryForm.tsx` | 5-tab daily vessel performance entry | Production-ready |
| Report History | `/noon-report/history` | `pages/noon-report/ReportHistory.tsx` | Submitted/draft noon reports | Production-ready |
| Fuel Dashboard | `/noon-report/fuel-dashboard` | `pages/noon-report/FuelDashboard.tsx` | Imported as `FuelDashboardPlaceholder` | Stub |
| Alerts | `/noon-report/alerts` | `pages/noon-report/AlertsPanel.tsx` | Imported as `AlertsPanelPlaceholder` | Stub |
| Bunker Mgmt | `/noon-report/bunker` | `pages/noon-report/BunkerManagement` | Placeholder | Stub |
| Reports & Export | `/noon-report/reports` | `pages/noon-report/ReportsExport.tsx` | Placeholder | Stub |
| Fleet Overview | `/noon-report/fleet` | `pages/noon-report/FleetOverview.tsx` | Placeholder | Stub |

### 2.7 Other
- `/test-e2e` → `pages/TestE2E.tsx` — dev/testing harness, not user-facing.
- `pages/_archived/` — legacy page variants (DefectForm, ModifyPMS, Spares…) not routed.
- Floating AI chat: `components/chat/ChatButton.tsx` on all pages (backend `server/modules/chatbot`).
- Route ordering note (`App.tsx`): standalone form routes are registered **before** the generic `/:subpage` catch-alls; `TechnicalModule.getStateFromUrl()` maps URL → (subModule, menuItem); unknown menu items render a generic "content will be displayed here" panel.

---

## 3. DATABASE SCHEMA

121 tables are declared with `pgTable` in `shared/schema.ts`. Nearly every table carries the sync-readiness columns: `{prefix}uuid` (TEXT UNIQUE, `gen_random_uuid()::text` DB default), `created_at`, `updated_at`, `created_by_uuid`, `updated_by_uuid`, `is_deleted` (soft delete), `is_sync`. UUIDs (e.g. `vuuid`, `cuuid`, `juuid`, `wouuid`, `duuid`, `suuid`) are the canonical cross-instance identity for ship↔shore sync; integer `id` PKs are local only.

**pgEnums**: `user_role` (Ship, Office, PMS Admin, Sail Admin), `inventory_event_type` (RECEIVE, CONSUME, ADJUST_OPENING_BALANCE, ADJUST_CORRECTION), `inventory_reference_type`, `ihm_presence` (YES/NO/UNKNOWN), `ihm_evidence_type`.

### Core / master (shared by all modules)
| Table | Purpose |
|---|---|
| `users` | System users; `role` enum, `vessel_id` scoping |
| `fleets`, `fleet_classes`, `fleet_groups` | Fleet hierarchy |
| `vessels` | Central vessel registry (`vuuid`, `fleet_id`, `vessel_sequence` for counters) |
| `master_list_types` + `master_lists` | Generic lookup system for dropdowns (typed master data) |
| `master_data`, `master_users`, `vessel_types`, `additional_groups`, `ports` | Admin data-master tables |
| `maker_list`, `makers` | Manufacturer directories |
| `sfi_details` | SFI classification codes |
| `adm_available_ranks`, `adm_vessel_org_chart`, `vessel_org_chart_nodes`, `vessel_department_config` | Rank master, standard hierarchy, per-vessel org chart |
| `admn_role_master`, `adm_menumaster_ac`, `adm_role_menu_access` | RBAC: roles, menu master, role→menu permissions |
| `approval_workflow_config` | Legacy approval levels per module/function; live step creation remains in Modify PMS and WO postponement, while the displayed Defects rows are not consumed by Defects runtime approval logic |
| `moc_approvers` | Management-of-change approver assignments |

### PMS
| Table | Purpose |
|---|---|
| `components` | Equipment registry; self-referential `parent_id` hierarchy, `current_cumulative_rh`, links to vessel |
| `jobs` | Maintenance job templates; `component_id`, `maintenance_basis` (Calendar/RH), frequency, `assigned_to_rank_id` |
| `job_component_links` | M:N job↔component with per-link `last_done_date` / `next_due_date` |
| `work_orders` | WO instances (`JOBCODE.WO-YYYY-NN`); status lifecycle, `form_data` JSON, `completion_rh` |
| `work_order_executions`, `work_order_execution_details` | Completed execution records |
| `work_order_postponements`, `wo_postponement_approvals` | Postponement request/approval flow |
| `work_order_documents` | WO attachments |
| `work_order_anomalies` | Anomaly detection results |
| `superintendent_notifications` | Office acknowledgment queue |
| `component_maintenance_history` | Immutable per-component maintenance log |
| `component_documents`, `component_class_regulatory`, `component_requisitions` | Component attachments, class/regulatory tracking, requisitions |
| `pms_vessel_settings`, `company_standard_grace_settings` | Vessel lead-time/grace rules, global defaults |
| `planner_dates` | WO planner planned dates |
| `equipment_categories` | Equipment category lookup |

### Fleet-level templates (shore master data)
| Table | Purpose |
|---|---|
| `fleet_components`, `fleet_jobs`, `fleet_spares` | Fleet-wide equipment/job/spare templates |
| `fleet_vessel_mapping`, `fleet_component_mapping`, `fleet_job_vessel_mapping`, `fleet_spare_vessel_mapping` | Template→vessel assignment |

### Running hours
| Table | Purpose |
|---|---|
| `running_hours_audit` | Every RH update (source manual/cascade, `is_renewal_reset`) |
| `component_running_hours_log` | Periodic RH snapshots |

### Inventory (Spares & Stores)
| Table | Purpose |
|---|---|
| `spares` | Spare part definitions per vessel (`suuid`, part number, maker, min/rob) |
| `spares_history` | Legacy spares transaction history |
| `spare_component_links` | Which spares fit which components |
| `locations`, `spare_location_stock` | Physical storage locations, per-location stock |
| `inventory_transactions` | Immutable stock movement ledger (enum event types, WO reference) |
| `stores_items`, `stores_ledger` | Store item catalog + ROB ledger |

### Defects
| Table | Purpose |
|---|---|
| `defects` | Defect records (`duuid`, `component_id`, status, priority, CoC flag) |
| `defect_actions`, `defect_attachments` | Corrective actions, files |
| `recurring_defects`, `recurring_defect_links` | Recurrence detection groupings |
| `defect_sequences` | Per-vessel annual defect number counters |
| `defect_categories`, `defect_types` | Lookups |
| `defect_approval_settings` | Shore-side Defects routing singleton (`long_extension_days`, report toggle); singleton key is fixed to `default` and the threshold is constrained to 1–3650 |
| `defect_closure_history` | Immutable shore-written snapshots of C1 values returned during C2 verification; a database trigger rejects UPDATE and DELETE, so soft delete and retention/purge updates fail |

### Approval Engine

The seven `apprv_*` tables are intentionally declared outside `shared/schema.ts` in `server/modules/approval-engine/db/schema.ts`. They are engine-owned, tenant-local, shore-side tables intended as `NO_SYNC`; `shared/syncConfig.ts` does not currently contain registry entries for them.

| Table | Purpose |
|---|---|
| `apprv_workflows` | Versioned workflow headers selected by module/screen/action scope and classification |
| `apprv_workflow_nodes` | Workflow nodes, ordinals, labels, and quorum settings |
| `apprv_node_edges` | Directed edges between workflow nodes |
| `apprv_node_slots` | Stable role slots attached to approval-step nodes |
| `apprv_requests` | Runtime requests with workflow snapshot, subject, vessel, current node, and terminal state |
| `apprv_request_slots` | Runtime role-slot resolution and decision history |
| `apprv_scope_settings` | Per-scope enable/disable switches |
| `approval_notifications` | Shore-side per-user approval inbox and email-delivery status; intended `NO_SYNC` but absent from `shared/syncConfig.ts` |
| `company_approval_settings` | Tenant singleton holding the active approval-email toggle; registered `ONE_WAY_SHORE_TO_SHIP` |

The engine tables do not follow the shared six-column sync convention uniformly. Their lifecycle fields are specific to workflow configuration and runtime requests; module decision callbacks write approved outcomes through the owning module's normal tables instead of syncing engine rows.

### Compliance
| Table | Purpose |
|---|---|
| `ship_certificates_master`, `ship_certificates_labels_config` | Admin-defined certificate catalog + column labels |
| `vessel_certificate_applicability`, `vessel_certificate_data` | Which certs a vessel needs + live cert data |
| `ship_surveys_master`, `ship_surveys_labels_config`, `vessel_survey_applicability`, `vessel_survey_data` | Parallel structure for surveys |
| `certificates`, `surveys` | Operational cert/survey tables (used by Cert. & Surveys pages) |
| `ihm_items`, `ihm_maintenance_log` | Inventory of Hazardous Materials, linked to components/spares |

### Change requests (Modify PMS)
| Table | Purpose |
|---|---|
| `change_request` | CR header (category: components/jobs/spares/stores, status) |
| `change_request_approval`, `change_request_comment`, `change_request_attachment` | Approval chain, discussion, files |

### Alerts
| Table | Purpose |
|---|---|
| `alert_policies`, `alert_config` | Alert type definitions + thresholds |
| `alert_events` | Fired alerts (fire once-ever semantics) |
| `alert_deliveries`, `alert_acknowledgements` | Delivery + ack tracking |

### Forms engine
| Table | Purpose |
|---|---|
| `form_definitions`, `form_versions`, `form_version_usage` | Dynamic form schemas (DRAFT/PUBLISHED/ARCHIVED), usage tracking |

### Audit / import / retention
| Table | Purpose |
|---|---|
| `audit_log` | Business-level audit trail (actor, action, entity, old→new JSON) |
| `import_history`, `import_change_log`, `bulk_import_history`, `bulk_import_errors` | Bulk import audit |
| `retention_settings` | Purge policy config |
| `report_snapshots`, `report_favorites`, `monthly_snapshots` | Report caching/preferences |

### Sync infrastructure
| Table | Purpose |
|---|---|
| `sync_metadata` | Per-vessel sync checkpoint/status |
| `sync_field_log` | Column-level change log for BOTH_EDITABLE tables |
| `sync_batches`, `sync_conflicts`, `sync_file_queue`, `sync_settings` | Batch transmission, conflict records, attachment queue, config |

---

## 4. CROSS-MODULE DATA FLOWS & EXTERNAL INTEGRATIONS

### 4.1 Internal cross-module flows
- **Work Order completion → Running Hours**: `server/modules/work-orders/.../workOrderCompletionService.ts` — if the WO's component is RH-driven, the completion reading is routed through `updateMasterRH` (running-hours service), advancing counters and writing `running_hours_audit`.
- **Running Hours cascade**: `server/modules/running-hours/services/runningHoursService.ts` — a MASTER component's RH delta propagates to all INHERITED children (`POST /technical/api/running-hours/cascade`). `rhTimelineValidationService.ts` blocks backdated/impossible entries (>24h/day).
- **Work Order completion → Spares consumption**: WO completion can consume linked spares via the inventory service, writing `inventory_transactions` with WO reference.
- **Defects ↔ Components / Spares / Work Orders**: defects reference `component_id`; `LinkDefectsModal` / `LinkSparesModal` create many-to-many links between defects, WOs, spares, and components.
- **Modify PMS (Change Requests) → Components/Jobs/Spares/Stores**: `changeRequestsService.ts` classifies targets (Critical/Normal), pulls approval levels from `approval_workflow_config`, resolves target IDs to UUIDs, and applies approved changes to the target module's tables.
- **Defects → Approval Engine**: the generic Defects PATCH gate detects a newly requested B5 extension or a direct C2 verification attempt; a shore-side post-save hook detects newly completed C1 closeout, and the post-sync arrival sweep detects equivalent ship-originated records. Extensions use the repeat-extension scope after a prior approved extension, with fallback to the ordinary extension scope when no matching repeat workflow exists; C1 closeout and direct C2 attempts use the verification scope. Classification is Critical when the defect is CoC-related, its linked component is critical, or the requested extension exceeds `defect_approval_settings.long_extension_days`; otherwise it is Normal. The card resolves configured role slots at runtime with strict vessel scoping and applies terminal decisions through Defects repositories: extension approval/rejection updates the selected history entry (approval also advances target date and deferment), while verification approval stamps the defect and rejection preserves the returned C1 snapshot and reopens incomplete closeout.
- **Alert engine reads everything**: `pmsAlertEngine.ts` (driven by `server/services/maintenanceOrchestrator.ts`) evaluates work orders (critical overdue, skipped cycles), spares (low critical stock), certificates/surveys (expiry — reads LIVE vessel_certificate_data/vessel_survey_data), and defects (overdue, CoC). Alerts fire once-ever into `alert_events`.
- **Approval configuration split**: Modify PMS and WO postponement remain dual-wired: they create legacy steps from `approval_workflow_config` and can also submit to the Approval Engine. Defects uses the Approval Engine card/settings and does not consume its legacy Approval Workflow rows. Active engine workflows and enabled legacy levels must not govern the same Technical scope simultaneously.
- **Fleet templates → vessel data**: fleet_components/jobs/spares are mapped to vessels via the mapping tables; bulk import and provisioning generate vessel-level rows and auto-generate WOs from job templates.
- **Form engine → Work Orders**: WO execution forms are rendered from `form_versions.schema_json`; results are saved into `work_orders.form_data`.

### 4.2 External integrations

**A. Shipskart (Purchasing SSO)** — `server/modules/shipskart/services/shipskartSsoService.ts`
- `POST /technical/api/shipskart/sso/initiate` → backend calls Shipskart with payload `{ externalUserId, tenantId }`; returns an `iframeUrl` rendered by `PurchasingPage.tsx`.
- `POST /technical/api/shipskart/sso/logout` → terminates remote session.
- Auth: **HMAC-SHA256** — raw JSON body signed with `SHIPSKART_HMAC_SECRET`, sent as `X-Signature` header alongside `X-Api-Key`.
- Env vars: `SHIPSKART_SSO_BASE_URL`, `SHIPSKART_API_KEY`, `SHIPSKART_HMAC_SECRET`, `SHIPSKART_TENANT_ID`, per-role user mappings (`SHIPSKART_USER_ADMIN`, etc.). **All currently unset in this environment** → page shows an error state.

**B. Ship↔Shore sync** — `server/modules/sync/syncEngine.ts`, `shared/syncConfig.ts`
- Every table classified as `ONE_WAY_SHORE_TO_SHIP` (office master), `BOTH_EDITABLE` (field-level merge via `sync_field_log`), `SHIP_ONLY` (ship master), or `NO_SYNC`.
- Ship-initiated HTTP calls to the shore instance: `POST /sync/initiate` (returns `batchUuid`) → `POST /sync/push` (SHIP_ONLY rows + BOTH_EDITABLE field logs) → `POST /sync/pull` (shore changes since checkpoint) → `POST /sync/complete` (advance checkpoint).
- Auth: `SYNC_API_KEY` in `X-Api-Key` header. Env: `SYNC_INSTANCE_ID`, `SYNC_SHORE_URL`, `SYNC_API_KEY`.
- Conflicts recorded in `sync_conflicts`, resolved manually in Admin → Conflict Review. Attachments queue through `sync_file_queue`.
- **Warning (replit.md): sync layer is the highest-risk surface — do not modify `shared/syncConfig.ts`, `server/modules/sync/`, or the field logger without explicit instruction.**

**C. Object storage** — `server/objectStorage.ts`
- Replit Object Storage backed by GCS; signed URLs generated via the Replit sidecar (`http://127.0.0.1:1106`).
- Used for component/WO documents, defect attachments, bulk import templates. ACL in `objectAcl.ts`. Env: `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`.

**D. External identity (SAILERP header forwarding)** — in integrated deployments, user identity arrives via `x-user-*` headers; in dev, `mockAuthMiddleware` resolves identity from the `x-rank` header (defaults to "Chief Engineer"). See §5.1.

---

## 5. SHARED SERVICES

### 5.1 Authentication
- Session infrastructure: express-session + connect-pg-simple (PostgreSQL session store).
- **Dev mode is mock auth**: `server/middleware/auth.ts` → `mockAuthMiddleware` mounted on `/technical/api/*` (see `server/routes.ts` lines 43–46) resolves the user per-request from `x-rank` header/body. `AuthContext.tsx` manages frontend user state; it contains a TODO to transition to real session/token auth.
- Integrated mode: identity forwarded via `x-user-id`, `x-user-name`, etc., stashed in `req.user` for audit attribution.
- **New features**: mount routes under `/technical/api` (they inherit tenant + auth + request-context middleware automatically); use `requireAuth` / role guards for protection.

### 5.2 RBAC
- Roles: `Ship`, `Office`, `PMS Admin`, `Sail Admin` (pgEnum `user_role`).
- Server guards in `server/middleware/auth.ts`: `requireRole(roles)`, `requirePMSAdmin`, `requireVesselAccess` (Ship users limited to their `vessel_id`).
- Menu-level permissions: `admn_role_master` + `adm_menumaster_ac` + `adm_role_menu_access` tables, managed in Admin → Access Control (Sail Admin only), API in `server/modules/access-control/routes.ts`.
- Frontend: `PermissionsContext` (`hasPermission`, `canViewSidebarItem`); `TechnicalModule` blocks screens the role can't see; `ProtectedRoute` wraps standalone routes. Sail-Admin-only screens (access-control, audit-trail, retention-settings) are gated by `isSailAdmin` in `TechnicalModule.tsx`.
- **New features**: add a menu entry to `adm_menumaster_ac` (seed migration), guard server routes with `requireRole`, check `PermissionsContext` in the UI.

### 5.3 Audit trail
- Two mechanisms:
  1. **Business audit** (`audit_log`): high-level actions (WO completed, defect closed…) with actor, action, entity, old→new JSON. Viewed in Admin → Audit Trail via unified `server/modules/audit/service.ts` (also merges `running_hours_audit` and `work_order_postponements`).
  2. **Field logger** (`sync_field_log`): column-level change log required for sync on `BOTH_EDITABLE` tables — services call `logFieldChanges` (`server/modules/sync/fieldLogger.ts`) after DB writes.
- **New features**: write `audit_log` entries for business events; if the table is `BOTH_EDITABLE` in `syncConfig.ts`, call `logFieldChanges` after every write (repository layer).

### 5.4 Notifications / alerts
- `pmsAlertEngine.ts` runs periodically via `maintenanceOrchestrator.ts`; evaluators in `server/modules/alerts/evaluators/` (overdue jobs, low spares, certificates, surveys, defects). Results → `alert_events`, surfaced in the bell-icon alert center; acknowledge via `POST /alerts/events/:id/acknowledge`.
- Alerts fire **once-ever** per (policy, entity) — see memory note: adding a new alert type touches the evaluator, engine block, seed migration, and four frontend label maps.
- **New features**: add an evaluator file + register it in `pmsAlertEngine`, seed an `alert_policies` row via migration, update frontend label maps.

### 5.5 File/document storage
- `ObjectStorageService` (`server/objectStorage.ts`): `uploadBuffer` for programmatic writes, signed URLs for browser upload/download; multer (memory storage) handles multipart. Example implementation: `server/modules/work-orders/controllers/woDocumentController.ts`.
- **New features**: reuse `ObjectStorageService`; if using multer, re-enter tenant context afterward (`tenantMiddleware.reEnterTenantContext`).

### 5.6 Form engine
- `form_definitions` / `form_versions` (DRAFT → PUBLISHED → ARCHIVED) with JSON schemas; runtime lookup by name+module; usage tracked in `form_version_usage`. Logic in `server/modules/forms/services/formsService.ts`. WO execution forms are the main consumer.

### 5.7 Vessel context
- `VesselContext` provides the active `vesselId` app-wide (persisted in localStorage for admins). Nearly all queries are vessel-scoped — new features should accept `?vesselId=` and respect `requireVesselAccess`.

### 5.8 Approval Engine
- Mounted at `/technical/api/approval-engine` only on shore instances. The host registers the Technical and Defects approval cards and supplies tenant, actor, admin-write guard, repository provider, and notification event handler.
- Workflow selection key is module/screen/action scope plus card-returned classification. Workflows are versioned; each request stores a complete workflow snapshot, so later edits do not change an in-flight request.
- Implemented execution is a linear chain of 1–6 approval steps ending at one terminal node. A step may contain multiple role slots with `all`, `any`, or `nOfM` quorum. Conditional nodes, advanced mode, and parallel fork/join branches exist in types/schema but validation rejects them.
- Workflows store stable role IDs and display-label snapshots. User IDs are resolved when a step activates; Defects delegates to the shared role resolver with the subject vessel. The strict vessel-scope flag prevents unrelated vessel assignments from resolving.
- Request states are `pending`, `approved`, and `returned`; slot states are `pending`, `active`, `approved`, `rejected`, and `superseded`. Rejection finalizes a request as `returned`.
- A step whose active slots all resolve zero approvers can be decided only through the narrow host-marked admin override. The override is available to PMS Admin, Sail Admin, and Super Admin and is recorded distinctly; it does not apply when any active slot has a resolved approver.
- **Adding approvals to a new module**: create and register an approval card declaring scopes and classifications; keep module validation and safety checks before submission; classify the opaque subject and resolve role slots in the card; implement an idempotent `onDecision` callback that writes through module-owned tables. Integrate through the approvals host gateway/card boundary; do not modify `server/modules/approval-engine/**` for module-specific work or read/write `apprv_*` directly.

---

## 6. API ENDPOINTS (by module)

All module routers (including Shipskart) are mounted flat on **`/technical/api`** (`server/modules/index.ts`); a JSON 404 guard catches unmatched `/technical/api/*` paths. Paths below are relative to `/technical/api`.

**Components**
- `GET /components` — list (optional `?vesselId=`); `GET /components/:vesselId` — vessel picker list; `GET /components/details/:id` — single component
- `POST /components` / `PATCH /components/:id` / `POST /components/:id/inactivate` — CRUD + soft deactivate
- `POST /components/sort-order` — reorder tree; `POST /components/upload` — bulk upload
- `GET|POST /component-documents…` — document attachment; `GET /component-maintenance-history[/:componentId]` — history; `GET /equipment-categories`

**Jobs**
- `GET /jobs` (filters `?vesselId=&componentId=`), `GET /jobs/:id`, `GET /jobs/:id/context`
- `POST /jobs`, `PATCH /jobs/:id`, `POST /jobs/:id/inactivate`, `POST /jobs/:id/generate-wo`
- `GET /maintenance-planner`, `GET /maintenance-planner/export`

**Work Orders**
- `GET /work-orders`, `GET /work-orders/:id`, `GET /work-orders/:id/context`
- `POST /work-orders`, `PATCH /work-orders/:id`, `POST /work-orders/:id/complete`
- `POST /work-orders/:id/reviewer-approve` / `reviewer-reopen` — office L2 review
- `POST /work-orders/:id/postpone-request` / `postpone-approve` — postponement flow
- `POST /work-orders/generate-now` — generation sweep; `GET /work-orders/planner`, `PATCH /work-orders/planner/planned-date`

**Running Hours**
- `GET /running-hours/history|timeline|current|parents`
- `POST /running-hours` — manual entry; `POST /running-hours/cascade` — parent+children update
- `PUT /rh-config/:componentId` — counter config

**Spares / Inventory**
- `GET /spares/:vesselId`, `GET /spares/:vesselId/:id`, `POST /spares/:vesselId`, `PATCH /spares/:vesselId/:id`, `POST /spares/:vesselId/:id/adjust`
- `GET /inventory/stock/by-location/:locationId`, `POST /inventory/reconcile/:vesselId`

**Stores**
- `GET /stores/:vesselId`, `POST /stores/:vesselId/create`, `POST /stores/:vesselId/batch-consume|batch-receive`, `GET /stores/item/:id/history`

**Defects**
- `GET /defects` (filters), `GET /defects/coc`, `POST /defects`, `PATCH /defects/:id/close`
- `GET /recurring-defects`, `POST /recurring-defects/recalculate`
- `GET|PUT /defects/approval-settings` — Defects classification/report settings; `PMS Admin`, `Sail Admin`, or `Super Admin`
- `GET /defects/:id/approval-routing` — current scope/classification/workflow preview; loaded-defect vessel identity + `requireVesselAccess`
- `GET /defects/:id/approval-chain?action=extension|verification` — current approval history; loaded-defect vessel identity + `requireVesselAccess`
- `GET /defects/approval-diagnostics` — bounded workflow/approver/request diagnostics; `PMS Admin`, `Sail Admin`, or `Super Admin`
- `GET /defects/:id/closure-history` — immutable rejected C1 history; loaded-defect vessel identity + `requireVesselAccess`

**Approval Engine** (shore-only; under `/approval-engine`)
- `GET /registry`, `GET /roles`, `GET /workflows`, `GET /workflows/:wfuuid`, `GET /scopes/enabled` — configuration reads; no endpoint-specific role guard beyond the shared Technical middleware
- `POST /workflows`, `PUT /scopes/enabled` — configuration writes; `PMS Admin`, `Sail Admin`, or `Super Admin`
- `POST /requests` — submit; no endpoint-specific role guard (module safety gates submit through the in-process gateway)
- `POST /requests/:requuid/decide` — approve/reject; the engine permits only a resolved current approver or the narrow all-zero admin override
- `GET /requests/status`, `GET /pending` — subject history and current-user pending work; no endpoint-specific role guard

**Approval host gateway** (under `/approvals`)
- `GET /config`, `GET /email-config` — runtime vessel-scope/email flags; no endpoint-specific role guard
- `GET /role-approvers` — configured role-name resolution; `PMS Admin`, `Sail Admin`, or `Super Admin`
- `PUT /email-config` — tenant email toggle; `PMS Admin`, `Sail Admin`, or `Super Admin`
- `GET /notifications`, `GET /notifications/count`, `PATCH /notifications/:anuuid/read`, `POST /notifications/read-all` — current-user notification reads/updates; ownership is enforced by user UUID in each query

**Certificates & Surveys**
- `GET /certificates`, `PATCH /certificates/:id`; `GET /surveys`, `POST /surveys`
- `GET /admin/ship-certificates-master` (+ survey equivalents), `POST /admin/vessel-certificate-applicability/initialize`

**Alerts**
- `GET /alerts/events`, `POST /alerts/events/:id/acknowledge`, `GET /alerts/policies`, `POST /alerts/scan`

**Change Requests (Modify PMS)**
- `POST /change-requests`, `PUT /change-requests/:id/approve`, plus list/detail/comment/attachment endpoints

**Vessels / Fleet / Settings**
- `GET /vessels`, `GET /fleets`, `GET /pms-vessel-settings/:vesselId`, `PUT /company-standard-grace-settings`
- Fleet template CRUD under fleet routes (components/jobs/spares templates + vessel mappings)

**Admin**
- `GET /admin/available-ranks`, `GET /admin/vessel-org-chart/:id` — ranks & org chart
- `GET /admin/audit-trail` — audit log; `GET /admin/access-control/:roleRuid`, `GET /admin/menu-items` — RBAC
- `GET|PUT /admin/approval-workflow-config` — approval levels (defined directly in `server/routes.ts`)
- `GET /admin/local-approvers`, `GET /admin/approvers`, `GET /admin/external/master-data/:endpoint`

**Bulk import**
- `POST /bulk/import`, `POST /bulk/dry-run`

**Sync**
- `GET /sync/status`, `POST /sync/trigger`, `GET /sync/conflicts/review` (+ shore-side `POST /sync/initiate|push|pull|complete`)

**Reports / Dashboard**
- `GET /reports/maintenance-summary`, `POST /reports/overdue-jobs` (Excel), `GET /reports/spares-consumption-analysis/:vesselId`, `GET /dashboard/maintenance-trend`, and additional per-report endpoints in `server/modules/reports`

**Misc**
- `POST /chat` — AI chatbot; `GET /nr-reports`, `POST /nr-reports/submit` — noon reports
- `POST /shipskart/sso/initiate|logout` — Shipskart SSO handoff

---

## 7. CONVENTIONS

### Backend
- **Layering (mandatory)**: routes → controllers → services → repositories → storage. Routes only delegate; controllers parse/format; services own business logic; repositories own DB access. No raw `db.insert/update/delete` in services (bypasses UUID generation).
- No cross-module imports via internal paths — go through the other module's service layer.
- New module = folder under `server/modules/<name>/` with `routes.ts`, `controllers/`, `services/`, `repositories/`; register the router in `server/modules/index.ts`.
- Module-specific approval work integrates through cards and the approvals host gateway. Do not modify `server/modules/approval-engine/**` for module behavior and do not access `apprv_*` tables directly.
- Express route ordering: specific before generic; avoid colliding param shapes (`/things/:vesselId` vs `/things/:id` — use `/things/details/:id`).
- Zod validation on request bodies before hitting storage.

### Migrations (critical — full rules in replit.md)
- Schema change flow: edit `shared/schema.ts` → `npm run db:generate` → review SQL → server applies on startup. **Never `db:push`** on an existing DB. Never expect startup to generate migrations.
- DB defaults: use `.default(sql\`gen_random_uuid()::text\`)`, never `.$defaultFn()` (JS-only, breaks raw SQL inserts).
- Every new table needs: `{prefix}uuid`, `createdAt`, `updatedAt`, `createdByUuid`, `updatedByUuid`, `isDeleted`, `isSync`.
- Every new table also requires an explicit `shared/syncConfig.ts` registry entry in the appropriate category; having the six sync-readiness columns alone does not register it. The engine-owned `apprv_*` tables currently lack these entries despite their `NO_SYNC` design intent.
- Hand-written migrations must be idempotent (`IF NOT EXISTS`, `ON CONFLICT (name)`, `DO $$` guards); never hardcode PK ids; name-based FK lookups.

### Frontend
- All main screens render inside `TechnicalModule` (top bar + sidebar + content). Standalone full-screen forms register in `App.tsx` before the `/:subpage` catch-alls and wrap in `ProtectedRoute`.
- Every table uses shared `AgGridTable` / `AgGridTableActions` from `client/src/components/AgGrid/`. No checkbox columns, no floating filters, single header row by default.
- Data fetching: TanStack Query only; default fetcher from `lib/queryClient.ts`; mutations via `apiRequest` + explicit `queryClient.invalidateQueries` with array query keys (`['/api/x', id]`).
- Forms: shadcn `Form` + `useForm` + `zodResolver` with insert schemas from `@shared/schema`.
- Contexts for global state: `useVessel()` for active vessel, `useAuth()` for user/role, `PermissionsContext` for menu gating.
- `data-testid` attributes on interactive/informational elements (`{action}-{target}`, `{type}-{content}`).
- File naming: PascalCase pages/components, camelCase hooks/services. **Never create a file whose basename already exists elsewhere** (past incidents with duplicate `jobService.ts`, `WorkOrderForm*`).

### Package pins
- AG Grid family pinned exactly (enterprise/community/react 34.1.0, ag-charts 12.3.0) — license-capped, no `^`/`~`.

### Pre-commit
- `npx tsc --noEmit` must not exceed the 290-error baseline; re-run new migrations for idempotency; verify edited files are on the live code path.

---

## 8. KNOWN GAPS / TODO

**Stub / placeholder screens**
- `pages/RecurringDefects.tsx` (`/defects/recurring`) — "Coming Soon" only.
- `pages/defects/DefectsReports.tsx` — "Coming Soon"; hidden in sidebar.
- Noon Report: Fuel Dashboard, Alerts, Bunker Mgmt, Reports & Export, Fleet Overview are imported as `*Placeholder` components in `TechnicalModule.tsx`.
- Several report screens toast "Excel export coming soon" (MaintenanceReports, RunningHoursReports, StoresReports, SparesReports, ComplianceReports, AlertsApprovalsAdminReports).
- `DefectFormExact.tsx`: drydock work-item linking marked "Feature coming soon". `PostponeWorkOrderDialog.tsx`: Risk Assessment link "Coming soon".
- Unknown sidebar menu items fall through to a generic "content will be displayed here" panel in `TechnicalModule.tsx`.

**Dead code / legacy artifacts**
- `client/src/pages/_archived/` — unrouted legacy variants (DefectForm, ModifyPMS, Spares…).
- Duplicate service: `server/services/jobService.ts` (used by startup backfills in `routes.ts`) vs `server/modules/jobs/services/jobService.ts` (modular target).
- `test-data.json` references linger in migration validation/seed scripts although file-based storage was removed; `storageFactory.ts` enforces PostgreSQL-only.
- `pages/TestE2E.tsx` + `/test-e2e` route — dev-only harness.

**TODOs in code**
- `AuthContext.tsx` (~line 460): transition from mock/header auth to real session/token server auth.
- `bulk-upload validationService.ts` (~line 1163): component-existence check during import.
- `ShipsCertificatesAdmin.tsx` (lines ~209–217): replace hardcoded dropdown options with backend data.

**Environment / configuration gaps (this environment)**
- `VITE_AG_GRID_LICENSE_KEY` unset → AG Grid runs in trial mode with console warnings/watermark.
- `SHIPSKART_*` vars unset → Purchasing module shows error state.
- Sync env (`SYNC_SHORE_URL`, `SYNC_API_KEY`, `SYNC_INSTANCE_ID`) not configured → Sync Dashboard shows "Never synced".

**Approval Engine / Defects approval gaps**
- **Verified:** the seven `apprv_*` tables and `approval_notifications` have no entries in `shared/syncConfig.ts`, although their schema/migration comments describe them as `NO_SYNC` (`server/modules/approval-engine/db/schema.ts`, `server/modules/approvals/notificationSchema.ts`).
- **Verified:** `defect_approval_settings` and `defect_closure_history` have no `shared/syncConfig.ts` entries. The intended classifications are respectively `NO_SYNC` and insert-only `ONE_WAY_SHORE_TO_SHIP`; the latter must not be enabled until redelivery/upsert behavior is safe because its trigger rejects every UPDATE and DELETE (`migrations/0065_watery_micromacro.sql`, `migrations/0067_flashy_charles_xavier.sql`).
- **Verified:** `PUT /technical/api/approvals/email-config` writes `company_approval_settings` directly and does not call `logFieldChanges`, despite that table's `ONE_WAY_SHORE_TO_SHIP` registry classification (`server/modules/approvals/routes.ts`).
- **Unverified — historical/runtime fact, not determinable from repository code:** there is no evidence that `scripts/generate-approval-workflows-from-awc.ts` was run with `--apply` for every tenant. The script defaults to dry-run, and Modify PMS and WO postponement still create legacy levels before engine submission; enabling both mechanisms for one scope creates a dual-gating risk (`server/modules/approval-engine/INTEGRATION-GUIDE.md`).
- **Verified:** a role slot resolving zero users remains active with no timeout, escalation, or automatic reassignment. The only recovery in engine behavior is the narrow host-marked admin override, available only when every active slot resolves zero (`server/modules/approval-engine/core/engine.ts`, `server/modules/approvals/mount.ts`).
- **Verified:** the request model has no withdraw or cancel state or endpoint; terminal states are only `approved` and `returned` (`server/modules/approval-engine/core/types.ts`, `server/modules/approval-engine/http/router.ts`).
- **Verified:** strict vessel approver resolution depends on login-captured `master_user_vessels` assignments. A new assignment is unavailable until capture occurs, and a transferred-off assignment can remain resolvable until it is evicted (`server/modules/approvals/approvalCard.ts`).
- **Verified contract gap:** `engine.status()` currently receives rows ordered by descending `submitted_at` from the Drizzle repository, but neither the repository interface nor the core return contract declares that ordering guarantee. Consumers should not infer a stable public ordering contract from the current adapter implementation (`server/modules/approval-engine/core/engine.ts`, `server/modules/approval-engine/db/drizzleRepository.ts`).
- **Verified:** the Defect PDF payload and renderer include only the latest target-date extension and current C1/C2 values; they do not include extension history or `defect_closure_history`. `show_rejected_closures_on_report` is stored but has no report/PDF consumer (`client/src/lib/pdfReportGenerator.ts`, `client/src/pages/defects/DefectFormWizard.tsx`).
- **Verified:** `isDeferred` is interpreted inconsistently. The Defects list and shared dashboard status helper present deferred defects as Extended and suppress Overdue; server reports group raw status and can count an Open deferred defect as overdue; the alert evaluator does not receive `isDeferred` and alerts on any past-due non-Closed/non-Cancelled defect (`client/src/lib/defectStatusUtils.ts`, `server/modules/defects/services/defectsService.ts`, `server/modules/alerts/evaluators/defectEvaluators.ts`).
- **Verified:** `closure_files` stores caller-supplied strings without URL validation and closure history renders them directly as links. No retention/reference protection prevents a referenced object from being deleted (`shared/schema.ts`, `client/src/pages/defects/DefectFormWizard.tsx`).
- **Verified environment gap:** the approval SES variables are unset in this environment, so email delivery is unavailable while in-app notifications continue (`server/modules/approvals/sesEmailTransport.ts`).
- **Removed (25-Sep-2026):** the Replit-only test identity switcher (`server/modules/dev-test-users/`, RoleSwitcher / AuthContext impersonation) was removed from the repository before merge; it is kept locally only, never committed.

**Data / runtime issues observed**
- Component tree logs "Parent not found" warnings for orphan SFI codes (e.g. `554.001.x`, `652.001.12`).
- `AuditTrail.tsx` renders with a React duplicate-key warning.
- AG Grid warns about `data-replit-metadata` / `data-component-name` passed into gridOptions (dev-tooling props leaking into AG Grid config).

**Technical debt**
- Accepted tsc baseline of 290 errors (must not grow).
- `server/postgresStorage.ts` is a ~9.7k-line monolith implementing all of `IStorage`; module repositories wrap it rather than replacing it.
- Legacy JS migration array (entries 001–081) in `server/migrations.ts` is frozen; two SQL naming tracks (4-digit drizzle vs 3-digit hand-written) intentionally sort auto-generated files first.
