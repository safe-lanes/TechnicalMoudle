# TypeScript Error Baseline Investigation

**Investigation date:** 21 September 2026  
**Command:** `npx tsc --noEmit --pretty false`  
**Result:** Exit code 1, **290 diagnostics across 58 files**

## Executive summary

The TypeScript failure is not one regression and not 290 independent defects. It is a mixed baseline made up of:

1. concentrated React Hook Form/schema incompatibilities in defect forms;
2. shared schema, API, and storage contract drift;
3. strict-null and response-shape defects;
4. a compiler-target omission that produces deterministic `Set`/`Map` iteration errors;
5. stale imports from archived and incomplete micro-frontend/form-editor code;
6. dependency API/declaration mismatches; and
7. smaller local typing defects.

The production build can still succeed because it does not use `tsc` as a blocking step. That does not make the diagnostics harmless: several active backend and shared-contract errors identify places where database writes, API responses, authentication objects, or Work Order behavior may disagree with their declared contracts.

There is no evidence that the current 290-error baseline was introduced by one recent commit. The recently merged Current Reading Date correction is not in the compiler output. Recent Work Order changes make that area regression-sensitive, but the baseline spans unrelated active, archived, configuration, and integration code.

No source code, compiler configuration, schema, migration, dependency, lockfile, API, sync, or runtime behavior was changed during this investigation.

## 1. Current status

### Diagnostics by TypeScript code

| Code | Count | Meaning in this baseline |
|---|---:|---|
| TS2345 | 58 | Argument or callback does not match the declared contract |
| TS2339 | 47 | Consumer reads a property absent from the inferred/declared type |
| TS2322 | 41 | Assignment, component prop, or return value has an incompatible shape |
| TS2719 | 38 | Structurally different same-named generic types, concentrated in React Hook Form |
| TS18048 | 26 | Value may be `undefined`, mainly report summary and image responses |
| TS2307 | 14 | Imported module does not exist |
| TS2802 | 14 | `Set`/`Map` iteration is incompatible with the implicit compiler target |
| TS2353 | 12 | Object literal includes a field absent from the target contract |
| TS2769 | 11 | No overload matches, mostly downstream form/storage contract failures |
| TS7006 | 11 | Callback parameter has implicit `any` |
| TS2551 | 9 | Likely renamed or incorrect property |
| TS2304 | 4 | Referenced type/name is not declared |
| TS2305 | 3 | Imported symbol is not exported |
| TS2367 | 1 | Impossible string/boolean comparison |
| TS2740 | 1 | Array assigned where a keyed configuration object is expected |
| **Total** | **290** | |

### Diagnostics by feature area

This partition accounts for every diagnostic exactly once.

| Area | Count | Notes |
|---|---:|---|
| Active defect UI | 42 | `DefectFormExact` form/schema/generic cascade |
| Active reports UI | 35 | Primarily Change Request summary nullability |
| PostgreSQL storage | 33 | Mixed schema, insert, nullability, and missing-symbol drift |
| Other server code | 32 | Running hours, jobs, integrations, initialization, reports, spares |
| Other active client code | 29 | Forms, auth, IHM, editor, certificates |
| Archived client code | 26 | Archived defect and change-request pages remain inside `tsconfig` |
| PMS client UI | 21 | Work Order form/page, dashboard, jobs |
| Work Order server modules | 17 | Completion, bulk, document, and service contracts |
| Component server modules | 16 | Authenticated user shape and service/repository boundaries |
| Certificate/survey server modules | 13 | Implicit callback types and iterable target errors |
| Noon-report UI | 11 | Tuple/mutation and export typing |
| Micro-frontend entrypoint | 8 | Imports four missing pages twice |
| Alerts repository | 6 | Database/query contract mismatches |
| Shared schema | 1 | Schema-level typing issue |
| **Total** | **290** | |

### Diagnostics by file

| File | Count |
|---|---:|
| `client/src/pages/defects/DefectFormExact.tsx` | 42 |
| `server/postgresStorage.ts` | 33 |
| `client/src/pages/reports/ChangeRequestReports.tsx` | 23 |
| `client/src/pages/_archived/defects/DefectFormSimple.tsx` | 15 |
| `server/modules/components/controllers/subEntityController.ts` | 14 |
| `client/src/pages/pms/WorkOrderFormPage.tsx` | 13 |
| `client/src/pages/noon-report/ReportsExport.tsx` | 11 |
| `server/modules/cert-surveys/services/certAdminService.ts` | 11 |
| `client/src/micro-frontend/index.ts` | 8 |
| `client/src/components/modals/IhmManagementModal.tsx` | 7 |
| `server/modules/work-orders/services/workOrderCompletionService.ts` | 7 |
| `client/src/pages/_archived/defects/DefectForm.tsx` | 6 |
| `server/modules/alerts/repositories/alertsRepository.ts` | 6 |
| `client/src/pages/_archived/change-requests/ChangeRequestsLogWithTabs.tsx` | 5 |
| `server/modules/work-orders/services/workOrderService.ts` | 5 |
| `server/services/runningHoursService.ts` | 5 |
| `client/src/pages/pms/Dashboard.tsx` | 4 |
| `client/src/pages/pms/JobsFormPage.tsx` | 4 |
| `client/src/pages/reports/StoresReports.tsx` | 4 |
| `server/services/jobDueScanner.ts` | 4 |
| `client/src/components/admin/FormSchemaEditor.tsx` | 3 |
| `client/src/components/WorkOrderForm.tsx` | 3 |
| `client/src/contexts/AuthContext.tsx` | 3 |
| `client/src/pages/admin/ShipsCertificatesAdmin.tsx` | 3 |
| `client/src/pages/reports/MaintenanceReports.tsx` | 3 |
| `client/src/pages/reports/SparesReports.tsx` | 3 |
| `client/src/components/admin/FormConfigurationModal.tsx` | 2 |
| `client/src/components/FormEditorFactory.tsx` | 2 |
| `client/src/components/RichTextEditor.tsx` | 2 |
| `server/initDb.ts` | 2 |
| `server/modules/cert-surveys/services/surveyAdminService.ts` | 2 |
| `server/modules/reports/services/complianceReportService.ts` | 2 |
| `server/modules/spares/services/sparesService.ts` | 2 |
| `server/modules/work-orders/controllers/woDocumentController.ts` | 2 |
| `server/modules/work-orders/services/workOrderBulkService.ts` | 2 |
| `server/replit_integrations/batch/utils.ts` | 2 |
| `server/replit_integrations/chat/storage.ts` | 2 |
| `server/replit_integrations/image/client.ts` | 2 |
| `server/services/workOrderService.ts` | 2 |
| `client/src/components/ComponentRegisterForm.tsx` | 1 |
| `client/src/components/modals/AddSectionModal.tsx` | 1 |
| `client/src/pages/admin/RanksAdmin.tsx` | 1 |
| `client/src/pages/admin/ShipsSurveysAdmin.tsx` | 1 |
| `client/src/pages/reports/IhmReports.tsx` | 1 |
| `client/src/pages/reports/SparesConsumptionPatternReport.tsx` | 1 |
| `server/middleware/auth.ts` | 1 |
| `server/modules/bulk-upload/services/helpers.ts` | 1 |
| `server/modules/bulk-upload/services/importService.ts` | 1 |
| `server/modules/components/repositories/componentRepository.ts` | 1 |
| `server/modules/components/services/componentService.ts` | 1 |
| `server/modules/ranks/service.ts` | 1 |
| `server/modules/reports/services/sparesReportService.ts` | 1 |
| `server/modules/spares/controllers/inventoryController.ts` | 1 |
| `server/modules/spares/services/inventoryService.ts` | 1 |
| `server/modules/work-orders/utils/spareConsumptionDelta.ts` | 1 |
| `server/replit_integrations/image/routes.ts` | 1 |
| `server/vite.ts` | 1 |
| `shared/schema.ts` | 1 |

## 2. Root-cause analysis

The groups below are causal groups, so some groups contain several diagnostic codes. Their evidence is reconciled by the exact code, area, and file inventories above.

### A. Defect form schema and React Hook Form incompatibility

**Classification:** Genuine type issue with legacy duplication and possible dependency/generic amplification  
**Primary evidence:** 42 diagnostics in the active exact form, 21 in archived defect forms, including all 38 TS2719 diagnostics  
**Likely leverage:** Largest concentrated correction

The active and archived defect forms derive a form type from a Zod insert schema, but edit-mode defaults and handlers use a wider persisted-record shape. For example, `id` is supplied to defaults even though it is not accepted by the inferred create form. The mismatch propagates through `useForm`, resolver, `FormField`, `Controller`, submit handlers, field names, and modal payloads.

The TS2719 wording says two same-named `Control` types are unrelated. In this context that does not prove two installed copies of React Hook Form; it can also be produced by deeply incompatible instantiations of the same generic type. Package resolution must be checked before changing dependencies. A single authoritative create/edit form contract and consistent generics should be established before touching individual field errors.

**Potential behavior impact:** Defect create/edit payloads, validation, critical-cause data, identifier handling, and field registration.

### B. Shared schema, inferred database type, and API contract drift

**Classification:** Genuine contract issues; some may represent stale consumers  
**Primary evidence:** Large portions of TS2339, TS2345, TS2322, TS2353, TS2304, and TS2305  
**Risk:** High to very high

Representative mismatches:

- Work Order history reads three checklist/status properties from `WorkOrderExecution`, but the execution table/type does not declare those properties.
- PMS dashboard consumers expect scope metadata and Work Order properties absent from their declared types.
- `postgresStorage.ts` references fields or symbols such as grace-setting types, recurrence/postponement properties, and insert shapes that do not match current shared declarations.
- running-hours service code reads request properties that are absent from its validated request type.
- job-due scanning returns `blockingWorkOrder` where the declared result does not include it.
- chat storage imports `conversations` and `messages`, while the shared schema does not export them.
- the form-editor factory imports a missing `Form` export.
- authentication state constructs `PublicUser` values that omit required database-derived audit fields.

These cannot safely be resolved by adding fields to shared types until persistence and wire behavior are confirmed. In several cases, the consumer may be stale; in others, the shared contract may be behind the runtime implementation.

**Potential behavior impact:** Database reads/writes, sync serialization, API payloads, authentication/session state, Work Order history and completion, running-hours updates, due-job blocking, chat, and dynamic forms.

### C. Strict-null and response-shape handling

**Classification:** Genuine type-safety issues  
**Primary evidence:** All 26 TS18048 diagnostics plus related TS2322/TS2345 diagnostics  
**Risk:** Low to high depending on endpoint

Twenty-three TS18048 diagnostics are in Change Request reports, where `summary` is used without first proving it exists. The local query guard proves `reportData` exists but does not create a local non-optional `summary` value. This is probably a low-runtime-risk narrowing/default issue if the endpoint always returns a summary, but it may expose a real empty/error-response case.

The remaining TS18048 diagnostics concern possibly absent image response data. Those are higher risk because blindly asserting the data exists could turn malformed upstream responses into runtime exceptions.

Other nullability errors occur in storage and Work Order services where nullable database values are passed into required string contracts. Those require business decisions about whether null is valid, rejected, or normalized.

### D. Missing compiler target for iterable collections

**Classification:** Configuration issue  
**Primary evidence:** All 14 TS2802 diagnostics  
**Risk:** Medium

`tsconfig.json` specifies modern libraries and ES modules but no `target`. TypeScript therefore applies a legacy default target for type-checking. Direct iteration over `Set` and `Map` then requires either an ES2015-or-newer target or downlevel iteration.

Affected code spans ranks, reports, database initialization, certificate/survey services, Work Order utility code, and PostgreSQL storage. One compiler-target decision can remove all 14 diagnostics.

This is not automatically a zero-risk change. TypeScript target affects syntax transformation assumptions and can interact with test tooling and build output, even though Vite/esbuild already target modern execution environments independently. The supported browser and Node versions should be documented before selecting a target.

### E. Stale or incomplete imports inside the compiler boundary

**Classification:** Legacy/stale code and incomplete feature packaging  
**Primary evidence:** All 14 TS2307 diagnostics and part of TS2305  
**Risk:** Low if confirmed unreachable; high if the micro-frontend is supported

The micro-frontend entrypoint imports and re-exports four pages that are absent, yielding eight diagnostics. The form-editor factory imports an absent page and a missing schema export. An archived change-request page imports five absent modal/form modules.

The current `tsconfig` includes all client source files, including `_archived` and the micro-frontend entrypoint. The correct resolution is a product/build-boundary decision:

- restore/repoint the modules if those entrypoints remain supported;
- remove obsolete code if it is intentionally retired; or
- define separate type-check boundaries if archived/reference code intentionally remains non-buildable.

Excluding active code merely to lower the count would hide defects.

### F. Dependency API and declaration mismatches

**Classification:** Dependency/type-definition issues mixed with incorrect consumer usage  
**Primary evidence:** Rich text, retry integration, image integration, and part of the form cluster  
**Risk:** Medium

- Quill usage expects `container`, but the installed Quill/type declarations do not expose it as used.
- retry code accesses `AbortError` as a property of the retry function, which does not match the installed `p-retry` API.
- image integration code does not fully narrow response payloads.
- React Hook Form generic incompatibilities must be checked against the actual installed dependency tree before assuming a package duplication.

`skipLibCheck` is already enabled, so these are not diagnostics inside third-party declarations. They are incompatibilities at application call sites or between resolved public APIs.

### G. Local component, helper, and result-shape defects

**Classification:** Genuine local issues, often independent  
**Primary evidence:** Remaining TS2367, TS2740, TS2551, TS7006 and isolated TS2322/TS2345/TS2339 errors  
**Risk:** Low to medium, except server request/result boundaries

Examples:

- a component form compares a string value with a boolean;
- form-configuration state is treated as both an array and keyed object;
- form-schema editor calls a request helper with the wrong signature;
- IHM modal query data is inferred as `{}` and then read as a richer response;
- certificate administration callbacks lose contextual typing;
- Vite `allowedHosts` is supplied a boolean that is outside the installed Vite 5 declaration;
- component controllers pass an authenticated user shape that differs from service expectations.

These should be corrected against actual runtime contracts, not silenced.

## 3. Affected areas and regression exposure

| Proposed correction area | Surfaces affected | Risk | Why |
|---|---|---|---|
| Decide compiler boundaries for archived/micro-frontend code | Build/type-check process, optional micro-frontend packaging | **Medium** | Low runtime impact if truly dead, but excluding a supported entrypoint would remove protection and can ship broken exports |
| Select an explicit TypeScript target | Entire client/server type-check, tests, toolchain | **Medium** | Removes 14 deterministic errors, but target must match supported browsers and Node runtime |
| Unify defect create/edit form contracts | Frontend defects, Zod validation, defect APIs | **High** | A type-only-looking change can alter submitted identifiers, optional fields, validation, and edit behavior |
| Reconcile shared schema and database contracts | Shared types, database, migrations, storage, sync, APIs, frontend | **High/Very High** | Drizzle inferred types are upstream of persistence and sync; adding or removing fields without DB evidence risks data loss or query failures |
| Correct Work Order and running-hours contracts | PMS frontend/backend, completion, approval, RH audit and counters | **High** | These paths enforce dates, monotonicity, completion state, approval, and next-cycle calculations |
| Correct auth/PublicUser construction | Login/session, access control, vessel scoping | **High** | Runtime normalization mistakes can affect authorization or vessel visibility |
| Add report summary narrowing/defaults | Change Request report UI and exports | **Low/Medium** | Local guard is low risk, but inventing default business totals could hide malformed API responses |
| Correct integration APIs | Chat, image, retry behavior | **Medium** | Depends on optional feature use; wrong fixes can alter retries or response validation |
| Correct backend request/result shapes | Components, alerts, jobs, spares, reports | **High** | These contracts govern HTTP and database behavior, not just presentation |
| Correct isolated UI state/prop types | Form editor, IHM, component forms, rich text | **Low/Medium** | Usually local, but form serialization and rich-text content still need regression tests |

## 4. Minimum high-leverage change set

These are investigation recommendations only.

1. **Make an explicit source-boundary decision.** Decide whether `_archived`, micro-frontend, chat, and form-editor code are supported products. This separates actionable active errors from stale artifacts without weakening active checks.
2. **Adopt an explicit runtime-supported compiler target.** This addresses all 14 TS2802 diagnostics at one root. Validate it against the Node runtime and supported browsers rather than choosing only to reduce the count.
3. **Resolve defect form contracts as one unit.** Define authoritative create and edit payloads, align the Zod resolver and React Hook Form generics, and then handle identifiers and structured cause fields. Do not patch dozens of `control` sites independently.
4. **Reconcile shared contracts from persistence outward.** For each schema/API cluster, compare migrations and live table intent, Drizzle declarations, Zod schemas, storage interfaces, route responses, and consumers. Prefer changing stale consumers over expanding shared models without persistence evidence.
5. **Fix strict-null clusters at their boundary.** Narrow or reject missing endpoint data rather than using non-null assertions. Establish whether nullable database fields are valid business states.
6. **Verify installed dependency APIs before edits.** Check actual Quill, React Hook Form, and `p-retry` exports/resolution. Avoid dependency changes unless the existing application usage is intentionally tied to another version.

## 5. Existing versus recent assessment

- The baseline is distributed across 58 files and unrelated product areas, which rules out a single recent root cause.
- Archived pages and missing micro-frontend modules are structurally legacy/incomplete issues.
- The implicit TypeScript target is configuration debt, not a recent application regression.
- Shared schema and consumer drift accumulated across feature changes; repository history does not establish one origin for the whole group.
- Recent Work Order history/date work is sensitive, but the corrected `template.currentReadingDate` access is not a current diagnostic.
- The three checklist/status reads in `WorkOrderForm` remain a separate contract mismatch: the typed execution record does not own those fields. Their runtime owner must be confirmed before correction.
- Exact “introduced by” attribution should be done per remediation cluster with `git blame` and parent-commit compiler comparisons. A repository-wide count comparison alone would be misleading because the error baseline contains cascading diagnostics.

## 6. Recommended implementation order

1. **Freeze the baseline and support boundaries.** Preserve the 290/58 inventory and decide which archived, integration, and micro-frontend entrypoints are expected to compile.
2. **Remove configuration noise.** Choose and validate the compiler target and correct the Vite option against the installed version.
3. **Verify dependency contracts.** Confirm package resolution and public APIs for React Hook Form, Quill, and `p-retry`; avoid speculative upgrades.
4. **Reconcile shared/database/API sources of truth.** Handle authentication, Work Orders, running hours, components, forms/chat, and storage contracts in small domain-specific tasks.
5. **Correct backend boundaries.** Fix storage inputs, request validation, response/result shapes, and nullability with focused service/route tests.
6. **Correct active frontend consumers.** Address defect forms, reports, PMS, noon reports, IHM, and admin forms against the stabilized contracts.
7. **Handle confirmed legacy code separately.** Restore, remove, or isolate archived/micro-frontend code according to the support decision.
8. **Re-run and reclassify.** Cascading errors should disappear after upstream changes; do not pre-plan one edit per current diagnostic.

## 7. Verification plan for later remediation

For each future implementation task:

1. Run `npx tsc --noEmit --pretty false` before and after the coherent change; record removed and newly introduced diagnostics by code and file.
2. Run the production build because the current build pipeline and the TypeScript checker exercise different assumptions.
3. Run the complete automated test suite plus focused domain tests.
4. For shared schema/storage work, run schema consistency checks and validate migrations against a disposable database before production use.
5. For Work Orders and running hours, test create/edit, completion, approval/rejection, historical display, current-reading date, monotonicity, inherited/master/not-RH-driven counters, and legacy null records.
6. For defect forms, browser-test create, view, edit, validation, cause modals, and exact submitted payloads.
7. For authentication, test each role, vessel scoping, missing permissions, and serialized session/user responses.
8. For reports, test empty, partial, malformed, single-vessel, and multi-vessel responses plus PDF/Excel generation.
9. For integrations, test retry abort behavior and absent/malformed image/chat responses.
10. End each cluster with `git diff --check`, review of the exact diff, and a fresh diagnostic inventory.

## 8. Investigation integrity

The compiler was run with emission disabled. The investigation changed only this report. It did not alter application source, `tsconfig.json`, package manifests, lockfiles, shared schema, migrations, database state, dependencies, APIs, sync code, tests, or runtime behavior.