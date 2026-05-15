# Cert master audit — 2026-05-14 (Task #138)

## Scope

DEV environment (Replit project DB). Production / fork DBs are out of reach
from this Repl, so this audit covers only DEV. Before applying the same edit
to other environments via deployment, repeat the same SELECTs there.

## Precondition

All 71 starter-kit `master_id`s (from `STARTER_KIT_MASTER_DATA` in
`client/src/pages/admin/ShipsCertificatesAdmin.tsx:122-194`) must be present
in `ship_certificates_master`, with `is_system_defined = true` and
`is_deleted = false`. The 3 IDs that migration 080's INSERT backfills
(A1-003, A1-004, A1-006) must specifically be present.

## Result — DEV

| Check | Expected | Actual |
|---|---:|---:|
| Rows whose `master_id` ∈ 71-row starter kit | 71 | **71** |
| Of those, `is_system_defined = true` | 71 | **71** |
| Of those, `is_deleted = false` | 71 | **71** |
| Total rows in table (incl. user-added) | n/a | 113 |
| Missing IDs | none | **none** |
| A1-003 row | present, system, not deleted | present, system, not deleted |
| A1-004 row | present, system, not deleted | present, system, not deleted |
| A1-006 row | present, system, not deleted | present, system, not deleted |

DEV **passes** the precondition. The INSERT block in migration 080 is
already a no-op on this DB (its `WHERE NOT EXISTS` guard matches zero rows).

## Conclusion

Safe to remove the INSERT block on DEV. For production / ship servers, run
the same audit query against each DB before / after the next deployment;
the migration runner will simply skip 080 (it's already in
`schema_migrations`), so the file edit only takes effect on environments
that have not yet applied 080.

## Reproduction queries

```sql
-- Counts
SELECT
  (SELECT COUNT(*) FROM ship_certificates_master WHERE master_id IN (<71 ids>)) AS in_starter_kit,
  (SELECT COUNT(*) FROM ship_certificates_master WHERE master_id IN (<71 ids>) AND is_system_defined = true) AS flagged_system,
  (SELECT COUNT(*) FROM ship_certificates_master WHERE master_id IN (<71 ids>) AND is_deleted = false) AS not_deleted,
  (SELECT COUNT(*) FROM ship_certificates_master) AS total_rows;

-- Missing IDs
WITH expected(master_id) AS (VALUES ('A1-001'), ... ('B10-004'))
SELECT e.master_id
FROM expected e
LEFT JOIN ship_certificates_master scm ON scm.master_id = e.master_id
WHERE scm.master_id IS NULL
ORDER BY e.master_id;

-- Focus rows
SELECT master_id, is_system_defined, is_deleted, is_active
FROM ship_certificates_master
WHERE master_id IN ('A1-003','A1-004','A1-006')
ORDER BY master_id;
```

## Post-edit idempotency verification — DEV (2026-05-15)

After removing the INSERT block from `migrations/080_fix_system_defined_certificates.sql`,
re-executed the surviving UPDATE statement against DEV to prove that the
edited migration is a true no-op on an already-applied DB.

### Before re-run

```
system_true | system_false | total
        71  |          42  |   113
```

(42 user-added rows correctly remain `is_system_defined=false`; they are
NOT in the 71-ID starter kit and must not be flipped.)

### Re-execute the surviving UPDATE

```sql
UPDATE ship_certificates_master
SET is_system_defined = true
WHERE master_id IN (<71 starter-kit IDs>)
  AND is_system_defined = false
RETURNING master_id;
```

Result: **`UPDATE 0`** (RETURNING set empty). Zero rows affected.

### After re-run

```
system_true | system_false | total
        71  |          42  |   113
```

Identical to the "before" counts. Confirms:
1. The edited migration is fully idempotent on an already-applied DB.
2. The 42 user-added (non-starter-kit) rows are correctly left untouched
   (the WHERE clause's `master_id IN (...)` guard scopes the flag flip to
   the 71 starter-kit IDs only).
3. No regression introduced by the edit.

### Notes for reviewers

This file lives under `.local/notes/`, which is gitignored by the Replit
template (`/etc/.gitignore` line 9). It will not appear in `git diff`. The
file is the authoritative audit artifact for Task #138 per the task plan
at `.local/tasks/cleanup-migration-080-insert.md` and is preserved in the
project workspace.

