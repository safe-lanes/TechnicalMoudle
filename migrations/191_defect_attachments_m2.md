# Defect attachments — private storage milestone

This is M2 of the approved four-review delivery. Stop for review before M3.
There are no additional migrations, new tables, environment feature gates or
administrator activation switches. Migration 191 remains the only schema addition.
The existing three defects JSON fields now accept either legacy inline metadata
or versioned external metadata. No old files are converted, moved or backfilled.

## Upload, save and discard

- Supported files remain PDF/JPG/PNG, at most 5 MiB per file. Multipart parsing
  and server content/extension checks enforce the boundary.
- Staged files bind tenant, canonical actor, form session, vessel and A/B/C1
  section. New forms derive a stable canonical UUID without inserting an empty
  defect. Client-authored storage keys are never accepted as a staged upload.
- Private files use `defect-docs/<vesselUuid>/<duuid>/part-a|part-b|part-c1/<attachmentUuid>.<extension>`.
  Local development is under `.private`; multi-tenant installations additionally
  isolate the root by tenant. Configured private object storage uses the equivalent
  private namespace. There is no arbitrary-path or other-directory read fallback.
- Saving promotes immutable bytes and commits metadata, field logs, audit and
  binary queue intent in one database transaction. Filesystem/object writes
  are not falsely described as atomic with the DB. Failed saves retain staged
  recovery data; prepared orphan bytes are removed only after reference checks.
- Saves recheck ownership, current Part A lock, Master/C1 permissions, pending
  extension restrictions, stale record version and owning-vessel compatibility.
  Ready pairs require external uploads; storage errors never fall back to base64.
- Staging lasts seven days. Cleanup runs daily in the existing tenant-aware
  maintenance orchestrator. Cleanup and finalization use the same DB advisory
  lock. Cleanup rechecks defects, closure history, separate attachments, actions,
  notes (within the defect row), and queue references. Committed files do not expire.
- Removing/discarding a staged file never saves unrelated fields or removes a
  committed file. Closed/rejected evidence retains the existing deletion protection.
- The form retains unsaved values on upload/save errors. Expired uploads ask
  the user to attach again; successful saves replace staged client metadata with
  the canonical saved response.

## Access and presentation

New private endpoints require a mapped verified identity; the global mock role
does not authorize them. The explicit Replit default-user adapter is development
only and uses the configured canonical user. Configured edit/create permissions
are enforced on new file mutations without changing the established inline route
policy. Ship users require an active vessel assignment. Part A locks and existing
Master/pending-extension checks are reused, not replaced.

View/download resolves exact same-defect/section/attachment metadata and checks
canonical key ownership and SHA-256. Legacy inline files remain readable without
resaving. C2 and evidence lists show “Awaiting synchronization” or
“Transfer failed – contact support” when appropriate. PDF export still uses the
current unsaved form; available JPG/PNG evidence can be embedded, and missing/
failed file notes remain visible. Export does not save the defect.

## Compatibility and status contract

The M2 binary does **not** advertise `defect_files_v1`. Normal installations keep
inline new A/B uploads and C1 unavailable. The full authenticated transfer and
automatic owning-vessel readiness evaluation belong to M3.

Authenticated peer snapshots use existing `sync_settings` rows under
`defects_peer_report:<instance-id>`. They are installation-local, non-editable,
audited telemetry, never activation flags. Generic settings updates and provisioning
seeds reject this namespace. There is no public/browser report mutation endpoint.
M3 must supply the authenticated instance/vessel/session identity.

The Office Sail Admin/PMS Admin-only GET `/technical/api/defects/file-peer-reports`
provides the read-only dashboard contract, excludes session identifiers and
reports readiness false in M2. Dashboard integration and complete freshness/
handshake behavior are deferred to M3, not represented as finished here.

## Verification and deployment limits

Tests use isolated fixture storage/database schemas; they do not convert live
documents. Coverage includes staging ownership/expiry, exact size boundary,
canonical new-defect identity, metadata tampering, stale saves, immutable files,
transaction rollback, committed-file retention, concurrent cleanup/finalization,
Part A/access checks, peer telemetry protection and PDF output.

Production shore storage credentials, deployed configuration and vessel/proxy
coverage cannot be established from the development installation. Do not infer
production durability from the local development filesystem. Confirm the actual
private object-storage backend during the later deployment review.

Bidirectional binary transfer, strict transfer authorization/retries/fairness,
the five-files-by-five-MiB scenario and production rollout remain M3/M4 work.
