# Survey server-side pagination verification

Verified in the development environment on 2026-10-28.

## Scope and compatibility

Only operational Survey list loading changed. PostgreSQL now performs vessel
scope, eligibility, count, all supported sorting and page selection. Attachments
are selected after the materialized page. Count/page/hydration share a read-only
repeatable-read transaction. No full candidate or attachment array is returned to
Node for ranking or slicing.

The client, controllers, write/sync paths, Admin operations and legacy
initialization/single-record/create paths are unchanged. Existing local text/grid
filters, Due In selection, within-page priority ordering, query keys, export
selection and 1,500 ms edit-cache refresh stay where they were.

The separately approved migration adds `public.surveys_default_en_us`: ICU en-US,
ordinary text ordering, case/accent-sensitive and nondeterministic for ICU-equal
Unicode strings. It is not Certificate's natural/numeric sorting rule. It does
not change Survey data, table definitions or indexes, and validates an already
existing collation instead of silently accepting incompatible settings.

Source encounter order has no persistent ordering guarantee in the legacy
reader. The SQL reader captures source encounter order instead of inventing an
ID tie-breaker. Both current-data and isolated-fixture comparisons below match.
A new permanently deterministic tie-breaker would be a separate behaviour change.

## Executed checks

- `npx vitest run server/modules/cert-surveys/__tests__/surveyPaging.test.ts server/modules/cert-surveys/__tests__/surveyFrontendCompatibility.test.ts server/modules/cert-surveys/__tests__/certificatePaging.test.ts`
  — 122 tests passed, including 56 Survey tests.
- Full module regression: `npx vitest run server/modules/cert-surveys/__tests__`
  — all 184 tests passed across 11 files.
- `node --import tsx scripts/verify-survey-fixtures.ts` — 2,087 PostgreSQL fixture
  comparisons with the independent frozen pre-pagination reader, 10 real-result
  browser-filter/export-selection comparisons and 1,681 collation pair comparisons
  all matched. Fixtures use connection-local temporary tables; zero public data writes.
- `node --import tsx scripts/verify-survey-paging.ts` — 53 existing-data comparisons
  under a shared consistent snapshot all matched, including full attachment objects
  and the exact five-field response envelope.
- `GET /technical/api/surveys?page=2&limit=100&sortBy=surveyName&sortOrder=desc`
  — 100 rows, total 338, page 2, limit 100, totalPages 4, exact expected row fields.
- Running workflow restarted successfully; Survey page screenshot rendered the
  grid and “Showing 1-100 of 338 / Page 1 of 4”.
- `node --import tsx scripts/verify-survey-browser.ts "https://$REPLIT_DEV_DOMAIN"`
  — the actual Next button fetched page 2 with 100 rows and total 338. A local
  Company ID text filter produced no matching rows without another list request;
  clearing it restored the rows. Changing Due In to Overdue and back also stayed
  local and retained page 2/totals. Zero Survey writes.

Coverage includes vessel-scope precedence, Unicode/case/whitespace, inactive and
deleted/NULL masters, applicability deletion, unrestricted saved-data deletion,
missing data, fallbacks, row multiplicity, duplicate/concatenated-key data mapping,
default grouping, stable ties, every supported text alias, numeric fallback,
ascending/descending, lexical date sorting, empty/out-of-range responses,
legacy negative/default windows and the 100000 export limit.

Client tests execute the existing frontend closures, not substitute filter logic.
PDF columns/layout/blank mapping, CSV escaping/filename, Excel BOM/filename,
compound identity, all five editable dates, duplicate-save avoidance, immediate
Last Edit patching, timer reset/unmount cleanup, full attachment viewing,
attachment add/remove callbacks and read-only refusal are covered. Edit/upload
tests are isolated: no live record/file modifications are made.

## Development performance observations

Three sequential old/new service calls per scope, in milliseconds:

| Scope | Old median | New median | Rows / total |
|---|---:|---:|---:|
| All vessels, first page | 66.0 | 7.1 | 100 / 338 |
| Single vessel | 41.1 | 8.4 | 18 / 18 |
| Three vessels, out-of-range page 2 | 39.9 | 5.0 | 0 / 58 |
| Due-date descending, page 2 | 44.8 | 7.5 | 100 / 338 |

The old reader fetched 4,948,257 bytes of serialized vessel-data source objects;
the first page response serialized to 34,664 bytes. These are different
diagnostic components, not an old/new HTTP payload comparison. Service timings
are not HTTP/browser latency, production benchmarks or heap measurements.
Attachment-heavy rows and full exports intentionally retain their full payloads.

## Known unrelated check limitations

The project-wide TypeScript check reports 39 errors in unchanged files, including
PlannerDateInput, missing micro-frontend imports and Component Register errors.
No error is reported in the changed Survey service/repository or new Survey
support fixtures. Existing task proposals already address the Component Register
and missing-export issues; they were not expanded into this loading-only change.

The development browser logs existing AG Grid license/metadata warnings. The
Survey grid loads despite these warnings.
