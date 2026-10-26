# Stores paged loading

## Coverage and compatibility

Stores, Lubes, Chemicals and Others use SQL count/page queries for Inventory,
Location items, History and Bulk Update. Location names/counts have an independent
paged aggregation. Item history has a bounded endpoint; the current Stores UI
does not have a separate single-item history list to migrate.

The original array endpoints remain unchanged for Dashboard, reports, admin
upload and other compatibility consumers. The Stores screens do not use those
endpoints as a fallback.

## Contracts

- `GET /technical/api/stores/:vesselId/paged`
- `GET /technical/api/stores/:vesselId/locations/paged`
- `GET /technical/api/stores/item/:id/history/paged`
- `GET /technical/api/stores/:vesselId/values`
- `GET /technical/api/stores/:vesselId/export`
- `POST /technical/api/stores/:vesselId/targets`
- `POST /technical/api/stores/:vesselId/targets/membership`
- `POST /technical/api/stores/:vesselId/targets/inactivate`
- `POST /technical/api/stores/:vesselId/chemicals/update`
- `POST /technical/api/stores/:vesselId/bulk-quantities`

List requests include `itemType`, `page`, `pageSize` (1–200, default 25),
search, application filters, JSON `sort`/`filters`, and scope parameters.
`kind=history` selects the ledger on the common page/value/export APIs.
History period boundaries are inclusive local dates in the requested IANA
`timeZone`. Unsupported columns, malformed models, invalid dates/ranges,
invalid tabs and invalid page sizes fail explicitly.

Every paged list returns
`{success:true,data:{items,total,page,pageSize,totalPages}}`.
Count and page run in one repeatable-read transaction. Separate navigation
requests see the then-current dataset; offset pages can shift if other users
insert/delete records between requests. Export uses one repeatable-read
transaction and bounded 200-row reads for a consistent complete export.

Inventory uses active-first numeric-aware item-code order by default.
History defaults to descending numeric ID, not timestamp. Stock/ROB rules,
search fields, case-sensitive category substring filtering, and existing
positive-side location counting/matching are preserved.

AG Grid's optional external-query mode uses its infinite row model with only
the requested page cached. It sends sort/filter models to the API instead of
re-filtering already-paged rows. Distinct set-filter options come from the
complete scoped dataset, not the loaded page.

## Scope, selections and drafts

My Vessels is `all` plus `scope=my` and an explicit allow-list; an empty list
matches nothing. The existing login-captured `master_user_vessels` records
constrain My Vessels and Ship identities. Client vessel lists only narrow that
scope. Office fleet-wide reads retain the existing contract. These changes
do not replace or broaden the app's existing authentication or write guards.

Select All captures complete application-filtered membership on the server.
It retains per-row exclusions across pages/searches. On Delete, targets are
intersected with the current application-filtered scope, as before.
Chemical Apply to All captures the whole vessel/tab independently of search,
stays pending until Save, and preserves the order of Apply and explicit edits.

Migration `184_stores_operation_targets.sql` adds a tenant-local table of
opaque per-user ID snapshots. It is NO_SYNC and contains no inventory copies.
It permits selection across application instances/restarts. Abandoned
snapshots are pruned after 30 days; unavailable tokens return an explicit
conflict rather than silently expanding or shrinking selection.

Quantity drafts and explicitly edited originals remain separate from page
data. Location-side edits retain their original vessel/side metadata.
Saves submit off-page edits as well. Current stock is validated by the existing
stock service. Partial quantity saves clear only successful sides, preventing
those sides from being resubmitted on retry. Unsaved drafts are browser state,
not reload recovery. Vessel changes prompt before discarding pending Bulk
Update edits.

## Verification

Run:

```sh
node --import tsx --test tests/db/stores-pagination.test.ts
node --import tsx tests/e2e/stores-pagination.browser.ts
node --import tsx tests/e2e/stores-pagination.browser.ts --controls-only
```

SQL tests use connection-local temporary tables and clean them up. Browser
tests create a unique fixture vessel and its items, exercise real requests,
and remove only their own fixtures. They use the installed Chromium executable
and the Replit development host.

Verified: all four SQL tabs with 81 rows each, literal wildcard searches,
combined application/grid filters, natural code ordering, visibility and ROB
boundaries, complete location counts, history order/day/snapshot search,
invalid inputs, and empty/trusted fleet scope. Real-browser checks cover
cross-page quantity saves, deferred full-scope Chemical Apply to All with a
later off-page override, inventory/location export, off-page set-filter
options, global sorting, and 31-target Select All with a deselection.

The existing project-wide type check has unrelated errors; no errors are in
the changed files. Development has only 21 pre-existing inventory rows.
Small-fixture query timings do not establish production-scale performance;
large/deep-page fleet benchmarking and index selection need representative
data rather than speculative schema changes.
