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
| Q2 (F6) admin-only builder — browser + API | **PROVEN** — Office "User" 403/denied, admin allowed |
| Q3 (F3b) narrowed override — API | **PROVEN** — admin decides only zero-approver steps, recorded as override |
| **AE-18 ship round-trip** (`phase2-ship`, real ship↔shore sync, ship rebuilt — `BUILD_COMMIT=891d434c4` verified) | **Core PROVEN** — arrival sweep starts the chain on shore, approver approves both steps, chain completes + applies. 2 residual "ship sees status back" checks fail **identically on original `fc52a3c6f` AND on the correctly-rebuilt ship** → pre-existing, not this fix-round; **most likely the pilot's ~5.5h clock-skew LWW artifact** (see Task 2) |
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

**Q3 decision (Ghazi):** narrow to what was asked — **remove the blanket override**; an admin may decide **only a step that resolved to ZERO approvers**, and that decision is **recorded distinctly as an admin override** in the approval record + audit.

**Fix (implemented):**
- `EngineCtx.actor` gained `isAdmin?` (`core/types.ts`); the host marks it for `Sail/Super/PMS Admin` — in `mount.resolveActor` for the engine's own routes, and (crucially, for the CR/postpone service path) in `engineGateway.engineCtx` from the request's **real rbac role** (carried on `RequestContext.rbacRole`, set in `requestContext.ts`). The engine never inspects role names.
- `engine.decide`: an admin falls back to the first active slot **only when every active slot resolved to zero approvers** (`stepStuck`). The decision remark is prefixed `[ADMIN OVERRIDE — <role>; step had no resolved approver]` and a warning is logged — recorded distinctly, not a normal approval. Admins do **not** get to decide steps that already have other resolved approvers.
- Client mirror: `useApprovalChain.canDecide` shows the button to an admin **only** when the active step is fully unresolved (`ApprovalChainProgress.tsx`).

This covers Jeevan's case (a Super Admin configured as the sole approver whose crew row is absent → the step resolves to zero → the admin can act) and gives F3 a manual, audited unstick path — without letting any admin decide any step.

**Where it is recorded:** `apprv_request_slots.remarks` on the decided slot (surfaced in the approval-progress panel and the audit row via `onDecision`), e.g. `"[ADMIN OVERRIDE — Super Admin; step had no resolved approver] admin unstick"`.

**Proof (PROVEN):** `scripts/fix-round-1-q2q3-proof.ts` Q3 — (a) zero-approver step: Super Admin decides → **200**, slot remark contains **`[ADMIN OVERRIDE …]`**; (b) a non-admin office user on the same zero-approver step → **403**; (c) Super Admin on a step that HAS resolved approvers → **403** (no blanket override). Plus `p04` all-pass (non-admins 403) and `test-phase2-shore` all-pass (normal multi-step approver flow unchanged).

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

## F6 — AE-07: RBAC negative case  →  Q2 decision: tighten to ADMIN-ONLY

**Decision (Ghazi):** align to QA — the Approval Engine builder (menu, page, and all config-write APIs) is restricted to **admin roles only** (`PMS Admin` / `Sail Admin` / `Super Admin`). A plain Office "User" must not see the menu, must not open the page by URL, and must get 403 on save. All three gates use the **same** role set — no three-way divergence.

**Fix (implemented):** the single admin set `['PMS Admin','Sail Admin','Super Admin']` applied at:
- **Menu** — `client/src/components/SideMenuBar.tsx`: add-condition `isShore && isApprovalEngineAdmin` (from `currentUser.role`).
- **Page** — `client/src/pages/TechnicalModule.tsx`: an explicit unconditional Access-Denied for `approval-engine` when `!isApprovalEngineAdmin` (independent of permission status — a plain Office User hitting the URL is refused).
- **API** — `server/modules/approvals/mount.ts`: `requireConfigWrite = requireRole(['Sail Admin','Super Admin','PMS Admin'])` (dropped the `'Office'` userType match). F7's read endpoint tightened to the same set.

**Proof (PROVEN):**
- **Browser:** plain Office "User" — Approval Engine menu **absent**, direct URL `/admin/approval-engine` → **Access Denied** (no builder tree). Admin (Sail Admin) — menu **present**, builder **renders**. (`scripts/fix-round-1-q2q3-proof.ts` Q2; screenshots `e2e-screens/q2 admin-only-builder/01–04`.)
- **API:** `POST /approval-engine/workflows` as plain Office "User" → **403**; as Sail Admin → **201**. `GET /approvals/role-approvers` as Office "User" → **403**; as Sail Admin → **200**.

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

## AE-18 — ship round-trip proof (`test-phase2-ship`, live ship :5100 ↔ shore :5000)

**Task 1 — ship rebuilt properly and re-verified.** (Correction: the FIRST AE-18 run reused an old image — the earlier rebuild had NOT completed; that run is superseded.) The ship image was rebuilt from the current branch and **`BUILD_COMMIT` inside the container = `891d434c4` = branch HEAD (verified)**; re-provisioned (10,461 rows, `verified=true`), sync drains to zero (healthy link). `phase2-ship` re-run in full on this correctly-built ship.

**The core of AE-18 — the exact QA failure (a synced postponement's approver had no Approve button, so the chain couldn't complete) — is PROVEN:**
- ship raises the postponement → sync ship→shore → **arrival sweep starts the chain on shore (step-1)** ✓
- **pool member approves → step-2** ✓ · **office approves → Postponement Approved + rows settled on shore** ✓
- (and for a CR: ship CR → sync → sweep → 2-step chain → approved + value applied on shore) ✓
- ship stays engine-quiet: engine not mounted, status route 404, `apprv_*` empty ✓

**2 residual FAILs — "SHIP sees the approved status reflected back":** after the shore approval, the ship still shows the CR as `submitted` and the WO as `Awaiting Office Approval` (the applied **spare value DID sync back**; only the CR/WO **status** did not). **PROVEN pre-existing** (reproduces identically on the original `fc52a3c6f` AND on the correctly-rebuilt current ship), so it is **not** this fix-round and **not** the stale image.

### Task 2 — read-only diagnosis of the status-back gap
- **Classification:** `change_request` (`shared/syncConfig.ts:865`) and `work_orders` (`:652`) are both `BOTH_EDITABLE` / `bidirectional`, vessel-scoped → they should sync both ways.
- **The status writes DO field-log:** the shore approval emits `sync_field_log` for `change_request.status` (`submitted→approved`, `instance_id=SHORE-PILOT`, vessel-scoped) and `work_orders.status`; totals: change_request.status 98, work_orders.status 207. Write path = `storage.approveChangeRequest → finaliseApprovedCR/updateChangeRequest` (`server/postgresStorage.ts:5837`), a field-logged storage path (so the "work_orders writes not storage-logged" lesson does **not** apply here — the log exists).
- **Evidence of the drop:** the shore's `submitted→approved` log and the spare's `remarks` log are **identical in sync state** — `is_synced=true, sync_attempts=0`, same push batch — yet on the ship the **spare value applied** while the **CR/WO status did not**, with `conflictsFound=0`.
- **The distinguishing factor:** the CR/WO are rows the **ship itself wrote** (created/edited); the spare is a row the **ship never touched** (came from provisioning). That is the signature of **last-write-wins on the shore→ship apply**: the ship's own copy looks "newer," so the shore's later status update is silently discarded (not flagged as a conflict). **The pilot has a known ~5.5h host-PG clock skew**, which makes ship-authored rows appear newer than the shore's approval and would produce exactly this.
- **Severity (honest re-frame):** most likely a **pilot clock-skew LWW artifact, not a production status-propagation bug** — the control (spare, untouched by the ship) syncs correctly, and only ship-authored rows fail. It must be **reproduced on clock-synced shore+ship instances** before being treated as the "office approves, ship never learns" divergence. *If* it persists with synced clocks, it is a genuine LWW gap of that (significant) class.
- **One-line fix direction (if it persists clock-synced):** in the shore→ship field-log apply / conflict path (`server/modules/sync/syncEngine.ts`), a shore-authored subject **status** transition must not lose wall-clock LWW to a ship row the ship last touched *before* the shore decided — treat approval/status transitions as shore-authoritative, or replace wall-clock LWW with a monotonic version / HLC. READ-ONLY — no fix this round.

## Follow-up (DO NOT FIX NOW) — mock-identity (`req.user.role`) sweep, RE-VERIFIED

**Established architecture (my Phase-0 P0.1a build + `reference_sailerp_pms_architecture.md`):** in the MFE-integrated SAILERP build, **`req.user.role` is the hard-coded mock `"Sail Admin"` for every request** (`server/middleware/auth.ts:225`; P0.1a: "role STAYS mock for RBAC"). The real SAILERP role arrives only in the forwarded `x-user-*` headers → `req.rbac.role` / `req.user.forwardedRole` (`auth.ts:236,243`), and **RBAC is enforced client-side** (the MFE reads the decrypted real role and gates the UI). So the reconciliation with "roles work in SAILERP today": a server-side check on `req.user.role` sees `"Sail Admin"` for **everyone** and is therefore **over-permissive**, but it is **not observed** because (a) the client UI blocks users from reaching those endpoints, and (b) Phase-0 already moved the security-critical surfaces (approval decide, config write) to server-side `req.rbac` enforcement. The residual reads below are **latent server-side over-permission** (a direct API call bypassing the UI would get Sail-Admin/Office access) — defense-in-depth, not an active break. Model to copy: `vessels/controllers/vesselController.ts:129,153` (`user.forwardedRole || user.role`).

**Confirmed empirically on the pilot** (the local build mocks the role, so the class is directly testable by varying `x-user-*`): a request carrying `x-user-role: Vessel User` / `x-user-type: Ship` still passes every `req.user.role` gate as `"Sail Admin"` (see `requireOfflineAdmin` below → HTTP 200), while the identical request is correctly refused (403) by a `req.rbac`-based `requireRole` guard. So the mock-vs-real split is proven, not assumed.

Per path — value in the MFE build · authz/scoping vs display · classification:

| Path:line | Value that arrives | Decision | Class |
|---|---|---|---|
| `sync/middleware.ts:29` `requireOfflineAdmin` | **mock `"Sail Admin"`** (`req.user.role`) | AUTHZ — provisioning/offline-admin gate; mock is in the allow-list so **everyone passes** server-side | **REAL RISK — PROVEN on the pilot:** `GET /sync/drift` and `GET /sync/settings` sent with `x-user-role: Vessel User` / `x-user-type: Ship` return **HTTP 200**; the same caller is **403** on a `requireRole` (`req.rbac`) endpoint (`POST /fleet/master-list-types`). Masked by the admin-only client UI, but a direct API call reaches the sync/provisioning surface |
| `components/services/documentService.ts:57-58,205,211` (via `subEntityController.getUserInfo` `:8-9` → `req.user`) | **mock `"Sail Admin"`** | AUTHZ — document view/download visibility; mock hits the `Office/Admin → allow` branch, so **all docs viewable/downloadable**; the `role==='Ship'` branches are **dead** | **REAL RISK (latent)** — masked by client UI |
| `components/services/subEntityService.ts:146` + `role==='Ship'` branches (`:17,53,98,…`) | **mock `"Sail Admin"`** | AUTHZ/scoping — `role !== 'PMS Admin' && role !== 'Sail Admin'` is false for the mock (never blocks); ship-scoping branches dead | **REAL RISK (latent)** — same class |
| `spares/controllers/sparesController.ts:9` | **mock `"Sail Admin"`** | AUTHZ — strips `isRotationItem` for unauthorized; mock is allow-listed so the field is **never stripped** server-side | **REAL RISK (minor/latent)** |
| `middleware/auth.ts:146` `requireVesselAccess` | mock `"Sail Admin"` | AUTHZ — vessel-access gate; mock bypasses, `role==='Ship'` check dead | **NOT A RISK** — **no live route uses it** (dead code); fix only if revived |
| `change-requests/controllers/changeRequestsController.ts:107,123` | mock `"Sail Admin"` passed as `role` to `crService.approve/reject` | The **authz** is the route guard `requireApproverOrRole` (real `req.rbac`); this `role` feeds the legacy apply/audit | **NOT A RISK** for authz (decision is the real-role route guard); the mock `role` into the service is audit/display — *verify it drives no decision* |
| `jobs/services/jobService.ts:499` — `role==='Ship'` scoping | likely mock (from `req.user`) → branch **dead** | scoping | **UNVERIFIED** — whether vessel data is still correctly scoped by `vessel_id` elsewhere needs a per-endpoint check |

**Display/audit only (not authz — lowest priority):** `work-orders/controllers/workOrderController.ts` (`sessionRole` logs, `body.userRole`), `jobs/controllers/jobController.ts:111`, `chatbot/controllers/chatbotController.ts:23`, `access-control/controllers/viewModeController.ts:43`.

**Net:** the REAL-RISK items are all **latent server-side over-permission masked by the client UI** — worth a defense-in-depth hardening pass (switch authz reads to `req.rbac.role`), not an active production break. Already fixed this round: F5 route guard + F3b `engineGateway.engineCtx` (reads the real role via `RequestContext.rbacRole`). **DO NOT FIX the rest now.**

## Decisions applied (Ghazi, round 2)
- **Q1 (F5):** CONFIRMED — a configured approver can decide regardless of user type; `requireApproverOrRole` kept as implemented; non-approvers still refused (`p04` stands).
- **Q2 (F6):** TIGHTENED to admin-only (`PMS/Sail/Super Admin`) across menu + page + API, one shared role set. PROVEN in browser + API.
- **Q3 (F3b):** NARROWED — blanket override removed; admin override only on a zero-approver step, recorded distinctly as an admin override in `apprv_request_slots.remarks` + audit. PROVEN.
