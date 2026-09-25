# Approval Engine Audit

Scope: read-only analysis of the newer Approval Engine, its Defects integrations, and its relationship to the older Approval Workflow configuration. No application code, schema, migration, package, or runtime data was changed.

`SYSTEM_OVERVIEW.md` is **NOT FOUND**. I searched the repository for both `SYSTEM_OVERVIEW.md` and `system_overview.md`; neither exists. Therefore the requested comparison against that file is necessarily a list of content that a future system overview would need to add, rather than a line-by-line critique of an existing document.

## 1. APPROVAL ENGINE — CODE LOCATION

### Server implementation

The newer engine is split between a self-contained generic engine and host/module adapters:

- Core orchestration: `server/modules/approval-engine/core/engine.ts:65-267`.
- Core contracts and DTOs: `server/modules/approval-engine/core/types.ts:1-176`.
- Repository interface: `server/modules/approval-engine/core/repository.ts`.
- Registry and card registration: `server/modules/approval-engine/core/registry.ts:1-82`.
- Workflow validation: `server/modules/approval-engine/core/validateWorkflow.ts:1-97`.
- Express HTTP adapter: `server/modules/approval-engine/http/router.ts:1-131`.
- Drizzle schema: `server/modules/approval-engine/db/schema.ts:1-92`.
- Drizzle repository: `server/modules/approval-engine/db/drizzleRepository.ts:1-244`.
- Embedded/standalone bootstrap: `server/modules/approval-engine/index.ts:1-88`.
- Host mount and shore-only gate: `server/modules/approvals/mount.ts:1-46`.
- Host tenant provider: `server/modules/approvals/tenantProvider.ts:1-45`.
- Host gateway used by Technical/Defects modules: `server/modules/approvals/engineGateway.ts:1-175`.
- Technical card for Modify PMS and work-order postponements: `server/modules/approvals/approvalCard.ts:1-185`.
- Defects card: `server/modules/defects/approvalCard.ts:1-121`.
- Notifications and email delivery: `server/modules/approvals/approvalNotifier.ts:1-175`, `server/modules/approvals/notificationSchema.ts:1-32`, and `server/modules/approvals/sesEmailTransport.ts`.
- Notification/email support API: `server/modules/approvals/routes.ts:1-115`.

The engine is mounted only on shore. The mount checks `isShipInstance()` and returns without mounting on ship instances (`server/modules/approvals/mount.ts:20-24`). On shore it registers the Technical and Defects cards and mounts the engine at `/technical/api/approval-engine` (`server/modules/approvals/mount.ts:29-46`).

### Client implementation

- Admin wrapper and AWS SES/email banner: `client/src/pages/admin/ApprovalEngineAdminPage.tsx:11-83`.
- Generic builder UI: `server/modules/approval-engine/client/ApprovalEngineAdmin.tsx:1-72`. This is unusual: client UI code is physically inside the server module and is imported by the client wrapper (`client/src/pages/admin/ApprovalEngineAdminPage.tsx:9,76-81`).
- Approval-chain status component: `client/src/components/approvals/ApprovalChainProgress.tsx:34-39`.
- Notification bell/inbox client: `client/src/components/NotificationBell.tsx`.
- Defect B5/C2 UI: `client/src/pages/defects/DefectFormWizard.tsx:1765-2061,2175-2255`.
- Modify PMS engine-aware UI: `client/src/components/modifyPms/ModifyPMS.tsx:177`.
- Work-order postponement engine-aware UI: `client/src/components/PostponeApprovalDialog.tsx:112`.

No Approval Engine React context was found. The client uses React Query/fetch directly in the admin wrapper and builder (`client/src/pages/admin/ApprovalEngineAdminPage.tsx:14-35,76-81`; `server/modules/approval-engine/client/ApprovalEngineAdmin.tsx:33-72`).

### Admin screen route

The application is a menu-state-driven Technical module rather than a dedicated URL router for this screen. The Admin side menu adds item id `approval-engine` with label “Approval Engine” only for shore-side approval administrators (`client/src/components/SideMenuBar.tsx:154-167`). `TechnicalModule` renders `ApprovalEngineAdminPage` when `selectedSubModule === "admin"` and `selectedMenuItem === "approval-engine"` (`client/src/pages/TechnicalModule.tsx:294-297`). The page points its API client to `/technical/api/approval-engine` (`client/src/pages/admin/ApprovalEngineAdminPage.tsx:76-81`).

### Layering assessment

**Mostly compliant, with two deliberate adapter exceptions.**

The generic core is cleanly separated: its contracts explicitly forbid imports outside `server/modules/approval-engine/**` and use plain DTOs (`server/modules/approval-engine/core/types.ts:1-7`). Express is confined to the HTTP adapter (`server/modules/approval-engine/http/router.ts:1-12`), and persistence is behind the repository abstraction/Drizzle adapter (`server/modules/approval-engine/db/schema.ts:1-5`; `server/modules/approval-engine/db/drizzleRepository.ts:1-17`).

The host adapters do not follow the repository/storage layering literally:

1. `server/modules/approvals/routes.ts` reads and writes `approval_notifications` and `company_approval_settings` directly through Drizzle (`server/modules/approvals/routes.ts:37-45,60-61,69-86,90-112`).
2. The Technical and Defects cards query module tables directly through Drizzle to classify subjects and resolve approvers (`server/modules/defects/approvalCard.ts:19-24,50-60`; `server/modules/approvals/approvalCard.ts:133-142`). These are adapter-owned queries rather than routes calling controllers/services/repositories.

The Defects decision callback does use the Defects repository for subject writes (`server/modules/defects/services/defectsApprovalHooks.ts:212-261`). The Technical callback deliberately calls the existing change-request/work-order services, preserving module-owned finalization (`server/modules/approvals/approvalCard.ts:145-174`).

## 2. APPROVAL ENGINE — DATA MODEL

### Engine-owned tables

Migration 170 declares the `apprv_*` tables engine-owned, per-tenant, and `NO_SYNC` (`migrations/170_approval_engine_tables.sql:1-5`). The engine schema repeats that they are deliberately outside `shared/schema.ts` and intended as `NO_SYNC` (`server/modules/approval-engine/db/schema.ts:1-5`).

| Table | Full columns | Purpose | Six sync columns |
|---|---|---|---|
| `apprv_workflows` | `id`, `wfuuid`, `module_id`, `screen_id`, `action_id`, `classification`, `mode`, `version`, `status`, `label`, `created_by`, `created_at`, `is_deleted` | Versioned workflow header/configuration. One active workflow per scope/classification is enforced by a partial unique index. | Partial only: `wfuuid`, `created_at`, `created_by`, `is_deleted`; missing `updated_at`, `updated_by_uuid`, `is_sync`. (`migrations/170_approval_engine_tables.sql:7-27`) |
| `apprv_workflow_nodes` | `id`, `workflow_wfuuid`, `node_key`, `type`, `ordinal`, `quorum_rule`, `quorum_n`, `label` | Workflow graph nodes/configuration. | None of the six conventional sync metadata columns. (`migrations/170_approval_engine_tables.sql:29-39`) |
| `apprv_node_edges` | `id`, `workflow_wfuuid`, `from_key`, `to_key` | Directed graph edges/configuration. | None. (`migrations/170_approval_engine_tables.sql:41-47`) |
| `apprv_node_slots` | `id`, `workflow_wfuuid`, `node_key`, `slot_ordinal`, `role_id`, `role_label` | Role slots attached to workflow steps/configuration. | None. (`migrations/170_approval_engine_tables.sql:49-57`) |
| `apprv_requests` | `id`, `requuid`, `module_id`, `screen_id`, `action_id`, `classification`, `subject_ref`, `vessel_id`, `snapshot_json`, `status`, `current_node_key`, `submitted_by`, `submitted_at`, `finalized_at`, `workflow_wfuuid`, `workflow_version` | Runtime approval request with immutable workflow snapshot and current state. | Has `requuid` and operational timestamps, but not the six-column sync set: no `created_at`, `updated_at`, `created_by_uuid`, `updated_by_uuid`, `is_deleted`, or `is_sync`. (`migrations/170_approval_engine_tables.sql:59-82`) |
| `apprv_request_slots` | `id`, `requuid`, `node_key`, `slot_ordinal`, `role_id`, `role_label`, `status`, `resolved_approver_ids_json`, `decided_by`, `decided_at`, `remarks` | Runtime per-step/per-role decision state. | None of the six conventional sync columns. (`migrations/170_approval_engine_tables.sql:84-98`) |
| `apprv_scope_settings` | `id`, `module_id`, `screen_id`, `action_id`, `enabled`, `updated_by`, `updated_at` | Configuration switch enabling/disabling an engine scope. | Only `updated_at`; it does not carry the six-column set. (`migrations/170_approval_engine_tables.sql:100-109`) |

**Configuration tables:** `apprv_workflows`, `apprv_workflow_nodes`, `apprv_node_edges`, `apprv_node_slots`, and `apprv_scope_settings` (`server/modules/approval-engine/db/schema.ts:8-49,84-92`).

**Runtime tables:** `apprv_requests` and `apprv_request_slots` (`server/modules/approval-engine/db/schema.ts:51-82`).

### Notification and email-setting tables

| Table | Full columns | Purpose | Six sync columns |
|---|---|---|---|
| `approval_notifications` | `id`, `anuuid`, `user_uuid`, `requuid`, `module_id`, `screen_id`, `action_id`, `subject_ref`, `vessel_id`, `kind`, `title`, `message`, `read_at`, `email_status`, `email_error`, `created_at` | Runtime per-user inbox and email-delivery status. It is declared shore-only/`NO_SYNC`. | Has `anuuid` and `created_at`; missing the rest of the required sync metadata set. (`migrations/171_approval_notifications.sql:1-24`; `server/modules/approvals/notificationSchema.ts:10-32`) |
| `company_approval_settings` | `id`, `singleton_key`, `superintendent_lock_enabled`, `updated_by`, `created_at`, `updated_at`, `is_deleted`, plus `approval_email_enabled` from migration 172 | Configuration singleton for the Approval Engine email toggle; the old superintendent-lock field is retired. | Partial legacy set only; it has timestamps and `is_deleted` but no conventional UUID, `created_by_uuid`, `updated_by_uuid`, or `is_sync`. (`migrations/137_company_approval_settings.sql:18-25`; `migrations/172_approval_email_toggle.sql:1-15`) |

### Exact sync classification

`shared/syncConfig.ts` defines:

- `ONE_WAY_SHORE_TO_SHIP`: “Shore is master. Ship receives overwrites. No conflict possible.”
- `BOTH_EDITABLE`: “Both sides can edit. Field-level merge with conflict detection via sync_field_log.”
- `SHIP_ONLY`: “Ship is master. Shore receives overwrites.”
- `NO_SYNC`: “Never synced. Instance-local only.”  
  (`shared/syncConfig.ts:4-8`)

The actual registry classifications relevant here are:

- `company_approval_settings`: `category: 'ONE_WAY_SHORE_TO_SHIP'`, `direction: 'shore_to_ship'`, global and non-configurable (`shared/syncConfig.ts:504-514`).
- Legacy `approval_workflow_config`: `category: 'ONE_WAY_SHORE_TO_SHIP'`, `direction: 'shore_to_ship'`, global and configurable (`shared/syncConfig.ts:621-631`).
- Legacy `moc_approvers`: `category: 'ONE_WAY_SHORE_TO_SHIP'`, `direction: 'shore_to_ship'`, global and configurable (`shared/syncConfig.ts:633-643`).

**Important gap:** `apprv_*` and `approval_notifications` are **NOT FOUND** in the `SYNC_CONFIG` registry. I searched `shared/syncConfig.ts` for `apprv_` and `approval_notifications`; there are no entries. Their migrations/schema comments call them `NO_SYNC`, but the central registry does not explicitly classify them (`migrations/170_approval_engine_tables.sql:1-5`; `migrations/171_approval_notifications.sql:1-4`; `server/modules/approval-engine/db/schema.ts:1-5`).

## 3. APPROVAL ENGINE — CAPABILITIES

### Multi-step approval

**YES.** The validator permits up to six approval steps (`server/modules/approval-engine/core/validateWorkflow.ts:14-18,58-60`). Submission snapshots the selected workflow and creates runtime slots for every approval-step node (`server/modules/approval-engine/core/engine.ts:94-120`). When a step reaches quorum, the engine follows the single outgoing edge and activates the next approval-step; it finalizes only when the next node is the terminal `end` node (`server/modules/approval-engine/core/engine.ts:204-228`).

Sequence is stored by node `ordinal` plus explicit edges in `apprv_workflow_nodes`/`apprv_node_edges` (`migrations/170_approval_engine_tables.sql:29-47`). Runtime position is stored in `apprv_requests.current_node_key` and slot statuses (`migrations/170_approval_engine_tables.sql:59-75,84-95`).

Within one step, multiple role slots and quorum rules `all`, `any`, and `nOfM` are supported (`server/modules/approval-engine/core/types.ts:21-37`; `server/modules/approval-engine/core/engine.ts:204-221`). This is multiple approvers within the same active step, not parallel branches.

### Parallel approval

**NO for parallel branches.** Types/schema accept `parallel-fork` and `parallel-join`, but the validator rejects both as “not yet supported”; it also requires every node to be on one linear chain (`server/modules/approval-engine/core/types.ts:18-23`; `server/modules/approval-engine/core/validateWorkflow.ts:50-55,62-87`).

### Conditional routing

**NO.** A `condition` node exists in the type/schema, but validation explicitly rejects it (`server/modules/approval-engine/core/types.ts:18-23`; `server/modules/approval-engine/core/validateWorkflow.ts:50-55`). The engine does classify each record before selecting a workflow—for Defects, CoC or linked-component criticality maps to `Critical Equipment / COC Related`, otherwise `Normal` (`server/modules/defects/approvalCard.ts:45-60`)—but that selects one active workflow by classification before request creation; it is not branching inside one workflow (`server/modules/approval-engine/core/engine.ts:81-102`).

### Approver identity types

Workflows store **role slots**, not named users: each slot has stable `role_id` and snapshot `role_label` (`server/modules/approval-engine/core/types.ts:25-38`; `migrations/170_approval_engine_tables.sql:49-57`). Named user UUIDs are resolved when a node activates and saved in `resolved_approver_ids_json` (`server/modules/approval-engine/core/engine.ts:123-146`; `migrations/170_approval_engine_tables.sql:84-95`).

The normal role resolver uses application roles and vessel scope; the Defects card delegates to the shared resolver (`server/modules/defects/approvalCard.ts:14-17,92-94`). Technical additionally supports pseudo-roles `moc:Level 1` and `moc:Level 2`, whose named users come from active Technical rows in `moc_approvers`; other roles use the normal role/vessel resolver (`server/modules/approvals/approvalCard.ts:133-142`). Therefore the model is role-driven, with named users resolved at runtime from role/user/vessel data and, for migrated legacy pool steps, `moc_approvers`.

### Rejection

**YES.** The decide body accepts `approve` or `reject` and optional remarks (`server/modules/approval-engine/http/router.ts:62,119-122`). Rejecting a slot marks it `rejected`, supersedes other non-terminal slots, and finalizes the request as `returned` (`server/modules/approval-engine/core/engine.ts:191-201`). Terminal request states are `approved` and `returned`; the non-terminal state is `pending` (`server/modules/approval-engine/core/types.ts:62-64`).

The rejection reason is captured in `apprv_request_slots.remarks` and included in the returned event/callback (`migrations/170_approval_engine_tables.sql:84-95`; `server/modules/approval-engine/core/engine.ts:231-248`).

What happens to the underlying record is card-specific:

- Defect extension rejection marks the selected extension JSON entry `Rejected`; approval marks it `Approved`, advances the target date, and sets `isDeferred` (`server/modules/defects/services/defectsApprovalHooks.ts:212-238`).
- Defect verification rejection leaves `verified` false and writes no defect rejection field; the reason exists only in engine notification/history (`server/modules/defects/services/defectsApprovalHooks.ts:241-248`).
- Technical callbacks invoke the existing change-request or work-order approve/reject services (`server/modules/approvals/approvalCard.ts:145-174`).

### Delegation, escalation, timeout, auto-approval

**NO.** No fields or behavior for delegation, escalation, timeout/expiry, or auto-approval exist in the request/slot DTOs, engine schema, or router (`server/modules/approval-engine/core/types.ts:62-137`; `server/modules/approval-engine/db/schema.ts:51-92`; `server/modules/approval-engine/http/router.ts:86-129`). A step resolving zero approvers only emits a warning and can stall (`server/modules/approval-engine/core/engine.ts:123-139`). A narrowly scoped admin override exists only when every active slot resolved zero approvers; it is not delegation, escalation, or automatic approval (`server/modules/approvals/mount.ts:35-40`; `server/modules/approval-engine/core/engine.ts:164-185`).

### Scope

Rules are not only company-wide. A workflow scope is `{moduleId, screenId, actionId}` and every engine operation also receives a tenant id (`server/modules/approval-engine/core/types.ts:9-16,107-115`). Requests optionally carry `vesselId` (`server/modules/approval-engine/core/types.ts:66-78`). Approver resolution can use the subject vessel (`server/modules/defects/approvalCard.ts:63-65,92-94`; `server/modules/approvals/approvalCard.ts:133-142`).

However, workflow definitions themselves do not have fleet-id or vessel-id columns; they vary by tenant, module/screen/action, and classification, not by fleet or vessel (`migrations/170_approval_engine_tables.sql:7-20`). Therefore configuration is **tenant/company scope with classification-specific paths**, while approver membership can be vessel-scoped at runtime. Per-fleet or per-vessel workflow definitions are **NOT FOUND** in the engine schema.

## 4. APPROVAL ENGINE — API

All embedded endpoints below sit under `/technical/api/approval-engine` (`server/modules/approvals/mount.ts:29-46`). Before the engine mount, all `/technical/api` requests pass tenant, mock-auth, and request-context middleware (`server/routes.ts:44-46,56-57`). The table reports explicit endpoint-level `requireRole`/`requireVesselAccess`; “none” means the router itself applies neither of those guards.

| Method/path | Purpose | Type | Explicit route guard |
|---|---|---|---|
| `GET /technical/api/approval-engine/registry` | Module/screen/action registry tree | Configuration read | None (`server/modules/approval-engine/http/router.ts:88`) |
| `GET /technical/api/approval-engine/roles` | Roles available for a scope | Configuration read | None (`server/modules/approval-engine/http/router.ts:90-92`) |
| `GET /technical/api/approval-engine/workflows` | List workflows, optionally by scope | Configuration read | None (`server/modules/approval-engine/http/router.ts:94-97`) |
| `GET /technical/api/approval-engine/workflows/:wfuuid` | Get one workflow version | Configuration read | None (`server/modules/approval-engine/http/router.ts:98-100`) |
| `POST /technical/api/approval-engine/workflows` | Save a new active workflow version | Configuration write | Host-injected `requireRole(['Sail Admin','Super Admin','PMS Admin'])` (`server/modules/approval-engine/http/router.ts:101-104`; `server/modules/approvals/mount.ts:15-18,26-29,42`) |
| `GET /technical/api/approval-engine/scopes/enabled` | Read scope enablement | Configuration read | None (`server/modules/approval-engine/http/router.ts:106-108`) |
| `PUT /technical/api/approval-engine/scopes/enabled` | Enable/disable scope | Configuration write | Same host-injected admin `requireRole` (`server/modules/approval-engine/http/router.ts:109-113`; `server/modules/approvals/mount.ts:26-29,42`) |
| `POST /technical/api/approval-engine/requests` | Submit a runtime approval request | Runtime | None (`server/modules/approval-engine/http/router.ts:115-118`) |
| `POST /technical/api/approval-engine/requests/:requuid/decide` | Approve/reject active slot | Runtime | None at route level; engine checks resolved approver/admin override (`server/modules/approval-engine/http/router.ts:119-122`; `server/modules/approval-engine/core/engine.ts:164-201`) |
| `GET /technical/api/approval-engine/requests/status` | Get request/slot history for subject/scope | Runtime read | None (`server/modules/approval-engine/http/router.ts:123-126`) |
| `GET /technical/api/approval-engine/pending` | Pending items for current user id | Runtime read | None (`server/modules/approval-engine/http/router.ts:127-129`) |

No engine endpoint applies `requireVesselAccess`; vessel restrictions are enforced during module-specific approver resolution rather than by the engine router (`server/modules/defects/approvalCard.ts:14-17,92-94`).

The standalone engine additionally exposes `GET /health`; this is not mounted by the host application (`server/modules/approval-engine/index.ts:70-84`).

Related host notification/settings endpoints are mounted under `/technical/api`:

| Method/path | Purpose | Type | Explicit route guard |
|---|---|---|---|
| `GET /technical/api/approvals/config` | Client runtime approval flags | Runtime/config read | None (`server/modules/approvals/routes.ts:29-34`) |
| `GET /technical/api/approvals/notifications` | Current user’s latest notification rows | Runtime read | None; query filters to authenticated user UUID (`server/modules/approvals/routes.ts:36-45`) |
| `GET /technical/api/approvals/role-approvers` | Resolve names for configured role | Configuration read | `requireRole(['PMS Admin','Sail Admin','Super Admin'])` (`server/modules/approvals/routes.ts:48-54`) |
| `GET /technical/api/approvals/email-config` | SES status and per-tenant email toggle | Configuration read | None (`server/modules/approvals/routes.ts:56-62`) |
| `PUT /technical/api/approvals/email-config` | Change email toggle | Configuration write | `requireRole(['PMS Admin','Sail Admin','Super Admin'])` (`server/modules/approvals/routes.ts:64-87`) |
| `GET /technical/api/approvals/notifications/count` | Unread count for current user | Runtime read | None; filters by current user (`server/modules/approvals/routes.ts:89-95`) |
| `PATCH /technical/api/approvals/notifications/:anuuid/read` | Mark current user’s row read | Runtime write | None; ownership is enforced in the update predicate (`server/modules/approvals/routes.ts:97-104`) |
| `POST /technical/api/approvals/notifications/read-all` | Mark current user’s rows read | Runtime write | None; filters by current user (`server/modules/approvals/routes.ts:106-112`) |

## 5. HOW DEFECTS CURRENTLY USE IT

### Defect Target Date Extension (B5)

**Client UI.** Part B5 is rendered in `DefectFormWizard`. It displays the existing target date, captures new date/reason, and renders “Submit for Approval to” as a selectable office user (`client/src/pages/defects/DefectFormWizard.tsx:1765-1881`). The selected value is manually chosen by the user; save logic copies that user’s id/name into the extension entry (`client/src/pages/defects/DefectFormWizard.tsx:2012-2019`). It is **not derived from the Approval Engine**.

**Endpoint.** B5 submits through the generic form save, `PATCH /technical/api/defects/:id` (`client/src/pages/defects/DefectFormWizard.tsx:492-509,1964-2061`). The Defects route/controller/service chain reaches `gateDefectUpdate` before repository persistence (`server/modules/defects/routes.ts:60-67`; `server/modules/defects/controllers/defectsController.ts:174-176`; `server/modules/defects/services/defectsService.ts:49-70`).

**Persistence.** Extension records are stored inline in `defects.target_date_extensions` JSON, including Requested/Approved/Rejected state and approval metadata (`shared/schema.ts:1709-1723`). Runtime workflow/decisions are additionally stored in `apprv_requests`/`apprv_request_slots` when an active workflow exists (`migrations/170_approval_engine_tables.sql:59-98`).

**Runtime consultation.** The server gate submits new `Requested` entries to engine scope `defects-extension`, routes decisions through the engine, prevents ship-side decisions, and downgrades a client self-approval to `Requested` when a configured chain is active (`server/modules/defects/services/defectsApprovalHooks.ts:120-195`). The card classifies the defect as critical/CoC or normal and resolves configured role slots (`server/modules/defects/approvalCard.ts:27-32,45-60,69-94`).

**Hardcoded/fallback behavior.** The UI’s selected B5 office user is independent of the engine’s configured role/vessel resolver; no code connects that selected user to engine slot resolution (`client/src/pages/defects/DefectFormWizard.tsx:1864-1880,2012-2019`; `server/modules/defects/approvalCard.ts:92-94`). If the engine is absent, disabled, errors, or returns `NO_WORKFLOW`, the gate intentionally preserves legacy behavior, including direct/self approval (`server/modules/defects/services/defectsApprovalHooks.ts:9-15,110-111,181-182`). Thus B5 is configuration-driven only when an active engine workflow exists; otherwise it is explicitly legacy fallback.

**Decision application.** Approval updates the JSON entry, moves `targetCloseDate` to the new date, and sets `isDeferred`; rejection updates the entry to Rejected (`server/modules/defects/services/defectsApprovalHooks.ts:212-238`).

### Defect Verification (C2)

**Client UI.** C2 renders `verified`, `dateVerified`, `verifiedByName`, and `verifiedByOfficePosition`; both identity inputs are disabled (`client/src/pages/defects/DefectFormWizard.tsx:2185-2238`). Checking Verified auto-fills date, current user full name, and current user crew designation/role for permitted personas (`client/src/pages/defects/DefectFormWizard.tsx:619-650`). Therefore the initial values are derived from the logged-in client user, **not selected by the user and not derived from the engine**.

**Endpoint.** C2 uses the same generic `PATCH /technical/api/defects/:id` via `saveDefect` (`client/src/pages/defects/DefectFormWizard.tsx:492-509,2241-2255`). Client validation requires closeout completion before C2 and requires all C2 fields once started (`client/src/pages/defects/DefectFormWizard.tsx:451-489`).

**Persistence.** The defect stores `verified`, `date_verified`, `verified_by_name`, and `verified_by_office_position` as ordinary defect columns (`shared/schema.ts:1682-1686`). When a workflow exists, runtime request/slot state also lives in `apprv_requests`/`apprv_request_slots` (`migrations/170_approval_engine_tables.sql:59-98`).

**Runtime consultation.** A change to `verified=true` is gated through engine scope `defects-verification`; unauthorized one-click attempts are refused/stripped while pending. Verification is also submitted after shore C1 completion and by the shore arrival sweep (`server/modules/defects/services/defectsApprovalHooks.ts:82-118,200-207,264-298`).

**Decision application.** Approval writes `verified=true`, date, and the deciding user’s resolved identity (`server/modules/defects/services/defectsApprovalHooks.ts:241-261`). The card resolves the decider from `masterUsers` by UUID, with fallbacks (`server/modules/defects/approvalCard.ts:113-118`). This can overwrite the initial client auto-fill. Rejection leaves the defect unverified and does not write a defect rejection field (`server/modules/defects/services/defectsApprovalHooks.ts:241-248`).

### Defect lifecycle status versus approval state

These are separate concepts. `defects.status` contains lifecycle values such as Open, Pending, In-Progress, Awaiting Parts, Deferred, Closed, and Cancelled (`shared/schema.ts:1574-1578`). B5 approval state is embedded in each `targetDateExtensions` JSON entry (`shared/schema.ts:1709-1723`). C2 has a boolean plus date/identity fields (`shared/schema.ts:1682-1686`). Engine request state is separately stored in `apprv_requests.status` (`migrations/170_approval_engine_tables.sql:59-75`).

No defect-level `approval_status` column was found in `shared/schema.ts`. “Reported,” “Overdue,” and “Closed” are lifecycle/reporting concepts, while Verified is the C2 boolean; none is the Approval Engine request status. The B5/C2 decision code does not generally transition `defects.status`; B5 approval changes target date/deferred fields and C2 approval changes verification fields (`server/modules/defects/services/defectsApprovalHooks.ts:212-261`).

## 6. RELATIONSHIP BETWEEN (A) AND (B)

### Is `approval_workflow_config` still live?

**YES.** The old screen’s GET endpoint calls `storage.getApprovalWorkflowConfig()`, and its guarded shore-only PUT calls `storage.upsertApprovalWorkflowConfig()` (`server/routes.ts:359-400`). The old UI still defines PMS change-request, WO postponement/re-postponement, Defects extension, and Defects verification rows (`client/src/pages/admin/ApprovalWorkflow.tsx:52-130`).

Modify PMS still reads old level settings and creates legacy steps before offering the request to the engine (`server/modules/change-requests/services/changeRequestsService.ts:310-353`). Work-order postponement similarly creates Level 1/2 rows before the engine hook (`server/modules/work-orders/services/workOrderService.ts:3040-3080`).

The old Defects Closure rows are explicitly stale/unread: the UI comments say closure was removed and nothing consumes those rows (`client/src/pages/admin/ApprovalWorkflow.tsx:105-108`).

### Same tables or different tables?

They use **different tables**:

- Old screen/config: `approval_workflow_config` and approver pool `moc_approvers` (`migrations/126_approval_workflow_config.sql:6-47`; `migrations/128_approval_workflow_moc_approvers.sql`; `shared/syncConfig.ts:621-643`).
- New engine configuration/runtime: `apprv_workflows`, `apprv_workflow_nodes`, `apprv_node_edges`, `apprv_node_slots`, `apprv_requests`, `apprv_request_slots`, and `apprv_scope_settings` (`migrations/170_approval_engine_tables.sql:7-109`).

### Migration or bridge?

There is a bridge script, but it is explicitly **not a database migration**. `scripts/generate-approval-workflows-from-awc.ts` reads old AWC Level 1/2 rows, builds linear engine workflows with `moc:Level 1`/`moc:Level 2` pool roles, defaults to dry-run, and leaves AWC untouched (`scripts/generate-approval-workflows-from-awc.ts:1-17,28-30,42-48,110-115`).

The required cutover is XOR: active engine workflow or enabled old levels, not both, because both would double-gate (`server/modules/approval-engine/INTEGRATION-GUIDE.md:113-119`). Current submit paths warn if both are active (`server/modules/change-requests/services/changeRequestsService.ts:340-353`; `server/modules/work-orders/services/workOrderService.ts:3072-3080`).

Evidence that the generator was actually run with `--apply` for every tenant is **NOT FOUND**. The repository only proves the tool exists and defaults to dry-run (`scripts/generate-approval-workflows-from-awc.ts:8-13,28-30,110-115`).

### Which mechanism do live flows use?

**Modify PMS:** dual-wired. It creates the legacy `change_request_approval` steps/snapshot, then calls `maybeEngineSubmit`; engine absence/no workflow/disabled/error preserves the legacy path (`server/modules/change-requests/services/changeRequestsService.ts:314-353`; `server/modules/approvals/engineGateway.ts:51-75`). Approval attempts engine-first and falls back to the legacy repository decision when no pending engine request exists (`server/modules/change-requests/services/changeRequestsService.ts:421-446`; `server/modules/approvals/engineGateway.ts:107-136`).

**Work Order postponement:** dual-wired. It creates `wo_postponement_approvals` Level 1/2 rows and then calls `maybeEngineSubmit('pms-wo-postponement', ...)` (`server/modules/work-orders/services/workOrderService.ts:3040-3080`).

**WO re-postponement:** dual-wired through `pms-wo-re-postponement` after bespoke record creation (`server/modules/work-orders/services/workOrderService.ts:3510-3533`).

The shore arrival sweep submits synced ship-created CR/WO/Defect subjects to the engine when they arrive, because ship instances do not mount the engine (`server/modules/approvals/engineGateway.ts:139-175`; `server/modules/approvals/mount.ts:20-24`).

## 7. THE THIRD PATTERN QUESTION

### `change_request_approval`

It has **not been replaced** by the Approval Engine. It remains a bespoke approval chain with immutable `approval_workflow_snapshot` on the change request and Level 1/2 rows in `change_request_approval` (`migrations/127_change_request_approval.sql:7-31`; `server/modules/change-requests/services/changeRequestsService.ts:314-337`).

It is now dual-wired: `changeRequestsService.ts` creates legacy rows first and then offers the request to the engine; engine failure/no workflow leaves the legacy behavior intact (`server/modules/change-requests/services/changeRequestsService.ts:322-353`). Finalization remains in `server/modules/change-requests/services/changeRequestsService.ts`, invoked by the Technical approval card (`server/modules/approvals/approvalCard.ts:145-160`).

### `wo_postponement_approvals`

It also has **not been replaced**. `server/modules/work-orders/services/workOrderService.ts` still creates the bespoke Level 1/2 rows, snapshots old workflow settings, and owns approve/reject/final status transitions (`server/modules/work-orders/services/workOrderService.ts:3040-3070`; `server/modules/approvals/approvalCard.ts:161-173`).

It is dual-wired for both base postponement and re-postponement through engine gateway hooks (`server/modules/work-orders/services/workOrderService.ts:3072-3080,3527-3533`). The Technical card’s decision callback returns to the existing `approvePostponement`, `rejectPostponement`, `approveRePostponement`, or `rejectRePostponement` service methods (`server/modules/approvals/approvalCard.ts:161-173`).

Therefore these are not three fully consolidated approval mechanisms. They are two bespoke module chains plus a generic engine that can sit in front of them during migration, with deliberate fallback to legacy logic (`server/modules/approval-engine/INTEGRATION-GUIDE.md:53-60,113-119`).

## 8. GAPS AND RISKS

### Unfinished, stubbed, or non-functional

1. **Conditional and parallel graph nodes are schema/type placeholders only.** The validator rejects `condition`, `parallel-fork`, `parallel-join`, and advanced behavior (`server/modules/approval-engine/core/types.ts:18-23`; `server/modules/approval-engine/core/validateWorkflow.ts:50-55,62-87`).
2. **Zero-approver steps can stall indefinitely.** The engine warns but has no timeout/escalation; only an admin zero-approver override exists (`server/modules/approval-engine/core/engine.ts:123-139,164-185`).
3. **No delegation, escalation, timeout, expiry, or auto-approval model/API exists** (`server/modules/approval-engine/core/types.ts:62-137`; `server/modules/approval-engine/db/schema.ts:51-92`; `server/modules/approval-engine/http/router.ts:86-129`).
4. **Cutover is not proven complete.** The converter is dry-run by default and no repository evidence proves `--apply` was executed per tenant (`scripts/generate-approval-workflows-from-awc.ts:8-13,28-30,110-115`).
5. **Dual-gating remains possible.** CR/WO code still creates old approval steps before engine submission and only warns if both configurations are active (`server/modules/change-requests/services/changeRequestsService.ts:322-353`; `server/modules/work-orders/services/workOrderService.ts:3054-3080`).
6. **Legacy Defects Closure config is orphaned.** The old UI says nothing consumes it (`client/src/pages/admin/ApprovalWorkflow.tsx:105-108`).
7. **B5 selected approver is disconnected from engine routing.** The user chooses an office user, but engine slots resolve independently by role/vessel (`client/src/pages/defects/DefectFormWizard.tsx:1864-1880,2012-2019`; `server/modules/defects/approvalCard.ts:92-94`).
8. **Fallback can bypass approval.** Defects preserves direct legacy writes/self-approval when no active engine workflow exists or the engine fails (`server/modules/defects/services/defectsApprovalHooks.ts:9-15,110-111,181-182`).
9. **C2 rejection is not represented on the defect.** The defect remains unverified and only engine history/notifications carry the rejection reason (`server/modules/defects/services/defectsApprovalHooks.ts:241-248`).
10. **Engine tables are not explicitly in the central sync registry.** Migrations label them `NO_SYNC`, but `shared/syncConfig.ts` has no `apprv_*` or `approval_notifications` entries (`migrations/170_approval_engine_tables.sql:1-5`; `migrations/171_approval_notifications.sql:1-4`; `shared/syncConfig.ts:4-8`).
11. **The email-toggle write bypasses the sync field logger.** `company_approval_settings` is classified `ONE_WAY_SHORE_TO_SHIP`, but its PUT route performs direct Drizzle update/insert and does not call `logFieldChanges` (`shared/syncConfig.ts:504-514`; `server/modules/approvals/routes.ts:64-86`). This is the specific sync-classified Approval Engine-adjacent write found without field logging.
12. **The generic engine/notification writes also do not call `logFieldChanges`,** but their tables are intended `NO_SYNC`, so that is consistent with migration intent; the risk is the missing explicit registry classification (`server/modules/approval-engine/db/drizzleRepository.ts:79-105,140-157,184-206`; `server/modules/approvals/notificationSchema.ts:1-5`).
13. **Runtime submit/decide/status endpoints have no `requireRole` or `requireVesselAccess` middleware.** They rely on upstream Technical middleware plus engine/card authorization. This is intentional for subject modules but broadens the importance of card-level checks (`server/routes.ts:44-46,56-57`; `server/modules/approval-engine/http/router.ts:115-129`; `server/modules/approval-engine/core/engine.ts:164-201`).

### Missing from `SYSTEM_OVERVIEW.md`

`SYSTEM_OVERVIEW.md` itself is **NOT FOUND**, so all Approval Engine documentation is missing from that named document. A replacement/created overview would need to document at least:

- Shore-only mount and API base (`server/modules/approvals/mount.ts:20-46`).
- Generic engine architecture, import boundary, cards, and module-owned callbacks (`server/modules/approval-engine/core/types.ts:1-7,163-176`).
- The seven `apprv_*` tables and their intended `NO_SYNC` status (`migrations/170_approval_engine_tables.sql:1-109`).
- Notification/email tables and SES toggle (`migrations/171_approval_notifications.sql:1-24`; `migrations/172_approval_email_toggle.sql:1-15`).
- Linear multi-step/quorum support and explicit lack of conditional/parallel support (`server/modules/approval-engine/core/validateWorkflow.ts:31-87`).
- Classification-based workflow selection (`server/modules/approval-engine/core/engine.ts:81-102`).
- Technical and Defects cards/scopes (`server/modules/approvals/mount.ts:29-30`; `server/modules/defects/approvalCard.ts:27-32,69-94`).
- The separate legacy AWC tables and shore-to-ship classification (`shared/syncConfig.ts:619-643`).
- The generator/cutover XOR rule and continuing legacy fallback (`scripts/generate-approval-workflows-from-awc.ts:1-17`; `server/modules/approval-engine/INTEGRATION-GUIDE.md:113-119`).
- Dual-wired CR, postponement, re-postponement, and Defects flows (`server/modules/change-requests/services/changeRequestsService.ts:322-353`; `server/modules/work-orders/services/workOrderService.ts:3054-3080,3527-3533`; `server/modules/defects/services/defectsApprovalHooks.ts:82-207`).
- Sync-registry and field-logging risks identified above (`shared/syncConfig.ts:504-514`; `server/modules/approvals/routes.ts:64-86`).

## OPEN QUESTIONS FOR THE HUMAN

1. Was `SYSTEM_OVERVIEW.md` intentionally omitted from this branch, renamed, or expected to be supplied separately? It is not present anywhere in the repository.
2. Has `scripts/generate-approval-workflows-from-awc.ts --apply` been run for every active tenant, and were the corresponding old AWC levels disabled in the same support action? Repository code cannot establish this runtime fact.
3. Should the B5 “Submit for Approval to” selected user remain informational, be removed, or constrain the engine-resolved approver? Current code persists it but does not use it for routing.
4. Should C2 rejection be persisted on the defect/module audit trail in addition to engine request history and notifications?
5. Should `apprv_*` and `approval_notifications` receive explicit `NO_SYNC` entries in `shared/syncConfig.ts`, or is absence from the registry the intended representation for engine-local tables?
6. Should the `company_approval_settings.approval_email_enabled` update call `logFieldChanges`, given the table’s explicit `ONE_WAY_SHORE_TO_SHIP` classification?
7. Is the deliberate legacy fallback acceptable for Defect B5/C2 when an engine workflow is absent/disabled/errors, or should those operations fail closed once a tenant adopts the engine?