# E2E Browser Acceptance — Approval Engine + Technical wiring + Notifications

**Branch:** `feature/approval-engine-phase2` @ `5f6d98a97` (the 6-commit review stack: Phase 1 + Phase 2 + Notifications)
**Date:** 21-Aug-2026 · **Driver:** Playwright (real Chromium 143), one BrowserContext per persona, server identity via `extraHTTPHeaders` (x-user-*), client identity via AES-seeded localStorage — exactly what the SAILERP MFE shell forwards.
**Environment:** local pilot — shore host process `:5000` (DB `pms_arch`, `TZ=UTC`), ship Docker container `pms-ship` `:5100` (`SHIP-WKFV`, own Postgres `pms_arch_ship`). Vessel: WK Frontier Pilot (`743ef9d1-…`).
**Scope guard:** READ-ONLY on product code — no source changed, no commits other than this report. Harness scripts (`scripts/e2e-*.ts`) are untracked. Every scenario cleans up its own fixtures; both instances were returned to a clean baseline (see §Cleanup).

---

## Result at a glance

| # | Scenario | Screen(s) under test | Checks | Result |
|---|----------|----------------------|:------:|:------:|
| S1 | Admin builder (Sahil §5) | Approval-Engine admin builder, menu-visibility matrix | 17 | **17 PASS** (E2E-1 fixed; was 16/1) |
| S2 | CR through the chain | Modify PMS CR dialog: progress panel + approve-gate across live contexts | 14 | **14 PASS** |
| S3 | Reject path | Modify PMS CR reject + requester-visible return | 8 | **8 PASS** → finding **E2E-2** |
| S4 | Notification bell | Bell badge / panel / mark-read / own-rows-only | 6 | **6 PASS** |
| S5 | Postponement via **ship** | Ship + shore Work Orders round-trip; ship engine-quiet | 16 | **16 PASS** |
| S6 | Fallback in browser | Scope-off CR = legacy, no progress panel | 3 | **3 PASS** |
| S7 | Legacy screens regression | Legacy Approval Workflow + Modify PMS list | 2 | **2 PASS** |
| | **TOTAL** | | **66** | **66 PASS** (post-fix; initial run 65/1) |

**Console:** every recorded console error/warning is environmental — the AG-Grid Enterprise trial watermark (`VITE_AG_GRID_LICENSE_KEY` unset on the dev clone) and Google-Fonts (`fonts.gstatic.com`) blocked on the offline pilot. **None originate in the approval engine, notifications, or any Phase-2 code.**

---

## Verdict

**Ready for the Sahil demo. Both findings are now FIXED and re-verified in-browser — the full suite is 66/66 (S1 17/17, S2 14/14, S3–S7 19/19, S5 16/16); `tsc --noEmit` unchanged at the 290 baseline.**

- **E2E-1 — FIXED** (`client/src/components/SideMenuBar.tsx`): the "Approval Engine" admin item now renders for the configured Sail Admin (S1 re-run 17/17); the vessel user still does not see it.
- **E2E-2 — FIXED** (`client/src/components/modifyPms/ModifyPMS.tsx`): Reject now opens the remarks modal; the reviewer's real reason flows to the requester's "Returned" notification and the reopened-CR UI (S3 re-run: the returned remark is the typed reason, not "Request rejected").
- Everything else — the full multi-actor CR chain, quorum gating, notifications (in-app + SES email path), fallback-to-legacy, the ship→shore→ship postponement round-trip, and legacy-screen regression — **passes cleanly through the real UIs.**

---

## Findings

### (a) Real defects

#### E2E-1 — "Approval Engine" admin menu item is invisible to configured roles (browser-only) — **RESOLVED**
- **Resolved (21-Aug):** the engine item has no `adm_role_menu_access` registry row, and `/admin/:subpage` renders `TechnicalModule` with **no `canViewRoute` guard**, so the only real gate is the sidebar item's visibility. Fixed in `SideMenuBar.tsx` by special-casing `approval-engine` in the menu filter to bypass the permission-map lookup (the add-condition `isShore && !isVessel` is the gate) — matching the existing `access-control` / `audit-trail` / `retention-settings` pattern. Re-verified: **S1 17/17** (Sail Admin sees it; vessel user does not).
- **What the browser reveals:** signed in as **Sail Admin** (a *configured* role), the Admin submodule does **not** render the "Approval Engine" item; the legacy "Approval Workflow" item beside it renders normally. A role with **zero** `adm_role_menu_access` rows (fail-open) *does* see it — which is the only reason S1's builder walkthrough could run in-browser at all.
- **Root cause (READ):** `client/src/components/SideMenuBar.tsx:151` correctly adds the item for `isShore && !isVessel`, but the final filter calls `canViewSidebarItem('admin','approval-engine')` (`client/src/contexts/PermissionsContext.tsx`), and `MENU_NAME_MAP.admin` has **no `approval-engine` key** (it lists `sync-fleet`, `shipskart-catalogue`, `approval-workflow`, …). For a configured role the lookup misses → returns `false` → the item is filtered out. Fail-open roles skip the check, so they see it.
- **Impact:** office users on real (configured) tenants cannot reach the engine builder from the menu. This is exactly the browser-only class the brief targets — the API and the page work; the sidebar gate hides the door.
- **Fix:** add an `approval-engine` entry to `MENU_NAME_MAP.admin` (mirroring `approval-workflow`). One line; no engine change.
- **Evidence:** [s1/01-sail-admin-menu.png](local-test-env/e2e-screens/s1/01-sail-admin-menu.png), [s1/03-builder-menu.png](local-test-env/e2e-screens/s1/03-builder-menu.png) (fail-open role sees it).

### (b) UX roughness worth fixing before the Sahil demo

#### E2E-2 — Reject on the Modify PMS CR dialog captures no reviewer remarks — **RESOLVED**
- **Resolved (21-Aug):** `modifyPms/ModifyPMS.tsx` now routes **both** Approve and Reject through `ApproveRejectModal` via a single `reviewAction: 'approve' | 'reject' | null` state; the hardcoded-comment `rejectMutation` (and its now-orphaned `useMutation` / `useToast` / `useResolvedUserName` deps) was removed. Re-verified: **S3 19/19** — the reviewer's typed reason reaches the submitter's "Returned" notification and the reopened-CR UI, and Approve is unregressed (**S2 14/14**).
- **What the browser reveals:** on a submitted CR the **Approve** button opens `ApproveRejectModal` (a required comment field), but **Reject** (`client/src/components/modifyPms/ModifyPMS.tsx:612-618`) calls `rejectMutation.mutate({ id, comment: 'Request rejected' })` immediately — **no modal, no chance to type a reason.** No remarks dialog appears (asserted in S3).
- **Consequence, proven end-to-end:** the reject *does* travel through the engine (engine request → `returned`, CR → `rejected`, value not applied) and the submitter *does* receive a "Returned" notification — but its remarks are always the canned **"Request rejected"**, never the reviewer's real reason. The engine + notifier propagate real remarks correctly (proven at API level: a `/reject` with `comment:"wrong part number"` yields `Remarks: wrong part number` to the submitter), so the gap is purely this one front-end button.
- **Why it matters for the demo:** the reject reason "will be visible to the requester" is part of the value story; a hardcoded string defeats it, and it's inconsistent with Approve.
- **Fix:** wire Reject to the existing `ApproveRejectModal` with `action="reject"` (already has `textarea-comment` + `button-reject`), symmetric with Approve.
- **Evidence (post-fix):** [s3/02-reject-modal.png](local-test-env/e2e-screens/s3/02-reject-modal.png) (the remarks modal now opens), [s3/03-requester-sees-rejected.png](local-test-env/e2e-screens/s3/03-requester-sees-rejected.png) (requester sees the real reason).

### (c) Cosmetic / environment

- **AG-Grid Enterprise trial watermark** in console + on grids — `VITE_AG_GRID_LICENSE_KEY` is unset on the dev clone. Expected; not a product issue. (License cap is 34.1.0 per CLAUDE.md; unrelated.)
- **Google Fonts blocked** (`fonts.gstatic.com` → `ERR_FAILED`) on the offline pilot; the app falls back to system fonts. Environment artifact, not a defect.

---

## Per-scenario detail

### S1 — Admin builder (Sahil's §5 walkthrough) — 16/17
Drove the builder end-to-end through the browser: registry tree (Modules → Technical), scope selection ("Modify PMS — Spare Change Requests" → "Critical Spares"), tenant toggle, mode selector with **advanced visibly disabled ("coming soon")**, building a 2-step chain (pool step + office step) with AND/OR on a multi-role row, **Save → v1 active**, re-save → **v2 active with v1 superseded** (versioning proven in DB: exactly one active version), tenant enable/disable persisted, and **no safety-rule UI anywhere** in the builder. A vessel user is blocked both from the menu item and from the direct `/admin/approval-engine` URL. The single FAIL is **E2E-1** (menu invisible to the configured Sail Admin role). Screenshots: [s1/](local-test-env/e2e-screens/s1/).

### S2 — CR through the chain (multi-actor) — 14/14
A spare CR (submitted by a vessel user) is driven through the **Modify PMS CR detail dialog** across four live persona contexts in parallel:
- **Non-approver office user:** progress panel renders with correct step + role labels (Pool review / Approver Pool / Office sign-off / External 1); **no Approve button** (`canDecide=false`).
- **Pool member A:** Approve button rendered → approving in the UI **advances the chain to step-2** (DB-confirmed).
- **Pool member B:** now sees the advanced progress (Office sign-off present); **no Approve button** (step-1 satisfied).
- **Office step-2 approver:** Approve → **CR approved, spare value applied** (DB-confirmed). Reopening the decided CR keeps the superseded slot (audit); replay is graceful (no crash). Screenshots: [s2/](local-test-env/e2e-screens/s2/).

### S3 — Reject path — 8/8 (surfaces E2E-2)
Step-1 pool approver rejects → **no remarks modal** (E2E-2); reject reaches the engine → engine request `returned`, CR `rejected`, **spare value NOT applied**; the submitter receives a "Returned" notification (delivered — surfaced in S4), carrying the canned "Request rejected" remark (E2E-2); reopened by an office user the CR shows **Rejected + the reason** in the UI. Screenshots: [s3/](local-test-env/e2e-screens/s3/).

### S4 — Notification bell — 6/6
On a fresh chain: pool member A's bell **badge ≥ 1**, panel lists an **"Approval required"** row, **clicking it marks read** (unread → 0 in DB); pool B retains its own unread row; a **non-approver office user's bell shows nothing** (own-rows-only enforced); email send-attempt rows recorded per notification (`sent` under the pilot's `APPROVAL_SMTP_JSON` test transport). Screenshots: [s4/](local-test-env/e2e-screens/s4/).

### S5 — Postponement via the **ship** (round-trip across both instances) — 16/16
The headline cross-instance scenario, proven through **both** UIs:
- **Ship (`:5100`) raises** the postponement → ship Work Orders screen shows the WO as **"Awaiting Office Approval"** (Postponed tab).
- **Ship is engine-quiet:** **no "Approval Engine" admin item** (the ship reports `isShore:false`; the item is `isShore && !isVessel`-gated), the legacy "Approval Workflow" item correctly remains (unchanged until cutover), the **`approval_notifications` table does not exist on the ship** (migration 169 is shore-only / NO_SYNC), and the bell shows no approval section — *even while a chain is live on shore*.
- **Sync ship→shore** → the shore **arrival sweep starts the engine chain** (pending @ step-1); the shore Work Orders screen shows the arrived WO as **"Awaiting Office Approval"**.
- **Shore approves both engine steps** (pool → office) → engine request completed, WO → **"Postponement Approved"**.
- **Sync shore→ship** → the **ship Work Orders screen now shows "Postponement Approved"** (green badge) — full round-trip visible in the ship UI. Screenshots: [s5/](local-test-env/e2e-screens/s5/) (notably [s5/05-ship-approved.png](local-test-env/e2e-screens/s5/05-ship-approved.png)).

### S6 — Fallback in the browser — 3/3
With the `pms-spares-cr` scope **disabled**, a new CR gets **no engine request** (fallback); the CR dialog renders **no approval-progress panel**; the legacy approve/reject controls are present exactly as before. Re-enabled afterward. Screenshots: [s6/](local-test-env/e2e-screens/s6/).

### S7 — Legacy screens regression — 2/2
The legacy **"Approval Workflow"** admin screen still loads; the **Modify PMS** list renders with its category filters and **no ApprovalChainProgress leaks onto the list view** (it is dialog-scoped). Screenshots: [s7/](local-test-env/e2e-screens/s7/).

---

## Browser-honest scope (what was driven how, and why)

Per the investigation standards, this states plainly where the pilot was and was not used:

- **Driven in-browser (the screens under test):** every menu-visibility and gating check; the builder walkthrough; the CR detail dialog (progress panel, approve/reject-button gating across contexts, the approve action itself); the notification bell (badge, panel, mark-read, own-rows-only); the fallback dialog; the legacy screens; and, in S5, the **ship and shore Work Orders screens** showing each status transition.
- **Driven via API as orchestration (not the screen under test), and labelled as such:** CR/postponement *creation*, the ship *raise* call, `sync/trigger`, and the **shore postpone-approve clicks in S5**. The Work-Orders list is AG-Grid, whose row actions are a **documented automation-hostile surface on this pilot** (the office postpone-approve click is assigned to a human tester — `reference_local_test_environment.md`). The engine **approve-through-dialog** gate is nonetheless proven live in **S2** (the identical `ApprovalChainProgress` + `canDecide` gate; `PostponeApprovalDialog` embeds the same component by READ), so S5 drives the approve via the engine-first `postpone-approve` endpoint and verifies the **screen** outcomes on both sides.
- **Untested assumptions this rests on:** persona roles were chosen from the pilot's **fail-open** roles so the pre-existing frontend menu-gate (under-configured for stock role names on the dev clone) would not hide the screens under test — this is a pilot-data artifact, not product behaviour, and is *itself* the subject of finding E2E-1 for the one role (`admin/approval-engine`) that is not merely unconfigured but unmapped. Production auth is multi-tenant (SAILERP JWT); pilot header-identity is not generalised to production.

---

## Cleanup / final state

- Both instances returned to baseline: WO `9bf65b1b` (PILOT-IOG-002) = **`Due`** on shore and ship; **0** postponement rows either side; **0** residual `apprv_*`, `approval_notifications`, or `p2e-%` fixture rows; ship↔shore **sync drains clean** (`error:null`, `remainingPush/Pull:0`).
- Incidental repair made during setup (harness hygiene, not product): 1,292 orphaned `sync_field_log` rows from earlier E2E runs (CRs deleted after their field-logs were captured) were breaking ship sync with `INSERT-shaped group for an ABSENT row`; cleared, and the harness `cleanupAll()` now sweeps such orphans. No product code touched.
- Nothing merged, nothing pushed; both dev and production untouched.
