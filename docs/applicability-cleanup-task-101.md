# Applicability cleanup — task #101

Follow-up to #99. Goal: clean up the historical soft-deleted
`vessel_survey_applicability` rows so admin row counts reflect reality, and
verify the same situation does not exist for `vessel_certificate_applicability`.

## Pre-cleanup state (dev DB)

| Table | Live | Soft-deleted | Total |
|---|---|---|---|
| `vessel_survey_applicability` | 437 | 735 | 1172 |
| `vessel_certificate_applicability` | 323 | 0 | 323 |

## Soft-deleted survey rows by orphan reason

Joining `vessel_survey_applicability` (`is_deleted = true`) against
`ship_surveys_master`:

| Bucket | Rows | Distinct masters | Distinct vessels |
|---|---|---|---|
| `master_soft_deleted` | 660 | 43 | 15 |
| `master_not_applicable_to_company` | 75 | 5 | 15 |
| `master_inactive_kept` | 0 | — | — |
| `master_still_live_and_applicable_kept` | 0 | — | — |

Every soft-deleted row was truly orphaned — its master had either been
soft-deleted or had `applicable_to_company` toggled off. The shape (15 vessels
across the board) confirms these came from the bulk-toggle paths that #99
fixed: when a master was unflagged from the company list, every vessel's
applicability row was soft-deleted, but no garbage collection was ever run.

The 47 distinct masters involved are a mix of real surveys (e.g. `A1-004`
"Bottom Survey in Dry Dock or afloat", `A1-010` "Inert Gas - Renewal") and
test/dummy masters (`A1-014` "Test 11", `B2-015` … `E10-013` "Test 8") that
were created during admin-tool QA and later removed. None of them are
currently `applicable_to_company` and active, so none of these rows can ever
re-surface in either Cert & Surveys → Surveys or Admin → Ship's Surveys →
Vessel.

## Soft-deleted survey rows by master_id

Master flags shown reflect the master's current state in `ship_surveys_master`
(`m_deleted` = `is_deleted`, `m_active` = `is_active`,
`m_appl_co` = `applicable_to_company`).

| master_id | survey_name | m_deleted | m_active | m_appl_co | rows | vessels |
|---|---|---|---|---|---|---|
| A1-004  | Bottom Survey in Dry Dock or afloat | t | t | t | 30 | 15 |
| A1-002  | Hull - Annual for Renewal           | t | t | f | 15 | 15 |
| A1-003  | Hull - Annual                       | t | t | f | 15 | 15 |
| A1-005  | Anti-Fouling System - Renewal       | f | t | f | 15 | 15 |
| A1-007  | Fitness Chemicals - Intermediate    | f | t | f | 15 | 15 |
| A1-010  | Inert Gas - Renewal                 | t | t | t | 15 | 15 |
| A1-014  | Test 11                             | t | t | f | 15 | 15 |
| A1-017  | Oil Pollution - Annual              | f | t | f | 15 | 15 |
| A1-037  | Aux Oil-fired Boiler 2 - Internal   | t | t | t | 15 | 15 |
| A1-038  | Aux Oil-fired Boiler 1 - Internal   | t | t | t | 15 | 15 |
| A1-039  | Boilers - Annual                    | t | t | t | 15 | 15 |
| A1-040  | Boilers - Renewal                   | t | t | t | 15 | 15 |
| A1-041  | Centre Tailshaft - Modified         | t | t | t | 15 | 15 |
| A4-003  | Test 3                              | t | t | t | 15 | 15 |
| B1-008  | Saf. Construction - Annual          | f | t | f | 15 | 15 |
| B1-009  | Launching Appliances - Annual Test  | f | t | f | 15 | 15 |
| B2-015  | Test 10                             | t | t | t | 15 | 15 |
| B2-016  | Test 10                             | t | t | t | 15 | 15 |
| B2-017  | Test 25                             | t | t | t | 15 | 15 |
| B2-018  | Test 11                             | t | t | t | 15 | 15 |
| B2-019  | Test 25                             | t | t | f | 15 | 15 |
| B2-022  | Test 19                             | t | t | t | 15 | 15 |
| B8-005  | Test 5                              | t | t | t | 15 | 15 |
| B8-006  | Test 5                              | t | t | t | 15 | 15 |
| C10-009 | Test 9                              | t | t | t | 15 | 15 |
| C10-011 | Test 9                              | t | t | t | 15 | 15 |
| C7-015  | Test 12                             | t | t | t | 15 | 15 |
| C7-023  | Test 12                             | t | t | t | 15 | 15 |
| C8-013  | Test 10                             | t | t | t | 15 | 15 |
| C8-015  | Test 10                             | t | t | t | 15 | 15 |
| C8-019  | Test 19                             | t | t | t | 15 | 15 |
| C8-021  | Test 19                             | t | t | t | 15 | 15 |
| D7-007  | Test 13                             | t | t | t | 15 | 15 |
| D7-010  | Test 10                             | t | t | t | 15 | 15 |
| D7-012  | Test 10                             | t | t | t | 15 | 15 |
| D7-016  | Test 13                             | t | t | t | 15 | 15 |
| D8-007  | Test 7                              | t | t | t | 15 | 15 |
| D8-009  | Test 7                              | t | t | t | 15 | 15 |
| D8-018  | Test 25                             | t | t | t | 15 | 15 |
| D8-020  | Test 25                             | t | t | t | 15 | 15 |
| E10-011 | Test 8                              | t | t | t | 15 | 15 |
| E10-013 | Test 8                              | t | t | t | 15 | 15 |
| E2-012  | Test 9                              | t | t | t | 15 | 15 |
| E2-014  | Test 9                              | t | t | t | 15 | 15 |
| E6-008  | Test 8                              | t | t | t | 15 | 15 |
| E6-010  | Test 8                              | t | t | t | 15 | 15 |
| E7-006  | Test 6                              | t | t | t | 15 | 15 |
| E7-008  | Test 6                              | t | t | t | 15 | 15 |

For masters whose current flags still show `m_appl_co = true`, the
`applicable_to_company` filter is satisfied but `m_deleted = true` makes the
master unreachable from any UI — so the soft-deleted applicability rows are
still orphans.

`A1-004` is the only master with 30 soft-deleted rows (2 per vessel × 15)
rather than 15 — it had been toggled twice in the master tab during the
period, so two rounds of soft-deletes accumulated against it. This is also
visible in the unique partial index `uniq_vessel_survey_applicability_live`,
which only enforces uniqueness on rows where `is_deleted = false`.

## Soft-deleted survey rows by vessel

All 735 soft-deleted rows were distributed evenly across the 15 vessels
present at the time the bug was active:

| vessel_name      | rows_soft_deleted | distinct_masters |
|---|---|---|
| Alejandro        | 49 | 47 |
| ATLANTIC PRIDE   | 49 | 47 |
| Vessel 2         | 49 | 47 |
| Vessel 3         | 49 | 47 |
| Vessel 4         | 49 | 47 |
| Vessel 5         | 49 | 47 |
| Vessel 6         | 49 | 47 |
| Vessel 7         | 49 | 47 |
| Vessel 8         | 49 | 47 |
| Vessel 9         | 49 | 47 |
| Vessel 10        | 49 | 47 |
| Vessel 11        | 49 | 47 |
| WATER TIGER      | 49 | 47 |
| XT FORTUNE       | 49 | 47 |
| test             | 49 | 47 |

`Vessel 1` was created on 2026-04-14 (after the bug-prone toggles) and
therefore has zero soft-deleted rows. (Distinct-master count is 47; the
extra row vs the 47 masters above is the second `A1-004` round.)

## Live row sanity check

All 437 live `vessel_survey_applicability` rows point to a master that is
currently `is_active = true`, `is_deleted = false`, and either
`applicable_to_company = true` or a `VES-*` master. There are no live orphans
to worry about.

## Decision

Hard-delete the soft-deleted rows that match any of the following
"truly orphaned" criteria:

1. master row missing entirely, OR
2. master row soft-deleted (`is_deleted = true`), OR
3. master is not flagged `applicable_to_company` AND its `master_id` does
   not start with `VES-`.

We deliberately do **not** treat `is_active = false` as an orphan signal:
inactive masters can be toggled active again, and we don't want to lose the
historical applicability if that happens. We also leave any soft-deleted row
whose master is still live and applicable (`master_still_live_and_applicable_kept`
bucket) — same defensive reasoning. In this DB both buckets were 0 so the
defensive carve-outs did not change the row count, but the script keeps them
so it remains safe to re-run elsewhere.

## Action taken

Ran the equivalent of:

```sql
DELETE FROM vessel_survey_applicability a
USING (
  SELECT a2.id
  FROM vessel_survey_applicability a2
  LEFT JOIN ship_surveys_master m ON m.master_id = a2.master_id
  WHERE a2.is_deleted = true
    AND (
      m.master_id IS NULL
      OR m.is_deleted = true
      OR (m.applicable_to_company = false AND m.master_id NOT LIKE 'VES-%')
    )
) victims
WHERE a.id = victims.id;
```

735 rows deleted.

## Post-cleanup state (dev DB)

| Table | Live | Soft-deleted | Total |
|---|---|---|---|
| `vessel_survey_applicability` | 437 | 0 | 437 |
| `vessel_certificate_applicability` | 323 | 0 | 323 |

`vessel_certificate_applicability` had no soft-deleted rows and no live
orphans, so no cleanup was needed there.

## Cert & Surveys ↔ Admin Vessel-tab parity check

Under the agreed semantics from #99, both pages count rows that satisfy:

- `vessel_survey_applicability.is_applicable = true`
- `vessel_survey_applicability.is_deleted = false`
- `ship_surveys_master.is_deleted = false`
- `ship_surveys_master.is_active = true`
- (`ship_surveys_master.applicable_to_company = true` OR
  `ship_surveys_master.master_id LIKE 'VES-%'`)

Per-vessel raw counts after cleanup (all under those predicates):

| vessel_name      | live_rows |
|---|---|
| Alejandro        | 27 |
| ATLANTIC PRIDE   | 27 |
| Vessel 1         | 28 |
| Vessel 2         | 28 |
| Vessel 3         | 29 |
| Vessel 4         | 27 |
| Vessel 5         | 27 |
| Vessel 6         | 28 |
| Vessel 7         | 27 |
| Vessel 8         | 27 |
| Vessel 9         | 27 |
| Vessel 10        | 27 |
| Vessel 11        | 27 |
| WATER TIGER      | 27 |
| XT FORTUNE       | 27 |
| test             | 27 |

These now match what Cert & Surveys → Surveys and Admin → Ship's Surveys →
Vessel render for each vessel (because there are no longer any extra
soft-deleted rows that a `COUNT(*)` against `vessel_survey_applicability`
would surface but the UI filters out).

## Reproducibility

The same operation is wrapped in `scripts/cleanup-orphaned-applicability.ts`,
which prints the report and (with `--apply`) re-runs the delete. It is
idempotent — running it again on a clean DB is a no-op. Use it on staging /
production after the same review:

```
npx tsx scripts/cleanup-orphaned-applicability.ts          # dry-run report
npx tsx scripts/cleanup-orphaned-applicability.ts --apply  # actually delete
```

Always re-confirm the `master_inactive_kept` and
`master_still_live_and_applicable_kept` buckets on the dry-run output before
applying in another environment — those are the only two buckets the script
intentionally refuses to touch.

## Effect on row-count parity (cancelled task #98)

Cancelled task #98 noted a row-count gap between Cert & Surveys → Surveys
and Admin → Ship's Surveys → Vessel for the same vessel (e.g. Alejandro
20 vs 11). The read-side fixes from #99 already closed that gap by filtering
soft-deleted and non-company-applicable rows out of the Cert read path.
This cleanup additionally removes them from the underlying table, so any
future debugging that counts raw rows (`SELECT COUNT(*) FROM
vessel_survey_applicability WHERE vessel_id = …`) will now agree with what
both pages render, without needing to remember the `is_deleted = false` and
`applicable_to_company`/`VES-*` predicates.
