# Work Order pagination: ordering parity gate

## Status

Database paging is not wired into the application. The existing application
behavior remains unchanged. This note records a concrete ordering mismatch
requiring approval under the pagination task's preservation constraint.

The user chose **"Preserve behavior and pause"** when offered deterministic
date ordering, then asked to proceed with the task. Work has resumed without
approval to alter ordering. The task remains incomplete. Do not apply the
proposed exception below without new explicit approval.

## Unconnected foundations

The shared paged-query contract and trusted read-scope resolver are implemented
as isolated building blocks. Neither is connected to the live endpoint yet.
The resolver preserves authorized Office fleet reads, intersects My Vessels
and Ship requests with active assignments, and treats an explicit empty list
as no vessels. Contract and scope tests run without database access or writes.

These building blocks are not database-backed pagination: SQL projection,
paged reads, aggregates, server exports, queue APIs and client migration remain
unimplemented. The existing endpoint still uses its original loading path.

## Reproduction

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

## Proposed exception — not approved

Suggested narrow exception for explicit Due Date sorting: keep empty values
first, compare parseable dates chronologically next, then put nonempty
unparseable values last and compare their original text within that group.
Reverse this ordering for descending. Apply the same rule to submitted dates
where the existing comparator uses those dates.

This changes order only for comparisons involving an unparseable nonempty
value. Empty values retain their current placement before valid dates in
ascending order. No saved values or date displays need change.

This policy was not approved and has not been implemented. Further
status/hydration/default-order parity investigation would still be required if
work resumes; the baseline tests do not establish SQL or export parity.
