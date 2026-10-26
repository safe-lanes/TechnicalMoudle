# Spare Category and Optimum Qty rollout

The consolidated migration also honors the task branch's
`184_spare_category_optimum_qty_backfill` marker. Either existing data guard
prevents backfill replay; both aliases are maintained for compatibility.
For capability-gated mixed-version sync and failure recovery, see
[`migrations/184_spare_category_optimum_qty.md`](../migrations/184_spare_category_optimum_qty.md).

## Database changes

Use the existing file migration runner with
`migrations/184_spare_category_optimum_qty.sql`. Do not substitute schema push.

The migration adds nullable `spare_category text` and `optimum_qty integer` to
`spares` and `fleet_spares`. There are no General defaults and no new business
tables. Existing audit columns remain unchanged.

The designated `optimum` key requires a positive integer quantity. All other
categories, including an unclassified NULL category, require NULL quantity.
Display labels may change; stored category keys remain permanent.

Existing uncategorized records are backfilled locally as General. A separate
`schema_migrations` data guard makes this happen once even when the raw SQL is
replayed. Backfill does not write field logs, and temporarily bypasses the
generic updated-at trigger so it does not create a Fleet row-sync watermark
change. Future records created using legacy imports remain unclassified.

## Upgrade order

1. Back up and deploy the file migration independently on shore and each vessel.
2. Upgrade receiving sync code on every participating installation before
   enabling new classification writes on senders. Pause synchronization while
   installations are on incompatible receiving binaries.
3. Restart old receiver processes or refresh their column metadata after schema
   deployment. The updated code refreshes incomplete spare-column metadata and
   leaves unready classification rows/table windows pending rather than ACKing
   them.
4. Enable classification forms and new-format imports after receivers are ready.
5. Verify representative Vessel field-log updates in both directions and Fleet
   full-row delivery to a vessel before resuming unattended synchronization.

An older payload is supported: omitted properties preserve receiving values.
An older binary cannot be made safe by changes installed only on the sender;
its historical unknown-column ACK behavior is why receiver-first rollout is
required.

## Import compatibility

- Both new headers present: category is required; Optimum Qty is required only
  for Optimum. Values are validated without truncating decimal/junk quantities.
- Neither header present: legacy create leaves NULL/NULL; legacy update
  preserves saved category/quantity.
- Only one new header present: reject with a template-format error.
- Blank cells in the new format are not the legacy exception.

## Synchronization and mapping

- New local Vessel mutations log actual classification changes through existing
  field logs, including an explicit NULL when quantity is cleared.
- Incoming sync does not generate local echo logs.
- Category/quantity events apply together, after locking the saved row. Incoming
  omissions are merged without inventing a companion-field value.
- A newer local change to either member holds the incoming event as a conflict.
  Invalid partial updates stay pending and do not receive a successful row ACK.
- Conflict decisions validate the resulting pair and propagate the chosen pair.
- Resolution events use the existing designated resolution actor, so receiving
  installations apply the complete chosen pair authoritatively and close mirror
  conflicts instead of generating another collision. The human reviewer remains
  recorded in conflict-resolution audit fields and the field-log display actor.
- Fleet remains shore-to-vessel full-row sync. This updates Fleet master records,
  not previously mapped vessel spares.
- Initial mapping copies the Fleet pair. Later Fleet edits do not overwrite a
  Vessel spare; explicit Fleet resync does, including clearing obsolete quantity.
- No stock status, ROB, minimum stock, consumption, receipt, or criticality
  calculation is changed by classification.

## Checks

Focused tests cover migration rollback/retry, raw SQL replay after later
unclassified records, timestamp preservation, integer boundaries, legacy import
omission, label-independent keys, atomic sync event application, receiver schema
readiness, and spreadsheet export round trips.

Test files:
- `tests/spare-classification.test.ts`
- `tests/db/spare-classification-migration.test.ts`
- `tests/db/spare-classification-resolution.test.ts` — two isolated database
  sessions cover Apply Incoming/Dismiss, newer receiver-local edits, replay,
  mirror closure and no outgoing echo.
- `client/src/pages/spares/componentSparesExport.test.ts`
- `client/src/pages/spares/uniqueSparesExport.test.ts`

For rollback, disable the new UI/writes and retain the added columns and stored
data. Do not drop columns or rerun a fresh General backfill.
