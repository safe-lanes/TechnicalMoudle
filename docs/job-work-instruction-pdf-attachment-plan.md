# Job Form Work Instructions — Vessel Job PDF Attachment Plan

**Status:** Updated proposed plan for review; no feature implementation or migration has been performed.
**Scope:** Vessel-scoped PMS Jobs only. Fleet Jobs are explicitly out of scope.

## 1. Purpose

Make the vessel Job's **Work Instructions** dialog useful by providing:

1. A **PDF Attachments** section for manuals and work-instruction files managed on vessel-specific Jobs.
2. A visible **Feature Coming Soon** section, clearly marked as not yet available and with no active controls.

The vessel Job is the source of truth for its active PDF links. A vessel-level PDF file may be linked to multiple vessel Jobs without creating duplicate file assets. Files must be stored privately and synchronized with their metadata and bytes to the applicable vessel installation. Work Orders show the latest active files from their linked Job, read-only.

## 2. Current implementation and findings

### User interface

- The Job Form route is `/pms/job/:id`.
- The Work Instructions dialog currently receives only `isOpen` and `onClose`. It does not receive the Job ID or any attachment data/callbacks.
- The dialog currently renders static example headings and steps. It has no working add, save, upload, list, open, or remove behavior.
- The shared dialog is also used by Work Order forms. Upload/manage controls belong to the **Job Form**; Work Orders receive only the separately confirmed read-only view of the current Job attachments. Existing Work Order-owned document actions must not change.
- The existing Jobs bulk-import template and service must be extended with a `Job attachments` column. Its filename value refers to a PDF in the selected vessel's controlled private folder; the import must not accept arbitrary filesystem paths from a spreadsheet.

### Existing data model

- The `jobs` table has a canonical, unique `juuid`, and a `vesselId`. Its `jobNo` is explicitly not globally unique, so `jobNo` alone is not a safe document owner key.
- No Job-specific document table or document field was found in the current `jobs` schema.
- `work_order_documents` stores files owned by a Work Order (`workOrderId`) and is not a Job attachment table.
- `work_orders.uploaded_documents` is for Work Order execution documents, not Job master files.
- `component_documents` belongs to a component. It is not an appropriate substitute for a Job document, particularly because jobs can have component links.
- An older `initDb.ts` work-order table definition contains a `work_instructions` text field. That is Work Order data, not a Job PDF attachment relationship.

### Existing file mechanism

The Work Order document service is the closest implementation reference. It uses in-memory multipart upload, validates files, stores them in private object storage where configured, and has a local filesystem fallback. Its current supported upload types include PDF and other formats, with a 25 MB limit. Those rules are not automatically suitable for this feature; the proposed Job endpoint should accept PDFs only.

The existing Work Order API has document list, upload, download, and delete routes, but all operations are scoped to a Work Order. They should be used as an implementation pattern, not pointed at a Job.

## 3. Functional requirements

### 3.1 Opening Work Instructions

- The dialog receives the canonical Job identity and vessel context from the Job Form.
- Load the active Job-to-file links for that Job and vessel. The Work Instructions list must not show another Job's links or another vessel's files.
- Show loading, empty, and recoverable error states. A retrieval failure must not be presented as an empty attachment list.
- An unsaved Job must be saved first. Disable upload, attach, and import-link actions until the Job has its canonical `juuid`; explain why.

### 3.2 Uploading and reusing a PDF

- Office users with Job edit rights can upload a PDF from the vessel Job's Work Instructions dialog.
- Accept PDF files only. Validate extension, MIME type, and (where practical) the PDF signature on the server. Enforce a server-side size limit; the existing Work Order 25 MB limit is only a reference and is not approved for this feature.
- A physical file name is unique within a vessel. Do not create a second file asset with a duplicate active name for that vessel.
- If the vessel file already exists, allow an authorized user to attach that existing file to another Job. Reuse its document ID and bytes; do not upload or store a duplicate copy.
- Generate an immutable document ID and derive the private storage key on the server. Sanitize the original filename and reject path traversal, path separators, and unsafe names.
- If metadata or Job-link creation fails after file storage, clean up or quarantine the unreferenced file and report the failure; do not leave an invisible orphan.
- A simple optional revision/remarks field may document the reason or revision without introducing a full version-control feature.

### 3.3 Jobs Bulk Import

- Add a `Job attachments` column to the Jobs import template and field-mapping guide.
- The value contains one or more PDF filenames, not paths or URLs. The exact multi-filename delimiter/encoding is an open implementation detail and must be documented in the template.
- Resolve each filename only within the selected vessel's controlled private Job-document folder. Validate the vessel, file existence, PDF content, filename, and size on the server.
- For an existing vessel file, create a link to that file for the imported Job. Store the physical file only once, even when several Jobs reference it.
- A missing, ambiguous, invalid, or duplicate-new-file name must produce a row-level import error with a clear reason. Do not silently skip an attachment or commit an invalid partial link.
- Import must be idempotent: retrying the same row must not create duplicate Job links or file assets.

### 3.4 Opening and downloading

- Office and vessel users may view and open active files when they have access to the vessel Job. Vessel users are read-only.
- Retrieve a file by document ID through an authenticated application endpoint after validating the user's vessel access, the Job-to-file link, and active state.
- Return the correct PDF content type and safe inline/download headers. Do not expose a permanent public object URL.
- The client must never supply a filesystem path or object-store key.

### 3.5 Removing, restoring, and replacing a Job attachment

- Only office users with Job edit rights may upload, remove, or restore Job-to-file links. Vessel users may only view and open files.
- Removing a file from a Job soft-deletes that **Job-to-file link only**. If the shared vessel file is linked to other Jobs, it remains active and visible from those Jobs.
- Provide an authorized restore action for the soft-deleted link. Record the removal and restoration in the audit fields and synchronize both events.
- Replacement is not an in-place overwrite. Upload or select a distinct file, link it to the Job, and soft-delete the old link for that Job. Do not change links on other Jobs that use the old file. If the old asset has no remaining active links, retain it for restoration/audit according to the approved retention policy.
- Do not physically delete file bytes as part of removing one Job link. Any later orphan cleanup/purge must be a separate, auditable retention process.

### 3.6 Work Order visibility

- Every Work Order generated from a vessel Job displays that Job's active PDFs as read-only, accessed through the canonical Job link.
- Existing and open Work Orders always show the latest active PDF links on their Job; do not snapshot the file list at WO creation and do not copy the files into `work_order_documents`.
- Adding, removing, restoring, or replacing a Job link is reflected on all Work Orders linked to that Job. Changes do not affect Work Orders from other Jobs, even when those Jobs share the same vessel file.
- This display is a Job-document view only. Existing Work Order upload, edit, and document behavior remains unchanged.

### 3.7 Coming Soon section

- Keep **Feature Coming Soon** visible in the dialog and clearly label it as unavailable.
- Do not show active controls in this section until separate functionality is approved.

## 4. Proposed database structure

Because one vessel file may be linked to multiple Jobs, a single table with a required `job_id` on each file row would duplicate file metadata or bytes. Use a normalized vessel-file asset plus Job-association model. These are **new table proposals**, not existing tables; final names should follow repository conventions.

### 4.1 Vessel Job-document file asset

One row represents one physical PDF file for a vessel, independent of how many Jobs use it.

| Proposed column | Purpose |
|---|---|
| `id` | Unique immutable document ID; generate on the server. |
| `vessel_id` | Required vessel UUID FK and scope key for lookup, authorization, uniqueness, and sync. |
| `file_name` | Original/safe display filename, including the `.pdf` extension. |
| `normalized_file_name` | Server-derived comparison key for enforcing one active file name per vessel; normalization rules remain to be finalized. |
| `file_key` | Private storage key; never a public URL or client-supplied path. |
| `content_type` | Server-validated content type; `application/pdf`. |
| `file_size` | Validated size in bytes. |
| `storage_backend` | Identifies the configured private storage backend. |
| `uploaded_by`, `uploaded_at` | Server-derived uploader identity and upload time. |
| `revision_remarks` | Optional short revision/document-control note; not a full versioning system. |
| Audit/sync columns | Apply the same finalized audit and sync column set used by `component_class_regulatory_attachments`. |

### 4.2 Job-to-file association

One row links a vessel Job to a vessel file. This is the record removed/restored when a file is detached from one Job.

| Proposed column | Purpose |
|---|---|
| `id` | Unique immutable association ID. |
| `job_id` | Required FK to canonical `jobs.juuid`. |
| `document_id` | Required FK to the vessel-file asset. |
| `vessel_id` | Required sync/scope value; must match both the Job and the file asset. |
| `is_deleted` | Soft-delete state for this Job link; does not retire a shared asset used by other Jobs. |
| Audit/sync columns | Apply the same finalized audit and sync column set used by `component_class_regulatory_attachments`. |

### Audit and scope requirements

The new table(s) must use the **same finalized audit/sync column set** as `component_class_regulatory_attachments`. The required audit concepts include:

- `created_by`, `created_at`
- `updated_by`, `updated_at`
- `is_deleted`, `deleted_by`, `deleted_at`
- The reference table's actor UUID and sync-tracking fields, including `created_by_uuid`, `updated_by_uuid`, and `is_sync` where required by the finalized standard
- File-specific `uploaded_by` and `uploaded_at` on the vessel-file asset

Use the exact approved column names, SQL types, nullability, defaults, and update utilities from the finalized PMS standard. The reference attachment table is currently described in a proposal rather than found in the active schema; its proposal excerpt does not list every mandatory audit concept above. Before migration, compare the authoritative finalized column list with the project's mandatory audit-column standard and resolve any discrepancy. Do not omit required columns because a proposal excerpt is incomplete.

Populate actor fields from authenticated identity and timestamps from the server/database. A link removal/restore updates the association's deletion and audit fields. Do not mark an asset deleted while any active Job link references it. An asset with no active links may be soft-deleted and retained for restoration/audit; physical purge requires a separate approved retention policy.

### Constraints and indexes to consider

- Foreign key from the association `job_id` to `jobs.juuid`; foreign keys from both tables to the canonical vessel UUID and from the association to the file asset.
- Validate that the Job is vessel-scoped and `jobs.vessel_id` matches both the association and asset `vessel_id`; reject Fleet Jobs and cross-vessel links.
- Enforce one active physical file per normalized filename within a vessel, while allowing that same asset to be linked to many Jobs.
- Enforce one active association for a given `(job_id, document_id)`; do not impose filename uniqueness on association rows.
- Index assets by `(vessel_id, normalized_file_name, is_deleted)` and associations by `(job_id, vessel_id, is_deleted)` and by `document_id`.
- Ensure one storage key maps to one asset record. All ordinary Job and Work Order views exclude soft-deleted associations.
- Restore must detect a conflicting active association or filename and return a clear error rather than creating duplicates.

## 5. Proposed private file layout

The exact private object root is environment-configured and is not a literal path in the repository. The current Work Order implementation uses `PRIVATE_OBJECT_DIR` for object storage and `.private/wo-docs` as its local fallback. Do not assume the configured bucket/root value; confirm it through the approved environment configuration process before implementation.

The agreed folder policy is a shared private folder per vessel, named with the stable vessel UUID (or an approved immutable vessel code) and **no vessel-name suffix**. Do not create a per-Job folder: a physical file must have one vessel-scoped location so several Jobs can reference it.

```text
<PRIVATE_OBJECT_DIR>/
    job-docs/
        <vessel-uuid-or-immutable-code>/
            <safe-filename>.pdf
```

Example shape only:

```text
<PRIVATE_OBJECT_DIR>/job-docs/<vessel-uuid>/pump-overhaul.pdf
```

The vessel identifier and filename are illustrative, not actual values or a confirmed storage root. The document UUID remains in metadata; the physical file is not duplicated or placed in a Job-specific subfolder.

If the local fallback is used, the proposed corresponding layout is:

```text
<project-root>/.private/job-docs/
    <vessel-uuid-or-immutable-code>/
        <safe-filename>.pdf
```

The exact private root is environment-configured and must be confirmed through the approved configuration process. The vessel folder is also the controlled file-drop/lookup area for Jobs Bulk Import. It must be persistent and accessible to the import process; do not rely on an ephemeral per-process directory. Normalize the filename to prevent path traversal and unsafe names. The spreadsheet supplies a filename only; the server derives the folder and `file_key`. If the configured object-storage backend cannot support direct folder drops, provide an approved controlled staging/import mechanism that preserves the same vessel scoping and validation.

## 6. Proposed API and backend responsibilities

There is currently no Job-document endpoint. Add Job/file-association endpoints following existing route conventions, for example:

| Proposed route | Responsibility |
|---|---|
| `GET /technical/api/jobs/:jobId/documents` | Return the Job's active file links and metadata after resolving the canonical Job and verifying vessel/user access. |
| `POST /technical/api/jobs/:jobId/documents/upload` | Accept a new PDF, validate it, create/reuse a vessel asset as allowed by filename rules, link it to the Job, and queue metadata plus file sync. |
| `POST /technical/api/jobs/:jobId/documents/link` | Link an existing active vessel file asset to this Job without duplicating its bytes. |
| Existing Jobs bulk-import route | Read `Job attachments`, resolve filenames within the selected vessel folder, and create idempotent Job links with row-level errors. |
| `GET /technical/api/job-document-assets/:documentId/open` | Authorize through the requested Job link and vessel, then stream the PDF privately for viewing. |
| `GET /technical/api/job-document-assets/:documentId/download` | Optional download endpoint with safe filename headers. |
| `DELETE /technical/api/job-document-links/:linkId` | Soft-delete only this Job association and queue the link deletion for sync. |
| `POST /technical/api/job-document-links/:linkId/restore` | Restore a permitted Job association, subject to duplicate and vessel checks. |

These are proposed names; route naming should follow the final API design. Backend responsibilities include:

1. Resolve legacy route IDs to the canonical `jobs.juuid`.
2. Reject missing, inactive/unauthorized, Fleet-scoped, or mismatched-vessel Jobs as appropriate to the PMS policy.
3. Enforce the role rules: office users with Job edit rights may upload, link, remove, and restore; vessel users may only list and open files.
4. Enforce that the asset, Job, association, and request vessel all match. Reject duplicate new vessel filenames; permit reuse of one active asset by multiple Jobs.
5. Validate PDF type, size, normalized filename, and file content on the server. For bulk import, resolve a filename only in the selected vessel folder and never treat spreadsheet content as a path.
6. Create one private asset row and one Job-link row as needed. Use transactions or cleanup/quarantine handling so failed records do not leave invisible files or broken links.
7. Apply the same finalized audit/sync fields as the reference attachment standard, with authenticated actor identity and server/database timestamps.
8. Soft-delete and restore the association, not a shared asset that remains linked elsewhere. Keep a restore/audit trail and make retries idempotent.
9. Return metadata only from list requests; stream or download the PDF only from a separately authorized endpoint.
10. Make Job attachment metadata available to Work Orders through the Job relationship, always selecting current active links rather than copying a stale list.

## 7. Sync requirements

Sync is part of the feature scope, not an optional later enhancement.

Both of the following must reach the applicable vessel:

1. **Vessel-file asset metadata** — including document ID, vessel ID, private storage reference/backend, filename, content type/size, revision remarks, audit data, and asset state.
2. **Job-file association metadata** — including canonical Job UUID, document ID, vessel ID, audit data, and per-Job soft-delete/restore state.
3. **PDF bytes** — transfer each physical asset once per vessel, even if several Jobs link to it.

Before implementation, register both proposed tables in the sync configuration and include file assets in the file-transfer pipeline. The current processor handles Work Order and component document files; this feature needs the equivalent vessel-folder mapping for assets and independent synchronization of Job links. Queue file transfer after the asset is safely stored, make retries safe, and verify bytes are present before a vessel UI or Work Order offers the file as available.

Required sync behavior:

- Synchronize a Job-link soft deletion without deleting a shared vessel asset that has other active Job links.
- Synchronize restoration and ensure that stale/out-of-order events cannot resurrect an intentionally removed link.
- Transfer file bytes once per vessel asset, then make all synchronized Job links resolve to that local asset.
- Keep Work Order views read-only and live-linked to the current Job associations. Do not create duplicate Work Order attachment records.
- Define sync authority/direction, offline upload/import retry behavior, Job/vessel inactivation behavior, asset retention, and duplicate/out-of-order event handling before implementation.

## 8. Security and operational safeguards

- Keep files private; use authenticated application endpoints rather than public object URLs.
- Enforce role permissions and vessel access on every list/open/upload/link/remove/restore/import operation, not only by hiding UI controls.
- Validate that the Job link, Job, file asset, and vessel match before serving a file.
- Check both extension and MIME type; use file-signature validation where practical.
- Derive the vessel folder and storage key on the server. Sanitize every imported/uploaded filename and never concatenate untrusted input into a path.
- Restrict direct file-drop access to an authorized office-managed storage process. The bulk-import column is a filename lookup, not a filesystem path or arbitrary object key.
- Protect file assets referenced by multiple Jobs: removing one Job link must not remove bytes or links belonging to other Jobs.
- Set safe content headers and avoid trusting client-supplied content types.
- Apply upload limits and return clear validation errors.
- Avoid logging file contents, private object URLs, or sensitive user information.
- Ensure upload failures, database failures, sync failures, and retry behavior are observable and recoverable.
- Preserve audit history for removals and make sync retries idempotent.

## 9. Expected schema and migration impact

If approved and implemented as proposed, this feature is expected to require a database migration for two normalized tables: vessel file assets and Job-to-file associations, plus their foreign keys, audit/sync fields, uniqueness rules, and indexes. It should not require adding a PDF blob or attachment column to `jobs` or `work_orders`; the Job relationship belongs in the association table. Jobs Bulk Import also needs a `Job attachments` template/mapping field and backend import handling.

The feature also requires Job Form UI changes, private vessel-folder ingestion, office/vessel permission enforcement, audit handling, Work Order read-only display through the Job link, sync-table registration, and binary file-transfer support. This plan update does not create either table, a migration, an API, storage folders, or sync behavior.

## 10. Decisions to confirm before implementation

1. Maximum PDF size and maximum number of active files per vessel/Job. The existing Work Order uploader's 25 MB cap is only a reference.
2. Exact encoding/delimiter for multiple filenames in one `Job attachments` cell, including filename escaping.
3. Filename matching rules (case sensitivity, Unicode normalization, whitespace, extension handling) and how a distinct file with the same name is rejected.
4. How a filename becomes available again after its asset/link is soft-deleted, and how restore handles a newer active file with the same name.
5. Whether the configured private storage supports controlled direct file drops, or requires a dedicated persistent staging/import area and promotion step.
6. Sync authority/direction, offline import retry, file retention, and cleanup behavior for assets with no active Job links.
7. Confirm the exact immutable folder identifier used at rollout: vessel UUID is preferred; an immutable vessel code is acceptable. No display-name suffix is used.
8. At implementation time, verify the exact finalized audit/sync columns and utilities against `component_class_regulatory_attachments` and the project-wide mandatory audit standard; apply that set to both new tables.

The following functional decisions are confirmed and are not open questions: vessel Jobs only; save the Job before attaching; office users with Job edit rights may upload/remove/restore and vessel users may view/open only; filename-based import; one active file asset per filename per vessel; reuse an asset across Jobs; no in-place overwrite; soft-delete/restore the Job link only; live read-only latest files on all Work Orders from that Job; vessel UUID or immutable-code folder with no name suffix.

## 11. Acceptance criteria

- A vessel Job's Work Instructions dialog shows only its active linked PDFs; it cannot reveal another vessel's files or another Job's links.
- Office users with Job edit rights can upload, link an existing vessel PDF, remove a link, and restore a link. Vessel users can only list/open.
- Unsaved Jobs cannot receive links. A successful upload/import links the correct `jobs.juuid` and vessel.
- A vessel cannot have two active file assets with the same normalized filename. The same asset can be linked to multiple Jobs without duplicating bytes.
- Jobs Bulk Import resolves each `Job attachments` filename only in the selected vessel folder, validates it, reports missing/invalid entries by row, and is safe to retry.
- Removing/replacing a link on one Job does not hide or delete the asset or association on another Job. Authorized restore reactivates the original link unless a documented collision prevents it.
- Uploaded/imported files are privately stored in the vessel UUID/immutable-code folder with no vessel-name suffix and can be reopened through an authorized endpoint.
- Every existing/open Work Order linked to a Job displays that Job's current active PDFs read-only. A Job document change is reflected on its Work Orders but does not alter other Jobs' Work Orders.
- Asset metadata, Job links, audit/deletion state, and the PDF bytes synchronize to the correct vessel. File bytes are transferred once per vessel asset.
- Retry/duplicate/out-of-order sync operations do not create duplicate assets/links, lose a shared file, or resurrect a removed link.
- Fleet Jobs cannot use this feature. The **Feature Coming Soon** section remains visible and inactive.
- Work Order forms may show Job PDFs through a read-only Job link as specified above; existing Work Order-owned document upload, edit, and deletion behavior remains unchanged.
- Migration verification lists every new table and its audit columns, purpose, and population/update behavior.

## 12. Scope exclusions

- Fleet Job attachments.
- Template/library attachment inheritance.
- Rich-text or editable instruction steps.
- Public sharing of PDFs.
- Automatic copying of Job PDFs into Work Order document records.
- Changes to existing Work Order-owned document upload, edit, and deletion behavior.
- Implementation, migration, or deployment in this plan-only deliverable.
