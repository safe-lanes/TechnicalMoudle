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
- `POST /technical/api/stores/:vesselId/targets/membership` (retired; explicit 409 for older clients)
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

Select All captures complete application-filtered membership with one identifier-only
database query. The successful response publishes the whole captured selection;
failed/aborted requests never publish a partial selection.
It retains per-row exclusions across pages/searches. On Delete, targets are
intersected with the current application-filtered scope, as before.
Chemical Apply to All captures the whole vessel/tab independently of search,
stays pending until Save, and preserves the order of Apply and explicit edits.

Captured `{id,vesselId}` membership now lives in browser state, not a database
table or a server-memory token map. Page checkboxes and Chemical previews use
local membership sets; navigation never re-sends the complete selection.
Only explicit bulk selection fetches all eligible identifiers, never full records.
New matches after capture are not added automatically. Each Chemical field can
retain its own membership; later Apply replaces earlier overrides for that field,
while edits made after an Apply click survive a delayed capture response.

Capture requires `{version:2, ids?:number[]}`. Omitted `ids` captures the eligible
set, while `ids:[]` captures nothing. It returns
`{success:true,data:{version:2,targets:[{id,vesselId}],total}}`.
Inactivation accepts `{version:2,targets,exclude?,additionalIds?}`.
Chemical Save accepts `{version:2,applied:[{targets,values}],overrides:[{id,data}]}`.
All are validated shared contracts. IDs and submitted vessel associations are
untrusted: current server assignment/scope/type and actual database associations
are checked before writes. Removed/deleted targets are skipped; unauthorized
existing targets and mismatched associations reject the operation.
The existing business services still execute writes and current stock checks.
Chemical partial responses include exact `failedPatches:[{id,data}]`; retry uses
only those final-value drafts, not every common field on every failed item.
Network/gateway failures and lost or malformed write responses retain pending
drafts and explicitly warn that the operation may already have been applied;
users must check current results before retrying. No automatic write retry or
exactly-once guarantee is introduced.

Selection identifier memory/transfer grows with selected count. A single capture
can be smaller than three independent per-field Save memberships. The existing
Express 100mb body ceiling is unchanged; the client checks serialized request
bytes and explains HTTP 413 without truncation, splitting actions, or automatic
retry. The existing 100,000 explicit-capture-ID limit remains. Chemical explicit
patches must also accommodate a full failure-only retry of a captured set;
the former 10,000-override count ceiling is therefore removed while strict
field/ID validation and the existing byte ceiling remain. Whole-scope capture
and submitted captured memberships have no new arbitrary record-count cap.
Open-tab drafts survive application-instance changes
and server restarts under valid auth. Refresh still loses browser drafts; no
localStorage persistence or cryptographic-token dependency was added.

### Retiring migration 184 and old clients

`184_stores_operation_targets.sql` is removed from fresh-install discovery.
The retired table declaration is also removed from the active Drizzle schema.
Its NO_SYNC exclusion remains as a compatibility tombstone, so any leftover
upgrade table is never accidentally replicated. No schema push/drop is run.
No runtime reads/writes require its table, and no replacement migration, new
table, extension, secret or cache is needed. Keep historical `schema_migrations`
entries intact on upgrades. An already-installed table may remain unused:
physical deletion is a separately approved cleanup after older runtimes are
retired; this change never drops it or alters migration history.

Old capture bodies without `version:2`, UUID-token writes and the obsolete
membership endpoint receive explicit 409 refresh/reselection messages, never
SQL missing-table errors or a fallback that reruns filters. During rollout,
retire old runtimes before directing the new client to the new contract.
Older open pages cannot migrate their captured token or pending Apply-to-All
membership automatically: preserve a copy of pending values before refreshing
and reselecting. Do not silently discard drafts or promise automatic recovery.

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
node node_modules/vitest/vitest.mjs run server/modules/stores/__tests__
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

The selection suite uses a connection-local `pg_temp` search path: the old
selection table is genuinely inaccessible, not mocked away. It exercises real
SQL/controller scope resolution with mocked business writes, plus complete
inventory/1,001-row History export identities and migration discovery with a
preserved historical upgrade entry. Its isolated 25,000-target run measured:
109ms capture, 713,957 response bytes, 852,825 inactivation-request bytes, and
952,045 bytes for three independently populated Chemical memberships.
Sampled process heap growth across capture, validation and mocked writes was
about 52MB; this is neither browser peak memory nor a production capacity claim.
Timing and heap measurements vary with runtime/fixtures.

Mocked-network browser tests exercise 70-row local cross-page membership,
zero membership endpoint requests, delayed Apply/edit ordering, independent
fields, failure-only retries and capture/Save failures. Transport tests cover
explicit existing-size-limit errors and no automatic retries.
The restart handshake script `tests/e2e/stores-selection-restart.ts` holds a
capture across a managed-process restart and submits it once afterward, excluding
every fixture ID so no inventory is changed. Follow its header instructions;
read-only readiness polling allows the external development proxy to reconnect.

The existing project-wide type check has unrelated errors; no errors are in the
changed files. Representative concurrent fleet load, deeper-page performance
and browser peak-memory profiling remain separate capacity work, not a reason
to add speculative schema changes.
