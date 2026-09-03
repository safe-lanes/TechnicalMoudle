# Defects × Approval Engine — Integration Report (Phase B)

Branch `feature/approval-engine-phase2`, commit `cdc6a9677` (03-Sep-2026). Second real use of the
engine. Scope per the product owner's final simplification: **Extension and Verification on the
engine; Closure OUT of the workflow (Master-only permission rule); TWO classifications
('Critical Equipment / COC Related' / 'Normal'); criticality from the linked component's
Criticality field; same office roles + strict vessel scoping as Technical; raising needs no
approval.** Nothing pushed.

## 1. The B2/B3 proposals and what was chosen

**B2 (wiring shape) — chosen: detect inside the PATCH service** (approved). Defects' only live
write path is the generic `PATCH /defects/:id` (Phase A), so the gate lives in
`defectsService.updateDefect` → `gateDefectUpdate` ([defectsApprovalHooks.ts](server/modules/defects/services/defectsApprovalHooks.ts)).
Dedicated endpoints were rejected: they would still require the same raw-PATCH guard to be safe,
i.e. strictly more code for the same gate. The dormant `PATCH /defects/:id/close` route stays
HTTP-reachable, so it received the same Master rule ([defectsService.ts:139](server/modules/defects/services/defectsService.ts:139)) — no side door.

Key mechanic: **"does a chain govern this subject?" is probed by submitting** —
`engineSubmitOutcome` (engineGateway) returns STARTED/ALREADY_PENDING (governed → refuse or
downgrade the direct write) vs NO_WORKFLOW/DISABLED/engine-off (legacy passthrough, byte-identical).
An approver's radio/verify click IS the decision: the gate translates it into `engine.decide`
(engine 403s non-approvers), then drops the client's approval fields — `onDecision` already wrote
the authoritative state through the synced repo path.

**B3 (extension UX) — chosen: ship = submit-only** (approved, including the deviation).
On ship instances the B5 "Approved?" radios/approval fields are not rendered
([DefectFormWizard.tsx](client/src/pages/defects/DefectFormWizard.tsx), `isShore` gate) AND the ship
server forces new entries to 'Requested' and 403s decision attempts — chain or no chain.
**⚠️ DEPLOY NOTE — deliberate, product-approved deviation from the byte-identical fallback:** ship
officers lose in-form self-approval even before any workflow is configured. Reasoning: the ship
cannot query the shore-only engine for configuration, and ship-side self-approval is exactly the
behaviour the product owner asked to end; the alternative (shore reverting synced self-approvals)
is ugly data rewriting. Office-side fallback IS byte-identical (radios work when no chain exists).

## 2. What was built (path:line)

| Piece | Where |
|---|---|
| Defects card (2 scopes × 2 classifications, classify, resolveApprovers, onDecision) | [server/modules/defects/approvalCard.ts](server/modules/defects/approvalCard.ts) |
| Classification: `components.critical` (linked component) OR `defects.is_coc` → critical bucket | approvalCard.ts `classifyDefect` (:56) — **Criticality ONLY, not classItem** (product correction; Technical's predicate untouched) |
| Shared D-1 role resolution extracted for all cards (classification-free by design) | [server/modules/approvals/approvalCard.ts](server/modules/approvals/approvalCard.ts) `resolveRoleApproverUserIds` |
| The PATCH gate + idempotent applies + arrival-sweep leg | [server/modules/defects/services/defectsApprovalHooks.ts](server/modules/defects/services/defectsApprovalHooks.ts) |
| Gate wired into the service; Master rule on `/close` too | [defectsService.ts:49](server/modules/defects/services/defectsService.ts:49), :139 |
| Actor (uuid + x-rank rank) threaded from the controller; 403/409 surfaced | [defectsController.ts](server/modules/defects/controllers/defectsController.ts) `defectActor`/`sendDefectError` |
| Gateway generalized (scopeFor, *Scoped helpers, submit-probe); Defects sweep leg | [server/modules/approvals/engineGateway.ts](server/modules/approvals/engineGateway.ts) |
| Card registered (one line) | [mount.ts:29](server/modules/approvals/mount.ts:29) |
| Wizard: ship submit-only B5; Part C1 Master-gated client-side; error surfacing | DefectFormWizard.tsx |
| Admin matrix: Defects = 2 scopes × 2 variables, Closure removed | [ApprovalWorkflow.tsx](client/src/pages/admin/ApprovalWorkflow.tsx) |
| Guide → v2 (§3e generic-write-path modules, §3f second-card corrections) | [INTEGRATION-GUIDE.md](server/modules/approval-engine/INTEGRATION-GUIDE.md) |
| Tracked harness (36 checks) | [scripts/test-defects-approvals.ts](scripts/test-defects-approvals.ts) |

**Closure (B4):** "Master" is a canonical rank (`adm_available_ranks`); the only server-visible
rank source is `req.user.rank_name` from the SAILERP-forwarded `x-rank` header (auth.ts:196 —
`master_users` has no rank column). Enforced server-side on BOTH the PATCH (any C1 field changing)
and the dormant `/close` route; client mirrors it (C1 inputs disabled + note for non-Masters).
Trust boundary: the forwarded header — same level as all Phase-0 auth (the known mock-identity
hardening backlog applies platform-wide, not specific to this rule). No admin override was built
(product said Master only); flagged: support/ops corrections go via SQL. Configurability
(CE/CO/2E later) was NOT built — it is cheap (a rank-set constant → a per-vessel setting) but not
trivially free (needs a settings column + UI), so per instructions it was not built unasked.

**Old awc rows (B5/B6):** the 9 `module_id='defects'` rows (3 functions × 3 old variables) were
decorative (nothing ever read them) and their shape doesn't map to the new 2×2 model (two old
variables merge into one bucket; closure is gone). They remain in `approval_workflow_config` as
unread orphans — harmless; the matrix screen no longer displays them and saves under the new ids.
**Generator conversion deliberately SKIPPED**: converting config that never gated anything would
mint chains nobody asked for. Admins configure fresh workflows in the 2×2 matrix / engine builder.

**Migrations: ZERO**, as predicted. tsc = 294 (baseline held).

## 3. Guide corrections (same commit)

- New **§3e** — modules with ONE generic write path: gate inside the PATCH, gate every reachable
  route (side-door rule), the submit-probe pattern, decision-click-as-decide. Worked example
  referenced.
- New **§3f** — what a second card actually needs: `onPending` is optional (engine-level onEvent
  notifier covers all cards — the card template over-sold it); registration is one line;
  first-time-approval modules' fallback = the UNGATED legacy (self-approval included) and §3d
  cutover is N/A; decorative config should not be migrated; role resolution shared, classification
  predicates per-card by explicit product decision.
- Title bumped to v2.

## 4. Proof

**Harness (`scripts/test-defects-approvals.ts`, tracked): 36/36 PASS × 3 consecutive runs** on the
pilot — extension e2e approve AND reject through a configured chain (entry updated, remarks kept,
targetCloseDate advanced on approve only, engine request terminal); created-as-approved downgraded
to Requested with the chain raised; requester self-approve 403; same-role UNASSIGNED office user
403 (**strict vessel scoping: out-of-scope = read-only**); no-chain fallback saves the legacy
self-approve VERBATIM with zero engine rows; **Master-only closure**: non-Master 403 / Master 200 /
dormant `/close` 403; verification chain auto-submitted by the Master closure, non-approver
refused, approver verify → `verified=true` stamped with the DECIDER's identity, request terminal;
**B7**: unconfigured classification verify → legacy passthrough, no error, no engine row; COC flag
alone → critical bucket.

**Live ship probe** (pilot ship rebuilt at `BUILD_COMMIT=cdc6a9677`, re-provisioned 10,462 rows
errors=0): ship self-approve PATCH → stored 'Requested' (forced); ship decision attempt → 403;
sync ship→shore (pushed=30) → **arrival sweep raised the pending chain on shore with the correct
critical-bucket classification**. Ship+shore probe data cleaned both sides.

**Guide 9-point checklist:** 1 boot with both cards ✓ (mount log; broken-card refusal covered by
engine registration tests) · 2 registry lists Defects ✓ · 3 no-workflow byte-identical ✓ (D, F-b)
· 4 configure→submit→pending→approve→onDecision-once→data→sync-carried ✓ (C, field-logged via
repo) · 5 reject→returned with remarks ✓ (C-c) · 6 replay-safe ✓ (idempotent applies; engine 409
covered by engine suites) · 7 disabled-scope fallback ✓ (same outcome branch as NO_WORKFLOW;
engine-level toggle proven in phase2-shore F) · 8 second tenant — N/A on the single-tenant pilot
(engine tenant isolation proven by its own suites) · 9 `npx vitest run server/modules/approval-engine
server/approval-demo` → 32 passed, 5 skipped ✓.

**Regression battery, production defaults:** p01–p04 ALL PASS · p03-ship ALL PASS · phase2-ship
ALL PASS · phase2-shore ALL PASS. (Ship legs required the standard post-rebuild re-provision —
the rebuild resets provision-delivered tables; pre-existing pilot behaviour, not this change.)

## 5. Effort — the reuse figure

- **Phase A (inventory): ~50 min.** **Phase B (proposals + build + verification): ~4 hours.**
  Total ≈ **half a day — matching the prediction.**
- **What the engine gave for free:** chain persistence/sequencing, quorum, approver resolution
  scaffolding, decide authorization (403/409), exactly-once onDecision, admin builder + registry
  UI, notifications, tenant isolation, status API. The card itself is ~140 lines; registration one
  line.
- **What had to be built from scratch (~2/3 of the effort), and would be needed for ANY approvals
  on Defects, engine or not:** the PATCH-diff gate (~230 lines) — because Defects had NO
  server-side approval surface at all; the two idempotent applies; the Master closure rule; the
  ship UX change; the harness. **Honest conclusion:** for a module that already has approve
  endpoints (like Technical), the engine cuts integration to card + hooks (~a day); for a module
  with no approval surface, the engine still halves the work — the enforcement seam must be built
  either way, but chains/approvers/admin/notifications come free.

## 6. Follow-ups (not built, flagged)

- Closure-rank configurability (Master + CE/CO/2E per client) — cheap once asked for.
- The legacy `submitForApprovalTo` person-dropdown is now advisory only; could be hidden later.
- Dead pages (DefectsActive/DefectsLog/DefectFormExact) still carry closure surfaces — cleanup
  candidate (they are unrouted; the service-level gates cover their endpoints).
- Rank trust rides the platform-wide mock-identity hardening backlog.
