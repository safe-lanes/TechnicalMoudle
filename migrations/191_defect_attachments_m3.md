# Defect attachments — M3 delivery and operating notes

M3 adds the automatic compatibility and binary transport layer. It does not add a
migration, table, manual feature gate, environment activation switch, or vessel
allowlist. Migration `191_defect_part_c_attachments.sql` remains the only SQL
migration for this change. There is no migration 192.

## Readiness and authentication

- Each installation checks its actual database for `defects.part_c_attachments`.
  It also probes its configured private backend by writing, reading and removing
  a small private canary. Backend probe results are cached for at most one minute.
- Ship initiates `/technical/api/sync/defects/handshake` using the existing sync
  credential and its DB-effective `SHIP-...` identity. Shore verifies the
  credential, tenant, registered vessel code and vessel UUID. A body parameter
  cannot choose a different vessel. Default preview users cannot authenticate
  peer traffic.
- The exchange reports `defect_files_v1`, migration availability and software
  build identity. Shore signs its response using HMAC-SHA256; Ship verifies the
  signature, nonce, vessel, sequence and expiry. Replayed/older sequences are
  refused. The new engine uses this transport only over HTTPS, not local-mode
  sync. Existing unrelated metadata/file transports retain their behavior.
- Reports are installation-local records under
  `sync_settings.setting_key = defects_peer_report:<instanceId>`. They are learned
  through authenticated exchanges, not distributed as operator settings.
  Generic settings mutation/seed endpoints cannot edit this namespace.
- A report is fresh for 15 minutes. The dashboard distinguishes unknown, ready,
  stale, offline (last contact over 24 hours ago), and lost compatibility/trust.
  “Ready” means a fresh authenticated report, not proof of a live connection.
  Observed verification failure or an authenticated older client revokes trust
  immediately. Only a fresh authenticated report restores it.
- Report changes and trust revocations are audited. There is no toggle to enable
  either external storage or C1. Both derive from the same per-vessel result.
  Other vessels' updates do not activate an unreported vessel.

When not ready, new A/B uploads retain the legacy inline route. C1 upload remains
unavailable with “Part C1 will be available after this vessel's software update.”
Existing files remain viewable; loss of readiness never deletes metadata/files.

## Metadata safety

- New peers receive C1 and external descriptors only after authentication and a
  compatible report. Old peers do not receive unsupported C1 fields (including
  explicit empty defaults), external-file fields, or external full rows.
- Held logs remain unsynced. Per-batch delivery manifests record exact delivered
  Defect log UUIDs. A row-level acknowledgement cannot accidentally acknowledge
  a withheld C1 change on the same row. The manifests use a protected internal
  bookkeeping suffix in the report namespace and are not treated as peer reports.
- Full-row recovery uses the same compatibility rule. Omission preserves saved
  receiver values; it is not a request to clear C1.
- Migration 191 has no data backfill. The retryable unknown-column policy remains
  in force. Old synced Part B evidence IDs still bypass API new-selection rules
  and resolve through the legacy evidence resolver.

## Binary transfer, ownership and backend selection

- `/technical/api/sync/defects/files` is a separate authenticated transport for
  `sync_file_queue.table_name = defects`. The old upload/download/complete/fail
  and skip paths cannot handle these rows. Unrelated tables use their old paths.
- Descriptors bind queue UUID, owning vessel/Defect UUIDs, section, attachment
  UUID, canonical private key, SHA-256, byte count and chunk count. The receiver
  validates them against current same-section metadata before writing anything.
- Chunks are 64 KiB before wire base64 encoding; a file remains limited to 5 MiB.
  Bounds, canonical base64 and decoded lengths are checked before staging.
  Transfer descriptors/chunks are immutable; final size/hash and parent ownership
  are checked again before an immutable final write.
- Both directions persist partial progress. A restart resumes the same queue;
  duplicate delivery/final acknowledgement is idempotent. Missing parent metadata
  returns retryable 425 and does not exhaust a retry counter or create an orphan
  business record.
- A receiver can use a different configured backend than the sender. A protected
  local receipt at `defects_file_receipt:<SHA-256-of-file-key>` records the verified
  local backend. Authorized downloads/PDF/C2 resolve through that receipt.
  Synced attachment metadata is NOT rewritten to change its backend. There is no
  directory search or guessed fallback when content is missing.
- Final bytes are retained with their committed/history references. Successful
  transfers remove redundant chunk caches; interrupted chunks remain associated
  with the durable queue until completion or an authorized retry. The existing
  seven-day form-upload staging policy remains separate and unchanged.
- Queue direction and installation identity come from DB-effective settings.
  Managed backend reads use the private storage adapter, not a public signed URL.
  Tenant roots and canonical UUID paths stay isolated; symlink traversal is refused.
- C1's Master check uses a verified rank claim or canonical master-user
  designation (or the explicit approved development adapter). It never inherits
  the global preview mock's Master rank.

## Failure handling and fairness

- Three actual failed attempts become terminal with
  “Transfer failed – contact support”. Missing parents, readiness pauses and
  stale retry generations are deferrals, not failed attempts.
- Terminal status is available to file lists/C2 and PDF notes even if a local
  copy is still readable. Reading that valid local copy is not forbidden.
- Only a verified shore Office Sail Admin/PMS Admin with the existing dashboard
  edit permission may retry a failed Defect file. No Offline Admin or vessel-side
  bypass is accepted. Retry rechecks ownership, current metadata and readiness;
  outgoing source content is read/hash-checked. An inbound retry fixes the expected
  descriptor and revalidates source bytes on the vessel when it sends them.
- Retry is audited and creates a new generation in the existing queue's
  `sync_batch_id` field (Defect rows only). Old/forged generations cannot reset a
  failure or overwrite the new attempt. Only authorized retries discard partial
  transfer chunks; committed files are never deleted by this operation.
- Defect queues have a dedicated table/vessel/status-filtered scan before the
  response window. Held Section H rows cannot consume its first 50 slots.
  Missing-parent/failed rows are excluded from eligible drain counts. The worker
  reserves part of its time budget for each direction. A Defect-phase failure
  does not stop the existing unrelated file processor.

## Operator display

Admin → Sync Dashboard contains a read-only Defect file compatibility panel for
Office Sail Admin/PMS Admin users. It includes every expected vessel, reporting
unknown when no authenticated report exists, and shows build, migration,
capability/freshness and pending/held/failed counts.

The existing File Queue labels the new rows “Defect documents”. Eligible shore
administrators can retry terminal failures there. Defect rows cannot be skipped.
There are no activation controls.

## Verification boundary / next milestone

Automated checks cover strict authentication/replay, compatibility states,
mixed-version field/full-row filtering, both transfer directions, independent
installation databases/private roots, chunk/hash/ownership failures, immutable
resumes, per-installation identity/direction, authorized audited retry, symlink
containment and more than 50 preceding Section H rows in both directions.

These are isolated development fixtures, not deployed-vessel validation. Access
to the actual production shore backend and vessel installations has NOT been
provided/verified. Private managed-backend production credentials/permissions
have not been claimed as tested.

Development verification:
- 54 targeted tests pass across the M1/M2 regression, metadata-compatibility and
  M3 protocol suites (including independent shore/vessel databases and roots).
- The restarted application serves the dashboard. This development installation
  reports `SHORE-DEV`, migration 191 present, private local backend available.
  Its 19 expected vessels have no authenticated report and correctly remain
  unknown/not ready; this check did not activate C1 for them.
- A peer handshake without a registered authenticated identity returns HTTP 403.
- The project-wide TypeScript baseline still has pre-existing unrelated errors;
  it is not represented as a clean whole-project typecheck.

**Stop after M3 for review.** M4 still must exercise five actual 5 MiB C1 files
(add/remove), record real request sizes and results, verify rollout prerequisites
on the intended installations, and deliver the final rollout report. This note
does not authorize publishing or enabling an unverified pair.
