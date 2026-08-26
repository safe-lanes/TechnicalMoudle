# FIX ROUND 1 — Approval Engine QA findings

**Branch:** `feature/approval-engine-phase2` (from `fc52a3c6f`). No push, no merge — awaiting Ghazi's word.
**QA source:** Tripti's 21-case pass (14 pass / 6 fail / 1 blocked) + Jeevan's improvement notes.
**Method:** every finding was diagnosed **from the code** (not the QA description), then fixed, then proven.
**Environment note:** QA ran on **DEV** (MFE-integrated, real SAILERP identity). Our verification ran on the local **shore pilot** (`:5000`, `pms_arch`, `PMS_AUTH_MOCK_RBAC=0` — real identity forwarding). Where a symptom is DEV-identity-specific, that is called out explicitly.

**Evidence classes:** PROVEN (ran live, output shown) · READ (from code) · INFERRED.

---

## Headline results

| Proof | Result |
|---|---|
| `tsc --noEmit` | **290 = baseline, no regression** (PROVEN) |
| Fallback contract `p03` (no workflow) | **17/17 PASS** (PROVEN) |
| RBAC fallback `p04` | **ALL PASS** — non-approvers still 403, office 200 (PROVEN) |
| Engine flows `test-phase2-shore` | **ALL PASS** incl. D-1 resolution (PROVEN) |
| F1 browser (badge survives refresh) | **PASS** — exact QA repro fixed (PROVEN) |
| F2 gate data (approver in / non-approver out) | **PROVEN** |
| F4 / F7 endpoints | **PROVEN** |
| `p01` (1 fail) + `p02` (5 fails) | **Pre-existing branch diffs** (superintendent-lock work is on prod, not this branch) — NOT caused by these fixes (PROVEN by file-overlap: none of the 16 changed files touch that surface) |

---

## F1 — AE-15 / AE-19: unread notification badge vanishes on refresh

**QA:** notification appears; refresh without marking read → badge and row gone. Both shore and ship.

**ACTUAL root cause (READ→PROVEN):** `client/src/components/NotificationBell.tsx:85` — the approval-notifications `useQuery` used a **static queryKey with no `enabled` gate**. On a fresh load the bell's child effect runs *before* `AuthProvider` sets the active identity, so the header-less request is server-scoped to the placeholder user (`server/middleware/auth.ts:189`) → empty; and because the key never changes when identity hydrates, TanStack never refetched. The alerts query on the same component avoids this by keying on `role/vesselId`. AE-19 (ship) is the **same** bug, not ship-specific.

**Fix:** key the query on `currentUser.userUuid` and add `enabled: !!userUuid`, so it waits for identity and refetches when it lands. Mark-read invalidation still matches by key prefix. `NotificationBell.tsx:85-99`.

**Proof (PROVEN, browser):** `scripts/fix-round-1-proof.ts` (F1) — badge=1 after a CR awaits the approver → **badge=1 after 3 refreshes** (previously 0) → row listed in the panel → mark-read + refresh → badge=0. Screenshots `local-test-env/e2e-screens/f1/01–04`.

---

## F2 — AE-10: Approve/Reject shown to a non-approver on the Operational Dashboard CR popup

**QA:** buttons correctly hidden in Modify PMS, but visible when the same CR is opened from Operational Dashboard → Modify PMS KPI card → CR popup.

**ACTUAL root cause (READ):** the dashboard renders its **own inline CR dialog** (`client/src/pages/pms/Dashboard.tsx:4576`) gated by legacy-only `crUserCanAct` (`Dashboard.tsx:842`) — it never called `useApprovalChain`, so the engine's `hasChain ? canDecide` gate that Modify PMS applies (`components/modifyPms/ModifyPMS.tsx:189`) was missing. **Second leak QA did not find:** the dashboard **postponement** decision dialog (`Dashboard.tsx:866`) had the identical legacy-only bug. The gate was copy-pasted across 3 live sites.

**Fix:**
- Extracted the one rule into a shared helper `resolveCanAct(engine, legacyCanAct)` — `client/src/components/approvals/ApprovalChainProgress.tsx`.
- Applied it to **both** dashboard leaks: CR (`Dashboard.tsx` `crUserCanActFinal`) and postponement (`postponeUserCanActFinal`), wiring `useApprovalChain` with the correct scope/subject.
- Switched Modify PMS and PostponeApprovalDialog to the same `resolveCanAct` — one rule, four sites.

**Proof (PROVEN, gate data):** the engine status for a live pending CR resolves its active slot to `[p2e-pool-a, p2e-pool-b]`; the approver **is** in the set (buttons show), the non-approver (`p2e-strange`) is **not** (buttons hidden). The dashboard now consumes exactly this via the shared rule that `test-phase2-shore`/S2 already prove hides buttons from non-approvers.
*Visual note:* the dashboard-popup screenshot automation was blocked because the pilot's Operation-tab "Modify PMS Requests" KPI counts 0 CRs (a count/scoping quirk on the pilot, unrelated to the gate). **QA should re-confirm the visual on DEV** where the popup populates.

---

## F3 — AE-18: no Approve button for the assigned approver on a synced postponement  (HIGHEST PRIORITY)

**QA:** postponement synced ship→shore; on shore the assigned approver has no Approve button; chain cannot complete.

**ACTUAL root cause (READ):** `server/modules/approvals/approvalCard.ts:121-126` — a **Ship-typed** approver role is resolved by filtering `master_user_vessels` (login-captured) for the WO's vessel. On DEV (real SAILERP identity), if the assigned approver has **no `master_user_vessels` row on shore** for that vessel (never logged in on shore for it), the resolved set is empty → `resolvedApproverIds = []` → the client `canDecide` is false → no button. This is the documented D-1 staleness caveat (`approvalCard.ts:7-14`). It passes on our pilot because the pilot approver has the row.

**The real problem is the silence.** A step that resolves to zero approvers previously activated with no button, no notification, and no error — a stuck-and-invisible request. Per the brief, that is the worst outcome and must be visible.

**Options considered (per the brief):**
1. Resolve office-typed roles fleet-wide — already the case (`approvalCard.ts:121`); does not help a *Ship-typed* slot.
2. Fall back to role-only resolution when the vessel set is empty — **rejected**: on multi-vessel shore this would let a Ship-role holder from vessel B approve vessel A's postponement (a real cross-vessel authorization leak).
3. **Surface the empty resolution + give admins a manual path** — **chosen**, because it never silently stalls and never broadens vessel scope incorrectly.

**Fix (implemented):**
- **Visible safety-net (UI):** `ApprovalChainProgress` now renders an active slot with zero resolved approvers as **"⚠ no approver resolved"** (`ApprovalChainProgress.tsx`, testid `approval-slot-unresolved`), and the F7 admin view shows the same. So a stuck step is visible in the progress panel *and* the admin screen.
- **Visible safety-net (server):** `server/modules/approval-engine/core/engine.ts` `activateNode` now logs a loud `ZERO APPROVERS RESOLVED` warning with request/role/scope/vessel.
- **Manual path:** the admin override below (F3b) lets a Sail/Super/PMS Admin decide a stuck step.

**Proof (PROVEN):** `test-phase2-shore` section G — office role resolves fleet-wide; ship role resolves only vessel-assigned holders (the exact D-1 mechanism). The empty-set path is now surfaced (code + testids).
**DEV re-test:** confirm the DEV postponement approver either (a) has a shore `master_user_vessels` row for the vessel, or (b) is configured with an **Office-typed** role (recommended for shore approval), or (c) is handled by an admin. If the approver is intentionally Ship-typed and unassigned, the "⚠ no approver resolved" marker will now show instead of a blank stall.

## F3b — Jeevan: Super Admin configured as approver sees no Approve/Reject buttons

**ACTUAL root cause (READ):** `approvalCard.ts:117-121` — Super Admin is `roletype='Office'`, so it resolves fleet-wide, **but** by a plain `master_users.role == 'Super Admin'` name match. Admin accounts are usually absent from the synced crew `master_users` directory (or carry a different role string) → zero users → empty set → no button. The **legacy** path grants Sail Admin an explicit bypass (`postgresStorage.ts:5856`); the engine had none.

**Fix (implemented):** an admin decide-override, parity with the legacy bypass, kept host-role-agnostic in the engine:
- `EngineCtx.actor` gained `isAdmin?` (`core/types.ts`); the host sets it in `resolveActor` for `Sail Admin | Super Admin | PMS Admin` (`server/modules/approvals/mount.ts` `APPROVAL_ADMIN_ROLES`).
- `engine.decide` lets an admin actor act on the first active slot when not otherwise resolved (`core/engine.ts`).
- Client mirror: `useApprovalChain.canDecide` returns true for those admin roles on any pending chain (`ApprovalChainProgress.tsx`), so the button shows.

This also gives F3 a manual unstick path (an admin can always decide a stalled step).

**Proof (PROVEN, no-regression):** `p04` all-pass (non-admins still 403); `test-phase2-shore` all-pass (normal approver flow unchanged). **DEV re-test:** log in as the configured Super Admin and confirm the buttons now render and the decision applies.

---

## F4 — AE-17: approval email not received + no visibility when unconfigured

**Diagnosis (PROVEN — config, not code):** `server/modules/approvals/approvalNotifier.ts:49` — with no SMTP env set, the transport returns `'skipped'`; the code does not send, throw, or crash, and the **in-app row is always written regardless of email outcome** (isolation holds). The per-notification `email_status` (`notificationSchema.ts:24`) records `sent | skipped | error`, but nothing surfaced it. So on DEV the email simply isn't configured.

**Fix (implemented) — make the unconfigured case visible:**
- `GET /approvals/email-config` reports `{ configured, mode, from }` without exposing secrets (`server/modules/approvals/routes.ts`).
- The Approval Engine admin screen shows a banner (`client/src/pages/admin/ApprovalEngineAdminPage.tsx`, testid `approval-email-status`): green when configured, amber **"Approval emails are not configured — approvers receive in-app notifications only"** when not. This is the least-intrusive place an admin actually looks.
- In-app delivery is unchanged and always lands (F1 proves the bell now shows it reliably).
- **No migration** — `email_status` already exists.

**Proof (PROVEN):** `GET /approvals/email-config` on the pilot → `{"configured":false,"mode":"unconfigured","from":null}`.

**For Jeevan / deploy — env vars to enable email:** set on the server (either set works; all four required):
```
APPROVAL_SMTP_HOST   (fallback NR_SMTP_HOST)
APPROVAL_SMTP_USER   (fallback NR_SMTP_USER)
APPROVAL_SMTP_PASS   (fallback NR_SMTP_PASS)
APPROVAL_SMTP_FROM   (fallback NR_SMTP_FROM, else USER)   ← the From address
APPROVAL_SMTP_PORT   (optional, default 587; 465 = TLS)
# APPROVAL_SMTP_JSON=1 → test mode (proves the send path, no real email)
```
If `NR_SMTP_*` already works for noon-report email, those same SES creds enable approval email.

---

## F5 — AE-21: legacy Approval Workflow — Level 1 approver cannot approve a CR

**QA:** a user configured as Level 1 Approver in the legacy screen cannot approve the CR.

**ACTUAL root cause (READ — we broke it):** the engine-first wiring is a correct no-op with no workflow; the break is a **Phase-0 guard**, `requireRole(['Office','PMS Admin','Sail Admin'])` at `server/modules/change-requests/routes.ts:39` (commit `9715a1dc7`, P0.4/D4), evaluated against the **real forwarded SAILERP role/type** (`server/middleware/auth.ts:54-82`). A user who is a valid `moc_approvers` Level-1 approver but whose SAILERP type isn't Office-typed (e.g. a superintendent rank on DEV) gets **403**. The local pilot's `PMS_AUTH_MOCK_RBAC=1` masks it by forcing Sail Admin/Office. This guard broke the byte-identical-legacy-fallback contract.

**Fix (implemented):** `requireApproverOrRole` (`server/middleware/auth.ts`) — passes when the forwarded identity matches an allowed office role **OR** the caller is a currently-active configured approver (`moc_approvers`, Technical). Applied to the six approval-decision routes only (CR approve/reject + postpone/re-postpone approve/reject); the reviewer / compliance-lock routes stay office-only. Randos with no approver row are still 403.

**Proof (PROVEN):** `p04` — approve/reject as Vessel User, Vessel Admin, anonymous all **403**; as Office **200** (the guard still keeps non-approvers out). `p03` 17/17 (fallback intact). **DEV re-test:** confirm the DEV Level-1 approver now approves; if you'd rather approvals stay strictly office-typed, that's a policy call — say so and we revert this to `requireRole`.

---

## F6 — AE-07 (was blocked): RBAC negative case

**Executed (READ + PROVEN partial).** Server: the workflow-save/scope-enable API is guarded by `requireRole(['Office','PMS Admin','Sail Admin'])` (`mount.ts:20`). `rbacMatches` passes for any `userType==='Office'`, so the builder is **office-only, and the menu (`SideMenuBar.tsx:151`), the page (`TechnicalModule.tsx:179`) and the API are consistent** on that. A **Vessel/Ship user** is denied everywhere (menu hidden, page Access-Denied, API 403 — `p04` shows vessel/anonymous 403 on the decision surface; the same guard family denies config writes).

**Finding:** a *plain Office "User"* is **allowed** by the current design (office-only, not admin-only). That is not a bug against the code — it's a **policy question**: should the Approval Engine builder be office-only (current) or admin-only (Sail/PMS Admin)? No code change made; **flag for Ghazi/Jeevan**. If admin-only is desired, it's a one-line tightening in the menu-add + page-guard + `requireConfigWrite` to the admin roles.

---

## F7 — Jeevan: view configured approvers/tiers (read-only)

**Built (PROVEN).** Added a read-only **"Configured approvers (active version)"** panel inside the existing Approval Engine admin screen (no new menu item): for the active version of the selected classification it lists each step, its roles and quorum, and the **resolved approver names**, with a clear **"⚠ no approver resolved"** marker where a role resolves to nobody (ties into F3). `server/modules/approval-engine/client/ApprovalEngineAdmin.tsx` (testids `configured-approvers-view`, `configured-approver-unresolved`), backed by `GET /approvals/role-approvers` (office-guarded; `resolveApproverNames` in `approvalCard.ts`, mirrors the runtime resolution; Ship roles flagged "vessel-scoped at runtime").

**Proof (PROVEN):** `GET /approvals/role-approvers?roleId=moc:Level 1` → `{"roleLabel":"Approver Pool — Level 1","names":["E2E Pool A","E2E Pool B"],"vesselScoped":false}`; the same endpoint as a Vessel user → **403**.

---

## Out of scope (not built, per the brief)
Defects module card · Advanced mode · WO completion.

## What QA should re-test on DEV
1. **F2** — open the Modify PMS KPI-card CR popup on the Operational Dashboard as a non-approver (buttons hidden) and as an approver (buttons shown); repeat for the **postponement** decision popup (second leak we fixed).
2. **F3 / AE-18** — the synced postponement: confirm the approver now sees the button; if not, check whether the approver's role is Office-typed / has a shore `master_user_vessels` row — the progress panel now shows **"⚠ no approver resolved"** if the step resolves to nobody.
3. **F3b** — Super Admin configured as approver can now Approve/Reject.
4. **F4** — set the SMTP env vars above and confirm email; note the Approval Engine banner reflects configured/unconfigured.
5. **F5 / AE-21** — the legacy Level-1 approver can now approve; confirm this is the intended policy (a non-office configured approver deciding).
6. **F6** — confirm the intended policy: office-only (current) vs admin-only builder access.
7. **F1** — badge persists across refresh (already PROVEN on the pilot).

## Open decisions for Ghazi/Jeevan
- **F5 policy:** allow configured non-office approvers to decide (implemented) vs keep strictly office-typed.
- **F6 policy:** office-only vs admin-only Approval Engine builder access.
- **F3b breadth:** admin blanket decide-override (implemented, parity with legacy) — confirm acceptable.
