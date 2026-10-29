# PMS Components — Section H: Classification & Regulatory Data
## Corrected functional, backend, database and synchronization plan

**Review date:** 29 October 2026

**Status:** Proposed specification awaiting validation; documentation only.

**Area:** PMS → Components → H. Classification & Regulatory Data

**Branch reviewed:** `feature/replit-work`

**Companion:** `docs/PMS_SECTION_H_FINAL_FUNCTIONAL_DATABASE_SYNC_SUMMARY.md` (14 October 2026; retained unchanged).

> This document describes existing code and proposed future work. No application code, schema, migration, seed, sync setting or database data is changed by this documentation task. No production/vessel rollout or implementation is authorized. Business choices are labelled **Proposed — needs confirmation**, including recommendations supplied during review.

## Contents

1. Release boundary and verified findings
2. Existing table, columns and consumers
3. Authorization and forwarded vessel scope
4. Functional behavior and API responsibilities
5. Masters and validation
6. Proposed schema changes and named migrations
7. Synchronization, field logs and reconciliation
8. Audit and lifecycle
9. Delivery phases
10. Acceptance and regression checks
11. Open decisions
12. Differences from the 14 October summary and stop condition

## 1. Release boundary and verified findings

### 1.1 Objective

Complete the existing regulatory register, rather than create a parallel table/API or add eight fields to `components`.

- Display all active entries for a component, including separate certificates sharing society/type.
- Save/Cancel each entry through the existing class-regulatory resource, independently of Component Save.
- Enforce office-only writes against genuine forwarded identity and verified scope.
- Use shared masters, derive Class Code, preserve stored dates, and return friendly errors.
- Add stable per-entry sync identity, soft deletion/restoration and lifecycle audit.
- Preserve existing columns, component relationships and report contracts.
- Defer entry attachments/file sync, child-entry Modify PMS and survey urgency colours to a separately approved product Phase 2.

### 1.2 Eleven requested current-state findings

Source locations are review-time references. These findings do not assert that production or all vessel installations have matching schema, data or versions.

| # | Finding | Source |
|---|---|---|
| 1 | `component_class_regulatory` exists with 25 columns, integer identity PK and FK to `components.cuuid`; exact columns/nullability are in Section 2. | `shared/schema.ts:2313–2358`; timestamp helper: `shared/schemaHelpers.ts:18–22` |
| 2 | GET uses `requireAuth`; POST, PUT and DELETE name `requirePMSAdmin`. That alias is non-enforcing. The mock role/null vessel make this a live authorization gap, not effective PMS-admin protection. | `server/modules/components/routes.ts:63–68`; `server/middleware/auth.ts:128–142,231–267` |
| 3 | Storage listing/detail do not exclude `is_deleted`. Delete executes physical SQL DELETE. | `server/postgresStorage.ts:2418–2452` |
| 4 | Create/update controllers return raw Zod `error.errors` as response details. | `server/modules/components/controllers/subEntityController.ts:64–99` |
| 5 | The regulatory service→repository→storage mutation path contains no `audit_log` call. A component audit pattern exists separately but is best-effort. | `server/modules/components/services/subEntityService.ts:24–62`; `server/modules/components/repositories/componentRepository.ts:154–174`; `server/postgresStorage.ts:2431–2452`; `server/modules/components/services/componentService.ts:220–240` |
| 6 | Table is ONE_WAY_SHORE_TO_SHIP, identityColumn null, vesselScopeColumn `vessel_code`. Receiver key is component_id + survey_type + classification_society, with id fallback when needed. Physical deletes have no incremental tombstone. | `shared/syncConfig.ts:605–618`; `server/modules/sync/oneWayApplier.ts:352–408`; `server/modules/sync/service.ts:1571–1652` |
| 7 | Main details view takes `classRegData[0]`. H is currently conditional on Class Item. | `client/src/pages/pms/Components.tsx:2509–2603,3862–3874` |
| 8 | Full-page form holds eight H values separately. Save checks component rights, builds a component-only payload, sends POST/PATCH components, then reports success/refetches/navigates. It never submits that H state to class-regulatory endpoints. | `client/src/components/ComponentRegisterAddEdit.tsx:209–219,888–1056,2084–2172` |
| 9 | Class Items Master List expands entries and already skips deleted rows. Another form uses incompatible aliases. See Section 2.2. | `server/modules/reports/services/equipmentReportService.ts:1404–1529`; `client/src/components/AddEditComponentForm.tsx:407–411,1816–1835` |
| 10 | Modify PMS targets are component, job, work_order, spare and store; there is no regulatory child-entry target. Component classItem change support does not cover H children. | `shared/changeRequestFields.ts:15–40,145`; `server/modules/change-requests/services/changeRequestsService.ts:8–40` |
| 11 | ComponentDateInput already supplies DD-MM-YYYY presentation; componentDateChangeValue preserves an unchanged original representation. Strict calendar/order/server validation is additional work. | `client/src/components/pms/ComponentDateInput.tsx:25–69`; `client/src/lib/componentDatePresentation.ts:1–24` |

### 1.3 Corrections to earlier descriptions

- The superseded implementation plan already recognized the existing table, multiple entries and missing H persistence. It was not wholly a new-table/single-entry plan. Actual conflicts included dedicated master tables, no extra stable entry identity, authorization assumptions, initial-release attachments/colours and omitted restoration.
- DELETE does name the legacy guard; the issue is that the guard is pass-through, not absent.
- The Class Items report already skips deleted regulatory rows. Preserve that defense.
- The supplied 19-society/46-survey dataset is proposed seed content, not confirmed installed data.
- Earlier read-only development inspection confirmed the 25-column table. Matching master-type searches returned classItem/classRelated, two active values each, not the proposed society/survey datasets. This is development-only evidence, not production/vessel inventory.
- `master_lists.updated_at` is defined by existing audit migrations even though absent from its inspected ORM declaration; this is a source/schema alignment issue, not proof that the column is absent in live databases. See Section 5.

## 2. Existing table, columns and consumers

### 2.1 Current `component_class_regulatory`

| Existing SQL column | Nullability / purpose |
|---|---|
| `id` | NOT NULL; INTEGER PRIMARY KEY, GENERATED BY DEFAULT AS IDENTITY |
| `component_id` | NOT NULL; TEXT FK → components.cuuid |
| `component_code` | NOT NULL; TEXT |
| `vessel_code` | NOT NULL; TEXT |
| `classification_society` | NOT NULL; TEXT |
| `survey_type` | NOT NULL; TEXT |
| `certificate_number` | Nullable; TEXT |
| `issue_date` | Nullable; legacy TEXT date |
| `expiry_date` | Nullable; legacy TEXT date |
| `last_class_survey` | Nullable; TEXT date |
| `next_survey_due` | Nullable; TEXT date |
| `class_requirements` | Nullable; TEXT |
| `class_code` | Nullable; TEXT |
| `information` | Nullable; TEXT |
| `survey_status` | NOT NULL; TEXT, default Active |
| `remarks` | Nullable; TEXT |
| `created_by` | NOT NULL; TEXT |
| `created_at` | NOT NULL; TIMESTAMP, default now |
| `updated_by` | Nullable; TEXT |
| `updated_at` | NOT NULL; TIMESTAMP, default now and ORM update helper |
| `is_sync` | Nullable; BOOLEAN, default false |
| `created_by_uuid` | Nullable; TEXT |
| `updated_by_uuid` | Nullable; TEXT |
| `is_deleted` | Nullable; BOOLEAN, default false |
| `sort_order` | Nullable; INTEGER |

There are 10 required and 15 nullable columns. Default false does not make a boolean NOT NULL. Society/type NOT NULL does not reject empty strings. Ownership, identity and audit columns are server-managed technical requirements, not additional mandatory user-entered business fields.

Keep all existing columns, indexes and the component UUID relationship. No certificate-number or component/society/type uniqueness constraint is proposed.

### 2.2 Consumer contracts and aliases

| Consumer | Existing contract / issue | Proposed treatment |
|---|---|---|
| Main Components H view | First row; reads some fallback aliases | Show all active rows with explicit canonical mapping |
| ComponentRegisterAddEdit | certificateNo/nextClassSurvey local state; component-only Save | Per-entry endpoint calls, map to certificateNumber/nextSurveyDue |
| AddEditComponentForm preview | certificateNo/lastSurveyDate/nextDueDate/status aliases | Map to certificateNumber/lastClassSurvey/nextSurveyDue/surveyStatus; retain multi-row preview |
| Class Items service and export | classificationSociety, certificateNumber, surveyType, lastClassSurvey, nextSurveyDue, classRequirements | Preserve current field names and columns |
| Class Items screen | `client/src/pages/reports/ClassItemsMasterList.tsx` consumes report contract | Regression-check against service and available Excel/PDF representations |
| Component imports/exports and fleet paths | No new H entry import/inheritance contract established | Do not silently add eight component columns or create child entries from fleet data |
| Certificates & Surveys module | Separate records/ownership | No automatic cross-module creation or authoritative-data replacement |

The Class Items report currently selects Class Item components, emits one row per active regulatory entry, and emits a component-only placeholder when no active entry exists. It sorts using nextSurveyDue and excludes `cr.isDeleted === true` (`equipmentReportService.ts:1422–1460,1512–1529`). Class Code/Information are not grounds to silently add export columns.

**Proposed — needs confirmation:** H remains visible for Class Item No, but report population remains unchanged. UI visibility does not silently expand Class Items reporting.

## 3. Authorization and forwarded vessel scope

### 3.1 Live issue

**Section H POST/PUT/DELETE are currently open to any authenticated caller without effective role authorization.**

`requirePMSAdmin` is pass-through (`server/middleware/auth.ts:128–142`). The current middleware sets `req.user.role = "Sail Admin"` and `req.user.vesselId = null` (`:237–267`). Accordingly, `role === 'Ship'` checks in `subEntityService.ts:24–58` never run on that request path. Its ship-scope helper constrains only an explicitly supplied Ship identity (`server/modules/components/services/shipVesselAccess.ts:1–15`). `deleteClassRegulatory(id)` has no caller context at all (`subEntityService.ts:61–62`).

Validation/database rejection does not close this authorization gap. This documentation task does not fix it.

### 3.2 Phase 1 fix: Section H only

Use enforcing `requireRole([...])` / `requirePermission(...)` evaluated against `req.rbac`, plus a Section H-specific source, Office, approved-admin and vessel-scope policy.

**Do not change the global `requirePMSAdmin` alias.** It sits on approximately 65 other routes with different access needs. Do not alter the other legacy aliases or unrelated sub-entity permissions.

Important helper behavior:

- `requireRole` uses forwarded RBAC vocabulary, but can accept a matching mock identity (`auth.ts:44–87`).
- `requirePermission` passes through unless `enforce: true`; unconfigured roles can pass unless `unconfigured: "deny"`; Sail Admin/PMS Admin bypass permission lookup (`server/middleware/permissions.ts:94–141`).
- Therefore, first refuse non-forwarded identities and enforce Office/admin policy, then apply the approved permission contract. Do not use Office alone as an allowed-role shortcut.
- A source label is not authentication. Verify the trusted forwarding boundary and prevent spoofed headers before treating forwarded identity as authoritative.

**Proposed — needs confirmation:** release-one writes are for approved office PMS Admin identities only; vessel users are read-only. Exact forwarded role names, Sail Admin treatment, permission resource/actions and office cross-vessel entitlements remain explicit approval decisions.

### 3.3 Failure matrix

| Context | Section H write result |
|---|---|
| No authenticated request user | 401, no mutation |
| RBAC absent / source none | 403, no mock fallback |
| PMS_AUTH_MOCK_RBAC enabled → source mock | 403, even for mock Sail Admin/Office |
| Forwarded Ship type, regardless of privileged-sounding role name | 403 |
| Forwarded Office but role not approved | 403 |
| Forwarded approved Office admin, required rights and valid scope | Permit the authorized operation |
| Missing/unauthorized vessel scope | Refuse; normally 403 |
| Permission infrastructure failure | Safe failure response; no mutation, never fail open |

Source/Office policy must precede helper bypasses. This does not change the mock environment setting: standalone mock sessions intentionally cannot write Section H.

### 3.4 Vessel scope and parent checks

`req.rbac` contains role/userType/source only (`auth.ts:22–33`), not a vessel assignment. The null mock vessel cannot authorize anything.

Resolve effective scope from the authenticated forwarded canonical user identity and authoritative assignments/integration context. Reuse a verified resolver or add one local to this resource. The exact resolver is an open decision, not an existing capability asserted by this plan.

- Request parameters, body vessel fields and selected-vessel UI state identify a target; they are not proof of entitlement.
- Resolve code/UUID vessel representations deliberately.
- Ship GET reads must use real forwarded scope; do not retain the unreachable mock Ship branch as the security boundary. Missing scope must not become unrestricted access.
- POST loads the component, checks access and derives component/vessel ownership server-side.
- PUT loads entry and parent, checks scope and rejects component/vessel reassignment.
- DELETE and restore both load the entry and parent, verify stored ownership and scope, then mutate. Removed records do not bypass scope checks.
- Pass verified actor/scope into services rather than only an id or the legacy mock role.
- Show removed, individual reads and report entry reads must respect applicable parent/scope policy.

## 4. Functional behavior and API responsibilities

### 4.1 Multiple entries and visibility

Display all active rows for the saved component. Two records with the same society/type and different certificates remain separate through viewing, editing and sync. No inferred natural uniqueness or arbitrary maximum count.

**Proposed — needs confirmation:** keep H visible for Class Item No with a “Class Item: No” notice. Never auto-delete or hide saved entries. This changes current hide-when-No behavior.

Provide loading, empty, failure/retry and read-only states. Component/vessel switches must not display cached rows from the previous selection.

**Proposed — needs confirmation:** stable sort_order then entry-identity order; warn before navigation discards unsaved entry drafts.

### 4.2 Independent Save/Cancel

Reuse the existing resource:

| Operation | Existing/proposed route |
|---|---|
| List active entries | Existing GET `/component-class-regulatory/:componentId` |
| Create entry | Existing POST `/component-class-regulatory` |
| Edit selected entry | Existing PUT `/component-class-regulatory/:id` |
| Soft-delete entry | Existing DELETE `/component-class-regulatory/:id`, changed semantics |
| Restore | Proposed POST `/component-class-regulatory/:id/restore` within the same resource |
| Show removed | Proposed explicitly authorized option on the existing list resource |

Routes are relative to the existing router mount. Final restore/removed-list contract must avoid ambiguity with current routes; no parallel API.

1. Save a new component before creating H entries.
2. Each entry has Save/Cancel; Component Save persists the component only.
3. Server loads ownership, validates, writes and returns the saved entry.
4. Show success only after that mutation actually succeeds.
5. Retain draft input and friendly field messages on failure.
6. Cancel discards that entry's draft, not other entries.
7. Prevent duplicate submissions and handle repeated delete/restore safely.
8. If several operations are attempted, report partial outcomes honestly; no “all saved” after any failed part.
9. Refresh the entry list after success without silently discarding other drafts.

### 4.3 UI/API mapping

| UI field | API property | Existing SQL column |
|---|---|---|
| Classification Society | classificationSociety | classification_society |
| Certificate No. | certificateNumber | certificate_number |
| Last Class Survey | lastClassSurvey | last_class_survey |
| Next Class Survey | nextSurveyDue | next_survey_due |
| Survey Type | surveyType | survey_type |
| Class Requirements | classRequirements | class_requirements |
| Class Code | classCode | class_code |
| Information | information | information |

Whitelist client-editable fields. Do not accept arbitrary generated-schema properties for UUID, ownership, deletion or audit fields. Derive Class Code and snapshots on the server. Reject attempts to move an entry.

## 5. Masters and validation

### 5.1 Shared master representation

**Proposed — needs confirmation:** reuse `master_lists` with types `classificationSociety` and `surveyType`, registered in existing `master_list_types`. Do not add separate society, survey or Class Code tables or a redundant column_type.

| Shared field | Society | Survey |
|---|---|---|
| list_type | classificationSociety | surveyType |
| list_key | Class Code | Survey Code |
| list_value | Society name | Survey name |
| Proposed country | Country | Normally null |
| Proposed category | Normally null | Class/Statutory/etc. |
| Proposed description | Normally null | Supplied survey description |

Use existing unique `(list_type, list_key)`; do not require unique display names. Distinguish repeated survey names by category/code.

**Proposed — needs confirmation:** adopt the 19 societies/46 survey types in the companion's Sections 4.3/4.4 (`:287–360`), exactly one canonical RINA / RINA / Italy. Preserve supplied survey descriptions. This is the seed authority, not the obsolete 20-row duplicate-RINA list.

Admin management reuses the existing Master Lists framework and its permission policy. **Proposed — needs confirmation:** group these under a Classification and Regulatory label within Components initially. A new top-level master section requires explicit validator/navigation changes and is not assumed approved.

- Select only active/non-deleted masters for new/changed references.
- Verify expected list_type, not just row existence.
- Preserve historical snapshots and retired references.
- Define retirement of referenced masters; do not change global master hard-delete behavior as an incidental H fix.
- Do not reset inactive/deleted state or overwrite authorized changes when reseeding.
- Do not assume local master integer ids match across installations.

### 5.2 Reference design requiring confirmation

**Proposed — needs confirmation:** if persistent stable references are needed alongside existing text snapshots, add nullable `classification_society_key` and `survey_type_key` TEXT to component_class_regulatory. New writes resolve those keys under their fixed list types; retain existing society/type/code text as compatible snapshots.

These two columns are conditional, not part of the three required identity/deletion additions. Do not add local integer FKs alone or infer a survey from its repeated display name. If local FKs are later chosen, require receiver-local resolution by stable type/key. Finalize the key/FK contract before writing migration 186; no silent schema extension.

### 5.3 Master watermark alignment

`shared/schema.ts:2056–2120` declares master values/types; the values ORM omits updated_at. Existing migrations already add `master_lists.updated_at` (`server/migrations.ts:1540–1546`; `migrations/107_reapply_audit_columns_for_ship.sql:340–346`).

Future implementation must verify actual shore/vessel schema, align ORM/service updates and ensure create/edit/retire changes advance this watermark. Do not claim the live column is missing merely because the ORM omits it. If absent on a target, migration 186 can explicitly add `updated_at TIMESTAMP` using the existing default convention; do not reset saved timestamps. Record actual prerequisite results and ensure existing-row delivery is covered.

### 5.4 Business validation and dates

**Proposed — needs confirmation:**

- Society/type are mandatory valid controlled selections. No other mandatory user-entered business fields.
- Trim leading/trailing spaces.
- Certificate No. maximum 100 characters.
- Class Requirements and Information maximum 2,000 characters each.
- No certificate-number uniqueness rule.
- Validate actual calendar dates on client and server.
- Compare only when both dates exist: Last Class Survey ≤ Next Class Survey; equality allowed.
- Missing dates stay missing; do not populate today or derive new dates.

Use ComponentDateInput and componentDateChangeValue. DD-MM-YYYY is presentation/entry only. Preserve exact untouched legacy strings/timestamps; no backend date migration, export-format extension or calculation changes. Intentionally changed dates use the existing supported API representation, not formatted UI text as an arbitrary new storage convention.

**Proposed — needs confirmation:** keep invalid legacy values visible and flagged, never silently normalize them; determine whether unrelated edits may retain such pre-existing values. New/changed invalid dates always fail.

Return safe field-error mappings such as “Select a classification society” or “Next Class Survey cannot be before Last Class Survey.” Do not expose raw Zod structures, database internals or stacks; retain technical diagnostics server-side. The UI keeps input on failure.

### 5.5 Hidden legacy fields

**Proposed — needs confirmation:** hide but retain issue_date, expiry_date, survey_status and remarks in the first release. Preserve values during partial updates and sync; retain survey_status defaults/constraints. Do not merge remarks into Information or drop fields.

## 6. Proposed schema changes and named migrations

### 6.1 Table-change inventory

**New application tables: zero in release one.** Reuse component_class_regulatory, master_lists, master_list_types, audit_log and existing migration/sync infrastructure.

| Table | Proposed structural change |
|---|---|
| component_class_regulatory | ccruuid TEXT; deleted_by_uuid TEXT NULL; deleted_at TIMESTAMP NULL |
| Same, conditional | classification_society_key TEXT NULL; survey_type_key TEXT NULL after reference-design approval |
| master_lists | country/category/description TEXT NULL if approved; align migration-defined updated_at and add only if actually absent |
| master_list_types | Seed two records; no new registry table or structural extension assumed |
| audit_log | Existing table; lifecycle events, no schema change currently established |
| sync_field_log / sync_field_log_failures | Existing tables; applicable contracts reviewed, no schema change or new H logging transport assumed |
| schema_migrations | Existing tracking; use established runner |

Keep regulatory integer id for API/local compatibility. ccruuid starts nullable during reconciliation; later becomes unique/NOT NULL with the approved future-insert default. Generate once, preserve everywhere. Existing is_deleted is reused; normal filtering treats null as not deleted.

### 6.2 Exact proposed file names and locations

These are **future files, not created by this task**. At review the root sequence ends at 184. Recheck before implementation; if concurrent work occupies a number, allocate the next free sequence and update the task/document to exact final names before creating files.

| Proposed file | Contents | Activation gate |
|---|---|---|
| `migrations/185_component_class_regulatory_identity_lifecycle.sql` | Add nullable ccruuid, deleted_by_uuid, deleted_at; preserve local PK/FK/audit fields; supporting indexes only where evidenced | Schema-first on shore and receiving vessels |
| `migrations/186_section_h_master_metadata.sql` | Approved nullable country/category/description; conditional key references after confirmation; align or add master updated_at only where required | Approved reference design and compatible receiver schema |
| `migrations/187_section_h_master_seed.sql` | Register types, seed 19/46 values by stable keys, one RINA; preserve authorized edits and retirement state | Approved dataset, metadata schema and master-first delivery |
| `migrations/188_component_class_regulatory_identity_finalize.sql` | Preflight reconciled UUID completeness/uniqueness including removed rows; enforce unique/NOT NULL and approved future-insert default | Separate later release after shore/vessel identity mapping is complete |

No SQL files are created or executed in this documentation deliverable.

### 6.3 File-based idempotency contract

All future migrations must be **file-based, idempotent, additive and non-destructive**, following `migrations/README.md`.

- ADD COLUMN IF NOT EXISTS; CREATE INDEX IF NOT EXISTS.
- Catalog-guarded constraints scoped to the right table/schema, not constraint name alone.
- Conflict-safe seed insertion on existing type keys and `(list_type,list_key)`.
- Re-executing SQL directly against compatible applied schema/data must be safe; migration tracking alone is insufficient.
- Preserve UUIDs, user-edited masters, creation metadata and business values on rerun.
- Use established migration transactions/locking and tracking; do not duplicate execution through an unrelated runner.
- Do not edit old migrations, use destructive db:push, DROP/TRUNCATE/reset, delete duplicates automatically or convert all dates.
- Do not randomly backfill shore and vessel UUIDs independently.

The runner discovers root migrations/*.sql at startup (`server/migrations.ts:3350–3435`). It will not pause between 185 and 188 for manual reconciliation. Do not ship 188 in the first release; deliver later or specify a separately approved gated rollout.

### 6.4 Reconciliation utility, retry and rollback

Historical identity mapping is a controlled, repeatable operation using a reviewed authoritative map, not an unconditional per-installation UPDATE generating random UUIDs.

Its exact utility/input-artifact paths remain an implementation prerequisite to choose after inventory; no permanent mapping table or automatic backfill file is approved. Record chosen paths and procedure before executing. Never commit production data or sensitive mapping exports into Git.

Test first application, second direct replay, already-applied boot, partial rollout/retry, seed replay preserving edits, and refusal to finalize null/duplicate/unresolved UUIDs.

Rollback normally retains additive columns/data and tracking records. Do not re-enable unsafe natural-key matching after UUID activation without coordinated receiver/sender rollback planning. A failed finalization must report the cause; it must not delete records to make constraints pass.

## 7. Synchronization, field logs and reconciliation

### 7.1 Existing one-way limitations

Natural-key matching can collapse separate same-society/type certificates; editing either key field can create another receiving row. Local integer fallback is not cross-installation identity.

Physical DELETE leaves no extant row for updated_at extraction. The receiver's deleted-row branch currently sets deletion state/time rather than applying all incoming deletion-actor/time fields (`oneWayApplier.ts:40–55,373–440`).

### 7.2 Proposed transport contract

- Retain ONE_WAY_SHORE_TO_SHIP and vessel_code scope.
- Set identityColumn to ccruuid and use UUID matching, not the mutable composite or integer fallback for upgraded entries.
- Preserve identity on create/update/provision/retry/delete/restore.
- Every future mutation advances updated_at, including raw SQL/import/bulk paths if added.
- Soft-delete and restore carry explicit state, deletion actor/time, updater and originating metadata.
- Restore clears deletion fields explicitly on the same row; no reinsertion.
- Preserve omitted legacy fields on supported partial updates; distinguish absent from intentional null.
- Deliver masters before dependent entries; resolve by stable type/key.
- Preserve code/UUID scope handling already present in `provisioningService.ts:965–973`.
- Maintain precise watermarks/checkpoints and replay safety; do not replace origin with receiver-local actor/time.

### 7.3 Field logs: current applicability versus proposed work

`requiresFieldLogging` enables only BOTH_EDITABLE (`shared/syncConfig.ts:1818–1821`). `logFieldChanges` accepts an optional transaction connection but returns zero for other categories (`server/modules/sync/fieldLogger.ts:182–214`).

Consequently, adding a logger call for current Section H would **not emit field logs**. Section H and the two master tables are one-way; their transport is row extraction, not bidirectional merge logs. audit_log lifecycle history is distinct from sync_field_log transport.

The following matrix is a required implementation checklist:

| Future write path | Required sync/audit coverage | Field-log applicability |
|---|---|---|
| H create/edit | UUID, trusted actors, updated_at, full changed business values, lifecycle audit | Current one-way table: no logs from existing guarded logger |
| H soft-delete/restore | Same UUID, timestamp, deletion marker/actor/time, explicit null clearing, audit | One-way delivery; do not assume a fake logger call covers it |
| Master create/edit/retire | Stable type/key, verified watermark updates and origin; parent-first delivery | One-way, not BOTH_EDITABLE |
| Any genuinely affected BOTH_EDITABLE record | All approved changed business/lifecycle fields, canonical row UUID, correct vessel UUID, trusted user/instance | Existing field logger required; no such new child workflow is implicitly introduced |
| Import/bulk/script/raw SQL | Inventory each actual path; same ownership, watermark or applicable logging contract | Per table category; no implicit H import feature |
| Sync receiver/replay | Preserve origin and identity, avoid echo/duplicate local logs | No fabricated local user edits |
| Historical UUID reconciliation | Controlled map, initial snapshot/replay/checkpoint plan | Do not manufacture independent user-edit backlogs; no logs does not mean no delivery needed |

**Proposed — needs confirmation:** if actual Section H sync_field_log rows are additionally required, approve explicit one-way logging support and its consumer, retention, failure and transaction contract. Do not globally relax the logger, queue undeliverable logs, change category to BOTH_EDITABLE or enable vessel writes merely to obtain logs. Until approved, promise only the existing one-way transport plus required lifecycle audit.

Where logs apply, a transaction connection rethrows failures so the caller can roll back; standalone logging can leave the business row committed and persist a failure in sync_field_log_failures. Do not call standalone post-commit logging atomic. Specify/test transaction or recovery handling before asserting guaranteed delivery.

### 7.4 Coordinated historical rollout

1. Inventory versions, schemas, UUID/code scope mappings and regulatory rows on shore/vessels, including removed rows.
2. Establish authoritative matching. Natural keys can suggest candidates but must not merge separate certificates; manually resolve ambiguity.
3. Apply additive schemas before new payloads; allow temporary null UUID only during controlled transition.
4. Assign one canonical UUID per logical entry and distribute the same mapping to counterparts. Preserve unmatched valid rows for review.
5. Verify all mapped identities, then apply the separate finalization migration.
6. Coordinate sender/receiver/provisioning contracts and capabilities. Gate writes and delivery until required columns/identity handling exist.
7. Deliver masters, reconcile snapshots/checkpoints and test repeated initial/incremental delivery.
8. Enable guarded writes only after scope, validation, audit and compatibility requirements pass.

Mixed-version receivers must not silently fall back to the unsafe key. Pause affected delivery or refuse activation with a clear upgrade requirement. Schema presence on development alone does not establish vessel readiness.

## 8. Audit and lifecycle

Use trusted actor context and existing component audit conventions, recording entry UUID, component UUID, vessel, action, old/new changes and time.

| Action | Required future lifecycle |
|---|---|
| Create | Set creation/update actors and times; active state; deletion metadata null |
| Edit | Preserve identity/creation metadata; update actor/time; record changes |
| Remove | Set is_deleted, deleted_by_uuid/deleted_at; advance updater/time; retain row |
| Restore | Preserve UUID/local id; reactivate same row; advance updater/time; audit restoration |
| Sync apply | Preserve origin; do not attribute the change to receiver mock/system user |

**Proposed — needs confirmation:** deletion metadata describes current removed state and is cleared on restore; historical removal remains in audit. List removed/restore is authorized and scoped. Normal reads/details/reports exclude removed rows; no physical DELETE.

Existing component logging is best-effort (`componentService.ts:220–240`). **Proposed — needs confirmation:** commit required lifecycle audit atomically with mutation; audit failure must not yield unaudited success. Define transaction boundaries before implementation. Do not enable writes before audit hooks are ready, even though delivery Phase 4 groups broader audit/regression work.

## 9. Delivery phases

These are future implementation phases, not work performed by this documentation task. Each includes migration and sync/field-log impact.

### Phase 1 — Local authorization, schema, UUID and soft deletion

**Files:** components routes/controller/subEntityService/componentRepository; scoped policy module if needed; `server/postgresStorage.ts`; `shared/schema.ts`; `shared/syncConfig.ts`; sync oneWayApplier/service/provisioningService. Read/reuse auth/permission helpers without changing global aliases.

**Migrations:** proposed 185, then controlled reconciliation, then separate later-release 188, as named in Section 6.

**Work:** genuine forwarded Office/admin policy, deny none/mock, authoritative scope, entry/parent checks for all mutations including restore, schema/UUID identity, normal deleted filtering and lifecycle metadata. Include minimal audit protection before activation.

**Sync/field logs:** one-way UUID transition, tombstone/restore delivery and origin preservation; no implied BOTH_EDITABLE logs or direction change.

**Tests:** permission matrix and spoofed/missing scope; cross-vessel ids; duplicate natural-key entries; society/type edit; migration replay; provisioning/retries; deletion/restore metadata.

**Completion gate:** role/scope policy approved, schema/identity reconciled, receiver compatible, audit protected; do not expose writes early.

### Phase 2 — Shared masters, server validation and Class Code

This is delivery phase 2 of release one, not the deferred product Phase 2.

**Files:** `shared/schema.ts`; existing master registry/services/repositories and validation/seed paths located during implementation; `client/src/pages/admin/MasterListsManagement.tsx`; Section H service/controller; relevant master sync paths.

**Migrations:** proposed 186/187; conditional reference fields only after approval. Name any verified prerequisite alignment explicitly.

**Work:** 19/46 dataset, canonical RINA, controlled selections, type validation, server-derived code, legacy mapping, text/date checks, friendly errors; maintain Phase 1 policy.

**Sync/field logs:** master-first one-way delivery; verified updated_at updates; stable reference resolution rather than local ids. No category change.

**Tests:** repeated survey names, retired/wrong-type masters, forged codes, seed replay, blank/limit/date cases, historical preservation.

**Completion gate:** master reference and retirement rules approved; both schemas and master delivery ready.

### Phase 3 — Multi-entry UI, dates and error handling

**Files:** `client/src/pages/pms/Components.tsx`; `client/src/components/ComponentRegisterAddEdit.tsx`; `client/src/components/AddEditComponentForm.tsx`; focused H entry components. Reuse ComponentDateInput and componentDatePresentation.

**Migrations:** none.

**Work:** all rows, independent Save/Cancel, failure retention, controlled masters, read-only code, office lifecycle/removed view, vessel read-only, Class Item No notice and explicit field mapping.

**Sync/field logs:** UI displays authoritative/synchronized state; no vessel mutations or client regeneration of existing UUIDs.

**Tests:** separate same-pair rows, failed-save input retention, Component Save independence, scope switches, DD-MM-YYYY/unchanged raw dates, correct buttons and direct API denial.

**Completion gate:** connected per-entry persistence works and no false-success/hidden-data path remains.

### Phase 4 — Audit completion and functional/sync regression

**Files:** Section H service/repository/storage and audit integration; `server/modules/reports/services/equipmentReportService.ts`; `client/src/pages/reports/ClassItemsMasterList.tsx`; affected form/export consumers; focused unit/integration/sync tests.

**Migrations:** none expected beyond approved preceding files; any new audit schema requirement returns for approval.

**Work:** lifecycle audit completeness/failure semantics, report/consumer mappings, deleted filtering, full authorization and historical rollout regression.

**Sync/field logs:** initial/incremental/replay tests, null/origin/timestamp handling, applicable bidirectional logging/failure checks, no echo, mixed-version refusal.

**Tests:** acceptance matrix below; unrelated legacy routes unchanged; failed authorization causes no mutation; required audit failure cannot be described as success.

**Completion gate:** regression evidence and confirmed failure/transaction policy before release.

### Phase 5 — Deferred product Phase 2

**Work:** per-entry attachments and private bytes/metadata sync; child-entry Modify PMS targeting, approval application/return flow; red/orange/green survey indicators with approved boundaries.

**Files:** separate design must identify change-request targets/services, attachment storage/schema/sync and UI consumers. Existing component documents do not automatically provide an entry attachment association.

**Migrations:** no attachment/approval tables or migration files authorized here. Specify them only in a separately approved design.

**Sync/field logs:** file delivery and approval return need explicit contracts; no implicit bidirectional H ownership.

**Tests/completion:** define with separately approved scope; no implementation task created by this document.

## 10. Acceptance and regression checks

### 10.1 Functional

- All active entries display; same-society/type different certificates remain separate.
- Edit targets the selected entry, not the first component row.
- Each entry saves through its endpoint; Component Save never pretends to save H drafts.
- Failed operations retain values and identify actual outcomes.
- New component must be saved before adding entries.
- Class Item No hides/deletes nothing under the approved proposal.
- Only society/type are mandatory user-entered fields; correct master type/code and limits are validated server-side.
- Impossible dates and reversed order fail at both layers; equal dates pass; optional dates remain optional.
- UI is DD-MM-YYYY; untouched raw date representations/hidden legacy fields remain unchanged.
- Soft delete retains data; normal reads exclude removed entries; authorized restore recovers the same identity.
- No certificate uniqueness or natural-key merge is introduced.
- Class Items UI/available Excel/PDF paths preserve columns, row expansion, placeholder behavior and deleted exclusion.

### 10.2 Authorization

- Direct POST/PUT/DELETE/restore refuse absent RBAC, source none/mock, unapproved office and all Ship identities.
- PMS_AUTH_MOCK_RBAC cannot gain writes through Sail Admin helper bypass.
- Approved forwarded office admin succeeds only with approved rights and verified scope.
- DELETE/restore load stored entry/parent; cross-vessel integer-id tampering fails.
- Client ownership fields cannot authorize access or reparent an entry.
- Reads/removed lists use real scope; missing assignment is not unrestricted.
- Global requirePMSAdmin and unrelated legacy routes are unchanged.
- Trusted forwarding/spoofing assumptions are validated before release.

### 10.3 Sync and migration

- Two same-pair entries survive provisioning, incremental sync and retries as two UUID rows.
- Editing society/type updates the same row without duplicate leftovers.
- Delete/restore reach vessel with correct UUID, originating metadata and explicit null clearing.
- Reconciled shore/vessel counterparts share identities; ambiguity is never auto-deleted/merged.
- First apply/direct replay/boot replay/partial-rollout recovery are safe.
- Seed rerun preserves user edits and retirement state.
- Finalization refuses unresolved/missing/duplicate UUIDs and is delivered only after reconciliation.
- Masters precede entries; stable reference resolution and watermark updates work.
- UUID/code vessel scope representations and precise checkpoint behavior remain supported.
- No unsafe mixed-version key fallback or unintended bidirectional H writes.
- Write-path matrix covers future raw/bulk/import paths, applicable field-log failure handling and receiver echo prevention.
- No independent historical user-edit log backlog is manufactured; initial delivery still occurs.
- Audit and applicable logging failures match the approved transaction/recovery contract.

## 11. Open decisions

| Decision | Recommended default | Status |
|---|---|---|
| Sail Admin treatment | Explicitly decide whether genuine forwarded Sail Admin + Office may write; helper bypass alone is not approval | Proposed — needs confirmation |
| Qualifying forwarded office-admin role names | Exact allowlist/mapping, not guessed names or blanket Office | Proposed — needs confirmation |
| Permission resource/actions | Verified component/admin rights, enforcement on, unconfigured deny, bypass policy reconciled | Proposed — needs confirmation |
| Trusted scope source and office vessel entitlements | Authenticated forwarded canonical identity plus authoritative assignments; deny unresolved scope | Proposed — needs confirmation |
| Initial ownership | Office PMS Admin writes; vessel read-only | Proposed — needs confirmation |
| UUID representation/reconciliation | Project TEXT UUID, shore-authoritative reviewed mapping, manual ambiguity resolution | Proposed — needs confirmation |
| Stable master references | Approve conditional key columns or another explicit cross-installation-safe design | Proposed — needs confirmation |
| Master metadata/administration | Shared nullable country/category/description; Components grouping initially; confirm any new section | Proposed — needs confirmation |
| Master dataset/lifecycle | 19/46 supplied values, one RINA, retire references without destroying history | Proposed — needs confirmation |
| Legacy fields | Hidden but retained; no automatic conversion | Proposed — needs confirmation |
| Date/text rules | Trim; 100/2,000/2,000; real dates; last ≤ next with equality | Proposed — needs confirmation |
| Invalid historical dates on unrelated edit | Keep readable/flagged; explicitly agree retention versus correction requirement | Proposed — needs confirmation |
| Class Item No/report scope | H visible with notice; report population unchanged | Proposed — needs confirmation |
| Restore metadata | Clear current deletion fields; retain event history | Proposed — needs confirmation |
| Audit failure semantics | Atomic mutation + required audit; no unaudited success | Proposed — needs confirmation |
| Additional H field logs | No implied logs under current one-way contract; approve explicit supported extension if required | Proposed — needs confirmation |
| Ordering/navigation | Stable sort_order/identity; warn on discarded drafts | Proposed — needs confirmation |
| Deferred scope | Attachments, H Modify PMS and colours outside release one | Proposed — needs confirmation |

Missing/mock identity write refusal is required, not an optional permissive fallback. Role, scope, master-reference and audit decisions must be resolved before implementation activation.

## 12. Differences from the 14 October summary and stop condition

- Retain shared-master recommendations, canonical dataset, stable identity and lifecycle direction; distinguish proposed content from installed state.
- Explicitly document live pass-through/mock-role/null-vessel authorization and make the local fix a first-phase prerequisite; global aliases remain unchanged.
- Narrow initial delivery: attachments/file sync, H-specific Modify PMS and survey colours are deferred.
- Retain integer ids locally; reconcile UUIDs before coordinated sync activation.
- Specify exact proposed file-based idempotent migration locations and staged finalization.
- Distinguish migration-defined master watermark from omitted ORM declaration.
- Make conditional master references explicit rather than assuming local integer FK portability.
- Explain one-way transport versus BOTH_EDITABLE field logs and their different failure contracts.
- Preserve legacy columns, report population/columns and existing deleted-row report filtering.
- Retain the companion unchanged; its broader design is not permission to implement deferred features.

**Stop condition:** only this plan document is changed. No SQL file, schema, code, seed, sync configuration, environment setting or database mutation is delivered. Report findings, plan corrections and open decisions, then wait for explicit approval before implementation.
