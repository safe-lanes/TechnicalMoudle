# Defect Log pagination compatibility

The routed Defect Log opts into `GET /technical/api/defects/log-page`.
The legacy defects list, COC, reports, alerts, recurring calculations and write
paths retain their existing contracts. Ordinary requests return at most 100
records. Column filters/sorting/grouping remain page-local. Only explicit exports
retrieve all matching rows, with detail hydration bounded to 500 records per batch
within one read-only repeatable-read transaction, before applying the existing
browser export filter/mapping.

## Extension-free loading

No PL/V8, new migration, database language, collation, index, search projection,
backfill or extension-installation privilege is required.

The user explicitly approved bounded server-side matching after independent
browser/PostgreSQL probes showed that SQL tag removal, XML parsing and default
case conversion do not preserve the existing search results.

- PostgreSQL applies existing raw-active, vessel ID/allow-list and backend
  due/overdue eligibility first.
- Ordinary reads with no additional browser predicates use a native database
  count and bounded 100-ID selection before full-row hydration.
- When browser predicates are active, PostgreSQL returns at most 500 scalar
  candidates at a time, ordered by raw issue date descending and unique internal
  ID ascending. Keyset continuation avoids repeated OFFSET scans and handles
  same-date and null-date boundaries explicitly.
- Node applies the existing HTML/date/Unicode/locale/status rules to each batch.
  Only scalar matching inputs are selected; action arrays are reduced to a
  boolean in SQL, and attachments/extensions are never loaded during matching.
- Navigation retains at most the requested page's IDs and the last page's IDs,
  then hydrates at most 100 complete records. Tracking the last page allows an
  out-of-range request to clamp correctly without rescanning.
- Explicit exports hydrate matched IDs in batches of at most 500. Counts,
  matching and hydration use the same read-only repeatable-read snapshot.
  A failed batch rejects the entire read, so no partial file is generated.
- Disconnects abort between batch/detail reads and roll back the read transaction;
  they do not interrupt an already-running individual database statement.

This is server-side pagination, not browser pagination or a hidden full-list
download. However, filtered totals require scanning every SQL-eligible candidate,
so server processing/network cost grows with that scope. Scalar scan memory is
bounded by batch size (not by bytes when individual descriptions are very large).
Explicit export still accumulates its full result and browser workbook/PDF in
memory; it is not a constant-memory streaming download.

The existing `parse5` and `@date-fns/tz` packages remain necessary for server-side
browser-compatible matching. No package is added. Browser timezone, locale and
current instant are passed per request and fixed throughout that read. The matcher
is prepared once per request, including its month formatter and normalized vessel
names. Shared legacy readers do not invoke it.

## Retiring migration 187

The obsolete `187_defect_log_matching.sql` file and its generator have been removed
after replacing their only runtime consumer. Fresh installations cannot discover
or execute that migration. The existing filename-based migration runner needs no
change, and existing `schema_migrations` history entries must remain intact on
upgrades. Do not fabricate an applied entry on fresh installations.

Existing installations may still contain an unused PL/V8 extension and its old
matching function. This change neither calls them nor automatically drops them;
their presence is not required. There is no replacement or cleanup migration,
no `DROP EXTENSION`, and no destructive data or migration-history cleanup.

## Ordering and existing inconsistencies

Issue date remains descending. The user approved ascending unique internal
defect ID only as a tie-breaker on the new Defect Log page/export path.
Legacy readers retain their old ordering.

Category/fleet/group parameters previously ignored by the list controller remain
ignored. Raw-active eligibility is not replaced by computed-active eligibility.
Raw-field export filters remain distinct from formatted display-field search.
Backend overdue exclusions and browser due windows remain separate predicates.

## Maintaining matching

Update `server/modules/defects/paging/compatibility.ts` with independent browser
oracle tests when matching changes are authorized. Never substitute SQL wildcard
matching for literal substring matching, regex stripping for HTML parsing, or
one canonical date parser for the distinct existing date interpretations.
Application redeployment updates the matcher; no database bundle regeneration or
helper-version migration is needed.

## Verification

- Frozen legacy browser oracle compared with the server matcher across UTC, Kolkata,
  New York (including DST), Auckland and Turkish locale.
- Real PostgreSQL pages compared with the independent browser oracle across the
  same timezones, including Turkish locale, HTML entities/template contents,
  literal wildcard characters, invalid/overflow dates and computed statuses.
- Rolled-back temporary PostgreSQL fixtures cover more than two pages, bounded
  scalar reads and detail hydration, raw/computed status differences, vessel
  intersections, invalid pages, failed middle export batches and exports beyond
  1,000 rows. Larger 5,001-row fixtures exercise keyset boundaries and emit query
  counts, response sizes, timing and query-plan evidence.
- Real browser tests use request interception, not live record mutations, to
  check page/reset behaviour, retained column filters, PDF/CSV/XLSX exports,
  request races, failure/retry, verification/unverification and final-page
  correction after deletion.
- A separate 1,238-row browser fixture checks all three export formats from
  page 2 with over 1,000 retained matches, and changes toolbar search while a
  CSV retrieval is pending to verify its original scope/filter snapshot.

Local fixture timings and workspace HTTP checks are development observations,
not production or fleet-load performance claims.

### Measured development profile

On isolated temporary fixtures using the actual reader, SQL-prefiltered records
shared one issue date and contained a short HTML description:

| Candidates | Read | Returned rows | SQL queries | Elapsed | JSON response bytes |
| --- | --- | --- | --- | --- | --- |
| 1,238 | Native page 2 | 100 | 2 | 21 ms | 237,364 |
| 1,238 | Matching page 2 | 100 | 4 | 89 ms | 237,364 |
| 1,238 | Matching export | 1,238 | 6 | 112 ms | 2,937,969 |
| 5,001 | Native page 2 | 100 | 2 | 8 ms | 237,364 |
| 5,001 | Matching page 2 | 100 | 12 | 162 ms | 237,364 |
| 5,001 | Matching export | 5,001 | 22 | 331 ms | 11,871,331 |

Matching navigation hydrated complete records in exactly one query. Export
hydration used three and eleven batches respectively. The temporary-table scan
plan was Limit → Sort → Seq Scan; no new index was introduced. Process heap
samples rose to roughly 77 MB during the larger export and JSON serialization;
these are sampled process measurements, not isolated allocation or peak-memory
guarantees. The response/export cost grows with content size.

A workspace HTTP smoke comparison matched the legacy active-reader identities
and complete exports for unfiltered, ID, HTML-entity, literal wildcard and
ordinary text searches. The existing 14-record unfiltered response took 34 ms
and 41,119 bytes; those small-data results are not a fleet-load benchmark.

Commands (browser tests need the running application and Chromium):

```sh
node node_modules/vitest/vitest.mjs run server/modules/defects/__tests__/defectLogCompatibility.test.ts server/modules/defects/__tests__/defectLogPaging.integration.test.ts server/modules/defects/__tests__/defectLogController.test.ts server/modules/defects/__tests__/defectLogBrowser.test.ts server/modules/defects/__tests__/defectLogLargeExport.test.ts
```
