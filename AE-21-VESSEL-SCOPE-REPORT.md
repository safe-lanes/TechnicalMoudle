# AE-21 Fix + Vessel-Scoped Approvals — Report

Branch: `feature/approval-engine-phase2`. Two commits: **Task 1** (AE-21) and **Task 2** (vessel scope).
tsc held at **290**; **0 migrations**. Test harnesses stay untracked (repo convention).

---

## Task 1 — AE-21: Level-1 approver could not approve a CR

### Root cause (reproduced on the pilot)
The server never refused the approve: `auth.ts:225` hardcodes `req.user.role = "Sail Admin"`, so the
approve controller passes that mock role and `isSailAdmin` at `postgresStorage.ts:5858` is always true
→ `verifyApproverForLevel` is bypassed (proven: approve returns HTTP 200 even with **no** `moc_approvers`
row). The real block was the **client Approve button**, hidden whenever the exact match on
`approver_level` (`"Level1"` vs `"Level 1"`) or the identity key failed.

### Fix (implemented)
- **`shared/approvals/level.ts`** (new) — one `normalizeLevel()` / `anyLevelMatches()` helper (trim +
  case-insensitive + whitespace-insensitive), used by every surface. No duplicated string logic.
- Client gate normalized at all four sites (ModifyPMS, PostponeApprovalDialog, Dashboard CR + postpone),
  plus a **hydration guard** so a genuine approver's button is not hidden while auth is still loading.
- Identity key standardised on **`user_uuid`** everywhere, including the "pending for me" list filter
  (`postgresStorage.ts` — was `user_id`) and the `verifyApproverForLevel` check; Dashboard's
  `pendingForApprover` now sends `userUuid`.

### Tracked finding (NOT fixed here — belongs with the mock-identity hardening item)
Because the bypass fires on the mock role, **any Office user can currently approve any CR via the API**
(proven: HTTP 200 with no approver row). The server cannot enforce approver/level/vessel on the legacy CR
path until the controller uses the real role (`forwardedRole` / `req.rbac`).

### Proof
`scripts/test-ae21-approve-e2e.ts` (7/7): a real non-Sail-Admin Office Level-1 approver completes an
approve end-to-end, including the button-visibility condition; the `Level1` vs `Level 1` drift that
reproduces AE-21 hides the button under the old gate and shows it under the fix. tsc 290; p03/p04 pass;
phase2-shore pass; p01(1)/p02(5) are pre-existing (identical on the baseline).

---

## Task 2 — Vessel-scoped approvals

Confirmed rule (SAILERP): every user has explicit vessels; no empty lists. Scope approvals by the assigned
vessel list for office and ship roles alike. In scope → act; out of scope → **read-only** (request opens,
progress panel renders, Approve/Reject absent). Fix for a wrong block = assign the vessel in SAILERP.

### Changes
- **`server/modules/approvals/vesselScopeFlag.ts`** (new) — `APPROVAL_VESSEL_SCOPE_STRICT`, **default ON**;
  the instant rollback off-ramp.
- `approvalCard.ts` — removed the office early-return in `resolveApprovers`, so under strict every role is
  scoped to the subject's vessel via `master_user_vessels`; `resolveApproverNames.vesselScoped` reflects it.
- `approvals/routes.ts` — `GET /approvals/config` exposes the flag; `hooks/useApprovalScopeConfig.ts` (new)
  reads it (fail-soft to strict) so the client gates track the server.
- Four client gates drop the `empty = fleet-wide` clause (kept only when the flag is off); the Dashboard CR
  popup gains the vessel gate it previously lacked.
- F3 safety net message sharpened: **"No approver assigned for this vessel — assign the vessel to an
  approver in SAILERP."** (progress panel + admin view).

### Proof
`scripts/test-vessel-scope.ts` (8/8): in-scope acts; out-of-scope same-role → read-only; unassigned vessel
→ zero-resolve with the new message; **flag off restores fleet-wide**. phase2-shore passes **byte-identical
with the flag off** (its section G asserts the legacy office-fleet-wide behaviour). tsc 290; 0 migrations.

### Pre-flight
`scripts/preflight-vessel-scope-zero-approvers.ts` — for every active workflow × vessel, lists the steps
that resolve to zero approvers under strict. Run against the WK dev/prod DB to size day-one impact before
switch-on.
