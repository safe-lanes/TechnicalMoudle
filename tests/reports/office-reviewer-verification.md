# Office Reviewer verification

## Scope
The Job-owned reviewer configuration uses `officeReviewerRoleRuids` / `office_reviewer_role_ruids`.
The old scalar reviewer column remains physically present but is not active configuration.
Migration `180_jobs_office_reviewer_role_ruids.sql` is additive and idempotent, with no
legacy backfill or Work Order status updates. No new authorization or any/all/sequential
approval rules are included.

## Checks
- Scoped automated regressions: 115 passing tests across 17 files, plus two pre-existing
  expected-failure reproductions for skipped-cycle backfill defects. Those known defects
  remain unresolved; they are not fixes supplied by this change.
- New coverage includes typed array validation, retained IDs during catalog lag, direct
  saves, omitted fields, clearing, proposal validation, partial/final overrides, native
  arrays in revision history, transactional rollback, UUID-based writes, unchanged RH
  fields, legacy Office ignored, frontend change reversion and existing sync serialization.
- Migration applied twice in a fresh disposable PostgreSQL instance. Verified JSONB type,
  empty defaults, array replacement/removal/clearing, NULL compatibility and unchanged
  legacy/tracking values. The disposable instance was stopped and deleted afterward.
- `npm run build` passed (existing bundle-size warnings).
- Compiler inventory: 128 errors before and after, with no new diagnostic messages in
  the changed files. The existing whole-project typecheck is not clean.
- Browser interaction on the existing new-Job form: select two existing roles, remove
  one, clear all, and verify phone-width popover containment. No save/create/approve
  action was performed on operational data. No page runtime errors were observed.
- Preview restarted successfully; the new Office Reviewer field rendered in the Job form.

## Reproduce automated regressions
```sh
npx vitest run --config tests/helpers/office-reviewer.vitest.config.mts \
  server/modules/jobs/__tests__ \
  server/modules/work-orders/__tests__/approvalTransition.test.ts \
  server/modules/work-orders/__tests__/severeCompletionImpact.test.ts \
  server/modules/work-orders/__tests__/workOrderBulkFinalDate.test.ts \
  server/modules/work-orders/__tests__/workOrderB2PatchValidation.test.ts \
  server/modules/sync/__tests__/officeReviewerSync.test.ts \
  server/modules/sync/__tests__/jobTrackingGuard.test.ts
```

`tests/db/office-reviewer-migration.sql` must run only in a fresh disposable PostgreSQL
database: it creates a fixture `jobs` table. Never run it against an application database.

## Limits and rollout
- No dev/prod legacy-Office or Pending Office Review inventory was queried; the user
  explicitly waived those prechecks and conditional consultation.
- Already-pending Work Orders are not automatically completed or migrated. Existing
  reviewer actions remain status-based and retain their existing permission guards.
- No live save/approval journey was exercised; persistence and approval writes were
  verified with isolated real-method fixtures and disposable PostgreSQL.
- No production deployment or two-instance shore/ship delivery was performed.
- Apply migration 180 on shore and receiving ships, deploy compatible application
  readers, and restart receivers to refresh cached column metadata before enabling
  writes. Old receivers can skip unknown columns and advance checkpoints; do not
  assume an upgrade automatically replays a skipped selection.
- Schema generation was inspected as required by project conventions. It included
  unrelated pre-existing snapshot drift; those generated artifacts were removed.
  Only the explicitly requested migration 180 is retained for this change.
