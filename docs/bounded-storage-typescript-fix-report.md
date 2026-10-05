# Bounded PostgreSQL Storage Corrections

## Scope

Only three production lines in `server/postgresStorage.ts` changed:

- `createComponent` and `createFleetScopedComponent` implementation parameters
  now describe the optional local ID as `InsertComponent & { id?: Component["id"] }`.
  Their bodies, required caller `cuuid` contract, interface and shared schema are unchanged.
- `calculateAndUpdateRecurringDefects` iterates `Array.from(defectGroups)`.
  Selection, grouping, group order, update payloads, timestamps and logging remain unchanged.

Operational component creation still overwrites `cuuid` with its generated UUID.
Fleet-scoped creation still preserves the supplied UUID. All local-ID fallbacks
and data-scope defaults retain their original behavior.

## Verification (2026-10-05)

- Fresh compiler baseline: **131** diagnostics overall, **26** in storage.
- After corrections: **128** overall, **23** in storage.
- Comparison included file, line, column, error code and full diagnostic message:
  exactly the approved three diagnostics disappeared; none appeared or changed.
  The missing-`cuuid` bulk-import diagnostic is unchanged. The full type check
  still exits unsuccessfully because the remaining errors are out of scope.
- Whole-file ES2020/ESNext emission was identical after the two declarations,
  before the loop correction. Exact source comparison against the pre-edit
  snapshot confirmed only the three allowed production replacements.
- New isolated source-method regressions:
  `node --test server/__tests__/boundedStorageRegression.test.cjs`.
  Covers provided/empty/absent/undefined local IDs, distinct UUID ownership,
  original payloads and returned record identity; empty/single/unique/repeated/
  interleaved defect groups, nullable categories/vessel logger arguments,
  missing returned update rows, and logger failure without interrupting processing.
  Frozen fixture rows protect against input mutation. Full call traces assert
  selection, writes, timestamps, order and logs independently of comparison.
- Existing unchanged suites: `lowImpactStorageRegression.test.ts`,
  `severeIdentityImpact.test.ts`, `lowImpactScopeAndFeedback.test.ts`:
  **62 passed, 2 existing expected failures**.
- `npm run build` passed. Existing bundle-size and mixed-import warnings remain.
- The existing application workflow restarted and served on port 5000.
  PostgreSQL startup connectivity succeeded; migration runners reported zero
  applied migrations and RH self-heal reported zero changes/errors.
  The dashboard rendered in the preview. The existing AG Grid license warning remains.

## Boundaries

No explicit database mutation or migration command was run for this correction.
The normal application startup routines were not modified or disabled.
Behavior tests use controlled database, UUID, clock, randomness and logger boundaries;
they do not establish real PostgreSQL insert/update constraint behavior.
Authenticated production create/edit flows and two-instance ship/shore
synchronization were not exercised. Preview rendering is only a startup smoke check.

The unsupported `isRecurring` write remains unresolved by design. The other
23 storage diagnostics and all non-storage diagnostics remain outside scope.
This evidence supports a narrowly bounded correction, not a zero-regression guarantee.
