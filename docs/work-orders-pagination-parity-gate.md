# Work Order pagination: ordering parity gate

## Status

Database paging is connected to all seven Work Order tabs. Both the explicit
`/work-orders/paged` route and the existing `?page=` envelope use the bounded
repository. Requests without `page` retain the independent legacy-array path.

The user approved the explicit-date exception below when resuming work, and
subsequently selected **"Approve consistent default ordering"** on 2026-10-28.
Default ordering retains status priority, puts missing Due Dates first, orders
populated dates chronologically (invalid populated values retain the legacy
epoch fallback), and resolves ties by descending creation time and identifier.
This approved change also covers secondary ordering, queues and exports.
No saved dates, date displays, approval/stock/RH writes or calculations changed.

## Read contracts

Pages use validated, parameterized queries and one repeatable-read, read-only
snapshot per operation. Only the selected page is hydrated in the application.
Tab counts and rank options retain their complete vessel-scope semantics;
approval-tier counts retain current filtered-tab semantics and per-vessel locks.
Toolbar controls act before paging; AG Grid header filters remain page-local.
Period requests carry a validated browser IANA timezone. Date-range boundaries,
year/month/quarter membership and RH period-day calculations use that zone, not
the server's timezone. The same predicate is reused for queues and scoped exports.

The trusted scope resolver preserves Office fleet reads, intersects My Vessels
and Ship requests with active assignments, and makes empty assignments/lists
match nothing. Missing trusted identity returns 403 rather than fleet access.

The browser reads availability metadata rather than downloading all Jobs.
Review queues return complete ordered IDs only, in 200-record database batches.
Server exports read batches of 200 and return a temporary file download handle.
Handles are single-use, tenant/identity/scope-bound, expire after five minutes,
and are removed on download, expiry, cancellation or generation failure.
Temporary downloads currently require requests to reach the creating server.

Work Order XLSX and Component Jobs XLSX are streamed. PDF generation keeps
printable table cells in memory because the existing renderer needs them; it
does not keep the complete hydrated source dataset or send it to the browser.
Existing template columns, Lists sheet, validations and review notices are reused.
Browser-local generation labels, timestamp date display and numeric locale are
passed explicitly to server exports.

## Verification evidence

- Read-only development snapshot: 674 eligible Work Orders; 166 missing Due Dates;
  no nonempty invalid Due Dates or submitted dates. Hydrated fields matched the
  legacy service. All seven tabs and every supported sort in both directions
  matched the approved baseline.
- Isolated connection-local TEMP fixtures: 12 integration groups passed, covering
  fixed clocks across leap/month/year and RH boundaries, three company grace
  methods, mixed/invalid date ordering, all tabs, page boundaries, literal search,
  four period modes, scope restrictions, a queue larger than 200, both Work Order
  export formats, and 213 Component Jobs with template/cell/validation/notice parity.
  Cross-timezone comparisons cover Brisbane, Kolkata, Los Angeles and Auckland
  against a UTC server, including single days, DST, year/month/quarter boundaries,
  repeated RH months, queues and filtered exports.
- Focused baseline/transport/export-date tests: 56 passed.
- Browser check using the application's existing forwarded Office test identity:
  10 rendered rows out of 193, correct pager, server toolbar search and empty
  result. No complete Work Order/Jobs/Components fallback downloads or page errors.
- Representative development plan: `Limit`, 10 selected/hydrated rows out of 674
  eligible records, 46,670 hydrated-row JSON bytes, approximately 612 ms SQL
  execution and 56 ms planning. HTTP envelope was 47,181 bytes in 1.46 seconds.
  Existing Job/Component indexes were used; no speculative indexes were added.
  These small development-data measurements are not production-scale claims.
- Production build passed. Typecheck retained 39 pre-existing errors outside
  changed areas; no new changed-file errors were reported.

Re-run database checks:

```sh
node --import tsx tests/db/work-orders-pagination-parity.ts
node --import tsx tests/db/work-orders-pagination-parity.ts --profile
node --import tsx tests/db/work-orders-pagination.test.ts
```

The parity script only reads development records. Integration writes are limited
to connection-local temporary fixtures; no approval, completion or stock actions
are executed. SQL date validation uses PostgreSQL 16's `pg_input_is_valid`.

## Historical cyclic-comparison reproduction

Run:

```sh
npx vitest run server/modules/work-orders/__tests__/workOrderPagingBaseline.test.ts
```

The test imports the production shared comparator, not a replacement.
The dates below are synthetic fixtures; this is not evidence that these exact
values occur in the database.

For ascending Due Date sorting in the Due tab:

| Row | Saved due date | Comparison |
| --- | --- | --- |
| A | `31-01-2026` | A precedes B chronologically |
| B | `01-02-2026` | B precedes C as text |
| C | `15-invalid` | C precedes A as text |

The current comparator parses both dates. If both parse, it compares timestamps.
Otherwise it compares the original strings with `localeCompare`.
This creates a cycle: A < B < C < A. Descending reverses the cycle.
The same conditional comparison is used for submitted dates in the Pending
Approval and Completed tabs.

No ordinary SQL `ORDER BY` key can satisfy all three comparisons.
Adding a unique tie-breaker does not resolve the cycle: none is a tie.
Sorting only the selected page in JavaScript would not preserve complete-scope
sorting. Loading every record to sort in JavaScript would violate the bounded
loading requirement. Neither is an acceptable fallback.

## Approved explicit-date exception

For explicit Due Date sorting, keep empty values
first, compare parseable dates chronologically next, then put nonempty
unparseable values last and compare their original text within that group.
Reverse this ordering for descending. Apply the same rule to submitted dates
where the existing comparator uses those dates.

This changes order only for comparisons involving an unparseable nonempty
value. Empty values retain their current placement before valid dates in
ascending order. No saved values or date displays need change.

This policy is implemented by the paged repository, not by changing the
independent legacy comparator. The historical baseline tests deliberately retain
the cyclic example so the reason for this approved exception remains visible.
