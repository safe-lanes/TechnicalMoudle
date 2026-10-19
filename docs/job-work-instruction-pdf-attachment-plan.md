# Job Form Work Instructions — Vessel Job PDF Attachment Plan

**Status:** Proposed plan for review; no implementation has been performed.  
**Scope:** Vessel-scoped PMS Jobs only. Fleet Jobs are explicitly out of scope.

## 1. Purpose

Make the Job Form's **Work Instructions** dialog useful by providing:

1. A **PDF Attachments** section for manuals and work-instruction files associated with the selected vessel Job.
2. A visible **Feature Coming Soon** section, clearly marked as not yet available and with no active controls.

The attachment must be retrievable later from the same Job, stored privately, and synchronized with both its document metadata and PDF bytes to the applicable vessel installation.

## 2. Current implementation and findings

### User interface

- The Job Form route is `/pms/job/:id`.
- The Work Instructions dialog currently receives only `isOpen` and `onClose`. It does not receive the Job ID or any attachment data/callbacks.
- The dialog currently renders static example headings and steps. It has no working add, save, upload, list, open, or remove behavior.
- The shared dialog is also used by Work Order forms. The new feature must be enabled in the **Job Form** without unintentionally changing Work Order behavior.

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

- The dialog must be given the canonical Job identity and vessel context from the Job Form.
- Load the active PDF attachments for that Job and vessel when the dialog opens.
- Show a loading state while the attachment list is retrieved.
- If no files exist, show a clear empty state and, for users allowed to edit, an upload action.
- If retrieval fails, show a useful error and a retry action; do not silently display an empty list as though the Job has no documents.

### 3.2 Uploading a PDF

- Provide an upload control in the **PDF Attachments** section.
- Accept PDF files only. Validate the filename extension and MIME type on the server; where practical, also verify the PDF file signature rather than trusting browser-supplied metadata.
- Enforce a server-side size limit. A 25 MB limit is a possible starting point because the existing Work Order uploader uses that limit, but this must be confirmed for Job manuals before implementation.
- Generate a unique document ID and stored filename on the server. Do not use an unsanitized client filename as a storage path.
- Associate the metadata with both the owning Job's `juuid` and its `vessel_id`.
- If the Job has not yet been saved and does not have a canonical `juuid`, disable the upload and explain that the Job must be saved first. Do not create unlinked files.
- On successful upload, refresh the visible attachment list and show the stored filename.
- If metadata creation fails after the file is stored, attempt to remove the orphaned file and report the failure.

### 3.3 Opening and downloading

- Provide an authenticated **Open PDF** action; optionally provide a separate download action.
- Retrieve the file by document ID through the application server after validating access to the Job and vessel.
- Return the correct PDF content type and safe inline/download headers. Do not expose a permanent public object URL.
- Use the server-stored `fileKey` and storage-backend value; the client must not supply a filesystem path or object-store path.

### 3.4 Removing a document

- If removal is permitted, expose it only to users who can edit the Job.
- Confirm before removal and record the deletion in the audit columns. Prefer a soft delete so the record and deletion event can synchronize and remain auditable.
- Define a later retention/purge process separately if deleted file bytes must eventually be physically removed. Do not silently hard-delete the metadata at the point of user removal.

### 3.5 Coming Soon section

- Keep **Feature Coming Soon** visible in the dialog and clearly label it as unavailable.
- Do not show active upload, save, or other controls in this section until a separate functionality plan is approved.

## 4. Proposed database structure

Add a normalized child table, provisionally named `job_documents`. This is a **new table proposal**, not an existing table.

| Proposed column | Purpose |
|---|---|
| `id` | Unique document identifier; generate on the server. |
| `job_id` | Required foreign key to `jobs.juuid`, identifying the canonical owning Job. |
| `vessel_id` | Required foreign key to the vessel UUID for this vessel-only feature and its access/sync scope. |
| `file_name` | Original filename for display and download naming. |
| `file_key` | Private object-storage or local-storage reference; never a public URL. |
| `file_type` | Validated content type; for this feature, `application/pdf`. |
| `file_size` | Stored file size in bytes. |
| `storage_backend` | Identifies the configured private object or local filesystem backend. |
| `uploaded_by` | User identity/name shown as the uploader, populated from authenticated request context. |
| `uploaded_at` | Upload timestamp, populated by the server/database. |
| `created_by`, `created_at` | Required creation audit identity and timestamp. |
| `updated_by`, `updated_at` | Required last-update audit identity and timestamp. |
| `is_deleted` | Soft-delete state used for safe removal and synchronization. |
| `deleted_by`, `deleted_at` | Identity and timestamp for soft deletion; set only when deleting and cleared if restoration is supported. |
| `is_sync` | Sync tracking field, following the applicable existing table conventions. |
| `created_by_uuid`, `updated_by_uuid` | User UUID tracking fields where required by the PMS audit/sync architecture. |
| `sort_order` | Optional stable ordering when multiple PDFs are listed. |

### Audit requirements

The project requirement for every new table includes, at minimum:

- Created By
- Created At
- Updated By
- Updated At
- Is Deleted
- Deleted By
- Deleted At

Before implementation, inspect the full standard used by existing PMS tables and include any additional standard audit or tracking fields it requires. Follow established column names, types, defaults, utilities, and relationships. Populate user fields from authenticated identity and timestamps from the server/database; do not use hard-coded or arbitrary user IDs. Ensure create, update, soft-delete, and restore operations maintain the fields consistently.

### Constraints and indexes to consider

- Foreign key from `job_id` to `jobs.juuid`.
- Foreign key from `vessel_id` to the vessel UUID column.
- Validate that the Job is vessel-scoped and that `jobs.vessel_id` matches the submitted `vessel_id`; reject Fleet Jobs.
- Index active documents by `(job_id, vessel_id)` and index `vessel_id` for scoped listing/sync.
- Consider a unique constraint on `file_key` to prevent two records from claiming the same stored object.
- All list queries must exclude soft-deleted rows unless an authorized audit view explicitly requests them.

## 5. Proposed private file layout

The exact private object root is environment-configured and is not a literal path in the repository. The current Work Order implementation uses `PRIVATE_OBJECT_DIR` for object storage and `.private/wo-docs` as its local fallback. Do not assume the configured bucket/root value; confirm it through the approved environment configuration process before implementation.

The agreed folder policy is to separate files by vessel and Job, using a stable vessel code or ID rather than relying on a mutable/display-only name:

```text
<PRIVATE_OBJECT_DIR>/
    job-docs/
        <stable-vessel-code-or-id>_<safe-vessel-name>/
            <job.juuid>/
                <unique-document-id>_<safe-filename>.pdf
```

Example shape only:

```text
<PRIVATE_OBJECT_DIR>/job-docs/VSL-042_Alejandro/<job.juuid>/<document-uuid>_pump-overhaul.pdf
```

`VSL-042_Alejandro` is illustrative, not a confirmed vessel code or actual storage root.

If the local fallback is used, the proposed corresponding layout is:

```text
<project-root>/.private/job-docs/
    <stable-vessel-code-or-id>_<safe-vessel-name>/
        <job.juuid>/
            <unique-document-id>_<safe-filename>.pdf
```

Normalize the vessel folder component and filename to prevent path traversal and invalid filesystem/object names. Persist the storage reference in `file_key`; the directory layout must not become an API input.

## 6. Proposed API and backend responsibilities

There is currently no Job-document endpoint. Add Job-scoped endpoints following existing route conventions, for example:

| Proposed route | Responsibility |
|---|---|
| `GET /technical/api/jobs/:jobId/documents` | Return active attachment metadata after resolving the Job and verifying vessel/user access. |
| `POST /technical/api/jobs/:jobId/documents` | Accept multipart PDF upload, validate the Job/vessel ownership, store the file, create its metadata record, and queue file sync. |
| `GET /technical/api/job-documents/:documentId/open` | Authorize through the document’s Job and vessel, then stream the PDF privately for viewing. |
| `GET /technical/api/job-documents/:documentId/download` | Optional download endpoint with safe filename headers. |
| `DELETE /technical/api/job-documents/:documentId` | Soft-delete the document and queue the metadata/deletion for sync, subject to edit permission. |

These are proposed names; route naming should follow the final API design. Backend responsibilities include:

1. Resolve legacy route IDs to the canonical `jobs.juuid`.
2. Reject missing, inactive/unauthorized, Fleet-scoped, or mismatched-vessel Jobs as appropriate to the PMS policy.
3. Verify that the requester's role and vessel assignments permit listing, uploading, opening, or removing the document.
4. Validate PDF type, size, and safe filename on the server.
5. Store privately and save only the storage key/reference in the database.
6. Use a database transaction or explicit cleanup handling so failed metadata writes do not leave orphaned files.
7. Write audit values from the authenticated user and server clock.
8. Return metadata only for list requests; stream or return the PDF only from the separately authorized open/download endpoint.

## 7. Sync requirements

Sync is part of the feature scope, not an optional later enhancement.

Both of the following must reach the vessel:

1. **Document metadata** — including Job UUID, vessel ID, private storage reference/backend, file details, audit data, and deletion state.
2. **PDF bytes** — the actual file content must be delivered and stored using the vessel-side file-sync mechanism.

Before implementation, map the new table into the application’s sync configuration and file-transfer pipeline. The current file-sync processor explicitly handles `work_order_documents` and `component_documents`; a new `job_documents` table will need equivalent registration and storage-directory/path resolution. Queue files for transfer after upload, make retries safe, and verify the file exists on the vessel before the UI reports it as available there.

The implementation plan must also define:

- Sync direction and which side is authoritative for Job documents.
- How uploads made while the vessel is offline are retried.
- How soft deletions propagate and how the vessel removes or hides deleted PDFs.
- How a Job or vessel deletion/inactivation affects its document records and stored files.
- How duplicate/out-of-order sync events are made idempotent.
- Whether uploaded PDFs are available in Work Orders generated from the Job. This plan does not automatically copy them to `work_order_documents`; that behavior requires an explicit decision.

## 8. Security and operational safeguards

- Keep files private; use authenticated application endpoints rather than public object URLs.
- Enforce role permissions and vessel access on every list/open/upload/delete operation, not only by hiding UI controls.
- Validate that the document's Job and vessel match before serving a file.
- Check both extension and MIME type; use file-signature validation where practical.
- Generate the path and unique filename on the server. Sanitize every user-provided display filename and never concatenate it unsafely into a path.
- Set safe content headers and avoid trusting client-supplied content types.
- Apply upload limits and return clear validation errors.
- Avoid logging file contents, private object URLs, or sensitive user information.
- Ensure upload failures, database failures, sync failures, and retry behavior are observable and recoverable.
- Preserve audit history for removals and make sync retries idempotent.

## 9. Expected schema and migration impact

If approved and implemented as proposed, this feature requires a database migration to create the Job-document metadata table and its constraints/indexes. It should not require adding a PDF blob or path field to the `jobs` record; attachments remain separate rows linked by `job_id`.

The feature also requires backend/API work, private file-storage integration, Job Form UI changes, audit handling, sync-table registration, and binary file-transfer support. No such migration, API, storage folder, or sync behavior has been created as part of this plan document.

## 10. Decisions to confirm before implementation

1. Maximum PDF size. The existing Work Order uploader's 25 MB cap is a reference, not an approved Job limit.
2. Maximum number of PDFs per Job and whether duplicate filenames are permitted.
3. Whether an uploaded file can be replaced or only a new version can be uploaded.
4. Whether users may remove PDFs; whether removal is soft-delete only in the UI.
5. Which ranks/roles may upload, view, and remove files for a vessel Job.
6. Whether an unsaved Job must first be saved before upload. Recommended: yes.
7. Whether Job instructions should be visible from a generated Work Order, and whether that view should use current files or a point-in-time snapshot.
8. The exact stable vessel folder identifier to use (vessel code, vessel UUID, or code plus UUID) and its safe display-name suffix.
9. Which existing standard audit fields/utilities and sync metadata fields are mandatory for the new table.

## 11. Acceptance criteria

- A vessel Job's Work Instructions dialog shows its own PDFs and does not show files belonging to another Job or vessel.
- Uploading a valid PDF associates it with the correct `jobs.juuid` and `vessel_id`, and the file is placed under the correct vessel/Job private path.
- Invalid file type, invalid owner/vessel association, unauthorized access, and over-limit uploads are rejected server-side with clear errors.
- A permitted user can reopen/download the stored PDF through an authorized endpoint after refreshing or revisiting the Job.
- Soft deletion updates the audit fields and synchronizes the deletion without exposing the file as active.
- The attachment metadata and PDF bytes arrive at the correct vessel installation and can be opened there.
- Retry/duplicate sync operations do not create duplicate attachment rows or corrupt files.
- Fleet Jobs cannot use this endpoint or create Job-document rows under this vessel-only proposal.
- The **Feature Coming Soon** section remains visible and inactive.
- The Work Order forms that share `WorkInstructionsDialog` retain their current behavior unless separately approved.
- Migration verification lists every new table and its audit columns, purpose, and population/update behavior.

## 12. Scope exclusions

- Fleet Job attachments.
- Rich-text or editable instruction steps.
- Public sharing of PDFs.
- Automatic copying of Job PDFs into Work Order document records.
- Any change to current Work Order attachment behavior.
- Implementation, migration, or deployment in this plan-only deliverable.
