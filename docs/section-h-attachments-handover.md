# Section H attachments: implementation and rollout

## Functional behavior

- Each saved Classification & Regulatory entry owns its own PDF, DOC and DOCX files.
- Office users manage attachments across vessels through the existing resource-scoped identity policy.
- Ship users can read/open only their authorized vessel's active entry attachments.
- File management originates on shore; metadata and files travel shore to vessel.
- Limits: **10 MiB per file**, **five active files**, **25 MiB active bytes per entry**.
- Upload and restore enforce limits under an entry row lock. Concurrent uploads cannot consume the same final slot.
- Removal is soft deletion. Office users can show removed files and restore the original UUID and retained bytes, subject to the current quota.
- Removing an entry or its component prevents normal file access. Restoring an entry does not automatically restore files separately removed by a user.
- Existing eight fields and their four-plus-four arrangement are preserved.
- Upload retries use a stable attachment UUID. The same retry cannot replace different bytes or create another row.
- Same filename on another entry is allowed; these are independent files, not shared links.
- The Replit audit identity is the configured default user, not the Replit collaborator's account.

## Database and migration

The dedicated table is `component_class_regulatory_attachments`, not a reuse of component or Job document tables.

`migrations/190_component_class_regulatory_attachments.sql` is the file-based, idempotent migration run by the project's existing tracked migration runner on both installations. It creates the table, ownership foreign keys, quota-related size constraint, lifecycle checks and parent/vessel/update indexes.

It does not change historical entry UUIDs or add readiness settings. Some installations have an older partial unique index with the same name as a later full index. The migration checks the actual catalog and adds an FK-compatible full unique index only if needed; it does not assume an index name proves FK compatibility.

Columns:

| Group | Columns |
|---|---|
| Identity/ownership | `ccrauuid` primary key, `class_regulatory_uuid` entry FK, `component_id` canonical component FK, `vessel_id` canonical vessel FK |
| File | `original_filename`, unique `file_key`, `content_type`, `file_size`, `storage_backend` |
| Upload | `uploaded_by_uuid`, `uploaded_by`, `uploaded_at` |
| Audit | `created_at`, `updated_at`, `created_by`, `updated_by`, `created_by_uuid`, `updated_by_uuid` |
| Lifecycle | `is_deleted`, `deleted_at`, `deleted_by_uuid`, `is_sync`, `sort_order` |

The table starts empty. No legacy file backfill or identity regeneration is performed.

## Private storage

The root-relative key is:

```
<vessel_uuid>/<entry_ccruuid>/<attachment_ccrauuid>_<safe_filename>
```

Its private category is `component-class-regulatory`. Object storage uses the configured private object root. Local storage uses `.private/component-class-regulatory/`. The vessel materializes files under its own local private root, not a sender absolute path.

No storage key or public URL is returned in the UI list. Downloads go through authenticated entry/attachment endpoints. PDFs may open in a browser; Word documents download with safe headers.

PDF signature/end markers, Word compound-document streams and DOCX package structure are checked. DOCX container limits are checked before decompression; Word parsing uses the existing XLSX/CFB dependency in a bounded worker. This is structural validation, **not antivirus or a complete document-safety guarantee**. No package was added.

Multipart bytes, file count and field sizes are bounded before application validation. Metadata, audit and durable file-queue intent commit in one database transaction; failure cleans up staged bytes.

## API

Base: `/technical/api/section-h-entries/:entryUuid/attachments`

| Method/path | Meaning |
|---|---|
| GET base | Active files; Office may request `?includeDeleted=true` |
| POST base | Multipart `file` and stable `attachmentUuid` |
| GET `/:attachmentUuid/download` | Scoped private bytes |
| DELETE `/:attachmentUuid` | Office soft removal |
| POST `/:attachmentUuid/restore` | Office restore with quota checks |

All operations resolve entry → canonical component → canonical vessel. A UUID in a URL is not authorization.

## Synchronization and provisioning

- New metadata is `ONE_WAY_SHORE_TO_SHIP`. It uses `ccrauuid` identity and `vessel_id` scope.
- Do **not** create `sync_field_log` rows for this table. Required audit records and `updated_at` full-row delivery are the supported mechanism.
- The parent is applied before attachment metadata. File transfer runs afterward using the existing queue and 256 KiB chunks.
- The receiver requires the complete schema and owner-consistent snapshots, matches UUID only, refuses immutable identity/content changes and preserves sender timestamps.
- Batch/provisioning vessel scope is checked explicitly. Receiver writes bypass normal timestamp-trigger mutation.
- Ship-origin Section H byte uploads are refused.
- The file protocol validates the peer/vessel, metadata/key ownership, chunk descriptors, declared size and SHA-256. Existing files cannot be overwritten with different bytes.
- Object-backed sources can be materialized into a private local transfer cache rather than silently skipped.
- A missing, corrupt or temporarily unavailable Section H source is isolated to its own queue entry and remains pending with a repair/retry reason. It does not prevent the pending list from returning other documents for the vessel.
- Metadata presence does not imply byte availability. Missing bytes remain visibly pending, and downloads return an explicit retryable error.
- `section_h_attachments_v1` identifies receiver capability. Old receivers do not receive attachment bytes or metadata; their attachment watermark is not advanced. Parent/other supported tables continue. Initial attachment gathering uses the beginning of history when no attachment watermark exists.
- Provisioning includes the table in dependency order and file requeue registration. The manifest separately reports Section H file count/bytes and identifies separate file delivery. No Base64 file bytes are embedded in the database bundle.
- Provisioning applies both Section H entries and attachments through their authoritative appliers, not generic upserts. Attachment import preserves receiver-local storage semantics and rejects mismatched ownership or in-place identity/content changes.
- Retained bytes are not physically purged by this feature. A separate retention decision is necessary.

## Verification and rollout boundary

Automated verification covers document structure, quotas, real PostgreSQL persistence, required audit/queue rollback, remove/restore, scoped permissions, migration rerun, legacy partial-index compatibility, concurrent independent PostgreSQL uploads, authoritative sync validation and existing Section H regression behavior.

Workspace verification results:

- 65 focused tests passed, including real HTTP multipart handling at the exact 10 MiB boundary and one byte above it, unavailable-source isolation, and actual provisioning-import routing/rejection tests.
- Frontend production build and backend bundle passed.
- Migration 190 applied successfully through the tracked startup runner.
- Live authenticated API checks passed upload, list persistence, private download, soft removal and restore of the same UUID. Only a uniquely named test fixture was used and it was soft-removed afterward.
- The browser journey exposed an awaited permission-refetch/render race and a multipart limit boundary issue. Both were corrected; the latter was confirmed by HTTP tests and the live API lifecycle. The complete browser lifecycle and narrow-screen confirmations were not rerun after the final parser correction.
- Project-wide TypeScript checking still reports existing unrelated errors; no diagnostics were reported for the changed attachment, component-section or sync files. Do not describe the whole-project type check as passing.
- The Components page renders successfully. Grouping nodes are not saved components and can show the existing Section H “Component not found” response; use a persisted leaf for attachment testing.

This workspace is one installation. Unit/receiver simulations and local fixtures are **not** evidence of a real disconnected shore/vessel transfer. Before operational rollout:

1. Apply migration 190 on the receiving vessel through the tracked runner.
2. Confirm capability and canonical parent identities.
3. Provision/sync an isolated test entry and verify all metadata and private bytes on a separate vessel installation.
4. Interrupt and resume a transfer; verify hash, pending state and queue recovery.
5. Verify remove/restore delivery and absence of field-log echo.
6. Test an old receiver remains held back without blocking supported parent updates.
7. Test source object storage and a differently rooted receiver local folder.

Do not describe these independent-installation checks as completed until run on actual separate environments.
