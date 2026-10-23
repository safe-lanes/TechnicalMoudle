# SAIL PMS — Section H: Final Functional, Database and Synchronization Summary

**Prepared:** 14 October 2026  
**Area:** PMS → Components → Section H: Classification & Regulatory Data  
**Purpose:** Self-contained validation document for the domain, database, backend, frontend and sync teams.  
**Status:** Proposed design for validation — not an implementation-completion report.

> This document records requirements, current-code findings and a recommended design. It does not mean a migration, seed, application change, live database inspection or live office–vessel sync test has been performed. No production deployment or destructive database operation is authorized by this document.

## Contents

1. Scope, evidence and terms
2. Confirmed current implementation
3. Functional requirements
4. Master administration and seed data
5. Proposed database tables and columns
6. Audit and lifecycle rules
7. Backend/API responsibilities
8. Frontend behavior
9. Synchronization functionality and impact
10. Functional regressions
11. Synchronization regressions
12. Acceptance checklist
13. Safe implementation sequence
14. Items requiring validation
15. Architecture-compliance and delivery checklist
16. Traceability

---

## 1. Scope, evidence and terms

### 1.1 Objective

Complete Section H so each component can have multiple classification/regulatory entries that:

- Save, retrieve and edit reliably.
- Use society and survey-type master records.
- Derive Class Code from Classification Society.
- Display survey dates and indicators correctly.
- Support attachments attached to an individual entry.
- Apply the agreed office/vessel permissions and Modify PMS workflow.
- Support soft deletion/restoration.
- Synchronize safely through existing PMS infrastructure.

### 1.2 Evidence labels

| Label | Meaning |
|---|---|
| **Requirement** | Stated in the supplied revised plan or existing project instruction. |
| **Confirmed in code** | Found in current source/migration definitions. Does not confirm live production/development schema or behavior. |
| **Proposed** | Recommended design pending user/domain validation. |
| **Requires verification** | Must be checked against actual data, environment, deployment or business policy. |

### 1.3 Scope limits

- Reuse current master, attachment, permission, request, audit and synchronization services where appropriate.
- Do not create a parallel master system or new synchronization framework.
- Do not change unrelated PMS modules, user rights or attachment policies.
- Do not change work-order generation, running-hour behavior, maintenance frequencies or grace periods.
- Do not create WOs/alerts based on survey colours; not part of this request.
- `DD-MM-YYYY` is for Component UI presentation only; do not change saved/API date representations.
- Use the established migration/seed process in development/test.
- Do not reset databases, drop unrelated objects, deploy to production or use a destructive database push.
- The revised plan states no existing Section H business records require mapping. Verify actual data before relying on this. Preserve all shared masters, component, attachment and database records.

### 1.4 Terms

- **Section H entry:** One regulatory record belonging to one component.
- **Local ID:** Installation-local primary key; integer IDs may differ between shore and vessel.
- **Stable identity:** UUID or other stable key used to represent the same record across installations.
- **Master reference:** Selected Classification Society or Survey Type.
- **Metadata:** File name/key/size and related fields in the database. It is not the binary file.
- **Soft delete:** Retain the record/file, hide it from normal views, and permit authorized restoration.
- **Idempotent sync:** Repeating the same delivery updates/acknowledges the same logical record rather than creating a duplicate.

---

## 2. Confirmed current implementation

### 2.1 Section H schema, APIs and storage

**Found in source:**

- Existing table: `component_class_regulatory`.
- `id` is a generated integer key; `component_id` refers to `components.cuuid`.
- The table already has component/vessel codes, society, survey type, certificate, issue/expiry and class survey dates, class requirements, class code, information, survey status and remarks.
- Existing create/list/update/delete API paths are present.
- Current storage deletion physically removes a regulatory row.
- Current storage listing selects by component but does not filter `is_deleted`.
- Current table declaration has created/updated audit values, `is_deleted`, `is_sync` and `sort_order`.
- The declared Section H table has no stable per-entry UUID identity for synchronization.

### 2.2 Current Component UI and report

- The visible Section H view renders `classRegData[0]`, so only the first returned row is displayed.
- Component Add/Edit code has Section H field state. Its persistence must be verified through the complete save workflow; editable controls alone do not prove persistence.
- There are several Component-related form/configuration components; establish which are live entry points before editing.
- The Class Items Master List report already expands multiple regulatory records into rows and filters explicitly deleted rows.
- Existing consumers read values such as `classificationSociety`, `surveyType`, `certificateNumber`, `lastClassSurvey` and `nextSurveyDue`; preserve compatible output or update consumers together.

### 2.3 Current shared master data

- `master_lists` is the generic dropdown table with `list_type`, `list_key`, `list_value`, ordering/active fields, and tracking fields.
- It has a unique constraint on `(list_type, list_key)`.
- It does not declare `country`, `category` or `description` business columns.
- `master_list_types` registers list types and admin sections.
- The current section validation allows Components, Jobs/WO and Spares only.
- The inspected master-list storage delete operation is a hard delete; normal reads filter `is_active` but do not explicitly filter `is_deleted`.
- The standard audit migration adds `updated_at` to `master_lists`, although the inspected ORM declaration does not include it. This is a source/schema-alignment concern, not proof of live schema state.

### 2.4 Current synchronization, files and requests

- `component_class_regulatory` is configured for office/shore → vessel synchronization.
- Current receiving match key is `(component_id, survey_type, classification_society)`.
- `master_lists` is office → vessel, matched by `(list_type, list_key)`.
- `component_documents` is bidirectional and associated with a component, not a Section H entry.
- File synchronization already has a queue, chunking, resume and SHA-256 integrity checks. An old “future table” comment does not mean the processor is absent.
- Office-owned row gathering uses `updated_at` and synchronization checkpoints.
- Modify PMS supports component, job, work order, spare and store targets. A regulatory child-entry update path must be verified/added; it is not guaranteed by component request support.

---

## 3. Functional requirements

### 3.1 Fields for every Section H entry

| Field | UI/behavior requirement | Validation | Existing field |
|---|---|---|---|
| Certificate No. | Free text | Maximum 100 characters | `certificate_number` |
| Classification Society | Select from society master, not arbitrary society text | Reference must be valid society type | `classification_society` plus proposed reference |
| Last Class Survey | Date control | Valid date; cannot be later than Next when both exist | `last_class_survey` |
| Next Class Survey | Date control with colour indicator | Valid date; blank has no colour | `next_survey_due` |
| Survey Type | Select from survey master | Reference must be valid survey type; distinguish repeated names | `survey_type` plus proposed reference |
| Class Requirements | Free text | Maximum 2,000 characters | `class_requirements` |
| Class Code | Read-only, derived from selected society | Server derives and validates | `class_code` |
| Information | Free text | Maximum 2,000 characters | `information` |

Current schema makes society and survey type non-null. Preserve established required behavior or validate any change explicitly. Do not make other fields mandatory without a business rule.

### 3.2 Create, edit and view

**Create**

1. Authorized office user selects a component.
2. User adds an entry and selects society/survey type.
3. User enters other values.
4. UI displays Class Code from selected society.
5. Frontend and backend validate.
6. Backend derives component/vessel scope and master snapshots.
7. Backend creates local ID and stable UUID.
8. Saved entry is returned and displayed.
9. Refresh/reopen retrieves the same entry.
10. Uploads attach to this saved entry.

**Edit**

- Load the selected entry, not the first row for its component.
- Update it by stable identity and preserve local ID/UUID/component association.
- Never create a duplicate as a side effect of edit.
- Changing society re-derives Class Code.
- Editing one row must not affect another row with the same society/type.
- Preserve attachments unless explicitly removed by an authorized user.
- Do not rewrite untouched backend dates because their UI presentation changed.

**View and multiple records**

- A component may have multiple entries; no maximum count or natural uniqueness rule is defined.
- Two entries with the same component/society/survey type remain separate.
- Show all active entries; choose the entry before editing or managing attachments.
- Component/vessel switches must not display cached entries/files from another scope.
- Backend must verify entry→component→vessel relationships; never trust client scope fields.
- Reparenting an entry is not an ordinary edit and is out of scope.

### 3.3 Roles and allowed actions

| Action | Authorized office user | Vessel user |
|---|---|---|
| View permitted Section H entries | Yes | Yes, within assigned/permitted vessel |
| Create/edit entry fields | Yes | No |
| Soft-delete/restore an entry | Yes | No |
| Maintain masters | Only with existing master-admin permission | No |
| Upload attachment | Yes | Yes, for accessible active entry |
| View/download attachment | Yes | Yes, subject to scope/lifecycle |
| Request Section H field change | Existing request/review workflow | Submit through Modify PMS |
| Remove/restore an attachment | Validate exact role policy | Do not infer from upload permission |

Enforce permissions in backend endpoints and services, not just by hiding buttons. Bidirectional attachment sync does not grant vessel users direct Section H field access.

### 3.4 Modify PMS

- A vessel request identifies both the component and specific Section H entry by stable identity.
- Existing request/review/approval controls remain in place.
- Reviewer sees old values, proposed values and relevant entry context.
- Rejection leaves entry unchanged.
- Approval updates the correct office-side regulatory entry, not just the parent component.
- Approved changes return to the vessel with normal office-to-vessel data.
- Detect if the entry was deleted or changed since request submission; do not silently overwrite newer values.
- Confirm whether add/delete requests are supported; the supplied plan explicitly describes requests for changes but does not define every operation.

### 3.5 Date presentation, validation and colour

**Component date standard:** render dates as `DD-MM-YYYY` in the UI only. Preserve backend/API representation and exact stored value for untouched dates.

- Use existing Component date controls/presentation helpers.
- Validate actual dates, including leap-year cases.
- Compare as date values, not formatted text.
- If Last Class Survey > Next Class Survey, prevent save with clear message.
- Equal dates are allowed by the supplied rule.
- Only compare ordering when both are present.
- Do not change valid dates automatically.
- Blank Next Class Survey: no colour.
- Invalid/unparseable values must not be presented as a valid green date.
- Do not extend this formatting change to other modules or exports absent separate approval.

| Colour | Rule |
|---|---|
| Red | Date on/before today plus one calendar month; includes overdue/today. |
| Orange | After one-month boundary through and including three-month boundary. |
| Green | After three-month boundary. |

Example, today = 14-10-2026: one-month boundary 14-11-2026, three-month boundary 14-01-2027. 14-11 is red, 15-11 through 14-01 orange, 15-01 onward green. Use calendar months, not 30/90 days. Proposed month-end convention is clamp to last valid target-month day (31 Jan + one month → 28/29 Feb); validate this and the authoritative local date/timezone before implementation. Colour is computed state: synchronize the date, not a colour that will become stale.

### 3.6 Attachments

- Supported file extensions: PDF, DOC, DOCX, XLS, XLSX and CSV.
- 25 MB per file using the established byte convention. If none exists, 25 MiB = 26,214,400 bytes consistently.
- Enforce size at UI, API and relevant request/proxy limits.
- Validate extension and content securely. CSV has no universal magic signature; do not rely on MIME alone.
- Store binary in existing private storage. Store metadata in a table.
- Generate safe storage keys independent of user-controlled path characters.
- Preserve safe display names; filenames need not be unique.
- Each attachment belongs to one specific entry and is checked against its component/vessel.
- Authorized office and vessel users can upload/view/download.
- Metadata delivery does not prove binary delivery.
- Expose pending/available/failed transfer state where supported.
- Promise inline preview only when the existing system supports that format; otherwise offer secure download.
- Recommended initial workflow: save entry before upload. If upload-before-save is required, define staging, cleanup and ownership rules.
- File-count/aggregate limits, replacement/version behavior and attachment deletion roles are not specified; do not invent these silently.

### 3.7 Soft delete and restore

- Section H row delete is soft; retain ID, UUID, component association, history and files.
- Hide deleted entries in normal views and operations.
- Provide authorized UI to list/restore deleted entries; no direct database edit required.
- Restore original identity; do not insert another record.
- Parent deletion hides attachments but does not permanently delete files.
- Parent restoration exposes independently active attachments again.
- Independently deleted attachments remain deleted after parent restoration.
- Attachment removal is separately soft-deleted.
- Direct API download/upload must respect deleted parent state.
- No database cascade may physically delete Section H attachment files/metadata.
- Respect component visibility/inactive rules; Section H restore must not bypass parent component access policy.

---

## 4. Master administration and supplied data

### 4.1 Location and shared representation

Admin path: **PMS → Admin → Master Data → Master Lists Management**. Add **Classification and Regulatory** next to Spares using the existing framework.

| Existing/shared field | Society | Survey type |
|---|---|---|
| `list_type` (proposed keys) | `classificationSociety` | `surveyType` |
| `list_key` | Class Code | Survey Code |
| `list_value` | Society Name | Survey Type Name |
| Proposed `country` | Country | Normally null |
| Proposed `category` | Normally null | Class/Statutory/etc. |
| Proposed `description` | Normally null | Supplied description |

Do not add a redundant `column_type`. Check proposed list-type keys against existing registry before using them.

### 4.2 Master rules

- Reuse one existing `master_lists` value table; do not create separate society/survey/Class Code tables under this recommendation.
- Society Class Code and Survey Code are stable keys, not free-floating extra masters.
- New master columns nullable globally; type-specific API validation enforces society country and survey category/description as appropriate.
- Display category/code for repeated survey names.
- Preserve unique `(list_type, list_key)`; do not enforce display-name uniqueness.
- Validate referenced row's `list_type`, not only its existence.
- Exclude inactive/deleted masters from new selections; keep historical entry values readable.
- Define retirement behavior before allowing deletion of referenced master rows.
- Keep referenced codes/keys stable. Seed reruns must not duplicate rows or unintentionally overwrite authorized changes.
- RINA has one canonical row only: RINA / RINA / Italy. Consolidate old aliases only after checking actual references.

### 4.3 Societies — 19 rows

| No. | Society | Class Code | Country |
|---:|---|---|---|
| 1 | American Bureau of Shipping | ABS | USA |
| 2 | Bureau Veritas | BV | France |
| 3 | China Classification Society | CCS | China |
| 4 | DNV | DNV | Norway |
| 5 | Lloyd's Register | LR | United Kingdom |
| 6 | Korean Register | KR | South Korea |
| 7 | Nippon Kaiji Kyokai (ClassNK) | NK | Japan |
| 8 | RINA | RINA | Italy |
| 9 | Indian Register of Shipping | IRS | India |
| 10 | Polish Register of Shipping | PRS | Poland |
| 11 | Croatian Register of Shipping | CRS | Croatia |
| 12 | Russian Maritime Register of Shipping | RS | Russia |
| 13 | Türk Loydu | TL | Türkiye |
| 14 | Hellenic Register of Shipping | HRS | Greece |
| 15 | Registro Brasileiro de Navios | RBNA | Brazil |
| 16 | International Register of Shipping | IRS-US | USA |
| 17 | Korean Ship Safety Technology Authority | KST | South Korea |
| 18 | Maritime Bureau of the Ministry of Land, Infrastructure, Transport and Tourism | MLIT | Japan |
| 19 | Spanish Maritime Register / Bureau Veritas Spain | BV-ES | Spain |

### 4.4 Survey types — 46 rows

| No. | Category | Survey Type | Code | Description |
|---:|---|---|---|---|
| 1 | Class | Initial Survey | CLS-INI | Initial survey for assignment of Class |
| 2 | Class | Annual Survey | CLS-ANN | Annual Class survey |
| 3 | Class | Intermediate Survey | CLS-INT | Intermediate Class survey |
| 4 | Class | Special Survey | CLS-SPC | Comprehensive Class survey, normally at 5-year intervals |
| 5 | Class | Renewal Survey | CLS-REN | Survey for renewal of Class |
| 6 | Class | Continuous Survey | CLS-CON | Survey carried out progressively during the Class cycle |
| 7 | Class | Occasional Survey | CLS-OCC | Survey resulting from a specific event, alteration, or requirement |
| 8 | Class | Damage Survey | CLS-DMG | Survey following damage or casualty |
| 9 | Class | Repair Survey | CLS-RPR | Survey to verify repairs |
| 10 | Class | Modification Survey | CLS-MOD | Survey following modification or alteration |
| 11 | Class | Additional Survey | CLS-ADD | Additional survey required by Class |
| 12 | Class | Docking Survey | CLS-DCK | Class survey requiring dry-docking |
| 13 | Class | In-Water Survey | CLS-IWS | Underwater survey carried out without dry-docking |
| 14 | Class | Bottom Survey | CLS-BTM | Inspection of the underwater hull/bottom |
| 15 | Statutory | Initial Survey | STT-INI | Initial statutory survey |
| 16 | Statutory | Annual Survey | STT-ANN | Annual statutory survey |
| 17 | Statutory | Intermediate Survey | STT-INT | Intermediate statutory survey |
| 18 | Statutory | Periodical Survey | STT-PER | Statutory survey performed at specified intervals |
| 19 | Statutory | Renewal Survey | STT-REN | Survey for renewal of a statutory certificate |
| 20 | Statutory | Additional Survey | STT-ADD | Additional statutory survey |
| 21 | Statutory | Occasional Survey | STT-OCC | Statutory survey due to a specific event or change |
| 22 | Flag State | Initial Survey | FLG-INI | Initial Flag State survey |
| 23 | Flag State | Annual Survey | FLG-ANN | Annual Flag State survey |
| 24 | Flag State | Intermediate Survey | FLG-INT | Intermediate Flag State survey |
| 25 | Flag State | Renewal Survey | FLG-REN | Renewal survey of a Flag certificate |
| 26 | Flag State | Additional Survey | FLG-ADD | Additional Flag State survey |
| 27 | Port State | PSC Inspection | PSC-INS | Port State Control inspection |
| 28 | ISM | Initial Verification | ISM-INI | Initial verification related to ISM |
| 29 | ISM | Annual Verification | ISM-ANN | Annual ISM verification/audit |
| 30 | ISM | Intermediate Verification | ISM-INT | Intermediate ISM verification |
| 31 | ISM | Renewal Verification | ISM-REN | Renewal verification for ISM certification |
| 32 | ISPS | Initial Verification | ISP-INI | Initial ISPS verification |
| 33 | ISPS | Intermediate Verification | ISP-INT | Intermediate ISPS verification |
| 34 | ISPS | Renewal Verification | ISP-REN | Renewal ISPS verification |
| 35 | ISPS | Additional Verification | ISP-ADD | Additional ISPS verification |
| 36 | MLC | Initial Inspection | MLC-INI | Initial MLC inspection |
| 37 | MLC | Intermediate Inspection | MLC-INT | Intermediate MLC inspection |
| 38 | MLC | Renewal Inspection | MLC-REN | Renewal MLC inspection |
| 39 | MLC | Additional Inspection | MLC-ADD | Additional MLC inspection |
| 40 | Other | Condition Survey | OTH-CON | General condition assessment |
| 41 | Other | Pre-Purchase Survey | OTH-PPS | Survey before purchase/acquisition |
| 42 | Other | On-Hire Survey | OTH-ONH | Survey when entering a charter |
| 43 | Other | Off-Hire Survey | OTH-OFH | Survey when leaving a charter |
| 44 | Other | Bunker Survey | OTH-BNK | Survey related to bunker quantity/condition |
| 45 | Other | Damage Survey | OTH-DMG | General damage assessment |
| 46 | Other | Other Survey | OTH-OTH | Survey not covered by the standard types |

---

## 5. Proposed database structure and columns

### 5.1 Table-change summary

| Table | Change | Purpose |
|---|---|---|
| `master_lists` | Extend existing table | Both regulatory master types. |
| `master_list_types` | Add section/type registration and extend validation | Admin navigation and type registry. |
| `component_class_regulatory` | Extend existing table | Stable identity, master references and deletion audit. |
| `component_class_regulatory_attachments` | Create one new table | Attachment metadata per entry. |

**Recommended new-table count: one.** No dedicated society, survey or Class Code master tables in this design.

### 5.2 `master_lists` — existing plus proposed

| Column | Status/type | Purpose |
|---|---|---|
| `id` | Existing INTEGER identity PK | Local master-row ID. |
| `list_type` | Existing TEXT NOT NULL | Selects regulatory master subtype. |
| `list_key` | Existing TEXT NOT NULL | Stable society/survey code. |
| `list_value` | Existing TEXT NOT NULL | Society/survey display name. |
| `display_order` | Existing INTEGER, default 0 | Dropdown ordering. |
| `is_active` | Existing BOOLEAN, default true | Eligible for new selection. |
| `country` | Proposed TEXT NULL | Society country. |
| `category` | Proposed TEXT NULL | Survey category. |
| `description` | Proposed TEXT NULL | Survey description. |
| `created_at` | Existing TIMESTAMP | Original creation time. |
| `updated_at` | Migration-defined; ORM alignment needed | Modification time/sync watermark. |
| `created_by_uuid` | Existing TEXT | Trusted creator/origin identity. |
| `updated_by_uuid` | Existing TEXT | Trusted modifying identity. |
| `is_deleted` | Existing BOOLEAN | Lifecycle flag; filter consistently. |
| `is_sync` | Existing BOOLEAN | Existing sync tracking. |
| `sort_order` | Existing INTEGER | Existing ordering convention. |
| `deleted_by_uuid` | Proposed TEXT NULL if regulatory soft delete | Deleting actor. |
| `deleted_at` | Proposed TIMESTAMP NULL if regulatory soft delete | Deletion time. |

Preserve unique `(list_type, list_key)` and current type index. New nullable fields must not make existing unrelated types fail validation. Do not globally alter hard-delete behavior without approval.

### 5.3 `master_list_types` — existing registry

Existing columns: `id`, `mltuuid`, `list_type_key`, `label`, `section`, `is_system`, `is_active`, `display_order`, `created_at`, `updated_at`, `created_by_uuid`, `updated_by_uuid`, `is_deleted`, `is_sync`, `sort_order`.

- Reuse its UUID, audit and tracking conventions.
- Add two type records and the Classification and Regulatory section.
- Expand frontend/backend section validators; current set contains only Components, Jobs/WO and Spares.
- No new registry table is proposed.
- Preserve protected/system rows and existing behavior.
- Add deletion-specific actor/time only if the registry itself will expose a delete workflow.

### 5.4 `component_class_regulatory` — existing plus proposed

Retain all existing columns:

`id`, `component_id`, `component_code`, `vessel_code`, `classification_society`, `survey_type`, `certificate_number`, `issue_date`, `expiry_date`, `last_class_survey`, `next_survey_due`, `class_requirements`, `class_code`, `information`, `survey_status`, `remarks`, `created_by`, `created_at`, `updated_by`, `updated_at`, `is_sync`, `created_by_uuid`, `updated_by_uuid`, `is_deleted`, `sort_order`.

| Proposed new column | Type/constraint | Purpose |
|---|---|---|
| `ccruuid` | TEXT UUID NOT NULL UNIQUE; generated default | Stable Section H entry identity. Proposed name. |
| `society_master_id` | INTEGER FK → `master_lists.id` | Local society FK. |
| `survey_type_master_id` | INTEGER FK → `master_lists.id` | Local survey FK. |
| `society_master_key` | TEXT | Stable master key sent/resolved during sync. |
| `survey_type_master_key` | TEXT | Stable master key sent/resolved during sync. |
| `deleted_by_uuid` | TEXT NULL | Deleting actor. |
| `deleted_at` | TIMESTAMP NULL | Deletion time. |

Technical rules:

- Follow existing text UUID generation convention (for example, `gen_random_uuid()::text`); generate once and preserve on both systems.
- Preserve existing integer `id`; UUID is additional sync identity.
- Master IDs are local; keys resolve receiver-local IDs.
- Verify list type as well as key/ID consistency.
- Derive snapshots (`classification_society`, `survey_type`, `class_code`) on the server.
- Do not add a unique constraint on `(component_id, society, survey type)`.
- Retain legacy extra fields and existing API-readable names.
- New writes must use valid references; migration nullability/backfill depends on inspection of real rows.
- Keep existing indexes; add UUID unique constraint and master-reference indexes after query review.

### 5.5 New `component_class_regulatory_attachments`

| Column | Type/constraint | Purpose |
|---|---|---|
| `id` | INTEGER identity PK | Local attachment metadata ID. |
| `ccrauuid` | TEXT UUID NOT NULL UNIQUE; generated default | Stable attachment sync identity. Proposed name. |
| `class_regulatory_uuid` | TEXT NOT NULL FK → `component_class_regulatory.ccruuid` | Specific Section H parent. |
| `vessel_id` | TEXT NOT NULL FK → `vessels.vuuid` | Vessel scope for sync/authorization; server-derived. |
| `file_name` | TEXT NOT NULL | Safe readable filename. |
| `file_key` | TEXT NOT NULL | Private storage object key, not an access token. |
| `content_type` | TEXT NOT NULL | Server-validated media type. |
| `file_size` | INTEGER NOT NULL | Bytes; positive and within approved cap. |
| `storage_backend` | TEXT NOT NULL | Existing local/object storage convention. |
| `uploaded_by` | TEXT NOT NULL | Uploader per existing attachment convention. |
| `uploaded_at` | TIMESTAMP NOT NULL, current-time default | Original upload time. |
| `created_at` | TIMESTAMP NOT NULL, current-time default | Standard creation time. |
| `updated_at` | TIMESTAMP NOT NULL, managed | Standard update/sync timestamp. |
| `created_by_uuid` | TEXT | Trusted creator identity. |
| `updated_by_uuid` | TEXT | Trusted modifying identity. |
| `is_deleted` | BOOLEAN NOT NULL, false | Soft-delete state. |
| `deleted_by_uuid` | TEXT NULL | Deleting actor. |
| `deleted_at` | TIMESTAMP NULL | Deletion time. |
| `is_sync` | BOOLEAN, default false | Maintained according to existing sync design. |
| `sort_order` | INTEGER, default 0 | Ordering convention. |

**Column count: 20**, including the identified seven standard tracking columns and both deletion-specific audit fields.

Constraints/indexes and behavior:

- Unique UUID; FK to stable parent UUID and vessel UUID.
- Index parent UUID for active attachment listing; index vessel scope.
- Derive vessel from parent → component → vessel, not client payload.
- Do not add a duplicate integer parent FK in this proposed new table.
- Do not cascade physical parent deletion or make file names unique.
- Binary stays in existing private storage; file queue/hash/status stays in existing infrastructure unless a demonstrated requirement needs new fields.
- Confirm exact DB `CHECK` constraints/index policy against project migration conventions before implementation.

### 5.6 Architecture compliance

This is a **compliant proposed design** for the new table: all identified standard columns, requested deletion actor/time, stable identity, parent relationship, vessel scope and indexes are specified. It is not proof of an applied schema.

The earlier draft proposed three new tables and did not list all standard audit/tracking columns. That draft should not be used as the final schema. It has not been modified by this document.

---

## 6. Audit and lifecycle rules

| Operation | Expected audit behavior |
|---|---|
| Create | Set creation and update actors/times; `is_deleted=false`; deletion audit null. |
| Edit | Preserve creation data; advance update actor/time. |
| Soft delete | `is_deleted=true`; set deletion actor/time; advance update actor/time. |
| Restore | `is_deleted=false`; preserve ID/UUID/creation data; advance update actor/time. |
| Sync apply | Preserve originating business actor/time using existing convention; do not pretend receiver is creator. |
| Seed | Use established system/origin-actor policy, not arbitrary user IDs. |

Proposed interpretation: deletion actor/time describe current deleted state and are cleared on restore; preserve event history through existing audit logging. Confirm because the plan does not define clearing behavior.

- `uploaded_at` remains the original upload time.
- Restore is auditable even if current-state deletion fields clear.
- Reuse existing audit utilities/request context.
- ORM `updatedAtColumn` handles ordinary updates; raw SQL, migration and certain upsert paths need explicit timestamps.
- Delete/restore must be visible to incremental sync.
- Audit values and sync flags are server-managed, not editable form fields.
- Do not create a second audit framework unless existing mechanisms cannot meet the requirement and the extra scope is approved.

---

## 7. Backend/API responsibilities

### 7.1 Existing Section H routes

- `GET /technical/api/component-class-regulatory/:componentId`
- `POST /technical/api/component-class-regulatory`
- `PUT /technical/api/component-class-regulatory/:id`
- `DELETE /technical/api/component-class-regulatory/:id`

Reuse compatible endpoints. Add authorized deleted-record retrieval and restore. New attachment/restore route names are intentionally not finalized here. Resolve local IDs to stable UUIDs for sync and relationships where needed.

### 7.2 Service validation and security

- Authenticate; determine office/vessel role and vessel assignment.
- Load parent/component/entry; derive scope from trusted DB relationships.
- Scope every listing, read, upload, download, mutation, deletion and restore.
- Reject nonexistent/wrong-type/inactive master selections as required.
- Verify master ID matches submitted stable key/type.
- Derive component code, vessel scope, society name, survey name and Class Code.
- Validate all field lengths and date types/order on the backend as well as frontend.
- Reject unauthorized reparenting/scope changes.
- Filter deleted records from normal list/detail/download endpoints.
- Prevent downloads via stale direct links where parent or attachment is deleted.
- Return clear validation/permission/not-found/storage errors; do not expose raw database errors.
- Keep edit/delete/restore roles distinct from vessel attachment-upload access.

### 7.3 Persistence/retry safety

- Define transactional or recoverable behavior if component and Section H data save separately.
- Do not report total success if child save failed.
- Resolve newly created component canonical UUID before creating its child entry.
- Preserve form data after validation errors when practical.
- Prevent timeout/retry/double-submit duplicates at API level; UI button disabling alone is insufficient.
- Coordinate binary upload and metadata insert; clean up uncommitted file on metadata failure using existing service behavior.
- Distinguish local upload success from remote sync completion.
- Avoid emitting sync changes for rolled-back writes.

### 7.4 Master history and changing codes

- Historical entries remain readable if a master is made inactive.
- Define whether unrelated edits may retain a retired selection.
- Recommended initial behavior: keep text/code snapshots until entry explicitly changes.
- Stable keys should not be edited in place after reference.
- If UI displays current master labels rather than historical snapshots, update report/API behavior intentionally.

---

## 8. Frontend behavior

- Preserve existing Component layout conventions; avoid unrelated redesign.
- Show every active entry using its own stable UI key.
- Authorized users can add/edit/delete/restore per entry.
- Provide a separately permissioned deleted-record/restore view.
- Society and survey type must be master selections.
- Show survey category/code where names repeat.
- Show Class Code read-only, re-derived when society changes.
- Support editing/reading 2,000-character fields.
- Format Component dates as `DD-MM-YYYY` only for display; do not rewrite untouched saved values.
- Compute colour without changing date or storing derived colour.
- Preserve inputs on validation failure; prevent concurrent submit; show truthful save result.
- Reset/refetch state on component/vessel changes.
- Never show attachment data cached from another parent.
- Vessel view: fields readable, no direct business-field edit/delete/restore controls.
- Use Modify PMS for vessel field-change requests.
- Show file name, size, permitted action and transfer status when available.
- Confirmation should explain soft-delete and retention.
- Preserve other component sections/configuration behavior.

---

## 9. Synchronization functionality and impact

### 9.1 Data authority/directions

| Data/action | Direction | Authority |
|---|---|---|
| Society/survey masters | Office → Vessel | Authorized office master admin |
| Section H create/edit | Office → Vessel | Authorized office user |
| Section H delete/restore | Office → Vessel | Authorized office user |
| Office attachment metadata/file | Office → Vessel | Authorized office user |
| Vessel attachment metadata/file | Vessel → Office | Authorized vessel user |
| Modify PMS request | Vessel → Office | Vessel submits |
| Approved Section H update | Office → Vessel | Office review/application |

This does **not** make Section H fields bidirectionally editable.

### 9.2 Entry identity

Current receiver matching uses `component_id + survey_type + classification_society`. That key is not unique when two certificates have the same society and type; editing society/type can also make the old record unmatchable.

Required proposed change:

1. Add `ccruuid`, generated once and preserved.
2. Register it as Section H sync identity.
3. Match/apply by UUID, replacing the unsafe natural-key match.
4. Retain local integer IDs.
5. Reference entry UUID from attachment metadata and Modify PMS.
6. Ensure repeated events update/no-op the same logical row.
7. If records exist on both systems, reconcile/backfill identities consistently; do not independently mint divergent UUIDs.

### 9.3 Master-reference resolution

- Preserve `(list_type,list_key)` as master identity.
- Never assume sender's integer master ID equals receiver's.
- Resolve expected list type + stable key; write receiver-local ID.
- Missing master: visible/deferred/retryable dependency failure, not substitution by coincidentally equal integer.
- Validate key/ID/type and snapshots agree.
- Keep referenced stable keys immutable or provide explicit remapping.

### 9.4 Sync dependency order

1. Master types/values and vessel/component dependencies.
2. Section H parent entry.
3. Entry-level attachment metadata.
4. File binary via existing queue.

Section H and components may be in the same sync phase; verify actual parent-first application. A new table must be registered with proper identity, scope, direction, phase and provisioning behavior.

### 9.5 Change capture and checkpoints

- Office-owned create/edit/delete/restore updates `updated_at`.
- Bidirectional attachment metadata uses established field logging for insert/update/delete/restore.
- Field logging is not binary file enqueue.
- Seed/master edits must advance appropriate timestamp/checkpoint eligibility.
- Do not advance checkpoints past failed payloads/dependencies.
- Keep schema errors visible and retryable.
- Check raw-SQL/upsert timestamp paths independently of ORM hooks.
- `is_sync` alone is not proof all destinations received data or files.

### 9.6 File transfer

Existing processor uses 256 KiB chunks, resume, SHA-256 verification and time-budget deferral. A 25 MiB file takes 100 chunks. The default shore-to-vessel completion-drain threshold is 10 MiB; larger files can span cycles.

- Record metadata can arrive before file bytes; communicate pending/available/failed state.
- Successful local upload is not proof of completed remote delivery.
- Existing queueing failures can be non-blocking; provide monitoring/retry path.
- Verify source bytes readable with actual object/local storage configuration.
- Verify receiver's storage path/backend and download service agree.
- Add explicit storage mapping for new table; do not rely on fallback path.
- Current enqueue helper derives direction from environment identity while other sync code uses database-resolved identity. Confirm they agree to avoid wrong-direction queueing.
- Preserve existing component/WO document chunk, priority and timeout behavior.
- Retain bytes for audit, but deleted parent/attachment must not become normally downloadable.

### 9.7 Delete, restore, retries and conflicts

- Lifecycle changes carry stable UUIDs and are idempotent.
- Parent restore does not restore independently deleted child attachment.
- Older retry must not undo a newer restore/edit.
- Reuse ordering/conflict safeguards; report any unsupported behavior.
- Define which side can remove/restore attachment metadata.
- Conflict resolution must not permit vessel field edits.
- Preserve originating actor/timestamps.

### 9.8 Modify PMS return path

Vessel request → office receipt → office review → update correct Section H entry → office-to-vessel delivery.

Request status synchronization alone is insufficient. Existing component approval updates `components`; add/verify child-entry handling by stable target identity and preserve review controls.

### 9.9 Mixed-version/provisioning

- Offices/vessels may not upgrade simultaneously.
- Agree schema and payload compatibility before sending new fields/tables.
- Provision master types, values, relationships and required schema.
- Verify both fresh vessel provisioning and upgrade of existing vessel.
- Keep incompatible events visible/retryable; do not silently acknowledge.
- Confirm rollout order and capability checks with deployment architecture.

---

## 10. Functional regression risks

Local behavior risks, independent of synchronization:

| ID | Priority | Possible regression | Protection/check |
|---|---|---|---|
| F01 | High | Parent saves but Section H fails (or inverse) while UI reports success. | Transaction/recovery strategy; partial-failure messaging. |
| F02 | High | Edit inserts duplicate. | Edit by identity; compare before/after IDs. |
| F03 | High | Only first of several entries is visible. | Render all entries and select per-entry action. |
| F04 | Critical | Wrong component/vessel sees entry or file. | Backend relationship/scope checks and switch tests. |
| F05 | High | Existing master dropdowns/imports break. | Nullable columns, type-specific rules, old-type regression. |
| F06 | Medium | Repeated survey names cause wrong selection. | Display category/code. |
| F07 | High | Soft-deleted entries stay in normal views. | Filter all list/detail/download paths. |
| F08 | High | Parent restore revives independently deleted attachment. | Independent lifecycle state. |
| F09 | Critical | Vessel upload access becomes direct field edit access. | Distinct backend permissions. |
| F10 | High | Approved request changes parent or wrong child. | Entry-specific Modify PMS target. |
| F11 | High | Reports/exports lose legacy names/dates. | Preserve mappings/snapshots and test report consumers. |
| F12 | High | UI date formatting rewrites backend values. | Presentation-only handling and untouched-value test. |
| F13 | Medium | Colour boundary/month-end wrong. | Calendar-month/leap-year/timezone tests. |
| F14 | High | Section G/other document policy changes. | Feature-scoped attachment changes. |
| F15 | High | Audit actor/time missing or spoofed. | Trusted backend audit context. |
| F16 | Medium | Retired master makes old entry blank or uneditable. | Retirement/snapshot policy. |
| F17 | Medium | Long fields truncate or cannot be read. | Length-boundary and layout tests. |
| F18 | High | Retry/double submit creates duplicate. | API idempotency/retry strategy. |

Regression scope includes Component Add/Edit, other Component sections, form configuration, Master Lists Management, bulk master import, Section G files, Modify PMS, Class Items report/export and existing permissions.

---

## 11. Synchronization regression risks

| ID | Priority | Possible sync failure | Protection/check |
|---|---|---|---|
| S01 | Critical | Identical component/society/type entries merge. | Stable entry UUID; test distinct certificates with same pair. |
| S02 | High | Changing society/type creates duplicate and leaves old row. | UUID matching rather than editable fields. |
| S03 | Critical | Integer FK resolves to wrong master. | Stable type/key mapping to receiver-local ID. |
| S04 | High | Parent/master not present before child. | Dependency order and safe deferral. |
| S05 | High | Save/delete/restore never enters incremental delivery. | Test timestamps and field logging per operation. |
| S06 | High | Attachment name arrives without binary. | Separate metadata/file completion state, retry. |
| S07 | High | New-table file routing differs from download path. | Explicit source/receiver storage integration. |
| S08 | High | Vessel upload queued in wrong direction. | Effective instance identity consistency. |
| S09 | High | Delete/restore state differs between systems. | Stable lifecycle identity and event delivery. |
| S10 | High | Retried event creates duplicate record/file. | Idempotent apply/queue. |
| S11 | High | Request says approved but entry unchanged. | End-to-end approval/apply/return test. |
| S12 | Medium–High | Large file still pending after record sync reports complete. | Accurate status and multi-cycle expectations. |
| S13 | High | Older receiver rejects schema/payload. | Compatible rollout; visible retryable failure. |
| S14 | Critical | Another vessel receives/accesses data/file. | Derived scope on every data/file path. |
| S15 | High | Older event reverses new restore/edit. | Ordering/version/conflict protection. |
| S16 | High | Separate UUID backfill creates duplicates. | Reconcile cross-system identities first. |
| S17 | High | Fresh vessel lacks masters/entry/file setup. | Provisioning and fresh-instance test. |
| S18 | High | Shared sync change breaks WO/component docs. | Existing sync regression suite. |

Adding columns alone does not complete synchronization. Identity, reference resolution, dependency ordering, change capture, files, permissions, provisioning and receiver compatibility must all be implemented and verified.

---

## 12. Acceptance checklist

These are required future tests, not tests claimed as executed.

### 12.1 UI, persistence and validation

- Create, refresh, reopen; all eight fields retained.
- Edit preserves ID/UUID/component link.
- Multiple entries show; identical society/type with different certificates remain distinct.
- Edit/delete one entry without touching another.
- Switch components/vessels without stale data.
- Test failed save, timeout retry, duplicate submission.
- New component parent exists before child save.
- Verify empty/loading/error states.
- Certificate 100 accepted, 101 rejected.
- Requirements/Information 2,000 accepted, 2,001 rejected.
- Test valid/equal/reversed/blank/impossible dates.
- Verify `DD-MM-YYYY` UI and unchanged untouched backend values.

### 12.2 Masters

- Exactly 19 societies, 46 survey types, single RINA.
- Verify all supplied codes/names/countries/categories/descriptions.
- Each society returns correct Class Code.
- Repeated names distinguishable and persist correct category/code.
- Wrong type, missing key, mismatched ID/key and inactive selection are rejected per policy.
- Seed rerun creates no duplicates.
- Existing master list admin, dropdowns and imports remain functional.
- Referenced stable codes protected from accidental mutation.
- Historical entries remain readable after master retirement.

### 12.3 Dates and colours

- Overdue, today, exactly one month red.
- After one month through exactly three months orange.
- After three months green.
- Blank has no colour.
- Test month end, Feb, leap year and timezone boundaries.
- Invalid date not silently presented as valid/green.

### 12.4 Permissions and Modify PMS

- Authorized office create/edit/delete/restore.
- Unauthorized master/entry operations fail.
- Vessel direct field writes fail through UI and API.
- Vessel upload/view/download only on allowed active entries.
- Cross-vessel/component access fails.
- Request targets exact entry; rejection does not mutate.
- Approval updates correct row and sends update to vessel.
- Deleted/stale-entry requests follow agreed conflict policy.
- Attachment delete/restore uses separately approved roles.

### 12.5 Attachments and lifecycle

- Test all six supported extensions: PDF, DOC, DOCX, XLS, XLSX, CSV.
- Reject unsupported or content-mismatched files.
- Limit succeeds; one byte over fails consistently.
- Test secure display/download behavior for every type.
- Safe filenames, private keys, authorization and same-name files.
- File/metadata failures clean up and report correctly.
- Attachment soft-delete hides, retains metadata/file.
- Parent soft-delete hides attachment access but retains data.
- Parent restore exposes active—not independently deleted—attachments.
- Deleted parent direct upload/download denied.
- Existing Section G/WO document behavior unchanged.

### 12.6 Database, audit and sync

- Inspect actual columns, defaults, FK/index constraints.
- New table includes all seven standard columns and deletion actor/time.
- Verify real creator/editor/deleter/restorer values and timestamps.
- Verify immutable creation audit, raw-SQL/upsert timestamp paths.
- Stable UUID uniqueness and parent/vessel consistency.
- Safe repeatable migrations/seeds preserve existing data.
- No physical cascade/file deletion.
- Sync identical-combination rows distinctly.
- Master IDs may differ but references resolve.
- Missing dependencies defer and recover.
- Create/edit/delete/restore deliver.
- Both directions move attachment metadata and binary; verify downloaded hash/content.
- Interrupted/repeated transfer resumes without duplicate business objects.
- Test 25 MiB across cycles and honest pending/completed status.
- Test queue source unreadable, direction config mismatch and recovery.
- Parent deletion during file transfer respects visibility.
- Older events cannot undo newer states.
- Origin audit is preserved; vessel cannot edit fields.
- Verify fresh provisioning/mixed-version plan.
- Regression-test existing master, component docs and Modify PMS sync.

---

## 13. Safe implementation sequence

1. Validate this proposal and unresolved policy choices.
2. Inspect actual development/test schema and data.
3. Confirm storage, permission, Modify PMS and sync capabilities/configuration.
4. Prepare non-destructive migrations for master extensions, entry identity/references and attachment metadata.
5. Reconcile existing cross-system entries before UUID backfill if any are present.
6. Align ORM/validators with migrations, including master `updated_at`.
7. Register types and repeatably seed 19 + 46 rows.
8. Implement backend persistence, master references, validations, scope and audit.
9. Implement multi-entry frontend, date indicators, delete and restore.
10. Implement entry-specific metadata/storage and attachment access.
11. Integrate UUID sync identity, master resolution, child ordering, field logging and file queue.
12. Integrate entry-specific Modify PMS approval and return delivery.
13. Include provisioning/mixed-version compatibility.
14. Run unit/API/integration/UI/file/sync regression checks; report only executed tests.
15. Deliver table/audit/migration/sync/test report and limitations.

This is a future implementation sequence, not work already completed.

---

## 14. Items requiring validation

| Item | Proposed direction | Validation needed |
|---|---|---|
| Master storage | Existing `master_lists`; no dedicated masters | Approve nullable metadata extension and exact type keys. |
| New tables | One attachment metadata table | Confirm existing tables cannot support entry-specific attachment association. |
| UUID column names | `ccruuid`, `ccrauuid` | Confirm project naming and stable backfill strategy. |
| Reference transport | Local ID plus stable list type/key | Confirm sync payload and receiver mapping. |
| Master snapshots | Preserve history-compatible strings/code | Choose current labels vs historical display. |
| Required fields | Preserve current business rules | Verify form indicators/legacy compatibility. |
| Date | `DD-MM-YYYY` UI only | Preserve backend/API date representation. |
| Month end | Clamp to end of target month | Confirm convention and timezone. |
| Attachment cap | Existing 25 MB; otherwise 25 MiB | Verify exact bytes and proxy/request configuration. |
| Attachment removal | Soft delete | Confirm roles and independent restore UI. |
| Master retirement | Preserve referenced historical values | Confirm retire/delete/restore policy. |
| Save consistency | Truthful transactional/recoverable save | Confirm current parent/child service pattern. |
| Delete audit | Proposed current-state fields clear on restore | Confirm existing history convention. |
| Modify PMS | Request targets Section H entry | Confirm allowed request operations and review UI. |
| Offline/retries/conflicts | Reuse existing system | Verify actual deployment behavior. |
| Mixed versions | Compatible staged rollout | Confirm release sequence and capability checks. |
| File preview | Existing secure view/download | Confirm Word/Excel require download or preview. |
| Unspecified limits | No invented record/file-count limits | Confirm any extra business/storage policy. |

Report genuine blockers; do not silently assume unavailable capabilities work.

---

## 15. Architecture-compliance and final delivery

### 15.1 Compliance statement

- The **proposed** new table includes all seven audit/tracking columns identified in the standard migration and the additional `deleted_by_uuid`/`deleted_at` requested by the supplied audit note.
- It includes stable attachment identity, entry parent FK, vessel scope and indexes.
- Existing tables are extended rather than duplicated.
- This is design-level confirmation only. Actual applied schema and live synchronization remain unverified.
- The earlier draft with three new tables and incomplete audit detail is superseded as a recommendation; it is not altered here.

### 15.2 Required implementation report

- Files changed/created.
- All tables, columns, types, defaults, constraints, indexes and relationships changed.
- Migration and seed operation, and environment where executed.
- For every new table: each audit column, purpose and population/maintenance mechanism.
- UUID and master-reference sync strategy.
- RINA resolution and seed counts.
- Master admin path and roles.
- Section H permissions and entry-specific Modify PMS workflow.
- Attachment relation, allowed formats, byte cap, storage/security.
- Metadata and binary transfer, recovery and completion status.
- Parent and attachment delete/restore behavior.
- Tests actually executed and their results.
- Functional and sync regression test results.
- Configuration, compatibility requirements and remaining limitations.
- Confirmation that no production deployment/destructive DB operation occurred.

### 15.3 What this document changed

Only this Markdown document was created. No application, database, master data, file storage or sync behavior was changed. The document is self-contained for readers without codebase access.

---

## 16. Traceability

Business inputs:

- Revised SAIL PMS Components Section H implementation requirements.
- Mandatory Audit Columns for All New Database Tables.
- Established Component UI-only `DD-MM-YYYY` requirement.
- Prior investigation of master-table architecture, attachments, permissions and office/vessel sync.

Optional repository references:

- `shared/schema.ts` — current master, Section H and document table declarations.
- `shared/schemaHelpers.ts` — update timestamp helper and limitations.
- `server/migrations.ts` — standard audit migration and schema changes.
- `server/postgresStorage.ts` — master/Section H storage and approved-change application.
- `server/modules/components/routes.ts` — existing Section H routes.
- `server/modules/components/services/subEntityService.ts` — entry access/validation.
- `server/modules/components/services/documentService.ts` — file storage and queue integration.
- `client/src/pages/pms/Components.tsx` — visible Section H first-row behavior.
- `client/src/components/ComponentRegisterAddEdit.tsx` — entry form state/save integration.
- `client/src/pages/admin/MasterListsManagement.tsx` — master-data UI.
- `server/modules/reports/services/equipmentReportService.ts` — Class Items report consumers.
- `shared/syncConfig.ts` — direction, identity, vessel scope and sync phases.
- `server/modules/sync/oneWayApplier.ts` — current matching/apply behavior.
- `server/modules/sync/service.ts` — incremental delivery/checkpoints.
- `server/modules/sync/fieldLogger.ts` — metadata change capture.
- `server/modules/sync/fileSyncProcessor.ts` — file queue, chunking, resume, storage routing.
- `server/modules/change-requests/services/changeRequestsService.ts` — supported Modify PMS targets and office-owned application.

These references are optional. Functionality, risks and the proposed schema are explained above without requiring code access.
