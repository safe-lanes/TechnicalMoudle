# PMS Component Classification & Regulatory Data
## Functionality and Backend Implementation Proposal

**Status:** Draft for user validation. No implementation, migration or database changes have been made.  
**Feature:** PMS → Components → selected component → H. Classification & Regulatory Data.  
**Purpose:** Describe the intended user-visible functionality, backend work, proposed schema changes, migration, risks and acceptance criteria before implementation is authorized.

> **Review boundary:** This document is a proposal. The “new columns” and “new tables” below have not been created or migrated. Confirm the open decisions in Section 15 before implementation.

## 1. Summary

Complete Section H as a component-specific register that lets authorized users:

- View multiple classification/survey entries for the selected component.
- Add an entry and edit an existing entry.
- Soft-delete an entry without physically removing its database row.
- Select Classification Society and Survey Type from maintained masters.
- Populate Class Code from the chosen society.
- Record Last Class Survey, Next Class Survey and certificate/details.
- Attach PDF, Word, Excel or CSV files to a specific entry, up to **25 MB per file**.
- Display survey dates as `DD-MM-YYYY` and colour-code the next survey’s urgency.

The existing application already has a `component_class_regulatory` table, generated entry IDs, a component UUID foreign key, most requested entry fields and list/create/update/delete API routes. The primary gaps found in source are that the Component Add/Edit form keeps these values only in local state, the selected-component view shows only the first record, master fields are currently free-text inputs, and the current delete implementation physically deletes a row.

This is therefore a plan to connect and complete the existing feature, not replace the entire Component Register backend.

## 2. Current implementation versus proposed work

| Area | Current source evidence | Proposed work |
|---|---|---|
| Entry storage | `component_class_regulatory` already exists. | Extend compatibly only where needed. |
| Entry ID | Auto-generated integer `id` already exists. | Reuse it; no additional entry ID is proposed. |
| Component relationship | `component_id` references `components.cuuid`. | Keep it as the authoritative association. |
| Entry fields | Society, survey type, certificate, last/next survey, requirements, class code and information are already stored. | Reuse these columns and explicitly map UI names to database names. |
| API routes | Read, create, update and delete routes already exist. | Connect/review them; enforce access checks and soft-delete behaviour. |
| Add/Edit component form | Holds H-section values in separate client state; inspected component Save payload does not persist that state. | Provide a complete entry-level create/edit workflow, not a silent unsaved section. |
| Selected component view | Fetches records and renders `classRegData[0]`. | Render all non-deleted records with individual actions. |
| Society, Survey Type, Class Code | Inspected form uses text inputs. | Master-driven selects; derive and server-validate Class Code. |
| Delete | Storage method issues SQL `DELETE`. | Change to update `is_deleted`; exclude deleted rows from normal reads. |
| Attachments | Existing component documents belong to a component, not a classification entry. | New metadata relationship to the exact classification entry. |
| Survey colouring | No requested red/orange/green next-date rule found in inspected view. | Calculate a read/display indicator, subject to boundary approval. |
| Synchronization | Class-regulatory table is registered shore-to-ship. | Preserve by default; confirm whether vessel-side writes are required. |

These are source-inspection findings, not results of a live save/delete test.

## 3. Proposed user functionality

### 3.1 Display the entry list

When a component is selected and Section H is opened:

1. Load every non-deleted classification/survey entry for that component UUID.
2. Display a separate row/card for each entry, with society, class code, category/type, certificate number, last/next survey dates, attachment count and permitted actions.
3. Show clear loading, error/retry and no-record states.
4. Display entries in a stable order. **Proposal:** next survey date ascending, with entries that have no date last.
5. Never show a record from another component or vessel merely because a business code matches.

### 3.2 Add an entry

1. Start Add Entry from the selected component’s Section H.
2. Bind the new entry to the selected component UUID.
3. Select an active Classification Society from a dropdown. Display its name/country and populate Class Code from that master.
4. Select a Survey Type from a master dropdown that shows its category, display name and unique code. Names such as “Annual Survey” repeat across categories and must remain distinguishable.
5. Enter an optional Certificate No., Last Class Survey, Next Class Survey, Class Requirements and Information.
6. Display date inputs in `DD-MM-YYYY`; validate values before sending.
7. Upload files against the new saved entry.
8. Save the entry and show the server-generated record ID’s row in Section H after success.

### 3.3 Edit an existing entry

The user confirmed that existing entries must be editable.

1. Select Edit on the specific record.
2. Load that record—not the first record for its component—and its attachments.
3. Allow authorized edits to society, Survey Type, certificate number, survey dates and free text.
4. On a society change, refresh the displayed Class Code from the selected master; the server rechecks and saves the matching master value.
5. Save only the selected entry. Do not overwrite other entries for that component.
6. Refresh the record list and retain attachments unless the user explicitly removes one.

**Proposal for historical inactive masters:** show the old value when viewing/editing a record, but require the user to select an active master before changing it.

### 3.4 Soft-delete an entry

1. Ask for confirmation identifying the selected entry.
2. Set `is_deleted = true`; update existing updater/time fields where available.
3. Hide the entry and its attachments from ordinary Section H views.
4. Retain the row and its attachment data. Do not run a SQL `DELETE` or remove stored file bytes.
5. Exclude it from normal alerts/reports unless a separately authorized audit view is designed.

No restore action is specified by the supplied requirements. **Proposal:** omit restore from the normal UI in this scope.

### 3.5 Upload and manage attachments

1. Add one or more files to a saved classification entry.
2. Accept PDF, Word (`.doc`, `.docx`), Excel (`.xls`, `.xlsx`) and CSV.
3. Limit each file to **25 MB**. **Implementation proposal:** define the precise limit as 25 MiB (`25 × 1,048,576` bytes); confirm the unit.
4. Show filename, size, upload information and permitted download/remove actions.
5. Associate each file with the classification record, not just its component.
6. Validate extension, MIME type/content and size server-side; client checks are only a usability aid.
7. On metadata save failure, remove the newly uploaded bytes or report a recoverable orphan for cleanup.
8. Removing an attachment or soft-deleting its parent hides it without permanently deleting the file under this proposal.

The current component-document flow provides a possible storage-pattern reference. It does not itself satisfy record-specific attachment association or permission requirements.

### 3.6 Survey date and urgency indicators

Always display Last Class Survey and Next Class Survey as `DD-MM-YYYY`.

The original requirement says red within one month, orange within three months and green after three months. The one-month rule takes precedence over the three-month rule.

**Proposed interpretation pending approval:**

| Next survey date relative to today | Display |
|---|---|
| Before today | Red — Overdue |
| Today | Red — Due today |
| After today through one calendar month, inclusive | Red — Due within 1 month |
| After one month through three calendar months, inclusive | Orange — Due within 3 months |
| Later than three calendar months | Green — Due after 3 months |
| Missing date | Neutral — no urgency indicator |

Use calendar-month boundaries, not a silent 30/90-day approximation. Include visible text/icon labels so colour is not the only indication. Store no calculated colour. Do not automatically change `survey_status` based on colour unless separately approved.

## 4. Field mapping and validation

### 4.1 UI, request and existing table fields

| User-facing field | Existing DB column/property | Value source |
|---|---|---|
| Certificate No. | `certificate_number` / `certificateNumber` | Free text; UI currently uses `certificateNo`, which must be mapped. |
| Classification Society | `classification_society` / `classificationSociety` | Selected society master; retain a readable snapshot. |
| Class Code | `class_code` / `classCode` | Server-derived from the chosen society. |
| Last Class Survey | `last_class_survey` / `lastClassSurvey` | Validated date. |
| Next Class Survey | `next_survey_due` / `nextSurveyDue` | Validated date; UI currently uses `nextClassSurvey`, which must be mapped. |
| Survey Type | `survey_type` / `surveyType` | Selected survey-type master; retain readable snapshot. |
| Class Requirements | `class_requirements` / `classRequirements` | Free text. |
| Information | `information` | Free text. |
| Component UUID | `component_id` / `componentId` | Server-resolved `components.cuuid`. |
| Component code / vessel | `component_code`, `vessel_code` | Resolve from the selected database component; do not trust client copies. |
| Society master | **Proposed new:** `society_master_id` | Stable FK to society master. |
| Survey type master | **Proposed new:** `survey_type_master_id` | Stable FK to survey-type master. |

Existing `issue_date`, `expiry_date`, `survey_status`, `remarks`, audit and synchronization fields are to be preserved. This scope does not add or change behaviour for them unless the user specifically approves it.

### 4.2 Validation proposal

- New or changed society/type values must resolve to active master rows.
- The server derives codes, labels/snapshots, component code and vessel code; it does not accept client-supplied values as authoritative.
- Confirm selected component exists and is in permitted vessel scope on every read and mutation.
- Reject unknown/deleted records and cross-component record IDs.
- Optional text may be blank. **Proposed default:** 2,000 characters per free-text field.
- **Proposed default:** Certificate No. up to 100 characters; otherwise permit ordinary text.
- Parse dates strictly and reject impossible calendar dates.
- **Proposal:** reject Last Class Survey later than Next Class Survey, unless a documented correction case is valid.
- Empty next date stays empty and neutral; do not fill it with today.
- Enforce file size, allowed types and access permissions at the API.
- Return user-readable validation responses; do not return stack traces or database internals.

Text limits and date-order rules are recommended defaults for review, not decisions in the original requirement.

## 5. Backend and API work

### 5.1 Existing services to extend

Start with:

- `server/modules/components/routes.ts`
- `server/modules/components/controllers/subEntityController.ts`
- `server/modules/components/services/subEntityService.ts`
- `server/modules/components/repositories/componentRepository.ts`
- `server/postgresStorage.ts`
- `shared/schema.ts`
- Existing component document/storage/file-sync services, as appropriate.

Implementation responsibilities:

1. Keep the existing component-scoped list/create/update/delete APIs if compatible with their callers.
2. Filter soft-deleted entries from normal list results.
3. Validate component and vessel access in list, create, update and delete.
4. On create/update, validate master references and derive/verify society/type/code snapshots.
5. Change delete from physical removal to `is_deleted = true`, with updater/time audit.
6. Prevent updates through an entry ID that belongs to another vessel/component.
7. Add master read APIs; add authorized master-management APIs only if administration of these lists is in scope and no compatible existing endpoints are available.
8. Add entry-specific attachment list/upload/download/soft-delete APIs.
9. Enforce request/body schemas, error responses and size/type limits server-side.
10. Use transaction/cleanup boundaries so a failed metadata insert does not silently leave a newly uploaded file untracked.
11. Refresh/invalidate the component’s Section H data after successful mutations.

Exact new paths are provisional: first reuse or align with existing route conventions and avoid registering duplicate endpoints.

### 5.2 Access and authorization

In inspected code, class-regulatory reads use authentication and mutations use a PMS-admin route guard for create/update. The delete route does not show the same route guard; the current delete service also does not receive the caller for an access check.

Proposed:

- Pass authenticated user context through every mutation, including delete and attachment operations.
- Enforce configured permission and component/vessel scope at the API, not only by hiding UI controls.
- Resolve `created_by`, component UUID/code and vessel code on the server.
- Apply the same explicit permission policy to deleting as to editing.
- Gate attachment download by record/component/vessel access.
- Confirm if authorized Ship users must write records or if mutations remain shore/PMS-admin-only.

Review actual deployed identity/role behaviour before claiming any role is securely authorized. Current route guards should not be presumed to represent every deployment’s production permissions.

### 5.3 Illustrative create request

```json
{
  "componentId": "<selected component cuuid>",
  "societyMasterId": 1,
  "surveyTypeMasterId": 4,
  "certificateNumber": "CERT-12345",
  "lastClassSurvey": "15-Oct-2026",
  "nextSurveyDue": "15-Oct-2027",
  "classRequirements": "Inspect the listed items at the next survey.",
  "information": "Optional notes"
}
```

Illustrative only. The server resolves the component and master rows and derives `componentCode`, `vesselCode`, society/type snapshots and `classCode`. Final API date representation must be specified separately from the UI’s `DD-MM-YYYY` presentation.

## 6. Proposed database/schema changes

The proposal below is conditional. Check existing migrations and generic master APIs/tables before adopting it. No migration is included in this document.

### 6.1 Existing `component_class_regulatory` table

Already present:

- `id`: generated integer primary key.
- `component_id`: required FK to `components.cuuid`.
- `component_code`, `vessel_code`.
- `classification_society`, `survey_type`, `certificate_number`.
- `issue_date`, `expiry_date`, `last_class_survey`, `next_survey_due`.
- `class_requirements`, `class_code`, `information`, `survey_status`, `remarks`.
- Creation/update/sync fields and `is_deleted`.

**Proposed new columns:**

| Property | SQL column | Proposed type | Constraint / purpose |
|---|---|---|---|
| `societyMasterId` | `society_master_id` | Integer | Nullable FK to society master while legacy values are backfilled; required in new writes. |
| `surveyTypeMasterId` | `survey_type_master_id` | Integer | Nullable FK to survey-type master while legacy values are backfilled; required in new writes. |

**Retain the existing society/type/code text columns** as history-compatible readable snapshots and for compatibility with existing code/sync. New application writes must derive them from the master IDs. Do not add another component UUID or another entry ID.

Backfill references only on an unambiguous match. Do not guess mappings for unknown values or the duplicate RINA code. Keep unmatched legacy entries readable and flag them for explicit review.

### 6.2 Proposed new `classification_society_master` table

| Column | Type | Purpose / rule |
|---|---|---|
| `id` | Integer identity primary key | Stable FK target |
| `society_name` | Text, required | Display name |
| `society_code` | Text, required | Stable code; unique only after duplicate/alias issue is resolved |
| `country` | Text, required | Country shown with society |
| `is_active` | Boolean, default true | Inactive values cannot be selected for new entries |
| `display_order` | Integer, default 0 | Stable dropdown order |
| `created_at` | Timestamp, server default | Seed/audit time |
| `updated_at` | Timestamp, nullable/managed | Update time |
| `created_by_uuid` | Text, nullable | Actor if available |
| `updated_by_uuid` | Text, nullable | Actor if available |
| `is_sync` | Boolean | According to chosen sync model |

Proposed indexes: primary key, normalized/unique society code, and active/display-order query index. Society name uniqueness needs a business decision if aliases are permitted.

### 6.3 Proposed new `survey_type_master` table

| Column | Type | Purpose / rule |
|---|---|---|
| `id` | Integer identity primary key | Stable FK target |
| `survey_category` | Text, required | Class, Statutory, Flag State, Port State, ISM, ISPS, MLC or Other |
| `survey_type_name` | Text, required | Display name; can repeat in another category |
| `survey_code` | Text, required, unique | Stable identifier |
| `description` | Text, nullable | Supplied explanation |
| `is_active` | Boolean, default true | Prevent selecting inactive items for new entries |
| `display_order` | Integer, default 0 | Stable ordering |
| `created_at` | Timestamp, server default | Seed/audit time |
| `updated_at` | Timestamp, nullable/managed | Update time |
| `created_by_uuid` | Text, nullable | Actor if available |
| `updated_by_uuid` | Text, nullable | Actor if available |
| `is_sync` | Boolean | According to chosen sync model |

Proposed indexes: primary key, unique survey code, category index and active/display-order index.

### 6.4 Proposed new `component_class_regulatory_attachments` table

| Column | Type | Purpose / rule |
|---|---|---|
| `id` | Integer identity primary key | Attachment metadata ID |
| `class_regulatory_id` | Integer, required FK | Parent classification entry; index this column |
| `file_name` | Text, required | Safe display filename |
| `file_key` | Text, required | Private storage key; not an authorization token |
| `content_type` | Text, required | Server-validated MIME/content |
| `file_size` | Integer, required | File size in bytes; max 25 MB per file |
| `storage_backend` | Text | Existing object/local storage pattern |
| `uploaded_by` | Text, required | Server-derived actor |
| `uploaded_at` | Timestamp, server default | Upload time |
| `is_deleted` | Boolean, default false | Soft-delete attachment metadata |
| `is_sync` | Boolean | Only if supported by approved sync design |
| `created_by_uuid` | Text, nullable | Actor UUID if available |
| `updated_by_uuid` | Text, nullable | Actor UUID if available |

Proposed indexes: primary key, parent foreign-key index and deleted-state index. Do not enforce unique filenames; repeated file names can be valid.

Parent/component/vessel authorization should be resolved through the parent classification entry and component relationship. Only add duplicate component/vessel snapshot fields if an approved file-sync protocol requires them.

### 6.5 Proposed schema-change count

Under the dedicated-master proposal:

- **2 nullable foreign-key columns** on the existing classification table.
- **3 new tables**: society master, survey-type master and classification attachment metadata.
- Foreign keys, indexes and sync configuration/registration only where the selected deployment/sync design requires them.
- Seed **20 society master rows and 46 survey-type master rows** from the provided plan after review.

No new entry ID or component UUID column is proposed. The existing `is_deleted` column can implement entry soft deletion. A new `deleted_at` column is optional and should be added only if an audit requirement demands a deletion-specific time separate from `updated_at`.

### 6.6 Generic master-list alternative

The project has `master_lists` and `master_list_types`; `master_lists` provides `list_type`, `list_key`, `list_value`, display order and lifecycle/sync fields. It does not provide dedicated country and survey-category/description fields in its inspected schema.

Before adding new tables, check if existing master services support these extra fields cleanly. If the generic master list is used, document exactly where society country, survey category and survey description are stored and how uniqueness is validated. Do not create a second competing master system or assume the generic list is sufficient.

## 7. Master rows to seed

The following values come from the supplied plan. Treat the codes/entries as proposed seed data pending domain-owner confirmation. Seeds must be repeatable and must not create duplicates on a rerun.

### 7.1 Classification Societies (20 supplied rows)

| Society | Code | Country |
|---|---|---|
| American Bureau of Shipping | ABS | USA |
| Bureau Veritas | BV | France |
| China Classification Society | CCS | China |
| DNV | DNV | Norway |
| Lloyd's Register | LR | United Kingdom |
| Korean Register | KR | South Korea |
| Nippon Kaiji Kyokai (ClassNK) | NK | Japan |
| RINA | RINA | Italy |
| Indian Register of Shipping | IRS | India |
| Polish Register of Shipping | PRS | Poland |
| Croatian Register of Shipping | CRS | Croatia |
| Russian Maritime Register of Shipping | RS | Russia |
| Türk Loydu | TL | Türkiye |
| Hellenic Register of Shipping | HRS | Greece |
| Registro Brasileiro de Navios | RBNA | Brazil |
| International Register of Shipping | IRS-US | USA |
| Korean Ship Safety Technology Authority | KST | South Korea |
| Maritime Bureau of the Ministry of Land, Infrastructure, Transport and Tourism | MLIT | Japan |
| Registro Italiano Navale | RINA | Italy |
| Spanish Maritime Register / Bureau Veritas Spain | BV-ES | Spain |

**Data conflict:** RINA and Registro Italiano Navale have the same code and country. Confirm whether one is an alias/duplicate or a genuinely distinct master with an approved distinct code. Do not seed both under a unique-code constraint or silently invent a corrected code.

### 7.2 Survey Types (46 supplied rows)

The source plan includes descriptions; preserve those descriptions when seeding, along with the category/type/code below. If a shorter seed summary disagrees with the attachment, the attachment is the content authority pending user review.

| Category | Type | Code |
|---|---|---|
| Class | Initial Survey | CLS-INI |
| Class | Annual Survey | CLS-ANN |
| Class | Intermediate Survey | CLS-INT |
| Class | Special Survey | CLS-SPC |
| Class | Renewal Survey | CLS-REN |
| Class | Continuous Survey | CLS-CON |
| Class | Occasional Survey | CLS-OCC |
| Class | Damage Survey | CLS-DMG |
| Class | Repair Survey | CLS-RPR |
| Class | Modification Survey | CLS-MOD |
| Class | Additional Survey | CLS-ADD |
| Class | Docking Survey | CLS-DCK |
| Class | In-Water Survey | CLS-IWS |
| Class | Bottom Survey | CLS-BTM |
| Statutory | Initial Survey | STT-INI |
| Statutory | Annual Survey | STT-ANN |
| Statutory | Intermediate Survey | STT-INT |
| Statutory | Periodical Survey | STT-PER |
| Statutory | Renewal Survey | STT-REN |
| Statutory | Additional Survey | STT-ADD |
| Statutory | Occasional Survey | STT-OCC |
| Flag State | Initial Survey | FLG-INI |
| Flag State | Annual Survey | FLG-ANN |
| Flag State | Intermediate Survey | FLG-INT |
| Flag State | Renewal Survey | FLG-REN |
| Flag State | Additional Survey | FLG-ADD |
| Port State | PSC Inspection | PSC-INS |
| ISM | Initial Verification | ISM-INI |
| ISM | Annual Verification | ISM-ANN |
| ISM | Intermediate Verification | ISM-INT |
| ISM | Renewal Verification | ISM-REN |
| ISPS | Initial Verification | ISP-INI |
| ISPS | Intermediate Verification | ISP-INT |
| ISPS | Renewal Verification | ISP-REN |
| ISPS | Additional Verification | ISP-ADD |
| MLC | Initial Inspection | MLC-INI |
| MLC | Intermediate Inspection | MLC-INT |
| MLC | Renewal Inspection | MLC-REN |
| MLC | Additional Inspection | MLC-ADD |
| Other | Condition Survey | OTH-CON |
| Other | Pre-Purchase Survey | OTH-PPS |
| Other | On-Hire Survey | OTH-ONH |
| Other | Off-Hire Survey | OTH-OFH |
| Other | Bunker Survey | OTH-BNK |
| Other | Damage Survey | OTH-DMG |
| Other | Other Survey | OTH-OTH |

Seed counts: Class 14, Statutory 7, Flag State 5, Port State 1, ISM 4, ISPS 4, MLC 4, Other 7; **46 total**. Duplicate display names are expected; survey code/master ID must distinguish the selected row.

## 8. Attachments, storage and synchronization

### 8.1 Storage

Reuse the established private object/local storage approach where suitable, but add a separate metadata association to `class_regulatory_id`. Keep file keys private. Validate upload size before buffering/writing where the upload stack supports it.

Use an atomic/recoverable sequence:

1. Validate authenticated user, parent record and vessel/component scope.
2. Validate extension, content and file limit.
3. Store bytes.
4. Insert attachment metadata.
5. If step 4 fails, delete uploaded bytes or record an explicit cleanup failure for retry.

Download rechecks parent record and scope; a guessed ID or key is not permission.

### 8.2 Shore/vessel sync

Current `component_class_regulatory` registry entry is **shore-to-ship**. Proposed default is to preserve that ownership: office/PMS admins edit; vessel side reads. This is consistent with current registry but **must be confirmed** if vessel users are expected to create/edit/delete.

If vessel mutations are required, re-plan explicit direction, conflict ownership, offline/master availability, IDs, attachments and review policy before enabling writes. Merely registering an attachment table or uploading a file does not prove its metadata/content will sync.

The existing file sync processor should be inspected and extended only under the chosen policy. Exclude soft-deleted records from ordinary reads while preserving the sync/audit evidence required for deletion replication.

## 9. Migration and rollout

1. Check ordered migrations and target schemas for existing master/API alternatives and deployed schema drift.
2. Confirm the open decisions in Section 15 and approve the master seed list.
3. Add a migration for accepted master tables, attachment metadata and the two nullable references/indexes on `component_class_regulatory`.
4. Seed masters idempotently.
5. Backfill only unambiguous legacy matches. Report ambiguous/unmatched records for review.
6. Keep old text snapshots and read support while any legacy rows lack master references.
7. Require valid master IDs for new writes; keep old rows readable under an explicit legacy-edit rule.
8. Verify attachment permissions, storage cleanup and the approved office/vessel behaviour in a non-production environment.
9. Consider making reference fields non-null only in a later migration after backfill and operational verification.
10. Follow repository migration safeguards. Do not use `db:push` on the existing database.

Rollback must not silently discard uploaded user files or delete existing classification records.

## 10. Areas needing attention

| Risk/decision | Why it matters | Proposed handling |
|---|---|---|
| Society code conflict (`RINA`) | Unique master code/index and legacy backfill become ambiguous. | Domain owner decides canonical row/alias/code before seeding. |
| Repeated Survey Type labels | “Annual Survey” is not unique across categories. | Persist master ID/unique code; show category and code. |
| UI/backend naming mismatch | `certificateNo` vs `certificateNumber`; `nextClassSurvey` vs `nextSurveyDue`. | Explicit map in both read and write flows; test round trip. |
| Component tree IDs | Visible tree `id` can be component code, while the database relationship is UUID. | Pass/resolve canonical `cuuid` on the server; verify selected node mapping. |
| First record only | Multiple records are supported by backend but hidden in view. | List all non-deleted entries and edit the selected row by its ID. |
| Physical deletion | Conflicts with requested retention and destroys history. | Soft-delete entry and attachment metadata; no physical deletion. |
| Parent component Save | Current save payload excludes Section H local state. | Independent record save or explicit integrated save; no silent partial save. |
| Attachment relationship | Component-level documents do not identify their applicable survey entry. | New parent-record attachment metadata. |
| 25 MB upload | Client-only limit can be bypassed and large in-memory uploads risk resource exhaustion. | Enforce server/upload middleware cap before storage; decide 25 MB vs MiB. |
| Vessel authorization | UI filtering alone is not sufficient; delete lacks equivalent visible guard. | Check permission + parent component/vessel on every mutation/download. |
| Master lifecycle | Deleting a master can break existing records. | Deactivate; preserve snapshots and historical master IDs. |
| Date boundary/time zone | Inclusive month thresholds can differ at month ends or around UTC. | Approve calendar-month/business-date rule and test exact boundaries. |
| Text date compatibility | Existing data is stored as text and uses older formats. | Parse/format in UI; preserve established backend representation. |
| Sync and files | Current class records are shore-to-ship; new writes/files may not follow automatically. | Confirm ownership and file synchronization before enabling ship edits. |
| Uploaded plan data accuracy | Master list is proposed data, including aliases/agency naming. | Domain-review before authoritative seeding. |

## 11. Permissions and data integrity

- Use generated entry ID and component UUID; do not use component code as a globally unique key.
- Resolve component, vessel and master fields on the server.
- Enforce permissions on API routes/services for list, create, edit, delete, upload and download.
- On ship, validate selected component belongs to the caller’s vessel.
- On soft delete, preserve row and set audit update information. Existing `updated_by` / `updated_at` may suffice; a new `deleted_at` is optional and should have a clear purpose.
- Do not cascade-delete children, master rows, component records or stored files.
- Do not select inactive masters for a new entry; keep historical display values.
- Keep class/survey text snapshots readable if the master is renamed or deactivated.
- Make master seeds repeatable.
- Keep attachment object keys private and avoid filenames as authorization keys.
- Avoid logging file contents, sensitive information or credentials.

## 12. Acceptance criteria

### Component and record workflow

1. Section H displays all and only non-deleted rows for the selected component UUID.
2. A user with permission can add an entry; the generated record ID is returned and the row survives refresh/reopen.
3. Selecting another component or vessel shows only that component’s records.
4. A user can edit one chosen record without changing sibling entries.
5. Delete marks that record `is_deleted = true`; it disappears from ordinary view but remains stored.
6. Existing records without new master references remain viewable; their edit behaviour is explicitly defined and tested.
7. Component Create/Edit cannot report success while silently discarding entered classification data.

### Master and dates

8. Society options show the approved name and country.
9. Class Code comes from the selected society on both client display and server save.
10. Survey options show category, name and unique code; repeated names remain distinct.
11. Inactive masters cannot be newly selected; referenced values cannot be hard-deleted.
12. `DD-MM-YYYY` date display round-trips existing data without altering other backend conventions.
13. Today/overdue/month-boundary/later/missing dates display the approved indicator with accessible text.
14. Invalid dates and any approved date-order error are rejected on the server.
15. RINA duplicate and all seed rows receive domain-approved, repeatable handling.

### Attachments, access and sync

16. PDF, Word, Excel and CSV uploads up to the confirmed per-file cap succeed; unsupported or oversized files fail clearly.
17. Uploads are linked to the exact classification record and downloadable only by an authorized user in its vessel scope.
18. A metadata write failure cleans up stored file bytes or records a recoverable orphan.
19. Entry/attachment soft deletion hides records but retains metadata/files according to policy.
20. Every read/write/download enforces authorization and vessel/component scope server-side.
21. Ship/shore behaviour and attachment transfer match the explicitly approved ownership design.

### Regression

22. Component tree, component detail, existing component documents and unrelated date fields still work.
23. No accidental changes to unrelated masters, reports, Work Orders or sync behaviours.

## 13. Test plan

After scope approval, add:

- Service tests for master lookup/snapshots, legacy records, dates, soft deletes, component/vessel scope and file limits.
- API tests for every permission path, cross-vessel ID, missing/deleted row, validation and storage failure.
- Repository tests for all-record listing, update isolation, and persistent soft deletion.
- UI tests for multiple entries, add/edit/delete, selected-record loading, dropdowns, errors/empty/loading, date format/colour boundaries and attachment limit/errors.
- Migration and repeatable-seed tests.
- Sync tests only for approved direction and attachment delivery.
- Manual non-production verification with two components in separate vessels, legacy data, multiple records, every date boundary, deleted record, file-size boundary and authorized/unauthorized roles.

No application/test run is represented as completed by this specification.

## 14. Proposed implementation sequence

1. Resolve open decisions and approve master seed content.
2. Confirm deployed schema/migration conventions and existing master/attachment services.
3. Implement additive database migration, indexes and idempotent seed.
4. Implement repository/service/API validation, permissions, soft delete and attachments.
5. Implement master selection, record list/edit actions, date indicator and file UI.
6. Extend synchronization/file delivery only as approved.
7. Add tests, perform non-production migration and acceptance walkthrough.
8. Roll out and monitor read/write/file/sync errors; leave ambiguous legacy references identifiable.

## 15. Decisions for validation

| Decision | Current proposal | Status |
|---|---|---|
| Existing entries must be editable | Yes; user confirmed | Confirmed |
| Multiple entries per component | List every entry; one row edited at a time | Implied by per-entry ID and confirmed edit request |
| Per-file attachment cap | 25 MB | Confirmed; binary vs decimal unit to define |
| Society and Survey Type storage | Dedicated typed master tables unless existing master infrastructure fits all required fields | Proposed; inspect/approve |
| RINA duplicate | Canonical row plus approved alias, or domain-approved distinct code | Needs domain decision |
| Date thresholds | Calendar months; overdue/today red; missing neutral; boundaries inclusive | Proposed |
| Last survey later than next survey | Reject | Proposed; confirm valid correction cases |
| Text-length limits | 2,000 chars free text; 100 chars certificate | Proposed |
| Master administration UI | Existing Master Data area, if suitable | Proposed |
| Add/Edit permissions | Preserve/refine current PMS-admin policy | Needs role confirmation |
| Ship-side writes | Preserve current shore-to-ship policy unless user requires vessel mutation | Needs explicit confirmation |
| Attachment removal and parent deletion | Soft-delete metadata; retain stored bytes | Proposed |
| Restore soft-deleted entry | No ordinary restore in initial scope | Proposed |
| File sync | Only implement after owner/direction is confirmed | Needs explicit confirmation |

## 16. Files checked

The implementation review should begin with these existing sources:

- `client/src/pages/pms/Components.tsx`
- `client/src/components/ComponentRegisterAddEdit.tsx`
- `server/modules/components/routes.ts`
- `server/modules/components/controllers/subEntityController.ts`
- `server/modules/components/services/subEntityService.ts`
- `server/modules/components/services/documentService.ts`
- `server/modules/components/repositories/componentRepository.ts`
- `server/postgresStorage.ts`
- `shared/schema.ts`
- `shared/syncConfig.ts`
- `attached_assets/Plan_1791960563406.docx`

## 17. Explicitly not done

- No application source code was modified.
- No table, column, index, master row or migration was created or run.
- No component/classification record or attachment was changed.
- No permissions, shore/vessel ownership or synchronization direction was changed.
- No project database was queried or modified for this document.

**End of proposal — implementation should begin only after the user validates this scope and the open decisions.**
