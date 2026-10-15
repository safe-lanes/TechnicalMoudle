# Defect form compiler correction — scoped verification

Verified 2026-10-15 with installed dependencies.

## Production change boundary

- Removed only the unused archived `DefectForm.tsx` and `DefectFormSimple.tsx`.
- Updated the archive inventory; recovery is through Git history.
- Removed only `id: defect.id` and `id: defectRef` from the retained
  `DefectFormExact` defaults. Its schema, resolver, controls, submit handlers,
  reference state, mutation branching, callbacks and invalidation are unchanged.
- Other archived files and earlier compiler/investigation reports remain intact.
- No schema, backend, permission, database, sync, numbering, dependency or
  compiler-configuration changes.

Fresh searches across client/server/shared/scripts/tests and Vite configuration
found no executable imports, route registrations, dynamic discovery or declared
micro-frontend exports consuming either archived form. Only their definitions
and archive inventory referenced them. The current navigation still selects
`DefectsLogWithTabs` and `DefectFormWizard`; the exact form remains for its older
`DefectsActive` and `DefectsLog` consumers. This does not prove the absence of
unknown consumers outside the checkout.

## Compiler comparison

Both inventories used:

```sh
npx tsc --noEmit --incremental false --pretty false
node scripts/compare-typescript-diagnostics.cjs \
  generated-artifacts/defect-form-verification/before.txt \
  generated-artifacts/defect-form-verification/after.txt
```

| Result | Count |
| --- | ---: |
| Fresh baseline | 101 |
| Final inventory | 38 |
| Removed target diagnostics | 63 |
| Added diagnostics | 0 |
| Changed complete diagnostic messages | 0 |
| Unchanged unrelated diagnostics | 38 |

Both compiler invocations exit **2**. This is not a clean project type check.
The comparison includes file, line, column, code and the complete multiline
message, normalizing moved lines using Git diff hunks. Its self-checks also run.

Full baseline/final messages and machine-readable comparison remain in
`generated-artifacts/defect-form-verification/{before.txt,after.txt,comparison.json}`.
Generated logs, bundles and screenshots are intentionally excluded from Git and
deployment. The following inventories record every removed and remaining
diagnostic by exact location and code.

### Removed diagnostics, baseline locations

`client/src/pages/_archived/defects/DefectForm.tsx` — **6**

| Line:column | Code |
| --- | --- |
| 58:7 | TS2322 |
| 76:19 | TS2339 |
| 77:59 | TS2339 |
| 99:63 | TS2769 |
| 108:38 | TS2345 |
| 497:40 | TS2345 |

These cover invalid defaults, unsupported `id` access/watch and cascading submit
handler errors. The implementation was deleted, not repaired.

`client/src/pages/_archived/defects/DefectFormSimple.tsx` — **15**

| Line:column | Code |
| --- | --- |
| 48:7 | TS2353 |
| 90:46 | TS2345 |
| 97:43 | TS2345 |
| 101:27 | TS2769 |
| 113:19 | TS2719 |
| 144:19 | TS2719 |
| 168:19 | TS2719 |
| 191:19 | TS2719 |
| 208:19 | TS2719 |
| 209:19 | TS2322 |
| 226:19 | TS2719 |
| 248:19 | TS2719 |
| 270:19 | TS2719 |
| 292:19 | TS2719 |
| 318:17 | TS2719 |

These cover unsupported `id` defaults/watch, obsolete `targetDate`, and cascading
control/submit handler errors. The implementation was deleted, not repaired.

`client/src/pages/defects/DefectFormExact.tsx` — **42**

| Line:column | Code |
| --- | --- |
| 93:7 | TS2353 |
| 397:46 | TS2345 |
| 407:43 | TS2345 |
| 424:21 | TS2322 |
| 461:21 | TS2322 |
| 491:21 | TS2322 |
| 519:21 | TS2322 |
| 548:21 | TS2322 |
| 598:23 | TS2322 |
| 652:25 | TS2322 |
| 676:21 | TS2322 |
| 726:21 | TS2322 |
| 755:21 | TS2322 |
| 784:21 | TS2322 |
| 813:21 | TS2322 |
| 849:21 | TS2322 |
| 882:21 | TS2322 |
| 916:21 | TS2322 |
| 954:21 | TS2322 |
| 991:19 | TS2322 |
| 1026:21 | TS2322 |
| 1047:21 | TS2322 |
| 1095:19 | TS2322 |
| 1125:21 | TS2322 |
| 1153:21 | TS2322 |
| 1174:21 | TS2322 |
| 1195:21 | TS2322 |
| 1222:52 | TS2345 |
| 1259:23 | TS2322 |
| 1290:23 | TS2322 |
| 1337:23 | TS2322 |
| 1368:23 | TS2322 |
| 1407:17 | TS2322 |
| 1435:21 | TS2322 |
| 1459:21 | TS2322 |
| 1493:21 | TS2322 |
| 1531:17 | TS2322 |
| 1560:23 | TS2322 |
| 1581:23 | TS2322 |
| 1602:23 | TS2322 |
| 1625:23 | TS2322 |
| 1646:23 | TS2322 |

The root diagnostic rejects the unsupported `id` default; all other errors here
were cascading control/submit-handler mismatches. No bindings were cast or
rewritten. The retained file now has zero diagnostics.

### Remaining unrelated diagnostics, final locations

| File | Count | Line:column and code |
| --- | ---: | --- |
| `client/src/micro-frontend/index.ts` | 8 | 4:35, 5:27, 6:25, 7:24, 15:50, 16:42, 17:40, 18:39 — TS2307 (missing module declarations) |
| `server/initDb.ts` | 2 | 327:37, 354:41 — TS2802 (iteration target) |
| `server/middleware/auth.ts` | 1 | 211:5 — TS2322 |
| `server/modules/bulk-upload/services/importService.ts` | 1 | 3003:48 — TS2345 |
| `server/modules/components/services/componentService.ts` | 1 | 573:76 — TS2345 |
| `server/modules/spares/services/inventoryService.ts` | 1 | 142:40 — TS2345 |
| `server/postgresStorage.ts` | 23 | 3023:19 TS2339; 3024:48 TS2769; 3078:21 TS2339; 3079:50 TS2769; 3136:19 TS2339; 3137:48 TS2769; 4191:29 TS2345; 4195:29 TS2345; 4228:49 TS2345; 4236:49 TS2345; 4335:51 TS2345; 4343:51 TS2345; 7964:64 TS2769; 8680:75 TS2769; 8768:69 TS2769; 8809:55 TS2769; 8821:44 TS2339; 8847:44 TS2769; 8953:20 TS2353; 9067:58 TS2769; 9117:14 TS2339; 9117:34 TS2339; 9121:13 TS2353 |
| `server/services/workOrderService.ts` | 1 | 375:17 — TS2322 |

All 38 retain their complete baseline messages. No unrelated error was hidden,
suppressed, excluded, changed or removed.

## Installed-schema and mounted behavior verification

```sh
node scripts/verify-defect-forms.mjs --baseline-ref=HEAD
```

During this verification `HEAD` contained the pre-change exact form. The runner
asserts that the entire before/after component differs only by the two removed
properties, then bundles both variants with actual installed React Hook Form,
Drizzle/Zod schema and Zod resolver. It extracts the complete defaults expression
using TypeScript's AST, not a hand-rewritten approximation. For repeatable use
after merging, omit `--baseline-ref`: the reference variant restores only those
two default entries. Use a pre-change Git ref when independent historical
comparison is wanted.

**14 grouped checks passed**, including **9 schema/resolver parity fixtures**:

1. New initial defaults and their validation failure.
2. Valid new data.
3. Valid existing/edit data.
4. Empty required vessel/description and exact validation messages.
5. Undefined required vessel/description and complete resolver errors.
6. HTML/plain-text description and structured immediate/root causes.
7. Nullable values and explicit false/zero values.
8. Dates, reporting flags, CoC, defer fields and false approval flags.
9. Untrusted `id`, `duuid`, `createdAt`, `updatedAt` stripping.

Each pair compares actual schema success/data or complete issues **and** actual
resolver values/errors. There were no differences.

Mounted tests run **both** before and after variants:

- New/edit/view render; displayed new preview and original edit ID stay stable
  across field edits. Existing preview numbering semantics are not changed.
- Actual rich-text editor entry and date input, structured cause field values,
  entire parsed JSON body equality, unchanged vessel scope and identity stripping.
- Create uses one POST to `/technical/api/defects`; edit uses one PATCH to
  `/technical/api/defects/FIXTURE-ORIGINAL-ID`, never a form-controlled ID.
- View leaves both save controls disabled; Back closes with no save.
- Required description validation blocks requests and leaves the form open.
- Both critical-cause warnings are nonblocking: the mocked request still occurs.
  A deliberate 500 response produces the existing error toast, no close and no
  invalidation; Back still closes.
- Success produces the existing success toast and closes exactly once.
  Invalidation selects ordinary, filtered and legacy defect keys, not component
  keys. New/edit before/after request bodies and callback observations match.

Current-path smoke tests mount the unchanged real log, real AG Grid, real modal,
real wizard, real vessel hooks and real UI-role provider. Only the authentication
input, token and toast collection are fixture seams. The normal role resolver
receives an intercepted response for a fake Office Technical Superintendent;
no production permission gate or role-switch override is changed. With a fake
log row, its enabled Edit, View and New buttons each open the real wizard/modal.
Separate edit/view modal checks load the fake record and close without a save.
These are isolated component-entry checks, not a full signed-in App/router test.

The browser's network handler intercepts every request before the network:
approved fake POST/PATCH requests are fulfilled in memory; other writes abort.
API GETs receive fake data, unknown non-fixture traffic aborts, service workers
are disabled, and only static fixture HTML/JS/CSS can reach the local server.
The application server, connected database, tenant and ship/shore endpoints are
never used for these behavioral checks. The static server has no database or
application API and rejects non-GET requests.

Evidence: `generated-artifacts/defect-form-verification/{test.txt,behavior.json}`.
The latter includes complete probe results and mounted request/callback records.

## Backend identity and logging inspection (read-only)

Unchanged contracts inspected in the shared schema, defects service, PostgreSQL
storage and sync configuration:

- Insert parsing omits client ID, canonical UUID and timestamps.
- Create validates vessel-scoped data and generates its server number; storage
  retains its existing sequence handling, `randomUUID()` ownership and sequence
  and defect field-change logging.
- Lookup accepts business ID or canonical UUID; update resolves the original row,
  targets its existing `duuid`, and logs with the existing UUID/vessel.
- Action and attachment parent foreign keys still reference `defects.duuid`;
  sync identity and parent vessel-scope join paths are unchanged.

No backend module was executed to perform a write. No schema migration,
renumbering, backfill, sync/provisioning or field-logger operation was run.
This inspection is not a database integration test or ship/shore certification.

## Builds, visual check and limitations

- `npm run build`: **passed**, including `check:filenames`, frontend and server.
- `npm run build:micro-frontend`: **passed**. This does not clear the eight
  unrelated missing-module compiler diagnostics.
- Isolated form screenshot: rendered without broken layout; saved as
  `generated-artifacts/defect-form-verification/form.jpg`. The fixture uses the
  real app layout CSS, with remote font downloads omitted.
- Existing build warnings: outdated Browserslist data, mixed static/dynamic PDF
  stub imports, and large bundles. No build configuration was changed.
- Browser warnings: existing ReactQuill `findDOMNode` deprecation and missing
  AG Grid license in the test bundle. Expected mocked 500 responses also log
  resource errors. No uncaught browser errors or unexpected requests occurred.
- The existing application workflow was not used for saves or restarted to run
  server startup hooks; the production changes are client-only and hot-reloaded.
  Tests instead use a disposable static server with fake data.
- Direct navigation/authentication, all possible user roles, full wizard saves,
  attachment/action CRUD, PDF export and end-to-end ship/shore sync are not
  certified here. Cause payloads are covered; exhaustive modal-option interaction
  is not claimed.
- Pre-existing false/zero default behavior and the optional local category rule
  are deliberately preserved. Separate follow-ups were proposed; they are not
  fixes included in this compiler-only change.
