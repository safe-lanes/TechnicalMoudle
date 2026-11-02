# Defect attachments — first review milestone

## Schema

`191_defect_part_c_attachments.sql` adds only `defects.part_c_attachments`
(JSON, default `[]`) through the existing file-based migration runner.
It is safe to replay. It does not update/copy/extract/delete existing files,
change closure evidence IDs, or reclassify Part B documents.
There is no migration 192, new attachment table, or peer-report table.

## Availability and rollout

This milestone keeps existing inline Part A/B uploads. Part C1 upload is
unavailable in normal installations, including direct API requests. Existing
sync-received C1 records remain readable. No `defect_files_v1` capability is
advertised and no administrator setting or manual gate is introduced.

The UI explains: “Part C1 will be available after this vessel's software update.”
This is partial implementation, not a production-ready external file protocol.
Stop for review before implementing external storage.

The later compatible release must be deployed on shore first and then vessels.
Before new C1 or external storage is automatically available, verify actual
migration 191 availability and working file handlers on shore and the owning
vessel through authenticated peer reports. An unknown column must remain
unacknowledged and retry after migration; it must never be skipped-and-acked.
Migration application alone is not proof that the full protocol is available.

## Existing evidence

References resolve by exact ID: C1, then Part B, then the same defect's
`defect_attachments.datuuid`. Legacy matches display “Legacy evidence” in the
form, C2 verification, rejected closure history and PDF. Missing/ambiguous IDs
remain saved and display unavailable; filename matching is not used.

New API evidence selections must reference C1. Previously saved IDs can be
resubmitted unchanged, including IDs received from an older vessel. History-only
IDs cannot be newly selected. Closed/rejected evidence retains deletion protection.
Omitted attachment fields preserve saved values; explicit empty lists remain
subject to deletion protection.

Stale forms choosing new Part B evidence receive:
“This form is out of date. Please refresh the page, then attach closure documents in Part C1.”

## Release note

**Closure files already uploaded to the shared list stay in Part B; new closure
documents go in Part C1.** There is no need to re-upload old evidence.

## Verification scope

The first milestone covers legacy resolution, API protection, independent
collection state, PDF evidence text, schema replay without backfill, and
unknown-column retry. The five-files-by-five-MB binary add/remove test belongs
to the final transfer/capacity milestone; it cannot be claimed from this
inline-storage milestone.
