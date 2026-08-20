# Phase 2 — Technical wired onto the Approval Engine (CR + Postponement paths) — BUILD REPORT

**Branch:** `feature/approval-engine-phase2` from `feature/approval-engine-phase1` HEAD (`10a03b72f`). **Date:** 2026-08-20. **Commits:** `ade66f48d` wiring (+ this report/guide commit). Not merged, not pushed; Replit fork untouched.
**Decisions applied as given (D-1..D-4), none reopened.** Scope held: CR (all 5 target types — `work_order`-target CRs have no awc function, hence no engine scope, legacy always; the other 4 are wired) + postponement + re-postponement. WO completion / bulk / review queue / superintendent lock-ack untouched (D-3, Phase 7).
**Baselines:** tsc **290 → 290** · full vitest **176 passed** (an earlier run had 2 flaky 5-s import timeouts while the docker build was running; isolated re-run and idle full run both green) · `npm run build` clean · **migrations: zero** · engine folder untouched **except the mandated guide fixes**.

---

## 1. What was wired (path:line)

**W1 mount** — `server/routes.ts:56-57` → `server/modules/approvals/mount.ts`: `startEmbedded` at `/technical/api/approval-engine`, **shore-only** (`isShipInstance()` → skip + log; proven on the ship container: "Approval engine NOT mounted"). Injected per v3 §A7/§A5: `AlsTenantRepositoryProvider` + `resolveTenantId` both read the SAME ALS tenant context (`tenantProvider.ts` — refuses on mismatch), `requireConfigWrite = requireRole(['Office','PMS Admin','Sail Admin'])` (Phase-0 semantics), `onEvent = approvalEventNotifier`.

**W2 Technical card** — `server/modules/approvals/approvalCard.ts` (outside the engine folder; boundary test still green):
- scopes = `pms-components-cr`, `pms-jobs-cr`, `pms-spares-cr`, `pms-stores-cr`, `pms-wo-postponement`, `pms-wo-re-postponement`; classification ids = the awc variableNames (stable config keys, 1:1 with the generator).
- `classify` **reuses the existing logic**: `classifyChangeRequestScope` extracted as the single source in `changeRequestsService.ts:236-291` (the legacy `submitChangeRequestWorkflow` now consumes it too — behaviour byte-identical, proven by the unchanged Phase-0 harnesses), `classifyWoForPostponement`/`ForRePostponement` exported (`workOrderService.ts:2734/:3112`).
- `resolveApprovers` per **D-1** (`approvalCard.ts:113-135`): `moc:Level N` pools → the exact `verifyApproverForLevel` set; real ruids → `admn_role_master` name → `master_users.role` join; `roletype='Ship'` roles additionally filtered by login-captured `master_user_vessels` for the subject's vessel; Office roles fleet-wide. **Staleness caveat documented in the card file** (assignments refresh at login).
- `onDecision` (`:139-176`) → the Phase-0-hardened legacy finalise services (CR approve/reject, postponement/re-postponement approve/reject); already-decided answers are the idempotent no-op signal.

**W3 integration points** (the inventory's spots):
- submit hooks: `changeRequestsService.ts:349-364` (after legacy snapshot+steps; loud XOR warning), `workOrderService.ts` submitPostponeRequest (`:2851-2861`) and submitRePostponeRequest (`:3306-3311`).
- **arrival point**: `approvalArrivalSweep` (`engineGateway.ts:96-136`) fired from the sync complete handler `sync/controller.ts:191-203`, fire-and-forget next to the existing WO-reconciler trigger (the explicitly instructed touch in the sync module), idempotent; covers ship-created CRs AND ship postponement requests; postponement-vs-re-postponement split = an `Approved` decision row already exists ⇒ re-postponement (matches how `submitRePostponeRequest` becomes reachable).
- **engine-first decide** after every existing safety check: CR `changeRequestsService.ts:421-436` (approve) / `:467-477` (reject); postponement `workOrderService.ts:2889-2900` / `:3017-3025`; re-postponement `:3360-3368` / `:3479-3487`. Non-terminal → entity returned unchanged; terminal → `onDecision` re-enters the legacy path (no pending request left → zero-step branch applies). `EngineError` → `AppError` translation in `engineGateway.ts` so 403/409 reach the client as before.
- status in the screens: `client/src/components/approvals/ApprovalChainProgress.tsx` (`useApprovalChain` fail-soft hook + progress renderer); `modifyPms/ModifyPMS.tsx` (engine gate folded into `userCanAct`; progress in the detail dialog); `PostponeApprovalDialog.tsx` (both WO scopes checked; progress under the title). With no chain the components render nothing and the legacy gating is untouched.

**W4** — `SideMenuBar.tsx:149-153` "Approval Engine" (admin, shore-only, non-vessel) → `TechnicalModule.tsx` → `pages/admin/ApprovalEngineAdminPage.tsx` wrapping the generic builder with `basePath /technical/api/approval-engine`. Legacy `ApprovalWorkflow.tsx` untouched and still routed.

**W5** — `scripts/generate-approval-workflows-from-awc.ts` (tracked one-off tool, dry-run default, `--apply`, `--tenant`): awc rows → linear workflows with quorum-`any` moc-pool slots per enabled level; **approver-set equality asserted per workflow** (old moc pool == union of `resolveApprovers` over slots; run aborts on mismatch); empty-pool scopes skipped with an actionable warning; per-tenant support report written (sample from the pilot run: `docs/output/approval-cutover-pilot-2026-08-20.md` — states the pool per level, the UNCHANGED approver set, the XOR cutover rule, and that narrowing only occurs if support later swaps pools for named roles). awc untouched by the new path.

**Notifier (W1 deviation, FLAGGED):** the assumed "existing in-app + SES surface" for approvals does not exist — the validation report already recorded CR/postponement approvals fire NO notifications today; `alert_events` needs an `alert_policies` FK we cannot seed without a migration (zero-migration rule), and the only mailer is the noon-report SMTP transport. `approvalNotifier.ts` therefore: structured logs + persistent `audit_log` rows per event (`entity_type='approval_request'` — asserted in the harness) + one `deliver()` seam where the real transport plugs in once the product picks it (alert-policy seed row or a new table — decision for Ghazi/Jeevan).

## 2. Test matrix (all executed; logs in `local-test-env/p2-*.log`)

| leg | checks | result |
|---|---|---|
| **Fallback contract (sacred)** — pre-Phase-2 harnesses UNCHANGED, engine mounted, no workflows | Phase-0 `p03` (CR+postponement legacy, 18) · `p04` (guards, 25) · `p01` (RBAC battery, 16; one stale pre-P0.4 expectation updated to the P0.4-correct 403) · **`p03-ship` full ship→shore→ship legacy (21)** | **ALL PASS** |
| Engine suites | vitest engine + demo + middleware (51) · full repo suite 176 | green |
| **Shore engine-path harness** (`test-phase2-shore.ts`) | chain save 403/201; listRoles ruids+pools; CR: STARTED (CR stays `submitted`), stranger 403, step-2-too-early 403, pool OR → step-2, pendingForUser, office approve → CR approved rev 1 + spare value + spares sync_field_log row + engine request approved + slots kept + replay 409 + notifier audit rows; reject path → CR rejected, value NOT applied, slots superseded; postponement: STARTED, pool non-terminal, office terminal → `Postponement Approved` + request rows settled + module replay 400; DISABLED scope → legacy immediate approve byte-identical; **D-1 direct**: office role fleet-wide (5/5), ship role ONLY vessel-assigned holder; **W5**: dry-run + apply + equality + a store CR live through the GENERATED chain after the XOR flip | **31/31** |
| **Ship e2e** (`test-phase2-ship.ts`, ship rebuilt at `ade66f48d`) | engine NOT mounted on ship + status route 404 (client fail-soft) + `apprv_*` empty; ship spare CR → sync → **arrival sweep STARTED** → pool OR → office → applied on shore → sync → **ship sees CR approved + value, zero engine rows** (D-4); ship postponement → sync → sweep → 2 decides → `Postponement Approved` + rows settled → sync → ship settled | **15/15** |

Both end-to-end runs went through a **2-step chain with one OR step** (moc pool ANY-of-2 → office role), per W6. All fixtures cleaned both sides (0 remaining, printed by each harness); spare remarks restored; seeded users/moc/awc rows removed.

## 3. Guide corrections made (same-commit rule)

`INTEGRATION-GUIDE.md` gained, from this first real integration: §3b the engine-first decide pattern with the recursion-safe `onDecision` re-entry (the guide previously only showed submit + callback, not how existing approve routes hand over); §3c the arrival-via-sync sweep pattern for shore-only engines; §3d the workflow-XOR-old-levels cutover rule; and the advice that classification ids should be the module's existing stable config keys. Nothing in the guide proved wrong; these were the gaps.

## 4. Deviations / notes (flagged, none silent)

1. **Notifier surface** — see §1; transport seam left for the product decision.
2. `editPostponeRequest` / `editRePostponeRequest` (ship-side edits of a pending request) do not re-submit to the engine — the pending chain continues on the ORIGINAL request values snapshot-wise; the arrival sweep would start one if none exists. Acceptable v1; listed for the cutover playbook.
3. The sync-module touch (arrival sweep trigger) was explicitly instructed by W3; it is additive fire-and-forget in the controller, not the sync engine.
4. `work_order`-target CRs: no awc function exists → no card scope → always legacy (documented in `classifyChangeRequestScope`).
5. Client `ApprovalEngineAdminPage` imports the engine's client component across the server/client tree (`../../../../server/modules/approval-engine/client/...`) — vite bundles it fine (build clean); the import direction is inward-to-engine which the boundary allows (the ENGINE imports nothing outward).

## 5. Demo script for Sahil (pilot, ~10 minutes)

1. `bash local-test-env/up.sh` (shore :5000 must run the phase-2 tree) — log shows `🔏 Approval engine mounted`.
2. Browser → shore :5000 → Admin → **Approval Engine** (new menu item; the old Approval Workflow item still there).
3. In the builder: **Technical → Modify PMS — Spare Change Requests → Critical Spares** → Add step → Select Approver "Approver Pool — Level 1 (moc list)" → Add step → "Admin (OLDBUILD-MATCHED)" → note the AND/OR buttons on a multi-role row and the disabled "advanced (coming soon)" mode → ✓ Save (v1 active appears in Versions).
4. Seed two pool users (or reuse the harness): `npx tsx scripts/test-phase2-shore.ts` runs the whole flow scripted; for a manual click-through instead: create a spare CR on a Critical spare in Modify PMS (any vessel user), open it — the **Approval progress** panel shows Step 1 active; approve as a pool member (headers/user with that uuid) — Step 2 activates; approve as the office user — CR turns approved and the spare field shows the new value.
5. Toggle "Enabled for this tenant" off on the scope → create another CR → no chain, the legacy immediate-approve behaviour (his current world) is back — the fallback contract live.
6. Matrix migration: `DATABASE_URL=... npx tsx scripts/generate-approval-workflows-from-awc.ts --tenant demo` → show the support report in `docs/output/` (before/after approver sets, XOR rule).

## 6. Pilot state / cleanup

All harness fixtures deleted both sides (each run prints the zero counts). Engine tables on the pilot are empty again. Containers left **running**: shore = phase-2 working tree (TZ=UTC), ship = `ade66f48d`. `docs/output/approval-cutover-pilot-2026-08-20.md` kept as the W5 sample (untracked).

## 7. What the next phases need

- **Phase 3+ (per the plan):** unify the three legacy step paths behind the engine permanently (retire `change_request_approval` / `wo_postponement_approvals` creation once every tenant is cut over), then the WO-completion phase (D-3) with the superintendent side-channel untouched.
- **Product decisions pending:** the notifier transport; when to flip `requirePermission` enforcement (Phase-0 report §1.2); cutover schedule per client using the W5 support reports.
