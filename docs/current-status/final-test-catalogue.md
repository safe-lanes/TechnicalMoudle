# Work Order current_status — Final Test Catalogue and Review Reference

> Reference document. It records the agreed 36-case synchronized catalogue, the Ghazi review findings, and supplemental tests still requiring specification.

## Scope baseline
- `current_status` is nullable calculated identification data.
- Authoritative `status` remains unchanged.
- Existing UI and all business operations remain unchanged.
- Existing status mismatches are identified, not repaired.
- The earlier Task #462 plan included bidirectional ship/shore synchronization.
- A vessel-local/no-sync phase is an alternative proposal.

## Decision gates

### DG-1 — Synced or vessel-local
Choose one before implementation:
- **Synced:** changed post-initialization projections generate explicit events and travel ship/shore.
- **Vessel-local:** scheduler projection writes create zero field logs and incoming remote projection values are stripped.

### DG-2 — Exact calculator or protected wrapper
Choose one invariant:
- `current_status === computeWorkOrderStatus(authoritative inputs)`; or
- `current_status` uses the calculator plus additional workflow-authority overrides.

### DG-3 — Reopened
The current calculator deliberately returns a date/RH band for Reopened. The earlier catalogue expects `Reopened`. The final expected result depends on DG-2.

### DG-4 — Timestamp
Choose whether real projection changes update general `work_orders.updated_at` or a dedicated projection timestamp.

---

# A. Status calculation and priority

## TC-01 — Normal scheduler transition
**Setup:** `status=Due`, `current_status=Due`; threshold now calculates Overdue.  
**Expected:** only projection and selected timestamp change; authoritative status and source inputs do not. Under synced scope, exactly one scheduler projection event is created.

## TC-02 — Same calculated value
**Setup:** current and calculated projection are Due.  
**Expected:** no Work Order UPDATE, timestamp change, field log, or duplicate event.

## TC-03 — NULL initialization
**Setup:** existing row has NULL projection and a reliable calculated value.  
**Expected:** populate locally without ordinary sync backlog. Initialization does not bump the general sync timestamp. Repeat and interrupted runs are safe and resume with remaining NULL rows.

## TC-04 — Completion mismatch identification
**Setup:** authoritative status Overdue, completion data populated, not rejected.  
**Expected:** projection becomes Completed while status remains Overdue. Do not treat `approval_action` as a calculator input unless the production calculator is changed.

## TC-05 — Pending Approval authority
**Expected:** obsolete scheduler Overdue does not replace Pending Approval; terminally acknowledge under synced scope.

## TC-06 — Completed authority
**Expected:** offline scheduler Overdue does not replace Completed, regardless of later scheduler timestamp.

## TC-07 — Rejected authority
**Expected:** scheduler Completed/Overdue does not replace Rejected.

## TC-08 — Pending Office Review authority
**Expected:** scheduler does not project final completion before office review completes.

## TC-09 — Postponement authority
**Expected:** Postponed and Postponement Approved outrank older scheduler bands.

## TC-10 — Reopened behavior — unresolved
**Existing calculator:** returns an Active/Due/Grace/Overdue band.  
**Earlier catalogue:** expects Reopened.  
**Required:** assert the result selected by DG-2/DG-3; do not retain contradictory expectations.

## TC-11 — Authoritative calculator input
**Expected:** pass `wo.status`, never previous `current_status`, to the calculator.

## TC-12 — Unreliable calculation
**Expected:** preserve previous projection, modify no authoritative data/timestamp, and create no projection event. NULL previous remains NULL. Increment a bounded diagnostic or operational counter without log flooding.

## TC-12A — Complete pass-through matrix
Cover Pending Approval, Pending Office Review, Awaiting Office Approval, Postponed, Postponement Approved, Postponement Rejected, Completed, and Rejected according to the selected invariant.

## TC-12B — Calculator-equality matrix
For representative calendar, RH, completion, rejection, postponement, approval, and reopened rows, compare persisted projection with the selected calculation contract.

---

# B. User-versus-scheduler concurrency

## TC-13 — User update during scheduler calculation
Use a SQL conditional update/compare-and-swap. A concurrent status/input change causes zero affected rows, no stale event, reread, and recalculation.

## TC-13A — Overlapping scheduler runs
Only one pass processes candidates. The overlapping pass exits or waits by policy; no duplicate events occur; lock cleanup works after success and failure.

## TC-14 — Shore completion while ship offline
Under synced scope, shore workflow immediately projects Completed in the same workflow transaction. Under vessel-local scope, shore projection remains NULL and must affect nothing.

## TC-15 — Stale ship event after shore completion
Protected Completed authority rejects the stale scheduler value before timestamp comparison.

## TC-16 — Newer scheduler timestamp versus workflow authority
A newer scheduler timestamp cannot defeat protected user workflow authority.

## TC-17 — Projection based on older due inputs
Reject a scheduler event calculated from an older input basis. Define the exact version/fingerprint before implementing this test.

## TC-18 — Later user event supersedes scheduler event
Send the authoritative user-workflow event; only after its acknowledgement may older scheduler projections be superseded.

## TC-19 — Same value, stronger source
User-workflow authority must be persisted/promoted even when the projection text does not change. Define where that authority is stored.

## TC-20 — Reopened versus historical completion
Expected result follows DG-2/DG-3. Historical completion evidence must not bypass the selected authoritative Reopened policy.

---

# C. Sync event and ordering

> TC-21 through TC-33 apply only if DG-1 retains synchronized projection delivery.

## TC-21 — Explicit event source
Every projection event has a defined source enum. Define producers and authority for scheduler, user_workflow, completion_projection, repair, and conflict_resolution—or remove unused categories.

## TC-22 — Source travels with value
Source and calculation basis are metadata on the same event, not independently synchronized fields.

## TC-23 — Projection update and event transaction
Projection/timestamp update and field-log insertion use one transaction. Logger failure rolls back the row update.

## TC-24 — Remote apply creates no return event
Remote application uses sync bypass; equal value is a data no-op but original event is acknowledged.

## TC-25 — Duplicate log UUID
After lost acknowledgement and restart, redelivery is a durable no-op and is acknowledged. Define dedup storage, unique constraint, transaction boundary, and retention.

## TC-26 — Inputs before projection
Apply status-relevant inputs first, then validate/recalculate the dependent projection against updated receiver data.

## TC-27 — Required input fails
Do not apply or acknowledge the dependent projection. Keep it retryable until required input succeeds.

## TC-28 — Higher authority rejection
Do not apply obsolete scheduler projection; terminally acknowledge without requiring a durable reason code.

## TC-29 — Receiver used newer inputs
Reject and terminally acknowledge an incoming calculation based on an older basis; preserve authoritative status.

---

# D. Offline coalescing

## TC-30 — Multiple scheduler changes offline
Send only the latest valid scheduler projection, not intermediate bands.

## TC-31 — Coalescing scope
Coalesce only older scheduler projection logs for the same Work Order. Preserve remarks, completion, approval, and all unrelated field logs.

## TC-32 — No acknowledgement
If latest acknowledgement is lost, latest remains retryable and older projections remain excluded but not finalized.

## TC-33 — Interrupted supersession cleanup
Acknowledging latest and superseding older scheduler events is atomic. Failure rolls the whole sender-side operation back; older events can never re-enter selection after successful acknowledgement.

## TC-33A — Failure-boundary matrix
Test response loss, transaction failure before marking, rollback after partial attempted cleanup, successful atomic commit, and preservation of unrelated/user-workflow logs.

---

# E. Database and usage boundaries

## TC-34 — No business use
No generation, completion, history, spares, approval, RH, lifecycle, authoritative reporting, or other business query reads `current_status`.

## TC-35 — UI independence
NULL or stale projection does not change displayed status, tab placement, filters, or existing computed-status behavior. Include shore-NULL behavior if vessel-local scope is selected.

## TC-36 — Timestamp on genuine change
Expected behavior follows DG-4. Unchanged and unreliable calculations never change timestamps. Initialization does not bump the normal sync timestamp.

## TC-36A — Timestamp consumer impact
Verify recently-updated lists, sorting, audit displays, cache behavior, and sync gathering do not produce misleading or excessive effects from scheduler-only changes.

---

# F. Migration, operations, and observability

## TC-37 — Idempotent numbered migration
The next available numbered SQL migration uses safe guards and succeeds twice without duplicate-column/index errors.

## TC-38 — Fresh empty database
Run the complete migration chain on a fresh database. Verify nullable projection and required event metadata exist and match the application schema.

## TC-39 — No unsafe constraint/default
No default such as Active, no authoritative-status rewrite, and no restrictive status CHECK unless explicitly required and compatible with synchronized-table conventions.

## TC-40 — Interrupted initialization
Initialize several batches, interrupt, restart, and complete remaining NULL rows with no duplicate field logs or timestamp churn.

## TC-41 — Bounded scheduler query behavior
Use bounded candidate batches and bulk related-data loading. Assert query/batch counts avoid per-Work-Order N+1 behavior and unbounded memory use.

## TC-42 — Unreliable-input observability
Skipped calculations are counted/logged in a bounded operational mechanism while preserving existing projection and generating no event.

## TC-43 — Discrepancy report
Provide a runnable query/report that identifies projection mismatches under the selected invariant and separately reports NULL/unreliable rows.

## TC-44 — Concrete no-business-read gate
Automated/static verification permits projection reads only in schema, migration, scheduler, projection, sync, diagnostics, and tests; reject use by UI/business modules.

## TC-45 — Behavioral rollback
Disabling the projection pass and leaving values NULL/stale causes no UI or business failure and requires no authoritative-status repair.

---

# Excluded unless scope changes
- Automatic repair of authoritative `status`.
- General completion-sync atomic redesign.
- Direct-database Work Order deletion with pending projection event.
- Mixed-version ship/shore compatibility, unless synchronized protocol rollout later requires it to be reconsidered.

# Coverage status

## Previously required by Task #462
TC-01–TC-09, TC-11–TC-36 in principle; numbered idempotent migration; initialization without backlog; transactional logging; sync ordering; terminal/retryable outcomes; coalescing; duplicate requirement; UI/business isolation.

## Requires an explicit decision
DG-1 through DG-4, especially TC-10 Reopened behavior and general timestamp policy.

## Supplemental gaps retained for future work
TC-12A, TC-12B, TC-13A, TC-33A, and TC-36A through TC-45, plus concrete definitions for calculation basis, dedup storage, source enum, and same-value authority persistence.