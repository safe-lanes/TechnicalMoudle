# Defect Log pagination compatibility

The routed Defect Log opts into `GET /technical/api/defects/log-page`.
The legacy defects list, COC, reports, alerts, recurring calculations and write
paths retain their existing contracts. Ordinary requests return at most 100
records. Column filters/sorting/grouping remain page-local. Only explicit exports
retrieve all matching rows, in 500-row batches within one read-only repeatable-read
transaction, before applying the existing browser export filter/mapping.

## Database prerequisite

Migration `187_defect_log_matching.sql` requires **PL/V8** to be available in the
PostgreSQL installation, with permission to enable it. It creates the extension
and the scalar `public.defect_log_matches_v1` helper. This was tested in the
workspace PostgreSQL database. Every other ship, shore or tenant database using
the new reader needs the same prerequisite; do not assume that enabling it in one
database enables it in others. Check availability before rolling out this migration:

```sql
SELECT name, installed_version
FROM pg_available_extensions WHERE name = 'plv8';
```

The helper requires its V8 runtime's operating-system timezone to be UTC, and
fails explicitly otherwise. Browser timezone, locale and current instant are
passed per read. Native `Intl` timezone data must include the requested timezone.
There is deliberately no SQL-regex substitute or silent full-list fallback.
Database extension availability is an operational prerequisite, not something
the application attempts to install from the operating system.

The helper bundles parse5 (HTML fragment/text-content behaviour) and timezone-aware
JavaScript date handling to preserve the old browser predicates. No original defect
values, columns or synchronization rules are changed. No search projection is
stored or backfilled. Shared readers never invoke the new helper.

## Ordering and existing inconsistencies

Issue date remains descending. The user approved ascending unique internal
defect ID only as a tie-breaker on the new Defect Log page/export path.
Legacy readers retain their old ordering.

Category/fleet/group parameters previously ignored by the list controller remain
ignored. Raw-active eligibility is not replaced by computed-active eligibility.
Raw-field export filters remain distinct from formatted display-field search.
Backend overdue exclusions and browser due windows remain separate predicates.

## Maintaining the helper

Edit `server/modules/defects/paging/compatibility.ts`, then run
`node scripts/generate-defect-log-helper.mjs` before the initial migration ships.
The generator does not connect to the database. It embeds the runtime and a
content-addressed cache key so PostgreSQL sessions cannot reuse stale helper
code after a replacement.

After the migration ships, do not edit an already-applied migration. Add a new
versioned migration/helper for subsequent changes and update its caller and
tests together. Follow the project's existing migration process; do not use
`db:push` against an existing database.

## Verification

- Frozen legacy browser oracle compared with the helper across UTC, Kolkata,
  New York (including DST), Auckland and Turkish locale.
- Actual PL/V8 execution checked against the independently browser-tested helper.
- Rolled-back temporary PostgreSQL fixtures cover more than two pages, bounded
  ID selection before detail hydration, raw/computed status differences, HTML
  search, vessel intersections, invalid pages and exports beyond 1,000 rows.
- Real browser tests use request interception, not live record mutations, to
  check page/reset behaviour, retained column filters, PDF/CSV/XLSX exports,
  request races, failure/retry, verification/unverification and final-page
  correction after deletion.

One workspace HTTP smoke check on 2026-10-29 returned the 14 existing matching
records in about 31 ms (41,119 response bytes), with identical record identities
to the legacy array reader and complete export. This is a small development-data
observation, not a production or fleet-load performance claim. The separate
temporary database fixtures verify the 100-row bound against 1,238 records.

Commands (browser tests need the running application and Chromium):

```sh
node node_modules/vitest/vitest.mjs run server/modules/defects/__tests__/defectLogCompatibility.test.ts server/modules/defects/__tests__/defectLogPaging.integration.test.ts server/modules/defects/__tests__/defectLogController.test.ts server/modules/defects/__tests__/defectLogBrowser.test.ts
```
