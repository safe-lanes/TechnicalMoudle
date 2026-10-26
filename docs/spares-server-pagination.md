# Spares server pagination

## Scope and compatibility

This is a loading/query change following the Stores structure, not a Spares
transaction redesign. Existing array endpoints remain available for other
consumers. The migrated screens do not use them as inventory/history fallbacks.
The component tree, location picker and maker reference lists retain their
existing supporting APIs; they are not hidden inventory downloads.

New read routes, under `/technical/api`:

| Route | Purpose |
| --- | --- |
| `spares/:vesselId/paged` | Inventory, selected-location items, History or Bulk Update (`kind`) |
| `spares/:vesselId/values` | Complete scoped header-filter options (`column`) |
| `spares/:vesselId/locations/paged` | Independently paged location names and stock counts |
| `spares/:vesselId/export` | Unique, Component or filtered History XLSX (`type`) |

Pages return `{success:true,data:{items,total,page,pageSize,totalPages}}`.
Page sizes are validated, with a maximum of 200. The UI keeps its existing
Inventory/Location/History default of 10 and Bulk Update default of 25; location
navigation uses 25 names per page. Search is debounced. Every page request has
an abort signal, a complete URL query key, explicit loading/errors, and no
previous-scope placeholder rows.

All SQL uses the tenant-aware database accessor. Count/page pairs and complete
exports use read-only repeatable-read transactions. Sorting has an ID
tie-breaker; History defaults to timestamp descending, not ID order.
Application filters retain Spares stock calculations and primary/linked dotted
component matching. Location names and counts use positive location stock,
independently of the selected item page. By Location remains single-vessel.

My/Ship requests intersect client allow-lists with trusted active server-side
user assignments. Empty assignments and explicit empty allow-lists match
nothing. Office All Vessels retains its existing fleet-wide access.

## Drafts, selection and mutations

The grid's optional external-query mode supplies complete-scope sorting,
filtering and distinct values; only the current page is kept as row data.
Selection remains **Select All Visible**, retaining selected IDs and their
vessel ownership when paging. It is not Select All Matching.

Bulk Update retains its existing consume/receive modes, A/B fields, `parseInt`
quantities, validation, confirmation, Save/Cancel, and transaction services.
Only explicitly edited originals and drafts are retained independently of page
data. Apply-to-all date/place/comments act on existing edits and supply defaults
for subsequent edits, including rows not yet loaded. Off-page edits participate
in validation and Save.

The paged client still posts to `spares/bulk-update`, with `paged=true` and its
scope. All submitted IDs are checked against the trusted scope before invoking
the existing service. Duplicate numeric/UUID identities are rejected.
No new transaction engine or database snapshot table was introduced.

Location ROB editing also retains edited originals across pages/searches.
Confirmed successful saves are removed individually, so retrying a partial
Location save does not repeat them. Vessel/location discard guards and
in-flight-save guards prevent accidental scope changes; a completed Bulk save
cannot navigate a newly selected scope.

**Existing Bulk result behavior was deliberately not redesigned:** its service
returns per-row results (and can return HTTP 200 with unsuccessful rows), and
the original UI treats a successful HTTP response as completion. General Bulk
partial-result reporting/idempotent recovery remains a separate business-flow
change. There are no new automatic mutation retries in this pagination work.

## Exports

The browser downloads a generated file rather than loading every source page.
The server reads batches of 200 within one consistent snapshot and writes an
ExcelJS streaming workbook to a temporary file. It validates the entire export
before sending the file and removes temporary files after success/failure.

Unique Spares deduplicates by vessel/part code using the first ordered master.
Component Spares uses each link's own component; UUID is authoritative and an
inconsistent numeric fallback fails explicitly. Deleted/inactive visibility,
unavailable-link reporting, primary-reference fallback rules, template sheets,
headers, widths, dropdown lists, version marker and filename helpers are
retained. A shared pure mapper is used by old builders and new server exports.

Inventory exports deliberately ignore current toolbar/component/grid filters,
as before. History exports its complete application-filtered scope, not just the
visible page. History preserves the legacy distinction between dateLocal display
and the period filter's timestamp fallback for other date text, including ISO
date-times; do not consolidate these interpretations as a pagination cleanup.

## Verification and available-data evidence

Commands:

```sh
node --import tsx --test tests/db/spares-pagination.test.ts
node --import tsx tests/e2e/spares-pagination.browser.ts
node --import tsx tests/db/spares-pagination-plans.ts
node --import tsx --test client/src/pages/spares/componentSparesExport.test.ts client/src/pages/spares/uniqueSparesExport.test.ts
npm run build
```

The SQL suite uses TEMP tables on an isolated connection; it does not modify
user data. Its fixtures exceed three pages and cover bounded results,
full-scope search/filter/sort/options, literal vs legacy Inventory search,
dotted descendants and secondary links, location counts/pages, History order,
events/periods/timezones, trusted scope, scoped mutation validation, complete
XLSX output and inconsistent link identity failures.

The browser suite uses a disposable fixture vessel with 41 spares and 31
positive-stock locations and cleans it up in `finally`. It checks page changes,
off-page header filtering/sorting, page-based selection retained across pages,
location navigation/search, complete History export, and cross-page Bulk drafts
and actual stock updates through the existing receive service.

Read-only development evidence on 2026-10-26, largest available vessel:

| Query | Matching rows | Returned | Page JSON bytes | Page SQL execution |
| --- | ---: | ---: | ---: | ---: |
| Inventory | 1,115 | 10 | 13,176 | 140.548 ms |
| Bulk | 1,115 | 25 | 33,707 | 1.576 ms |
| History | 14 | 10 | 8,189 | 0.062 ms |

Inventory used Limit → Sort → Index Scan; Bulk used Limit → Index Scan;
History used Limit → Sort → Seq Scan. These are single-run, local-development
observations, including a cold first Inventory run—not production-scale latency
claims. No speculative indexes were added.

Two pre-existing export tests cannot read their absent uploaded golden workbook:
`attached_assets/spares_template_(20)_1791175727961.xlsx`. The new server-export
tests read generated XLSX files and validate their sheets/data/dropdowns, but do
not pretend to replace comparison against the unavailable original upload.
