# Low-impact TypeScript verification

Verified on 2026-10-13 using installed dependencies, with no dependency,
application, compiler or test-runner configuration changes.

## Compiler comparison

Command used for both full inventories:

```sh
npx tsc --noEmit --incremental false --pretty false
```

| Result | Count |
| --- | ---: |
| Baseline diagnostics | 128 |
| Final diagnostics | 120 |
| Removed | 8 |
| Added | 0 |
| Changed diagnostic messages | 0 |
| Unchanged | 120 |

Both compiler invocations exit 2 because unrelated errors remain. This is not a
clean full-project type check. Comparison includes file, line, column, error code
and the entire multiline message; Git diff hunks normalize moved source lines.
Duplicate-position diagnostics remain separate entries rather than collapsing
into a set.

Full baseline and final output and the JSON comparison are preserved locally in
`generated-artifacts/typescript-verification/{before.txt,after.txt,comparison.json}`.
Generated evidence is excluded from Git and deployment. The durable summary is
this document. To compare another captured baseline and final run:

```sh
node scripts/compare-typescript-diagnostics.cjs before.txt after.txt
```

The comparison command exits nonzero for added or changed diagnostics and runs
self-checks for multiline messages, separate columns and moved lines.

### Removed diagnostics (baseline locations)

| File | Line:column | Code | Diagnostic |
| --- | --- | --- | --- |
| `server/replit_integrations/batch/utils.ts` | 110:30 | TS2339 | `pRetry.AbortError` does not exist |
| `server/replit_integrations/batch/utils.ts` | 159:32 | TS2339 | `pRetry.AbortError` does not exist |
| `server/replit_integrations/chat/storage.ts` | 2:10 | TS2305 | Schema barrel does not export `conversations` |
| `server/replit_integrations/chat/storage.ts` | 2:25 | TS2305 | Schema barrel does not export `messages` |
| `server/replit_integrations/image/client.ts` | 23:18 | TS18048 | `response.data` is possibly undefined |
| `server/replit_integrations/image/client.ts` | 50:23 | TS18048 | `response.data` is possibly undefined |
| `server/replit_integrations/image/routes.ts` | 20:25 | TS18048 | `response.data` is possibly undefined |
| `shared/schema.ts` | 4151:3 | TS2322 | Boolean identity omission is not assignable to `never` |

### Remaining diagnostics by file (unchanged)

| File | Count |
| --- | ---: |
| `client/src/contexts/AuthContext.tsx` | 3 |
| `client/src/micro-frontend/index.ts` | 8 |
| `client/src/pages/_archived/defects/DefectForm.tsx` | 6 |
| `client/src/pages/_archived/defects/DefectFormSimple.tsx` | 15 |
| `client/src/pages/defects/DefectFormExact.tsx` | 42 |
| `server/initDb.ts` | 2 |
| `server/middleware/auth.ts` | 1 |
| `server/modules/bulk-upload/services/importService.ts` | 1 |
| `server/modules/components/services/componentService.ts` | 1 |
| `server/modules/spares/services/inventoryService.ts` | 1 |
| `server/modules/work-orders/controllers/woDocumentController.ts` | 2 |
| `server/modules/work-orders/services/workOrderBulkService.ts` | 2 |
| `server/modules/work-orders/services/workOrderCompletionService.ts` | 7 |
| `server/modules/work-orders/services/workOrderService.ts` | 5 |
| `server/postgresStorage.ts` | 23 |
| `server/services/workOrderService.ts` | 1 |
| **Total** | **120** |

## Focused regression tests

```sh
npx vitest run \
  server/replit_integrations/batch/__tests__/utils.test.ts \
  server/replit_integrations/image/__tests__/image.test.ts \
  server/replit_integrations/chat/__tests__/storage.test.ts \
  server/__tests__/lowImpactIntegrationContracts.test.ts
```

These tests use the existing runner configuration, actual installed p-retry and
Drizzle/Zod models, mocked processors/OpenAI/database clients, and disposable
image files. They make no live AI calls, database writes or sync/provisioning runs.
Final result: **43 tests passed across four files**.

Coverage:

- Named AbortError and RetryContext handling; all four existing rate-limit
  classifications; ordinary-error messages and one-attempt aborts; retry
  exhaustion (8 attempts with the normal batch default, 6 with the SSE default).
- Success-only progress, input-order results, concurrency limit, empty inputs,
  exact SSE event sequence, failed-item placeholders and continuation.
  A concurrent sibling continues after Promise.all rejects.
- Generation/edit decoding, request parameters, file uploads and optional output
  paths; absent arrays, empty arrays and missing base64 yield empty buffers.
  Editing to an existing output path deliberately overwrites it with zero bytes
  for these absent-payload responses.
- Image route success JSON, missing-prompt validation, upstream errors and the
  existing 500 JSON for missing first-image data.
- All six chat storage operations reference the existing models and retain
  predicates, order, insert values, returning calls and child-first deletion.
  No chat tables are created or provisioned.
- Insert-validator equivalence with the old runtime omission mask: generated
  identity is already absent, timestamps are stripped, required references stay
  required, explicit false permissions remain false, absent permissions remain
  absent (no invented defaults), and audit/sync/delete/sort fields survive.
- Mocked role-menu sync inserts/updates exclude sender-generated ids, use the
  natural composite key, retain audit/sync fields and preserve soft deletion.
- Source checks retain Access Control's direct permission mapping, schema and
  migration discovery boundaries, unregistered integration routes, provisioning
  exclusions, and all 123 existing sync memberships.

## Behavior and scope notes

SSE now really retries recognized rate-limit errors. Compared with its broken
callback, this can increase external calls and latency; it is not behaviorally
identical to that broken implementation. Retries are not transactional or
exactly-once, and rejecting a batch does not cancel concurrent siblings.

Only five production files changed. No table definition, migration, database
configuration, route registration, sync configuration, provisioning cleanup,
authentication or maintenance-domain behavior was changed.

The existing application workflow was restarted successfully and the root
dashboard rendered in the preview. Its normal startup hooks ran as configured;
this smoke check is separate from the no-database focused tests. Startup reported
no newly applied migrations. The preview reported an existing AG Grid license
warning. Vitest reported an existing future-config-loader warning about
`__dirname`; no configuration workaround was needed.
