# Severe-risk compiler errors: impact and implementation decision

## Review outcome

This review authorizes no production correction. It adds isolated reproductions and records which corrections are ready to scope, which change behavior, and which need a policy decision. Production source, schema, synchronization, permissions and live records are unchanged.

The refreshed compiler baseline is **141 errors overall**, including the **21 reviewed diagnostics across eight files**. Those 21 remain deliberately unresolved. A passing reproduction suite is not a clean compiler or a declaration that current behavior is correct.

## Executed evidence

Run the review and unchanged regression suites with Vitest using a disposable configuration with the existing `@` and `@shared` aliases, Node environment, `restoreMocks: true` and one worker. The application Vite configuration is not modified.

New suites:
- `server/__tests__/severeIdentityImpact.test.ts`: 24 checks.
- `server/modules/work-orders/__tests__/severeCompletionImpact.test.ts`: 13 checks.
- `server/__tests__/helpers/severeSourceProbe.cjs`: read-only AST/source harness, not an application module.

The new suites provide **37 checks**, including **four expected failures** proving unresolved defects. With five unchanged regression suites, the run reports **112 regular passes, four expected failures and zero unexpected failures (116 checks)**:
- RH monotonicity: 15.
- RH comparator: 36.
- Bulk final completion dates: 5.
- Work Order Part A dates: 21.
- Spare inventory lifecycle: 2.

Expected failures assert intended behavior, rather than asserting a bug is desirable:
1. Stock upsert supplies its checked spare UUID.
2. Completed-parent document deletion is blocked.
3. Approved history is created even when SKIPPED history exists.
4. Repeated Calendar backfill does not duplicate the same cycles.

When an approved implementation fixes a corresponding defect, convert its `it.fails` reproduction into a normal passing regression test. Do not delete it, reverse its assertion, or leave the expected-failure marker hiding a repaired behavior.

### Isolation and limitations

Two full service entry points (dedicated completion and bulk approval) and the real finalizer run with fake repositories. Pure date, numbering and history helpers are actual code. Other storage/controller/validation probes execute uniquely selected source functions, methods or blocks with explicitly injected dependencies.

The source harness rejects unknown imports and supplies no process/network globals. Database, inventory transactions, file deletion, anomaly writes and field logging are fakes; no real database, scheduler or sync applier is exercised. Fixtures model NOT NULL/FK rejection from the declared schema, not PostgreSQL execution.

The generic PATCH history guard is a block-level reproduction, not a full authenticated request. The dedicated RH/Dual tests deliberately use a NOT_RH_DRIVEN component to isolate history inputs from actual counter propagation. MASTER/INHERITED live completion coverage remains with the existing broader RH testing work.

There is no claim of real two-instance sync, authenticated UI verification, concurrent number allocation, production-data inspection, or preservation of every role-specific lifecycle. Missing-context response policies remain unapproved.

## Corrected lifecycle finding

**The finalizer does not run skipped-cycle backfill.** Earlier source-level discussion incorrectly inferred a second call from a different function in the same file.

Executed service tests establish:
- Current bulk approval attempts SKIPPED creation with empty component identity. The fake component FK rejects this; the error is non-blocking. The actual finalizer subsequently creates ordinary Approved history.
- When valid SKIPPED records already exist, the actual finalizer sees them as existing Work Order history and does not create Approved history. Running it twice does not add more skipped rows.
- The generic PATCH history guard has the same SKIPPED-as-existing-history interaction at block level; its backfill precedes the ordinary-history lookup.
- Repeated **dedicated completion**, rather than the finalizer, repeats skipped-cycle insertion while ordinary Approved history is deduplicated.

Do not remove bulk backfill based on the false assumption that the finalizer provides it. A corrected bulk identity could activate valid SKIPPED insertion and thereby expose the Approved-history suppression. This is why completion-context fixes need a lifecycle plan, not blind property replacement.

## Diagnostic inventory and approval matrix

| Group and source | Errors | Verified source/value | Before / candidate after | Decision |
| --- | ---: | --- | --- | --- |
| Import creation: `server/modules/bulk-upload/services/importService.ts` | 1 | Factory-owned `components.cuuid` | Factory already generates and overwrites UUID; accurately declared input changes no executable method code | Ready for declaration-only plan, with storage-signature exception |
| Inheritance: `server/modules/components/services/componentService.ts` | 1 | Direct master identifier, then vessel-scoped code lookup | Direct null-vessel child/master pairing is accepted; blanket vessel rejection changes that behavior | Hold; preserve ID behavior and define missing-vessel code fallback/authorized assignment |
| Location stock: `server/modules/spares/services/inventoryService.ts` | 1 | Checked operational spare's `suuid` | New payload omits required UUID; canonical UUID candidate makes insertion possible | Runtime correction; include location/existing-row ownership decisions and tests |
| Documents: `server/modules/work-orders/controllers/woDocumentController.ts` | 2 | Document `workOrderId` references Work Order `wouuid` | Nonexistent property bypasses lookup/deletion protection; real property activates existing completed-status 403 | Rule restoration requiring explicit acceptance; orphan/cross-vessel responses separately defined |
| Bulk backfill: `server/modules/work-orders/services/workOrderBulkService.ts` | 2 | Resolved component `cuuid`, verified linked Job context | Empty component/absent job code can fail or lose linkage; correcting them can suppress subsequent Approved history | Hold with completion lifecycle group |
| Dedicated completion: `server/modules/work-orders/services/workOrderCompletionService.ts` | 7 | Three linked job-code values and four nullable Calendar/Dual frequency inputs | Approved history uses actual Job context; SKIPPED history loses job code. Missing value skips, missing unit throws | Hold pending missing-frequency policy, shared history context and retry proof |
| Generic completion backfill: `server/modules/work-orders/services/workOrderService.ts` | 3 | Resolved component and linked Job; validated calendar frequency | Absent job code and nullable inputs; SKIPPED rows can satisfy ordinary-history guard | Hold; full PATCH transition reproduction required before runtime edits |
| Unplanned numbering in that generic service | 2 | Existing vessel-required numbering helper contract | Helper rejects null already; earlier component read may be all-vessel. Earlier validation prevents that read and narrows type | Ready for bounded earlier guard; preserve existing error and format |
| Legacy feedback: `server/services/workOrderService.ts` | 1 | Component `name` | Current nonexistent description falls back to code; name candidate improves feedback only | Ready for feedback-only correction |
| Legacy audit in that service | 1 | Matching WO/component vessel context | Payload can contain null or prefer conflicting WO vessel; audit failure handling is best-effort for infrastructure errors | Hold; choose validation/save policy, never add live RH mutation |
| **Total** | **21** | | | |

### 1. Factory declaration

Target only the storage interface and implementation input declarations; the import may require no executable edit. The candidate signature emits an identical tested method body. Preserve callers that already pass UUIDs, the factory's current overwrite behavior, optional local ID handling, defaults and stored identity.

Before implementing, verify all creation consumers and compilation of the corrected interface/implementation. Do not relax persisted UUID requirements, add caller-generated throwaway UUIDs or modify rotational import undo.

Sync implication: none expected from declaration-only emitted code equality; no identity-generation or serialization change is authorized.

### 2. Inherited vessel context

The direct-ID resolver itself is not vessel-scoped; the subsequent ownership guard is. Both-null fixtures are accepted. Wrong-vessel fixtures are rejected. Code lookup requires a vessel.

Prefer explicit direct-ID handling when vessel is absent, with existing ownership validation, over weakening the resolver or inventing a vessel. Decide how authorized vessel reassignment and fleet records should behave before implementing.

Sync implication: replacing vessel association or master identity can redirect RH inheritance. Preserve canonical UUIDs and monotonic counters; this review provides no authority for reassociation.

### 3. Location stock

Retain the operational spare result and supply its canonical UUID. Existing-row quantity updates do not rewrite spareUuid; new-row insertion needs it. Storage auto-resolves locationUuid, not spareUuid.

Ship/shore fixtures use different local spare/location IDs and the same canonical spare UUID; candidate payloads preserve that canonical parent. This is not a test of actual receiving-side ID remapping.

A UUID-only caller correction does not read location ownership. Before activating new insertion, establish location ownership and existing row's spare/vessel/location agreement. Do not silently repair rows or change quantity semantics.

Sync implication: stock is bidirectional, keyed by `slsuuid` and scoped by vessel. Successful new insertion is a new logged/synced write. Prove both quantity-update and new-insert logging, stable parent UUIDs, correct local IDs and rejection before writes for invalid associations.

### 4. Document deletion

Correcting the real parent property blocks completed parents and preserves active deletion in the fixture. A field-only candidate retains orphan deletion and has no parent/document-vessel agreement check.

Approve completed-rule restoration explicitly. Define missing/soft-deleted parent and cross-vessel outcomes rather than adding unreviewed cleanup. Protected requests must invoke neither deletion nor file synchronization. Preserve existing status recognition and response for ordinary completed parents.

Sync implication: blocking deletion suppresses an existing delete operation. Documents are bidirectional and vessel-scoped; the table has a text key, not a new UUID to invent.

### 5. Completion/history

Resolve one verified component/Job/WO context. Ordinary history already resolves Job `jobNo`; skipped history incorrectly reads an absent Work Order property. Retain canonical component, Job and Work Order UUIDs and vessel-scoped legacy fallbacks.

Calendar/Dual interval validation should not invent values. Recommended policy is explicit warning and omitted optional backfill for invalid legacy frequency while otherwise valid completion succeeds, but the user must accept this policy. Do not change Job next-due calculations as a side effect.

Distinguish SKIPPED history from Approved completion history, and define retry identity for skipped cycles before enabling bulk insertion. Establish sequential and concurrent idempotency separately. Do not update immutable history in place or use arbitrary regenerated IDs as proof of logical deduplication.

Tests preserve the 104-record cap and existing RH date/interval arithmetic. Finalizer spare consumption is observed once across retries through the canonical WO reference; older dated RH finalization removes RH cycle writes. These narrow observations are not full lifecycle certification.

Sync implication: maintenance history is bidirectional, vessel-scoped and immutable, with `cmhuuid` row identity. Two rows with different UUIDs can still represent a duplicate logical cycle; duplicate delivery of one UUID and duplicate creation of one cycle are different problems. Preserve the current sync registry/applier and fix producer lifecycle only in an approved scope.

### 6. Numbering

Require/narrow vessel before the unplanned component retrieval in the generation branch. Preserve the helper's existing missing-vessel error/details and verified-vessel lookup. A real vessel without `v_code` intentionally retains the transitional legacy format; do not reject that supported state.

No allocation scheme, format, planned-numbering change or old-number rewrite is proposed. Test valid/absent/wrong-vessel inputs and actual concurrency separately.

Sync implication: avoid widened reads and incorrect references; do not change persisted WO identity or numbering ownership.

### 7. Legacy snapshot audit

Feedback-name correction is independent of audit-vessel policy. A matching vessel must not be fabricated from `V001` or another record.

Choose whether missing/conflicting vessel is a request validation failure or a reported best-effort audit omission. Preserve existing RH/date validation and exception behavior. No live RH counter, inherited cascade or stamp mutation is authorized.

Sync implication: audit is bidirectional and vessel-scoped with `rhauuid` identity. The tested payload must not be mistaken for a verified association or successful DB insert.

## Recommended implementation boundary

Recommend a separately accepted implementation plan for:
1. **Four lower-risk errors:** factory declaration (1), feedback name (1), earlier existing numbering requirement (2).
2. **Three runtime errors**, only with accepted behavior and ownership response contracts: stock UUID (1), completed-parent attachment protection (2).

The seven-error candidate scope would touch:
- `server/storage.ts` — type declaration only.
- `server/postgresStorage.ts` — matching type declaration only.
- `server/modules/spares/services/inventoryService.ts`.
- `server/modules/work-orders/controllers/woDocumentController.ts`.
- `server/modules/work-orders/services/workOrderService.ts` — numbering branch only.
- `server/services/workOrderService.ts` — feedback expression only.

The remaining **14 diagnostics** require separate inheritance/history/audit policy and lifecycle scope. They are not authorized by acceptance of a seven-error plan.

Do not overlap Pending Approval workflow changes, broad RH MASTER/INHERITED coverage, rotational undo, permissions, audit-column migrations or general storage cleanup.

## Adjacent IHM issue

Outside the 21. Modal GET uses `/technical/api/ihm/{type}/{id}`, POST uses `/technical/api/ihm`, and the save payload retains V001. The prior read-only HTTP check returned route-not-found; narrow route-registration search during this review did not establish a reachable handler. This is not proof that every possible registration is absent.

No save request, file upload or vessel correction was executed. Endpoint reachability and an authorized component/spare vessel source require a separate investigation, not a compiler suppression or schema change.

## Production preservation

Git comparison confirms no changes to the eight diagnostic-bearing sources, either storage source, shared schema/sync registry or sync module. Only isolated review tests/harness and this report are added. No schema migration, package/configuration change, live write or explicit workflow restart was needed.
