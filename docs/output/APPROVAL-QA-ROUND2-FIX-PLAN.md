# Approval Workflow — QA round 2 + Jeevan's points: fix plan

22-Oct-2026 · branch **`feature/approval-engine-phase2` @ `07fe6ee0f`** (worktree `TechnicalMoudle-base3`) · **plan only: nothing changed yet; fixes start after Ghazi's approval**

**Inputs:**
- Suman's QA round 2: **77 cases**, 60 pass, 8 fail, 6 partial, 3 N/A.
- Jeevan's **14 points**, with screenshots.

All causes below are **READ** (from code), not yet reproduced. Each fix is re-tested on the pilot (shore + ship) before handover.

## Short version

1. **First, bring the branch up to date with `replit_dev`.** It is **48 commits behind**, including the fix for creating defects on shore (Jeevan #12). The merge has 2 conflicts, both easy.
2. **8 real bugs to fix.** All have a clear cause in the code:
   - the wrong error message;
   - re-postponement can't be approved;
   - Withdraw is missing in Modify PMS;
   - closure is allowed while an extension is pending;
   - the wrong rank appears next to the approver;
   - other users see "no approver";
   - the vessel shows blank verification and approval data;
   - shore defect creation fails.
3. **3 multi-stage bugs** (Jeevan #14):
   - an AND step can get stuck with no way out;
   - two approvers clicking together can stall a step;
   - the submitter is recorded wrongly for ship postponements.
4. **About 9 enhancements:**
   - show only the current workflow version, with history on click;
   - an approver table with vessels;
   - approval progress in the Dashboard popups;
   - who submitted;
   - closure attachments;
   - defect PDF export;
   - approval history on the vessel for defects.
5. **4 decisions needed** (Jeevan / Ghazi):
   - defect ID format (V-code);
   - Part A lock rules;
   - whether one person can approve twice in an AND step;
   - a new column for the change-request sender.
6. **Effort:** about 6–8 working days, then QA re-test of the failed and partial cases plus the affected areas.

---

## Phase 0 — Catch up with `replit_dev` (½ day)

- **What:** merge `origin/replit_dev` (`4e93a5245`, 48 commits) into the branch. Dry run: **2 conflicts**: `.agents/memory/MEMORY.md` (deleted upstream; take the deletion) and `server/middleware/permissions.ts` (resolve by hand).
- **Brings in:**
  - the **office defect series** (`ea54411f2`): shore and ship numbers no longer collide, which is the most likely cause of #12;
  - change-request children by UUID (migration 181);
  - component documents UUID (migration 182);
  - provisioning fixes.
- **Merge rules:** keep this branch's defect approval code. Do not take `replit_dev`'s versions of `defectsApprovalHooks.ts` wholesale.
- **Checks:** `replit.md` is not deleted; no lockfile pollution; tsc not above baseline; pilot ship + shore start; migration numbers 170–172, 178, 179, 181, 182 all unique.

## Phase 1 — QA failures (Suman)

| QA | Problem | Cause (READ) | Fix |
|---|---|---|---|
| **CR-01** | "Failed to submit change request" instead of the real message | Server sends the right message; 5 client screens replace it with fixed text (`Stores.tsx:1224`, `SparesNew.tsx:1040`, `JobsFormPage.tsx:379`, `ComponentRegisterFormCR.tsx:709`, `ReviewChangesDrawer.tsx:86`) | small helper `apiErrorMessage()` in `queryClient.ts`, used in the 5 screens; also stop leaving an orphan draft CR when submit is refused (check readiness before saving) |
| **PP-04 / AP-04** | No Approve/Reject for **re-postponement** | Both popups always call `/postpone-approve` / `-reject`, never `/re-postpone-…`; the server checks only the postponement scope, so re-postponement **can never be approved** from the UI. The Work Orders list also opens the review popup only on the old Level 1/2 steps (retired) | route to the re-postponement endpoints when the request is a re-postponement (server fallback too); open the popup by WO status "Awaiting Office Approval" |
| **WD-01…06** | Withdraw missing in Modify PMS | The panel **is** there, but the CR "sender" is stored as a **display name**, so "is this the sender?" is always false. Postponements store a user id, so they work | record the sender's **user id**. Safest: a new column `requested_by_uuid` (**needs migration ≥ 183 → decision D4**); old CRs stay non-withdrawable |
| **DF-06** | Closure allowed while an extension is pending | The guards run **only on shore**; the Master closes on the vessel, and the vessel's screen can't see the pending chain | server: refuse closure on the vessel too when an extension entry is "Requested"; client: treat a Requested entry as pending when the engine isn't reachable |
| **DF-09** | No attachment option in Closure | The server side exists (closure evidence = files of the defect); the **closure picker was never built** in the UI | add an evidence checklist in the C1 section; send `closureFiles`; hide "remove" after closing |
| **PDF-01…03** | Export not working | The Defects **Reports** page export is a stub (`console.log` only); the defect form export uses a wrong id field | implement the export; fix the id. **Confirm with Suman which screen she used** |
| DG-06 / DG-08 | not testable / unclear | — | give Suman clearer steps |

## Phase 2 — Jeevan's bugs

| # | Problem | Cause (READ) | Fix |
|---|---|---|---|
| **3** | "Jeevan Naik (**Chief Engineer**)" for an office user | When an office user has no rank, the server falls back to a hard-coded default **"Chief Engineer"** (`auth.ts:35, 225`), and the history uses rank before role | office users: use their role, never a rank; remove the default for office; **one-off data fix** for history rows already written |
| **13** | Other users see "⚠ no approver resolved for this role" | The approver-list endpoint allows only 3 admin role names; other viewers get **403**, which the screen shows as "no approver". Also the step editor never loads the saved steps | same permission as the page itself; show "couldn't load" instead of ⚠ on errors; pre-fill the editor from the active version |
| **12** | Shore: "Failed to create defect" | Shore and ship share one defect number series → shore reuses a number that already exists → duplicate-key error | **fixed by Phase 0** (office defect series); verify on pilot + check the dev server log |
| **8** | C2 Verification blank on vessel after sync | The data **does** reach the vessel; the screen blanks it when the engine (shore-only) isn't reachable | show the defect's own verification fields when there is no engine |
| **7** | Vessel shows no approval / approver after sync | The vessel has no engine data; the outcome fields **are** synced but not shown | show status, approval date, approver remarks, "approved by X on date" on the vessel (quick); full history in Phase 3 |
| **14** | Multi-stage inconsistent | Bugs found: **(a)** an AND step where one role has nobody on that vessel can **never** finish (no admin unblock); **(c)** two approvers clicking at the same time can leave the step stuck (no row lock); **(g)** ship postponement records the approver field as the submitter; **(e)** PMS progress panel disappears once approved (Defects keeps it); **(f)** Defects records no per-step history | fix a, c, g, e; f is covered by Phase 3 #9. **Ask Jeevan for his exact example** to confirm it's these |
| 14(b) | One person holding two roles can satisfy both slots of an AND step | engine takes the first matching slot each time | **decision D3**: allow or block? |

## Phase 3 — Enhancements (Jeevan)

| # | Enhancement | Plan |
|---|---|---|
| 1 | Show only the current workflow version | show the active version only + "Show history (N)" link (screen only) |
| 2 | Approver list as a table (user, role, assigned vessels) | extend the approver API with user and vessels; render a table; flag users with no vessel |
| 4 | Dashboard → Modify PMS popup: show approval process | reuse the existing progress + history components (Dashboard only) |
| 5 | Dashboard → Postponement popup: show approval progress | reuse the shared postponement dialog (also fixes the re-postponement routing in one place) |
| 6 | Show who submitted the extension | save submitter name + rank on the extension entry (it syncs with the defect); show "Submitted by … on …" on both sides |
| 9 | Approval history synced both ways (Defects + PMS) | use the existing synced history table (migration 179) for Defects too: record "submitted" on the vessel, decisions on shore; screens read from it on both sides. **No new table** |
| 10 | Lock Part A after submit | lock Part A fields + attachments after the first save (screen + server check). **Decision D2**: may anyone unlock (e.g. Sail Admin)? |
| 11 | V-code in the defect ID | **Decision D1**: exact format |

## Decisions needed

| # | Question | Recommendation |
|---|---|---|
| **D1** | Defect ID format with the vessel V-code, e.g. `<VCODE>-26-0001` (ship) and `<VCODE>-26-O0001` (office)? Existing IDs keep their numbers | use the V-code instead of today's internal vessel sequence; keep the office "O" mark (already on `replit_dev`) |
| **D2** | Part A locked after first save; who may unlock? | locked for everyone; Sail Admin can unlock with a reason |
| **D3** | Can one person approve two roles in the same AND step? | **no** (AND should mean two different people) |
| **D4** | New column on change requests for the sender's user id (migration ≥ 183, to be numbered against Jeevan's and Nilesh's plans) | yes; needed for Withdraw in Modify PMS |

## Decisions taken (Ghazi, 22-Oct-2026: "go with your suggestions")

| # | Decision |
|---|---|
| **D1** | Defect ID uses the vessel V-code: ship `<VCODE>-YY-NNNN`, office `<VCODE>-YY-ONNNN`. Existing defects keep their numbers. |
| **D2** | Part A is locked for everyone after the first save. Only Sail Admin may unlock, and must give a reason (recorded). |
| **D3** | One person may NOT fill two slots of the same "all must approve" step — AND means different people. |
| **D4** | Not needed — Withdraw in Modify PMS was solved without a migration (sender from the approval history). |
| Old history rows saying "(Chief Engineer)" for office users | Not decided — no data fix done; ask again before touching data. |

## Testing

- **Pilot shore + ship (both directions):**
  - CR submit with no chain (message), with chain, and withdraw from office and from vessel;
  - postponement and **re-postponement** approve / reject;
  - defect extension pending → closure refused on the vessel;
  - closure with evidence;
  - verification and approval visible on the vessel after sync;
  - office user's history label;
  - other-role viewer of the config;
  - AND step with a missing role;
  - simultaneous approvals;
  - shore defect creation.
- **Regression:** existing approval harnesses (withdraw 52, diagnostics, access, engine), sync identity fix harness, tsc not above baseline, full vitest compared base vs branch.
- **QA:** a new round for Suman covering the 8 failed + 6 partial cases and the changed areas, with clearer steps for DG-06 / DG-08.

## Effort

| Phase | Days |
|---|---|
| 0 Catch-up merge | 0.5 |
| 1 QA failures | 2–2.5 |
| 2 Jeevan bugs incl. multi-stage | 1.5–2 |
| 3 Enhancements | 2–2.5 (D1/D2 depend on decisions) |
| **Total** | **≈ 6–8 days** + pilot tests |

**Nothing is pushed** until you approve. When approved, I work on the branch in order 0 → 1 → 2 → 3, committing as support.
