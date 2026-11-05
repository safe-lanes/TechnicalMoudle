# Spare classification rollout and recovery

This is a hand-written migration, discovered automatically by
`runDrizzleMigrations` in `server/migrations.ts`; it is not a Drizzle journal migration.
Schema generation was checked; the generated diff also contained previously
hand-migrated unrelated changes, so that diff was discarded in favor of the
scoped, guarded SQL file.

## Rollout

1. Pause ship/shore sync while upgrading installations. Back up each database
   through the existing operational procedure.
2. Apply `184_spare_category_optimum_qty.sql` with the existing file-based runner
   on shore and independently on **every vessel database**, including each tenant.
   Do not run `db:push`. The runner records the filename in `schema_migrations`.
3. The SQL runs as one PostgreSQL `DO` statement, under a transaction-scoped
   advisory lock. Columns, seeds, one-time backfill marker, and constraints all
   succeed or roll back together. Only rows with a missing category at that
   installation's first successful application become `general`. There are no
   stock changes, field logs, or migration-value sync replay events.
4. Verify both tracking rows exist: the ordinary filename and the
   `184_spare_category_optimum_qty_backfill` guard. Confirm the three seeded
   category keys are present. Existing valid classifications are retained.
   The merged SQL also honors `184_spare_category_backfill_once`, the incoming
   branch's earlier guard. Either marker prevents data replay; SQL replay
   establishes both aliases atomically. Existing equivalent constraint names
   from either revision are honored, not duplicated. Backfill bypasses the
   existing updated-at trigger so Fleet sync watermarks remain unchanged.
5. Restart upgraded application processes to discard cached schema metadata,
   then resume sync. New code also refreshes pre-upgrade spare metadata on use.
   The `spare_classification_pair` capability gates new-field transmission.
   A new ship holds its pending classification push if shore is older; new shore
   refuses a classification-bearing pull to an older vessel, before delivery or
   acknowledgment. Upgrade/migrate the peer and retry. This deliberately holds
   the session rather than discarding fields or advancing a checkpoint past them.
6. Legacy payloads received by an upgraded installation still work: omitted
   fields preserve saved fields; absent fields on creation remain unclassified.
   Invalid partial pairs stay pending with an explicit error, and stale pairs
   use the existing Conflict Resolve list. Incoming sync does not generate echo logs.

## Failure and recovery

- A failed SQL statement rolls back the entire batch, including the backfill
  marker. Repair the reported prerequisite or invalid already-classified pair,
  then retry the existing runner. Do not mark a failed migration complete.
- If the database committed the SQL but the runner failed before writing its
  ordinary completion row, rerunning is safe: the separate backfill marker has
  already committed with the backfill and protects future legacy-created rows.
- Explicit SQL replay requires the existing `schema_migrations` table (created
  by the framework), and is a no-op for existing columns, constraints, seeds,
  labels and backfilled data. Never delete the one-time backfill marker.
- A code rollback **retains** the new columns, constraints, registry values and
  classifications. Do not automatically drop columns or erase classification
  data. Pause sync if returning to code that cannot promise pair compatibility.

## User workflows

Normal Add/Edit requires a category. Only stable key `optimum` requires
Optimum Qty (integer 1–2147483647); labels never define policy. A confirmed
interactive save away from Optimum sends explicit NULL quantity. Canceling or
failing a save does not change the saved pair.

Both import columns must be present in a new template, even when the quantity
cell is blank. A partly upgraded mapping is an error. Old templates missing
both columns may create unclassified spares and preserve the pair on updates.
Classify legacy unclassified spares when editing them normally. Templates and
exports include both fields; category keys are portable across label edits.

Initial Fleet mapping inherits the pair. Fleet edits and incoming Fleet sync
do not change mapped Vessel Spares. Only explicit Fleet resync overwrites the
vessel pair, following the existing UI overwrite confirmation.

Regression tests exercise the real file runner in an isolated schema, ordinary
reruns, SQL replay after future legacy creation, rollback/retry, unchanged stock,
validation boundaries and omitted-field merges. No new history table is used.
