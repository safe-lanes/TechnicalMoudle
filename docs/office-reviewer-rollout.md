# Office Reviewer configuration rollout

This release adds a nullable JSONB Job definition field, not new reviewer
authorization or approval-option rules. The legacy text column remains physically
present but is never a configuration fallback. Its values are deliberately not
copied. SQL NULL and `[]` mean no configured Office Reviewer.

## Coordinated shore / ship release

Do not enable new reviewer configuration writes while any receiving instance
still has the old schema or application reader.

1. Schedule a coordinated rollout and hold reviewer configuration edits during
   the rollout. Retain existing approval permissions; do not use this configuration
   as an authorization grant.
2. Apply `migrations/180_jobs_office_reviewer_role_ruids.sql` on shore and **every**
   receiving ship using the existing tracked SQL migration runner. The file is
   additive/idempotent and has no UPDATE, backfill or legacy conversion.
3. Deploy compatible application versions on shore and ships, and restart their
   services. The receiver caches database column metadata in process; applying the
   SQL alone does not refresh that cache. Verify that the migration is recorded,
   the column is JSONB with `[]` default, and all readers know the new field before
   releasing the edit hold.
4. Enable reviewer configuration edits only after all receiving instances are
   compatible. In an authorized disposable Job, verify multiple roles, removing
   one, and clearing all on both instances. Use role RUIDs, not numeric local IDs,
   and check receiving JSONB values and Work Order labels after reload.
5. Verify reviewer-only definition updates preserve ship-owned completion/RH/due
   tracking and the rebaseline stamp. The field stays on the existing one-way,
   `juuid`-keyed Job definition path and relies on ordinary `updated_at` updates.

An older receiver can skip an unknown column, apply the rest of the row, and
advance its checkpoint. Upgrading later does **not** guarantee replay. If delivery
occurred prematurely, obtain authorization for a targeted resend of affected Job
definitions; do not reset broad checkpoints or invent a legacy sentinel.
An old application reader cannot display or activate the new selections.

No migration/load/view action approves any Work Order. Empty new configuration
follows the normal approval action even if the old field contains Office. Work
Orders already Pending Office Review retain their existing status-based reviewer
actions and existing role guards; do not bulk-complete them during rollout.

## Verification and limits

Run `bash scripts/test-office-reviewer.sh` for disposable local PostgreSQL tests
and scoped regressions. The fixture database is independent of the application's
connection string and contains no live vessel records. Tests exercise:

- additive first/repeat application and normal file-runner tracking;
- real ORM array saves, replacement, removal, clearing, omitted PATCH, invalid
  input rejection and retained IDs through delayed catalogs;
- pending Modify PMS values, partial/final array overrides, explicit clears,
  typed revision history, rejection/return and final-transaction rollback;
- real receiver JSONB INSERT/UPDATE, omitted-field preservation, NULL reads,
  different local identities and protected maintenance tracking;
- array-based single/bulk interception, unchanged guards and already-pending
  reviewer actions, role labels and read-only rendering.

The local receiver fixture is not a live two-instance delivery certification.
With the application running, `npx playwright test --config
tests/office-reviewer.playwright.config.ts` checks the real Job and Work Order
forms against intercepted API fixtures, including cancel, Modify PMS, removal,
clearing and already-pending reviewer controls; it performs no operational saves.
Authenticated live QA and coordinated production/ship deployment remain operator
steps. The legacy/pending operational inventory was explicitly waived and was
not run; no assumption about those record counts is established by these tests.
